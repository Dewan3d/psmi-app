-- ============================================================
-- Migration: Add category_badge to products table
-- ============================================================
-- Adds a product category badge for dashboard filtering.
-- Valid values: POWER_STATION, SHS, ACCESSORIES
-- Defaults to POWER_STATION for existing rows.
-- ============================================================

-- Add the column with a CHECK constraint (no new enum type needed)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_badge text
    DEFAULT 'POWER_STATION'
    CHECK (category_badge IN ('POWER_STATION', 'SHS', 'ACCESSORIES'));

-- Index for fast dashboard category filtering
CREATE INDEX IF NOT EXISTS idx_products_category_badge
  ON products (category_badge);
