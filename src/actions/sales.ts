'use server';

// ============================================================
// PSMI System — Sales Server Actions
// ============================================================
// Queries, aggregation, and price editing for the Sales page.
// Sales = outbound transactions with route B2B or B2C.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { SaleRecord } from '@/lib/types/database';

// ── Fetch sales transactions with full details ────────────────
export async function getSales(filters?: {
  from_date?: string;
  to_date?: string;
  route?: 'B2B' | 'B2C';
  search?: string;
  sku?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  data: SaleRecord[];
  total: number;
  error: string | null;
}> {
  const supabase = await createClient();

  // 1. Fetch outbound transactions (B2B + B2C only)
  let query = supabase
    .from('transactions')
    .select('id, tracking_number, route, customer_name, created_at, verified, user_id, notes', { count: 'exact' })
    .eq('type', 'OUTBOUND')
    .in('route', filters?.route ? [filters.route] : ['B2B', 'B2C'])
    .order('created_at', { ascending: false });

  if (filters?.from_date) query = query.gte('created_at', filters.from_date);
  if (filters?.to_date) query = query.lte('created_at', filters.to_date);
  if (filters?.search) {
    query = query.or(`customer_name.ilike.%${filters.search}%,tracking_number.ilike.%${filters.search}%`);
  }

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data: transactions, count, error: txnError } = await query;

  if (txnError) {
    return { data: [], total: 0, error: txnError.message };
  }

  if (!transactions || transactions.length === 0) {
    return { data: [], total: count || 0, error: null };
  }

  // 2. Fetch user profiles for display names
  const userIds = [...new Set(transactions.map((t: any) => t.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);
  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));

  // 3. Fetch transaction items with prices
  const txnIds = transactions.map((t: any) => t.id);
  const { data: items } = await supabase
    .from('transaction_items')
    .select('transaction_id, serial_number, sale_price, purchase_price')
    .in('transaction_id', txnIds);

  // 4. Get SKU + model info for each serial
  const serialNumbers = (items || []).map((i: any) => i.serial_number);
  let unitMap = new Map<string, { sku: string }>();
  if (serialNumbers.length > 0) {
    const { data: units } = await supabase
      .from('inventory_units')
      .select('serial_number, sku')
      .in('serial_number', serialNumbers);
    unitMap = new Map((units || []).map((u: any) => [u.serial_number, { sku: u.sku }]));
  }

  // Get product details for all involved SKUs
  const allSkus = [...new Set(Array.from(unitMap.values()).map((u) => u.sku))];
  let productMap = new Map<string, { model_name: string; cost_price: number | null; retail_price: number | null }>();
  if (allSkus.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('sku, model_name, cost_price, retail_price')
      .in('sku', allSkus);
    productMap = new Map(
      (products || []).map((p: any) => [p.sku, { model_name: p.model_name, cost_price: p.cost_price, retail_price: p.retail_price }])
    );
  }

  // 5. Group items by transaction
  const itemsByTxn = new Map<string, any[]>();
  for (const item of items || []) {
    const arr = itemsByTxn.get(item.transaction_id) || [];
    arr.push(item);
    itemsByTxn.set(item.transaction_id, arr);
  }

  // 6. Build SaleRecord objects
  const records: SaleRecord[] = transactions.map((txn: any) => {
    const txnItems = itemsByTxn.get(txn.id) || [];

    const saleItems = txnItems.map((item: any) => {
      const unit = unitMap.get(item.serial_number);
      const product = unit ? productMap.get(unit.sku) : null;
      return {
        serial_number: item.serial_number,
        sku: unit?.sku || 'UNKNOWN',
        model_name: product?.model_name || 'Unknown',
        sale_price: item.sale_price,
        cost_price: item.purchase_price ?? product?.cost_price ?? null,
      };
    });

    const totalSale = saleItems.reduce((sum: number, i: any) => sum + (i.sale_price || 0), 0);
    const totalCost = saleItems.reduce((sum: number, i: any) => sum + (i.cost_price || 0), 0);

    return {
      transaction_id: txn.id,
      tracking_number: txn.tracking_number,
      route: txn.route as 'B2B' | 'B2C',
      customer_name: txn.customer_name,
      created_at: txn.created_at,
      verified: txn.verified,
      user_name: profileMap.get(txn.user_id) || 'Unknown',
      items: saleItems,
      total_sale: totalSale,
      total_cost: totalCost,
      profit: totalSale - totalCost,
    };
  });

  // If filtering by SKU, filter out transactions that don't contain that SKU
  let filtered = records;
  if (filters?.sku) {
    filtered = records.filter((r) =>
      r.items.some((i) => i.sku.toUpperCase() === filters.sku!.toUpperCase())
    );
  }

  return { data: filtered, total: count || 0, error: null };
}

// ── Sales summary statistics for KPI cards ────────────────────
export async function getSalesSummaryStats(filters?: {
  from_date?: string;
  to_date?: string;
  route?: 'B2B' | 'B2C';
}): Promise<{
  data: {
    total_revenue: number;
    total_cost: number;
    gross_profit: number;
    profit_margin: number;
    units_sold: number;
    transaction_count: number;
  };
  error: string | null;
}> {
  const supabase = await createClient();

  // Get matching transaction IDs
  let query = supabase
    .from('transactions')
    .select('id')
    .eq('type', 'OUTBOUND')
    .in('route', filters?.route ? [filters.route] : ['B2B', 'B2C']);

  if (filters?.from_date) query = query.gte('created_at', filters.from_date);
  if (filters?.to_date) query = query.lte('created_at', filters.to_date);

  const { data: transactions, error: txnError } = await query;

  if (txnError) {
    return {
      data: { total_revenue: 0, total_cost: 0, gross_profit: 0, profit_margin: 0, units_sold: 0, transaction_count: 0 },
      error: txnError.message,
    };
  }

  if (!transactions || transactions.length === 0) {
    return {
      data: { total_revenue: 0, total_cost: 0, gross_profit: 0, profit_margin: 0, units_sold: 0, transaction_count: 0 },
      error: null,
    };
  }

  const txnIds = transactions.map((t: any) => t.id);

  // Get all transaction items with prices
  const { data: items } = await supabase
    .from('transaction_items')
    .select('serial_number, sale_price, purchase_price')
    .in('transaction_id', txnIds);

  // For items without purchase_price, try to get cost_price from products
  const serialNumbers = (items || []).filter((i: any) => i.purchase_price == null).map((i: any) => i.serial_number);
  let costFallbackMap = new Map<string, number>();

  if (serialNumbers.length > 0) {
    const { data: units } = await supabase
      .from('inventory_units')
      .select('serial_number, sku')
      .in('serial_number', serialNumbers);

    if (units && units.length > 0) {
      const skus = [...new Set(units.map((u: any) => u.sku))];
      const { data: products } = await supabase
        .from('products')
        .select('sku, cost_price')
        .in('sku', skus);

      const skuCostMap = new Map((products || []).map((p: any) => [p.sku, p.cost_price]));
      for (const unit of units) {
        const cost = skuCostMap.get(unit.sku);
        if (cost != null) costFallbackMap.set(unit.serial_number, cost);
      }
    }
  }

  let totalRevenue = 0;
  let totalCost = 0;
  const unitsSold = (items || []).length;

  for (const item of items || []) {
    totalRevenue += item.sale_price || 0;
    totalCost += item.purchase_price ?? costFallbackMap.get(item.serial_number) ?? 0;
  }

  const grossProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return {
    data: {
      total_revenue: totalRevenue,
      total_cost: totalCost,
      gross_profit: grossProfit,
      profit_margin: Math.round(profitMargin * 10) / 10,
      units_sold: unitsSold,
      transaction_count: transactions.length,
    },
    error: null,
  };
}

// ── Update a sale price on a specific transaction item ─────────
export async function updateSalePrice(data: {
  transaction_id: string;
  serial_number: string;
  new_price: number;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();

  if (data.new_price < 0) {
    return { error: 'Price cannot be negative' };
  }

  const { error } = await supabase
    .from('transaction_items')
    .update({ sale_price: data.new_price })
    .eq('transaction_id', data.transaction_id)
    .eq('serial_number', data.serial_number);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// ── Batch update sale prices for multiple serials in a transaction
export async function batchUpdateSalePrices(data: {
  transaction_id: string;
  serial_numbers: string[];
  unit_price: number;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();

  if (data.unit_price < 0) {
    return { error: 'Price cannot be negative' };
  }

  if (!data.serial_numbers || data.serial_numbers.length === 0) {
    return { error: 'No serial numbers provided' };
  }

  const { error } = await supabase
    .from('transaction_items')
    .update({ sale_price: data.unit_price })
    .eq('transaction_id', data.transaction_id)
    .in('serial_number', data.serial_numbers);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// ── Export sales data as CSV string ───────────────────────────
export async function exportSalesCSV(filters?: {
  from_date?: string;
  to_date?: string;
  route?: 'B2B' | 'B2C';
}): Promise<{ csv: string; error: string | null }> {
  const result = await getSales({ ...filters, limit: 10000, offset: 0 });

  if (result.error) {
    return { csv: '', error: result.error };
  }

  const headers = ['Date', 'Tracking #', 'Route', 'Customer', 'Serial Number', 'SKU', 'Model', 'Sale Price (₦)', 'Cost Price (₦)', 'Profit (₦)'];
  const rows: string[] = [headers.join(',')];

  for (const sale of result.data) {
    for (const item of sale.items) {
      const salePrice = item.sale_price ?? 0;
      const costPrice = item.cost_price ?? 0;
      rows.push([
        new Date(sale.created_at).toLocaleDateString('en-GB'),
        sale.tracking_number || '',
        sale.route,
        `"${(sale.customer_name || '').replace(/"/g, '""')}"`,
        item.serial_number,
        item.sku,
        `"${item.model_name.replace(/"/g, '""')}"`,
        salePrice.toFixed(2),
        costPrice.toFixed(2),
        (salePrice - costPrice).toFixed(2),
      ].join(','));
    }
  }

  return { csv: rows.join('\n'), error: null };
}
