'use server';

// ============================================================
// PSMI System — Outbound Transaction Server Actions
// ============================================================
// Handles outbound dispatch with concurrency locking to prevent
// double-booking of serial numbers.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { OutboundRoute, Transaction } from '@/lib/types/database';
import { sendWeChatOutboundNotification } from '@/lib/wechat';

export async function reserveUnits(data: {
  serial_numbers: string[];
  user_id: string;
}): Promise<{
  reserved: string[];
  errors: { serial_number: string; error: string }[];
}> {
  const supabase = await createClient();

  const reserved: string[] = [];
  const errors: { serial_number: string; error: string }[] = [];

  // Reserve each unit individually to handle partial failures
  // In production, use a Supabase RPC with SELECT FOR UPDATE for true locking
  for (const sn of data.serial_numbers) {
    // Check current status
    const { data: unit, error: fetchError } = await supabase
      .from('inventory_units')
      .select('serial_number, status')
      .eq('serial_number', sn)
      .single();

    if (fetchError || !unit) {
      errors.push({ serial_number: sn, error: 'Serial number not found' });
      continue;
    }

    if (unit.status !== 'IN_WAREHOUSE' && unit.status !== 'IN_BRANCH') {
      errors.push({
        serial_number: sn,
        error: `Cannot reserve: current status is ${unit.status}`,
      });
      continue;
    }

    // Attempt to reserve (optimistic concurrency via status check)
    const { error: updateError } = await supabase
      .from('inventory_units')
      .update({ status: 'RESERVED' })
      .eq('serial_number', sn)
      .in('status', ['IN_WAREHOUSE', 'IN_BRANCH']);

    if (updateError) {
      errors.push({ serial_number: sn, error: updateError.message });
      continue;
    }

    reserved.push(sn);
  }

  return { reserved, errors };
}

export async function createOutboundTransaction(data: {
  route: OutboundRoute;
  from_location_id: string;
  to_location_id?: string;
  serial_numbers: string[];
  user_id: string;
  notes?: string;
}): Promise<{ data: Transaction | null; error: string | null }> {
  const supabase = await createClient();

  if (data.serial_numbers.length === 0) {
    return { data: null, error: 'No serial numbers provided' };
  }

  // Validate all units are RESERVED
  const { data: units } = await supabase
    .from('inventory_units')
    .select('serial_number, status')
    .in('serial_number', data.serial_numbers);

  const nonReserved = (units || []).filter((u) => u.status !== 'RESERVED');
  if (nonReserved.length > 0) {
    const sns = nonReserved.map((u) => u.serial_number).join(', ');
    return {
      data: null,
      error: `Units not reserved (reserve them first): ${sns}`,
    };
  }

  // 1. Create transaction
  const { data: transaction, error: txnError } = await supabase
    .from('transactions')
    .insert({
      type: 'OUTBOUND',
      route: data.route,
      from_location_id: data.from_location_id,
      to_location_id: data.to_location_id || null,
      user_id: data.user_id,
      notes: data.notes || null,
    })
    .select()
    .single();

  if (txnError) {
    return {
      data: null,
      error: `Failed to create transaction: ${txnError.message}`,
    };
  }

  // 2. Create transaction items
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

  // 3. Update all units to IN_TRANSIT
  const { error: updateError } = await supabase
    .from('inventory_units')
    .update({ status: 'IN_TRANSIT' })
    .in('serial_number', data.serial_numbers);

  if (updateError) {
    console.error('Failed to update unit statuses:', updateError.message);
  }

  // 4. Trigger automated WeChat notification (async non-blocking)
  try {
    const [{ data: fromLoc }, { data: toLoc }, { data: profile }] = await Promise.all([
      supabase.from('locations').select('name').eq('id', data.from_location_id).single(),
      data.to_location_id ? supabase.from('locations').select('name').eq('id', data.to_location_id).single() : Promise.resolve({ data: null }),
      supabase.from('profiles').select('full_name').eq('id', data.user_id).single(),
    ]);

    sendWeChatOutboundNotification({
      trackingNumber: transaction.tracking_number || 'N/A',
      route: data.route,
      fromLocation: fromLoc?.name || 'Main Warehouse',
      toLocation: toLoc?.name || (data.route === 'B2B' ? 'Business Partner' : data.route === 'B2C' ? 'Customer Direct' : 'Branch Destination'),
      itemsCount: data.serial_numbers.length,
      dispatchedBy: profile?.full_name || undefined,
      notes: data.notes || undefined,
    }).catch(err => console.error('WeChat alert error:', err));
  } catch (err) {
    console.error('Error preparing WeChat alert payload:', err);
  }

  return { data: transaction, error: null };
}

export async function cancelOutbound(
  transactionId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Get all serial numbers from this transaction
  const { data: items } = await supabase
    .from('transaction_items')
    .select('serial_number')
    .eq('transaction_id', transactionId);

  if (!items || items.length === 0) {
    return { error: 'No items found for this transaction' };
  }

  const serialNumbers = items.map((i) => i.serial_number);

  // Revert status from RESERVED or IN_TRANSIT back to IN_WAREHOUSE
  const { error } = await supabase
    .from('inventory_units')
    .update({ status: 'IN_WAREHOUSE' })
    .in('serial_number', serialNumbers)
    .in('status', ['RESERVED', 'IN_TRANSIT']);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function getOutboundTransactions(filters?: {
  route?: OutboundRoute;
  verified?: boolean;
  limit?: number;
}): Promise<{ data: Transaction[]; error: string | null }> {
  const supabase = await createClient();

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('type', 'OUTBOUND')
    .order('created_at', { ascending: false });

  if (filters?.route) {
    query = query.eq('route', filters.route);
  }
  if (filters?.verified !== undefined) {
    query = query.eq('verified', filters.verified);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

// ── Resolve non-serialized quantities to virtual serials (FIFO) ───
export async function getFifoSerialsForQuantity(data: {
  sku: string;
  location_id: string;
  quantity: number;
}): Promise<{ serial_numbers: string[]; error: string | null }> {
  const supabase = await createClient();

  // Find oldest available units (FIFO)
  const { data: units, error } = await supabase
    .from('inventory_units')
    .select('serial_number')
    .eq('sku', data.sku)
    .eq('location_id', data.location_id)
    .in('status', ['IN_WAREHOUSE', 'IN_BRANCH'])
    .order('upload_date', { ascending: true })
    .limit(data.quantity);

  if (error) {
    return { serial_numbers: [], error: error.message };
  }

  if (!units || units.length < data.quantity) {
    const available = units ? units.length : 0;
    return {
      serial_numbers: [],
      error: `Insufficient stock for SKU "${data.sku}". Requested: ${data.quantity}, Available: ${available}.`,
    };
  }

  return {
    serial_numbers: units.map((u) => u.serial_number),
    error: null,
  };
}

// ── Delete outbound dispatch (revert units status and remove transaction) ────
export async function deleteOutboundTransaction(transactionId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // 1. Fetch transaction details
  const { data: txn, error: txnFetchError } = await supabase
    .from('transactions')
    .select('from_location_id, verified')
    .eq('id', transactionId)
    .single();

  if (txnFetchError || !txn) {
    return { error: txnFetchError?.message || 'Outbound transaction not found.' };
  }

  if (txn.verified) {
    return { error: 'Cannot delete a verified outbound transaction.' };
  }

  // 2. Fetch transaction items
  const { data: items, error: itemsFetchError } = await supabase
    .from('transaction_items')
    .select('serial_number')
    .eq('transaction_id', transactionId);

  if (itemsFetchError) {
    return { error: itemsFetchError.message };
  }

  const serials = (items || []).map((i) => i.serial_number);

  // 3. Determine the original status based on source location type
  const { data: loc } = await supabase
    .from('locations')
    .select('type')
    .eq('id', txn.from_location_id)
    .single();

  const originalStatus = loc?.type === 'BRANCH' ? 'IN_BRANCH' : 'IN_WAREHOUSE';

  // 4. Revert inventory unit statuses
  if (serials.length > 0) {
    const { error: updateError } = await supabase
      .from('inventory_units')
      .update({ status: originalStatus })
      .in('serial_number', serials);

    if (updateError) {
      return { error: `Failed to revert unit statuses: ${updateError.message}` };
    }
  }

  // 5. Delete the transaction (cascades to delete transaction_items)
  const { error: deleteTxnError } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId);

  if (deleteTxnError) {
    return { error: `Failed to delete transaction: ${deleteTxnError.message}` };
  }

  return { error: null };
}
