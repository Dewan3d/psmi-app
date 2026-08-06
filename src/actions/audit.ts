'use server';

// ============================================================
// PSMI System — Audit & Cycle Count Server Actions
// ============================================================
// Handles cycle counting: generate random sample, submit results,
// and generate discrepancy reports.
// ============================================================

import { createClient } from '@/lib/supabase/server';

export async function generateCycleCountSample(data: {
  location_id: string;
  sample_size: number;
}): Promise<{
  data: { serial_number: string; sku: string; status: string }[];
  error: string | null;
}> {
  const supabase = await createClient();

  // Get all units expected at this location (not SOLD or DAMAGED)
  const { data: units, error } = await supabase
    .from('inventory_units')
    .select('serial_number, sku, status')
    .eq('location_id', data.location_id)
    .in('status', ['IN_WAREHOUSE', 'IN_BRANCH', 'RESERVED']);

  if (error) {
    return { data: [], error: error.message };
  }

  if (!units || units.length === 0) {
    return { data: [], error: 'No active units at this location' };
  }

  // Randomly sample
  const sampleSize = Math.min(data.sample_size, units.length);
  const shuffled = [...units].sort(() => Math.random() - 0.5);
  const sample = shuffled.slice(0, sampleSize);

  return { data: sample, error: null };
}

export async function submitCycleCountResults(data: {
  location_id: string;
  found_serials: string[];
  not_found_serials: string[];
  user_id: string;
}): Promise<{
  report: {
    total_expected: number;
    found: number;
    not_found: number;
    accuracy_pct: number;
  };
  error: string | null;
}> {
  const supabase = await createClient();

  const total = data.found_serials.length + data.not_found_serials.length;
  const accuracy =
    total > 0 ? Math.round((data.found_serials.length / total) * 100) : 0;

  // Log the cycle count as a special transaction
  const cycleCountNotes = JSON.stringify({
    cycle_count: true,
    found: data.found_serials.length,
    not_found: data.not_found_serials.length,
    accuracy_pct: accuracy,
    not_found_serials: data.not_found_serials,
  });
  const { error: txnError } = await (supabase.from('transactions') as any).insert({
    type: 'INBOUND',
    to_location_id: data.location_id,
    user_id: data.user_id,
    notes: cycleCountNotes,
  });

  if (txnError) {
    console.error('Failed to log cycle count:', (txnError as any).message);
  }

  return {
    report: {
      total_expected: total,
      found: data.found_serials.length,
      not_found: data.not_found_serials.length,
      accuracy_pct: accuracy,
    },
    error: null,
  };
}

export async function getCycleCountReport(data: {
  location_id: string;
}): Promise<{
  data: {
    date: string;
    total_expected: number;
    found: number;
    not_found: number;
    accuracy_pct: number;
  }[];
  error: string | null;
}> {
  const supabase = await createClient();

  const { data: transactions, error } = await (supabase
    .from('transactions')
    .select('created_at, notes')
    .eq('to_location_id', data.location_id)
    .not('notes', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20) as any);

  if (error) {
    return { data: [], error: error.message };
  }

  const reports = ((transactions || []) as any[])
    .filter((t) => {
      try {
        const parsed = JSON.parse(t.notes || '{}');
        return parsed.cycle_count === true;
      } catch {
        return false;
      }
    })
    .map((t) => {
      const parsed = JSON.parse(t.notes || '{}');
      return {
        date: t.created_at,
        total_expected: parsed.found + parsed.not_found,
        found: parsed.found,
        not_found: parsed.not_found,
        accuracy_pct: parsed.accuracy_pct,
      };
    });

  return { data: reports, error: null };
}
