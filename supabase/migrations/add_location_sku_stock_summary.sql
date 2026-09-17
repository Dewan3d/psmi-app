-- ============================================================
-- PSMI System — Migration: Add Location SKU Stock Summary View
-- ============================================================

CREATE OR REPLACE VIEW location_sku_stock_summary AS
SELECT location_id, sku, status, count(*)::int as count
FROM inventory_units
GROUP BY location_id, sku, status;

GRANT SELECT ON location_sku_stock_summary TO anon, authenticated, service_role;
