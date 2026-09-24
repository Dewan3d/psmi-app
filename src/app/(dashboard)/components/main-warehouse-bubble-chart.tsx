'use client';

// ============================================================
// PSMI System — Main Warehouse Stock Bubble Map Chart
// ============================================================
// Expansive, organic bubble map of all inbounded & pending
// serial models in the inventory. Utilizes negative space well
// across a wide viewport, with fixed top-right detail card to
// never obscure bubbles while hovering.
// Pure SVG + Tailwind — zero external charting dependencies.
// ============================================================

import React, { useState, useMemo } from 'react';
import { ProductCategory } from '@/lib/types/database';
import { MainWarehouseModelStock } from '@/actions/dashboard';
import { Package, Layers, Info, CheckCircle2, Clock } from 'lucide-react';

interface MainWarehouseBubbleChartProps {
  models: MainWarehouseModelStock[];
  activeCategory: ProductCategory | 'ALL';
}

// ── Category Color Tokens ─────────────────────────────────────
const CATEGORY_THEMES: Record<
  ProductCategory,
  {
    fill: string;
    stroke: string;
    glow: string;
    text: string;
    badgeBg: string;
    badgeText: string;
    label: string;
  }
> = {
  POWER_STATION: {
    fill: 'url(#grad-power)',
    stroke: '#6366f1',
    glow: 'rgba(99, 102, 241, 0.45)',
    text: '#ffffff',
    badgeBg: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    badgeText: 'text-indigo-600',
    label: 'Power Station',
  },
  SHS: {
    fill: 'url(#grad-shs)',
    stroke: '#10b981',
    glow: 'rgba(16, 185, 129, 0.45)',
    text: '#ffffff',
    badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    badgeText: 'text-emerald-600',
    label: 'SHS',
  },
  ACCESSORIES: {
    fill: 'url(#grad-acc)',
    stroke: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.45)',
    text: '#ffffff',
    badgeBg: 'bg-amber-50 border-amber-200 text-amber-700',
    badgeText: 'text-amber-600',
    label: 'Accessories',
  },
};

interface PackedCircle {
  model_name: string;
  category: ProductCategory;
  total_available: number;
  in_warehouse_count: number;
  pending_serial_count: number;
  skus: { sku: string; count: number; in_warehouse?: number; pending_serial?: number }[];
  x: number;
  y: number;
  r: number;
}

export default function MainWarehouseBubbleChart({
  models,
  activeCategory,
}: MainWarehouseBubbleChartProps) {
  const [hoveredModel, setHoveredModel] = useState<PackedCircle | null>(null);

  // Filter models by category if active
  const filteredModels = useMemo(() => {
    if (activeCategory === 'ALL') {
      return models.filter((m) => m.total_available > 0);
    }
    return models.filter(
      (m) => m.category === activeCategory && m.total_available > 0
    );
  }, [models, activeCategory]);

  // Wide, expansive canvas dimensions
  const width = 1100;
  const height = 540;
  const centerX = width / 2;
  const centerY = height / 2;

  // Circle packing calculation utilizing expansive negative space
  const packedCircles: PackedCircle[] = useMemo(() => {
    if (filteredModels.length === 0) return [];

    const maxStock = Math.max(...filteredModels.map((m) => m.total_available), 1);

    // Scaling: radius proportional to sqrt(count) with expansive max & min
    const maxRadius = Math.min(84, Math.max(50, Math.sqrt(maxStock) * 0.65));
    const minRadius = 14;

    const circles: PackedCircle[] = filteredModels.map((m) => {
      const ratio = Math.sqrt(m.total_available / maxStock);
      const r = Math.max(minRadius, ratio * maxRadius);
      return {
        ...m,
        in_warehouse_count: m.in_warehouse_count || 0,
        pending_serial_count: m.pending_serial_count || 0,
        x: centerX + (Math.random() - 0.5) * 200,
        y: centerY + (Math.random() - 0.5) * 150,
        r,
      };
    });

    // Sort descending so larger circles anchor comfortably
    circles.sort((a, b) => b.r - a.r);

    // Initial expansive elliptical spiral placement (wider aspect ratio to fill canvas)
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    circles.forEach((c, i) => {
      if (i === 0) {
        c.x = centerX - 40;
        c.y = centerY;
      } else {
        const radiusDist = 38 * Math.sqrt(i) + c.r;
        const angle = i * goldenAngle;
        // Elliptical distribution: 1.4x horizontal spread
        c.x = centerX - 40 + Math.cos(angle) * (radiusDist * 1.35);
        c.y = centerY + Math.sin(angle) * (radiusDist * 0.95);
      }
    });

    // Iterative separation & relaxation physics
    const iterations = 100;
    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < circles.length; i++) {
        const c1 = circles[i];
        for (let j = i + 1; j < circles.length; j++) {
          const c2 = circles[j];
          const dx = c2.x - c1.x;
          const dy = c2.y - c1.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          const minDist = c1.r + c2.r + 5; // 5px padding for airy separation

          if (dist < minDist) {
            const overlap = (minDist - dist) / dist;
            const pushX = dx * overlap * 0.5;
            const pushY = dy * overlap * 0.5;

            const w1 = c2.r / (c1.r + c2.r);
            const w2 = c1.r / (c1.r + c2.r);

            c1.x -= pushX * w1;
            c1.y -= pushY * w1;
            c2.x += pushX * w2;
            c2.y += pushY * w2;
          }
        }

        // Center gravity with wider spread
        const toCenterX = centerX - 40 - c1.x;
        const toCenterY = centerY - c1.y;
        c1.x += toCenterX * 0.012;
        c1.y += toCenterY * 0.016;

        // Viewport bounding clamp
        const padding = 10;
        c1.x = Math.max(c1.r + padding, Math.min(width - c1.r - padding, c1.x));
        c1.y = Math.max(c1.r + padding, Math.min(height - c1.r - padding, c1.y));
      }
    }

    return circles;
  }, [filteredModels, centerX, centerY, width, height]);

  const totalWarehouseUnits = useMemo(
    () => filteredModels.reduce((acc, m) => acc + m.total_available, 0),
    [filteredModels]
  );

  return (
    <div className="relative bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100/80 p-5 overflow-hidden transition-all duration-300">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-2 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50/80 rounded-xl text-indigo-600">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800 tracking-tight">
              Main Warehouse Stock Map
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Available &amp; pending serial inventory. Bubble sizes reflect physical unit volume.
            </p>
          </div>
        </div>

        {/* Total Stock in View */}
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Total Inbounded Units
            </p>
            <p className="text-xl font-bold text-slate-900 tracking-tight">
              {totalWarehouseUnits.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* ── Category Legend Badges ────────────────────────────── */}
      <div className="flex items-center gap-4 text-xs font-medium text-slate-500 mb-2 px-1">
        <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
          Categories:
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm" />
          <span>Power Stations</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
          <span>SHS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
          <span>Accessories</span>
        </div>
      </div>

      {/* ── Empty State ───────────────────────────────────────── */}
      {packedCircles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 bg-slate-50 rounded-2xl mb-3">
            <Info className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-600">
            No stock available for this category
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Inbounded items or pending serial uploads will appear here automatically.
          </p>
        </div>
      ) : (
        /* ── SVG Chart View with Expansive Canvas ─────────────── */
        <div className="relative w-full h-[460px] sm:h-[500px] md:h-[540px] flex items-center justify-center select-none overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full max-h-[540px] overflow-visible"
          >
            <defs>
              {/* Gradients for visual depth */}
              <radialGradient id="grad-power" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="65%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#4338ca" />
              </radialGradient>
              <radialGradient id="grad-shs" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="65%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </radialGradient>
              <radialGradient id="grad-acc" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="65%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </radialGradient>

              {/* Shadow filter for 3D depth */}
              <filter id="bubble-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow
                  dx="0"
                  dy="4"
                  stdDeviation="5"
                  floodColor="#0f172a"
                  floodOpacity="0.12"
                />
              </filter>
            </defs>

            {/* Background subtle grid pattern for expansive scale anchoring */}
            <g opacity="0.04" stroke="#64748b" strokeWidth="1">
              <ellipse cx={centerX - 40} cy={centerY} rx={160} ry={110} fill="none" />
              <ellipse cx={centerX - 40} cy={centerY} rx={320} ry={220} fill="none" />
              <ellipse cx={centerX - 40} cy={centerY} rx={480} ry={310} fill="none" />
            </g>

            {/* Bubble Elements */}
            {packedCircles.map((circle, idx) => {
              const theme =
                CATEGORY_THEMES[circle.category] || CATEGORY_THEMES.POWER_STATION;
              const isHovered = hoveredModel?.model_name === circle.model_name;
              const hasMultiSku = circle.skus.length > 1;

              // Text sizing logic
              const canShowLabel = circle.r >= 20;
              const canShowCount = circle.r >= 28;
              const fontSize = Math.max(10, Math.min(13, circle.r / 3.4));

              return (
                <g
                  key={circle.model_name}
                  className="cursor-pointer transition-transform duration-300 ease-out group"
                  style={{
                    transformOrigin: `${circle.x}px ${circle.y}px`,
                    transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                  }}
                  onMouseEnter={() => setHoveredModel(circle)}
                  onMouseLeave={() => setHoveredModel(null)}
                >
                  {/* Glow circle when hovered */}
                  {isHovered && (
                    <circle
                      cx={circle.x}
                      cy={circle.y}
                      r={circle.r + 7}
                      fill="none"
                      stroke={theme.stroke}
                      strokeWidth="3"
                      strokeOpacity="0.6"
                      className="animate-pulse"
                    />
                  )}

                  {/* Main Bubble */}
                  <circle
                    cx={circle.x}
                    cy={circle.y}
                    r={circle.r}
                    fill={theme.fill}
                    stroke="#ffffff"
                    strokeWidth={isHovered ? '3' : '1.5'}
                    strokeOpacity={isHovered ? '0.95' : '0.6'}
                    filter="url(#bubble-shadow)"
                    className="transition-all duration-300"
                    style={{
                      animation: `bubble-entrance 0.5s ease-out ${Math.min(idx * 0.015, 0.4)}s both`,
                    }}
                  />

                  {/* Multi-SKU indicator dot on the bubble perimeter */}
                  {hasMultiSku && circle.r >= 24 && (
                    <circle
                      cx={circle.x + circle.r * 0.65}
                      cy={circle.y - circle.r * 0.65}
                      r="4"
                      fill="#ffffff"
                      stroke={theme.stroke}
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Inner Label for larger bubbles */}
                  {canShowLabel && (
                    <text
                      x={circle.x}
                      y={canShowCount ? circle.y - 3 : circle.y + 4}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={fontSize}
                      fontWeight="700"
                      className="pointer-events-none drop-shadow-sm select-none"
                    >
                      {circle.model_name.length > 10 && circle.r < 38
                        ? `${circle.model_name.slice(0, 8)}…`
                        : circle.model_name}
                    </text>
                  )}

                  {/* Inner Count */}
                  {canShowCount && (
                    <text
                      x={circle.x}
                      y={circle.y + fontSize + 2}
                      textAnchor="middle"
                      fill="rgba(255, 255, 255, 0.9)"
                      fontSize={Math.max(9, fontSize - 2)}
                      fontWeight="500"
                      className="pointer-events-none select-none"
                    >
                      {circle.total_available.toLocaleString()}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* ── Fixed Top-Right Info Card (Never blocks hovered bubbles) ── */}
          {hoveredModel ? (
            <div className="absolute top-3 right-3 z-20 pointer-events-none bg-slate-900/95 backdrop-blur-md text-white text-xs rounded-xl p-3.5 shadow-2xl border border-slate-700/70 w-72 animate-fade-in transition-all duration-200">
              {/* Tooltip Header */}
              <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-700/80">
                <div>
                  <h4 className="font-bold text-sm text-white tracking-tight">
                    {hoveredModel.model_name}
                  </h4>
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mt-0.5 border ${
                      CATEGORY_THEMES[hoveredModel.category]?.badgeBg ||
                      'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {CATEGORY_THEMES[hoveredModel.category]?.label || hoveredModel.category}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-medium">
                    Total Units
                  </span>
                  <p className="text-base font-extrabold text-emerald-400">
                    {hoveredModel.total_available.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Status Breakdown: In Warehouse vs Pending Serial */}
              <div className="grid grid-cols-2 gap-2 mb-2.5 pb-2 border-b border-slate-800 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>In Wh: <strong className="text-white">{hoveredModel.in_warehouse_count.toLocaleString()}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>Pending: <strong className="text-white">{hoveredModel.pending_serial_count.toLocaleString()}</strong></span>
                </div>
              </div>

              {/* SKU Breakdown (Multi-SKU transparency) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {hoveredModel.skus.length === 1 ? 'Associated SKU' : 'SKU Breakdown'}
                  </span>
                  <span>Units</span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {hoveredModel.skus.map((s) => (
                    <div
                      key={s.sku}
                      className="flex items-center justify-between py-1 px-1.5 rounded bg-slate-800/80 text-[11px]"
                    >
                      <span className="font-mono text-slate-300 truncate max-w-[170px]">
                        {s.sku}
                      </span>
                      <span className="font-semibold text-slate-100 ml-2">
                        {s.count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex absolute top-3 right-3 z-10 pointer-events-none items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100/80 text-slate-400 text-xs border border-slate-200/60">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>Hover on any bubble to inspect model &amp; SKU breakdown</span>
            </div>
          )}
        </div>
      )}

      {/* ── Keyframes for bubble entrance ─────────────────────── */}
      <style jsx>{`
        @keyframes bubble-entrance {
          0% {
            transform: scale(0.1);
            opacity: 0;
          }
          70% {
            transform: scale(1.05);
            opacity: 0.9;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
