// ============================================================
// PSMI System — Inbound Operations Page
// ============================================================
// Client Component — two-tab interface:
//   Tab 1: Inbound history with pending serial indicators
//   Tab 2: (tab state triggers modal)
// New Inbound button opens the NewInboundModal.
// ============================================================
'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  PackagePlus,
  Plus,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  Upload,
  Hash,
  ChevronRight,
  ChevronLeft,
  FileSpreadsheet,
  Camera,
  Scan,
  Trash2,
} from 'lucide-react';
import {
  listInboundTransactions,
  createInboundTransaction,
  createInboundByQuantity,
  deleteInboundTransaction,
} from '@/actions/inbound';
import { listProducts } from '@/actions/products';
import { createClient } from '@/lib/supabase/client';

import ComboboxSelect, { ComboboxOption } from '../components/combobox-select';

type InboundSummary = {
  id: string;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  location_name: string;
  user_name: string;
  total_items: number;
  pending_items: number;
  sku: string;
  model_name: string;
};

type Product = { sku: string; model_name: string; is_serialized?: boolean };
type Location = { id: string; name: string; type: string };

const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1000;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    console.error('Audio beep failed:', e);
  }
};

// ── New Inbound Modal ─────────────────────────────────────────
function NewInboundModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<'quantity' | 'serials'>('quantity');
  const [inputSubTab, setInputSubTab] = useState<'manual' | 'file' | 'scan'>('manual');
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sku, setSku] = useState('');
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [serialsText, setSerialsText] = useState('');
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');

  // Scanning states
  const [html5QrcodeLib, setHtml5QrcodeLib] = useState<any>(null);
  const [scanner, setScanner] = useState<any>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerInput, setScannerInput] = useState('');
  const laserInputRef = useRef<HTMLInputElement>(null);

  // Determine if selected SKU is serialized
  const selectedProd = products.find((p) => p.sku === sku);
  const isSerialized = selectedProd ? selectedProd.is_serialized !== false : true;

  useEffect(() => {
    async function load() {
      // Load products
      const { data: prods } = await listProducts();
      setProducts((prods || []) as any);

      // Load locations
      const supabase = createClient();
      const { data: locs } = await supabase.from('locations').select('id, name, type').order('type', { ascending: false });
      setLocations(locs || []);

      // Get user id
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    load();

    // Dynamically import html5-qrcode client-side only
    if (typeof window !== 'undefined') {
      import('html5-qrcode').then((module) => {
        setHtml5QrcodeLib(module);
      });
    }
  }, []);

  // Force mode to 'quantity' if the SKU is not serialized
  useEffect(() => {
    if (!isSerialized) {
      setMode('quantity');
    }
  }, [sku, isSerialized]);

  // Clean up camera scanner on unmount
  useEffect(() => {
    return () => {
      if (scanner) {
        scanner.stop().catch((e: any) => console.error(e));
      }
    };
  }, [scanner]);

  const startCamera = async () => {
    if (!html5QrcodeLib) return;
    try {
      setCameraError(null);
      setCameraActive(true);
      const html5QrCode = new html5QrcodeLib.Html5Qrcode("reader");
      setScanner(html5QrCode);
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 250, height: 150 } },
        (decodedText: string) => {
          setSerialsText((prev) => {
            const existing = prev ? prev + '\n' : '';
            return existing + decodedText.trim();
          });
          playBeep();
        },
        (errorMessage: string) => {}
      );
    } catch (err: any) {
      setCameraError(err.message || "Failed to start camera");
      setCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch (e) {
        console.error(e);
      }
      setScanner(null);
    }
    setCameraActive(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          const serials = json.flat().map((v) => String(v).trim()).filter(Boolean);
          if (serials.length > 0) {
            setSerialsText((prev) => {
              const existing = prev ? prev + '\n' : '';
              return existing + serials.join('\n');
            });
            playBeep();
          }
        } catch (err: any) {
          setError(`Excel parse error: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (fileExt === 'csv' || fileExt === 'txt') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = evt.target?.result as string;
          const serials = text.split(/[\n\r\t,]+/).map((s) => s.trim()).filter(Boolean);
          if (serials.length > 0) {
            setSerialsText((prev) => {
              const existing = prev ? prev + '\n' : '';
              return existing + serials.join('\n');
            });
            playBeep();
          }
        } catch (err: any) {
          setError(`CSV parse error: ${err.message}`);
        }
      };
      reader.readAsText(file);
    } else {
      setError('Unsupported file type. Please upload a .csv, .txt, or .xlsx file.');
    }
  };

  const handleLaserScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = scannerInput.trim();
      if (val) {
        setSerialsText((prev) => {
          const existing = prev ? prev + '\n' : '';
          return existing + val;
        });
        setScannerInput('');
        playBeep();
      }
    }
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!sku) { setError('Please select a SKU'); return; }
    if (!locationId) { setError('Please select a destination location'); return; }

    startTransition(async () => {
      if (mode === 'quantity') {
        const qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty <= 0) { setError('Please enter a valid quantity'); return; }
        const result = await createInboundByQuantity({
          sku,
          location_id: locationId,
          quantity: qty,
          user_id: userId,
          notes: notes || undefined,
        });
        if (result.error) { setError(result.error); return; }
      } else {
        const serials = serialsText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
        if (serials.length === 0) { setError('Please enter at least one serial number'); return; }
        const result = await createInboundTransaction({
          sku,
          location_id: locationId,
          serial_numbers: serials,
          user_id: userId,
          notes: notes || undefined,
        });
        if (result.error) { setError(result.error); return; }
      }
      // Make sure camera is stopped if active
      if (cameraActive) {
        await stopCamera();
      }
      onSuccess();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">New Inbound Receipt</h2>
            <p className="text-xs text-slate-500 mt-0.5">Log a shipment into the warehouse</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Mode Toggle */}
        {isSerialized ? (
          <div className="px-6 pt-4">
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setMode('quantity')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  mode === 'quantity'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Hash className="w-4 h-4" />
                Enter Quantity
              </button>
              <button
                type="button"
                onClick={() => setMode('serials')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  mode === 'serials'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Upload className="w-4 h-4" />
                Enter Serial Numbers
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              {mode === 'quantity'
                ? 'Upload stock count now — assign serial numbers later from the batch detail page.'
                : 'Enter serial numbers directly to register units as IN WAREHOUSE immediately.'}
            </p>
          </div>
        ) : sku ? (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-amber-800 text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>{selectedProd?.model_name}</strong> is non-serialized.
                You only need to specify the quantity to add to inventory.
              </span>
            </div>
          </div>
        ) : null}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* SKU Combobox */}
          <ComboboxSelect
            label="Product SKU"
            options={products.map((p) => ({
              value: p.sku,
              label: p.model_name,
              sublabel: p.sku,
              badge: (p as any).category_badge === 'POWER_STATION' ? '⚡ Power Station'
                   : (p as any).category_badge === 'SHS' ? '☀️ SHS'
                   : (p as any).category_badge === 'ACCESSORIES' ? '🔌 Accessories'
                   : undefined,
              badgeColor: (p as any).category_badge === 'POWER_STATION' ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                        : (p as any).category_badge === 'SHS' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-amber-50 text-amber-700 border-amber-100',
            }))}
            value={sku}
            onChange={setSku}
            placeholder="Search product name or SKU..."
            searchPlaceholder="Type SKU or model keyword..."
            emptyText="No matching products found"
          />

          {/* Location Combobox */}
          <ComboboxSelect
            label="Destination Location"
            options={locations.map((l) => ({
              value: l.id,
              label: l.name,
              sublabel: l.type,
            }))}
            value={locationId}
            onChange={setLocationId}
            placeholder="Search warehouse or branch..."
            searchPlaceholder="Type location name..."
            emptyText="No matching locations found"
          />

          {/* Mode-specific input */}
          {mode === 'quantity' ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Quantity {isSerialized ? 'Received' : 'to Inbound'}
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 50"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-600">Entry Method</label>
              <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
                {(['manual', 'file', 'scan'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setInputSubTab(tab);
                      if (tab !== 'scan' && cameraActive) {
                        stopCamera();
                      }
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                      inputSubTab === tab
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab === 'manual' && <Hash className="w-3.5 h-3.5" />}
                    {tab === 'file' && <FileSpreadsheet className="w-3.5 h-3.5" />}
                    {tab === 'scan' && <Scan className="w-3.5 h-3.5" />}
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Sub-tab: Manual */}
              {inputSubTab === 'manual' && (
                <div>
                  <textarea
                    value={serialsText}
                    onChange={(e) => setSerialsText(e.target.value)}
                    placeholder="Type or paste serial numbers, one per line or comma-separated..."
                    rows={4}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono resize-none"
                  />
                </div>
              )}

              {/* Sub-tab: File Upload */}
              {inputSubTab === 'file' && (
                <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-5 text-center cursor-pointer transition-colors relative bg-slate-50/50">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.txt"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <FileSpreadsheet className="w-7 h-7 text-slate-400 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-slate-800">Upload CSV or Excel File</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Supports .xlsx, .xls, .csv, and .txt formats</p>
                </div>
              )}

              {/* Sub-tab: Barcode Scanner */}
              {inputSubTab === 'scan' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-2 border border-slate-200 bg-slate-50 rounded-xl">
                    <Scan className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <input
                      type="text"
                      ref={laserInputRef}
                      value={scannerInput}
                      onChange={(e) => setScannerInput(e.target.value)}
                      onKeyDown={handleLaserScannerKeyDown}
                      placeholder="Laser scanner target (scans auto-add on Enter)..."
                      className="flex-1 bg-transparent text-sm placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    {cameraActive ? (
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-semibold border border-red-100 transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5" /> Stop Camera
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startCamera}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 rounded-xl text-xs font-semibold border border-indigo-100 transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5" /> Start Mobile Camera
                      </button>
                    )}
                  </div>
                  {cameraActive && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-black aspect-video relative">
                      <div id="reader" className="w-full h-full" />
                    </div>
                  )}
                  {cameraError && (
                    <p className="text-xs text-red-600 font-medium pl-1">{cameraError}</p>
                  )}
                </div>
              )}

              {/* Display Accumulated List */}
              {serialsText.trim().length > 0 && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Accumulated Serials
                    </span>
                    <button
                      type="button"
                      onClick={() => setSerialsText('')}
                      className="text-[10px] text-red-500 hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                  <textarea
                    value={serialsText}
                    onChange={(e) => setSerialsText(e.target.value)}
                    rows={3}
                    className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Total count: <strong>{serialsText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).length}</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Supplier: ABC Corp, PO #1234"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-60"
            >
              {isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
              ) : (
                <><PackagePlus className="w-4 h-4" /> Create Receipt</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
const ITEMS_PER_PAGE = 10;

export default function InboundPage() {
  const [transactions, setTransactions] = useState<InboundSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE) || 1;
  const paginatedTxns = transactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  async function fetchTransactions() {
    setLoading(true);
    const result = await listInboundTransactions();
    if (result.error) {
      setError(result.error);
    } else {
      setTransactions((result.data || []) as any);
      setError(null);
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this inbound receipt? This will remove all associated pending inventory slots.')) return;
    setIsDeleteLoading(true);
    const res = await deleteInboundTransaction(id);
    setIsDeleteLoading(false);
    if (res.error) {
      alert(res.error);
    } else {
      await fetchTransactions();
    }
  }

  useEffect(() => { fetchTransactions(); }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Modal */}
      {showModal && (
        <NewInboundModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchTransactions();
          }}
        />
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Inbound Operations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Receive inventory — log quantities now, assign serial numbers later.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 rounded-xl text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
        >
          <Plus className="w-4 h-4" />
          New Inbound Receipt
        </button>
      </div>

      {/* ── Pending Serials Alert ───────────────────────────── */}
      {(() => {
        const totalPending = transactions.reduce((sum, t) => sum + t.pending_items, 0);
        if (totalPending === 0) return null;
        return (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {totalPending} units awaiting serial number assignment
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Click on a receipt below to assign serial numbers to pending slots.
              </p>
            </div>
          </div>
        );
      })()}

      {/* ── Content Table ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Inbound History</h2>
          <span className="text-xs text-slate-400 font-medium">
            {transactions.length} receipt(s) recorded
          </span>
        </div>

        {error && (
          <div className="p-5 text-center text-red-500 bg-red-50/50">
            Failed to load inbound logs: {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        )}

        {!loading && !error && transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-slate-50 rounded-2xl mb-3">
              <PackagePlus className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm text-slate-500">No inbound transactions yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 text-sm text-indigo-600 font-medium hover:underline"
            >
              Create your first inbound receipt →
            </button>
          </div>
        )}

        {!loading && !error && transactions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                    Receipt
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                    Location
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                    Authorized By
                  </th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                    Units
                  </th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                    Serial Status
                  </th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3">
                    Date
                  </th>
                  <th className="p-4 pb-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedTxns.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                          <ArrowDownLeft className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {txn.model_name || 'Unknown Product'}{' '}
                            {txn.sku && (
                              <span className="text-xs font-normal text-slate-400 font-mono">({txn.sku})</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            {txn.tracking_number || '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-700">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        {txn.location_name}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">{txn.user_name}</td>
                    <td className="p-4 text-center font-semibold text-slate-800">
                      {txn.total_items}
                    </td>
                    <td className="p-4 text-center">
                      {txn.pending_items > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 rounded-full px-2.5 py-1">
                          <AlertTriangle className="w-3 h-3" />
                          {txn.pending_items} Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-full px-2.5 py-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Complete
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm text-slate-700">
                          {new Date(txn.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(txn.created_at).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/inbound/${txn.id}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          View <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                        {txn.pending_items > 0 && (
                          <button
                            onClick={() => handleDelete(txn.id)}
                            disabled={isDeleteLoading}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-600 hover:text-red-800 hover:bg-red-100/70 border border-red-100 rounded-lg transition-colors"
                            title="Delete pending receipt"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── 10-Item Pagination Controls ───────────────────────── */}
            <div className="px-5 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
              <span className="text-xs text-slate-500 font-medium">
                Showing{' '}
                <strong className="text-slate-800">
                  {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, transactions.length)}
                </strong>{' '}
                to{' '}
                <strong className="text-slate-800">
                  {Math.min(currentPage * ITEMS_PER_PAGE, transactions.length)}
                </strong>{' '}
                of <strong className="text-slate-800">{transactions.length}</strong> receipts
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>

                <span className="px-3 py-1 text-xs font-semibold text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
