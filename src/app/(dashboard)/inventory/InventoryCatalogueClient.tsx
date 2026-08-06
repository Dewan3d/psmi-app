'use client';

// ============================================================
// PSMI System — Inventory Catalogue Client Component
// ============================================================

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Barcode,
  Boxes,
  Eye,
  Plus,
  X,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { StockSummary } from '@/lib/types/database';
import { createProduct } from '@/actions/products';

export default function InventoryCatalogueClient({
  initialStockSummary,
}: {
  initialStockSummary: StockSummary[];
}) {
  const router = useRouter();
  const [stockSummary, setStockSummary] = useState<StockSummary[]>(initialStockSummary);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form states
  const [sku, setSku] = useState('');
  const [modelName, setModelName] = useState('');
  const [description, setDescription] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');
  const [isSerialized, setIsSerialized] = useState(true);
  const [barcode, setBarcode] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await createProduct({
        sku,
        model_name: modelName,
        description,
        low_stock_threshold: parseInt(lowStockThreshold, 10) || 10,
        is_serialized: isSerialized,
        barcode,
        image_url: imageUrl,
      });

      if (res.error) {
        setError(res.error);
      } else {
        setIsAddOpen(false);
        // Reset form
        setSku('');
        setModelName('');
        setDescription('');
        setBarcode('');
        setImageUrl('');
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Inventory Catalogue
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse active SKUs and track physical counts across locations.
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 rounded-xl text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add New Product
        </button>
      </div>

      {/* ── Content Grid ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            Stock Summary Table
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            {stockSummary.length} product(s) registered
          </span>
        </div>

        {stockSummary.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-slate-50 rounded-2xl mb-3">
              <Boxes className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-600">No products catalogued yet</p>
            <button
              onClick={() => setIsAddOpen(true)}
              className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              + Create your first SKU
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                    Model / Item Name
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                    SKU
                  </th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                    In Warehouse
                  </th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                    In Branch
                  </th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                    In Transit
                  </th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                    Reserved
                  </th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                    Total Available
                  </th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stockSummary.map((item) => {
                  const availableCount = item.in_warehouse + item.in_branch;
                  return (
                    <tr
                      key={item.sku}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            <Boxes className="w-4 h-4" />
                          </div>
                          <div>
                            <Link
                              href={`/inventory/${encodeURIComponent(item.sku)}`}
                              className="text-sm font-semibold text-slate-800 hover:text-indigo-600 transition-colors"
                            >
                              {item.model_name}
                            </Link>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 font-mono">
                          <Barcode className="w-3.5 h-3.5" />
                          {item.sku}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-semibold text-slate-700">
                          {item.in_warehouse}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-semibold text-slate-700">
                          {item.in_branch}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`text-sm font-semibold ${
                            item.in_transit > 0
                              ? 'text-blue-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {item.in_transit}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`text-sm font-semibold ${
                            item.reserved > 0
                              ? 'text-amber-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {item.reserved}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-bold text-slate-900">
                          {availableCount}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <Link
                          href={`/inventory/${encodeURIComponent(item.sku)}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Product Modal ───────────────────────────────────────── */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Create New Product SKU</h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-6 space-y-4">
              {error && (
                <div className="p-3 text-xs bg-red-50 text-red-600 rounded-xl border border-red-100">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PS-2000W"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 uppercase font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Model Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bluetti AC200P"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 2000Wh/2000W Portable Power Station"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Low Stock Alert Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Custom Barcode
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. EAN / UPC code"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Device Image URL
                </label>
                <div className="relative">
                  <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    placeholder="https://example.com/power-station.png"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 text-sm rounded-xl border border-slate-200 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
