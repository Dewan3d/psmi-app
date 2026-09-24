'use client';

// ============================================================
// PSMI System — Stock Category Chart Component
// ============================================================
// Renders an interactive vertical bar chart showing all stock
// models/SKUs in the system (inbounded + pending serial).
// Compact, sleek bars with horizontal scroll capability so
// nothing is truncated, and low-stock dashed threshold indicators.
// Pure SVG, zero external chart libraries.
// ============================================================

import { useState } from 'react';
import { ProductCategory, UnitStatus } from '@/lib/types/database';

interface ModelStock {
  sku: string;
  model_name: string;
  category_badge: ProductCategory;
  total: number;
  low_stock_threshold: number;
  status_breakdown: Record<UnitStatus, number>;
}

interface StockCategoryChartProps {
  models: ModelStock[];
  activeCategory: ProductCategory | 'ALL';
}

// Color accents per category
const CATEGORY_COLORS: Record<string, { bar: string; barHover: string }> = {
  POWER_STATION: { bar: '#6366f1', barHover: '#818cf8' },
  SHS: { bar: '#10b981', barHover: '#34d399' },
  ACCESSORIES: { bar: '#f59e0b', barHover: '#fbbf24' },
  ALL: { bar: '#6366f1', barHover: '#818cf8' },
};

export default function StockCategoryChart({
  models,
  activeCategory,
}: StockCategoryChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filter models by active category
  const filtered =
    activeCategory === 'ALL'
      ? models.filter((m) => m.total > 0)
      : models.filter(
          (m) => m.category_badge === activeCategory && m.total > 0
        );

  // Sort by total descending
  const displayModels = [...filtered].sort((a, b) => b.total - a.total);

  if (displayModels.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5 border border-slate-100/80">
        <h3 className="text-base font-semibold text-slate-800 mb-4">
          Stock by Product Model
        </h3>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-slate-50 rounded-2xl mb-3">
            <svg
              className="w-8 h-8 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
              />
            </svg>
          </div>
          <p className="text-sm text-slate-500">No stock data for this category</p>
          <p className="text-xs text-slate-400 mt-1">
            Products will appear here once inventory is added.
          </p>
        </div>
      </div>
    );
  }

  // Dimensions & layout: compact bar styling
  const barSlotWidth = 38; // Compact slot per bar
  const barWidth = 18; // Slimmer, elegant compact bars
  const paddingLeft = 50;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 55;

  const barAreaWidth = Math.max(700, displayModels.length * barSlotWidth);
  const chartWidth = paddingLeft + barAreaWidth + paddingRight;
  const chartHeight = 270;
  const barAreaHeight = chartHeight - paddingTop - paddingBottom;

  const maxVal = Math.max(...displayModels.map((m) => m.total), 1);
  const yMax = Math.ceil(maxVal / 100) * 100 || 10;

  const colorSet = CATEGORY_COLORS[activeCategory] || CATEGORY_COLORS.ALL;

  // Y-axis ticks
  const yTicks = [
    0,
    Math.round(yMax * 0.25),
    Math.round(yMax * 0.5),
    Math.round(yMax * 0.75),
    yMax,
  ];

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5 border border-slate-100/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-2 border-b border-slate-100 gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-800 tracking-tight">
            Stock by Product Model
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Complete inventory distribution showing all {displayModels.length} inbounded models (including pending serials).
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 self-start sm:self-auto">
          {displayModels.length} Models
        </span>
      </div>

      {/* Horizontally scrollable chart viewport to comfortably fit all models */}
      <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          style={{ width: `${chartWidth}px`, height: `${chartHeight}px` }}
          className="select-none"
        >
          {/* Y-axis gridlines and labels */}
          {yTicks.map((tick) => {
            const y = paddingTop + barAreaHeight - (tick / yMax) * barAreaHeight;
            return (
              <g key={`y-${tick}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray={tick === 0 ? '' : '3,3'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94a3b8"
                  fontFamily="Inter, sans-serif"
                  fontWeight="500"
                >
                  {tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {displayModels.map((model, i) => {
            const barHeight = (model.total / yMax) * barAreaHeight;
            const x = paddingLeft + i * barSlotWidth + (barSlotWidth - barWidth) / 2;
            const y = paddingTop + barAreaHeight - barHeight;
            const isHovered = hoveredIndex === i;

            // Low stock threshold line
            const thresholdY =
              paddingTop +
              barAreaHeight -
              (model.low_stock_threshold / yMax) * barAreaHeight;
            const isBelowThreshold = model.total < model.low_stock_threshold;

            const pendingCount = model.status_breakdown?.PENDING_SERIAL || 0;
            const inWhCount = model.status_breakdown?.IN_WAREHOUSE || 0;

            return (
              <g
                key={model.sku}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer group"
              >
                {/* Bar hover background strip */}
                <rect
                  x={paddingLeft + i * barSlotWidth}
                  y={paddingTop}
                  width={barSlotWidth}
                  height={barAreaHeight}
                  fill={isHovered ? 'rgba(99, 102, 241, 0.05)' : 'transparent'}
                  rx={4}
                />

                {/* Actual Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barHeight, 2)}
                  rx={3}
                  fill={isHovered ? colorSet.barHover : colorSet.bar}
                  opacity={hoveredIndex !== null && !isHovered ? 0.35 : 1}
                  className="transition-all duration-200"
                />

                {/* Low-stock threshold mark */}
                {model.low_stock_threshold > 0 &&
                  model.low_stock_threshold <= yMax && (
                    <line
                      x1={x - 2}
                      y1={thresholdY}
                      x2={x + barWidth + 2}
                      y2={thresholdY}
                      stroke={isBelowThreshold ? '#ef4444' : '#f59e0b'}
                      strokeWidth="1.5"
                      strokeDasharray="2,2"
                      opacity={isHovered ? 1 : 0.6}
                    />
                  )}

                {/* Value on top of bar (hidden if bar is very small to avoid clash) */}
                <text
                  x={x + barWidth / 2}
                  y={Math.max(y - 5, paddingTop - 4)}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="600"
                  fill={isHovered ? '#0f172a' : '#64748b'}
                  fontFamily="Inter, sans-serif"
                >
                  {model.total >= 1000 ? `${(model.total / 1000).toFixed(1)}k` : model.total}
                </text>

                {/* X-axis label (model name, rotated for clean compact readability) */}
                <g transform={`translate(${x + barWidth / 2}, ${chartHeight - paddingBottom + 12})`}>
                  <text
                    transform="rotate(35)"
                    textAnchor="start"
                    fontSize="9.5"
                    fill={isHovered ? '#1e293b' : '#64748b'}
                    fontWeight={isHovered ? '600' : '400'}
                    fontFamily="Inter, sans-serif"
                  >
                    {model.model_name.length > 12
                      ? model.model_name.slice(0, 11) + '…'
                      : model.model_name}
                  </text>
                </g>

                {/* Rich Hover Tooltip */}
                {isHovered && (
                  <g className="pointer-events-none" style={{ zIndex: 50 }}>
                    <rect
                      x={Math.min(Math.max(x + barWidth / 2 - 80, 5), chartWidth - 170)}
                      y={Math.max(y - 62, 5)}
                      width={160}
                      height={52}
                      rx={8}
                      fill="#0f172a"
                      opacity={0.96}
                    />
                    <text
                      x={Math.min(Math.max(x + barWidth / 2, 85), chartWidth - 90)}
                      y={Math.max(y - 44, 23)}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight="700"
                      fill="#ffffff"
                      fontFamily="Inter, sans-serif"
                    >
                      {model.model_name}
                    </text>
                    <text
                      x={Math.min(Math.max(x + barWidth / 2, 85), chartWidth - 90)}
                      y={Math.max(y - 30, 37)}
                      textAnchor="middle"
                      fontSize="9.5"
                      fill="#38bdf8"
                      fontFamily="Inter, sans-serif"
                    >
                      Total: {model.total.toLocaleString()} units
                    </text>
                    <text
                      x={Math.min(Math.max(x + barWidth / 2, 85), chartWidth - 90)}
                      y={Math.max(y - 17, 50)}
                      textAnchor="middle"
                      fontSize="8.5"
                      fill="#94a3b8"
                      fontFamily="Inter, sans-serif"
                    >
                      In Wh: {inWhCount.toLocaleString()} • Pending: {pendingCount.toLocaleString()}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Threshold and status legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 mt-2 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0 border-t-2 border-dashed border-amber-500" />
            <span className="font-medium">Threshold</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0 border-t-2 border-dashed border-rose-500" />
            <span className="font-medium">Below Threshold</span>
          </div>
        </div>
        <span className="text-slate-400 text-[10px]">
          *Scroll horizontally to view all product models
        </span>
      </div>
    </div>
  );
}
