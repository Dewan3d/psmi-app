// ============================================================
// PSMI System — Inbound Operations Page
// ============================================================
// Client Component — two-tab interface:
//   Tab 1: Inbound history with pending serial indicators
//   Tab 2: (tab state triggers modal)
// New Inbound button opens the NewInboundModal.
// ============================================================
'use client';

import { useState, useEffect, useTransition, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Search,
} from 'lucide-react';
import {
  listInboundTransactions,
  createInboundTransaction,
  createInboundByQuantity,
  createInboundByModelGroup,
  deleteInboundTransaction,
} from '@/actions/inbound';
import { listProducts, listModelGroups } from '@/actions/products';
import { listLocations } from '@/actions/locations';
import { createClient } from '@/lib/supabase/client';

import ComboboxSelect, { ComboboxOption } from '../components/combobox-select';
import ConfirmModal from '../components/confirm-modal';
import FeedbackModal from '../components/feedback-modal';
import { ModalWrapper } from '../components/modal-wrapper';
import { useUser } from '../components/user-context';

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

type Product = {
  sku: string;
  model_name: string;
  is_serialized?: boolean;
  model_group?: string | null;
  cost_price?: number | null;
  retail_price?: number | null;
};
type Location = { id: string; name: string; type: string };
type ModelGroupOption = { model_group: string; skus: { sku: string; model_name: string }[] };

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
  onSuccess: (newTxnId?: string, pendingCount?: number, meta?: { modelName?: string; qty?: number }) => void;
}) {
  const [mode, setMode] = useState<'quantity' | 'model-group' | 'serials'>('quantity');
  const [inputSubTab, setInputSubTab] = useState<'manual' | 'file' | 'scan'>('manual');
  const [products, setProducts] = useState<Product[]>([]);
  const [modelGroups, setModelGroups] = useState<ModelGroupOption[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sku, setSku] = useState('');
  const [selectedModelGroup, setSelectedModelGroup] = useState('');
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
  const [isLaserFocused, setIsLaserFocused] = useState(false);
  const laserInputRef = useRef<HTMLInputElement>(null);

  // Determine if selected SKU is serialized
  const selectedProd = products.find((p) => p.sku === sku);
  const isSerialized = selectedProd ? selectedProd.is_serialized !== false : true;

  // Get the model group info for the selected group
  const selectedMG = modelGroups.find((mg) => mg.model_group === selectedModelGroup);
  const defaultMGSku = selectedMG?.skus[0]; // Already sorted alphabetically from the server

  useEffect(() => {
    async function load() {
      // Load products
      const { data: prods } = await listProducts();
      setProducts((prods || []) as any);

      // Load model groups
      const { data: groups } = await listModelGroups();
      setModelGroups((groups || []) as any);

      const supabase = createClient();

      // Load locations
      const locRes = await listLocations();
      if (locRes.data && locRes.data.length > 0) {
        setLocations(locRes.data);
      } else {
        const { data: locs } = await supabase.from('locations').select('id, name, type').order('type', { ascending: false });
        setLocations(locs || []);
      }

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

  const [showConfirm, setShowConfirm] = useState(false);

  function handleFormPreSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'model-group') {
      if (!selectedModelGroup) { setError('Please select a model group'); return; }
      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty <= 0) { setError('Please enter a valid quantity'); return; }
    } else {
      if (!sku) { setError('Please select a SKU'); return; }
      if (mode === 'quantity') {
        const qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty <= 0) { setError('Please enter a valid quantity'); return; }
      } else {
        const serials = serialsText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
        if (serials.length === 0) { setError('Please enter at least one serial number'); return; }
      }
    }
    if (!locationId) { setError('Please select a destination location'); return; }

    setShowConfirm(true);
  }

  function handleConfirmedSubmit() {
    startTransition(async () => {
      let createdTxnId: string | undefined;
      let pendingCount = 0;
      let modelNameStr = selectedProd?.model_name || sku;
      let totalQty = 0;

      if (mode === 'model-group') {
        const qty = parseInt(quantity, 10);
        totalQty = qty;
        modelNameStr = selectedModelGroup;
        const result = await createInboundByModelGroup({
          model_group: selectedModelGroup,
          location_id: locationId,
          quantity: qty,
          user_id: userId,
          notes: notes || undefined,
        });
        if (result.error) { setError(result.error); setShowConfirm(false); return; }
        createdTxnId = result.data?.id;
        pendingCount = result.pending_count || 0;
      } else if (mode === 'quantity') {
        const qty = parseInt(quantity, 10);
        totalQty = qty;
        const result = await createInboundByQuantity({
          sku,
          location_id: locationId,
          quantity: qty,
          user_id: userId,
          notes: notes || undefined,
        });
        if (result.error) { setError(result.error); setShowConfirm(false); return; }
        createdTxnId = result.data?.id;
        pendingCount = result.pending_count || 0;
      } else {
        const serials = serialsText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
        totalQty = serials.length;
        const result = await createInboundTransaction({
          sku,
          location_id: locationId,
          serial_numbers: serials,
          user_id: userId,
          notes: notes || undefined,
        });
        if (result.error) { setError(result.error); setShowConfirm(false); return; }
        createdTxnId = result.data?.id;
      }
      // Make sure camera is stopped if active
      if (cameraActive) {
        await stopCamera();
      }
      setShowConfirm(false);
      onSuccess(createdTxnId, pendingCount, { modelName: modelNameStr, qty: totalQty });
    });
  }

  return (
    <ModalWrapper isOpen={true} onClose={onClose} maxWidth="max-w-lg" zIndex="z-50">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">New Inbound Receipt</h2>
            <p className="text-xs text-slate-500 mt-0.5">Log a shipment into the warehouse</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
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
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                  mode === 'quantity'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Hash className="w-3.5 h-3.5" />
                By SKU
              </button>
              <button
                type="button"
                onClick={() => setMode('model-group')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                  mode === 'model-group'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <PackagePlus className="w-3.5 h-3.5" />
                By Model
              </button>
              <button
                type="button"
                onClick={() => setMode('serials')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                  mode === 'serials'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Serials
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              {mode === 'quantity'
                ? 'Upload stock count by specific SKU — assign serial numbers later.'
                : mode === 'model-group'
                ? 'Upload total count for a model group — assign SKU + serials later.'
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

        <form onSubmit={handleFormPreSubmit} className="px-6 py-4 space-y-4">
          {/* Product Selector — SKU or Model Group depending on mode */}
          {mode === 'model-group' ? (
            <>
              {modelGroups.length === 0 ? (
                <div className="flex items-start gap-2.5 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900">No Model Groups Configured Yet</p>
                    <p className="text-amber-800 mt-0.5">
                      To inbound by model (e.g., 100 E-60s split between variants <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">a-E60-B</code> and <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">b-E60-C</code>), assign a <strong>Model Group</strong> to your products in Settings.
                    </p>
                    <Link href="/settings" onClick={onClose} className="inline-block mt-2 font-bold text-indigo-600 hover:underline">
                      Go to Settings → Product Catalogue →
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <ComboboxSelect
                    label="Model Group"
                    options={modelGroups.map((mg) => ({
                      value: mg.model_group,
                      label: mg.model_group,
                      sublabel: `${mg.skus.length} SKU variant${mg.skus.length > 1 ? 's' : ''}: ${mg.skus.map(s => s.sku).join(', ')}`,
                    }))}
                    value={selectedModelGroup}
                    onChange={setSelectedModelGroup}
                    placeholder="Search model group..."
                    searchPlaceholder="Type model name..."
                    emptyText="No model groups found — set them up in Settings"
                  />
                  {selectedMG && (
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-indigo-50/60 border border-indigo-200/60 rounded-xl text-indigo-800 text-xs leading-relaxed">
                      <PackagePlus className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>
                        Placeholders will be created under <strong>{defaultMGSku?.sku}</strong> ({defaultMGSku?.model_name}).
                        Correct SKU is assigned when serial numbers are scanned.
                      </span>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
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
          )}

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
                  <div
                    onClick={() => laserInputRef.current?.focus()}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all cursor-text ${
                      isLaserFocused
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Scan className={`w-4 h-4 ${isLaserFocused ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                      {isLaserFocused && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      )}
                    </div>
                    <input
                      type="text"
                      ref={laserInputRef}
                      value={scannerInput}
                      onChange={(e) => setScannerInput(e.target.value)}
                      onFocus={() => setIsLaserFocused(true)}
                      onBlur={() => setIsLaserFocused(false)}
                      onKeyDown={handleLaserScannerKeyDown}
                      placeholder={
                        isLaserFocused
                          ? 'Scanner Gun Active — pull trigger or scan barcode...'
                          : 'Click here or tap button below to focus scanner gun...'
                      }
                      className="flex-1 bg-transparent text-sm placeholder:text-slate-400 focus:outline-none font-mono text-slate-800"
                    />
                    {!isLaserFocused && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          laserInputRef.current?.focus();
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors cursor-pointer shadow-2xs flex-shrink-0"
                      >
                        Tap to Focus Gun
                      </button>
                    )}
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

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmedSubmit}
        isLoading={isPending}
        title="Confirm Inbound Receipt"
        message={
          <div className="space-y-2">
            <p className="text-slate-600 font-medium">Review inbound shipment details:</p>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1 text-slate-700">
              <p>
                <strong className="text-slate-900">Destination:</strong>{' '}
                {locations.find((l) => l.id === locationId)?.name || 'Selected Location'}
              </p>
              {mode === 'model-group' ? (
                <p>
                  <strong className="text-slate-900">Quantity:</strong> {quantity} units ({selectedModelGroup})
                </p>
              ) : mode === 'quantity' ? (
                <p>
                  <strong className="text-slate-900">Product:</strong> {selectedProd?.model_name || sku} ({quantity} units)
                </p>
              ) : (
                <p>
                  <strong className="text-slate-900">Product:</strong> {selectedProd?.model_name || sku} (
                  {serialsText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean).length} serial numbers)
                </p>
              )}
            </div>
          </div>
        }
        confirmText="Yes, Inbound Items"
      />
    </ModalWrapper>
  );
}

// ── Main Page ─────────────────────────────────────────────────
const ITEMS_PER_PAGE = 10;

export default function InboundPage() {
  const router = useRouter();
  const { isViewer } = useUser();
  const [transactions, setTransactions] = useState<InboundSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETE'>('ALL');
  const [pendingHandoff, setPendingHandoff] = useState<{
    isOpen: boolean;
    txnId: string;
    pendingCount: number;
    modelName: string;
    qty: number;
  }>({
    isOpen: false,
    txnId: '',
    pendingCount: 0,
    modelName: '',
    qty: 0,
  });

  const pendingCount = useMemo(
    () => transactions.filter((t) => t.pending_items > 0).length,
    [transactions]
  );
  const completeCount = useMemo(
    () => transactions.filter((t) => t.pending_items === 0).length,
    [transactions]
  );

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((t) => {
      // Status filter
      if (statusFilter === 'PENDING' && t.pending_items === 0) return false;
      if (statusFilter === 'COMPLETE' && t.pending_items > 0) return false;

      if (!q) return true;

      return (
        (t.model_name && t.model_name.toLowerCase().includes(q)) ||
        (t.sku && t.sku.toLowerCase().includes(q)) ||
        (t.id && t.id.toLowerCase().includes(q)) ||
        (t.tracking_number && t.tracking_number.toLowerCase().includes(q)) ||
        (t.location_name && t.location_name.toLowerCase().includes(q)) ||
        (t.user_name && t.user_name.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q))
      );
    });
  }, [transactions, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE) || 1;
  const paginatedTxns = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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

  const [txnToDelete, setTxnToDelete] = useState<InboundSummary | null>(null);
  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: React.ReactNode;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  async function handleConfirmDelete() {
    if (!txnToDelete) return;
    const target = txnToDelete;
    setIsDeleteLoading(true);
    const res = await deleteInboundTransaction(target.id);
    setIsDeleteLoading(false);
    setTxnToDelete(null);

    if (res.error) {
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'Delete Failed',
        message: res.error,
      });
    } else {
      await fetchTransactions();
      setFeedback({
        isOpen: true,
        type: 'success',
        title: 'Receipt Deleted Successfully',
        message: (
          <span>
            Inbound receipt <strong className="font-mono text-slate-850">{target.tracking_number || target.id}</strong> and all associated units ({target.total_items} units of {target.model_name || target.sku}) have been completely deleted from warehouse stock.
          </span>
        ),
      });
    }
  }

  useEffect(() => { fetchTransactions(); }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Modal */}
      {/* Modal */}
      {showModal && (
        <NewInboundModal
          onClose={() => setShowModal(false)}
          onSuccess={(newTxnId, pendingCount, meta) => {
            setShowModal(false);
            fetchTransactions();
            if (pendingCount && pendingCount > 0 && newTxnId) {
              setPendingHandoff({
                isOpen: true,
                txnId: newTxnId,
                pendingCount,
                modelName: meta?.modelName || 'Shipment',
                qty: meta?.qty || pendingCount,
              });
            } else {
              setFeedback({
                isOpen: true,
                type: 'success',
                title: 'Inbound Receipt Created',
                message: 'The new inbound shipment has been successfully recorded in inventory.',
              });
            }
          }}
        />
      )}

      {/* Post-Inbound Pending Serials Handoff Modal (Option A) */}
      <ModalWrapper
        isOpen={pendingHandoff.isOpen}
        onClose={() => setPendingHandoff((prev) => ({ ...prev, isOpen: false }))}
        maxWidth="max-w-md"
        zIndex="z-50"
      >
        <div className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/60">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Shipment Logged — Serials Pending</h3>
            <p className="text-xs text-slate-500 mt-1">
              <strong>{pendingHandoff.qty} unit(s)</strong> of <strong>{pendingHandoff.modelName}</strong> were successfully received into the warehouse.
            </p>
          </div>
          <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-800 text-left space-y-1">
            <p className="font-semibold text-amber-900">Serial Number Assignment Needed</p>
            <p className="text-amber-700 leading-relaxed">
              These units have been registered with temporary slots. Before they can be selected for Outbound dispatch or sales, their physical barcode serials must be assigned.
            </p>
          </div>
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => {
                const id = pendingHandoff.txnId;
                setPendingHandoff((prev) => ({ ...prev, isOpen: false }));
                router.push(`/inbound/${id}`);
              }}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              Assign Serial Numbers Now <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPendingHandoff((prev) => ({ ...prev, isOpen: false }))}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              Keep Pending & Return to History
            </button>
          </div>
        </div>
      </ModalWrapper>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!txnToDelete}
        onClose={() => setTxnToDelete(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleteLoading}
        isDestructive={true}
        title="Delete Inbound Receipt"
        message={
          <div className="space-y-2">
            <p>
              Are you sure you want to delete inbound receipt{' '}
              <strong className="font-mono text-slate-800">{txnToDelete?.id}</strong>?
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              This will remove all associated in-stock units for{' '}
              <strong>{txnToDelete?.model_name || txnToDelete?.sku}</strong> ({txnToDelete?.total_items} units).
              If any units have already been dispatched or sold, the deletion will be safely prevented.
            </p>
          </div>
        }
        confirmText="Yes, Delete Receipt"
      />

      {/* Feedback (Success / Error) Modal */}
      <FeedbackModal
        isOpen={feedback.isOpen}
        onClose={() => setFeedback((prev) => ({ ...prev, isOpen: false }))}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
      />

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
        {!isViewer && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 rounded-xl text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
          >
            <Plus className="w-4 h-4" />
            New Inbound Receipt
          </button>
        )}
      </div>

      {/* ── Search & Filter Controls ───────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.06)] border border-slate-100">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by SKU, tracking, or location..."
            className="w-full pl-10 pr-9 py-2 text-sm bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 placeholder-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200/60 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-1.5 self-start sm:self-center overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ALL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                statusFilter === 'ALL' ? 'bg-slate-700 text-slate-200' : 'bg-slate-200/80 text-slate-500'
              }`}
            >
              {transactions.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('PENDING');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 border border-amber-200/60 hover:bg-amber-100'
            }`}
          >
            Pending Serials
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                statusFilter === 'PENDING' ? 'bg-amber-700 text-amber-100' : 'bg-amber-200/60 text-amber-800'
              }`}
            >
              {pendingCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('COMPLETE');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              statusFilter === 'COMPLETE'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100'
            }`}
          >
            Complete
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                statusFilter === 'COMPLETE' ? 'bg-emerald-700 text-emerald-100' : 'bg-emerald-200/60 text-emerald-800'
              }`}
            >
              {completeCount}
            </span>
          </button>
        </div>
      </div>

      {/* ── Pending Serials Alert ───────────────────────────── */}
      {(() => {
        const totalPending = transactions.reduce((sum, t) => sum + t.pending_items, 0);
        if (totalPending === 0) return null;
        return (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  {totalPending} units awaiting serial assignment
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Select a receipt below to assign serial numbers.
                </p>
              </div>
            </div>
            {statusFilter !== 'PENDING' && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('PENDING');
                  setCurrentPage(1);
                }}
                className="px-3 py-1 text-xs font-semibold text-amber-800 bg-amber-200/70 hover:bg-amber-200 rounded-lg transition-colors shrink-0"
              >
                Filter Pending
              </button>
            )}
          </div>
        );
      })()}

      {/* ── Content Table ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Inbound History</h2>
          <span className="text-xs text-slate-400 font-medium">
            {filteredTransactions.length === transactions.length
              ? `${transactions.length} receipt(s) recorded`
              : `Showing ${filteredTransactions.length} of ${transactions.length} receipt(s)`}
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

        {!loading && !error && transactions.length > 0 && filteredTransactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-slate-50 rounded-2xl mb-3">
              <Search className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No matching receipts found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              No inbound receipts match your search &quot;{searchQuery}&quot;
              {statusFilter !== 'ALL' ? ` with status ${statusFilter.toLowerCase()}` : ''}.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setCurrentPage(1);
              }}
              className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}

        {!loading && !error && filteredTransactions.length > 0 && (
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
                      <div className="flex items-center justify-end gap-2.5">
                        {txn.pending_items > 0 && (
                          <Link
                            href={`/inbound/${txn.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors shadow-xs"
                            title="Assign serial numbers to this unit"
                          >
                            <Upload className="w-3 h-3" />
                            Upload Serials
                          </Link>
                        )}
                        <Link
                          href={`/inbound/${txn.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          Details <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                        {!isViewer && (
                          <button
                            onClick={() => setTxnToDelete(txn)}
                            disabled={isDeleteLoading}
                            className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50/60 hover:bg-rose-100 border border-rose-200/60 rounded-lg transition-all cursor-pointer"
                            title="Delete inbound receipt"
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
                  {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredTransactions.length)}
                </strong>{' '}
                to{' '}
                <strong className="text-slate-800">
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)}
                </strong>{' '}
                of <strong className="text-slate-800">{filteredTransactions.length}</strong> receipts
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
