// ============================================================
// PSMI System — Inbound Batch Detail Page
// ============================================================
// Shows all units in an inbound receipt and allows assigning
// real serial numbers to PENDING_SERIAL placeholder slots.
// ============================================================

'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Loader2,
  Upload,
  ClipboardList,
  Hash,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react';
import { getInboundTransaction, assignSerialNumber, bulkAssignSerials, deleteInboundTransaction } from '@/actions/inbound';
import { createClient } from '@/lib/supabase/client';
import ConfirmModal from '../../components/confirm-modal';
import FeedbackModal from '../../components/feedback-modal';

type InboundDetail = {
  id: string;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  location_name: string;
  user_name: string;
  total_items?: number;
  pending_items?: number;
  is_non_serialized?: boolean;
  items: {
    serial_number: string;
    is_pending: boolean;
    status: string;
    sku: string;
  }[];
};

// ── Single Serial Assignment Row ──────────────────────────────
function SerialAssignmentRow({
  placeholder,
  transactionId,
  onAssigned,
  skuOptions,
  defaultSku,
}: {
  placeholder: string;
  transactionId: string;
  onAssigned: () => void;
  skuOptions: { sku: string; model_name: string }[];
  defaultSku: string;
}) {
  const [inputSerial, setInputSerial] = useState('');
  const [selectedSku, setSelectedSku] = useState(defaultSku);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const showSkuPicker = skuOptions.length > 1;

  function handleAssign() {
    if (!inputSerial.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await assignSerialNumber({
        placeholder_serial: placeholder,
        real_serial: inputSerial.trim(),
        transaction_id: transactionId,
        sku_override: selectedSku !== defaultSku ? selectedSku : undefined,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setDone(true);
        onAssigned();
      }
    });
  }

  if (done) {
    return (
      <div className="flex items-center gap-3 py-2.5 px-4 bg-emerald-50 border border-emerald-100 rounded-xl">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="text-sm font-mono text-emerald-800">{inputSerial}</span>
        <span className="text-xs text-emerald-600 ml-auto">Assigned ✓</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 p-2 border border-amber-200 bg-amber-50/50 rounded-xl">
          <Hash className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <input
            type="text"
            value={inputSerial}
            onChange={(e) => setInputSerial(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAssign()}
            placeholder="Scan or type serial number…"
            className="flex-1 bg-transparent text-sm font-mono placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        {showSkuPicker && (
          <select
            value={selectedSku}
            onChange={(e) => setSelectedSku(e.target.value)}
            className="px-2 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono max-w-[140px]"
            title="SKU for this serial"
          >
            {skuOptions.map((opt) => (
              <option key={opt.sku} value={opt.sku}>
                {opt.sku}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={handleAssign}
          disabled={isPending || !inputSerial.trim()}
          className="px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 pl-2">{error}</p>
      )}
    </div>
  );
}

// ── Bulk CSV Assignment ───────────────────────────────────────
function BulkAssignPanel({
  transactionId,
  pendingCount,
  onComplete,
  onNotify,
  skuOptions,
  defaultSku,
}: {
  transactionId: string;
  pendingCount: number;
  onComplete: () => void;
  onNotify: (info: { type: 'success' | 'error' | 'info'; title: string; message: React.ReactNode }) => void;
  skuOptions: { sku: string; model_name: string }[];
  defaultSku: string;
}) {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState('');
  const [selectedSku, setSelectedSku] = useState(defaultSku);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ assigned: number; pending_remaining?: number; errors: { serial: string; error: string }[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showSkuPicker = skuOptions.length > 1;

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const lines = content
        .split(/[\r\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (lines.length === 0) {
        onNotify({
          type: 'error',
          title: 'Empty File',
          message: 'The uploaded file does not contain any serial numbers.',
        });
        return;
      }

      setText((prev) => {
        const existing = prev.trim();
        return existing ? `${existing}\n${lines.join('\n')}` : lines.join('\n');
      });

      onNotify({
        type: 'info',
        title: 'File Loaded',
        message: `Loaded ${lines.length.toLocaleString()} serial number(s) from "${file.name}". Click "Assign All" to assign them.`,
      });
    };
    reader.readAsText(file);
    // Reset file input value so the same file can be selected again if needed
    e.target.value = '';
  }

  function handleBulkAssign() {
    const serials = text.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (serials.length === 0) return;

    startTransition(async () => {
      const res = await bulkAssignSerials({
        transaction_id: transactionId,
        real_serials: serials,
        sku_override: selectedSku !== defaultSku ? selectedSku : undefined,
      });

      setResult(res);

      if (res.assigned > 0) {
        // Automatically deduct/refresh page state
        onComplete();

        if (res.errors.length === 0) {
          // All succeeded: clear textarea
          setText('');
          const remaining = res.pending_remaining ?? Math.max(0, pendingCount - res.assigned);
          onNotify({
            type: 'success',
            title: 'Bulk Assignment Complete',
            message: (
              <div className="space-y-2">
                <p className="font-semibold text-emerald-800">
                  Successfully assigned {res.assigned.toLocaleString()} serial number(s)!
                </p>
                <p className="text-sm text-slate-600">
                  {remaining > 0 ? (
                    <span>
                      <strong>{remaining.toLocaleString()}</strong> unit(s) remaining waiting to be assigned.
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium">
                      All units in this receipt are now fully assigned!
                    </span>
                  )}
                </p>
              </div>
            ),
          });
        } else {
          // Partial success: keep ONLY failed serials in the textarea for easy review
          const failedSet = new Set(res.errors.map((e) => e.serial));
          const remainingSerials = serials.filter((s) => failedSet.has(s));
          setText(remainingSerials.join('\n'));

          const remaining = res.pending_remaining ?? Math.max(0, pendingCount - res.assigned);
          onNotify({
            type: 'info',
            title: 'Partial Assignment Complete',
            message: (
              <div className="space-y-2">
                <p className="font-medium text-slate-800">
                  {res.assigned.toLocaleString()} serial(s) assigned successfully, but{' '}
                  <span className="text-rose-600 font-semibold">{res.errors.length} serial(s)</span> could not be assigned.
                </p>
                <p className="text-xs text-slate-500">
                  Remaining awaiting serials: <strong>{remaining.toLocaleString()}</strong>.
                  The failed serials have been kept in the input box so you can review or correct them.
                </p>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-mono space-y-1">
                  {res.errors.map((err, idx) => (
                    <div key={idx} className="text-rose-700">
                      • {err.serial}: {err.error}
                    </div>
                  ))}
                </div>
              </div>
            ),
          });
        }
      } else {
        // Zero assigned
        onNotify({
          type: 'error',
          title: 'Bulk Assignment Failed',
          message: (
            <div className="space-y-2">
              <p className="font-medium text-rose-800">
                No serial numbers were assigned.
              </p>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs font-mono space-y-1">
                {res.errors.map((err, idx) => (
                  <div key={idx} className="text-rose-700">
                    • {err.serial}: {err.error}
                  </div>
                ))}
              </div>
            </div>
          ),
        });
      }
    });
  }

  const enteredCount = text.split(/[\r\n,]+/).filter((s) => s.trim()).length;

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">Bulk Serial Assignment</p>
              <span className="text-xs px-2 py-0.5 font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                Fast Upload
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Paste or upload a CSV/TXT list to assign serials for {pendingCount.toLocaleString()} pending slot(s)
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Enter one serial number per line (or comma-separated).</span>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv,.txt"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
                Upload CSV / TXT File
              </button>
            </div>
          </div>

          {showSkuPicker && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Assign all to SKU</label>
              <select
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
              >
                {skuOptions.map((opt) => (
                  <option key={opt.sku} value={opt.sku}>
                    {opt.sku} — {opt.model_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              disabled={isPending}
              placeholder={`Paste serials here, e.g.\nSN001234567890\nSN001234567891\nSN001234567892`}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono resize-none disabled:bg-slate-50 disabled:opacity-60"
            />
            {isPending && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] rounded-xl flex items-center justify-center gap-2 text-indigo-700 text-sm font-medium">
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing and assigning serial numbers…
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              <strong className="text-slate-800 font-mono">{enteredCount.toLocaleString()}</strong> serial(s) detected
              {enteredCount > pendingCount && (
                <span className="text-rose-600 font-medium ml-2">
                  (Warning: Exceeds {pendingCount.toLocaleString()} pending slot{pendingCount === 1 ? '' : 's'})
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {text.trim() && !isPending && (
                <button
                  type="button"
                  onClick={() => setText('')}
                  className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={handleBulkAssign}
                disabled={isPending || enteredCount === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Assign All ({enteredCount})
              </button>
            </div>
          </div>

          {result && (
            <div className={`p-3.5 rounded-xl text-sm border ${result.errors.length === 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
              <p className="font-semibold flex items-center gap-1.5">
                {result.errors.length === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                {result.assigned.toLocaleString()} serial(s) assigned successfully.
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-1.5 text-xs space-y-0.5 border-t border-amber-200/60 pt-1.5">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-rose-700 font-mono">• {e.serial}: {e.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function InboundDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<InboundDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skuOptions, setSkuOptions] = useState<{ sku: string; model_name: string }[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: React.ReactNode;
    redirectOnClose?: boolean;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  async function handleConfirmDelete() {
    if (!detail) return;
    setIsDeleting(true);
    const res = await deleteInboundTransaction(detail.id);
    setIsDeleting(false);
    setShowDeleteConfirm(false);

    if (res.error) {
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'Delete Failed',
        message: res.error,
      });
    } else {
      setFeedback({
        isOpen: true,
        type: 'success',
        title: 'Receipt Deleted Successfully',
        message: 'This inbound receipt and its inventory units have been completely removed from inventory.',
        redirectOnClose: true,
      });
    }
  }

  async function fetchDetail() {
    setLoading(true);
    const result = await getInboundTransaction(id);
    if (result.error || !result.data) {
      setError(result.error || 'Not found');
    } else {
      setDetail(result.data);
      setError(null);

      // Load model group SKU options if applicable
      const firstSku = result.data.items[0]?.sku;
      if (firstSku) {
        const supabase = createClient();
        const { data: product } = await supabase
          .from('products')
          .select('model_group')
          .eq('sku', firstSku)
          .single();

        if (product?.model_group) {
          const { data: groupSkus } = await supabase
            .from('products')
            .select('sku, model_name')
            .eq('model_group', product.model_group)
            .order('sku', { ascending: true });

          setSkuOptions(groupSkus || []);
        } else {
          // Single SKU — no group
          const { data: singleProd } = await supabase
            .from('products')
            .select('sku, model_name')
            .eq('sku', firstSku)
            .single();
          setSkuOptions(singleProd ? [singleProd] : []);
        }
      }
    }
    setLoading(false);
  }

  useEffect(() => { fetchDetail(); }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="text-center py-24">
        <p className="text-red-500">{error || 'Transaction not found'}</p>
        <Link href="/inbound" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          ← Back to Inbound
        </Link>
      </div>
    );
  }

  const totalCount = detail.total_items ?? detail.items.length;
  const isNonSerialized = detail.is_non_serialized ?? (detail.notes || '').includes('NON-SERIALIZED');
  const pendingCount = detail.pending_items ?? (isNonSerialized ? 0 : detail.items.filter((i) => i.is_pending).length);
  const pendingItems = detail.items.filter((i) => i.is_pending);
  const assignedItems = detail.items.filter((i) => !i.is_pending);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* ── Back + Header ──────────────────────────────────── */}
      <div>
        <Link
          href="/inbound"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inbound
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
              {detail.tracking_number || 'Inbound Receipt'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {detail.location_name} · {new Date(detail.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · {detail.user_name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isNonSerialized ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {totalCount.toLocaleString()} non-serialized units in stock
              </span>
            ) : pendingCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                <AlertTriangle className="w-4 h-4" />
                {pendingCount.toLocaleString()} of {totalCount.toLocaleString()} awaiting serial
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
                <CheckCircle2 className="w-4 h-4" />
                All {totalCount.toLocaleString()} serials assigned
              </span>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete Receipt
            </button>
          </div>
        </div>
        {detail.notes && (
          <p className="mt-2 text-sm text-slate-500 italic">{detail.notes}</p>
        )}
      </div>

      {/* ── Bulk Panel ─────────────────────────────────────── */}
      {pendingItems.length > 0 && (
        <BulkAssignPanel
          transactionId={detail.id}
          pendingCount={pendingItems.length}
          onComplete={fetchDetail}
          onNotify={(modalData) => setFeedback({ isOpen: true, ...modalData })}
          skuOptions={skuOptions}
          defaultSku={detail.items[0]?.sku || ''}
        />
      )}

      {/* ── Pending Serials ────────────────────────────────── */}
      {pendingItems.length > 0 && (
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Pending Serial Assignment</h2>
              <p className="text-xs text-slate-400">{pendingItems.length} unit(s) need real serial numbers</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {pendingItems.map((item, index) => (
              <div key={item.serial_number}>
                <p className="text-xs text-slate-400 font-medium mb-1">Slot {index + 1}</p>
                <SerialAssignmentRow
                  placeholder={item.serial_number}
                  transactionId={detail.id}
                  onAssigned={fetchDetail}
                  skuOptions={skuOptions}
                  defaultSku={item.sku}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Assigned Units ─────────────────────────────────── */}
      {assignedItems.length > 0 && (
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                {isNonSerialized ? 'Warehouse Inventory' : 'Assigned Serial Numbers'}
              </h2>
              <p className="text-xs text-slate-400">{totalCount.toLocaleString()} unit(s) registered as IN WAREHOUSE</p>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {assignedItems.slice(0, 100).map((item) => (
              <div key={item.serial_number} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-mono text-slate-800">{item.serial_number}</span>
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-0.5 border border-emerald-200/60">
                  {item.status.replace('_', ' ')}
                </span>
              </div>
            ))}
            {totalCount > 100 && (
              <div className="py-2.5 text-center text-xs text-slate-400 bg-slate-50/50">
                Showing first 100 of {totalCount.toLocaleString()} units
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        isDestructive={true}
        title="Delete Inbound Receipt"
        message={
          <div className="space-y-2">
            <p>
              Are you sure you want to delete inbound receipt{' '}
              <strong className="font-mono text-slate-800">{detail.tracking_number || detail.id}</strong>?
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              This will permanently remove all {totalCount.toLocaleString()} inventory units from the warehouse.
              If any units have already been dispatched or sold, the deletion will be safely prevented.
            </p>
          </div>
        }
        confirmText="Yes, Delete Receipt"
      />

      {/* Feedback (Success / Error) Modal */}
      <FeedbackModal
        isOpen={feedback.isOpen}
        onClose={() => {
          setFeedback((prev) => ({ ...prev, isOpen: false }));
          if (feedback.redirectOnClose) {
            router.push('/inbound');
          }
        }}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        buttonText={feedback.redirectOnClose ? 'Back to Inbound' : undefined}
      />
    </div>
  );
}
