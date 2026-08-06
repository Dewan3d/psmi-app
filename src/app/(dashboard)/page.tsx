// ============================================================
// PSMI System — Home Dashboard Page
// ============================================================
// Server Component — fetches live data via server actions and
// renders KPI cards, transaction overview, and recent activity.
// ============================================================

import {
  getInventoryByLocation,
  getSalesSummary,
  getRecentActivity,
  getLowStockAlerts,
} from '@/actions/dashboard';
import {
  Package,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Boxes,
} from 'lucide-react';

// ── Status badge color map ────────────────────────────────────
const routeLabels: Record<string, { label: string; color: string }> = {
  TB: { label: 'Transfer', color: 'bg-blue-100 text-blue-700' },
  B2B: { label: 'B2B', color: 'bg-violet-100 text-violet-700' },
  B2C: { label: 'B2C', color: 'bg-emerald-100 text-emerald-700' },
  UNKNOWN: { label: 'Unknown', color: 'bg-slate-100 text-slate-600' },
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Mini Sparkline (SVG) ──────────────────────────────────────
function Sparkline({
  data,
  color = '#6366f1',
}: {
  data: number[];
  color?: string;
}) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 32;
  const w = 80;
  const step = w / (data.length - 1);

  const points = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(' ');

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="flex-shrink-0"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default async function DashboardPage() {
  // Fetch all data in parallel
  const [locationData, salesData, activityData, alertData] = await Promise.all([
    getInventoryByLocation(),
    getSalesSummary(),
    getRecentActivity(10),
    getLowStockAlerts(),
  ]);

  // Compute KPI totals from location data
  const totalUnits = locationData.data.reduce(
    (acc, loc) => acc + loc.total_units,
    0
  );
  const totalInWarehouse = locationData.data.reduce(
    (acc, loc) => acc + (loc.status_breakdown.IN_WAREHOUSE || 0),
    0
  );
  const totalSold = salesData.data.total_sold;
  const pendingAlerts = alertData.data.length;

  // Build sparkline from monthly sales data
  const monthlyValues = salesData.data.by_month.map((m) => m.count);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ──────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time overview of your inventory and operations.
        </p>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inventory */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_4px_20px_-5px_rgba(6,81,237,0.15)] transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <Boxes className="w-5 h-5 text-indigo-600" />
            </div>
            <Sparkline data={monthlyValues.length > 1 ? monthlyValues : [0, totalUnits]} color="#6366f1" />
          </div>
          <p className="text-sm font-medium text-slate-500">Total Inventory</p>
          <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">
            {formatNumber(totalUnits)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {formatNumber(totalInWarehouse)} in warehouse
          </p>
        </div>

        {/* Monthly Outbound */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_4px_20px_-5px_rgba(6,81,237,0.15)] transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">
              <ArrowUpRight className="w-3 h-3" />
              {totalSold > 0 ? '+' : ''}
              {totalSold}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-500">Total Outbound</p>
          <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">
            {formatNumber(totalSold)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Verified transactions</p>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_4px_20px_-5px_rgba(6,81,237,0.15)] transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2.5 rounded-xl ${pendingAlerts > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
              <AlertTriangle
                className={`w-5 h-5 ${pendingAlerts > 0 ? 'text-amber-500' : 'text-slate-400'}`}
              />
            </div>
            {pendingAlerts > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">
                Attention
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-500">Low Stock Alerts</p>
          <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">
            {pendingAlerts}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {pendingAlerts > 0
              ? 'Products below threshold'
              : 'All stock levels healthy'}
          </p>
        </div>

        {/* Locations */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_4px_20px_-5px_rgba(6,81,237,0.15)] transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-violet-50 rounded-xl">
              <Package className="w-5 h-5 text-violet-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">
            Active Locations
          </p>
          <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">
            {locationData.data.length}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Warehouses &amp; branches
          </p>
        </div>
      </div>

      {/* ── Main Grid: Transactions + Recent Activity ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transactions Overview (Wide) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">
              Transactions Overview
            </h2>
            <span className="text-xs font-medium text-slate-400">
              Latest activity
            </span>
          </div>

          {activityData.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-slate-50 rounded-2xl mb-3">
                <ShieldCheck className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500">No transactions yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Transactions will appear here as they happen.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                      Type
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                      Route
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                      Tracking #
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                      User
                    </th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                      Items
                    </th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {activityData.data.map((txn) => {
                    const route =
                      routeLabels[txn.route || 'UNKNOWN'] ||
                      routeLabels.UNKNOWN;
                    return (
                      <tr
                        key={txn.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {txn.type === 'INBOUND' ? (
                              <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-blue-500" />
                            )}
                            <span className="text-sm font-medium text-slate-700">
                              {txn.type === 'INBOUND' ? 'Inbound' : 'Outbound'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          {txn.route ? (
                            <span
                              className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${route.color}`}
                            >
                              {route.label}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-slate-600 font-mono">
                            {txn.tracking_number || '—'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-slate-600">
                            {txn.user_name}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className="text-sm font-medium text-slate-700">
                            {txn.item_count}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className="text-xs text-slate-400">
                            {timeAgo(txn.created_at)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity / Low Stock (Side) */}
        <div className="space-y-6">
          {/* Sales by Route */}
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5">
            <h2 className="text-base font-semibold text-slate-800 mb-4">
              Sales by Route
            </h2>
            {salesData.data.by_route.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                No sales data yet
              </p>
            ) : (
              <div className="space-y-3">
                {salesData.data.by_route.map((r) => {
                  const maxCount = Math.max(
                    ...salesData.data.by_route.map((x) => x.count),
                    1
                  );
                  const pct = (r.count / maxCount) * 100;
                  const routeInfo =
                    routeLabels[r.route] || routeLabels.UNKNOWN;
                  return (
                    <div key={r.route}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-slate-600">
                          {routeInfo.label}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">
                          {r.count}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5">
            <h2 className="text-base font-semibold text-slate-800 mb-4">
              Low Stock Alerts
            </h2>
            {alertData.data.length === 0 ? (
              <div className="flex flex-col items-center py-6">
                <ShieldCheck className="w-8 h-8 text-emerald-400 mb-2" />
                <p className="text-sm text-slate-500">All stock levels OK</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alertData.data.slice(0, 5).map((alert) => (
                  <div
                    key={alert.sku}
                    className="flex items-center justify-between p-3 bg-amber-50/60 rounded-xl border border-amber-100"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {alert.model_name}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">
                        {alert.sku}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-sm font-bold text-amber-600">
                        {alert.current_count}
                      </p>
                      <p className="text-xs text-slate-400">
                        / {alert.threshold}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
