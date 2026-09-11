'use server';

// ============================================================
// PSMI System — Inbound Transaction Server Actions
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Transaction } from '@/lib/types/database';

// ── Helper: generate placeholder serial numbers ───────────────
function generatePlaceholderSerial(sku: string, index: number): string {
  const padded = String(index).padStart(6, '0');
  return `PENDING-${sku.toUpperCase()}-${Date.now()}-${padded}`;
}

// ── Create inbound with direct serial numbers ─────────────────
export async function createInboundTransaction(data: {
  location_id: string;
  serial_numbers: string[];
  sku: string;
  user_id: string;
  notes?: string;
  purchase_price?: number;
}): Promise<{ data: Transaction | null; error: string | null }> {
  const supabase = await createClient();

  if (data.serial_numbers.length === 0) {
    return { data: null, error: 'No serial numbers provided' };
  }

  // Validate SKU exists
  const { data: product } = await supabase
    .from('products')
    .select('sku')
    .eq('sku', data.sku)
    .single();

  if (!product) {
    return { data: null, error: `SKU "${data.sku}" does not exist` };
  }

  // Check for existing serial numbers
  const { data: existing } = await supabase
    .from('inventory_units')
    .select('serial_number')
    .in('serial_number', data.serial_numbers);

  if (existing && existing.length > 0) {
    const dupes = existing.map((e) => e.serial_number).join(', ');
    return {
      data: null,
      error: `Serial numbers already in inventory: ${dupes}`,
    };
  }

  // 1. Create the transaction record
  const { data: transaction, error: txnError } = await supabase
    .from('transactions')
    .insert({
      type: 'INBOUND',
      to_location_id: data.location_id,
      user_id: data.user_id,
      notes: data.notes || null,
    })
    .select()
    .single();

  if (txnError) {
    return { data: null, error: `Failed to create transaction: ${txnError.message}` };
  }

  // 2. Insert inventory units
  const unitRows = data.serial_numbers.map((sn) => ({
    serial_number: sn.trim(),
    sku: data.sku,
    location_id: data.location_id,
    status: 'IN_WAREHOUSE' as const,
    purchase_price: data.purchase_price ?? null,
  }));

  const { error: unitsError } = await supabase
    .from('inventory_units')
    .insert(unitRows);

  if (unitsError) {
    await supabase.from('transactions').delete().eq('id', transaction.id);
    return {
      data: null,
      error: `Failed to insert inventory units: ${unitsError.message}`,
    };
  }

  // 3. Create transaction items linking serials to the transaction
  const itemRows = data.serial_numbers.map((sn) => ({
    transaction_id: transaction.id,
    serial_number: sn.trim(),
    purchase_price: data.purchase_price ?? null,
  }));

  const { error: itemsError } = await supabase
    .from('transaction_items')
    .insert(itemRows);

  if (itemsError) {
    console.error('Failed to create transaction items:', itemsError.message);
  }

  return { data: transaction, error: null };
}

// ── Create inbound by quantity (stock-first, serials-later) ───
// Creates N placeholder units with PENDING_SERIAL status for serialized SKUs,
// or directly puts them in stock (IN_WAREHOUSE / IN_BRANCH) for non-serialized SKUs.
export async function createInboundByQuantity(data: {
  location_id: string;
  sku: string;
  quantity: number;
  user_id: string;
  notes?: string;
  purchase_price?: number;
}): Promise<{ data: Transaction | null; pending_count: number; error: string | null }> {
  let supabase: any;
  try {
    supabase = createAdminClient();
  } catch {
    supabase = await createClient();
  }

  if (data.quantity <= 0) {
    return { data: null, pending_count: 0, error: 'Quantity must be greater than zero' };
  }
  if (data.quantity > 100000) {
    return { data: null, pending_count: 0, error: 'Maximum batch size is 100,000 units' };
  }

  // 1. Get product info
  const { data: product, error: prodError } = await supabase
    .from('products')
    .select('sku, is_serialized')
    .eq('sku', data.sku)
    .single();

  if (prodError || !product) {
    return { data: null, pending_count: 0, error: `SKU "${data.sku}" does not exist` };
  }

  // 2. Get location info
  const { data: loc, error: locError } = await supabase
    .from('locations')
    .select('type')
    .eq('id', data.location_id)
    .single();

  if (locError || !loc) {
    return { data: null, pending_count: 0, error: 'Location ID does not exist' };
  }

  const isSerialized = product.is_serialized !== false;
  const initialStatus = isSerialized
    ? 'PENDING_SERIAL'
    : loc.type === 'BRANCH'
    ? 'IN_BRANCH'
    : 'IN_WAREHOUSE';

  // 3. Formulate notes
  const notesPrefix = `[${isSerialized ? 'QUANTITY' : 'NON-SERIALIZED'} UPLOAD - ${data.quantity.toLocaleString()} units]`;
  const finalNotes = data.notes
    ? `${notesPrefix} ${data.notes}`
    : isSerialized
    ? `${notesPrefix} Serial numbers to be assigned.`
    : `${notesPrefix} Non-serialized inventory.`;

  // 4. Create transaction
  const { data: transaction, error: txnError } = await supabase
    .from('transactions')
    .insert({
      type: 'INBOUND',
      to_location_id: data.location_id,
      user_id: data.user_id,
      notes: finalNotes,
    })
    .select()
    .single();

  if (txnError || !transaction) {
    return { data: null, pending_count: 0, error: `Failed to create transaction: ${txnError?.message}` };
  }

  // 5. Generate unique pseudo-serials with 6-digit zero padding (supports up to 999,999 units without collision)
  const timestamp = Date.now();
  const skuUpper = data.sku.toUpperCase();
  const prefix = isSerialized ? `PENDING-${skuUpper}-${timestamp}` : `NS-${skuUpper}-${timestamp}`;
  const serialNumbers: string[] = [];
  for (let i = 1; i <= data.quantity; i++) {
    serialNumbers.push(`${prefix}-${String(i).padStart(6, '0')}`);
  }

  // 6. Batch insert in chunks of 1,000
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < serialNumbers.length; i += CHUNK_SIZE) {
    const chunkSerials = serialNumbers.slice(i, i + CHUNK_SIZE);

    const unitRows = chunkSerials.map((sn) => ({
      serial_number: sn,
      sku: data.sku,
      location_id: data.location_id,
      status: initialStatus,
      purchase_price: data.purchase_price ?? null,
    }));

    const { error: unitsError } = await supabase.from('inventory_units').insert(unitRows);
    if (unitsError) {
      if (i === 0) {
        await supabase.from('transactions').delete().eq('id', transaction.id);
      }
      return { data: null, pending_count: 0, error: `Failed to insert inventory units: ${unitsError.message}` };
    }

    const itemRows = chunkSerials.map((sn) => ({
      transaction_id: transaction.id,
      serial_number: sn,
      purchase_price: data.purchase_price ?? null,
    }));

    const { error: itemsError } = await supabase.from('transaction_items').insert(itemRows);
    if (itemsError) {
      console.error('Failed to insert transaction items chunk:', itemsError.message);
    }
  }

  return {
    data: transaction,
    pending_count: isSerialized ? data.quantity : 0,
    error: null,
  };
}

// ── Create inbound by model group (stock-first, SKU confirmed later) ──
export async function createInboundByModelGroup(data: {
  location_id: string;
  model_group: string;
  quantity: number;
  user_id: string;
  notes?: string;
  purchase_price?: number;
}): Promise<{ data: Transaction | null; pending_count: number; default_sku: string | null; error: string | null }> {
  let supabase: any;
  try {
    supabase = createAdminClient();
  } catch {
    supabase = await createClient();
  }

  if (data.quantity <= 0) {
    return { data: null, pending_count: 0, default_sku: null, error: 'Quantity must be greater than zero' };
  }
  if (data.quantity > 100000) {
    return { data: null, pending_count: 0, default_sku: null, error: 'Maximum batch size is 100,000 units' };
  }

  // Find the default SKU (first alphabetically in the model group)
  const { data: prods, error: prodError } = await supabase
    .from('products')
    .select('sku')
    .eq('model_group', data.model_group)
    .eq('is_serialized', true)
    .order('sku', { ascending: true })
    .limit(1);

  const defaultSku = prods?.[0]?.sku;
  if (!defaultSku || prodError) {
    return {
      data: null,
      pending_count: 0,
      default_sku: null,
      error: `No serialized products found in model group "${data.model_group}"`,
    };
  }

  // Validate location
  const { data: loc, error: locError } = await supabase
    .from('locations')
    .select('type')
    .eq('id', data.location_id)
    .single();

  if (locError || !loc) {
    return { data: null, pending_count: 0, default_sku: null, error: 'Location ID does not exist' };
  }

  const notesPrefix = `[MODEL GROUP UPLOAD - ${data.model_group} - ${data.quantity.toLocaleString()} units]`;
  const finalNotes = data.notes
    ? `${notesPrefix} ${data.notes}`
    : `${notesPrefix} SKU to be confirmed during serial assignment.`;

  const { data: transaction, error: txnError } = await supabase
    .from('transactions')
    .insert({
      type: 'INBOUND',
      to_location_id: data.location_id,
      user_id: data.user_id,
      notes: finalNotes,
    })
    .select()
    .single();

  if (txnError || !transaction) {
    return { data: null, pending_count: 0, default_sku: null, error: `Failed to create transaction: ${txnError?.message}` };
  }

  const timestamp = Date.now();
  const skuUpper = defaultSku.toUpperCase();
  const prefix = `PENDING-${skuUpper}-${timestamp}`;
  const serialNumbers: string[] = [];
  for (let i = 1; i <= data.quantity; i++) {
    serialNumbers.push(`${prefix}-${String(i).padStart(6, '0')}`);
  }

  const CHUNK_SIZE = 1000;
  for (let i = 0; i < serialNumbers.length; i += CHUNK_SIZE) {
    const chunkSerials = serialNumbers.slice(i, i + CHUNK_SIZE);

    const unitRows = chunkSerials.map((sn) => ({
      serial_number: sn,
      sku: defaultSku,
      location_id: data.location_id,
      status: 'PENDING_SERIAL' as const,
      purchase_price: data.purchase_price ?? null,
    }));

    const { error: unitsError } = await supabase.from('inventory_units').insert(unitRows);
    if (unitsError) {
      if (i === 0) {
        await supabase.from('transactions').delete().eq('id', transaction.id);
      }
      return { data: null, pending_count: 0, default_sku: null, error: `Failed to insert inventory units: ${unitsError.message}` };
    }

    const itemRows = chunkSerials.map((sn) => ({
      transaction_id: transaction.id,
      serial_number: sn,
      purchase_price: data.purchase_price ?? null,
    }));

    const { error: itemsError } = await supabase.from('transaction_items').insert(itemRows);
    if (itemsError) {
      console.error('Failed to insert transaction items chunk:', itemsError.message);
    }
  }

  return {
    data: transaction,
    pending_count: data.quantity,
    default_sku: defaultSku,
    error: null,
  };
}

// ── Assign a real serial number to a pending placeholder ───────
export async function assignSerialNumber(data: {
  placeholder_serial: string;
  real_serial: string;
  transaction_id: string;
  sku_override?: string;
}): Promise<{ error: string | null; pending_remaining?: number }> {
  let supabase: any;
  try {
    supabase = createAdminClient();
  } catch {
    supabase = await createClient();
  }

  const realSerial = data.real_serial.trim();

  if (!realSerial) {
    return { error: 'Serial number cannot be empty' };
  }

  // 1. Try atomic PostgreSQL RPC first
  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('assign_single_serial', {
      p_transaction_id: data.transaction_id,
      p_placeholder_serial: data.placeholder_serial,
      p_real_serial: realSerial,
      p_sku_override: data.sku_override || null,
    });

    if (!rpcErr && rpcRes) {
      if (rpcRes.error) {
        return { error: rpcRes.error };
      }
      return { error: null, pending_remaining: rpcRes.pending_remaining };
    }
  } catch (err) {
    console.warn('RPC assign_single_serial fallback:', err);
  }

  // 2. Fallback execution with admin client
  // Check the placeholder exists and is still PENDING_SERIAL
  const { data: placeholder, error: fetchError } = await supabase
    .from('inventory_units')
    .select('serial_number, status, sku, location_id')
    .eq('serial_number', data.placeholder_serial)
    .single();

  if (fetchError || !placeholder) {
    return { error: 'Placeholder unit not found' };
  }

  if (placeholder.status !== 'PENDING_SERIAL') {
    return { error: `This slot has already been assigned (status: ${placeholder.status})` };
  }

  // Check if real serial is already assigned to a transaction
  const { data: existingTi } = await supabase
    .from('transaction_items')
    .select('id, transaction_id')
    .eq('serial_number', realSerial)
    .maybeSingle();

  if (existingTi) {
    return { error: `Serial number "${realSerial}" is already assigned to a receipt` };
  }

  // Check if unit exists in inventory_units (e.g. previously orphaned)
  const { data: existingUnit } = await supabase
    .from('inventory_units')
    .select('serial_number')
    .eq('serial_number', realSerial)
    .maybeSingle();

  // Determine the final SKU (override or original)
  let finalSku = placeholder.sku;

  if (data.sku_override && data.sku_override !== placeholder.sku) {
    const { data: overrideProduct } = await supabase
      .from('products')
      .select('sku, model_group')
      .eq('sku', data.sku_override)
      .single();

    if (!overrideProduct) {
      return { error: `Override SKU "${data.sku_override}" does not exist` };
    }

    const { data: originalProduct } = await supabase
      .from('products')
      .select('model_group')
      .eq('sku', placeholder.sku)
      .single();

    if (originalProduct?.model_group && overrideProduct.model_group !== originalProduct.model_group) {
      return { error: `SKU "${data.sku_override}" belongs to model group "${overrideProduct.model_group}" but placeholder is in "${originalProduct.model_group}"` };
    }

    finalSku = data.sku_override;
  }

  if (existingUnit) {
    // Unit was previously inserted, update its SKU/location/status to adopt it
    const { error: updateUnitError } = await supabase
      .from('inventory_units')
      .update({
        sku: finalSku,
        location_id: placeholder.location_id,
        status: 'IN_WAREHOUSE' as const,
      })
      .eq('serial_number', realSerial);

    if (updateUnitError) {
      return { error: `Failed to update inventory unit: ${updateUnitError.message}` };
    }
  } else {
    // Insert the real unit with final SKU
    const { error: insertError } = await supabase
      .from('inventory_units')
      .insert({
        serial_number: realSerial,
        sku: finalSku,
        location_id: placeholder.location_id,
        status: 'IN_WAREHOUSE' as const,
      });

    if (insertError) {
      return { error: `Failed to insert real unit: ${insertError.message}` };
    }
  }

  // Update transaction item to reference the real serial
  const { error: updateTiError } = await supabase
    .from('transaction_items')
    .update({ serial_number: realSerial })
    .eq('transaction_id', data.transaction_id)
    .eq('serial_number', data.placeholder_serial);

  if (updateTiError) {
    return { error: `Failed to update transaction item: ${updateTiError.message}` };
  }

  // Delete the placeholder unit
  const { error: deleteError } = await supabase
    .from('inventory_units')
    .delete()
    .eq('serial_number', data.placeholder_serial);

  if (deleteError) {
    console.warn('Failed to delete placeholder unit:', deleteError.message);
  }

  // Count remaining
  const { count: pendingCount } = await supabase
    .from('transaction_items')
    .select('*', { count: 'exact', head: true })
    .eq('transaction_id', data.transaction_id)
    .like('serial_number', 'PENDING-%');

  return { error: null, pending_remaining: pendingCount || 0 };
}

// ── Bulk assign serial numbers to a pending batch ─────────────
export async function bulkAssignSerials(data: {
  transaction_id: string;
  real_serials: string[];
  sku_override?: string;
}): Promise<{
  assigned: number;
  pending_remaining?: number;
  errors: { serial: string; error: string }[];
}> {
  let supabase: any;
  try {
    supabase = createAdminClient();
  } catch {
    supabase = await createClient();
  }

  const cleanSerials = data.real_serials.map((s) => s.trim()).filter(Boolean);
  if (cleanSerials.length === 0) {
    return { assigned: 0, errors: [{ serial: 'BATCH', error: 'No valid serial numbers provided.' }] };
  }

  // 1. Try atomic PostgreSQL RPC
  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('assign_bulk_serials', {
      p_transaction_id: data.transaction_id,
      p_real_serials: cleanSerials,
      p_sku_override: data.sku_override || null,
    });

    if (!rpcErr && rpcRes) {
      return {
        assigned: rpcRes.assigned || 0,
        pending_remaining: rpcRes.pending_remaining,
        errors: Array.isArray(rpcRes.errors) ? rpcRes.errors : [],
      };
    }
  } catch (err) {
    console.warn('RPC assign_bulk_serials fallback:', err);
  }

  // 2. Fallback execution with admin client
  // Get all pending placeholders for this transaction
  const { data: items, error: fetchError } = await supabase
    .from('transaction_items')
    .select('serial_number')
    .eq('transaction_id', data.transaction_id)
    .like('serial_number', 'PENDING-%')
    .order('serial_number', { ascending: true });

  if (fetchError || !items) {
    return { assigned: 0, errors: [{ serial: 'BATCH', error: 'Failed to load transaction items' }] };
  }

  const pendingPlaceholders = items.map((i: any) => i.serial_number);

  if (cleanSerials.length > pendingPlaceholders.length) {
    return {
      assigned: 0,
      pending_remaining: pendingPlaceholders.length,
      errors: [{
        serial: 'BATCH',
        error: `You provided ${cleanSerials.length} serials but only ${pendingPlaceholders.length} pending slots remain`,
      }],
    };
  }

  let assigned = 0;
  const errors: { serial: string; error: string }[] = [];

  for (let i = 0; i < cleanSerials.length; i++) {
    const result = await assignSerialNumber({
      placeholder_serial: pendingPlaceholders[assigned],
      real_serial: cleanSerials[i],
      transaction_id: data.transaction_id,
      sku_override: data.sku_override,
    });

    if (result.error) {
      errors.push({ serial: cleanSerials[i], error: result.error });
    } else {
      assigned++;
    }
  }

  return {
    assigned,
    pending_remaining: pendingPlaceholders.length - assigned,
    errors,
  };
}

// ── Get inbound transaction with pending serial details ────────
export async function getInboundTransaction(transactionId: string): Promise<{
  data: {
    id: string;
    tracking_number: string | null;
    notes: string | null;
    created_at: string;
    location_name: string;
    user_name: string;
    total_items: number;
    pending_items: number;
    is_non_serialized: boolean;
    items: {
      serial_number: string;
      is_pending: boolean;
      status: string;
      sku: string;
    }[];
  } | null;
  error: string | null;
}> {
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id,
      tracking_number,
      notes,
      created_at,
      locations!to_location_id(name),
      profiles(full_name),
      total:transaction_items(count),
      transaction_items(
        serial_number,
        inventory_units(status, sku)
      )
    `)
    .eq('id', transactionId)
    .eq('type', 'INBOUND')
    .single();

  if (error || !data) {
    return { data: null, error: error?.message || 'Transaction not found' };
  }

  const items = (data.transaction_items || []).map((item: any) => ({
    serial_number: item.serial_number,
    is_pending: item.serial_number.startsWith('PENDING-'),
    status: item.inventory_units?.status || 'UNKNOWN',
    sku: item.inventory_units?.sku || '',
  }));

  const totalItems = data.total?.[0]?.count ?? items.length;
  const isNonSerialized = (data.notes || '').includes('NON-SERIALIZED');

  let pendingItems = 0;
  if (!isNonSerialized) {
    if (items.length < totalItems) {
      const { count } = await supabase
        .from('transaction_items')
        .select('*', { count: 'exact', head: true })
        .eq('transaction_id', data.id)
        .like('serial_number', 'PENDING-%');
      pendingItems = count || 0;
    } else {
      pendingItems = items.filter((i: any) => i.is_pending).length;
    }
  }

  return {
    data: {
      id: data.id,
      tracking_number: data.tracking_number,
      notes: data.notes,
      created_at: data.created_at,
      location_name: data.locations?.name || 'Unknown',
      user_name: data.profiles?.full_name || 'Unknown',
      total_items: totalItems,
      pending_items: pendingItems,
      is_non_serialized: isNonSerialized,
      items,
    },
    error: null,
  };
}

// ── List all inbound transactions ──────────────────────────────
export async function listInboundTransactions(): Promise<{
  data: {
    id: string;
    tracking_number: string | null;
    notes: string | null;
    created_at: string;
    location_name: string;
    user_name: string;
    total_items: number;
    pending_items: number;
    sku: string;
    model_name: string;
  }[];
  error: string | null;
}> {
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id,
      tracking_number,
      notes,
      created_at,
      locations!to_location_id(name),
      profiles(full_name),
      total:transaction_items(count),
      transaction_items(
        serial_number,
        inventory_units(
          sku,
          products(model_name)
        )
      )
    `)
    .eq('type', 'INBOUND')
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: error.message };
  }

  // Identify any large transactions where transaction_items exceeded PostgREST embed limit
  const truncatedIds = (data || [])
    .filter((t: any) => {
      const isNonSerialized = (t.notes || '').includes('NON-SERIALIZED');
      const totalItems = t.total?.[0]?.count ?? (t.transaction_items || []).length;
      return !isNonSerialized && (t.transaction_items || []).length < totalItems;
    })
    .map((t: any) => t.id);

  const pendingCountMap = new Map<string, number>();
  if (truncatedIds.length > 0) {
    await Promise.all(
      truncatedIds.map(async (txnId: string) => {
        const { count } = await supabase
          .from('transaction_items')
          .select('*', { count: 'exact', head: true })
          .eq('transaction_id', txnId)
          .like('serial_number', 'PENDING-%');
        pendingCountMap.set(txnId, count || 0);
      })
    );
  }

  const transactions = (data || []).map((t: any) => {
    const items = t.transaction_items || [];
    const firstItem = items[0];
    const sku = firstItem?.inventory_units?.sku || '';
    const modelName = firstItem?.inventory_units?.products?.model_name || '';
    const totalItems = t.total?.[0]?.count ?? items.length;

    let pendingItems = 0;
    const isNonSerialized = (t.notes || '').includes('NON-SERIALIZED');
    if (!isNonSerialized) {
      if (items.length < totalItems) {
        pendingItems = pendingCountMap.get(t.id) ?? 0;
      } else {
        pendingItems = items.filter((i: any) => (i.serial_number || '').startsWith('PENDING-')).length;
      }
    }

    return {
      id: t.id,
      tracking_number: t.tracking_number,
      notes: t.notes,
      created_at: t.created_at,
      location_name: t.locations?.name || 'Unknown',
      user_name: t.profiles?.full_name || 'Unknown',
      total_items: totalItems,
      pending_items: pendingItems,
      sku,
      model_name: modelName,
    };
  });

  return { data: transactions, error: null };
}

// ── Delete inbound receipt (Pending or un-dispatched units) ──────────
export async function deleteInboundTransaction(transactionId: string): Promise<{ error: string | null; deletedCount?: number }> {
  let supabase: any;
  try {
    supabase = createAdminClient();
  } catch {
    supabase = await createClient();
  }

  // 1. Resolve target ID in case transactionId was passed as tracking_number
  let targetId = transactionId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transactionId);
  if (!isUuid) {
    const { data: txnByTracking } = await supabase
      .from('transactions')
      .select('id')
      .eq('tracking_number', transactionId)
      .single();
    if (txnByTracking) {
      targetId = txnByTracking.id;
    }
  }

  // 2. Fetch transaction items for this transaction
  const { data: items, error: fetchError } = await supabase
    .from('transaction_items')
    .select('serial_number')
    .eq('transaction_id', targetId);

  if (fetchError) {
    return { error: `Failed to find receipt items: ${fetchError.message}` };
  }

  const serials = (items || []).map((i: any) => i.serial_number);

  // 3. Safety check: make sure no units from this inbound have already been sold, reserved, or dispatched
  if (serials.length > 0) {
    const { data: activeUnits, error: activeError } = await supabase
      .from('inventory_units')
      .select('serial_number, status')
      .in('serial_number', serials);

    if (activeError) {
      return { error: activeError.message };
    }

    const dispatchedUnits = (activeUnits || []).filter(
      (u: any) => !['IN_WAREHOUSE', 'IN_BRANCH', 'PENDING_SERIAL'].includes(u.status)
    );

    if (dispatchedUnits.length > 0) {
      return {
        error: `Cannot delete this inbound receipt because ${dispatchedUnits.length} unit(s) from this batch have already been dispatched, reserved, or sold.`,
      };
    }
  }

  // 4. Delete the transaction FIRST!
  // NOTE: transaction_items references transactions(id) ON DELETE CASCADE,
  // while transaction_items references inventory_units(serial_number) ON DELETE RESTRICT.
  // Deleting the transaction first automatically cascades and deletes transaction_items,
  // releasing the foreign key lock on inventory_units!
  const { error: deleteTxnError } = await supabase
    .from('transactions')
    .delete()
    .eq('id', targetId);

  if (deleteTxnError) {
    return { error: `Failed to delete transaction record: ${deleteTxnError.message}` };
  }

  // 5. Delete inventory units (now unrestricted)
  if (serials.length > 0) {
    const { error: deleteUnitsError } = await supabase
      .from('inventory_units')
      .delete()
      .in('serial_number', serials);

    if (deleteUnitsError) {
      return { error: `Receipt deleted, but failed to clean up inventory units: ${deleteUnitsError.message}` };
    }
  }

  return { error: null, deletedCount: serials.length };
}
