'use client';

// ============================================================
// PSMI System — Stock Infographic Container
// ============================================================
// Client component managing the category filter tabs (ALL,
// Power Station, SHS, Accessories) and rendering the
// StockStatusBar + StockCategoryChart infographics.
// ============================================================

import { useState } from 'react';
import { Zap, Sun, Plug } from 'lucide-react';
import { ProductCategory, UnitStatus } from '@/lib/types/database';
import StockStatusBar from './stock-status-bar';
import StockCategoryChart from './stock-category-chart';

// ── Category tab configuration ────────────────────────────────
const CATEGORY_TABS: {
  key: ProductCategory | 'ALL';
  label: string;
  icon: React.ElementType;
  accent: string;
  activeAccent: string;
}[] = [
  {
    key: 'ALL',
    label: 'All Stock',
    icon: Zap,
    accent: 'text-slate-500',
    activeAccent: 'bg-indigo-600 text-white shadow-md shadow-indigo-200',
  },
  {
    key: 'POWER_STATION',
    label: 'Power Stations',
    icon: Zap,
    accent: 'text-indigo-500',
    activeAccent: 'bg-indigo-600 text-white shadow-md shadow-indigo-200',
  },
  {
    key: 'SHS',
    label: 'SHS',
    icon: Sun,
    accent: 'text-emerald-500',
    activeAccent: 'bg-emerald-600 text-white shadow-md shadow-emerald-200',
  },
  {
    key: 'ACCESSORIES',
    label: 'Accessories',
    icon: Plug,
    accent: 'text-amber-500',
    activeAccent: 'bg-amber-500 text-white shadow-md shadow-amber-200',
  },
];

// ── Types for server-passed data ──────────────────────────────
interface CategoryData {
  category: ProductCategory;
  count: number;
  status_breakdown: Record<UnitStatus, number>;
}

interface ModelData {
  sku: string;
  model_name: string;
  category_badge: ProductCategory;
  total: number;
  low_stock_threshold: number;
  status_breakdown: Record<UnitStatus, number>;
}

interface StockInfographicContainerProps {
  totals: Record<UnitStatus, number>;
  byCategory: CategoryData[];
  byModel: ModelData[];
}

export default function StockInfographicContainer({
  totals,
  byCategory,
  byModel,
}: StockInfographicContainerProps) {
  const [activeCategory, setActiveCategory] = useState<
    ProductCategory | 'ALL'
  >('ALL');

  // Compute display values based on active filter
  const statusBreakdown: Record<UnitStatus, number> =
    activeCategory === 'ALL'
      ? totals
      : byCategory.find((c) => c.category === activeCategory)
          ?.status_breakdown || ({} as Record<UnitStatus, number>);

  const totalUnits =
    activeCategory === 'ALL'
      ? Object.values(totals).reduce((a, b) => a + b, 0)
      : byCategory.find((c) => c.category === activeCategory)?.count || 0;

  // Build category counts for tab badges
  const categoryCounts: Record<string, number> = { ALL: 0 };
  for (const cat of byCategory) {
    categoryCounts[cat.category] = cat.count;
    categoryCounts.ALL += cat.count;
  }

  // Active category label for status bar
  const activeCategoryLabel =
    activeCategory === 'ALL'
      ? undefined
      : CATEGORY_TABS.find((t) => t.key === activeCategory)?.label;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Category Filter Tabs ──────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeCategory === tab.key;
          const count = categoryCounts[tab.key] ?? 0;
          const Icon = tab.icon;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key)}
              className={`
                inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl
                transition-all duration-200 cursor-pointer
                ${
                  isActive
                    ? tab.activeAccent
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }
              `}
            >
              <Icon
                className={`w-4 h-4 ${isActive ? 'text-white' : tab.accent}`}
                strokeWidth={isActive ? 2 : 1.5}
              />
              {tab.label}
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Infographic Grid ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StockStatusBar
          statusBreakdown={statusBreakdown}
          totalUnits={totalUnits}
          categoryLabel={activeCategoryLabel}
        />
        <StockCategoryChart
          models={byModel}
          activeCategory={activeCategory}
        />
      </div>
    </div>
  );
}
