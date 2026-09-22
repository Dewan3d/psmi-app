// ============================================================
// PSMI System — Total Inventory Cards Page
// ============================================================

import { getStockSummary } from '@/actions/inventory';
import { listProducts } from '@/actions/products';
import TotalInventoryClient from './TotalInventoryClient';

export default async function TotalInventoryPage() {
  const [stockResult, productsResult] = await Promise.all([
    getStockSummary(),
    listProducts(),
  ]);

  // Build a map of product image URLs keyed by SKU
  const imageMap: Record<string, string | null> = {};
  for (const p of productsResult.data || []) {
    imageMap[p.sku] = p.image_url || null;
  }

  return (
    <TotalInventoryClient
      initialStock={stockResult.data || []}
      imageMap={imageMap}
    />
  );
}
