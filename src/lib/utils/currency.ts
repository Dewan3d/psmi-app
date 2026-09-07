// ============================================================
// PSMI System — Currency Formatting Utility
// ============================================================
// Nigerian Naira (₦) formatting, VAT-inclusive.
// ============================================================

/**
 * Format a number as Nigerian Naira (₦).
 * Returns '—' for null/undefined values.
 */
export function formatNaira(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return '₦' + amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a number as compact Naira (e.g. ₦1.2M, ₦350K).
 * Useful for KPI cards and dashboard summaries.
 */
export function formatNairaCompact(amount: number | null | undefined): string {
  if (amount == null) return '—';
  if (amount >= 1_000_000_000) return '₦' + (amount / 1_000_000_000).toFixed(1) + 'B';
  if (amount >= 1_000_000) return '₦' + (amount / 1_000_000).toFixed(1) + 'M';
  if (amount >= 1_000) return '₦' + (amount / 1_000).toFixed(1) + 'K';
  return formatNaira(amount);
}

/**
 * Parse a Naira string back to a number.
 * Handles inputs like "₦125,000.00", "125000", "125,000".
 */
export function parseNairaInput(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
