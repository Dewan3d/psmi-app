-- ============================================================
-- Migration: Add Donations Support to Transactions Table
-- ============================================================
-- Adds is_donation and donation_program to distinguish CSR/Donation
-- dispatches from commercial sales and branch transfers.
-- All columns nullable or default false for zero impact on existing data.
-- ============================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS is_donation BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS donation_program TEXT;

-- Index for fast queries filtering donations vs commercial sales
CREATE INDEX IF NOT EXISTS idx_transactions_is_donation
  ON transactions (is_donation);

-- Composite index for sales dashboard isolation
CREATE INDEX IF NOT EXISTS idx_transactions_sales_not_donation
  ON transactions (type, verified, is_donation)
  WHERE type = 'OUTBOUND';
