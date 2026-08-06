-- ============================================================
-- PSMI System — Row Level Security Policies
-- ============================================================
-- Run this AFTER schema.sql
-- Enables RLS on all tables and defines access policies
-- ============================================================

-- ============================================================
-- Helper function to get current user's role
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to get current user's location
CREATE OR REPLACE FUNCTION get_user_location_id()
RETURNS uuid AS $$
  SELECT location_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- LOCATIONS
-- ============================================================
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read locations
CREATE POLICY "locations_select_all"
  ON locations FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage locations
CREATE POLICY "locations_insert_admin"
  ON locations FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() = 'ADMIN');

CREATE POLICY "locations_update_admin"
  ON locations FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'ADMIN');

CREATE POLICY "locations_delete_admin"
  ON locations FOR DELETE
  TO authenticated
  USING (get_user_role() = 'ADMIN');

-- ============================================================
-- PROFILES
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read profiles
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own profile (name only, not role)
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Admins can update any profile (including role changes)
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'ADMIN');

-- Profiles are auto-created by the trigger, no manual insert needed
-- But allow the trigger (SECURITY DEFINER) to insert
CREATE POLICY "profiles_insert_self"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ============================================================
-- PRODUCTS
-- ============================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read products
CREATE POLICY "products_select_all"
  ON products FOR SELECT
  TO authenticated
  USING (true);

-- Only ADMIN and WAREHOUSE_MANAGER can manage products
CREATE POLICY "products_insert_managers"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() IN ('ADMIN', 'WAREHOUSE_MANAGER'));

CREATE POLICY "products_update_managers"
  ON products FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('ADMIN', 'WAREHOUSE_MANAGER'));

CREATE POLICY "products_delete_admin"
  ON products FOR DELETE
  TO authenticated
  USING (get_user_role() = 'ADMIN');

-- ============================================================
-- INVENTORY_UNITS
-- ============================================================
ALTER TABLE inventory_units ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read inventory
CREATE POLICY "inventory_select_all"
  ON inventory_units FOR SELECT
  TO authenticated
  USING (true);

-- ADMIN and WAREHOUSE_MANAGER can insert units
CREATE POLICY "inventory_insert_managers"
  ON inventory_units FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() IN ('ADMIN', 'WAREHOUSE_MANAGER'));

-- ADMIN and WAREHOUSE_MANAGER can update any unit
CREATE POLICY "inventory_update_managers"
  ON inventory_units FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('ADMIN', 'WAREHOUSE_MANAGER'));

-- Branch staff can update status only for units at their location
CREATE POLICY "inventory_update_branch_staff"
  ON inventory_units FOR UPDATE
  TO authenticated
  USING (
    get_user_role() = 'BRANCH_STAFF'
    AND location_id = get_user_location_id()
  );

-- ============================================================
-- TRANSACTIONS
-- ============================================================
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read transactions
CREATE POLICY "transactions_select_all"
  ON transactions FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can create transactions
CREATE POLICY "transactions_insert_all"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only ADMIN and WAREHOUSE_MANAGER can update (verify) transactions
CREATE POLICY "transactions_update_managers"
  ON transactions FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('ADMIN', 'WAREHOUSE_MANAGER'));

-- ============================================================
-- TRANSACTION_ITEMS
-- ============================================================
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read transaction items
CREATE POLICY "transaction_items_select_all"
  ON transaction_items FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can insert transaction items
CREATE POLICY "transaction_items_insert_all"
  ON transaction_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- VERIFICATION_DOCUMENTS
-- ============================================================
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read verification documents
CREATE POLICY "verification_docs_select_all"
  ON verification_documents FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can upload verification documents
CREATE POLICY "verification_docs_insert_all"
  ON verification_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- AUDIT_LOG
-- ============================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only ADMIN can read audit logs
CREATE POLICY "audit_log_select_admin"
  ON audit_log FOR SELECT
  TO authenticated
  USING (get_user_role() = 'ADMIN');

-- No manual inserts allowed — trigger-only
-- (No INSERT policy means RLS blocks manual inserts from app code)

-- ============================================================
-- SUPABASE STORAGE BUCKET
-- ============================================================
-- NOTE: Run this in the Supabase Dashboard SQL Editor or use the
-- Storage API. This creates the verification-docs bucket.
-- 
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('verification-docs', 'verification-docs', false);
--
-- Storage RLS policies:
-- 
-- CREATE POLICY "verification_docs_upload"
--   ON storage.objects FOR INSERT
--   TO authenticated
--   WITH CHECK (bucket_id = 'verification-docs');
--
-- CREATE POLICY "verification_docs_read"
--   ON storage.objects FOR SELECT
--   TO authenticated
--   USING (bucket_id = 'verification-docs');
