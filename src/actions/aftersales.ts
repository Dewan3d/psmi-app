'use server';

// ============================================================
// PSMI System — Aftersales Replacement Server Actions
// ============================================================
// Manages unit replacements for customers who previously bought
// power stations. Supports both linking to an existing outbound
// sale or manual entry for pre-system sales.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  AftersalesReplacement,
  AftersalesReplacementItem,
  AftersalesReplacementWithDetails,
} from '@/lib/types/database';

export interface CreateReplacementInput {
  linked_transaction_id?: string | null;
  customer_name: string;
  reason: string;
  notes?: string | null;
  user_id: string;
  items: {
    original_serial: string;
    replacement_serial?: string | null;
    sku: string;
  }[];
}

// ── 1. Create Aftersales Replacement ─────────────────────────
export async function createAftersalesReplacement(
  input: CreateReplacementInput
): Promise<{ data: AftersalesReplacement | null; error: string | null }> {
  const supabase = await createClient();

  if (!input.customer_name?.trim()) {
    return { data: null, error: 'Customer name is required' };
  }
  if (!input.reason?.trim()) {
    return { data: null, error: 'Reason for replacement is required' };
  }
  if (!input.items || input.items.length === 0) {
    return { data: null, error: 'At least one item must be added for replacement' };
  }

  // Validate replacement serials (if provided, must be in stock)
  const replacementSerials = input.items
    .map((i) => i.replacement_serial?.trim())
    .filter((s): s is string => !!s);

  if (replacementSerials.length > 0) {
    const { data: availableUnits, error: unitCheckError } = await supabase
      .from('inventory_units')
      .select('serial_number, status')
      .in('serial_number', replacementSerials);

    if (unitCheckError) {
      return { data: null, error: `Failed to check replacement units: ${unitCheckError.message}` };
    }

    const availableMap = new Map((availableUnits || []).map((u) => [u.serial_number, u.status]));

    for (const sn of replacementSerials) {
      const status = availableMap.get(sn);
      if (!status) {
        return { data: null, error: `Replacement serial ${sn} was not found in inventory.` };
      }
      if (status !== 'IN_WAREHOUSE' && status !== 'IN_BRANCH') {
        return {
          data: null,
          error: `Replacement unit ${sn} cannot be issued. Current status is ${status}. Must be IN_WAREHOUSE or IN_BRANCH.`,
        };
      }
    }
  }

  // 1. Insert replacement record
  const { data: replacement, error: repError } = await supabase
    .from('aftersales_replacements')
    .insert({
      linked_transaction_id: input.linked_transaction_id || null,
      customer_name: input.customer_name.trim(),
      reason: input.reason.trim(),
      notes: input.notes?.trim() || null,
      handled_by: input.user_id,
    })
    .select()
    .single();

  if (repError || !replacement) {
    return { data: null, error: repError?.message || 'Failed to record aftersales replacement' };
  }

  // 2. Insert replacement items
  const itemRows = input.items.map((i) => ({
    replacement_id: replacement.id,
    original_serial: i.original_serial.trim(),
    replacement_serial: i.replacement_serial?.trim() || null,
    sku: i.sku.trim(),
  }));

  const { error: itemsError } = await supabase
    .from('aftersales_replacement_items')
    .insert(itemRows);

  if (itemsError) {
    console.error('Failed to create aftersales replacement items:', itemsError.message);
  }

  // 3. Mark replacement units as SOLD (taken out of stock)
  if (replacementSerials.length > 0) {
    const { error: updateRepError } = await supabase
      .from('inventory_units')
      .update({ status: 'SOLD' })
      .in('serial_number', replacementSerials);

    if (updateRepError) {
      console.error('Failed to update replacement unit status:', updateRepError.message);
    }
  }

  // 4. If original serials exist in our system, mark them as DAMAGED_REPAIR
  const originalSerials = input.items.map((i) => i.original_serial.trim());
  if (originalSerials.length > 0) {
    await supabase
      .from('inventory_units')
      .update({ status: 'DAMAGED_REPAIR' })
      .in('serial_number', originalSerials);
  }

  revalidatePath('/aftersales');
  revalidatePath('/stock');
  revalidatePath('/outbound');
  revalidatePath('/sales');

  return { data: replacement, error: null };
}

// ── 2. Get Aftersales Replacements List ───────────────────────
export async function getAftersalesReplacements(filters?: {
  search?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  data: AftersalesReplacementWithDetails[];
  total: number;
  error: string | null;
}> {
  const supabase = await createClient();

  let query = supabase
    .from('aftersales_replacements')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters?.from_date) query = query.gte('created_at', filters.from_date);
  if (filters?.to_date) query = query.lte('created_at', filters.to_date);
  if (filters?.search) {
    query = query.or(`customer_name.ilike.%${filters.search}%,reason.ilike.%${filters.search}%`);
  }

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data: replacements, count, error } = await query;

  if (error) {
    return { data: [], total: 0, error: error.message };
  }

  if (!replacements || replacements.length === 0) {
    return { data: [], total: count || 0, error: null };
  }

  const repIds = replacements.map((r) => r.id);
  const handlerIds = [...new Set(replacements.map((r) => r.handled_by))];
  const linkedTxnIds = [
    ...new Set(
      replacements
        .map((r) => r.linked_transaction_id)
        .filter((id): id is string => !!id)
    ),
  ];

  // Fetch handlers, linked transactions, items and products concurrently
  const [
    { data: profiles },
    { data: linkedTxns },
    { data: items },
  ] = await Promise.all([
    supabase.from('profiles').select('*').in('id', handlerIds),
    linkedTxnIds.length > 0
      ? supabase.from('transactions').select('*').in('id', linkedTxnIds)
      : Promise.resolve({ data: [] }),
    supabase.from('aftersales_replacement_items').select('*').in('replacement_id', repIds),
  ]);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
  const txnMap = new Map((linkedTxns || []).map((t) => [t.id, t]));

  // Get unique SKUs from items to fetch products
  const skus = [...new Set((items || []).map((i) => i.sku))];
  let productMap = new Map<string, any>();
  if (skus.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .in('sku', skus);
    productMap = new Map((products || []).map((p) => [p.sku, p]));
  }

  // Group items by replacement_id
  const itemsByRep = new Map<string, any[]>();
  for (const item of items || []) {
    const arr = itemsByRep.get(item.replacement_id) || [];
    arr.push({
      ...item,
      product: productMap.get(item.sku) || null,
    });
    itemsByRep.set(item.replacement_id, arr);
  }

  const result: AftersalesReplacementWithDetails[] = replacements.map((r) => ({
    ...r,
    profiles: profileMap.get(r.handled_by),
    linked_transaction: r.linked_transaction_id ? txnMap.get(r.linked_transaction_id) || null : null,
    items: itemsByRep.get(r.id) || [],
  }));

  return { data: result, total: count || 0, error: null };
}

// ── 3. Search Outbound Orders (for linking) ───────────────────
export async function searchOutboundOrdersForReplacement(query: string): Promise<{
  data: {
    transaction_id: string;
    tracking_number: string | null;
    customer_name: string | null;
    sales_manager: string | null;
    route: string | null;
    created_at: string;
    items: {
      serial_number: string;
      sku: string;
      model_name: string;
    }[];
  }[];
  error: string | null;
}> {
  const supabase = await createClient();
  const trimmed = query.trim();

  if (!trimmed) {
    return { data: [], error: null };
  }

  // 1. Search by customer_name or tracking_number on transactions
  const { data: txnsByText } = await supabase
    .from('transactions')
    .select('id, tracking_number, customer_name, sales_manager, route, created_at')
    .eq('type', 'OUTBOUND')
    .or(`customer_name.ilike.%${trimmed}%,tracking_number.ilike.%${trimmed}%,sales_manager.ilike.%${trimmed}%`)
    .limit(10);

  // 2. Search by serial_number in transaction_items
  const { data: itemsBySerial } = await supabase
    .from('transaction_items')
    .select('transaction_id')
    .ilike('serial_number', `%${trimmed}%`)
    .limit(10);

  const matchedTxnIds = new Set<string>();
  (txnsByText || []).forEach((t) => matchedTxnIds.add(t.id));
  (itemsBySerial || []).forEach((i) => matchedTxnIds.add(i.transaction_id));

  if (matchedTxnIds.size === 0) {
    return { data: [], error: null };
  }

  const idList = Array.from(matchedTxnIds);

  // Fetch full transaction records
  const { data: transactions, error: txnError } = await supabase
    .from('transactions')
    .select('id, tracking_number, customer_name, sales_manager, route, created_at')
    .in('id', idList)
    .order('created_at', { ascending: false });

  if (txnError || !transactions) {
    return { data: [], error: txnError?.message || 'Failed to search transactions' };
  }

  // Fetch items for these transactions
  const { data: items } = await supabase
    .from('transaction_items')
    .select('transaction_id, serial_number')
    .in('transaction_id', idList);

  const serials = (items || []).map((i) => i.serial_number);
  const { data: units } = await supabase
    .from('inventory_units')
    .select('serial_number, sku')
    .in('serial_number', serials);

  const unitMap = new Map((units || []).map((u) => [u.serial_number, u.sku]));
  const skus = [...new Set(Array.from(unitMap.values()))];

  const { data: products } = await supabase
    .from('products')
    .select('sku, model_name')
    .in('sku', skus);

  const productMap = new Map((products || []).map((p) => [p.sku, p.model_name]));

  const itemsByTxn = new Map<string, any[]>();
  for (const item of items || []) {
    const sku = unitMap.get(item.serial_number) || 'UNKNOWN';
    const modelName = productMap.get(sku) || sku;
    const arr = itemsByTxn.get(item.transaction_id) || [];
    arr.push({
      serial_number: item.serial_number,
      sku,
      model_name: modelName,
    });
    itemsByTxn.set(item.transaction_id, arr);
  }

  const results = transactions.map((t) => ({
    transaction_id: t.id,
    tracking_number: t.tracking_number,
    customer_name: t.customer_name,
    sales_manager: t.sales_manager,
    route: t.route,
    created_at: t.created_at,
    items: itemsByTxn.get(t.id) || [],
  }));

  return { data: results, error: null };
}

// ── 4. Summary Statistics for Aftersales ──────────────────────
export async function getAftersalesStats(): Promise<{
  data: {
    totalReplacements: number;
    replacementsThisMonth: number;
    unitsReplaced: number;
  };
  error: string | null;
}> {
  const supabase = await createClient();

  // Total replacements
  const { count: totalReplacements, error: totalErr } = await supabase
    .from('aftersales_replacements')
    .select('*', { count: 'exact', head: true });

  if (totalErr) {
    return {
      data: { totalReplacements: 0, replacementsThisMonth: 0, unitsReplaced: 0 },
      error: totalErr.message,
    };
  }

  // Replacements this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: thisMonth, error: monthErr } = await supabase
    .from('aftersales_replacements')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth.toISOString());

  // Total replacement items
  const { count: totalItems, error: itemsErr } = await supabase
    .from('aftersales_replacement_items')
    .select('*', { count: 'exact', head: true });

  return {
    data: {
      totalReplacements: totalReplacements || 0,
      replacementsThisMonth: thisMonth || 0,
      unitsReplaced: totalItems || 0,
    },
    error: monthErr?.message || itemsErr?.message || null,
  };
}
