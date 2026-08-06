// ============================================================
// PSMI System — Product / Inventory Detail Page
// ============================================================

import { notFound } from 'next/navigation';
import { getProduct } from '@/actions/products';
import { getUnitsBySku } from '@/actions/inventory';
import SkuDetailClient from './SkuDetailClient';

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const decodedSku = decodeURIComponent(sku);

  // Fetch product and inventory units in parallel
  const [productResult, unitsResult] = await Promise.all([
    getProduct(decodedSku),
    getUnitsBySku(decodedSku),
  ]);

  if (productResult.error || !productResult.data) {
    notFound();
  }

  const product = productResult.data;
  const units = unitsResult.data || [];

  return (
    <SkuDetailClient
      initialProduct={product}
      initialUnits={units as any}
    />
  );
}
