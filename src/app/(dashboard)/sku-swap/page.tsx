'use client';

// ============================================================
// PSMI System — SKU Swap Tool
// ============================================================
// Standalone tool for correcting SKU assignments on inventory
// units with real serial numbers.
// Three tabs: Single Swap, Bulk Swap, Swap History.
// ============================================================

import { useState, useTransition } from 'react';
import {
  ArrowLeftRight,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Hash,
  FileSpreadsheet,
  Clock,
  ArrowRight,
  Info,
  Layers,
} from 'lucide-react';
import { lookupUnit, swapUnitSku, bulkSwapSku, getSwapHistory } from '@/actions/sku-swap';
import { listProducts } from '@/actions/products';
import type { SkuSwapResult, UnitStatus } from '@/lib/types/database';

type Tab = 'single' | 'bulk' | 'history';

type UnitLookup = {
  serial_number: string;
  sku: string;
  model_name: string;
  model_group: string | null;
  status: UnitStatus;
  location_id: string;
  location_name: string;
  upload_date: string;
  can_swap: boolean;
  block_reason: string | null;
  swap_targets: { sku: string; model_name: string }[];
};

type ProductInfo = {
  sku: string;
  model_name: string;
  model_group?: string | null;
};

// ── Status Badge ──────────────────────────────────────────────
function StatusBadge({ status, canSwap }: { status: string; canSwap: boolean }) {
  const colors = canSwap
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-red-50 text-red-700 border-red-200';

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border ${colors}`}>
      {canSwap ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ── Single Swap Tab ───────────────────────────────────────────
function SingleSwapTab() {
  const [searchInput, setSearchInput] = useState('');
  const [unit, setUnit] = useState<UnitLookup | null>(null);
  const [newSku, setNewSku] = useState('');
  const [reason, setReason] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ old_sku: string; new_sku: string } | null>(null);

  async function handleSearch() {
    if (!searchInput.trim()) return;
    setError(null);
    setUnit(null);
    setSuccess(null);
    setNewSku('');
    setIsSearching(true);

    const result = await lookupUnit(searchInput.trim());
    setIsSearching(false);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setUnit(result.data);
      if (result.data.swap_targets.length > 0) {
        setNewSku(result.data.swap_targets[0].sku);
      }
    }
  }

  function handleSwap() {
    if (!unit || !newSku) return;
    setError(null);

    startTransition(async () => {
      const result = await swapUnitSku({
        serial_number: unit.serial_number,
        new_sku: newSku,
        reason: reason || undefined,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setSuccess(result.data);
        setUnit(null);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Search Bar */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Serial Number</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-400 transition-all">
            <Hash className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter or scan serial number..."
              className="flex-1 bg-transparent text-sm font-mono placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchInput.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Lookup
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-800">SKU swap completed successfully</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-mono font-bold text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
              {success.old_sku}
            </span>
            <ArrowRight className="w-4 h-4 text-emerald-600" />
            <span className="font-mono font-bold text-emerald-700 bg-white px-3 py-1.5 rounded-lg border border-emerald-200">
              {success.new_sku}
            </span>
          </div>
          <button
            onClick={() => {
              setSuccess(null);
              setSearchInput('');
            }}
            className="text-xs text-indigo-600 font-medium hover:underline"
          >
            Swap another unit →
          </button>
        </div>
      )}

      {/* Unit Detail Card */}
      {unit && (
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden border border-slate-100">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{unit.model_name}</p>
                <p className="text-xs font-mono text-slate-500 mt-0.5">{unit.serial_number}</p>
              </div>
              <StatusBadge status={unit.status} canSwap={unit.can_swap} />
            </div>
          </div>

          <div className="px-5 py-4 space-y-3">
            {/* Unit Info Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Current SKU</p>
                <p className="text-sm font-mono font-semibold text-slate-800 mt-0.5">{unit.sku}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Model Group</p>
                <p className="text-sm font-medium text-slate-800 mt-0.5">
                  {unit.model_group || <span className="text-slate-400 italic">None</span>}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Location</p>
                <p className="text-sm text-slate-700 mt-0.5">{unit.location_name}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Upload Date</p>
                <p className="text-sm text-slate-700 mt-0.5">
                  {new Date(unit.upload_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Block Reason */}
            {!unit.can_swap && unit.block_reason && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50/60 border border-red-200/60 rounded-xl text-red-800 text-xs leading-relaxed">
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{unit.block_reason}</span>
              </div>
            )}

            {/* Reserved Warning */}
            {unit.status === 'RESERVED' && unit.can_swap && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50/60 border border-amber-200/60 rounded-xl text-amber-800 text-xs leading-relaxed">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>This unit is currently reserved for a pending order. Swapping the SKU may affect the order.</span>
              </div>
            )}

            {/* No Model Group */}
            {!unit.model_group && unit.can_swap && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50/60 border border-amber-200/60 rounded-xl text-amber-800 text-xs leading-relaxed">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>This product has no model group assigned. Set a model group in Settings to enable swapping between related SKUs.</span>
              </div>
            )}

            {/* Swap Controls */}
            {unit.can_swap && unit.swap_targets.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Swap To</label>
                  <select
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
                  >
                    {unit.swap_targets.map((t) => (
                      <option key={t.sku} value={t.sku}>
                        {t.sku} — {t.model_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Reason (optional)</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Incorrect SKU assigned during inbound"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>

                {/* Preview */}
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl">
                  <span className="text-xs font-semibold text-slate-500">Preview:</span>
                  <span className="font-mono text-sm font-bold text-slate-700">{unit.sku}</span>
                  <ArrowRight className="w-4 h-4 text-indigo-600" />
                  <span className="font-mono text-sm font-bold text-indigo-700">{newSku}</span>
                </div>

                <button
                  onClick={handleSwap}
                  disabled={isPending || !newSku}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                  ) : (
                    <><ArrowLeftRight className="w-4 h-4" /> Confirm SKU Swap</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bulk Swap Tab ─────────────────────────────────────────────
function BulkSwapTab() {
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [fromSku, setFromSku] = useState('');
  const [toSku, setToSku] = useState('');
  const [serialsText, setSerialsText] = useState('');
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ swapped: number; skipped: { serial: string; reason: string }[] } | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load products on first render
  if (!loaded) {
    setLoaded(true);
    listProducts().then((res) => setProducts((res.data || []) as any));
  }

  // Filter target SKUs to same model group
  const fromProduct = products.find((p) => p.sku === fromSku);
  const targetSkus = fromProduct?.model_group
    ? products.filter((p) => p.model_group === fromProduct.model_group && p.sku !== fromSku)
    : [];

  const serialCount = serialsText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean).length;

  function handleBulkSwap() {
    if (!fromSku || !toSku || serialCount === 0) return;
    setError(null);
    setResult(null);

    const serials = serialsText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

    startTransition(async () => {
      const res = await bulkSwapSku({
        serial_numbers: serials,
        from_sku: fromSku,
        to_sku: toSku,
        reason: reason || undefined,
      });

      if (res.error) {
        setError(res.error);
      } else {
        setResult(res);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* From / To Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">From SKU</label>
          <select
            value={fromSku}
            onChange={(e) => {
              setFromSku(e.target.value);
              setToSku('');
              setResult(null);
            }}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
          >
            <option value="">Select source SKU...</option>
            {products
              .filter((p) => p.model_group)
              .map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.sku} — {p.model_name}
                </option>
              ))}
          </select>
          {fromProduct?.model_group && (
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              Model Group: {fromProduct.model_group}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">To SKU</label>
          <select
            value={toSku}
            onChange={(e) => {
              setToSku(e.target.value);
              setResult(null);
            }}
            disabled={!fromSku || targetSkus.length === 0}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono disabled:opacity-50"
          >
            <option value="">
              {!fromSku ? 'Select source first...' : targetSkus.length === 0 ? 'No variants in model group' : 'Select target SKU...'}
            </option>
            {targetSkus.map((p) => (
              <option key={p.sku} value={p.sku}>
                {p.sku} — {p.model_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Serial Numbers Input */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Serial Numbers</label>
        <textarea
          value={serialsText}
          onChange={(e) => setSerialsText(e.target.value)}
          placeholder={`Enter serial numbers, one per line or comma-separated...\ne.g.\nSN001234567890\nSN001234567891`}
          rows={6}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono resize-none"
        />
        <p className="text-[10px] text-slate-400 mt-1">
          {serialCount} serial number{serialCount !== 1 ? 's' : ''} entered
        </p>
      </div>

      {/* Reason */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Reason (optional)</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Batch SKU correction after physical verification"
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
      </div>

      {/* Preview */}
      {fromSku && toSku && serialCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl">
          <span className="text-xs font-semibold text-slate-500">Preview:</span>
          <span className="text-sm text-slate-700">
            <strong>{serialCount}</strong> unit{serialCount !== 1 ? 's' : ''} from
          </span>
          <span className="font-mono text-sm font-bold text-slate-700">{fromSku}</span>
          <ArrowRight className="w-4 h-4 text-indigo-600" />
          <span className="font-mono text-sm font-bold text-indigo-700">{toSku}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleBulkSwap}
        disabled={isPending || !fromSku || !toSku || serialCount === 0}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Processing Bulk Swap…</>
        ) : (
          <><ArrowLeftRight className="w-4 h-4" /> Swap {serialCount} Unit{serialCount !== 1 ? 's' : ''}</>
        )}
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          <div className={`p-4 rounded-xl ${result.skipped.length === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.skipped.length === 0 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              )}
              <p className="text-sm font-semibold text-slate-800">
                {result.swapped} unit{result.swapped !== 1 ? 's' : ''} swapped successfully
                {result.skipped.length > 0 && ` · ${result.skipped.length} skipped`}
              </p>
            </div>

            {result.skipped.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-semibold text-slate-600">Skipped units:</p>
                {result.skipped.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-red-700">
                    <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span><strong className="font-mono">{s.serial}</strong>: {s.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Swap History Tab ──────────────────────────────────────────
function SwapHistoryTab() {
  const [history, setHistory] = useState<SkuSwapResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    setLoaded(true);
    getSwapHistory({ limit: 200 }).then((res) => {
      if (res.error) {
        setError(res.error);
      } else {
        setHistory(res.data);
      }
      setLoading(false);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500 text-sm">{error}</div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 bg-slate-50 rounded-2xl mb-3">
          <Clock className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-sm text-slate-500">No SKU swaps recorded yet</p>
        <p className="text-xs text-slate-400 mt-1">Swaps will appear here after they are performed.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">Serial</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">Old SKU</th>
            <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3"></th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">New SKU</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">Reason</th>
            <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {history.map((entry, i) => (
            <tr key={`${entry.serial_number}-${i}`} className="hover:bg-slate-50/70 transition-colors">
              <td className="p-4">
                <span className="text-sm font-mono font-semibold text-slate-800">{entry.serial_number}</span>
              </td>
              <td className="p-4">
                <span className="text-sm font-mono text-slate-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                  {entry.old_sku}
                </span>
              </td>
              <td className="p-4 text-center">
                <ArrowRight className="w-4 h-4 text-slate-400 mx-auto" />
              </td>
              <td className="p-4">
                <span className="text-sm font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  {entry.new_sku}
                </span>
              </td>
              <td className="p-4">
                <span className="text-xs text-slate-500 truncate max-w-[200px] block">
                  {entry.reason || <span className="italic text-slate-400">—</span>}
                </span>
              </td>
              <td className="p-4 text-right">
                <div className="flex flex-col items-end">
                  <span className="text-sm text-slate-700">
                    {new Date(entry.swapped_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {new Date(entry.swapped_at).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function SkuSwapPage() {
  const [activeTab, setActiveTab] = useState<Tab>('single');

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'single', label: 'Single Swap', icon: ArrowLeftRight },
    { key: 'bulk', label: 'Bulk Swap', icon: FileSpreadsheet },
    { key: 'history', label: 'Swap History', icon: Clock },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          SKU Swap Tool
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Correct SKU assignments on inventory units — swap between variants in the same model group.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.key ? 'text-indigo-600' : ''}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden border border-slate-100">
        <div className="p-5 sm:p-6">
          {activeTab === 'single' && <SingleSwapTab />}
          {activeTab === 'bulk' && <BulkSwapTab />}
          {activeTab === 'history' && <SwapHistoryTab />}
        </div>
      </div>
    </div>
  );
}
