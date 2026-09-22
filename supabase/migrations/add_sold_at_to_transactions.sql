-- ============================================================
-- Migration: Add sold_at to transactions table
-- ============================================================
-- Allows recording and backdating the actual date a sale or
-- outbound dispatch occurred, separate from system created_at.
-- ============================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS sold_at timestamptz DEFAULT now();

-- Initialize existing transactions' sold_at with their created_at
UPDATE transactions
  SET sold_at = created_at
  WHERE sold_at IS NULL;

-- Index for sales reporting and date range filtering
CREATE INDEX IF NOT EXISTS idx_transactions_sold_at
  ON transactions (sold_at);
