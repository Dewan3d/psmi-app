-- ============================================================
-- PSMI System — Add Installments & Payment Tracking to Sales
-- ============================================================
-- Adds support for terms/installments sales:
-- 1. amount_paid: Total cash/transfer amount received so far
-- 2. payment_status: 'PAID' | 'PARTIAL' | 'PENDING'
-- 3. total_order_amount: Total agreed deal price (if different from sum of released items)
-- 4. total_units_ordered: Total units agreed in deal (e.g. 10 ordered, only 3 released so far)
-- ============================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS total_order_amount NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_units_ordered INTEGER DEFAULT NULL;

-- Optional constraint to validate payment_status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_payment_status_check'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_payment_status_check
      CHECK (payment_status IN ('PAID', 'PARTIAL', 'PENDING'));
  END IF;
END $$;
