-- ============================================================
-- PSMI System — Migration: Add is_serialized to products
-- ============================================================
-- Adds a boolean to distinguish serialized (batteries, power stations)
-- and non-serialized (accessories, solar panels) products.
-- ============================================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_serialized BOOLEAN DEFAULT TRUE;
