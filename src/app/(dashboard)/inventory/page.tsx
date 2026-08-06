// ============================================================
// PSMI System — Inventory Catalogue Page
// ============================================================

import { getStockSummary } from '@/actions/inventory';
import InventoryCatalogueClient from './InventoryCatalogueClient';

export default async function InventoryPage() {
  const { data: stockSummary } = await getStockSummary();

  return (
    <InventoryCatalogueClient
      initialStockSummary={stockSummary || []}
    />
  );
}
