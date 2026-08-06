// ============================================================
// PSMI System — CSV Parser Utility
// ============================================================
// Parses and validates CSV/Excel uploads for bulk inventory inbound.
// ============================================================

export interface ParsedRow {
  serial_number: string;
  sku?: string;
  row_number: number;
}

export interface ParseResult {
  valid_rows: ParsedRow[];
  errors: ParseError[];
  duplicate_serials: string[];
  total_rows: number;
}

export interface ParseError {
  row_number: number;
  message: string;
  raw_value: string;
}

/**
 * Parse a CSV string into structured rows.
 * Expected format: one serial number per line, or CSV with headers.
 *
 * Supported formats:
 * 1. Simple list (one serial per line)
 * 2. CSV with "serial_number" column header
 * 3. CSV with "serial_number,sku" column headers
 */
export function parseCSV(csvContent: string): ParseResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      valid_rows: [],
      errors: [{ row_number: 0, message: 'File is empty', raw_value: '' }],
      duplicate_serials: [],
      total_rows: 0,
    };
  }

  // Detect if first line is a header
  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes('serial') ||
    firstLine.includes('sku') ||
    firstLine.includes('number');

  const dataLines = hasHeader ? lines.slice(1) : lines;

  // Detect columns from header
  let serialIndex = 0;
  let skuIndex = -1;

  if (hasHeader) {
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    serialIndex = headers.findIndex(
      (h) => h.includes('serial') || h === 'serial_number' || h === 'sn'
    );
    skuIndex = headers.findIndex(
      (h) => h === 'sku' || h.includes('sku')
    );

    if (serialIndex === -1) serialIndex = 0; // Default to first column
  }

  const valid_rows: ParsedRow[] = [];
  const errors: ParseError[] = [];
  const seen_serials = new Set<string>();
  const duplicate_serials: string[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const rowNumber = hasHeader ? i + 2 : i + 1; // 1-indexed, accounting for header

    // Split by comma (basic CSV — doesn't handle quoted fields)
    const columns = line.split(',').map((col) => col.trim());

    const serialNumber = columns[serialIndex] || '';
    const sku = skuIndex >= 0 ? columns[skuIndex] : undefined;

    // Validate serial number
    if (!serialNumber) {
      errors.push({
        row_number: rowNumber,
        message: 'Missing serial number',
        raw_value: line,
      });
      continue;
    }

    if (serialNumber.length < 5) {
      errors.push({
        row_number: rowNumber,
        message: `Serial number too short (${serialNumber.length} chars, minimum 5)`,
        raw_value: serialNumber,
      });
      continue;
    }

    // Check for duplicates within this file
    if (seen_serials.has(serialNumber.toUpperCase())) {
      duplicate_serials.push(serialNumber);
      errors.push({
        row_number: rowNumber,
        message: `Duplicate serial number in file: ${serialNumber}`,
        raw_value: serialNumber,
      });
      continue;
    }

    seen_serials.add(serialNumber.toUpperCase());

    valid_rows.push({
      serial_number: serialNumber,
      sku: sku || undefined,
      row_number: rowNumber,
    });
  }

  return {
    valid_rows,
    errors,
    duplicate_serials,
    total_rows: dataLines.length,
  };
}

/**
 * Read a File object as text and parse it as CSV
 */
export async function parseCSVFile(file: File): Promise<ParseResult> {
  const text = await file.text();
  return parseCSV(text);
}

/**
 * Validate parsed serial numbers against existing database records.
 * Returns the serial numbers that already exist.
 */
export function findExistingSerials(
  parsedSerials: string[],
  existingSerials: string[]
): string[] {
  const existingSet = new Set(existingSerials.map((s) => s.toUpperCase()));
  return parsedSerials.filter((s) => existingSet.has(s.toUpperCase()));
}

/**
 * Generate a sample CSV template string
 */
export function generateCSVTemplate(includeSkuColumn: boolean = false): string {
  if (includeSkuColumn) {
    return [
      'serial_number,sku',
      'ABC123456789012,PS-2000-BLK',
      'DEF987654321098,PS-2000-BLK',
      'GHI567890123456,PS-3000-WHT',
    ].join('\n');
  }

  return [
    'serial_number',
    'ABC123456789012',
    'DEF987654321098',
    'GHI567890123456',
  ].join('\n');
}
