-- ============================================================
-- PSMI System — Migration: Add PENDING_SERIAL status
-- ============================================================
-- Run this against your live Supabase database via SQL Editor
-- or the Supabase CLI: supabase db push
-- ============================================================

-- Add the new status value to the existing enum
ALTER TYPE unit_status ADD VALUE IF NOT EXISTS 'PENDING_SERIAL';

-- ============================================================
-- After running this migration, restart any PostgREST connections
-- to pick up the new enum value. In Supabase dashboard, this
-- happens automatically within a few seconds.
-- ============================================================
