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
  FileSpreadsheet,
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
  CreditCard,
  FileText,
  Sliders,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  getSales,
  getSalesSummaryStats,
  updateSalePrice,
  updateSaleDate,
  batchUpdateSalePrices,
  updateSaleNotes,
  updateSalePayment,
  exportSalesCSV,
  exportSalesXLSX,
} from '@/actions/sales';
import { formatNaira, formatNairaCompact } from '@/lib/utils/currency';
import { SaleRecord } from '@/lib/types/database';
import { useUser } from '../components/user-context';

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
  const { isViewer } = useUser();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentPrice ?? ''));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isViewer) {
    return (
      <span className="text-sm font-mono text-slate-800">
        {formatNaira(currentPrice)}
      </span>
    );
  }

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

// ── Inline Date of Sale Editor ─────────────────────────────────
function InlineDateEditor({
  transactionId,
  currentDate,
  onSaved,
}: {
  transactionId: string;
  currentDate: string;
  onSaved: () => void;
}) {
  const { isViewer } = useUser();
  const [editing, setEditing] = useState(false);
  const initialDateStr = (() => {
    try {
      return new Date(currentDate).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  })();
  const [dateValue, setDateValue] = useState(initialDateStr);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const displayFormatted = (() => {
    try {
      return new Date(currentDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return currentDate;
    }
  })();

  if (isViewer) {
    return (
      <span className="text-sm text-slate-600 whitespace-nowrap">
        {displayFormatted}
      </span>
    );
  }

  function handleSave(e?: React.MouseEvent | React.FormEvent) {
    if (e) e.stopPropagation();
    if (!dateValue) {
      setError('Required');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateSaleDate({
        transaction_id: transactionId,
        sold_at: dateValue,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setEditing(false);
        onSaved();
      }
    });
  }

  if (!editing) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="group inline-flex items-center gap-1.5 text-sm text-slate-700 hover:text-indigo-600 transition-colors whitespace-nowrap"
        title="Click to edit date of sale"
      >
        <span>{displayFormatted}</span>
        <Calendar className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
      </button>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1 bg-white p-1 rounded-lg border border-indigo-200 shadow-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="date"
        value={dateValue}
        onChange={(e) => setDateValue(e.target.value)}
        className="px-1.5 py-0.5 text-xs text-slate-800 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        autoFocus
      />
      <button
        onClick={handleSave}
        disabled={isPending}
        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
        title="Save date"
      >
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(false);
        }}
        className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors"
        title="Cancel"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {error && <span className="text-[10px] text-rose-500">{error}</span>}
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
            className={`px-2.5 py-1 transition-colors cursor-pointer ${mode === 'total'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            Total Price
          </button>
          <button
            type="button"
            onClick={() => setMode('unit')}
            className={`px-2.5 py-1 transition-colors cursor-pointer ${mode === 'unit'
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

// ── Admin-Only Edit Payment Modal ───────────────────────────────
function EditPaymentModal({
  sale,
  isOpen,
  onClose,
  onSaved,
}: {
  sale: SaleRecord;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [totalOrderAmount, setTotalOrderAmount] = useState(
    sale.total_order_amount != null ? String(sale.total_order_amount) : String(sale.total_sale)
  );
  const [amountPaid, setAmountPaid] = useState(
    sale.amount_paid != null ? String(sale.amount_paid) : (sale.verified ? String(sale.total_sale) : '0')
  );
  const [totalUnitsOrdered, setTotalUnitsOrdered] = useState(
    sale.total_units_ordered != null ? String(sale.total_units_ordered) : String(sale.items.length)
  );
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PARTIAL' | 'PENDING'>(
    sale.payment_status || (sale.verified ? 'PAID' : 'PENDING')
  );
  const [notes, setNotes] = useState(sale.notes || '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const paidNum = parseFloat(amountPaid.replace(/[₦,\s]/g, ''));
    const totalNum = parseFloat(totalOrderAmount.replace(/[₦,\s]/g, ''));
    const unitsNum = parseInt(totalUnitsOrdered, 10);

    if (isNaN(paidNum) || paidNum < 0) {
      setError('Amount paid must be a valid non-negative number.');
      return;
    }
    if (isNaN(totalNum) || totalNum < 0) {
      setError('Total order amount must be a valid non-negative number.');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await updateSalePayment({
        transaction_id: sale.transaction_id,
        amount_paid: paidNum,
        payment_status: paymentStatus,
        total_order_amount: totalNum,
        total_units_ordered: !isNaN(unitsNum) && unitsNum > 0 ? unitsNum : sale.items.length,
        notes,
      });

      if (res.error) {
        setError(res.error);
      } else {
        onSaved();
        onClose();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Edit Payment & Terms</h3>
              <p className="text-xs text-slate-500">
                Tracking #{sale.tracking_number || sale.transaction_id.slice(0, 8)} • Admin Exclusive
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Agreed Total Order Amount (₦)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">₦</span>
                <input
                  type="text"
                  value={totalOrderAmount}
                  onChange={(e) => setTotalOrderAmount(e.target.value)}
                  placeholder="e.g. 100,000"
                  className="w-full pl-7 pr-3 py-2 text-sm font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Released Items Value: {formatNaira(sale.total_sale)}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Total Units in Agreement
              </label>
              <input
                type="number"
                min={sale.items.length}
                value={totalUnitsOrdered}
                onChange={(e) => setTotalUnitsOrdered(e.target.value)}
                placeholder={String(sale.items.length)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Currently Released: {sale.items.length} unit{sale.items.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount Paid So Far (₦)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">₦</span>
                <input
                  type="text"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 text-sm font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-medium"
              >
                <option value="PAID">Paid in Full</option>
                <option value="PARTIAL">Installment / Partial</option>
                <option value="PENDING">Pending / Unpaid</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment / Terms Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Customer paid initial ₦30k transfer on Sept 23; 3 units released. Balance of ₦70k due on Oct 15 before remaining 7 units can be dispatched."
              className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Payment Details
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Inline Note Editor Component ──────────────────────────────
function SaleNotesSection({
  sale,
  onSaved,
}: {
  sale: SaleRecord;
  onSaved: () => void;
}) {
  const { isViewer } = useUser();
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState(sale.notes || '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSaveNote() {
    setError(null);
    startTransition(async () => {
      const res = await updateSaleNotes({
        transaction_id: sale.transaction_id,
        notes: noteText,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setEditing(false);
        onSaved();
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Sale Notes & Terms</h4>
        </div>
        {!isViewer && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            {sale.notes ? 'Edit Notes' : 'Add Notes'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            rows={3}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Record agreement terms, installment schedules, customer notes, or delivery instructions..."
            className="w-full p-2.5 text-xs text-slate-800 border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-indigo-50/10 resize-none"
            autoFocus
          />
          {error && <p className="text-[10px] text-rose-500">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setNoteText(sale.notes || '');
              }}
              className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveNote}
              disabled={isPending}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save Notes
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
          {sale.notes ? (
            sale.notes
          ) : (
            <span className="text-slate-400 italic">No notes recorded for this transaction yet.</span>
          )}
        </p>
      )}
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
  const { isViewer, isAdmin } = useUser();
  const [expanded, setExpanded] = useState(false);
  const [showDevicePrices, setShowDevicePrices] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

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

  // Financial calculations with backwards-compatible defaults
  const totalAgreed = sale.total_order_amount ?? sale.total_sale;
  const unitsAgreed = sale.total_units_ordered ?? sale.items.length;
  const amountPaid = sale.amount_paid ?? (sale.verified ? totalAgreed : 0);
  const balanceRemaining = Math.max(0, totalAgreed - amountPaid);
  const paymentStatus = sale.payment_status || (sale.verified ? 'PAID' : (amountPaid > 0 ? 'PARTIAL' : 'PENDING'));

  const paymentStatusConfig = {
    PAID: {
      label: 'Paid in Full',
      color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
    },
    PARTIAL: {
      label: 'Installment / Partial',
      color: 'bg-amber-100 text-amber-800 border-amber-200',
      icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
    },
    PENDING: {
      label: 'Pending Payment',
      color: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: <AlertCircle className="w-3.5 h-3.5 text-slate-500" />,
    },
  }[paymentStatus] || {
    label: 'Pending',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <AlertCircle className="w-3.5 h-3.5 text-slate-500" />,
  };

  return (
    <>
      <tr
        className="hover:bg-slate-50/60 transition-colors cursor-pointer border-b border-slate-100 last:border-0"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">
          <InlineDateEditor
            transactionId={sale.transaction_id}
            currentDate={sale.sold_at || sale.created_at}
            onSaved={onPriceUpdated}
          />
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
        <td className="px-4 py-3.5 text-sm text-slate-700 max-w-[160px] truncate">
          {sale.sales_manager ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
              {sale.sales_manager}
            </span>
          ) : (
            <span className="text-slate-300 italic">—</span>
          )}
        </td>
        <td className="px-4 py-3.5 text-sm text-slate-600 text-center">
          {sale.items.length}
          {unitsAgreed > sale.items.length && (
            <span className="text-[11px] text-slate-400 font-mono"> / {unitsAgreed}</span>
          )}
        </td>
        <td className="px-4 py-3.5 text-sm font-mono font-semibold text-slate-900 text-right">
          {formatNaira(totalAgreed)}
        </td>
        <td className="px-4 py-3.5 text-center">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${paymentStatusConfig.color}`}>
            {paymentStatusConfig.icon}
            {paymentStatusConfig.label}
          </span>
        </td>
        <td className="px-4 py-3.5 text-center">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400 inline" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 inline" />
          )}
        </td>
      </tr>

      {/* Expanded Order Overview & Details */}
      {expanded && (
        <tr className="bg-slate-50/50">
          <td colSpan={9} className="px-4 py-4">
            <div className="space-y-4">
              {/* ── 1. Order Overview Top Cards ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Order & Customer Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer & Sales Rep</p>
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {sale.customer_name || 'No Customer Specified'}
                    </p>
                    <p className="text-xs text-slate-600">
                      Sales Rep: <strong className="text-slate-800">{sale.sales_manager || 'Not Assigned'}</strong>
                    </p>
                  </div>
                  <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Route: <strong className="text-slate-700">{sale.route}</strong></span>
                    <span>Tracking: <strong className="font-mono text-slate-700">{sale.tracking_number || '—'}</strong></span>
                  </div>
                </div>

                {/* Financial & Terms Status Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment Overview</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${paymentStatusConfig.color}`}>
                        {paymentStatusConfig.label}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-xs text-slate-500">Total Agreed:</span>
                      <span className="text-sm font-mono font-bold text-slate-900">{formatNaira(totalAgreed)}</span>
                    </div>
                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="text-xs text-slate-500">Paid so far:</span>
                      <span className="text-xs font-mono font-semibold text-emerald-700">{formatNaira(amountPaid)}</span>
                    </div>
                    {balanceRemaining > 0 && (
                      <div className="flex items-baseline justify-between mt-0.5">
                        <span className="text-xs text-slate-500">Balance Due:</span>
                        <span className="text-xs font-mono font-semibold text-rose-600">{formatNaira(balanceRemaining)}</span>
                      </div>
                    )}
                  </div>
                  <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Released: <strong className="font-semibold text-indigo-700">{sale.items.length} of {unitsAgreed} Units</strong></span>
                    <span className="text-[10px] text-slate-400">
                      {unitsAgreed > sale.items.length ? '⚠️ Partial Release' : '✓ Fully Released'}
                    </span>
                  </div>
                </div>

                {/* Actions & Control Panel Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Actions</p>
                    <div className="flex flex-col gap-2">
                      {/* Admin-Only Edit Payment Button */}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setIsPaymentModalOpen(true)}
                          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Edit Payment & Terms</span>
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-indigo-800/60 ml-auto font-mono">
                            Admin
                          </span>
                        </button>
                      )}

                      {/* Admin-Only Modify Device Prices Toggle */}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setShowDevicePrices(!showDevicePrices)}
                          className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors border cursor-pointer ${
                            showDevicePrices
                              ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Sliders className="w-3.5 h-3.5 text-slate-400" />
                          <span>{showDevicePrices ? 'Hide Device Prices' : 'Modify Device Prices'}</span>
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 ml-auto font-mono">
                            Admin
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 mt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Recorded by {sale.user_name}</span>
                    {sale.verified && <span className="text-emerald-600 font-medium">✓ Verified</span>}
                  </div>
                </div>
              </div>

              {/* ── 2. Dedicated Notes & Terms Section ── */}
              <SaleNotesSection sale={sale} onSaved={onPriceUpdated} />

              {/* ── 3. Released Devices Table & Batch Price Adjuster (ADMIN ONLY & ON-DEMAND) ── */}
              {isAdmin && showDevicePrices && (
                <div className="space-y-3 pt-1 animate-in fade-in-50 duration-150">
                  {/* Batch price editor per SKU */}
                  <div className="p-3.5 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-800">Quick Batch Price Update by Model / SKU:</p>
                      <span className="text-[10px] text-indigo-600 font-medium">Applies to released units below</span>
                    </div>
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

                  {/* Released Items List Table */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs font-bold text-slate-700">
                          Released Devices ({sale.items.length} item{sale.items.length > 1 ? 's' : ''})
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        Released Subtotal: <strong className="text-slate-800">{formatNaira(sale.total_sale)}</strong>
                      </span>
                    </div>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-white border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="px-4 py-2">Serial Number</th>
                          <th className="px-4 py-2">SKU</th>
                          <th className="px-4 py-2">Model</th>
                          <th className="px-4 py-2 text-right">Sale Price</th>
                          <th className="px-4 py-2 text-right">Cost Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sale.items.map((item) => (
                          <tr key={item.serial_number} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="px-4 py-2 text-xs font-mono text-slate-800">{item.serial_number}</td>
                            <td className="px-4 py-2 text-xs font-mono text-slate-600">{item.sku}</td>
                            <td className="px-4 py-2 text-xs text-slate-600">{item.model_name}</td>
                            <td className="px-4 py-2 text-right">
                              <InlinePriceEditor
                                transactionId={sale.transaction_id}
                                serialNumber={item.serial_number}
                                currentPrice={item.sale_price}
                                onSaved={onPriceUpdated}
                              />
                            </td>
                            <td className="px-4 py-2 text-xs font-mono text-slate-500 text-right">
                              {formatNaira(item.cost_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}

      {/* Admin Payment Modal */}
      {isAdmin && isPaymentModalOpen && (
        <EditPaymentModal
          sale={sale}
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          onSaved={onPriceUpdated}
        />
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
    cash_collected: number;
    balance_due: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [routeFilter, setRouteFilter] = useState<'all' | 'B2B' | 'B2C'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'xlsx' | null>(null);
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

  async function handleExport(format: 'csv' | 'xlsx') {
    if (exportingFormat) return;
    setExportingFormat(format);
    try {
      const range = getDateRange(datePreset);
      const route = routeFilter !== 'all' ? routeFilter : undefined;
      const search = searchQuery || undefined;
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'csv') {
        const result = await exportSalesCSV({
          from_date: range.from,
          to_date: range.to,
          route,
          search,
        });
        if (result.csv) {
          const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `psmi-sales-${datePreset}-${dateStr}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } else {
        const result = await exportSalesXLSX({
          from_date: range.from,
          to_date: range.to,
          route,
          search,
        });
        if (result.base64) {
          const byteCharacters = atob(result.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `psmi-sales-${datePreset}-${dateStr}.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExportingFormat(null);
    }
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
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleExport('csv')}
            disabled={!!exportingFormat || sales.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all shadow-xs flex-shrink-0 cursor-pointer"
            title="Export sales data as CSV spreadsheet"
          >
            {exportingFormat === 'csv' ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
            ) : (
              <Download className="w-4 h-4 text-slate-500" />
            )}
            Export CSV
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            disabled={!!exportingFormat || sales.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm shadow-emerald-200 flex-shrink-0 cursor-pointer"
            title="Export sales data as formatted Excel Table (.xlsx)"
          >
            {exportingFormat === 'xlsx' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            Export Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* ── Filters Row ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Date presets */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          {datePresets.map((p) => (
            <button
              key={p.key}
              onClick={() => { setDatePreset(p.key); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${datePreset === p.key
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
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${routeFilter === r
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
            placeholder="Search customer, sales manager, or tracking #..."
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
          title="Cash Collected"
          value={stats ? formatNairaCompact(stats.cash_collected) : '—'}
          subtitle={stats && stats.total_revenue > 0 ? `${Math.round((stats.cash_collected / stats.total_revenue) * 100)}% of total sales` : undefined}
          icon={<CheckCircle2 className="w-5 h-5" />}
          accent="emerald"
        />
        <KpiCard
          title="Balance Due"
          value={stats ? formatNairaCompact(stats.balance_due) : '—'}
          subtitle={stats && stats.balance_due > 0 ? 'Pending installment payments' : 'All accounts settled'}
          icon={<Clock className="w-5 h-5" />}
          accent="amber"
        />
        <KpiCard
          title="Units Sold"
          value={stats ? stats.units_sold.toLocaleString() : '—'}
          subtitle={stats ? `${stats.gross_profit > 0 ? `${stats.profit_margin}% margin` : 'Released items'}` : undefined}
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
                    <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Sales Manager</th>
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
