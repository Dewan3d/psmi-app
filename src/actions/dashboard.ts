'use server';

// ============================================================
// PSMI System — Dashboard Server Actions
// ============================================================
// Aggregate queries for the home dashboard: stock per location,
// sales summaries, low-stock alerts, and recent activity.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { LocationStock, LowStockAlert, ProductCategory, StockSummary, UnitStatus } from '@/lib/types/database';

export async function getInventoryByLocation(): Promise<{
  data: LocationStock[];
  error: string | null;
}> {
  const supabase = (await createClient()) as any;

  // Get all locations
  const { data: locations, error: locError } = await supabase
    .from('locations')
    .select('*');

  if (locError) {
    return { data: [], error: locError.message };
  }

  // Get aggregated stock by location and status (excluding SOLD)
  const { data: summaryRows, error: summaryError } = await supabase
    .from('location_stock_summary')
    .select('location_id, status, count')
    .neq('status', 'SOLD');

  if (summaryError) {
    return { data: [], error: summaryError.message };
  }

  // Build location stock map
  const stockMap = new Map<string, LocationStock>();

  for (const loc of locations || []) {
    stockMap.set(loc.id, {
      location_id: loc.id,
      location_name: loc.name,
      location_type: loc.type as 'WAREHOUSE' | 'BRANCH',
      total_units: 0,
      status_breakdown: {
        IN_WAREHOUSE: 0,
        RESERVED: 0,
        IN_TRANSIT: 0,
        IN_BRANCH: 0,
        SOLD: 0,
        DAMAGED_REPAIR: 0,
        PENDING_SERIAL: 0,
      },
    });
  }

  for (const row of summaryRows || []) {
    const stock = stockMap.get(row.location_id);
    if (!stock) continue;
    const count = row.count || 0;
    stock.total_units += count;
    stock.status_breakdown[row.status as UnitStatus] += count;
  }

  return { data: Array.from(stockMap.values()), error: null };
}

export async function getSalesSummary(filters?: {
  from_date?: string;
  to_date?: string;
  location_id?: string;
  route?: string;
}): Promise<{
  data: {
    total_sold: number;
    by_route: { route: string; count: number }[];
    by_month: { month: string; count: number }[];
  };
  error: string | null;
}> {
  const supabase = (await createClient()) as any;

  let query = supabase
    .from('transactions')
    .select('id, route, created_at, verified')
    .eq('type', 'OUTBOUND')
    .eq('verified', true);

  if (filters?.from_date) {
    query = query.gte('created_at', filters.from_date);
  }
  if (filters?.to_date) {
    query = query.lte('created_at', filters.to_date);
  }
  if (filters?.route) {
    query = query.eq('route', filters.route);
  }

  const { data: transactions, error } = await query;

  if (error) {
    return {
      data: { total_sold: 0, by_route: [], by_month: [] },
      error: error.message,
    };
  }

  // Get item counts per transaction
  const txnIds = (transactions || []).map((t: any) => t.id);
  let itemCounts: Record<string, number> = {};

  if (txnIds.length > 0) {
    const { data: items } = await supabase
      .from('transaction_items')
      .select('transaction_id')
      .in('transaction_id', txnIds);

    for (const item of items || []) {
      itemCounts[item.transaction_id] =
        (itemCounts[item.transaction_id] || 0) + 1;
    }
  }

  // Aggregate by route
  const routeCounts: Record<string, number> = {};
  const monthCounts: Record<string, number> = {};

  for (const txn of transactions || []) {
    const count = itemCounts[txn.id] || 0;
    const route = txn.route || 'UNKNOWN';
    routeCounts[route] = (routeCounts[route] || 0) + count;

    const month = new Date(txn.created_at).toISOString().slice(0, 7);
    monthCounts[month] = (monthCounts[month] || 0) + count;
  }

  const totalSold = Object.values(routeCounts).reduce((a, b) => a + b, 0);

  return {
    data: {
      total_sold: totalSold,
      by_route: Object.entries(routeCounts).map(([route, count]) => ({
        route,
        count,
      })),
      by_month: Object.entries(monthCounts)
        .sort()
        .map(([month, count]) => ({ month, count })),
    },
    error: null,
  };
}

export async function getLowStockAlerts(): Promise<{
  data: LowStockAlert[];
  error: string | null;
}> {
  const supabase = (await createClient()) as any;

  // Get products with their thresholds
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('sku, model_name, low_stock_threshold');

  if (prodError) {
    return { data: [], error: prodError.message };
  }

  // Get aggregated inventory counts grouped by SKU and status
  const { data: summaryRows, error: summaryError } = await supabase
    .from('inventory_stock_summary')
    .select('sku, status, count');

  if (summaryError) {
    return { data: [], error: summaryError.message };
  }

  // Track SKUs that have ever been inbounded & current warehouse stock count
  const everInboundedSkus = new Set<string>();
  const skuWarehouseCounts: Record<string, number> = {};

  for (const row of summaryRows || []) {
    everInboundedSkus.add(row.sku);
    if (row.status === 'IN_WAREHOUSE') {
      skuWarehouseCounts[row.sku] = (skuWarehouseCounts[row.sku] || 0) + (row.count || 0);
    }
  }

  // Find low stock ONLY for SKUs that have been inbounded at least once
  const alerts: LowStockAlert[] = [];
  for (const product of products || []) {
    // Skip brand new SKUs that have never been inbounded
    if (!everInboundedSkus.has(product.sku)) {
      continue;
    }

    const count = skuWarehouseCounts[product.sku] || 0;
    if (count < product.low_stock_threshold) {
      alerts.push({
        sku: product.sku,
        model_name: product.model_name,
        current_count: count,
        threshold: product.low_stock_threshold,
      });
    }
  }

  return { data: alerts, error: null };
}

export async function getRecentActivity(
  limit: number = 10
): Promise<{
  data: {
    id: string;
    type: string;
    route: string | null;
    tracking_number: string | null;
    user_name: string;
    created_at: string;
    item_count: number;
  }[];
  error: string | null;
}> {
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from('transactions')
    .select(
      `
      id,
      type,
      route,
      tracking_number,
      created_at,
      profiles(full_name),
      transaction_items(serial_number)
    `
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { data: [], error: error.message };
  }

  const activities = (data || []).map((t: any) => ({
    id: t.id,
    type: t.type,
    route: t.route,
    tracking_number: t.tracking_number,
    user_name:
      (t.profiles as unknown as { full_name: string })?.full_name || 'Unknown',
    created_at: t.created_at,
    item_count: Array.isArray(t.transaction_items)
      ? t.transaction_items.length
      : 0,
  }));

  return { data: activities, error: null };
}

// ── Stock By Category (for dashboard infographics) ───────────
export async function getStockByCategory(): Promise<{
  data: {
    totals: Record<UnitStatus, number>;
    by_category: {
      category: ProductCategory;
      count: number;
      status_breakdown: Record<UnitStatus, number>;
    }[];
    by_model: {
      sku: string;
      model_name: string;
      category_badge: ProductCategory;
      total: number;
      low_stock_threshold: number;
      status_breakdown: Record<UnitStatus, number>;
    }[];
  };
  error: string | null;
}> {
  const supabase = (await createClient()) as any;

  // Get all products with their category badge
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('sku, model_name, category_badge, low_stock_threshold');

  if (prodError) {
    return {
      data: { totals: {} as any, by_category: [], by_model: [] },
      error: prodError.message,
    };
  }

  // Get aggregated inventory counts grouped by SKU and status (excluding SOLD)
  const { data: summaryRows, error: summaryError } = await supabase
    .from('inventory_stock_summary')
    .select('sku, status, count')
    .neq('status', 'SOLD');

  if (summaryError) {
    return {
      data: { totals: {} as any, by_category: [], by_model: [] },
      error: summaryError.message,
    };
  }

  // Build product lookup
  const productMap = new Map<string, {
    model_name: string;
    category_badge: ProductCategory;
    low_stock_threshold: number;
  }>();
  for (const p of products || []) {
    productMap.set(p.sku, {
      model_name: p.model_name,
      category_badge: p.category_badge || 'POWER_STATION',
      low_stock_threshold: p.low_stock_threshold,
    });
  }

  // Initialize status keys
  const statusKeys: UnitStatus[] = [
    'IN_WAREHOUSE', 'RESERVED', 'IN_TRANSIT', 'IN_BRANCH',
    'SOLD', 'DAMAGED_REPAIR', 'PENDING_SERIAL',
  ];
  const emptyBreakdown = (): Record<UnitStatus, number> => {
    const b: any = {};
    for (const s of statusKeys) b[s] = 0;
    return b;
  };

  // Aggregate totals
  const totals = emptyBreakdown();

  // Aggregate by category
  const categoryMap = new Map<ProductCategory, {
    count: number;
    status_breakdown: Record<UnitStatus, number>;
  }>();
  for (const cat of ['POWER_STATION', 'SHS', 'ACCESSORIES'] as ProductCategory[]) {
    categoryMap.set(cat, { count: 0, status_breakdown: emptyBreakdown() });
  }

  // Aggregate by model
  const modelMap = new Map<string, {
    sku: string;
    model_name: string;
    category_badge: ProductCategory;
    total: number;
    low_stock_threshold: number;
    status_breakdown: Record<UnitStatus, number>;
  }>();
  for (const p of products || []) {
    modelMap.set(p.sku, {
      sku: p.sku,
      model_name: p.model_name,
      category_badge: p.category_badge || 'POWER_STATION',
      total: 0,
      low_stock_threshold: p.low_stock_threshold,
      status_breakdown: emptyBreakdown(),
    });
  }

  // Process each aggregated stock summary row
  for (const row of summaryRows || []) {
    const product = productMap.get(row.sku);
    if (!product) continue;

    const status = row.status as UnitStatus;
    const count = row.count || 0;

    // Global totals
    totals[status] += count;

    // Category aggregation
    const catEntry = categoryMap.get(product.category_badge);
    if (catEntry) {
      catEntry.count += count;
      catEntry.status_breakdown[status] += count;
    }

    // Model aggregation
    const modelEntry = modelMap.get(row.sku);
    if (modelEntry) {
      modelEntry.total += count;
      modelEntry.status_breakdown[status] += count;
    }
  }

  return {
    data: {
      totals,
      by_category: Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        count: data.count,
        status_breakdown: data.status_breakdown,
      })),
      by_model: Array.from(modelMap.values()),
    },
    error: null,
  };
}
