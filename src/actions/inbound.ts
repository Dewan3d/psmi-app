'use server';

// ============================================================
// PSMI System — Inbound Transaction Server Actions
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { Transaction } from '@/lib/types/database';

// ── Helper: generate placeholder serial numbers ───────────────
function generatePlaceholderSerial(sku: string, index: number): string {
  const padded = String(index).padStart(4, '0');
  return `PENDING-${sku.toUpperCase()}-${Date.now()}-${padded}`;
}

// ── Create inbound with direct serial numbers ─────────────────
export async function createInboundTransaction(data: {
  location_id: string;
  serial_numbers: string[];
  sku: string;
  user_id: string;
  notes?: string;
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
}): Promise<{ data: Transaction | null; pending_count: number; error: string | null }> {
  const supabase = await createClient();

  if (data.quantity <= 0) {
    return { data: null, pending_count: 0, error: 'Quantity must be greater than zero' };
  }
  if (data.quantity > 10000) {
    return { data: null, pending_count: 0, error: 'Maximum batch size is 10,000 units' };
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('inbound_by_quantity', {
    p_sku: data.sku,
    p_location_id: data.location_id,
    p_user_id: data.user_id,
    p_quantity: data.quantity,
    p_notes: data.notes || '',
    p_timestamp: Date.now(),
  });

  if (rpcError) {
    return { data: null, pending_count: 0, error: rpcError.message };
  }

  const result = rpcData as { data: Transaction | null; pending_count: number; error: string | null };

  if (result.error) {
    return { data: null, pending_count: 0, error: result.error };
  }

  return {
    data: result.data,
    pending_count: result.pending_count,
    error: null,
  };
}

// ── Assign a real serial number to a pending placeholder ───────
export async function assignSerialNumber(data: {
  placeholder_serial: string;
  real_serial: string;
  transaction_id: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const realSerial = data.real_serial.trim();

  if (!realSerial) {
    return { error: 'Serial number cannot be empty' };
  }

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

  // Check the real serial doesn't already exist
  const { data: existingUnit } = await supabase
    .from('inventory_units')
    .select('serial_number')
    .eq('serial_number', realSerial)
    .single();

  if (existingUnit) {
    return { error: `Serial number "${realSerial}" already exists in inventory` };
  }

  // Insert the real unit
  const { error: insertError } = await supabase
    .from('inventory_units')
    .insert({
      serial_number: realSerial,
      sku: placeholder.sku,
      location_id: placeholder.location_id,
      status: 'IN_WAREHOUSE' as const,
    });

  if (insertError) {
    return { error: `Failed to insert real unit: ${insertError.message}` };
  }

  // Update transaction item to reference the real serial
  await supabase
    .from('transaction_items')
    .update({ serial_number: realSerial })
    .eq('transaction_id', data.transaction_id)
    .eq('serial_number', data.placeholder_serial);

  // Delete the placeholder unit
  await supabase
    .from('inventory_units')
    .delete()
    .eq('serial_number', data.placeholder_serial);

  return { error: null };
}

// ── Bulk assign serial numbers to a pending batch ─────────────
export async function bulkAssignSerials(data: {
  transaction_id: string;
  real_serials: string[];
}): Promise<{
  assigned: number;
  errors: { serial: string; error: string }[];
}> {
  const supabase = await createClient();

  // Get all pending placeholders for this transaction
  const { data: items, error: fetchError } = await supabase
    .from('transaction_items')
    .select('serial_number')
    .eq('transaction_id', data.transaction_id);

  if (fetchError || !items) {
    return { assigned: 0, errors: [{ serial: 'BATCH', error: 'Failed to load transaction items' }] };
  }

  const pendingPlaceholders = items
    .map((i) => i.serial_number)
    .filter((sn) => sn.startsWith('PENDING-'));

  if (data.real_serials.length > pendingPlaceholders.length) {
    return {
      assigned: 0,
      errors: [{
        serial: 'BATCH',
        error: `You provided ${data.real_serials.length} serials but only ${pendingPlaceholders.length} pending slots remain`,
      }],
    };
  }

  let assigned = 0;
  const errors: { serial: string; error: string }[] = [];

  for (let i = 0; i < data.real_serials.length; i++) {
    const result = await assignSerialNumber({
      placeholder_serial: pendingPlaceholders[i],
      real_serial: data.real_serials[i],
      transaction_id: data.transaction_id,
    });

    if (result.error) {
      errors.push({ serial: data.real_serials[i], error: result.error });
    } else {
      assigned++;
    }
  }

  return { assigned, errors };
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

  return {
    data: {
      id: data.id,
      tracking_number: data.tracking_number,
      notes: data.notes,
      created_at: data.created_at,
      location_name: data.locations?.name || 'Unknown',
      user_name: data.profiles?.full_name || 'Unknown',
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

  const transactions = (data || []).map((t: any) => {
    const items = t.transaction_items || [];
    const firstItem = items[0];
    const sku = firstItem?.inventory_units?.sku || '';
    const modelName = firstItem?.inventory_units?.products?.model_name || '';
    const serials: string[] = items.map((i: any) => i.serial_number);
    const pendingItems = serials.filter((sn) => sn.startsWith('PENDING-')).length;
    return {
      id: t.id,
      tracking_number: t.tracking_number,
      notes: t.notes,
      created_at: t.created_at,
      location_name: t.locations?.name || 'Unknown',
      user_name: t.profiles?.full_name || 'Unknown',
      total_items: serials.length,
      pending_items: pendingItems,
      sku,
      model_name: modelName,
    };
  });

  return { data: transactions, error: null };
}

// ── Delete inbound receipt (Pending or un-dispatched accessories) ────
export async function deleteInboundTransaction(transactionId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // 1. Fetch transaction items for this transaction
  const { data: items, error: fetchError } = await supabase
    .from('transaction_items')
    .select('serial_number')
    .eq('transaction_id', transactionId);

  if (fetchError) {
    return { error: fetchError.message };
  }

  const serials = (items || []).map((i) => i.serial_number);

  // 2. Safety check: make sure all serial numbers are pending placeholders or undispatched accessories
  const nonPendingSerials = serials.filter((sn) => !sn.startsWith('PENDING-'));
  
  if (nonPendingSerials.length > 0) {
    const hasRealSerials = nonPendingSerials.some((sn) => !sn.startsWith('NS-'));
    if (hasRealSerials) {
      return { error: 'Cannot delete a finalized inbound transaction containing real serial numbers.' };
    }

    // It has NS- virtual serials. Check if any are no longer available in stock.
    const { data: activeUnits, error: activeError } = await supabase
      .from('inventory_units')
      .select('status')
      .in('serial_number', nonPendingSerials);

    if (activeError) {
      return { error: activeError.message };
    }

    const unAvailable = (activeUnits || []).some((u) => !['IN_WAREHOUSE', 'IN_BRANCH'].includes(u.status));
    if (unAvailable) {
      return { error: 'Cannot delete inbound accessories because some units from this batch have already been dispatched or reserved.' };
    }
  }

  // 3. Delete inventory units (both pending placeholders and un-dispatched virtual units)
  if (serials.length > 0) {
    const { error: deleteUnitsError } = await supabase
      .from('inventory_units')
      .delete()
      .in('serial_number', serials);

    if (deleteUnitsError) {
      return { error: `Failed to delete inventory units: ${deleteUnitsError.message}` };
    }
  }

  // 4. Delete the transaction (cascades to delete transaction_items)
  const { error: deleteTxnError } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId);

  if (deleteTxnError) {
    return { error: `Failed to delete transaction: ${deleteTxnError.message}` };
  }

  return { error: null };
}
