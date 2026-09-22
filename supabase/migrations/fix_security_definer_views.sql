-- ============================================================
-- PSMI System — Fix Security Definer Views (Supabase Advisor)
-- ============================================================
-- Supabase flags views created without explicit security_invoker
-- as "SECURITY DEFINER" because in older Postgres / default view
-- creation, views query underlying tables using the view creator's
-- privileges instead of the calling user's RLS rules.
--
-- Running this script sets security_invoker = true on these views
-- so they enforce the querying user's RLS permissions and clear
-- the Supabase Security Advisor alerts.
-- ============================================================

-- 1. Fix inventory_stock_summary
ALTER VIEW public.inventory_stock_summary SET (security_invoker = true);

-- 2. Fix location_sku_stock_summary
ALTER VIEW public.location_sku_stock_summary SET (security_invoker = true);

-- 3. Fix location_stock_summary (if present)
ALTER VIEW public.location_stock_summary SET (security_invoker = true);

-- 4. Fix inbound_shipments_overview (if present)
ALTER VIEW public.inbound_shipments_overview SET (security_invoker = true);
