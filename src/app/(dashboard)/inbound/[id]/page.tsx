// ============================================================
// PSMI System — Inbound Batch Detail Page
// ============================================================
// Shows all units in an inbound receipt and allows assigning
// real serial numbers to PENDING_SERIAL placeholder slots.
// ============================================================

'use client';

import { useState, useEffect, useTransition } from 'react';
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
} from 'lucide-react';
import { getInboundTransaction, assignSerialNumber, bulkAssignSerials } from '@/actions/inbound';
import { createClient } from '@/lib/supabase/client';

type InboundDetail = {
  id: string;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  location_name: string;
  user_name: string;
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
  skuOptions,
  defaultSku,
}: {
  transactionId: string;
  pendingCount: number;
  onComplete: () => void;
  skuOptions: { sku: string; model_name: string }[];
  defaultSku: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [selectedSku, setSelectedSku] = useState(defaultSku);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ assigned: number; errors: { serial: string; error: string }[] } | null>(null);
  const showSkuPicker = skuOptions.length > 1;

  function handleBulkAssign() {
    const serials = text.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (serials.length === 0) return;
    startTransition(async () => {
      const res = await bulkAssignSerials({
        transaction_id: transactionId,
        real_serials: serials,
        sku_override: selectedSku !== defaultSku ? selectedSku : undefined,
      });
      setResult(res);
      if (res.assigned > 0) onComplete();
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-xl">
            <Upload className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Bulk Serial Assignment</p>
            <p className="text-xs text-slate-500">Paste or upload multiple serials at once for {pendingCount} pending slot(s)</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-slate-100">
          <p className="text-xs text-slate-500 pt-3">
            Enter one serial number per line (or comma-separated). They will be assigned to pending slots in order.
          </p>
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
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={`e.g.\nSN001234567890\nSN001234567891\nSN001234567892`}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {text.split(/[\n,]+/).filter((s) => s.trim()).length} serial(s) entered
            </span>
            <button
              onClick={handleBulkAssign}
              disabled={isPending || !text.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Assign All
            </button>
          </div>

          {result && (
            <div className={`p-3 rounded-xl text-sm ${result.errors.length === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
              <p className="font-medium">{result.assigned} serial(s) assigned successfully.</p>
              {result.errors.length > 0 && (
                <ul className="mt-1 text-xs space-y-0.5">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-red-700">• {e.serial}: {e.error}</li>
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
            {pendingItems.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                <AlertTriangle className="w-4 h-4" />
                {pendingItems.length} of {detail.items.length} awaiting serial
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
                <CheckCircle2 className="w-4 h-4" />
                All serials assigned
              </span>
            )}
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
              <h2 className="text-sm font-semibold text-slate-800">Assigned Serial Numbers</h2>
              <p className="text-xs text-slate-400">{assignedItems.length} unit(s) registered as IN WAREHOUSE</p>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {assignedItems.map((item) => (
              <div key={item.serial_number} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-mono text-slate-800">{item.serial_number}</span>
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-0.5 border border-emerald-200/60">
                  {item.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
