// ============================================================
// PSMI System — Low Stock Alerts Cards Page
// ============================================================

import { getLowStockAlerts } from '@/actions/dashboard';
import { listProducts } from '@/actions/products';
import LowStockClient from './LowStockClient';

export default async function LowStockPage() {
  const [alertsResult, productsResult] = await Promise.all([
    getLowStockAlerts(),
    listProducts(),
  ]);

  // Build a map of product image URLs and model names keyed by SKU
  const productMap: Record<string, { image_url: string | null; model_name: string; category_badge: string }> = {};
  for (const p of productsResult.data || []) {
    productMap[p.sku] = {
      image_url: p.image_url || null,
      model_name: p.model_name,
      category_badge: p.category_badge || 'POWER_STATION',
    };
  }

  return (
    <LowStockClient
      alerts={alertsResult.data || []}
      productMap={productMap}
    />
  );
}
