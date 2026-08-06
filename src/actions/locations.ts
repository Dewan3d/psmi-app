'use server';

// ============================================================
// PSMI System — Location Server Actions
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { Location } from '@/lib/types/database';

export async function createLocation(data: {
  name: string;
  type: 'WAREHOUSE' | 'BRANCH';
  address?: string;
}): Promise<{ data: Location | null; error: string | null }> {
  const supabase = await createClient();

  const { data: location, error } = await supabase
    .from('locations')
    .insert({
      name: data.name.trim(),
      type: data.type,
      address: data.address?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: location, error: null };
}

export async function updateLocation(
  id: string,
  data: {
    name?: string;
    type?: 'WAREHOUSE' | 'BRANCH';
    address?: string;
  }
): Promise<{ data: Location | null; error: string | null }> {
  const supabase = await createClient();

  const { data: location, error } = await supabase
    .from('locations')
    .update({
      name: data.name?.trim(),
      type: data.type,
      address: data.address?.trim(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: location, error: null };
}

export async function listLocations(): Promise<{
  data: Location[];
  error: string | null;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

export async function getLocation(
  id: string
): Promise<{ data: Location | null; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}
