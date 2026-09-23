'use client';

// ============================================================
// PSMI System — Interactive Sales Amount vs Time Chart
// ============================================================
// Displays sales revenue (₦) over time dynamically matching the
// selected filter (Sunday-anchored Week, Calendar Month, Date
// Range, or Today). Built with pure responsive SVG for zero
// hydration issues and ultra-crisp aesthetics.
// ============================================================

import { useState } from 'react';
import { TrendingUp, Calendar, ShoppingCart, Award, ArrowUpRight, BarChart2 } from 'lucide-react';
import { formatNaira, formatNairaCompact } from '@/lib/utils/currency';
import { SalesTimeSeriesPoint } from '@/actions/sales';

interface SalesTrendChartProps {
  data: SalesTimeSeriesPoint[];
  periodTotal: number;
  periodUnits: number;
  periodTxns: number;
  averagePerBucket: number;
  peakBucket: { label: string; amount: number } | null;
  filterMode: 'week' | 'month' | 'today' | 'date_range' | 'preset';
  periodTitle: string;
  loading?: boolean;
}

export default function SalesTrendChart({
  data,
  periodTotal,
  periodUnits,
  periodTxns,
  averagePerBucket,
  peakBucket,
  filterMode,
  periodTitle,
  loading = false,
}: SalesTrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // SVG dimensions & margins
  const chartWidth = 780;
  const chartHeight = 220;
  const paddingLeft = 55;
  const paddingRight = 24;
  const paddingTop = 25;
  const paddingBottom = 40;

  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const maxVal = Math.max(...data.map((d) => d.amount), 1);
  // Scale Y-axis to a clean round number
  const roundFactor = maxVal > 10000000 ? 5000000 : maxVal > 1000000 ? 500000 : maxVal > 100000 ? 50000 : 10000;
  const yMax = Math.max(roundFactor, Math.ceil(maxVal / roundFactor) * roundFactor);

  const numYGridLines = 4;
  const yGridSteps = Array.from({ length: numYGridLines + 1 }, (_, i) => (yMax / numYGridLines) * i);

  // Point coordinates calculation
  const pointsCount = data.length;
  const stepX = pointsCount > 1 ? plotWidth / (pointsCount - 1) : plotWidth / 2;

  const points = data.map((d, i) => {
    const x = pointsCount > 1 ? paddingLeft + i * stepX : paddingLeft + plotWidth / 2;
    const yRatio = Math.min(1, Math.max(0, d.amount / yMax));
    const y = paddingTop + plotHeight - yRatio * plotHeight;
    return { ...d, x, y, index: i };
  });

  // Generate smooth SVG curve path and area polygon
  const generatePath = () => {
    if (points.length === 0) return { linePath: '', areaPath: '' };
    if (points.length === 1) {
      const p = points[0];
      return {
        linePath: `M ${p.x - 20} ${p.y} L ${p.x + 20} ${p.y}`,
        areaPath: `M ${p.x - 20} ${paddingTop + plotHeight} L ${p.x - 20} ${p.y} L ${p.x + 20} ${p.y} L ${p.x + 20} ${paddingTop + plotHeight} Z`,
      };
    }

    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      linePath += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const last = points[points.length - 1];
    const first = points[0];
    const areaPath = `${linePath} L ${last.x} ${paddingTop + plotHeight} L ${first.x} ${paddingTop + plotHeight} Z`;

    return { linePath, areaPath };
  };

  const { linePath, areaPath } = generatePath();
  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.08)] border border-slate-100 overflow-hidden transition-all duration-200">
      {/* ── Header & KPI Snapshot ─────────────────────────────── */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <BarChart2 className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Sales Amount vs. Time
            </h3>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100/80">
              {periodTitle}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {filterMode === 'week' && 'Tracking revenue day-by-day (Week starts Sunday)'}
            {filterMode === 'month' && 'Calendar month daily sales distribution'}
            {filterMode === 'today' && 'Intraday sales pacing by time slot'}
            {(filterMode === 'date_range' || filterMode === 'preset') && 'Daily sales amount trend over selected timeframe'}
          </p>
        </div>

        {/* Highlights Banner */}
        <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtered Revenue</span>
            <span className="text-base font-extrabold font-mono text-slate-900 tracking-tight">
              {formatNaira(periodTotal)}
            </span>
          </div>
          <div className="h-7 w-px bg-slate-200 hidden sm:block" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Units</span>
            <span className="text-base font-bold text-indigo-600">
              {periodUnits} <span className="text-xs font-normal text-slate-500">({periodTxns} orders)</span>
            </span>
          </div>
          {peakBucket && (
            <>
              <div className="h-7 w-px bg-slate-200 hidden sm:block" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Peak Sales Day</span>
                <span className="text-xs font-bold text-emerald-700 truncate max-w-[130px]" title={`${peakBucket.label} (${formatNaira(peakBucket.amount)})`}>
                  {peakBucket.label} <span className="font-mono text-slate-600">({formatNairaCompact(peakBucket.amount)})</span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Chart Body ────────────────────────────────────────── */}
      <div className="p-4 sm:p-5 relative">
        {loading ? (
          <div className="h-[220px] flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              Loading chart trend...
            </div>
          </div>
        ) : data.length === 0 || periodTotal === 0 ? (
          <div className="h-[220px] flex flex-col items-center justify-center text-center py-6">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 mb-2 border border-slate-100">
              <Calendar className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-600">No sales recorded for this timeframe</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Sales will plot automatically as transactions are recorded.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[620px] relative">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-auto overflow-visible select-none"
              >
                <defs>
                  {/* Area Gradient */}
                  <linearGradient id="salesAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
                    <stop offset="60%" stopColor="#818cf8" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#c7d2fe" stopOpacity="0.00" />
                  </linearGradient>

                  {/* Line Gradient */}
                  <linearGradient id="salesLineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#4f46e5" />
                    <stop offset="50%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Grid Lines & Labels */}
                {yGridSteps.map((stepVal, idx) => {
                  const y = paddingTop + plotHeight - (stepVal / yMax) * plotHeight;
                  return (
                    <g key={`y-grid-${idx}`}>
                      <line
                        x1={paddingLeft}
                        y1={y}
                        x2={chartWidth - paddingRight}
                        y2={y}
                        stroke="#f1f5f9"
                        strokeWidth="1"
                        strokeDasharray={idx === 0 ? undefined : '3 3'}
                      />
                      <text
                        x={paddingLeft - 8}
                        y={y + 3.5}
                        textAnchor="end"
                        className="text-[9px] font-mono fill-slate-400"
                      >
                        {stepVal === 0 ? '₦0' : formatNairaCompact(stepVal)}
                      </text>
                    </g>
                  );
                })}

                {/* Vertical guides for points */}
                {points.map((p, idx) => {
                  // In month mode with 30 days, skip some labels for clarity
                  const isMonthMode = filterMode === 'month';
                  const showLabel = !isMonthMode || (idx === 0 || (idx + 1) % 5 === 0 || idx === points.length - 1);

                  return (
                    <g key={`x-guide-${p.key}`}>
                      {/* Optional subtle column hover zone */}
                      <rect
                        x={p.x - stepX / 2}
                        y={paddingTop}
                        width={stepX}
                        height={plotHeight}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />

                      {/* X-Axis bottom label */}
                      {showLabel && (
                        <text
                          x={p.x}
                          y={chartHeight - 12}
                          textAnchor="middle"
                          className={`text-[10px] select-none transition-colors ${
                            p.isCurrent
                              ? 'font-bold fill-indigo-600'
                              : p.isFuture
                              ? 'fill-slate-300'
                              : 'font-medium fill-slate-500'
                          }`}
                        >
                          {p.shortLabel}
                        </text>
                      )}

                      {/* Today dot indicator */}
                      {p.isCurrent && (
                        <circle
                          cx={p.x}
                          cy={chartHeight - 2}
                          r={2}
                          className="fill-indigo-600"
                        />
                      )}
                    </g>
                  );
                })}

                {/* Area Gradient Fill */}
                <path d={areaPath} fill="url(#salesAreaGradient)" />

                {/* Main Curve Line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="url(#salesLineGradient)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Interactive Data Points */}
                {points.map((p, idx) => {
                  const isHovered = hoveredIndex === idx;
                  const hasSales = p.amount > 0;

                  return (
                    <g
                      key={`point-${p.key}`}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {/* Outer pulsing ring for active day or hovered point */}
                      {(isHovered || (p.isCurrent && hasSales)) && (
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={isHovered ? 8 : 6}
                          fill="#6366f1"
                          fillOpacity={isHovered ? 0.25 : 0.15}
                        />
                      )}

                      {/* Primary point node */}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 5 : hasSales ? 3.5 : 2}
                        className={
                          isHovered
                            ? 'fill-indigo-600 stroke-white stroke-2'
                            : hasSales
                            ? 'fill-indigo-600 stroke-white stroke-[1.5]'
                            : 'fill-slate-300 stroke-white stroke-1'
                        }
                      />
                    </g>
                  );
                })}

                {/* Vertical hover indicator line */}
                {activePoint && (
                  <line
                    x1={activePoint.x}
                    y1={paddingTop}
                    x2={activePoint.x}
                    y2={paddingTop + plotHeight}
                    stroke="#6366f1"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity={0.6}
                    pointerEvents="none"
                  />
                )}
              </svg>

              {/* Floating Tooltip */}
              {activePoint && (
                <div
                  className="absolute pointer-events-none z-20 transition-all duration-150 transform -translate-x-1/2 -translate-y-full"
                  style={{
                    left: `${(activePoint.x / chartWidth) * 100}%`,
                    top: `${Math.max(10, (activePoint.y / chartHeight) * 100 - 8)}%`,
                  }}
                >
                  <div className="bg-slate-900 text-white rounded-xl shadow-xl px-3 py-2 text-xs min-w-[150px] border border-slate-700/60 backdrop-blur-md">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-1 mb-1">
                      <span className="font-bold text-slate-100 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-indigo-400" />
                        {activePoint.label}
                      </span>
                      {activePoint.subLabel && (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${
                          activePoint.isCurrent ? 'bg-indigo-500/30 text-indigo-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {activePoint.subLabel}
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[10px] text-slate-400">Total Sales:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {formatNaira(activePoint.amount)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[10px] text-slate-400">Volume:</span>
                        <span className="text-[11px] text-slate-200">
                          {activePoint.unitsCount} unit{activePoint.unitsCount !== 1 ? 's' : ''} ({activePoint.txnCount} order{activePoint.txnCount !== 1 ? 's' : ''})
                        </span>
                      </div>
                      {activePoint.topProduct && (
                        <div className="pt-1 mt-1 border-t border-slate-800 text-[10px] text-indigo-300 truncate max-w-[170px]">
                          ⚡ Top: {activePoint.topProduct}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
