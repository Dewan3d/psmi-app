'use server';

// ============================================================
// PSMI System — Product Server Actions
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { Product, ProductCategory } from '@/lib/types/database';

export async function createProduct(data: {
  sku: string;
  model_name: string;
  description?: string;
  low_stock_threshold?: number;
  is_serialized?: boolean;
  category_badge?: ProductCategory;
  image_url?: string;
  barcode?: string;
}): Promise<{ data: Product | null; error: string | null }> {
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      sku: data.sku.toUpperCase().trim(),
      model_name: data.model_name.trim(),
      description: data.description?.trim() || null,
      low_stock_threshold: data.low_stock_threshold ?? 10,
      is_serialized: data.is_serialized ?? true,
      category_badge: data.category_badge ?? 'POWER_STATION',
      image_url: data.image_url?.trim() || null,
      barcode: data.barcode?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { data: null, error: `SKU "${data.sku}" already exists` };
    }
    return { data: null, error: error.message };
  }

  return { data: product, error: null };
}

export async function updateProduct(
  sku: string,
  data: {
    model_name?: string;
    description?: string;
    low_stock_threshold?: number;
    is_serialized?: boolean;
    category_badge?: ProductCategory;
    image_url?: string;
    barcode?: string;
  }
): Promise<{ data: Product | null; error: string | null }> {
  const supabase = await createClient();

  const updateData: Record<string, any> = {};
  if (data.model_name !== undefined) updateData.model_name = data.model_name.trim();
  if (data.description !== undefined) updateData.description = data.description.trim() || null;
  if (data.low_stock_threshold !== undefined) updateData.low_stock_threshold = data.low_stock_threshold;
  if (data.is_serialized !== undefined) updateData.is_serialized = data.is_serialized;
  if (data.category_badge !== undefined) updateData.category_badge = data.category_badge;
  if (data.image_url !== undefined) updateData.image_url = data.image_url.trim() || null;
  if (data.barcode !== undefined) updateData.barcode = data.barcode.trim() || null;

  const { data: product, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('sku', sku)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: product, error: null };
}

export async function deleteProduct(
  sku: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Check if there are inventory units using this SKU
  const { count } = await supabase
    .from('inventory_units')
    .select('*', { count: 'exact', head: true })
    .eq('sku', sku);

  if (count && count > 0) {
    return {
      error: `Cannot delete SKU "${sku}": ${count} inventory unit(s) still reference it. Remove or reassign them first.`,
    };
  }

  const { error } = await supabase.from('products').delete().eq('sku', sku);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function listProducts(): Promise<{
  data: Product[];
  error: string | null;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

export async function getProduct(
  sku: string
): Promise<{ data: Product | null; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('sku', sku)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}
