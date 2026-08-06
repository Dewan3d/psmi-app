// ============================================================
// PSMI System — Tracking Number Utility
// ============================================================

/**
 * Generate a random tracking number in the format PSMI-XXXXXXXXXXXX
 * (12 random alphanumeric characters, uppercase).
 *
 * Note: The database trigger also generates tracking numbers.
 * This utility is for client-side preview/display purposes.
 */
export function generateTrackingNumber(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'PSMI-';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Validate that a string is a valid PSMI tracking number format
 */
export function isValidTrackingNumber(value: string): boolean {
  return /^PSMI-[A-Z0-9]{12}$/.test(value);
}

/**
 * Format a tracking number for display (with dashes for readability)
 * PSMI-ABCD1234EFGH → PSMI-ABCD-1234-EFGH
 */
export function formatTrackingNumber(trackingNumber: string): string {
  if (!isValidTrackingNumber(trackingNumber)) return trackingNumber;

  const code = trackingNumber.slice(5); // Remove 'PSMI-'
  return `PSMI-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
}
