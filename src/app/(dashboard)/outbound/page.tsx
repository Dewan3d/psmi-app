// ============================================================
// PSMI System — Outbound Operations Page
// ============================================================
// Client Component — lists all outbound transactions,
// opens NewOutboundModal and VerificationPanel modals.
// ============================================================

'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  FileX,
  Plus,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Scan,
  Truck,
  Users,
  User,
  MapPin,
  FileCheck,
  Upload,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Trash2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { reserveUnits, createOutboundTransaction, getFifoSerialsForQuantity, deleteOutboundTransaction } from '@/actions/outbound';
import { uploadVerificationDoc, markTransactionVerified, getVerificationDocs, checkVerificationComplete } from '@/actions/verification';
import { listProducts } from '@/actions/products';
import { getFifoQueue } from '@/actions/inventory';

import ComboboxSelect from '../components/combobox-select';

type OutboundSummary = {
  id: string;
  tracking_number: string | null;
  route: string;
  created_at: string;
  verified: boolean;
  notes: string | null;
  from_name: string;
  to_name: string;
  user_name: string;
  item_count: number;
  sku: string;
  model_name: string;
};

type Product = { sku: string; model_name: string; is_serialized?: boolean };
type Location = { id: string; name: string; type: string };

const routeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  TB: { label: 'Transfer to Branch', color: 'bg-blue-100 text-blue-700', icon: <Truck className="w-3.5 h-3.5" /> },
  B2B: { label: 'Business to Business', color: 'bg-violet-100 text-violet-700', icon: <Users className="w-3.5 h-3.5" /> },
  B2C: { label: 'Business to Customer', color: 'bg-emerald-100 text-emerald-700', icon: <User className="w-3.5 h-3.5" /> },
};

// ── Verification Panel Modal ──────────────────────────────────
function VerificationPanel({
  transactionId,
  trackingNumber,
  onClose,
  onVerified,
}: {
  transactionId: string;
  trackingNumber: string | null;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [verifying, startVerifying] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');

  const DOC_TYPES = [
    { key: 'WAYBILL', label: 'Waybill' },
    { key: 'PAYMENT_RECEIPT', label: 'Payment Receipt' },
    { key: 'PAYMENT_SCREENSHOT', label: 'Finance Verification Email' },
  ] as const;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const result = await getVerificationDocs(transactionId);
      const map: Record<string, string> = {};
      for (const doc of result.data) {
        map[doc.document_type] = doc.storage_url;
      }
      setDocs(map);
    }
    load();
  }, [transactionId]);

  async function handleUpload(docType: 'WAYBILL' | 'PAYMENT_RECEIPT' | 'PAYMENT_SCREENSHOT', file: File) {
    setUploading((prev) => ({ ...prev, [docType]: true }));
    setError(null);
    const result = await uploadVerificationDoc({ transaction_id: transactionId, document_type: docType, file });
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setDocs((prev) => ({ ...prev, [docType]: result.data!.storage_url }));
    }
    setUploading((prev) => ({ ...prev, [docType]: false }));
  }

  function handleVerify() {
    setError(null);
    startVerifying(async () => {
      const result = await markTransactionVerified({ transaction_id: transactionId, user_id: userId });
      if (result.error) {
        setError(result.error);
      } else {
        onVerified();
      }
    });
  }

  const allUploaded = DOC_TYPES.every((d) => !!docs[d.key]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Verify Transaction</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{trackingNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600">
            Upload all three documents to verify this order and mark units as <strong>SOLD</strong>.
          </p>

          {DOC_TYPES.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-3 p-3 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-3">
                {docs[key] ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-slate-700">{label}</span>
              </div>
              <div>
                {docs[key] ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Attached
                    </span>
                    <a
                      href={docs[key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-lg transition-colors"
                    >
                      View Doc ↗
                    </a>
                  </div>
                ) : (
                  <label className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${uploading[key] ? 'bg-indigo-400 text-white cursor-not-allowed' : 'bg-indigo-600 text-white shadow-xs hover:bg-indigo-700'}`}>
                    {uploading[key] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {uploading[key] ? 'Uploading…' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      disabled={!!uploading[key]}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(key as any, file);
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
              Close
            </button>
            <button
              onClick={handleVerify}
              disabled={!allUploaded || verifying}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
              Mark as Verified
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── New Outbound Modal ────────────────────────────────────────
function NewOutboundModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [route, setRoute] = useState<'TB' | 'B2B' | 'B2C' | ''>('');
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [sku, setSku] = useState('');
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [manualSerial, setManualSerial] = useState('');
  const [nonSerializedQty, setNonSerializedQty] = useState('');
  const [fifoSuggestions, setFifoSuggestions] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    async function load() {
      const { data: prods } = await listProducts();
      setProducts((prods || []) as any);
      const supabase = createClient();
      const { data: locs } = await supabase.from('locations').select('id, name, type').order('type', { ascending: false });
      setLocations(locs || []);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    load();
  }, []);

  useEffect(() => {
    async function loadFifo() {
      if (!sku || !fromLocationId) { setFifoSuggestions([]); return; }
      const selectedProd = products.find((p) => p.sku === sku);
      if (selectedProd && selectedProd.is_serialized === false) { setFifoSuggestions([]); return; }
      const result = await getFifoQueue(sku, fromLocationId);
      setFifoSuggestions(result.data.map((u) => u.serial_number).slice(0, 20));
    }
    loadFifo();
  }, [sku, fromLocationId, products]);

  function addSerial(sn: string) {
    const trimmed = sn.trim();
    if (!trimmed || selectedSerials.includes(trimmed)) return;
    setSelectedSerials((prev) => [...prev, trimmed]);
  }

  function removeSerial(sn: string) {
    setSelectedSerials((prev) => prev.filter((s) => s !== sn));
  }

  function handleSubmit() {
    setError(null);
    if (!route) { setError('Select a route'); return; }
    if (!fromLocationId) { setError('Select source location'); return; }
    if (route === 'TB' && !toLocationId) { setError('Select destination branch for Transfer'); return; }
    if (selectedSerials.length === 0) { setError('Add at least one serial number'); return; }

    startTransition(async () => {
      const reserveResult = await reserveUnits({ serial_numbers: selectedSerials, user_id: userId });
      if (reserveResult.errors.length > 0) {
        setError(`Could not reserve: ${reserveResult.errors.map((e) => `${e.serial_number}: ${e.error}`).join(', ')}`);
        return;
      }
      const result = await createOutboundTransaction({
        route: route as 'TB' | 'B2B' | 'B2C',
        from_location_id: fromLocationId,
        to_location_id: toLocationId || undefined,
        serial_numbers: selectedSerials,
        user_id: userId,
        notes: notes || undefined,
      });
      if (result.error) { setError(result.error); return; }
      onSuccess();
    });
  }

  const warehouseLocations = locations.filter((l) => l.type === 'WAREHOUSE');
  const branchLocations = locations.filter((l) => l.type === 'BRANCH');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Create Outbound Order</h2>
            <p className="text-xs text-slate-500 mt-0.5">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Step 1: Route */}
          {step === 1 && (
            <div className="px-6 py-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Select Route Type</h3>
              <div className="grid grid-cols-3 gap-3">
                {(['TB', 'B2B', 'B2C'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoute(r)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                      route === r
                        ? 'border-indigo-500 bg-indigo-50/50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl ${route === r ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-indigo-950 font-bold'}`}>
                      {routeConfig[r].icon}
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{r}</span>
                    <span className="text-[10px] text-slate-400 text-center leading-tight">{routeConfig[r].label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ComboboxSelect
                  label="From Location"
                  options={locations.map((l) => ({
                    value: l.id,
                    label: l.name,
                    sublabel: l.type,
                  }))}
                  value={fromLocationId}
                  onChange={setFromLocationId}
                  placeholder="Select source location..."
                  searchPlaceholder="Type location name..."
                />
                {route === 'TB' && (
                  <ComboboxSelect
                    label="To Branch"
                    options={branchLocations.map((l) => ({
                      value: l.id,
                      label: l.name,
                      sublabel: l.type,
                    }))}
                    value={toLocationId}
                    onChange={setToLocationId}
                    placeholder="Select destination branch..."
                    searchPlaceholder="Type branch name..."
                  />
                )}
              </div>

              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />

              <button
                onClick={() => { if (!route || !fromLocationId) { setError('Select route and source location'); return; } setError(null); setStep(2); }}
                className="w-full py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
              >
                Next: Add Items →
              </button>
            </div>
          )}

          {/* Step 2: Select Serials */}
          {step === 2 && (() => {
            const selectedProd = products.find((p) => p.sku === sku);
            const isSerialized = selectedProd ? selectedProd.is_serialized !== false : true;

            const handleAddQuantity = async () => {
              setError(null);
              const qty = parseInt(nonSerializedQty, 10);
              if (isNaN(qty) || qty <= 0) { setError('Please enter a valid quantity'); return; }
              const result = await getFifoSerialsForQuantity({ sku, location_id: fromLocationId, quantity: qty });
              if (result.error) {
                setError(result.error);
              } else if (result.serial_numbers) {
                setSelectedSerials((prev) => {
                  const next = [...prev];
                  result.serial_numbers.forEach((sn) => {
                    if (!next.includes(sn)) next.push(sn);
                  });
                  return next;
                });
                setNonSerializedQty('');
              }
            };

            // Group selected serials
            const groupedSelected = selectedSerials.reduce((acc, sn) => {
              const isNs = sn.startsWith('NS-');
              let itemSku = '';
              if (isNs) {
                const parts = sn.split('-');
                const timestampIndex = parts.findIndex((p, idx) => idx > 0 && /^\d{13}$/.test(p));
                if (timestampIndex > 0) {
                  itemSku = parts.slice(1, timestampIndex).join('-');
                } else {
                  itemSku = parts[1] || '';
                }
              }

              if (itemSku) {
                if (!acc[itemSku]) {
                  const prod = products.find((p) => p.sku === itemSku);
                  acc[itemSku] = {
                    sku: itemSku,
                    modelName: prod ? prod.model_name : itemSku,
                    isSerialized: false,
                    items: [],
                  };
                }
                acc[itemSku].items.push(sn);
              } else {
                if (!acc['_serialized']) {
                  acc['_serialized'] = {
                    sku: '',
                    modelName: 'Serialized Units',
                    isSerialized: true,
                    items: [],
                  };
                }
                acc['_serialized'].items.push(sn);
              }
              return acc;
            }, {} as Record<string, { sku: string; modelName: string; isSerialized: boolean; items: string[] }>);

            return (
              <div className="px-6 py-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">Add Items to Dispatch</h3>

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

                {sku && !isSerialized ? (
                  /* Non-serialized product: enter quantity */
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={nonSerializedQty}
                      onChange={(e) => setNonSerializedQty(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddQuantity(); }}
                      placeholder="Enter quantity of panels/accessories..."
                      className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <button onClick={handleAddQuantity}
                      className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
                      Add Qty
                    </button>
                  </div>
                ) : sku ? (
                  /* Serialized product: enter/scan serials */
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualSerial}
                        onChange={(e) => setManualSerial(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { addSerial(manualSerial); setManualSerial(''); } }}
                        placeholder="Scan or type serial number…"
                        className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
                      />
                      <button onClick={() => { addSerial(manualSerial); setManualSerial(''); }}
                        className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
                        Add
                      </button>
                    </div>

                    {/* FIFO Suggestions */}
                    {fifoSuggestions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">FIFO Suggestions (oldest first):</p>
                        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                          {fifoSuggestions.map((sn) => (
                            <button
                              key={sn}
                              onClick={() => addSerial(sn)}
                              disabled={selectedSerials.includes(sn)}
                              className={`text-xs font-mono px-2.5 py-1 rounded-lg border transition-colors ${
                                selectedSerials.includes(sn)
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 cursor-not-allowed'
                                  : 'bg-slate-50 border-slate-200 text-indigo-950 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 font-medium'
                              }`}
                            >
                              {selectedSerials.includes(sn) ? '✓ ' : ''}{sn}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Selected list */}
                {selectedSerials.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                      {selectedSerials.length} unit(s) selected
                    </div>
                    <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                      {Object.values(groupedSelected).map((group) => {
                        if (!group.isSerialized) {
                          return (
                            <div key={group.sku} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50/50">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{group.modelName}</p>
                                <p className="text-xs text-slate-400 font-mono">SKU: {group.sku} · Qty: {group.items.length}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedSerials((prev) => prev.filter((s) => !group.items.includes(s)));
                                }}
                                className="p-1 hover:text-red-500 text-slate-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        } else {
                          return group.items.map((sn) => (
                            <div key={sn} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50/50">
                              <span className="text-sm font-mono text-slate-800">{sn}</span>
                              <button onClick={() => removeSerial(sn)} className="p-1 hover:text-red-500 text-slate-400">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ));
                        }
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl">← Back</button>
                  <button onClick={() => { if (selectedSerials.length === 0) { setError('Add at least one item'); return; } setError(null); setStep(3); }}
                    className="flex-1 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
                    Review →
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="px-6 py-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Confirm & Create</h3>
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Route</span><span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${routeConfig[route]?.color}`}>{routeConfig[route]?.label}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">From</span><span className="font-medium">{locations.find((l) => l.id === fromLocationId)?.name}</span></div>
                {toLocationId && <div className="flex justify-between"><span className="text-slate-500">To</span><span className="font-medium">{locations.find((l) => l.id === toLocationId)?.name}</span></div>}
                <div className="flex justify-between"><span className="text-slate-500">Units</span><span className="font-bold">{selectedSerials.length}</span></div>
              </div>

              {(route === 'B2B' || route === 'B2C') && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  After creating, you must upload a waybill, payment receipt, and payment screenshot to verify this order and mark units as SOLD.
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4" /> {error}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl">← Back</button>
                <button onClick={handleSubmit} disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                  {isPending ? 'Creating…' : 'Create Outbound'}
                </button>
              </div>
            </div>
          )}
        </div>

        {error && step !== 3 && (
          <div className="px-6 pb-4 flex-shrink-0">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
const ITEMS_PER_PAGE = 10;

export default function OutboundPage() {
  const [transactions, setTransactions] = useState<OutboundSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<{ id: string; tracking: string | null } | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE) || 1;
  const paginatedTxns = transactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  async function fetchTransactions() {
    setLoading(true);
    const supabase = (createClient()) as any;
    const { data, error: fetchError } = await supabase
      .from('transactions')
      .select(`
        id,
        tracking_number,
        route,
        created_at,
        verified,
        notes,
        from_loc:locations!from_location_id(name),
        to_loc:locations!to_location_id(name),
        profiles(full_name),
        transaction_items(
          serial_number,
          inventory_units(
            sku,
            products(model_name)
          )
        )
      `)
      .eq('type', 'OUTBOUND')
      .order('created_at', { ascending: false });

    if (fetchError) { setError(fetchError.message); setLoading(false); return; }

    setTransactions(
      (data || []).map((t: any) => {
        const items = t.transaction_items || [];
        const firstItem = items[0];
        const sku = firstItem?.inventory_units?.sku || '';
        const modelName = firstItem?.inventory_units?.products?.model_name || '';
        return {
          id: t.id,
          tracking_number: t.tracking_number,
          route: t.route || 'UNKNOWN',
          created_at: t.created_at,
          verified: t.verified,
          notes: t.notes,
          from_name: t.from_loc?.name || 'Warehouse',
          to_name: t.to_loc?.name || 'Customer / B2B',
          user_name: t.profiles?.full_name || 'System',
          item_count: items.length,
          sku,
          model_name: modelName,
        };
      })
    );
    setError(null);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete/cancel this outbound dispatch? The reserved/transit inventory units will be returned to active stock.')) return;
    setIsDeleteLoading(true);
    const res = await deleteOutboundTransaction(id);
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
      {showNewModal && (
        <NewOutboundModal
          onClose={() => setShowNewModal(false)}
          onSuccess={() => { setShowNewModal(false); fetchTransactions(); }}
        />
      )}
      {verifyTarget && (
        <VerificationPanel
          transactionId={verifyTarget.id}
          trackingNumber={verifyTarget.tracking}
          onClose={() => setVerifyTarget(null)}
          onVerified={() => { setVerifyTarget(null); fetchTransactions(); }}
        />
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Outbound Operations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage dispatch workflows, branch transfers, and sales orders.</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 rounded-xl text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
        >
          <Plus className="w-4 h-4" />
          Create Outbound Order
        </button>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Outbound History</h2>
          <span className="text-xs text-slate-400 font-medium">{transactions.length} order(s) logged</span>
        </div>

        {error && <div className="p-5 text-center text-red-500 bg-red-50/50">Failed to load: {error}</div>}
        {loading && <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>}

        {!loading && !error && transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-slate-50 rounded-2xl mb-3"><FileX className="w-8 h-8 text-slate-300" /></div>
            <p className="text-sm text-slate-500">No outbound transactions yet</p>
            <button onClick={() => setShowNewModal(true)} className="mt-4 text-sm text-indigo-600 font-medium hover:underline">
              Create your first outbound order →
            </button>
          </div>
        )}

        {!loading && !error && transactions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Tracking Number', 'Route', 'Destination', 'Status', 'Items', 'Date', ''].map((h) => (
                    <th key={h} className={`text-left text-xs font-medium text-slate-500 uppercase tracking-wider p-4 pb-3 ${h === 'Items' ? 'text-center' : h === 'Date' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedTxns.map((txn) => {
                  const route = routeConfig[txn.route] || { label: txn.route, color: 'bg-slate-100 text-slate-700', icon: null };
                  const needsVerify = !txn.verified && (txn.route === 'B2B' || txn.route === 'B2C');
                  return (
                    <tr key={txn.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><ArrowUpRight className="w-4 h-4" /></div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {txn.model_name || 'Unknown Product'}{' '}
                              {txn.sku && (
                                <span className="text-xs font-normal text-slate-400 font-mono">({txn.sku})</span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{txn.tracking_number || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${route.color}`}>
                          {route.icon}{route.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-700">{txn.to_name}</span>
                          <span className="text-xs text-slate-400 mt-0.5">From: {txn.from_name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        {txn.verified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/50 rounded-full px-2.5 py-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />Verified
                          </span>
                        ) : needsVerify ? (
                          <button
                            onClick={() => setVerifyTarget({ id: txn.id, tracking: txn.tracking_number })}
                            className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200/50 rounded-full px-2.5 py-1 hover:bg-amber-100 transition-colors cursor-pointer"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />Verify Now
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200/50 rounded-full px-2.5 py-1">
                            <Truck className="w-3.5 h-3.5" />In Transit
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center font-semibold text-slate-800">{txn.item_count}</td>
                      <td className="p-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm text-slate-700">{new Date(txn.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(txn.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-3">
                          {needsVerify && (
                            <button
                              onClick={() => setVerifyTarget({ id: txn.id, tracking: txn.tracking_number })}
                              className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                            >
                              Verify <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!txn.verified && (
                            <button
                              onClick={() => handleDelete(txn.id)}
                              disabled={isDeleteLoading}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-600 hover:text-red-800 hover:bg-red-100/70 border border-red-100 rounded-lg transition-colors"
                              title="Delete/Cancel outbound"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                of <strong className="text-slate-800">{transactions.length}</strong> orders
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
