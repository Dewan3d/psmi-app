'use server';

// ============================================================
// PSMI System — Inventory Server Actions
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { InventoryUnit, StockSummary, UnitStatus } from '@/lib/types/database';

export async function addUnit(data: {
  serial_number: string;
  sku: string;
  location_id: string;
}): Promise<{ data: InventoryUnit | null; error: string | null }> {
  const supabase = await createClient();

  const { data: unit, error } = await supabase
    .from('inventory_units')
    .insert({
      serial_number: data.serial_number.trim(),
      sku: data.sku.trim(),
      location_id: data.location_id,
      status: 'IN_WAREHOUSE',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        data: null,
        error: `Serial number "${data.serial_number}" already exists in inventory`,
      };
    }
    if (error.code === '23503') {
      return {
        data: null,
        error: `Invalid SKU or location ID provided`,
      };
    }
    return { data: null, error: error.message };
  }

  return { data: unit, error: null };
}

export async function addUnitsBulk(data: {
  serial_numbers: string[];
  sku: string;
  location_id: string;
}): Promise<{
  inserted: number;
  errors: { serial_number: string; error: string }[];
}> {
  const supabase = await createClient();

  const rows = data.serial_numbers.map((sn) => ({
    serial_number: sn.trim(),
    sku: data.sku.trim(),
    location_id: data.location_id,
    status: 'IN_WAREHOUSE' as UnitStatus,
  }));

  // Check for existing serial numbers first
  const { data: existing } = await supabase
    .from('inventory_units')
    .select('serial_number')
    .in(
      'serial_number',
      rows.map((r) => r.serial_number)
    );

  const existingSet = new Set((existing || []).map((e) => e.serial_number));
  const newRows = rows.filter((r) => !existingSet.has(r.serial_number));
  const duplicateErrors = rows
    .filter((r) => existingSet.has(r.serial_number))
    .map((r) => ({
      serial_number: r.serial_number,
      error: 'Already exists in inventory',
    }));

  if (newRows.length === 0) {
    return { inserted: 0, errors: duplicateErrors };
  }

  const { error } = await supabase.from('inventory_units').insert(newRows);

  if (error) {
    return {
      inserted: 0,
      errors: [
        ...duplicateErrors,
        { serial_number: 'BATCH', error: error.message },
      ],
    };
  }

  return { inserted: newRows.length, errors: duplicateErrors };
}

export async function getUnitsBySku(
  sku: string,
  filters?: {
    status?: UnitStatus;
    location_id?: string;
  }
): Promise<{ data: InventoryUnit[]; error: string | null }> {
  const supabase = await createClient();

  let query = supabase
    .from('inventory_units')
    .select('*')
    .eq('sku', sku)
    .neq('status', 'SOLD')
    .order('upload_date', { ascending: true });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.location_id) {
    query = query.eq('location_id', filters.location_id);
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

export async function getUnitsByLocation(
  locationId: string,
  filters?: {
    status?: UnitStatus;
    sku?: string;
  }
): Promise<{ data: InventoryUnit[]; error: string | null }> {
  const supabase = await createClient();

  let query = supabase
    .from('inventory_units')
    .select('*')
    .eq('location_id', locationId)
    .order('upload_date', { ascending: true });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.sku) {
    query = query.eq('sku', filters.sku);
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

export async function getStockSummary(): Promise<{
  data: StockSummary[];
  error: string | null;
}> {
  const supabase = await createClient();

  // Get all products
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('sku, model_name, category_badge');

  if (productsError) {
    return { data: [], error: productsError.message };
  }

  // Get aggregated inventory counts grouped by SKU and status (excluding SOLD)
  const { data: summaryRows, error: summaryError } = await supabase
    .from('inventory_stock_summary')
    .select('sku, status, count')
    .neq('status', 'SOLD');

  if (summaryError) {
    return { data: [], error: summaryError.message };
  }

  // Aggregate counts
  const summaryMap = new Map<string, StockSummary>();

  for (const product of products || []) {
    summaryMap.set(product.sku, {
      sku: product.sku,
      model_name: product.model_name,
      category_badge: product.category_badge || 'POWER_STATION',
      total: 0,
      in_warehouse: 0,
      reserved: 0,
      in_transit: 0,
      in_branch: 0,
      sold: 0,
      damaged_repair: 0,
      pending_serial: 0,
    });
  }

  for (const row of summaryRows || []) {
    const summary = summaryMap.get(row.sku);
    if (!summary) continue;

    const count = row.count || 0;
    summary.total += count;
    switch (row.status) {
      case 'IN_WAREHOUSE':
        summary.in_warehouse += count;
        break;
      case 'RESERVED':
        summary.reserved += count;
        break;
      case 'IN_TRANSIT':
        summary.in_transit += count;
        break;
      case 'IN_BRANCH':
        summary.in_branch += count;
        break;
      case 'SOLD':
        summary.sold += count;
        break;
      case 'DAMAGED_REPAIR':
        summary.damaged_repair += count;
        break;
      case 'PENDING_SERIAL':
        summary.pending_serial += count;
        break;
    }
  }

  return { data: Array.from(summaryMap.values()), error: null };
}

export async function getFifoQueue(
  sku: string,
  locationId: string
): Promise<{ data: InventoryUnit[]; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('inventory_units')
    .select('*')
    .eq('sku', sku)
    .eq('location_id', locationId)
    .in('status', ['IN_WAREHOUSE', 'IN_BRANCH'])
    .order('upload_date', { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}
