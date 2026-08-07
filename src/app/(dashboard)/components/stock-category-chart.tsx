'use client';

// ============================================================
// PSMI System — Stock Category Chart Component
// ============================================================
// Renders an interactive vertical bar chart showing stock levels
// per product model, with dashed low-stock threshold lines and
// hover detail tooltips. Pure SVG, no external chart libraries.
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
  const sorted = [...filtered].sort((a, b) => b.total - a.total);

  // Take top 8 for readability
  const displayModels = sorted.slice(0, 8);

  if (displayModels.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5">
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

  // Chart dimensions
  const chartWidth = 560;
  const chartHeight = 220;
  const paddingLeft = 45;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 40;
  const barAreaWidth = chartWidth - paddingLeft - paddingRight;
  const barAreaHeight = chartHeight - paddingTop - paddingBottom;

  const maxVal = Math.max(...displayModels.map((m) => m.total), 1);
  // Round up to a nice number for y-axis
  const yMax = Math.ceil(maxVal / 10) * 10 || 10;
  const barWidth = Math.min(
    40,
    (barAreaWidth / displayModels.length) * 0.6
  );
  const barGap =
    (barAreaWidth - barWidth * displayModels.length) /
    (displayModels.length + 1);

  const colorSet = CATEGORY_COLORS[activeCategory] || CATEGORY_COLORS.ALL;

  // Y-axis ticks
  const yTicks = [0, Math.round(yMax * 0.25), Math.round(yMax * 0.5), Math.round(yMax * 0.75), yMax];

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-800">
          Stock by Product Model
        </h3>
        <span className="text-xs font-medium text-slate-400">
          Top {displayModels.length} models
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full"
          style={{ minWidth: '400px' }}
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
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray={tick === 0 ? '' : '4,3'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94a3b8"
                  fontFamily="Inter, sans-serif"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {displayModels.map((model, i) => {
            const barHeight = (model.total / yMax) * barAreaHeight;
            const x = paddingLeft + barGap + i * (barWidth + barGap);
            const y = paddingTop + barAreaHeight - barHeight;
            const isHovered = hoveredIndex === i;

            // Low stock threshold line for this bar
            const thresholdY =
              paddingTop +
              barAreaHeight -
              (model.low_stock_threshold / yMax) * barAreaHeight;
            const isBelowThreshold = model.total < model.low_stock_threshold;

            return (
              <g
                key={model.sku}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
              >
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={4}
                  fill={isHovered ? colorSet.barHover : colorSet.bar}
                  opacity={
                    hoveredIndex !== null && !isHovered ? 0.4 : 1
                  }
                  className="transition-all duration-200"
                />

                {/* Low-stock threshold dashed line per bar */}
                {model.low_stock_threshold > 0 &&
                  model.low_stock_threshold <= yMax && (
                    <line
                      x1={x - 4}
                      y1={thresholdY}
                      x2={x + barWidth + 4}
                      y2={thresholdY}
                      stroke={isBelowThreshold ? '#ef4444' : '#f59e0b'}
                      strokeWidth="1.5"
                      strokeDasharray="4,2"
                      opacity={isHovered ? 1 : 0.5}
                    />
                  )}

                {/* Value on top of bar */}
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill={isHovered ? '#1e293b' : '#94a3b8'}
                  fontFamily="Inter, sans-serif"
                  className="transition-all duration-200"
                >
                  {model.total}
                </text>

                {/* X-axis label (model name, truncated) */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight - paddingBottom + 16}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#64748b"
                  fontFamily="Inter, sans-serif"
                >
                  {model.model_name.length > 10
                    ? model.model_name.slice(0, 10) + '…'
                    : model.model_name}
                </text>

                {/* Hover tooltip */}
                {isHovered && (
                  <g>
                    <rect
                      x={x + barWidth / 2 - 70}
                      y={y - 50}
                      width={140}
                      height={36}
                      rx={6}
                      fill="#0f172a"
                      opacity={0.95}
                    />
                    <text
                      x={x + barWidth / 2}
                      y={y - 36}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill="#ffffff"
                      fontFamily="Inter, sans-serif"
                    >
                      {model.model_name}
                    </text>
                    <text
                      x={x + barWidth / 2}
                      y={y - 22}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#cbd5e1"
                      fontFamily="Inter, sans-serif"
                    >
                      {model.total} units • Threshold: {model.low_stock_threshold}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Threshold legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-0 border-t-2 border-dashed border-amber-500"
          />
          <span className="text-[10px] text-slate-500 font-medium">
            Low Stock Threshold
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-0 border-t-2 border-dashed border-rose-500"
          />
          <span className="text-[10px] text-slate-500 font-medium">
            Below Threshold
          </span>
        </div>
      </div>
    </div>
  );
}
