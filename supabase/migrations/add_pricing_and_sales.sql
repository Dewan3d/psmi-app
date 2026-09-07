-- ============================================================
-- PSMI System — Add Pricing & Sales Support
-- ============================================================
-- Adds cost/retail pricing to products, per-unit sale/purchase
-- prices to transaction_items, and customer_name to transactions.
-- All columns nullable — zero impact on existing data.
-- ============================================================

-- 1. Products: default pricing columns
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS retail_price NUMERIC(12,2);

-- 2. Transaction Items & Inventory Units: per-unit pricing
ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS sale_price     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,2);

ALTER TABLE inventory_units
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,2);

-- 3. Transactions: customer name for B2B/B2C outbounds
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- 4. Index for efficient sales page queries
CREATE INDEX IF NOT EXISTS idx_transactions_route_type
  ON transactions (type, route)
  WHERE type = 'OUTBOUND';
