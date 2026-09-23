'use server';

// ============================================================
// PSMI System — Sales Server Actions
// ============================================================
// Queries, aggregation, and price editing for the Sales page.
// Sales = outbound transactions with route B2B or B2C.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SaleRecord } from '@/lib/types/database';
import { revalidatePath } from 'next/cache';

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
  // Query with sold_at prioritizing the actual date of sale; fallback gracefully if schema requires
  const buildQuery = (selectFields: string, useSoldAt: boolean = true) => {
    let q = supabase
      .from('transactions')
      .select(selectFields, { count: 'exact' })
      .eq('type', 'OUTBOUND')
      .eq('verified', true)
      .in('route', filters?.route ? [filters.route] : ['B2B', 'B2C']);

    if (useSoldAt) {
      q = q.order('sold_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
      if (filters?.from_date && filters?.to_date) {
        q = q.or(`and(sold_at.gte.${filters.from_date},sold_at.lte.${filters.to_date}),and(sold_at.is.null,created_at.gte.${filters.from_date},created_at.lte.${filters.to_date})`);
      } else if (filters?.from_date) {
        q = q.or(`sold_at.gte.${filters.from_date},and(sold_at.is.null,created_at.gte.${filters.from_date})`);
      } else if (filters?.to_date) {
        q = q.or(`sold_at.lte.${filters.to_date},and(sold_at.is.null,created_at.lte.${filters.to_date})`);
      }
    } else {
      q = q.order('created_at', { ascending: false });
      if (filters?.from_date) q = q.gte('created_at', filters.from_date);
      if (filters?.to_date) q = q.lte('created_at', filters.to_date);
    }

    if (filters?.search) {
      q = q.or(`customer_name.ilike.%${filters.search}%,tracking_number.ilike.%${filters.search}%,sales_manager.ilike.%${filters.search}%`);
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    return q.range(offset, offset + limit - 1);
  };

  const baseFields = 'id, tracking_number, route, customer_name, sales_manager, created_at, verified, user_id, notes';
  const extendedFields = `${baseFields}, sold_at, amount_paid, payment_status, total_order_amount, total_units_ordered`;

  let { data: transactions, count, error: txnError } = await buildQuery(extendedFields, true);

  // If new columns or sold_at don't exist yet, fallback gracefully
  if (txnError && (
    txnError.message?.includes('amount_paid') ||
    txnError.message?.includes('payment_status') ||
    txnError.message?.includes('total_order_amount') ||
    txnError.message?.includes('total_units_ordered') ||
    txnError.message?.includes('sold_at')
  )) {
    // Try with sold_at first
    let fallbackRes = await buildQuery(`${baseFields}, sold_at`, true);
    if (fallbackRes.error && fallbackRes.error.message?.includes('sold_at')) {
      fallbackRes = await buildQuery(baseFields, false);
    }
    transactions = fallbackRes.data;
    count = fallbackRes.count;
    txnError = fallbackRes.error;
  }

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
      sales_manager: txn.sales_manager || null,
      sold_at: txn.sold_at || null,
      created_at: txn.created_at,
      verified: txn.verified,
      user_name: profileMap.get(txn.user_id) || 'Unknown',
      notes: txn.notes || null,
      amount_paid: txn.amount_paid != null ? Number(txn.amount_paid) : (txn.verified ? totalSale : null),
      payment_status: (txn.payment_status || (txn.verified ? 'PAID' : 'PENDING')) as 'PAID' | 'PARTIAL' | 'PENDING',
      total_order_amount: txn.total_order_amount != null ? Number(txn.total_order_amount) : totalSale,
      total_units_ordered: txn.total_units_ordered != null ? Number(txn.total_units_ordered) : saleItems.length,
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
    cash_collected: number;
    balance_due: number;
  };
  error: string | null;
}> {
  const supabase = await createClient();

  // Get matching transactions with financial details
  let query = supabase
    .from('transactions')
    .select('id, verified, sold_at, created_at, amount_paid, total_order_amount')
    .eq('type', 'OUTBOUND')
    .eq('verified', true)
    .in('route', filters?.route ? [filters.route] : ['B2B', 'B2C']);

  if (filters?.from_date && filters?.to_date) {
    query = query.or(`and(sold_at.gte.${filters.from_date},sold_at.lte.${filters.to_date}),and(sold_at.is.null,created_at.gte.${filters.from_date},created_at.lte.${filters.to_date})`);
  } else if (filters?.from_date) {
    query = query.or(`sold_at.gte.${filters.from_date},and(sold_at.is.null,created_at.gte.${filters.from_date})`);
  } else if (filters?.to_date) {
    query = query.or(`sold_at.lte.${filters.to_date},and(sold_at.is.null,created_at.lte.${filters.to_date})`);
  }

  let { data: transactions, error: txnError } = await query;

  // Fallback if columns are not yet recognized in cache
  if (txnError && (txnError.message?.includes('amount_paid') || txnError.message?.includes('total_order_amount') || txnError.message?.includes('sold_at'))) {
    let fallbackQuery = supabase
      .from('transactions')
      .select('id, verified')
      .eq('type', 'OUTBOUND')
      .eq('verified', true)
      .in('route', filters?.route ? [filters.route] : ['B2B', 'B2C']);
    if (filters?.from_date) fallbackQuery = fallbackQuery.gte('created_at', filters.from_date);
    if (filters?.to_date) fallbackQuery = fallbackQuery.lte('created_at', filters.to_date);
    const fallbackRes = await fallbackQuery;
    transactions = fallbackRes.data as any;
    txnError = fallbackRes.error;
  }

  if (txnError) {
    return {
      data: {
        total_revenue: 0,
        total_cost: 0,
        gross_profit: 0,
        profit_margin: 0,
        units_sold: 0,
        transaction_count: 0,
        cash_collected: 0,
        balance_due: 0,
      },
      error: txnError.message,
    };
  }

  if (!transactions || transactions.length === 0) {
    return {
      data: {
        total_revenue: 0,
        total_cost: 0,
        gross_profit: 0,
        profit_margin: 0,
        units_sold: 0,
        transaction_count: 0,
        cash_collected: 0,
        balance_due: 0,
      },
      error: null,
    };
  }

  const txnIds = transactions.map((t: any) => t.id);

  // Get all transaction items with prices
  const { data: items } = await supabase
    .from('transaction_items')
    .select('transaction_id, serial_number, sale_price, purchase_price')
    .in('transaction_id', txnIds);

  // Group items by transaction to compute fallback agreed totals
  const itemsByTxn = new Map<string, any[]>();
  for (const item of items || []) {
    const arr = itemsByTxn.get(item.transaction_id) || [];
    arr.push(item);
    itemsByTxn.set(item.transaction_id, arr);
  }

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
  let cashCollected = 0;
  let balanceDue = 0;
  const unitsSold = (items || []).length;

  for (const item of items || []) {
    totalRevenue += item.sale_price || 0;
    totalCost += item.purchase_price ?? costFallbackMap.get(item.serial_number) ?? 0;
  }

  // Calculate Cash Collected and Balance Due per transaction
  for (const txn of transactions) {
    const txnItems = itemsByTxn.get(txn.id) || [];
    const itemsTotal = txnItems.reduce((sum: number, i: any) => sum + (i.sale_price || 0), 0);
    const dealTotal = txn.total_order_amount != null ? Number(txn.total_order_amount) : itemsTotal;
    const paid = txn.amount_paid != null ? Number(txn.amount_paid) : (txn.verified ? dealTotal : 0);

    cashCollected += paid;
    if (dealTotal > paid) {
      balanceDue += (dealTotal - paid);
    }
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
      cash_collected: cashCollected,
      balance_due: balanceDue,
    },
    error: null,
  };
}

// ── Time-series data bucket for Sales vs Time Chart ──────────
export interface SalesTimeSeriesPoint {
  key: string;            // unique key (e.g. "2026-09-20", "Sun", "Day 1")
  label: string;          // Primary X-axis label ("Sun 20", "Sep 20", "08:00")
  shortLabel: string;     // Compact X-axis label ("Sun", "20", "08h")
  subLabel?: string;      // Supporting contextual note ("Today", "Upcoming", etc.)
  dateStr: string;        // ISO date representation YYYY-MM-DD
  amount: number;         // Total sales amount in Naira
  unitsCount: number;     // Units of products sold
  txnCount: number;       // Number of sales transactions
  isCurrent?: boolean;    // Is this point today / current period
  isFuture?: boolean;     // Is this point in the future (for upcoming week days)
  topProduct?: string;    // Top selling product model in this slot
}

export async function getSalesTimeSeries(params: {
  from_date?: string;
  to_date?: string;
  route?: 'B2B' | 'B2C';
  filter_mode: 'week' | 'month' | 'today' | 'date_range' | 'preset';
}): Promise<{
  data: SalesTimeSeriesPoint[];
  period_total: number;
  period_units: number;
  period_txns: number;
  average_per_bucket: number;
  peak_bucket: { label: string; amount: number } | null;
  error: string | null;
}> {
  const supabase = await createClient();

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  // 1. Query outbound verified transactions in the range
  // Determine date bounds: prioritize sold_at (actual date of sale) over created_at
  const queryFrom = params.from_date;
  const queryTo = params.to_date;

  let query = supabase
    .from('transactions')
    .select('id, created_at, sold_at, amount_paid, total_order_amount')
    .eq('type', 'OUTBOUND')
    .eq('verified', true)
    .in('route', params.route ? [params.route] : ['B2B', 'B2C'])
    .order('sold_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (queryFrom && queryTo) {
    query = query.or(`and(sold_at.gte.${queryFrom},sold_at.lte.${queryTo}),and(sold_at.is.null,created_at.gte.${queryFrom},created_at.lte.${queryTo})`);
  } else if (queryFrom) {
    query = query.or(`sold_at.gte.${queryFrom},and(sold_at.is.null,created_at.gte.${queryFrom})`);
  } else if (queryTo) {
    query = query.or(`sold_at.lte.${queryTo},and(sold_at.is.null,created_at.lte.${queryTo})`);
  }

  let { data: transactions, error: txnError } = await query;

  // Fallback if extended fields fail
  if (txnError && (txnError.message?.includes('amount_paid') || txnError.message?.includes('total_order_amount') || txnError.message?.includes('sold_at'))) {
    let fallbackQuery = supabase
      .from('transactions')
      .select('id, created_at')
      .eq('type', 'OUTBOUND')
      .eq('verified', true)
      .in('route', params.route ? [params.route] : ['B2B', 'B2C'])
      .order('created_at', { ascending: true });
    if (queryFrom) fallbackQuery = fallbackQuery.gte('created_at', queryFrom);
    if (queryTo) fallbackQuery = fallbackQuery.lte('created_at', queryTo);
    const fallbackRes = await fallbackQuery;
    transactions = fallbackRes.data as any;
    txnError = fallbackRes.error;
  }

  if (txnError) {
    return {
      data: [],
      period_total: 0,
      period_units: 0,
      period_txns: 0,
      average_per_bucket: 0,
      peak_bucket: null,
      error: txnError.message,
    };
  }

  const txns = transactions || [];
  const txnIds = txns.map((t: any) => t.id);

  // 2. Fetch items for price and product details
  let items: any[] = [];
  if (txnIds.length > 0) {
    const { data: rawItems } = await supabase
      .from('transaction_items')
      .select('transaction_id, serial_number, sale_price')
      .in('transaction_id', txnIds);
    items = rawItems || [];
  }

  // Map serial numbers to SKU and products
  const serialNumbers = items.map((i) => i.serial_number);
  let unitMap = new Map<string, string>(); // serial -> sku
  let productMap = new Map<string, string>(); // sku -> model_name
  if (serialNumbers.length > 0) {
    const { data: units } = await supabase
      .from('inventory_units')
      .select('serial_number, sku')
      .in('serial_number', serialNumbers);
    (units || []).forEach((u: any) => unitMap.set(u.serial_number, u.sku));

    const skus = [...new Set(Array.from(unitMap.values()))];
    if (skus.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('sku, model_name')
        .in('sku', skus);
      (products || []).forEach((p: any) => productMap.set(p.sku, p.model_name));
    }
  }

  // Group items & calculate deal total per transaction
  const itemsByTxn = new Map<string, any[]>();
  for (const item of items) {
    const arr = itemsByTxn.get(item.transaction_id) || [];
    arr.push(item);
    itemsByTxn.set(item.transaction_id, arr);
  }

  // 3. Build time buckets depending on filter_mode (strictly by DATE)
  let buckets: SalesTimeSeriesPoint[] = [];

  if (params.filter_mode === 'week' || params.filter_mode === 'today') {
    // Week ALWAYS starts on Sunday
    const currentDay = now.getDay(); // 0 is Sunday, 6 is Saturday
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - currentDay);
    sunday.setHours(0, 0, 0, 0);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(sunday);
      dayDate.setDate(sunday.getDate() + i);
      const iso = dayDate.toISOString().slice(0, 10);
      const isToday = iso === todayIso;
      const isFuture = dayDate > now && !isToday;

      buckets.push({
        key: iso,
        label: `${dayNames[i]} (${dayDate.getDate()})`,
        shortLabel: dayNames[i],
        subLabel: isToday ? 'Today' : (isFuture ? 'Upcoming' : undefined),
        dateStr: iso,
        amount: 0,
        unitsCount: 0,
        txnCount: 0,
        isCurrent: isToday,
        isFuture,
      });
    }
  } else if (params.filter_mode === 'month') {
    // Current calendar month (1st to last day of month)
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[month];

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(year, month, d);
      const iso = dayDate.toISOString().slice(0, 10);
      const isToday = iso === todayIso;
      const isFuture = dayDate > now && !isToday;

      buckets.push({
        key: iso,
        label: `${monthName} ${d}`,
        shortLabel: `${d}`,
        subLabel: isToday ? 'Today' : (isFuture ? 'Upcoming' : undefined),
        dateStr: iso,
        amount: 0,
        unitsCount: 0,
        txnCount: 0,
        isCurrent: isToday,
        isFuture,
      });
    }
  } else {
    // Custom date range or rolling preset (7d, 30d, 90d, all)
    // Generate daily buckets across the span
    const from = params.from_date ? new Date(params.from_date) : new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    const to = params.to_date ? new Date(params.to_date) : now;
    
    // Normalize to dates
    const startDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const endDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    const diffDays = Math.max(1, Math.min(60, Math.round((endDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000)) + 1));

    for (let i = 0; i < diffDays; i++) {
      const d = new Date(startDay);
      d.setDate(startDay.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const isToday = iso === todayIso;
      buckets.push({
        key: iso,
        label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        shortLabel: `${d.getDate()}`,
        subLabel: isToday ? 'Today' : undefined,
        dateStr: iso,
        amount: 0,
        unitsCount: 0,
        txnCount: 0,
        isCurrent: isToday,
      });
    }
  }

  // 4. Map transactions into buckets using date of sale (sold_at)
  const bucketMap = new Map(buckets.map((b) => [b.key, b]));
  const bucketProductsMap = new Map<string, Map<string, number>>();

  for (const txn of txns) {
    // Date of Sale (sold_at) takes precedence over created_at
    const rawDate = txn.sold_at || txn.created_at;
    let targetBucketKey = '';
    if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
      targetBucketKey = rawDate.slice(0, 10);
    } else if (rawDate) {
      try {
        targetBucketKey = new Date(rawDate).toISOString().slice(0, 10);
      } catch {}
    }

    const bucket = bucketMap.get(targetBucketKey);
    if (bucket) {
      const txnItems = itemsByTxn.get(txn.id) || [];
      const itemsTotal = txnItems.reduce((sum: number, i: any) => sum + (i.sale_price || 0), 0);
      const dealTotal = txn.total_order_amount != null ? Number(txn.total_order_amount) : itemsTotal;

      bucket.amount += dealTotal;
      bucket.unitsCount += txnItems.length;
      bucket.txnCount += 1;

      // Track product models in this bucket
      let productCounter = bucketProductsMap.get(bucket.key);
      if (!productCounter) {
        productCounter = new Map<string, number>();
        bucketProductsMap.set(bucket.key, productCounter);
      }
      for (const item of txnItems) {
        const sku = unitMap.get(item.serial_number);
        const model = sku ? (productMap.get(sku) || sku) : 'Unknown';
        productCounter.set(model, (productCounter.get(model) || 0) + 1);
      }
    }
  }

  // Populate top product per bucket
  for (const bucket of buckets) {
    const pMap = bucketProductsMap.get(bucket.key);
    if (pMap && pMap.size > 0) {
      let topName = '';
      let topCount = 0;
      for (const [name, count] of pMap.entries()) {
        if (count > topCount) {
          topCount = count;
          topName = name;
        }
      }
      bucket.topProduct = `${topName} (${topCount})`;
    }
  }

  const periodTotal = buckets.reduce((acc, b) => acc + b.amount, 0);
  const periodUnits = buckets.reduce((acc, b) => acc + b.unitsCount, 0);
  const periodTxns = buckets.reduce((acc, b) => acc + b.txnCount, 0);
  const activeBucketsCount = buckets.filter((b) => !b.isFuture).length || 1;
  const avgPerBucket = Math.round(periodTotal / activeBucketsCount);

  let peakBucket: { label: string; amount: number } | null = null;
  for (const b of buckets) {
    if (!peakBucket || b.amount > peakBucket.amount) {
      if (b.amount > 0) {
        peakBucket = { label: b.label, amount: b.amount };
      }
    }
  }

  return {
    data: buckets,
    period_total: periodTotal,
    period_units: periodUnits,
    period_txns: periodTxns,
    average_per_bucket: avgPerBucket,
    peak_bucket: peakBucket,
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

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role === 'VIEWER') {
      return { error: 'Permission denied: View-only accounts cannot edit sale prices.' };
    }
  }

  if (data.new_price < 0) {
    return { error: 'Price cannot be negative' };
  }

  // Ensure outbound is verified before modifying sales prices
  const { data: txn } = await supabase
    .from('transactions')
    .select('verified')
    .eq('id', data.transaction_id)
    .single();

  if (!txn || !txn.verified) {
    return { error: 'Invalid action: Sales pricing cannot be modified until the outbound has been verified.' };
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

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role === 'VIEWER') {
      return { error: 'Permission denied: View-only accounts cannot edit sale prices.' };
    }
  }

  if (data.unit_price < 0) {
    return { error: 'Price cannot be negative' };
  }

  if (!data.serial_numbers || data.serial_numbers.length === 0) {
    return { error: 'No serial numbers provided' };
  }

  // Ensure outbound is verified before modifying sales prices
  const { data: txn } = await supabase
    .from('transactions')
    .select('verified')
    .eq('id', data.transaction_id)
    .single();

  if (!txn || !txn.verified) {
    return { error: 'Invalid action: Sales pricing cannot be modified until the outbound has been verified.' };
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

// ── Update transaction Date of Sale (sold_at) ──────────────────
export async function updateSaleDate(data: {
  transaction_id: string;
  sold_at: string;
}): Promise<{ error: string | null }> {
  let supabase: any;
  try {
    supabase = createAdminClient();
  } catch {
    supabase = await createClient();
  }

  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (user) {
    const { data: profile } = await authClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role === 'VIEWER') {
      return { error: 'Permission denied: View-only accounts cannot edit date of sale.' };
    }
  }

  if (!data.sold_at) {
    return { error: 'Date of sale is required.' };
  }

  const dateValue = new Date(data.sold_at).toISOString();

  const { error } = await supabase
    .from('transactions')
    .update({ sold_at: dateValue })
    .eq('id', data.transaction_id);

  if (error) {
    return { error: error.message };
  }

  try {
    revalidatePath('/sales');
    revalidatePath('/outbound');
  } catch {}

  return { error: null };
}

// ── Update transaction Notes ──────────────────────────────────
export async function updateSaleNotes(data: {
  transaction_id: string;
  notes: string;
}): Promise<{ error: string | null }> {
  let supabase: any;
  try {
    supabase = createAdminClient();
  } catch {
    supabase = await createClient();
  }

  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (user) {
    const { data: profile } = await authClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role === 'VIEWER') {
      return { error: 'Permission denied: View-only accounts cannot edit notes.' };
    }
  }

  const { error } = await supabase
    .from('transactions')
    .update({ notes: data.notes?.trim() || null })
    .eq('id', data.transaction_id);

  if (error) {
    return { error: error.message };
  }

  try {
    revalidatePath('/sales');
    revalidatePath('/outbound');
  } catch {}

  return { error: null };
}

// ── Update transaction Payment & Installment (ADMIN ONLY) ─────
export async function updateSalePayment(data: {
  transaction_id: string;
  amount_paid: number | null;
  payment_status: 'PAID' | 'PARTIAL' | 'PENDING';
  total_order_amount?: number | null;
  total_units_ordered?: number | null;
  notes?: string;
}): Promise<{ error: string | null }> {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user) {
    return { error: 'Authentication required.' };
  }

  // Strict Admin Role Check
  const { data: profile } = await authClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'ADMIN') {
    return { error: 'Permission denied: Only administrators can edit payment and installment records.' };
  }

  let adminSupabase: any;
  try {
    adminSupabase = createAdminClient();
  } catch {
    adminSupabase = authClient;
  }

  const updatePayload: Record<string, any> = {
    payment_status: data.payment_status,
  };

  if (data.amount_paid !== undefined) {
    updatePayload.amount_paid = data.amount_paid;
  }
  if (data.total_order_amount !== undefined) {
    updatePayload.total_order_amount = data.total_order_amount;
  }
  if (data.total_units_ordered !== undefined) {
    updatePayload.total_units_ordered = data.total_units_ordered;
  }
  if (data.notes !== undefined) {
    updatePayload.notes = data.notes?.trim() || null;
  }

  // If status is PAID, also ensure verified can reflect if appropriate
  if (data.payment_status === 'PAID') {
    updatePayload.verified = true;
  }

  const { error } = await adminSupabase
    .from('transactions')
    .update(updatePayload)
    .eq('id', data.transaction_id);

  if (error) {
    // If column doesn't exist yet in Supabase schema cache, provide clear message
    if (error.message?.includes('amount_paid') || error.message?.includes('payment_status')) {
      // Fallback update notes and verified if new columns are not yet applied via SQL migration
      const fallbackPayload: Record<string, any> = {};
      if (data.notes !== undefined) fallbackPayload.notes = data.notes?.trim() || null;
      if (data.payment_status === 'PAID') fallbackPayload.verified = true;
      if (Object.keys(fallbackPayload).length > 0) {
        await adminSupabase.from('transactions').update(fallbackPayload).eq('id', data.transaction_id);
      }
      return {
        error: 'Database migration pending: Please run add_sales_installments_and_payments.sql in your Supabase SQL editor to save installment columns. Notes were updated.',
      };
    }
    return { error: error.message };
  }

  try {
    revalidatePath('/sales');
    revalidatePath('/outbound');
  } catch {}

  return { error: null };
}

// ── Export sales data as CSV string ───────────────────────────
export async function exportSalesCSV(filters?: {
  from_date?: string;
  to_date?: string;
  route?: 'B2B' | 'B2C';
  search?: string;
}): Promise<{ csv: string; error: string | null }> {
  const result = await getSales({ ...filters, limit: 10000, offset: 0 });

  if (result.error) {
    return { csv: '', error: result.error };
  }

  const headers = [
    'Date of Sale',
    'Tracking #',
    'Route',
    'Customer',
    'Sales Manager',
    'Serial Number',
    'SKU',
    'Model',
    'Sale Price (₦)',
    'Cost Price (₦)',
    'Profit (₦)',
  ];
  const rows: string[] = [headers.join(',')];

  for (const sale of result.data) {
    const effectiveDate = sale.sold_at || sale.created_at;
    for (const item of sale.items) {
      const salePrice = item.sale_price ?? 0;
      const costPrice = item.cost_price ?? 0;
      rows.push([
        new Date(effectiveDate).toLocaleDateString('en-GB'),
        sale.tracking_number || '',
        sale.route,
        `"${(sale.customer_name || '').replace(/"/g, '""')}"`,
        `"${(sale.sales_manager || '').replace(/"/g, '""')}"`,
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

// ── Export sales data as formatted Excel (.xlsx) Table ────────
export async function exportSalesXLSX(filters?: {
  from_date?: string;
  to_date?: string;
  route?: 'B2B' | 'B2C';
  search?: string;
}): Promise<{ base64?: string; error: string | null }> {
  const result = await getSales({ ...filters, limit: 10000, offset: 0 });

  if (result.error) {
    return { error: result.error };
  }

  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.creator = 'PSMI Inventory & Sales';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Sales Data', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const tableRows: any[][] = [];

  for (const sale of result.data) {
    const effectiveDate = sale.sold_at || sale.created_at;
    for (const item of sale.items) {
      const salePrice = item.sale_price ?? 0;
      const costPrice = item.cost_price ?? 0;
      const profit = salePrice - costPrice;
      tableRows.push([
        new Date(effectiveDate).toLocaleDateString('en-GB'),
        sale.tracking_number || '—',
        sale.route,
        sale.customer_name || '—',
        sale.sales_manager || '—',
        item.serial_number,
        item.sku,
        item.model_name,
        salePrice,
        costPrice,
        profit,
      ]);
    }
  }

  const hasRows = tableRows.length > 0;
  const rowsToInsert = hasRows
    ? tableRows
    : [['—', '—', '—', '—', '—', '—', '—', '—', 0, 0, 0]];

  worksheet.addTable({
    name: 'SalesTable',
    ref: 'A1',
    headerRow: true,
    totalsRow: hasRows,
    style: {
      theme: 'TableStyleMedium9',
      showRowStripes: true,
    },
    columns: [
      { name: 'Date', filterButton: true, totalsRowLabel: 'Total' },
      { name: 'Tracking #', filterButton: true },
      { name: 'Route', filterButton: true },
      { name: 'Customer', filterButton: true },
      { name: 'Sales Manager', filterButton: true },
      { name: 'Serial Number', filterButton: true },
      { name: 'SKU', filterButton: true },
      { name: 'Model', filterButton: true },
      { name: 'Sale Price (₦)', filterButton: true, totalsRowFunction: 'sum' },
      { name: 'Cost Price (₦)', filterButton: true, totalsRowFunction: 'sum' },
      { name: 'Profit (₦)', filterButton: true, totalsRowFunction: 'sum' },
    ],
    rows: rowsToInsert,
  });

  // Number formatting for currency columns
  const rowCount = rowsToInsert.length + 1 + (hasRows ? 1 : 0);
  for (let r = 2; r <= rowCount; r++) {
    worksheet.getCell(`I${r}`).numFmt = '₦#,##0.00';
    worksheet.getCell(`J${r}`).numFmt = '₦#,##0.00';
    worksheet.getCell(`K${r}`).numFmt = '₦#,##0.00';
  }

  // Adjust column widths
  worksheet.columns = [
    { width: 14 }, // Date
    { width: 22 }, // Tracking #
    { width: 10 }, // Route
    { width: 28 }, // Customer
    { width: 20 }, // Sales Manager
    { width: 22 }, // Serial Number
    { width: 26 }, // SKU
    { width: 24 }, // Model
    { width: 18 }, // Sale Price
    { width: 18 }, // Cost Price
    { width: 18 }, // Profit
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  return { base64, error: null };
}
