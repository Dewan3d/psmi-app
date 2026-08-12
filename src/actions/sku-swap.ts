'use server';

// ============================================================
// PSMI System — SKU Swap Server Actions
// ============================================================
// Handles single and bulk SKU corrections on inventory units
// with real serial numbers. All swaps are audit-logged.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { UnitStatus, SkuSwapResult } from '@/lib/types/database';

// Statuses that allow SKU swaps
const SWAPPABLE_STATUSES: UnitStatus[] = [
  'IN_WAREHOUSE',
  'IN_BRANCH',
  'RESERVED',
  'DAMAGED_REPAIR',
];

// Statuses that are blocked from SKU swaps
const BLOCKED_STATUSES: UnitStatus[] = [
  'PENDING_SERIAL',
  'IN_TRANSIT',
  'SOLD',
];

// ── Lookup a unit for swap ────────────────────────────────────
export async function lookupUnit(serial_number: string): Promise<{
  data: {
    serial_number: string;
    sku: string;
    model_name: string;
    model_group: string | null;
    status: UnitStatus;
    location_id: string;
    location_name: string;
    upload_date: string;
    can_swap: boolean;
    block_reason: string | null;
    swap_targets: { sku: string; model_name: string }[];
  } | null;
  error: string | null;
}> {
  const supabase = await createClient();

  const trimmed = serial_number.trim();
  if (!trimmed) {
    return { data: null, error: 'Serial number cannot be empty' };
  }

  // Fetch unit with product and location details
  const { data: unit, error: unitError } = await supabase
    .from('inventory_units')
    .select(`
      serial_number,
      sku,
      status,
      location_id,
      upload_date,
      locations(name),
      products(model_name, model_group)
    `)
    .eq('serial_number', trimmed)
    .single() as any;

  if (unitError || !unit) {
    return { data: null, error: `Serial number "${trimmed}" not found in inventory` };
  }

  const status = unit.status as UnitStatus;
  const modelGroup = unit.products?.model_group || null;
  const canSwap = SWAPPABLE_STATUSES.includes(status);

  let blockReason: string | null = null;
  if (!canSwap) {
    if (status === 'PENDING_SERIAL') {
      blockReason = 'Unit has a placeholder serial — SKU will be set during serial assignment';
    } else if (status === 'IN_TRANSIT') {
      blockReason = 'Unit is in transit — paperwork has already been generated';
    } else if (status === 'SOLD') {
      blockReason = 'Unit has been sold — transaction is finalized';
    }
  }

  // Fetch swap targets (other SKUs in the same model group)
  let swapTargets: { sku: string; model_name: string }[] = [];
  if (modelGroup) {
    const { data: targets } = await supabase
      .from('products')
      .select('sku, model_name')
      .eq('model_group', modelGroup)
      .neq('sku', unit.sku)
      .order('sku', { ascending: true });

    swapTargets = targets || [];
  }

  return {
    data: {
      serial_number: unit.serial_number,
      sku: unit.sku,
      model_name: unit.products?.model_name || 'Unknown',
      model_group: modelGroup,
      status,
      location_id: unit.location_id,
      location_name: unit.locations?.name || 'Unknown',
      upload_date: unit.upload_date,
      can_swap: canSwap,
      block_reason: blockReason,
      swap_targets: swapTargets,
    },
    error: null,
  };
}

// ── Swap a single unit's SKU ──────────────────────────────────
export async function swapUnitSku(data: {
  serial_number: string;
  new_sku: string;
  reason?: string;
}): Promise<{
  data: { old_sku: string; new_sku: string } | null;
  error: string | null;
}> {
  const supabase = await createClient();

  const trimmed = data.serial_number.trim();

  // Fetch current unit
  const { data: unit, error: fetchError } = await supabase
    .from('inventory_units')
    .select('serial_number, sku, status, location_id')
    .eq('serial_number', trimmed)
    .single();

  if (fetchError || !unit) {
    return { data: null, error: `Serial number "${trimmed}" not found` };
  }

  // Check status eligibility
  const status = unit.status as UnitStatus;
  if (BLOCKED_STATUSES.includes(status)) {
    return { data: null, error: `Cannot swap SKU for unit with status "${status}"` };
  }

  if (unit.sku === data.new_sku) {
    return { data: null, error: 'New SKU is the same as the current SKU' };
  }

  // Validate new SKU exists and belongs to the same model group
  const { data: newProduct } = await supabase
    .from('products')
    .select('sku, model_group')
    .eq('sku', data.new_sku)
    .single();

  if (!newProduct) {
    return { data: null, error: `SKU "${data.new_sku}" does not exist` };
  }

  const { data: currentProduct } = await supabase
    .from('products')
    .select('model_group')
    .eq('sku', unit.sku)
    .single();

  if (currentProduct?.model_group && newProduct.model_group !== currentProduct.model_group) {
    return {
      data: null,
      error: `Cannot swap across model groups: "${unit.sku}" is in "${currentProduct.model_group}" but "${data.new_sku}" is in "${newProduct.model_group || 'none'}"`,
    };
  }

  const oldSku = unit.sku;

  // Perform the swap
  const { error: updateError } = await supabase
    .from('inventory_units')
    .update({ sku: data.new_sku })
    .eq('serial_number', trimmed);

  if (updateError) {
    return { data: null, error: `Failed to update SKU: ${updateError.message}` };
  }

  // Log to audit_log
  await supabase.from('audit_log').insert({
    table_name: 'inventory_units',
    record_id: trimmed,
    action: 'UPDATE' as const,
    old_data: { sku: oldSku, reason: data.reason || null, action_type: 'SKU_SWAP' },
    new_data: { sku: data.new_sku, reason: data.reason || null, action_type: 'SKU_SWAP' },
  });

  return {
    data: { old_sku: oldSku, new_sku: data.new_sku },
    error: null,
  };
}

// ── Bulk swap SKU for multiple units ──────────────────────────
export async function bulkSwapSku(data: {
  serial_numbers: string[];
  from_sku: string;
  to_sku: string;
  reason?: string;
}): Promise<{
  swapped: number;
  skipped: { serial: string; reason: string }[];
  error: string | null;
}> {
  const supabase = await createClient();

  if (data.serial_numbers.length === 0) {
    return { swapped: 0, skipped: [], error: 'No serial numbers provided' };
  }

  if (data.from_sku === data.to_sku) {
    return { swapped: 0, skipped: [], error: 'From and To SKUs are the same' };
  }

  // Validate both SKUs exist and belong to the same model group
  const { data: fromProduct } = await supabase
    .from('products')
    .select('sku, model_group')
    .eq('sku', data.from_sku)
    .single();

  const { data: toProduct } = await supabase
    .from('products')
    .select('sku, model_group')
    .eq('sku', data.to_sku)
    .single();

  if (!fromProduct) {
    return { swapped: 0, skipped: [], error: `Source SKU "${data.from_sku}" does not exist` };
  }
  if (!toProduct) {
    return { swapped: 0, skipped: [], error: `Target SKU "${data.to_sku}" does not exist` };
  }

  if (fromProduct.model_group && toProduct.model_group !== fromProduct.model_group) {
    return {
      swapped: 0,
      skipped: [],
      error: `Cannot swap across model groups: "${data.from_sku}" is in "${fromProduct.model_group}" but "${data.to_sku}" is in "${toProduct.model_group || 'none'}"`,
    };
  }

  const trimmedSerials = data.serial_numbers.map((sn) => sn.trim()).filter(Boolean);

  // Fetch all units
  const { data: units, error: fetchError } = await supabase
    .from('inventory_units')
    .select('serial_number, sku, status')
    .in('serial_number', trimmedSerials);

  if (fetchError) {
    return { swapped: 0, skipped: [], error: fetchError.message };
  }

  const unitMap = new Map((units || []).map((u) => [u.serial_number, u]));

  const toSwap: string[] = [];
  const skipped: { serial: string; reason: string }[] = [];

  for (const sn of trimmedSerials) {
    const unit = unitMap.get(sn);
    if (!unit) {
      skipped.push({ serial: sn, reason: 'Not found in inventory' });
      continue;
    }
    if (unit.sku !== data.from_sku) {
      skipped.push({ serial: sn, reason: `Current SKU is "${unit.sku}", not "${data.from_sku}"` });
      continue;
    }
    if (BLOCKED_STATUSES.includes(unit.status as UnitStatus)) {
      skipped.push({ serial: sn, reason: `Status "${unit.status}" does not allow SKU swaps` });
      continue;
    }
    toSwap.push(sn);
  }

  if (toSwap.length === 0) {
    return { swapped: 0, skipped, error: null };
  }

  // Batch update
  const { error: updateError } = await supabase
    .from('inventory_units')
    .update({ sku: data.to_sku })
    .in('serial_number', toSwap);

  if (updateError) {
    return { swapped: 0, skipped, error: `Failed to update units: ${updateError.message}` };
  }

  // Audit log entries for each swapped unit
  const auditRows = toSwap.map((sn) => ({
    table_name: 'inventory_units',
    record_id: sn,
    action: 'UPDATE' as const,
    old_data: { sku: data.from_sku, reason: data.reason || null, action_type: 'SKU_SWAP_BULK' },
    new_data: { sku: data.to_sku, reason: data.reason || null, action_type: 'SKU_SWAP_BULK' },
  }));

  await supabase.from('audit_log').insert(auditRows);

  return { swapped: toSwap.length, skipped, error: null };
}

// ── Get swap history from audit log ───────────────────────────
export async function getSwapHistory(filters?: {
  sku?: string;
  limit?: number;
}): Promise<{
  data: SkuSwapResult[];
  error: string | null;
}> {
  const supabase = await createClient();

  let query = supabase
    .from('audit_log')
    .select('record_id, old_data, new_data, user_id, created_at')
    .eq('table_name', 'inventory_units')
    .eq('action', 'UPDATE')
    .or('old_data->>action_type.eq.SKU_SWAP,old_data->>action_type.eq.SKU_SWAP_BULK')
    .order('created_at', { ascending: false })
    .limit(filters?.limit || 100);

  const { data, error } = await query;

  if (error) {
    return { data: [], error: error.message };
  }

  const results: SkuSwapResult[] = (data || [])
    .filter((entry: any) => {
      if (!filters?.sku) return true;
      const oldSku = entry.old_data?.sku;
      const newSku = entry.new_data?.sku;
      return oldSku === filters.sku || newSku === filters.sku;
    })
    .map((entry: any) => ({
      serial_number: entry.record_id,
      old_sku: entry.old_data?.sku || 'Unknown',
      new_sku: entry.new_data?.sku || 'Unknown',
      swapped_at: entry.created_at,
      reason: entry.old_data?.reason || undefined,
    }));

  return { data: results, error: null };
}
