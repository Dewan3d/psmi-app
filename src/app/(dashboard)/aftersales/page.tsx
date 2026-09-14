'use client';

// ============================================================
// PSMI System — Aftersales & Replacements Page
// ============================================================
// Handles replacement records for customers who previously bought
// power stations. Supports both linking to previous outbound sales
// and manual entry for older, pre-system sales.
// ============================================================

import { useState, useEffect, useTransition } from 'react';
import {
  RotateCcw,
  Search,
  Plus,
  Calendar,
  User,
  Package,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  FileText,
  Clock,
  Sparkles,
  Link as LinkIcon,
  Tag,
  Truck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  getAftersalesReplacements,
  getAftersalesStats,
  searchOutboundOrdersForReplacement,
  createAftersalesReplacement,
} from '@/actions/aftersales';
import { listProducts } from '@/actions/products';
import {
  AftersalesReplacementWithDetails,
  Product,
} from '@/lib/types/database';
import { useUser } from '../components/user-context';
import ConfirmModal from '../components/confirm-modal';

// ── KPI Card Component ─────────────────────────────────────────
function KpiCard({
  title,
  value,
  subtitle,
  icon,
  accent = 'indigo',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accent?: 'indigo' | 'amber' | 'emerald' | 'violet';
}) {
  const accentClasses = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
  }[accent];

  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2.5 rounded-xl border ${accentClasses}`}>{icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900 tracking-tight">{value}</span>
      </div>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// ── New Replacement Modal ───────────────────────────────────────
function NewReplacementModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { profile } = useUser();
  const [mode, setMode] = useState<'linked' | 'manual'>('linked');

  // Linked order search state
  const [searchOrderQuery, setSearchOrderQuery] = useState('');
  const [isSearchingOrders, setIsSearchingOrders] = useState(false);
  const [matchedOrders, setMatchedOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Form Fields
  const [customerName, setCustomerName] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<
    { original_serial: string; replacement_serial: string; sku: string; model_name?: string }[]
  >([]);

  // Product catalog for manual mode
  const [products, setProducts] = useState<Product[]>([]);
  const [manualSku, setManualSku] = useState('');
  const [manualOriginalSerial, setManualOriginalSerial] = useState('');
  const [manualReplacementSerial, setManualReplacementSerial] = useState('');

  // UI state
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Common pre-filled reasons
  const commonReasons = [
    'Battery Not Charging',
    'Inverter Overload / Trip',
    'Display Not Turning On',
    'Dead on Arrival',
    'Warranty Exchange',
    'Unit Swapped on Request',
  ];

  useEffect(() => {
    async function loadProds() {
      const res = await listProducts();
      if (res.data) setProducts(res.data);
    }
    loadProds();
  }, []);

  // Search orders when typing in linked mode
  useEffect(() => {
    if (mode !== 'linked' || !searchOrderQuery.trim()) {
      setMatchedOrders([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingOrders(true);
      const res = await searchOutboundOrdersForReplacement(searchOrderQuery);
      setIsSearchingOrders(false);
      if (res.data) setMatchedOrders(res.data);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchOrderQuery, mode]);

  function handleSelectOrder(order: any) {
    setSelectedOrder(order);
    setCustomerName(order.customer_name || '');
    // Pre-populate items from the order
    setItems(
      order.items.map((item: any) => ({
        original_serial: item.serial_number,
        replacement_serial: '',
        sku: item.sku,
        model_name: item.model_name,
      }))
    );
  }

  function handleAddManualItem() {
    if (!manualOriginalSerial.trim()) {
      setError('Please enter the original serial number');
      return;
    }
    if (!manualSku) {
      setError('Please select the product model / SKU');
      return;
    }
    if (!manualReplacementSerial.trim()) {
      setError('Please enter the replacement unit serial number');
      return;
    }

    const prod = products.find((p) => p.sku === manualSku);

    setItems((prev) => [
      ...prev,
      {
        original_serial: manualOriginalSerial.trim(),
        replacement_serial: manualReplacementSerial.trim(),
        sku: manualSku,
        model_name: prod?.model_name || manualSku,
      },
    ]);

    setManualOriginalSerial('');
    setManualReplacementSerial('');
    setError(null);
  }

  function handleRemoveItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function handlePreSubmit() {
    setError(null);
    if (!customerName.trim()) {
      setError('Please enter the customer name');
      return;
    }
    if (!reason.trim()) {
      setError('Please enter or select the reason for replacement');
      return;
    }
    if (items.length === 0) {
      setError('Add at least one unit to be replaced');
      return;
    }

    // Check if any replacement serial is empty
    const missingReplacement = items.some((i) => !i.replacement_serial?.trim());
    if (missingReplacement) {
      setError('Please provide a replacement serial number for every unit being returned');
      return;
    }

    setShowConfirm(true);
  }

  function handleConfirmedSubmit() {
    startTransition(async () => {
      const result = await createAftersalesReplacement({
        linked_transaction_id: selectedOrder?.transaction_id || null,
        customer_name: customerName.trim(),
        reason: reason.trim(),
        notes: notes.trim() || null,
        user_id: profile?.id || '',
        items: items.map((i) => ({
          original_serial: i.original_serial.trim(),
          replacement_serial: i.replacement_serial.trim(),
          sku: i.sku,
        })),
      });

      if (result.error) {
        setError(result.error);
        setShowConfirm(false);
        return;
      }

      setShowConfirm(false);
      onSuccess();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Record Aftersales Replacement
              </h2>
              <p className="text-xs text-slate-500">
                Log a unit replacement for an existing customer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Mode Selector Tabs */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Replacement Source
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setMode('linked');
                  setError(null);
                }}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  mode === 'linked'
                    ? 'bg-white text-indigo-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                Link to Previous Outbound Sale
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('manual');
                  setSelectedOrder(null);
                  setError(null);
                }}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  mode === 'manual'
                    ? 'bg-white text-indigo-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                Manual Entry (Pre-system Sales)
              </button>
            </div>
          </div>

          {/* Mode A: Search & Link Outbound Sale */}
          {mode === 'linked' && (
            <div className="space-y-3 p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-indigo-600" /> Search Previous Sale
                </span>
                {selectedOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrder(null);
                      setItems([]);
                      setCustomerName('');
                    }}
                    className="text-[11px] text-rose-600 hover:underline"
                  >
                    Clear Selected Order
                  </button>
                )}
              </div>

              {!selectedOrder ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchOrderQuery}
                      onChange={(e) => setSearchOrderQuery(e.target.value)}
                      placeholder="Type customer name, tracking #, or serial number..."
                      className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    {isSearchingOrders && (
                      <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>

                  {matchedOrders.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-white shadow-xs">
                      {matchedOrders.map((ord) => (
                        <div
                          key={ord.transaction_id}
                          onClick={() => handleSelectOrder(ord)}
                          className="p-2.5 hover:bg-indigo-50/60 rounded-lg cursor-pointer border border-transparent hover:border-indigo-100 transition-all text-xs flex items-center justify-between"
                        >
                          <div>
                            <p className="font-semibold text-slate-800">
                              {ord.customer_name || 'Customer'}
                              <span className="font-mono text-slate-400 font-normal ml-2">
                                ({ord.tracking_number || 'No tracking #'})
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {ord.sales_manager ? `Sales Rep: ${ord.sales_manager} • ` : ''}
                              {ord.items.length} item(s) •{' '}
                              {new Date(ord.created_at).toLocaleDateString('en-GB')}
                            </p>
                          </div>
                          <span className="text-indigo-600 font-medium flex items-center gap-1">
                            Select <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchOrderQuery && !isSearchingOrders && matchedOrders.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-2">
                      No matching outbound order found. You can switch to manual entry above.
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-white border border-indigo-100 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-950">
                      Linked Order: {selectedOrder.tracking_number || selectedOrder.transaction_id}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-medium">
                      {selectedOrder.route || 'OUTBOUND'}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    Customer: <strong>{selectedOrder.customer_name}</strong>
                  </p>
                  {selectedOrder.sales_manager && (
                    <p className="text-slate-600">
                      Sales Manager: <strong>{selectedOrder.sales_manager}</strong>
                    </p>
                  )}
                  <p className="text-slate-400 text-[11px]">
                    Date: {new Date(selectedOrder.created_at).toLocaleDateString('en-GB')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Customer Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Dangote Cement, Chief Adeleke"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {/* Units to Replace List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Units Being Replaced ({items.length}) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">Original Unit ➔ New Replacement Unit</span>
            </div>

            {items.length > 0 ? (
              <div className="space-y-2.5">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        {item.model_name || item.sku}
                        <span className="font-mono text-slate-400 font-normal ml-1">({item.sku})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium">Original Serial (Faulty)</span>
                        <input
                          type="text"
                          value={item.original_serial}
                          disabled={mode === 'linked'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, original_serial: val } : it))
                            );
                          }}
                          className="w-full mt-0.5 px-3 py-1.5 font-mono text-xs border border-slate-200 rounded-lg bg-white disabled:bg-slate-100"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-indigo-600 font-medium">New Replacement Serial</span>
                        <input
                          type="text"
                          placeholder="Scan or type new unit SN..."
                          value={item.replacement_serial}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, replacement_serial: val } : it))
                            );
                          }}
                          className="w-full mt-0.5 px-3 py-1.5 font-mono text-xs border border-indigo-200 bg-indigo-50/30 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                {mode === 'linked'
                  ? 'Select an order above to pull items, or add items manually.'
                  : 'No items added yet. Use the form below to add a replacement.'}
              </div>
            )}

            {/* Add item input row for manual mode (or additional item in linked mode) */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5">
              <span className="text-xs font-semibold text-slate-700">Add Unit to Replace:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={manualSku}
                  onChange={(e) => setManualSku(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Select Model / SKU...</option>
                  {products.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.model_name} ({p.sku})
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Original Serial #"
                  value={manualOriginalSerial}
                  onChange={(e) => setManualOriginalSerial(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                />

                <input
                  type="text"
                  placeholder="New Serial #"
                  value={manualReplacementSerial}
                  onChange={(e) => setManualReplacementSerial(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleAddManualItem}
                className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add This Item
              </button>
            </div>
          </div>

          {/* Reason for Replacement */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason for Replacement <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Battery capacity degraded below 50%"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {commonReasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                    reason === r
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Additional Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any diagnostic notes, warranty terms, or RMA details..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePreSubmit}
            disabled={isPending}
            className="px-5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-xs shadow-indigo-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Confirm Replacement
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmedSubmit}
        isLoading={isPending}
        title="Confirm Unit Replacement"
        message={
          <div className="space-y-3 text-xs text-slate-700">
            <p>
              Are you sure you want to log this aftersales replacement for{' '}
              <strong className="text-slate-900">{customerName}</strong>?
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <p>
                <strong className="text-slate-900">Reason:</strong> {reason}
              </p>
              <p>
                <strong className="text-slate-900">Units ({items.length}):</strong>
              </p>
              <ul className="space-y-1 pl-2">
                {items.map((it, idx) => (
                  <li key={idx} className="font-mono text-[11px] text-slate-600">
                    {it.original_serial} ➔ <strong className="text-indigo-600">{it.replacement_serial}</strong>{' '}
                    ({it.sku})
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[11px] text-slate-500">
              The replacement units will be marked as issued/sold, and returned units will be tracked as damaged/in-repair.
            </p>
          </div>
        }
        confirmText="Yes, Issue Replacement"
      />
    </div>
  );
}

// ── Main Page Component ─────────────────────────────────────────
export default function AftersalesPage() {
  const { isViewer } = useUser();
  const [replacements, setReplacements] = useState<AftersalesReplacementWithDetails[]>([]);
  const [stats, setStats] = useState<{
    totalReplacements: number;
    replacementsThisMonth: number;
    unitsReplaced: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [repRes, statRes] = await Promise.all([
      getAftersalesReplacements({ search: searchQuery.trim() || undefined }),
      getAftersalesStats(),
    ]);

    if (repRes.error) {
      setError(repRes.error);
    } else {
      setReplacements(repRes.data);
    }

    if (statRes.data) {
      setStats(statRes.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [searchQuery]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <RotateCcw className="w-6 h-6 text-indigo-600" />
            Aftersales & Replacements
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track and dispatch replacement units for warranty claims and returning customers.
          </p>
        </div>

        {!isViewer && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 rounded-xl text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Record Replacement
          </button>
        )}
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Total Replacements"
          value={stats ? stats.totalReplacements.toLocaleString() : '—'}
          subtitle="All replacement claims recorded"
          icon={<RotateCcw className="w-5 h-5" />}
          accent="indigo"
        />
        <KpiCard
          title="Replacements This Month"
          value={stats ? stats.replacementsThisMonth.toLocaleString() : '—'}
          subtitle="Processed this calendar month"
          icon={<Calendar className="w-5 h-5" />}
          accent="amber"
        />
        <KpiCard
          title="Total Units Replaced"
          value={stats ? stats.unitsReplaced.toLocaleString() : '—'}
          subtitle="Physical units exchanged"
          icon={<Package className="w-5 h-5" />}
          accent="violet"
        />
      </div>

      {/* ── Search & Filter Bar ───────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer, reason, or serial number..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-xs"
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

      {/* ── Replacements Table ────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Replacement History</h2>
              <p className="text-xs text-slate-400">{replacements.length} record(s) found</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-5 text-center text-red-500 bg-red-50/50">Failed to load: {error}</div>
        ) : replacements.length === 0 ? (
          <div className="text-center py-16">
            <RotateCcw className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No aftersales replacements recorded yet.</p>
            {!isViewer && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 text-sm text-indigo-600 font-medium hover:underline cursor-pointer"
              >
                Log your first replacement →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Linked Order / Rep</th>
                  <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Reason</th>
                  <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">Units</th>
                  <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Handled By</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {replacements.map((rep) => {
                  const isExpanded = expandedId === rep.id;
                  return (
                    <tr
                      key={rep.id}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                      onClick={() => setExpandedId(isExpanded ? null : rep.id)}
                    >
                      <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                        {new Date(rep.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-sm font-semibold text-slate-800">
                            {rep.customer_name}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        {rep.linked_transaction ? (
                          <div className="flex flex-col">
                            <span className="font-mono font-medium text-indigo-700 flex items-center gap-1">
                              <LinkIcon className="w-3 h-3" />
                              {rep.linked_transaction.tracking_number || 'Linked Order'}
                            </span>
                            {rep.linked_transaction.sales_manager && (
                              <span className="text-[11px] text-slate-400 mt-0.5">
                                Sold by: {rep.linked_transaction.sales_manager}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Manual Entry</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                          {rep.reason}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-full">
                          {rep.items.length} unit(s)
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        {rep.profiles?.full_name || 'Staff'}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 inline" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 inline" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Expanded View for Detailed Inspection */}
        {expandedId && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
            {(() => {
              const rep = replacements.find((r) => r.id === expandedId);
              if (!rep) return null;
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Replacement Units Breakdown for {rep.customer_name}:
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Claim logged on {new Date(rep.created_at).toLocaleString('en-GB')}
                    </span>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 font-semibold text-slate-500">Model / SKU</th>
                          <th className="px-3 py-2 font-semibold text-slate-500 font-mono">Original Serial (Faulty)</th>
                          <th className="px-3 py-2 font-semibold text-indigo-600 font-mono">New Replacement Serial</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rep.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2 font-medium text-slate-800">
                              {item.product?.model_name || item.sku} ({item.sku})
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-600">
                              {item.original_serial}
                            </td>
                            <td className="px-3 py-2 font-mono font-semibold text-indigo-700">
                              {item.replacement_serial || 'Pending assignment'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {rep.notes && (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-600">
                      <strong className="text-slate-800">Internal Notes:</strong> {rep.notes}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <NewReplacementModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
