'use server';

// ============================================================
// PSMI System — Product Server Actions
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { Product, ProductCategory, ModelGroup } from '@/lib/types/database';

export async function createProduct(data: {
  sku: string;
  model_name: string;
  description?: string;
  low_stock_threshold?: number;
  is_serialized?: boolean;
  category_badge?: ProductCategory;
  image_url?: string;
  barcode?: string;
  model_group?: string;
  cost_price?: number;
  retail_price?: number;
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
      model_group: data.model_group?.trim() || null,
      cost_price: data.cost_price ?? null,
      retail_price: data.retail_price ?? null,
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
    model_group?: string | null;
    cost_price?: number | null;
    retail_price?: number | null;
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
  if (data.model_group !== undefined) updateData.model_group = data.model_group?.trim() || null;
  if (data.cost_price !== undefined) updateData.cost_price = data.cost_price;
  if (data.retail_price !== undefined) updateData.retail_price = data.retail_price;

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

export async function listModelGroups(): Promise<{
  data: ModelGroup[];
  error: string | null;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('products')
    .select('sku, model_name, model_group')
    .not('model_group', 'is', null)
    .order('model_group', { ascending: true })
    .order('sku', { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  // Group by model_group
  const groupMap = new Map<string, { sku: string; model_name: string }[]>();
  for (const row of data || []) {
    if (!row.model_group) continue;
    if (!groupMap.has(row.model_group)) {
      groupMap.set(row.model_group, []);
    }
    groupMap.get(row.model_group)!.push({
      sku: row.sku,
      model_name: row.model_name,
    });
  }

  const groups: ModelGroup[] = Array.from(groupMap.entries()).map(
    ([model_group, skus]) => ({ model_group, skus })
  );

  return { data: groups, error: null };
}

// ── Bulk update product prices from spreadsheet import ────────
export async function bulkUpdatePrices(
  updates: { sku: string; cost_price?: number; retail_price?: number }[]
): Promise<{
  updated: number;
  skipped: { sku: string; reason: string }[];
  errors: string[];
}> {
  const supabase = await createClient();

  const skipped: { sku: string; reason: string }[] = [];
  const errors: string[] = [];
  let updated = 0;

  // Fetch all existing SKUs, model names, and barcodes for validation and flexible matching
  const { data: existingProducts, error: fetchError } = await supabase
    .from('products')
    .select('sku, model_name, barcode');

  if (fetchError) {
    return { updated: 0, skipped: [], errors: [`Failed to fetch products: ${fetchError.message}`] };
  }

  const productsList = existingProducts || [];

  function matchSkus(rawInput: string): string[] {
    const norm = rawInput.trim().toUpperCase();
    if (!norm) return [];

    // 1. Exact SKU
    const bySku = productsList.filter((p) => p.sku.toUpperCase() === norm);
    if (bySku.length > 0) return bySku.map((p) => p.sku);

    // 2. Exact Model Name
    const byModel = productsList.filter((p) => (p.model_name || '').trim().toUpperCase() === norm);
    if (byModel.length > 0) return byModel.map((p) => p.sku);

    // 3. Base Model Name (e.g. "FAN (OLD)" or "LCD (TV)" stripped to "FAN" or "LCD")
    const byBase = productsList.filter((p) => {
      const base = (p.model_name || '')
        .replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
        .trim()
        .toUpperCase();
      return base === norm;
    });
    if (byBase.length > 0) return byBase.map((p) => p.sku);

    // 4. Barcode
    const byBarcode = productsList.filter((p) => (p.barcode || '').trim().toUpperCase() === norm);
    if (byBarcode.length > 0) return byBarcode.map((p) => p.sku);

    // 5. Clean alphanumeric match (e.g. "P-100" vs "P100")
    const cleanIdent = norm.replace(/[^A-Z0-9]/g, '');
    if (cleanIdent.length >= 2) {
      const cleanMatches = productsList.filter((p) => {
        const cleanM = (p.model_name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const cleanS = (p.sku || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const cleanB = (p.model_name || '')
          .replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '');
        return cleanM === cleanIdent || cleanS === cleanIdent || cleanB === cleanIdent;
      });
      if (cleanMatches.length > 0) return cleanMatches.map((p) => p.sku);
    }

    // 6. Word / Prefix match (e.g. "LCD" matches "LCD 32IN PAYGO", "LCD (TV)")
    if (norm.length >= 3) {
      const byPrefix = productsList.filter((p) => {
        const m = (p.model_name || '').trim().toUpperCase();
        return m.startsWith(norm + ' ') || m.startsWith(norm + '(') || m.startsWith(norm + '-');
      });
      if (byPrefix.length > 0) return byPrefix.map((p) => p.sku);
    }

    return [];
  }

  for (const update of updates) {
    const targetSkus = Array.from(new Set(matchSkus(update.sku)));

    if (targetSkus.length === 0) {
      skipped.push({ sku: update.sku, reason: 'SKU or Model not found in catalogue' });
      continue;
    }

    const updateData: Record<string, any> = {};
    if (update.cost_price !== undefined) updateData.cost_price = update.cost_price;
    if (update.retail_price !== undefined) updateData.retail_price = update.retail_price;

    if (Object.keys(updateData).length === 0) {
      skipped.push({ sku: update.sku, reason: 'No price values provided' });
      continue;
    }

    for (const skuToUpdate of targetSkus) {
      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('sku', skuToUpdate);

      if (updateError) {
        errors.push(`Failed to update ${skuToUpdate}: ${updateError.message}`);
      } else {
        updated++;
      }
    }
  }

  return { updated, skipped, errors };
}
