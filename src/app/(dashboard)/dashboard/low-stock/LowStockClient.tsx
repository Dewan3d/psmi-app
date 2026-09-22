'use client';

// ============================================================
// PSMI System — Low Stock Alerts Endless Cards Client
// ============================================================

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  Search,
  Zap,
  Sun,
  Plug,
  Package,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import { LowStockAlert, ProductCategory } from '@/lib/types/database';

const INITIAL_VISIBLE = 20;
const LOAD_MORE_COUNT = 20;

const categoryConfig: Record<string, { label: string; icon: React.ElementType; gradient: string; badgeClass: string }> = {
  POWER_STATION: {
    label: 'Power Station',
    icon: Zap,
    gradient: 'from-amber-500/15 via-orange-400/10 to-amber-50',
    badgeClass: 'bg-indigo-100 text-indigo-700',
  },
  SHS: {
    label: 'SHS',
    icon: Sun,
    gradient: 'from-amber-500/15 via-orange-400/10 to-amber-50',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  ACCESSORIES: {
    label: 'Accessory',
    icon: Plug,
    gradient: 'from-amber-500/15 via-orange-400/10 to-amber-50',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
};

export default function LowStockClient({
  alerts,
  productMap,
}: {
  alerts: LowStockAlert[];
  productMap: Record<string, { image_url: string | null; model_name: string; category_badge: string }>;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const filteredAlerts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return alerts;
    return alerts.filter(
      (a) =>
        a.sku.toLowerCase().includes(query) ||
        a.model_name.toLowerCase().includes(query)
    );
  }, [alerts, searchQuery]);

  const visibleAlerts = filteredAlerts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredAlerts.length;

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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              Low Stock Alerts
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Products that have fallen below their defined stock threshold.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${alerts.length > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
              <AlertTriangle className={`w-5 h-5 ${alerts.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 leading-tight">
                {alerts.length}
              </p>
              <p className="text-xs text-slate-400">alerts active</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-4">
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
      </div>

      {/* ── Cards Grid ─────────────────────────────────────────── */}
      {visibleAlerts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] py-20 flex flex-col items-center justify-center text-center">
          <div className="p-4 bg-emerald-50 rounded-2xl mb-4">
            <ShieldCheck className="w-10 h-10 text-emerald-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">All stock levels are healthy</p>
          <p className="text-xs text-slate-400 mt-1">
            No products are below their defined thresholds.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {visibleAlerts.map((alert, index) => {
            const product = productMap[alert.sku];
            const catKey = product?.category_badge || 'POWER_STATION';
            const cat = categoryConfig[catKey] || categoryConfig.POWER_STATION;
            const CatIcon = cat.icon;
            const imgUrl = product?.image_url;
            const depletionPct = alert.threshold > 0
              ? Math.min(100, Math.round((alert.current_count / alert.threshold) * 100))
              : 0;

            return (
              <Link
                key={alert.sku}
                href={`/inventory/${encodeURIComponent(alert.sku)}`}
                className="group bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.08)] hover:shadow-[0_8px_30px_-5px_rgba(217,119,6,0.2)] transition-all duration-300 overflow-hidden cursor-pointer hover:-translate-y-1 border border-amber-100/60"
                style={{ animationDelay: `${Math.min(index * 40, 600)}ms` }}
              >
                {/* Image Section */}
                <div className={`relative aspect-[4/3] bg-gradient-to-br ${cat.gradient} flex items-center justify-center p-6 overflow-hidden`}>
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={alert.model_name}
                      className="w-full h-full object-contain max-h-[140px] group-hover:scale-105 transition-transform duration-500 opacity-80"
                    />
                  ) : (
                    <div className="relative">
                      <div className="w-20 h-20 rounded-2xl bg-white/60 backdrop-blur-sm flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500">
                        <CatIcon className="w-10 h-10 text-amber-400/80" />
                      </div>
                    </div>
                  )}

                  {/* Warning Badge */}
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700 backdrop-blur-sm">
                    <AlertTriangle className="w-3 h-3" />
                    Low Stock
                  </span>
                </div>

                {/* Content Section */}
                <div className="p-4">
                  <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-amber-700 transition-colors">
                    {alert.model_name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                    {alert.sku}
                  </p>

                  {/* Stock Level Bar */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-500">Stock Level</span>
                      <span className="text-xs font-bold text-amber-600">
                        {alert.current_count} / {alert.threshold}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          depletionPct <= 25
                            ? 'bg-red-500'
                            : depletionPct <= 50
                            ? 'bg-amber-500'
                            : 'bg-amber-400'
                        }`}
                        style={{ width: `${depletionPct}%` }}
                      />
                    </div>
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
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors cursor-pointer border border-amber-100"
          >
            <ChevronDown className="w-4 h-4" />
            Load More ({filteredAlerts.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {/* ── Results Count Footer ───────────────────────────────── */}
      {filteredAlerts.length > 0 && (
        <div className="text-center pb-4">
          <p className="text-xs text-slate-400">
            Showing {visibleAlerts.length} of {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
