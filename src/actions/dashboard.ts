'use server';

// ============================================================
// PSMI System — Dashboard Server Actions
// ============================================================
// Aggregate queries for the home dashboard: stock per location,
// sales summaries, low-stock alerts, and recent activity.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { LocationStock, LowStockAlert, UnitStatus } from '@/lib/types/database';

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

  // Get all units grouped by location and status (excluding SOLD)
  const { data: units, error: unitsError } = await supabase
    .from('inventory_units')
    .select('location_id, status')
    .neq('status', 'SOLD');

  if (unitsError) {
    return { data: [], error: unitsError.message };
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

  for (const unit of units || []) {
    const stock = stockMap.get(unit.location_id);
    if (!stock) continue;
    stock.total_units++;
    stock.status_breakdown[unit.status as UnitStatus]++;
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

  // Get all inventory units to check count and ever-inbounded status
  const { data: allUnits, error: unitsError } = await supabase
    .from('inventory_units')
    .select('sku, status');

  if (unitsError) {
    return { data: [], error: unitsError.message };
  }

  // Track SKUs that have ever been inbounded & current warehouse stock count
  const everInboundedSkus = new Set<string>();
  const skuWarehouseCounts: Record<string, number> = {};

  for (const unit of allUnits || []) {
    everInboundedSkus.add(unit.sku);
    if (unit.status === 'IN_WAREHOUSE') {
      skuWarehouseCounts[unit.sku] = (skuWarehouseCounts[unit.sku] || 0) + 1;
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
