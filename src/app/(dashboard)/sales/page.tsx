// ============================================================
// PSMI System — Sales Dashboard Page
// ============================================================
// Displays B2B/B2C outbound transactions as sales with KPI
// cards, searchable table, expandable row details, inline
// price editing, and CSV export.
// ============================================================

'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  BarChart3,
  Search,
  Download,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  User,
  Edit3,
  Check,
  X,
  Filter,
  Calendar,
  Package,
} from 'lucide-react';
import { getSales, getSalesSummaryStats, updateSalePrice, batchUpdateSalePrices, exportSalesCSV } from '@/actions/sales';
import { formatNaira, formatNairaCompact } from '@/lib/utils/currency';
import { SaleRecord } from '@/lib/types/database';

// ── Route badge config ────────────────────────────────────────
const routeBadge: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  B2B: { label: 'B2B', color: 'bg-violet-100 text-violet-700', icon: <Users className="w-3 h-3" /> },
  B2C: { label: 'B2C', color: 'bg-emerald-100 text-emerald-700', icon: <User className="w-3 h-3" /> },
};

// ── Date range presets ────────────────────────────────────────
type DatePreset = 'today' | '7d' | '30d' | '90d' | 'all';
function getDateRange(preset: DatePreset): { from?: string; to?: string } {
  const now = new Date();
  const to = now.toISOString();
  switch (preset) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { from: start.toISOString(), to };
    }
    case '7d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return { from: start.toISOString(), to };
    }
    case '30d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { from: start.toISOString(), to };
    }
    case '90d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 90);
      return { from: start.toISOString(), to };
    }
    case 'all':
      return {};
  }
}

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({
  title,
  value,
  subtitle,
  icon,
  accent = 'indigo',
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  accent?: 'indigo' | 'emerald' | 'violet' | 'amber';
}) {
  const accentColors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 p-5 flex items-start justify-between">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
        {subtitle && (
          <p className="text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
      <div className={`p-2.5 rounded-xl ${accentColors[accent]}`}>
        {icon}
      </div>
    </div>
  );
}

// ── Inline Price Editor ───────────────────────────────────────
function InlinePriceEditor({
  transactionId,
  serialNumber,
  currentPrice,
  onSaved,
}: {
  transactionId: string;
  serialNumber: string;
  currentPrice: number | null;
  onSaved: (newPrice: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentPrice ?? ''));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const num = parseFloat(value.replace(/[₦,\s]/g, ''));
    if (isNaN(num) || num < 0) {
      setError('Invalid price');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateSalePrice({
        transaction_id: transactionId,
        serial_number: serialNumber,
        new_price: num,
      });
      if (result.error) {
        setError(result.error);
      } else {
        onSaved(num);
        setEditing(false);
      }
    });
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setEditing(true); setValue(String(currentPrice ?? '')); }}
        className="inline-flex items-center gap-1.5 text-sm font-mono text-slate-800 hover:text-indigo-600 group transition-colors"
        title="Click to edit price"
      >
        {formatNaira(currentPrice)}
        <Edit3 className="w-3 h-3 text-slate-300 group-hover:text-indigo-400 transition-colors" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₦</span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-28 pl-6 pr-2 py-1 text-sm font-mono border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white"
          autoFocus
        />
      </div>
      <button
        onClick={handleSave}
        disabled={isPending}
        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
      >
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={() => setEditing(false)}
        className="p-1 text-slate-400 hover:bg-slate-100 rounded-md transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
}

// ── SKU Batch Price Editor ────────────────────────────────────
function SkuBatchPriceEditor({
  transactionId,
  sku,
  modelName,
  items,
  onSaved,
}: {
  transactionId: string;
  sku: string;
  modelName: string;
  items: Array<{ serial_number: string; sale_price: number | null }>;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<'total' | 'unit'>('total');
  const [val, setVal] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const currentTotal = items.reduce((sum, i) => sum + (i.sale_price || 0), 0);
  const allPriced = items.every((i) => i.sale_price != null && i.sale_price > 0);

  function handleBatchSave() {
    const raw = parseFloat(val.replace(/[₦,\s]/g, ''));
    if (isNaN(raw) || raw < 0) {
      setError('Please enter a valid positive number');
      return;
    }
    const unitPrice = mode === 'total' ? raw / items.length : raw;
    setError(null);
    startTransition(async () => {
      const result = await batchUpdateSalePrices({
        transaction_id: transactionId,
        serial_numbers: items.map((i) => i.serial_number),
        unit_price: Math.round(unitPrice * 100) / 100,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setVal('');
        onSaved();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-slate-800">{modelName}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600">{sku}</span>
          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
            {items.length} unit{items.length > 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Subtotal: <strong className="font-mono text-emerald-700">{formatNaira(currentTotal)}</strong>
          {!allPriced && (
            <span className="text-amber-600 font-medium ml-1.5">⚠️ Unpriced items</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white text-[11px] shadow-xs">
          <button
            type="button"
            onClick={() => setMode('total')}
            className={`px-2.5 py-1 transition-colors cursor-pointer ${
              mode === 'total'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Total Price
          </button>
          <button
            type="button"
            onClick={() => setMode('unit')}
            className={`px-2.5 py-1 transition-colors cursor-pointer ${
              mode === 'unit'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Unit Price
          </button>
        </div>

        <div className="relative w-36">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">₦</span>
          <input
            type="text"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleBatchSave();
            }}
            placeholder={mode === 'total' ? `Total for ${items.length}` : 'Per unit'}
            className="w-full pl-6 pr-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <button
          type="button"
          onClick={handleBatchSave}
          disabled={isPending || !val.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow-xs cursor-pointer"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Apply
        </button>
      </div>
      {error && <p className="w-full text-[10px] text-red-500">{error}</p>}
    </div>
  );
}

// ── Expandable Sale Row ───────────────────────────────────────
function SaleRow({
  sale,
  onPriceUpdated,
}: {
  sale: SaleRecord;
  onPriceUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const badge = routeBadge[sale.route] || routeBadge.B2C;

  // Group items by SKU for batch editing
  const skuGroups = sale.items.reduce((acc, item) => {
    if (!acc[item.sku]) {
      acc[item.sku] = {
        sku: item.sku,
        model_name: item.model_name,
        items: [],
      };
    }
    acc[item.sku].items.push(item);
    return acc;
  }, {} as Record<string, { sku: string; model_name: string; items: typeof sale.items }>);

  return (
    <>
      <tr
        className="hover:bg-slate-50/60 transition-colors cursor-pointer border-b border-slate-100 last:border-0"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">
          {new Date(sale.created_at).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </td>
        <td className="px-4 py-3.5">
          <span className="text-sm font-mono font-medium text-slate-800">
            {sale.tracking_number || '—'}
          </span>
        </td>
        <td className="px-4 py-3.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge.color}`}>
            {badge.icon}
            {badge.label}
          </span>
        </td>
        <td className="px-4 py-3.5 text-sm text-slate-700 max-w-[180px] truncate">
          {sale.customer_name || <span className="text-slate-300 italic">No customer</span>}
        </td>
        <td className="px-4 py-3.5 text-sm text-slate-600 text-center">
          {sale.items.length}
        </td>
        <td className="px-4 py-3.5 text-sm font-mono font-semibold text-slate-900 text-right">
          {formatNaira(sale.total_sale)}
        </td>
        <td className="px-4 py-3.5 text-center">
          {sale.verified ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
              Pending
            </span>
          )}
        </td>
        <td className="px-4 py-3.5 text-center">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400 inline" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 inline" />
          )}
        </td>
      </tr>

      {/* Expanded Item Details */}
      {expanded && (
        <tr className="bg-slate-50/50">
          <td colSpan={8} className="px-4 py-3">
            <div className="space-y-3">
              {/* Batch price editor per SKU */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">Quick Batch Price Update by Model / SKU:</p>
                {Object.values(skuGroups).map((group) => (
                  <SkuBatchPriceEditor
                    key={group.sku}
                    transactionId={sale.transaction_id}
                    sku={group.sku}
                    modelName={group.model_name}
                    items={group.items}
                    onSaved={onPriceUpdated}
                  />
                ))}
              </div>

              {/* Items List Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Serial Number</th>
                      <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">SKU</th>
                      <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Model</th>
                      <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Sale Price</th>
                      <th className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Cost Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item) => (
                      <tr key={item.serial_number} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2.5 text-xs font-mono text-slate-800">{item.serial_number}</td>
                        <td className="px-4 py-2.5 text-xs font-mono text-slate-600">{item.sku}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{item.model_name}</td>
                        <td className="px-4 py-2.5 text-right">
                          <InlinePriceEditor
                            transactionId={sale.transaction_id}
                            serialNumber={item.serial_number}
                            currentPrice={item.sale_price}
                            onSaved={onPriceUpdated}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono text-slate-500 text-right">
                          {formatNaira(item.cost_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2.5 px-1">
              <span className="text-[10px] text-slate-400">
                Sold by {sale.user_name}
              </span>
              <span className="text-xs font-mono font-semibold text-slate-700">
                Order Total: {formatNaira(sale.total_sale)}
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Sales Page ───────────────────────────────────────────
export default function SalesPage() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [stats, setStats] = useState<{
    total_revenue: number;
    total_cost: number;
    gross_profit: number;
    profit_margin: number;
    units_sold: number;
    transaction_count: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [routeFilter, setRouteFilter] = useState<'all' | 'B2B' | 'B2C'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [exporting, startExport] = useTransition();
  const ITEMS_PER_PAGE = 20;

  async function fetchData() {
    setLoading(true);
    const range = getDateRange(datePreset);
    const route = routeFilter !== 'all' ? routeFilter : undefined;

    const [salesResult, statsResult] = await Promise.all([
      getSales({
        from_date: range.from,
        to_date: range.to,
        route,
        search: searchQuery || undefined,
        limit: ITEMS_PER_PAGE,
        offset: (currentPage - 1) * ITEMS_PER_PAGE,
      }),
      getSalesSummaryStats({
        from_date: range.from,
        to_date: range.to,
        route,
      }),
    ]);

    setSales(salesResult.data);
    setTotalCount(salesResult.total);
    setStats(statsResult.data);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [datePreset, routeFilter, currentPage]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentPage(1);
      fetchData();
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  function handleExport() {
    startExport(async () => {
      const range = getDateRange(datePreset);
      const route = routeFilter !== 'all' ? routeFilter : undefined;
      const result = await exportSalesCSV({ from_date: range.from, to_date: range.to, route });
      if (result.csv) {
        const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `psmi-sales-${datePreset}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;
  const datePresets: { key: DatePreset; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track revenue, profit margins, and sale prices across all B2B and B2C transactions.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || sales.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm flex-shrink-0"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export CSV
        </button>
      </div>

      {/* ── Filters Row ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Date presets */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          {datePresets.map((p) => (
            <button
              key={p.key}
              onClick={() => { setDatePreset(p.key); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                datePreset === p.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Route filter */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          {(['all', 'B2B', 'B2C'] as const).map((r) => (
            <button
              key={r}
              onClick={() => { setRouteFilter(r); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                routeFilter === r
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {r === 'all' ? 'All Routes' : r}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer or tracking #..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Revenue"
          value={stats ? formatNairaCompact(stats.total_revenue) : '—'}
          subtitle={stats ? `${stats.transaction_count} transaction(s)` : undefined}
          icon={<DollarSign className="w-5 h-5" />}
          accent="indigo"
        />
        <KpiCard
          title="Total Cost"
          value={stats ? formatNairaCompact(stats.total_cost) : '—'}
          icon={<ShoppingBag className="w-5 h-5" />}
          accent="amber"
        />
        <KpiCard
          title="Gross Profit"
          value={stats ? formatNairaCompact(stats.gross_profit) : '—'}
          subtitle={stats ? `${stats.profit_margin}% margin` : undefined}
          icon={<TrendingUp className="w-5 h-5" />}
          accent="emerald"
        />
        <KpiCard
          title="Units Sold"
          value={stats ? stats.units_sold.toLocaleString() : '—'}
          icon={<Package className="w-5 h-5" />}
          accent="violet"
        />
      </div>

      {/* ── Sales Table ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Sales Transactions</h2>
              <p className="text-xs text-slate-400">{totalCount} sale(s) found</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No sales found for the selected filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tracking #</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Route</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">Items</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Total (₦)</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">Status</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <SaleRow
                      key={sale.transaction_id}
                      sale={sale}
                      onPriceUpdated={fetchData}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                <span className="text-xs text-slate-400">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
