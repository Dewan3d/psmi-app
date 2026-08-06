'use server';

// ============================================================
// PSMI System — Branch Receiving Server Actions
// ============================================================
// Handles branch staff confirming receipt of transferred units.
// ============================================================

import { createClient } from '@/lib/supabase/server';

export async function confirmReceival(data: {
  transaction_id: string;
  scanned_serials: string[];
}): Promise<{
  matched: string[];
  missing: string[];
  unexpected: string[];
  error: string | null;
}> {
  const supabase = await createClient();

  // Get all serial numbers expected from this transaction
  const { data: items, error } = await supabase
    .from('transaction_items')
    .select('serial_number')
    .eq('transaction_id', data.transaction_id);

  if (error) {
    return {
      matched: [],
      missing: [],
      unexpected: [],
      error: error.message,
    };
  }

  const expectedSerials = new Set(
    (items || []).map((i) => i.serial_number)
  );
  const scannedSerials = new Set(data.scanned_serials);

  // Find matches, missing, and unexpected
  const matched: string[] = [];
  const missing: string[] = [];
  const unexpected: string[] = [];

  for (const expected of expectedSerials) {
    if (scannedSerials.has(expected)) {
      matched.push(expected);
    } else {
      missing.push(expected);
    }
  }

  for (const scanned of scannedSerials) {
    if (!expectedSerials.has(scanned)) {
      unexpected.push(scanned);
    }
  }

  // Update matched units: IN_TRANSIT → IN_BRANCH
  if (matched.length > 0) {
    // Get the transaction to find the destination location
    const { data: transaction } = await supabase
      .from('transactions')
      .select('to_location_id')
      .eq('id', data.transaction_id)
      .single();

    const updateData: { status: 'IN_BRANCH'; location_id?: string } = {
      status: 'IN_BRANCH',
    };

    if (transaction?.to_location_id) {
      updateData.location_id = transaction.to_location_id;
    }

    const { error: updateError } = await supabase
      .from('inventory_units')
      .update(updateData)
      .in('serial_number', matched)
      .eq('status', 'IN_TRANSIT');

    if (updateError) {
      return {
        matched,
        missing,
        unexpected,
        error: `Units identified but failed to update: ${updateError.message}`,
      };
    }
  }

  return { matched, missing, unexpected, error: null };
}

export async function getPendingTransfers(
  locationId: string
): Promise<{
  data: {
    id: string;
    tracking_number: string | null;
    from_location_id: string | null;
    created_at: string;
    item_count: number;
  }[];
  error: string | null;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('transactions')
    .select(
      `
      id,
      tracking_number,
      from_location_id,
      created_at,
      transaction_items(serial_number)
    `
    )
    .eq('type', 'OUTBOUND')
    .eq('route', 'TB')
    .eq('to_location_id', locationId)
    .eq('verified', false)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: error.message };
  }

  const transfers = (data || []).map((t) => ({
    id: t.id,
    tracking_number: t.tracking_number,
    from_location_id: t.from_location_id,
    created_at: t.created_at,
    item_count: Array.isArray(t.transaction_items)
      ? t.transaction_items.length
      : 0,
  }));

  return { data: transfers, error: null };
}
