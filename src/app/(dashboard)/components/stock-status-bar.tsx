'use client';

// ============================================================
// PSMI System — Stock Status Bar Component
// ============================================================
// Renders a segmented horizontal pill bar showing stock
// distribution by status (In Warehouse, Reserved, In Transit,
// In Branch, Damaged/Repair). Includes hover tooltips.
// ============================================================

import { useState } from 'react';
import { UnitStatus } from '@/lib/types/database';

// ── Status configuration ──────────────────────────────────────
const STATUS_CONFIG: {
  key: UnitStatus;
  label: string;
  color: string;
  bgClass: string;
  textClass: string;
}[] = [
  {
    key: 'IN_WAREHOUSE',
    label: 'In Warehouse',
    color: '#10b981',
    bgClass: 'bg-emerald-500',
    textClass: 'text-emerald-700',
  },
  {
    key: 'RESERVED',
    label: 'Reserved',
    color: '#f59e0b',
    bgClass: 'bg-amber-500',
    textClass: 'text-amber-700',
  },
  {
    key: 'IN_TRANSIT',
    label: 'In Transit',
    color: '#3b82f6',
    bgClass: 'bg-blue-500',
    textClass: 'text-blue-700',
  },
  {
    key: 'IN_BRANCH',
    label: 'In Branch',
    color: '#8b5cf6',
    bgClass: 'bg-violet-500',
    textClass: 'text-violet-700',
  },
  {
    key: 'DAMAGED_REPAIR',
    label: 'Damaged / Repair',
    color: '#ef4444',
    bgClass: 'bg-rose-500',
    textClass: 'text-rose-700',
  },
  {
    key: 'PENDING_SERIAL',
    label: 'Pending Serial',
    color: '#94a3b8',
    bgClass: 'bg-slate-400',
    textClass: 'text-slate-600',
  },
];

interface StockStatusBarProps {
  statusBreakdown: Record<UnitStatus, number>;
  totalUnits: number;
  categoryLabel?: string;
}

export default function StockStatusBar({
  statusBreakdown,
  totalUnits,
  categoryLabel,
}: StockStatusBarProps) {
  const [hoveredStatus, setHoveredStatus] = useState<UnitStatus | null>(null);

  // Filter out statuses with zero count for cleaner visuals
  const activeStatuses = STATUS_CONFIG.filter(
    (s) => (statusBreakdown[s.key] || 0) > 0
  );

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800">
            Stock Distribution
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {categoryLabel
              ? `${categoryLabel} — ${totalUnits.toLocaleString()} units`
              : `All categories — ${totalUnits.toLocaleString()} total units`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900 tracking-tight">
            {totalUnits.toLocaleString()}
          </p>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            Total Units
          </p>
        </div>
      </div>

      {/* Segmented Bar */}
      {totalUnits > 0 ? (
        <div className="relative">
          <div className="flex h-4 rounded-full overflow-hidden bg-slate-100 gap-px">
            {activeStatuses.map((status) => {
              const count = statusBreakdown[status.key] || 0;
              const pct = (count / totalUnits) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={status.key}
                  className={`${status.bgClass} transition-all duration-500 ease-out relative cursor-pointer`}
                  style={{ width: `${pct}%`, minWidth: pct > 0 ? '4px' : '0' }}
                  onMouseEnter={() => setHoveredStatus(status.key)}
                  onMouseLeave={() => setHoveredStatus(null)}
                >
                  {/* Tooltip */}
                  {hoveredStatus === status.key && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap animate-fade-in">
                      <div className="bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg">
                        {status.label}: {count.toLocaleString()} ({pct.toFixed(1)}%)
                      </div>
                      <div className="w-2 h-2 bg-slate-900 rotate-45 mx-auto -mt-1" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="h-4 rounded-full bg-slate-100 flex items-center justify-center">
          <span className="text-[10px] text-slate-400">No stock data</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
        {STATUS_CONFIG.map((status) => {
          const count = statusBreakdown[status.key] || 0;
          if (count === 0 && totalUnits > 0) return null;
          const pct = totalUnits > 0 ? ((count / totalUnits) * 100).toFixed(1) : '0';
          return (
            <div
              key={status.key}
              className={`flex items-center gap-2 transition-opacity duration-200 ${
                hoveredStatus && hoveredStatus !== status.key
                  ? 'opacity-40'
                  : 'opacity-100'
              }`}
              onMouseEnter={() => setHoveredStatus(status.key)}
              onMouseLeave={() => setHoveredStatus(null)}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full ${status.bgClass}`}
              />
              <span className="text-xs text-slate-600 font-medium">
                {status.label}
              </span>
              <span className="text-xs font-semibold text-slate-800">
                {count.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">
                ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
