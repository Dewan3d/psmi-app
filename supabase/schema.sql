-- ============================================================
-- PSMI System — Database Schema
-- Power Station Management Inventory
-- ============================================================
-- This file defines the complete database schema.
-- Run this as a Supabase SQL migration.
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE unit_status AS ENUM (
  'IN_WAREHOUSE',
  'RESERVED',
  'IN_TRANSIT',
  'IN_BRANCH',
  'SOLD',
  'DAMAGED_REPAIR'
);

CREATE TYPE transaction_type AS ENUM (
  'INBOUND',
  'OUTBOUND'
);

CREATE TYPE outbound_route AS ENUM (
  'TB',   -- Transfer to Branch
  'B2B',  -- Business to Business
  'B2C'   -- Business to Customer
);

CREATE TYPE user_role AS ENUM (
  'ADMIN',
  'WAREHOUSE_MANAGER',
  'BRANCH_STAFF'
);

-- ============================================================
-- 2. TABLES
-- ============================================================

-- Locations: warehouses and branches
CREATE TABLE locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('WAREHOUSE', 'BRANCH')),
  address     text,
  created_at  timestamptz DEFAULT now()
);

-- Profiles: extends Supabase Auth users with app-specific data
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL,
  role        user_role DEFAULT 'BRANCH_STAFF',
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- Products: the catalogue of valid SKUs
CREATE TABLE products (
  sku                 text PRIMARY KEY,
  model_name          text NOT NULL,
  description         text,
  low_stock_threshold integer DEFAULT 10,
  is_serialized       boolean DEFAULT true,
  image_url           text,
  barcode             text,
  created_at          timestamptz DEFAULT now()
);

-- Inventory Units: every individual physical device
CREATE TABLE inventory_units (
  serial_number text PRIMARY KEY,
  sku           text NOT NULL REFERENCES products(sku) ON DELETE RESTRICT,
  status        unit_status DEFAULT 'IN_WAREHOUSE',
  location_id   uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  upload_date   timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Transactions: logs all inbound and outbound events
CREATE TABLE transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type              transaction_type NOT NULL,
  route             outbound_route,
  from_location_id  uuid REFERENCES locations(id) ON DELETE SET NULL,
  to_location_id    uuid REFERENCES locations(id) ON DELETE SET NULL,
  tracking_number   text UNIQUE,
  user_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  notes             text,
  verified          boolean DEFAULT false,
  created_at        timestamptz DEFAULT now()
);

-- Transaction Items: junction linking serial numbers to a transaction
CREATE TABLE transaction_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  serial_number   text NOT NULL REFERENCES inventory_units(serial_number) ON DELETE RESTRICT,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (transaction_id, serial_number)
);

-- Verification Documents: URLs to uploaded waybills, receipts, screenshots
CREATE TABLE verification_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  document_type   text NOT NULL CHECK (document_type IN ('WAYBILL', 'PAYMENT_RECEIPT', 'PAYMENT_SCREENSHOT')),
  storage_url     text NOT NULL,
  uploaded_at     timestamptz DEFAULT now()
);

-- Audit Log: immutable log for compliance and debugging
CREATE TABLE audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name  text NOT NULL,
  record_id   text NOT NULL,
  action      text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  user_id     uuid,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

-- FIFO ordering: find oldest units first by SKU and status
CREATE INDEX idx_inventory_fifo
  ON inventory_units (sku, status, upload_date ASC);

-- Location dashboard queries: units at a specific location by status
CREATE INDEX idx_inventory_location_status
  ON inventory_units (location_id, status);

-- Sales reporting: transactions by creation date
CREATE INDEX idx_transactions_created_at
  ON transactions (created_at);

-- Lookup by tracking number
CREATE INDEX idx_transactions_tracking_number
  ON transactions (tracking_number);

-- Transaction items by transaction
CREATE INDEX idx_transaction_items_txn
  ON transaction_items (transaction_id);

-- Transaction items by serial number
CREATE INDEX idx_transaction_items_serial
  ON transaction_items (serial_number);

-- ============================================================
-- 4. DATABASE FUNCTIONS & TRIGGERS
-- ============================================================

-- 4A. Generate Tracking Number
-- Creates a random 12-character alphanumeric tracking number on transaction insert
CREATE OR REPLACE FUNCTION generate_tracking_number()
RETURNS TRIGGER AS $$
DECLARE
  new_tracking text;
  exists_already boolean;
BEGIN
  LOOP
    -- Generate a random 12-char alphanumeric string prefixed with 'PSMI-'
    new_tracking := 'PSMI-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12));

    -- Check for uniqueness
    SELECT EXISTS (
      SELECT 1 FROM transactions WHERE tracking_number = new_tracking
    ) INTO exists_already;

    EXIT WHEN NOT exists_already;
  END LOOP;

  NEW.tracking_number := new_tracking;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_tracking_number
  BEFORE INSERT ON transactions
  FOR EACH ROW
  WHEN (NEW.tracking_number IS NULL)
  EXECUTE FUNCTION generate_tracking_number();

-- 4B. Auto-update updated_at on inventory_units
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_updated_at
  BEFORE UPDATE ON inventory_units
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 4C. Generic Audit Log Trigger Function
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
DECLARE
  rec_id text;
BEGIN
  -- Determine record ID based on table name
  IF TG_TABLE_NAME = 'products' THEN
    rec_id := COALESCE(NEW.sku::text, OLD.sku::text);
  ELSIF TG_TABLE_NAME = 'inventory_units' THEN
    rec_id := COALESCE(NEW.serial_number::text, OLD.serial_number::text);
  ELSE
    rec_id := COALESCE(NEW.id::text, OLD.id::text);
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, user_id)
    VALUES (
      TG_TABLE_NAME,
      rec_id,
      'INSERT',
      NULL,
      to_jsonb(NEW),
      COALESCE(current_setting('app.current_user_id', true)::uuid, NULL)
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, user_id)
    VALUES (
      TG_TABLE_NAME,
      rec_id,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      COALESCE(current_setting('app.current_user_id', true)::uuid, NULL)
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, user_id)
    VALUES (
      TG_TABLE_NAME,
      rec_id,
      'DELETE',
      to_jsonb(OLD),
      NULL,
      COALESCE(current_setting('app.current_user_id', true)::uuid, NULL)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit triggers to key tables
CREATE TRIGGER trg_audit_inventory_units
  AFTER INSERT OR UPDATE OR DELETE ON inventory_units
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER trg_audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER trg_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- 4D. Auto-create profile on Supabase Auth sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    'BRANCH_STAFF'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 5. SEED DATA — Placeholder Locations
-- ============================================================

INSERT INTO locations (name, type, address) VALUES
  ('Main Warehouse', 'WAREHOUSE', '123 Industrial Rd, Johannesburg'),
  ('Johannesburg Branch', 'BRANCH', '456 Market St, Johannesburg'),
  ('Cape Town Branch', 'BRANCH', '789 Ocean Dr, Cape Town'),
  ('Durban Branch', 'BRANCH', '321 Beach Rd, Durban');
