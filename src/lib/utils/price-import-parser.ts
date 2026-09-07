// ============================================================
// PSMI System — Price Import Parser
// ============================================================
// Client-side Excel/CSV parser for bulk price imports.
// Uses SheetJS (xlsx) to handle .xlsx, .xls, and .csv files.
// ============================================================

import * as XLSX from 'xlsx';

export interface PriceImportRow {
  sku: string;
  cost_price?: number;
  retail_price?: number;
  row_number: number;
}

export interface PriceImportError {
  row_number: number;
  message: string;
}

export interface PriceImportResult {
  rows: PriceImportRow[];
  errors: PriceImportError[];
  detected_columns: {
    sku: string | null;
    cost: string | null;
    retail: string | null;
  };
  total_rows: number;
}

// Known header aliases for auto-detection
const SKU_ALIASES = ['sku', 'sku_code', 'product_code', 'item_code', 'sku code', 'product code', 'item code', 'code'];
const COST_ALIASES = ['cost_price', 'cost', 'purchase_price', 'buying_price', 'landed_cost', 'cost price', 'purchase price', 'buying price', 'landed cost', 'buy price', 'buy_price'];
const RETAIL_ALIASES = ['retail_price', 'selling_price', 'price', 'sale_price', 'rrp', 'retail price', 'selling price', 'sale price', 'sell price', 'sell_price', 'unit price', 'unit_price'];

function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseNumericValue(value: any): number | undefined {
  if (value == null || value === '') return undefined;

  // If it's already a number
  if (typeof value === 'number') return isNaN(value) ? undefined : value;

  // Clean string: remove currency symbols, commas, spaces
  const cleaned = String(value).replace(/[₦$€£,\s]/g, '').trim();
  if (!cleaned) return undefined;

  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/**
 * Parse an Excel or CSV file into structured price import rows.
 * Auto-detects SKU, cost price, and retail price columns from headers.
 */
export async function parsePriceFile(file: File): Promise<PriceImportResult> {
  const errors: PriceImportError[] = [];

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Use the first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        rows: [],
        errors: [{ row_number: 0, message: 'No worksheets found in file' }],
        detected_columns: { sku: null, cost: null, retail: null },
        total_rows: 0,
      };
    }

    const sheet = workbook.Sheets[sheetName];
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rawData.length < 2) {
      return {
        rows: [],
        errors: [{ row_number: 0, message: 'File must have a header row and at least one data row' }],
        detected_columns: { sku: null, cost: null, retail: null },
        total_rows: 0,
      };
    }

    // Extract headers from first row
    const headers = rawData[0].map((h: any) => String(h));

    // Auto-detect columns
    const skuIdx = findColumnIndex(headers, SKU_ALIASES);
    const costIdx = findColumnIndex(headers, COST_ALIASES);
    const retailIdx = findColumnIndex(headers, RETAIL_ALIASES);

    if (skuIdx === -1) {
      return {
        rows: [],
        errors: [{
          row_number: 1,
          message: `Could not find a SKU column. Expected one of: ${SKU_ALIASES.join(', ')}. Found headers: ${headers.join(', ')}`,
        }],
        detected_columns: { sku: null, cost: null, retail: null },
        total_rows: rawData.length - 1,
      };
    }

    if (costIdx === -1 && retailIdx === -1) {
      return {
        rows: [],
        errors: [{
          row_number: 1,
          message: `Could not find any price columns. Expected cost: ${COST_ALIASES.slice(0, 4).join(', ')} or retail: ${RETAIL_ALIASES.slice(0, 4).join(', ')}. Found headers: ${headers.join(', ')}`,
        }],
        detected_columns: { sku: headers[skuIdx], cost: null, retail: null },
        total_rows: rawData.length - 1,
      };
    }

    const detected_columns = {
      sku: headers[skuIdx],
      cost: costIdx !== -1 ? headers[costIdx] : null,
      retail: retailIdx !== -1 ? headers[retailIdx] : null,
    };

    // Parse data rows
    const rows: PriceImportRow[] = [];
    const dataRows = rawData.slice(1);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // 1-indexed, +1 for header

      const skuValue = String(row[skuIdx] || '').trim().toUpperCase();

      if (!skuValue) {
        // Skip empty rows silently
        continue;
      }

      const costPrice = costIdx !== -1 ? parseNumericValue(row[costIdx]) : undefined;
      const retailPrice = retailIdx !== -1 ? parseNumericValue(row[retailIdx]) : undefined;

      // Validate that at least one price is present
      if (costPrice === undefined && retailPrice === undefined) {
        errors.push({
          row_number: rowNum,
          message: `SKU "${skuValue}" has no valid price values`,
        });
        continue;
      }

      // Validate prices are positive
      if (costPrice !== undefined && costPrice < 0) {
        errors.push({ row_number: rowNum, message: `SKU "${skuValue}" has negative cost price` });
        continue;
      }
      if (retailPrice !== undefined && retailPrice < 0) {
        errors.push({ row_number: rowNum, message: `SKU "${skuValue}" has negative retail price` });
        continue;
      }

      rows.push({
        sku: skuValue,
        cost_price: costPrice,
        retail_price: retailPrice,
        row_number: rowNum,
      });
    }

    return { rows, errors, detected_columns, total_rows: dataRows.length };
  } catch (err) {
    return {
      rows: [],
      errors: [{ row_number: 0, message: `Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}` }],
      detected_columns: { sku: null, cost: null, retail: null },
      total_rows: 0,
    };
  }
}
