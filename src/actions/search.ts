'use server';

// ============================================================
// PSMI System — Global Search Server Action
// ============================================================

import { createClient } from '@/lib/supabase/server';

export type GlobalSearchResultItem = {
  id: string;
  category: 'product' | 'serial' | 'order' | 'sale';
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  badgeColor?: string;
};

export type GlobalSearchResponse = {
  products: GlobalSearchResultItem[];
  serials: GlobalSearchResultItem[];
  orders: GlobalSearchResultItem[];
  totalCount: number;
};

export async function performGlobalSearch(rawQuery: string): Promise<GlobalSearchResponse> {
  const query = rawQuery.trim();
  const emptyResponse: GlobalSearchResponse = {
    products: [],
    serials: [],
    orders: [],
    totalCount: 0,
  };

  if (!query || query.length < 2) {
    return emptyResponse;
  }

  const supabase = (await createClient()) as any;

  try {
    // 1. Search Products / SKUs
    const productsPromise = supabase
      .from('products')
      .select('sku, model_name, category_badge, cost_price, retail_price')
      .or(`sku.ilike.%${query}%,model_name.ilike.%${query}%`)
      .limit(6);

    // 2. Search Serial Numbers
    const serialsPromise = supabase
      .from('inventory_units')
      .select('serial_number, sku, status, locations(name), products(model_name)')
      .ilike('serial_number', `%${query}%`)
      .limit(6);

    // 3. Search Transactions (Inbound, Outbound, Sales)
    const txnsPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('id, tracking_number, type, route, created_at, notes, customer_name, locations!to_location_id(name)')
          .or(`tracking_number.ilike.%${query}%,notes.ilike.%${query}%,customer_name.ilike.%${query}%`)
          .order('created_at', { ascending: false })
          .limit(8);

        if (!error && data) return data;

        // Fallback without customer_name if column not created yet
        const { data: fallbackData } = await supabase
          .from('transactions')
          .select('id, tracking_number, type, route, created_at, notes, locations!to_location_id(name)')
          .or(`tracking_number.ilike.%${query}%,notes.ilike.%${query}%`)
          .order('created_at', { ascending: false })
          .limit(8);

        return fallbackData || [];
      } catch {
        return [];
      }
    })();

    const [prodsRes, serialsRes, txnsData] = await Promise.all([
      productsPromise,
      serialsPromise,
      txnsPromise,
    ]);

    // Map Products
    const products: GlobalSearchResultItem[] = (prodsRes.data || []).map((p: any) => ({
      id: p.sku,
      category: 'product',
      title: p.model_name,
      subtitle: `SKU: ${p.sku}`,
      href: `/inventory/${encodeURIComponent(p.sku)}`,
      badge: p.category_badge === 'POWER_STATION' ? '⚡ Power Station'
           : p.category_badge === 'SHS' ? '☀️ SHS'
           : p.category_badge === 'ACCESSORIES' ? '🔌 Accessory'
           : 'SKU',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    }));

    // Map Serials
    const serials: GlobalSearchResultItem[] = (serialsRes.data || []).map((u: any) => {
      const model = u.products?.model_name || u.sku;
      const loc = u.locations?.name || 'Inventory';
      return {
        id: u.serial_number,
        category: 'serial',
        title: u.serial_number,
        subtitle: `${model} · Location: ${loc}`,
        href: `/inventory/${encodeURIComponent(u.sku)}`,
        badge: u.status ? u.status.replace(/_/g, ' ') : 'UNIT',
        badgeColor: u.status === 'IN_WAREHOUSE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : u.status === 'SOLD' ? 'bg-teal-50 text-teal-700 border-teal-200'
                  : u.status === 'RESERVED' || u.status === 'IN_TRANSIT' ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200',
      };
    });

    // Map Orders / Transactions
    const orders: GlobalSearchResultItem[] = (txnsData || []).map((t: any) => {
      const isOutbound = t.type === 'OUTBOUND';
      const tracking = t.tracking_number || t.id.slice(0, 8);
      const isSale = isOutbound && (t.route === 'B2B' || t.route === 'B2C');

      let dest = '';
      if (t.customer_name) {
        dest = `Customer: ${t.customer_name}`;
      } else if (t.locations?.name) {
        dest = `Dest: ${t.locations.name}`;
      } else {
        dest = isSale ? 'Direct Customer' : 'Internal Transfer';
      }

      return {
        id: t.id,
        category: isSale ? 'sale' : 'order',
        title: tracking,
        subtitle: `${t.type} ${t.route ? `(${t.route})` : ''} · ${dest}`,
        href: t.type === 'INBOUND' ? `/inbound/${t.id}` : isSale ? '/sales' : '/outbound',
        badge: t.type === 'INBOUND' ? 'INBOUND' : isSale ? 'SALE' : 'DISPATCH',
        badgeColor: t.type === 'INBOUND' ? 'bg-sky-50 text-sky-700 border-sky-200'
                  : isSale ? 'bg-violet-50 text-violet-700 border-violet-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200',
      };
    });

    const totalCount = products.length + serials.length + orders.length;

    return {
      products,
      serials,
      orders,
      totalCount,
    };
  } catch (err: any) {
    console.error('Global search error:', err);
    return emptyResponse;
  }
}
