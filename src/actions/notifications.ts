'use server';

// ============================================================
// PSMI System — Notifications Server Action
// ============================================================
// Aggregates operational notifications:
// 1. Issues / Alerts (Low stock thresholds & unverified sales orders)
// 2. Inbound Onboardings (New shipments received or completed)
// 3. Sales Conversions (Outbound orders verified and turned to sales)
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type NotificationType = 'ALERT' | 'INBOUND' | 'SALE_VERIFIED';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string;
  linkUrl: string;
  metadata?: Record<string, any>;
  severity?: 'critical' | 'warning' | 'info' | 'success';
}

export async function getSystemNotifications(): Promise<{
  data: AppNotification[];
  error: string | null;
}> {
  try {
    let supabase: any;
    try {
      supabase = createAdminClient();
    } catch {
      supabase = await createClient();
    }

    const notifications: AppNotification[] = [];

    // 1. Fetch Inbound transactions (Recent onboardings)
    const { data: recentInbounds } = await supabase
      .from('transactions')
      .select(`
        id,
        tracking_number,
        created_at,
        notes,
        from_location_id,
        to_location_id,
        to_loc:locations!to_location_id(name),
        transaction_items(count)
      `)
      .eq('type', 'INBOUND')
      .order('created_at', { ascending: false })
      .limit(8);

    if (recentInbounds) {
      for (const ib of recentInbounds) {
        const itemCount = ib.transaction_items?.[0]?.count || 0;
        notifications.push({
          id: `inbound-${ib.id}`,
          type: 'INBOUND',
          title: 'New Inbound Onboarded',
          description: `${itemCount} unit(s) onboarded to ${ib.to_loc?.name || 'Warehouse'} (${ib.tracking_number || 'Batch'})`,
          timestamp: ib.created_at,
          linkUrl: `/inbound`,
          severity: 'info',
        });
      }
    }

    // 2. Fetch Verified Sales (Outbound B2B/B2C that were verified and converted to sales)
    const { data: verifiedSales } = await supabase
      .from('transactions')
      .select(`
        id,
        tracking_number,
        customer_name,
        route,
        sold_at,
        created_at,
        total_order_amount,
        transaction_items(count)
      `)
      .eq('type', 'OUTBOUND')
      .eq('verified', true)
      .in('route', ['B2B', 'B2C'])
      .order('created_at', { ascending: false })
      .limit(8);

    if (verifiedSales) {
      for (const sale of verifiedSales) {
        const units = sale.transaction_items?.[0]?.count || 0;
        notifications.push({
          id: `sale-${sale.id}`,
          type: 'SALE_VERIFIED',
          title: 'Order Verified & Turned to Sale',
          description: `${sale.customer_name || 'Customer'} • ${units} unit(s) verified as SOLD (${sale.route})`,
          timestamp: sale.sold_at || sale.created_at,
          linkUrl: `/sales`,
          severity: 'success',
        });
      }
    }

    // 3. Fetch Issues / Low Stock Alerts
    const { data: lowStockProducts } = await supabase
      .from('products')
      .select('sku, model_name, reorder_threshold')
      .gt('reorder_threshold', 0)
      .limit(20);

    if (lowStockProducts && lowStockProducts.length > 0) {
      const skus = lowStockProducts.map((p: any) => p.sku);
      const { data: units } = await supabase
        .from('inventory_units')
        .select('sku')
        .in('sku', skus)
        .in('status', ['IN_WAREHOUSE', 'IN_BRANCH']);

      const counts: Record<string, number> = {};
      (units || []).forEach((u: any) => {
        counts[u.sku] = (counts[u.sku] || 0) + 1;
      });

      for (const prod of lowStockProducts) {
        const count = counts[prod.sku] || 0;
        if (count <= prod.reorder_threshold) {
          notifications.push({
            id: `low-stock-${prod.sku}`,
            type: 'ALERT',
            title: 'Low Stock Alert',
            description: `${prod.model_name} (${prod.sku}) is at ${count} units (Threshold: ${prod.reorder_threshold})`,
            timestamp: new Date().toISOString(),
            linkUrl: `/inventory/${prod.sku}`,
            severity: count === 0 ? 'critical' : 'warning',
          });
        }
      }
    }

    // 4. Fetch Issues / Pending Waybill Outbounds awaiting verification
    const { data: pendingSales } = await supabase
      .from('transactions')
      .select(`
        id,
        tracking_number,
        customer_name,
        created_at
      `)
      .eq('type', 'OUTBOUND')
      .eq('verified', false)
      .in('route', ['B2B', 'B2C'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (pendingSales) {
      for (const ps of pendingSales) {
        notifications.push({
          id: `pending-waybill-${ps.id}`,
          type: 'ALERT',
          title: 'Action Required: Waybill Pending',
          description: `Dispatch ${ps.tracking_number || ps.id.slice(0, 8)} for ${ps.customer_name || 'Customer'} requires document verification.`,
          timestamp: ps.created_at,
          linkUrl: `/outbound`,
          severity: 'warning',
        });
      }
    }

    // Sort combined notifications newest first
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { data: notifications.slice(0, 25), error: null };
  } catch (err: any) {
    return { data: [], error: err.message || 'Failed to fetch notifications' };
  }
}
