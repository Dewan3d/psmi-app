'use client';

// ============================================================
// PSMI System — Total Inventory Endless Cards Client
// ============================================================

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Boxes,
  Search,
  Zap,
  Sun,
  Plug,
  Package,
  ChevronDown,
} from 'lucide-react';
import { StockSummary, ProductCategory } from '@/lib/types/database';

const INITIAL_VISIBLE = 20;
const LOAD_MORE_COUNT = 20;

const categoryConfig: Record<string, { label: string; icon: React.ElementType; gradient: string; badgeClass: string }> = {
  POWER_STATION: {
    label: 'Power Station',
    icon: Zap,
    gradient: 'from-indigo-500/20 via-indigo-400/10 to-slate-100',
    badgeClass: 'bg-indigo-100 text-indigo-700',
  },
  SHS: {
    label: 'SHS',
    icon: Sun,
    gradient: 'from-emerald-500/20 via-emerald-400/10 to-slate-100',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  ACCESSORIES: {
    label: 'Accessory',
    icon: Plug,
    gradient: 'from-amber-500/20 via-amber-400/10 to-slate-100',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function TotalInventoryClient({
  initialStock,
  imageMap,
}: {
  initialStock: StockSummary[];
  imageMap: Record<string, string | null>;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'ALL'>('ALL');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const totalUnits = useMemo(
    () => initialStock.reduce((sum, item) => sum + item.total, 0),
    [initialStock]
  );

  const filteredStock = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return initialStock
      .filter((item) => {
        if (activeCategory !== 'ALL' && item.category_badge !== activeCategory) return false;
        if (!query) return true;
        return (
          item.sku.toLowerCase().includes(query) ||
          item.model_name.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.total - a.total);
  }, [initialStock, searchQuery, activeCategory]);

  const visibleStock = filteredStock.slice(0, visibleCount);
  const hasMore = visibleCount < filteredStock.length;

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: initialStock.length };
    for (const item of initialStock) {
      const badge = item.category_badge || 'POWER_STATION';
      counts[badge] = (counts[badge] || 0) + 1;
    }
    return counts;
  }, [initialStock]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Back + Header ──────────────────────────────────────── */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors group mb-3"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Dashboard
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Total Inventory
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Browse all products across your inventory catalogue.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <Boxes className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 leading-tight">
                {formatNumber(totalUnits)}
              </p>
              <p className="text-xs text-slate-400">total units</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search + Category Filters ──────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleCount(INITIAL_VISIBLE);
            }}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'ALL', label: 'All Stock', icon: Boxes, activeClass: 'bg-indigo-600 text-white' },
            { key: 'POWER_STATION', label: 'Power Stations', icon: Zap, activeClass: 'bg-indigo-600 text-white' },
            { key: 'SHS', label: 'SHS', icon: Sun, activeClass: 'bg-emerald-600 text-white' },
            { key: 'ACCESSORIES', label: 'Accessories', icon: Plug, activeClass: 'bg-amber-500 text-white' },
          ].map((tab) => {
            const isActive = activeCategory === tab.key;
            const count = categoryCounts[tab.key] || 0;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveCategory(tab.key as any);
                  setVisibleCount(INITIAL_VISIBLE);
                }}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? `${tab.activeClass} shadow-sm`
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {tab.label}
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Cards Grid ─────────────────────────────────────────── */}
      {visibleStock.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] py-20 flex flex-col items-center justify-center text-center">
          <div className="p-4 bg-slate-50 rounded-2xl mb-4">
            <Package className="w-10 h-10 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">No products found</p>
          <p className="text-xs text-slate-400 mt-1">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {visibleStock.map((item, index) => {
            const cat = categoryConfig[item.category_badge] || categoryConfig.POWER_STATION;
            const CatIcon = cat.icon;
            const imgUrl = imageMap[item.sku];

            return (
              <Link
                key={item.sku}
                href={`/inventory/${encodeURIComponent(item.sku)}`}
                className="group bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.08)] hover:shadow-[0_8px_30px_-5px_rgba(6,81,237,0.15)] transition-all duration-300 overflow-hidden cursor-pointer hover:-translate-y-1"
                style={{ animationDelay: `${Math.min(index * 40, 600)}ms` }}
              >
                {/* Image Section */}
                <div className={`relative aspect-[4/3] bg-gradient-to-br ${cat.gradient} flex items-center justify-center p-6 overflow-hidden`}>
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={item.model_name}
                      className="w-full h-full object-contain max-h-[140px] group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="relative">
                      <div className="w-20 h-20 rounded-2xl bg-white/60 backdrop-blur-sm flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500">
                        <CatIcon className="w-10 h-10 text-slate-400/80" />
                      </div>
                    </div>
                  )}

                  {/* Category Badge */}
                  <span className={`absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full ${cat.badgeClass} backdrop-blur-sm`}>
                    <CatIcon className="w-3 h-3" />
                    {cat.label}
                  </span>
                </div>

                {/* Content Section */}
                <div className="p-4">
                  <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
                    {item.model_name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                    {item.sku}
                  </p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <span className="text-xs font-medium text-slate-500">Units in stock</span>
                    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full ${
                      item.total === 0
                        ? 'bg-red-50 text-red-600 border border-red-100'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    }`}>
                      {formatNumber(item.total)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Load More ──────────────────────────────────────────── */}
      {hasMore && (
        <div className="flex justify-center pt-2 pb-4">
          <button
            onClick={() => setVisibleCount((prev) => prev + LOAD_MORE_COUNT)}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer border border-indigo-100"
          >
            <ChevronDown className="w-4 h-4" />
            Load More ({filteredStock.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {/* ── Results Count Footer ───────────────────────────────── */}
      <div className="text-center pb-4">
        <p className="text-xs text-slate-400">
          Showing {visibleStock.length} of {filteredStock.length} product{filteredStock.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
