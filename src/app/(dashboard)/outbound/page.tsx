// ============================================================
// PSMI System — Outbound Operations Page
// ============================================================
// Client Component — lists all outbound transactions,
// opens NewOutboundModal and VerificationPanel modals.
// ============================================================

'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  FileX,
  Plus,
  Clock,
  AlertCircle,
  CheckCircle2,
  PackageCheck,
  Loader2,
  X,
  Scan,
  Truck,
  Package,
  Users,
  User,
  MapPin,
  FileCheck,
  Upload,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Coins,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Search,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { reserveUnits, createOutboundTransaction, getFifoSerialsForQuantity, deleteOutboundTransaction, markTransferDelivered } from '@/actions/outbound';
import {
  uploadMultipleVerificationDocs,
  deleteVerificationDoc,
  markTransactionVerified,
  getVerificationDocs,
  checkVerificationComplete,
} from '@/actions/verification';
import { listProducts } from '@/actions/products';
import { listLocations } from '@/actions/locations';
import { getFifoQueue, getLocationStockCounts } from '@/actions/inventory';
import { formatNaira } from '@/lib/utils/currency';
import { VerificationDocument } from '@/lib/types/database';

import ComboboxSelect from '../components/combobox-select';
import ConfirmModal from '../components/confirm-modal';
import FeedbackModal from '../components/feedback-modal';
import { ModalWrapper } from '../components/modal-wrapper';
import { useUser } from '../components/user-context';

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
  customer_name?: string | null;
  sales_manager?: string | null;
};

type Product = {
  sku: string;
  model_name: string;
  is_serialized?: boolean;
  category_badge?: string;
  cost_price?: number | null;
  retail_price?: number | null;
};
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
  const [docs, setDocs] = useState<Record<string, VerificationDocument[]>>({
    WAYBILL: [],
    PAYMENT_RECEIPT: [],
    PAYMENT_SCREENSHOT: [],
  });
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [verifying, startVerifying] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');

  const DOC_TYPES = [
    { key: 'WAYBILL', label: 'Waybill', desc: 'Proof of dispatch/delivery or consignment note' },
    { key: 'PAYMENT_RECEIPT', label: 'Payment Receipt', desc: 'Bank transfer receipt(s) or teller(s). Multiple allowed for batch payments.' },
    { key: 'PAYMENT_SCREENSHOT', label: 'Finance Verification Email', desc: 'Email or approval from Bluetti finance verifying transaction' },
  ] as const;

  async function loadDocs() {
    const result = await getVerificationDocs(transactionId);
    const map: Record<string, VerificationDocument[]> = {
      WAYBILL: [],
      PAYMENT_RECEIPT: [],
      PAYMENT_SCREENSHOT: [],
    };
    for (const doc of result.data) {
      if (!map[doc.document_type]) map[doc.document_type] = [];
      map[doc.document_type].push(doc);
    }
    setDocs(map);
  }

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
      await loadDocs();
    }
    init();
  }, [transactionId]);

  async function handleUploadFiles(
    docType: 'WAYBILL' | 'PAYMENT_RECEIPT' | 'PAYMENT_SCREENSHOT',
    files: FileList | null
  ) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setUploading((prev) => ({ ...prev, [docType]: true }));
    setError(null);

    try {
      const formData = new FormData();
      formData.append('transaction_id', transactionId);
      formData.append('document_type', docType);
      fileArray.forEach((file) => {
        formData.append('files', file);
      });

      const result = await uploadMultipleVerificationDocs(formData);

      if (result.errors && result.errors.length > 0) {
        setError(result.errors.join('; '));
      }
      if (result.data && result.data.length > 0) {
        setDocs((prev) => ({
          ...prev,
          [docType]: [...(prev[docType] || []), ...result.data],
        }));
      }
    } catch (err: any) {
      console.error('Failed uploading verification doc:', err);
      setError(err?.message || 'Failed to upload document. Please check file and network connection.');
    } finally {
      setUploading((prev) => ({ ...prev, [docType]: false }));
    }
  }

  async function handleDelete(doc: VerificationDocument) {
    setDeletingId(doc.id);
    setError(null);
    try {
      const result = await deleteVerificationDoc(doc.id, doc.storage_url);
      if (result.error) {
        setError(result.error);
      } else {
        setDocs((prev) => ({
          ...prev,
          [doc.document_type]: (prev[doc.document_type] || []).filter((d) => d.id !== doc.id),
        }));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to remove document.');
    } finally {
      setDeletingId(null);
    }
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

  const allUploaded = DOC_TYPES.every((d) => (docs[d.key] || []).length > 0);

  return (
    <ModalWrapper isOpen={true} onClose={onClose} maxWidth="max-w-2xl lg:max-w-3xl" zIndex="z-50">
      <div className="max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Verify Outbound Transaction</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">Tracking #: {trackingNumber || '—'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          <p className="text-sm text-slate-600">
            Upload verification documents for this order. You can upload <strong>multiple images or PDFs at once</strong> (e.g., when payment was made in multiple installments/batches).
          </p>

          <div className="space-y-4">
            {DOC_TYPES.map(({ key, label, desc }) => {
              const currentDocs = docs[key] || [];
              const isUploading = !!uploading[key];

              return (
                <div key={key} className="border border-slate-200 rounded-2xl p-4 bg-white shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-start gap-3">
                      {currentDocs.length > 0 ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">{label}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            currentDocs.length > 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {currentDocs.length > 0 ? `${currentDocs.length} file(s) attached` : 'Required'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                      </div>
                    </div>

                    {/* Upload button allowing multiple files */}
                    <label className={`cursor-pointer inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all flex-shrink-0 ${
                      isUploading
                        ? 'bg-indigo-300 text-white cursor-not-allowed'
                        : currentDocs.length > 0
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                    }`}>
                      {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {isUploading ? 'Uploading…' : currentDocs.length > 0 ? '+ Add More' : 'Upload Images'}
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) => {
                          handleUploadFiles(key as any, e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  {/* List of uploaded files with preview/link & delete */}
                  {currentDocs.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                      {currentDocs.map((doc, idx) => {
                        const isDeleting = deletingId === doc.id;
                        return (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="p-1.5 bg-white rounded-lg border border-slate-200 text-indigo-600 flex-shrink-0">
                                <ImageIcon className="w-3.5 h-3.5" />
                              </div>
                              <span className="font-medium text-slate-700 truncate">
                                Document #{idx + 1}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <a
                                href={doc.storage_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 font-semibold transition-colors"
                              >
                                View <ExternalLink className="w-3 h-3" />
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDelete(doc)}
                                disabled={isDeleting}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Remove this document"
                              >
                                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-white flex-shrink-0">
          <button
            onClick={onClose}
            className="py-2.5 px-4 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleVerify}
            disabled={!allUploaded || verifying}
            className="flex items-center justify-center gap-2 py-2.5 px-5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
          >
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
            Confirm & Mark as Verified
          </button>
        </div>
      </div>
    </ModalWrapper>
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
  const [customerName, setCustomerName] = useState('');
  const [salesManager, setSalesManager] = useState('');
  const [soldAt, setSoldAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [sku, setSku] = useState('');
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [manualSerial, setManualSerial] = useState('');
  const [nonSerializedQty, setNonSerializedQty] = useState('');
  const [fifoSuggestions, setFifoSuggestions] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [itemPrices, setItemPrices] = useState<Record<string, string>>({});
  const [serialSkuMap, setSerialSkuMap] = useState<Record<string, string>>({});
  const [showIndividualPrices, setShowIndividualPrices] = useState<Record<string, boolean>>({});
  const [expandedSerialsGroup, setExpandedSerialsGroup] = useState<Record<string, boolean>>({});
  const [bulkPriceInput, setBulkPriceInput] = useState<Record<string, string>>({});
  const [bulkTotalInput, setBulkTotalInput] = useState<Record<string, string>>({});
  const [bulkUnitInput, setBulkUnitInput] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationStock, setLocationStock] = useState<Record<string, number>>({});
  const [locationPending, setLocationPending] = useState<Record<string, number>>({});
  const [recentAddedMessage, setRecentAddedMessage] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'IN_STOCK' | 'POWER_STATION' | 'SHS' | 'ACCESSORIES'>('ALL');
  const [activeTabSku, setActiveTabSku] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    async function load() {
      const { data: prods } = await listProducts();
      setProducts((prods || []) as any);
      const supabase = createClient();
      const locRes = await listLocations();
      if (locRes.data && locRes.data.length > 0) {
        setLocations(locRes.data);
      } else {
        const { data: locs } = await supabase.from('locations').select('id, name, type').order('type', { ascending: false });
        setLocations(locs || []);
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    load();
  }, []);

  // Fetch location stock whenever fromLocationId changes or step transitions
  useEffect(() => {
    async function loadStock() {
      if (!fromLocationId) {
        setLocationStock({});
        setLocationPending({});
        return;
      }
      const res = await getLocationStockCounts(fromLocationId);
      if (res.data) setLocationStock(res.data);
      if (res.pending) setLocationPending(res.pending);
    }
    loadStock();
  }, [fromLocationId, step]);

  // Load FIFO suggestions for serialized items
  useEffect(() => {
    async function loadFifo() {
      if (!sku || !fromLocationId) { setFifoSuggestions([]); return; }
      const selectedProd = products.find((p) => p.sku === sku);
      if (selectedProd && selectedProd.is_serialized === false) { setFifoSuggestions([]); return; }
      const result = await getFifoQueue(sku, fromLocationId);
      if (result.data) {
        setFifoSuggestions(result.data.map((u: any) => u.serial_number).slice(0, 30));
      }
    }
    loadFifo();
  }, [sku, fromLocationId, products]);

  function addSerial(sn: string, targetSku?: string) {
    const trimmed = sn.trim();
    if (!trimmed || selectedSerials.includes(trimmed)) return;
    const resolvedSku = targetSku || sku;
    setSelectedSerials((prev) => [...prev, trimmed]);
    if (resolvedSku) {
      setSerialSkuMap((prev) => ({ ...prev, [trimmed]: resolvedSku }));
      const prod = products.find((p) => p.sku === resolvedSku);
      if (prod?.retail_price != null && prod.retail_price > 0) {
        setItemPrices((prev) => ({ ...prev, [trimmed]: String(prod.retail_price) }));
      }
    }
  }

  function removeSerial(sn: string) {
    setSelectedSerials((prev) => prev.filter((s) => s !== sn));
    setItemPrices((prev) => {
      const next = { ...prev };
      delete next[sn];
      return next;
    });
  }

  const handleAddQuantity = async (targetSku: string, qtyToAdd: number) => {
    setError(null);
    if (isNaN(qtyToAdd) || qtyToAdd <= 0) {
      setError('Please enter a valid quantity');
      return;
    }
    const result = await getFifoSerialsForQuantity({
      sku: targetSku,
      location_id: fromLocationId,
      quantity: qtyToAdd,
      exclude_serials: selectedSerials,
    });
    if (result.error) {
      setError(result.error);
    } else if (result.serial_numbers && result.serial_numbers.length > 0) {
      const selectedProd = products.find((p) => p.sku === targetSku);
      setSelectedSerials((prev) => {
        const next = [...prev];
        result.serial_numbers.forEach((sn) => {
          if (!next.includes(sn)) next.push(sn);
        });
        return next;
      });
      const newSkuMap: Record<string, string> = {};
      const newPrices: Record<string, string> = {};
      result.serial_numbers.forEach((sn) => {
        newSkuMap[sn] = targetSku;
        if (selectedProd?.retail_price != null && selectedProd.retail_price > 0) {
          newPrices[sn] = String(selectedProd.retail_price);
        }
      });
      setSerialSkuMap((prev) => ({ ...prev, ...newSkuMap }));
      setItemPrices((prev) => ({ ...prev, ...newPrices }));
      setNonSerializedQty('');
      setRecentAddedMessage(`Added ${qtyToAdd} unit(s) of ${selectedProd?.model_name || targetSku}`);
      setTimeout(() => setRecentAddedMessage(null), 3500);
      setSku('');
    }
  };

  // Group selected serials by product SKU
  const groupedSelected = selectedSerials.reduce((acc, sn) => {
    let itemSku = serialSkuMap[sn];
    if (!itemSku && sn.startsWith('NS-')) {
      const parts = sn.split('-');
      const timestampIndex = parts.findIndex((p, idx) => idx > 0 && /^\d{13}$/.test(p));
      itemSku = timestampIndex > 0 ? parts.slice(1, timestampIndex).join('-') : parts[1] || '';
    }
    const key = itemSku || '_other';
    if (!acc[key]) {
      const prod = products.find((p) => p.sku === key);
      acc[key] = {
        sku: key,
        modelName: prod?.model_name || (key === '_other' ? 'Other Items' : key),
        categoryBadge: prod?.category_badge,
        isSerialized: prod ? prod.is_serialized !== false : !sn.startsWith('NS-'),
        items: [],
      };
    }
    acc[key].items.push(sn);
    return acc;
  }, {} as Record<string, { sku: string; modelName: string; categoryBadge?: string; isSerialized: boolean; items: string[] }>);

  const [showConfirm, setShowConfirm] = useState(false);

  function handlePreSubmit() {
    setError(null);
    if (!route) { setError('Select a route'); return; }
    if (!fromLocationId) { setError('Select source location'); return; }
    if (route === 'TB' && !toLocationId) { setError('Select destination branch for Transfer'); return; }
    if ((route === 'B2B' || route === 'B2C') && !customerName.trim()) {
      setError('Please enter a customer or client name');
      return;
    }
    if ((route === 'B2B' || route === 'B2C') && !salesManager.trim()) {
      setError('Please enter who made the sale (Sales Manager)');
      return;
    }
    if (selectedSerials.length === 0) { setError('Add at least one serial number'); return; }

    setShowConfirm(true);
  }

  function handleConfirmedSubmit() {
    startTransition(async () => {
      const reserveResult = await reserveUnits({ serial_numbers: selectedSerials, user_id: userId });
      if (reserveResult.errors.length > 0) {
        setError(`Could not reserve: ${reserveResult.errors.map((e) => `${e.serial_number}: ${e.error}`).join(', ')}`);
        setShowConfirm(false);
        return;
      }

      // Build prices array with foolproof fallback
      const pricesArray = selectedSerials.map((sn) => {
        let itemSku = serialSkuMap[sn];
        if (!itemSku && sn.startsWith('NS-')) {
          const parts = sn.split('-');
          const timestampIndex = parts.findIndex((p, idx) => idx > 0 && /^\d{13}$/.test(p));
          itemSku = timestampIndex > 0 ? parts.slice(1, timestampIndex).join('-') : parts[1] || '';
        }
        const groupSku = itemSku || '_other';

        let price = parseFloat(itemPrices[sn] || '');
        if (isNaN(price)) {
          const unitInput = parseFloat(bulkUnitInput[groupSku] || bulkPriceInput[groupSku] || '');
          if (!isNaN(unitInput) && unitInput > 0) {
            price = unitInput;
          } else {
            const totalInput = parseFloat(bulkTotalInput[groupSku] || '');
            const countInGroup = selectedSerials.filter(
              (s) => (serialSkuMap[s] || (s.startsWith('NS-') ? (s.split('-')[1] || '') : '')) === itemSku
            ).length;
            if (!isNaN(totalInput) && countInGroup > 0) {
              price = Math.round((totalInput / countInGroup) * 100) / 100;
            } else {
              const prod = products.find((p) => p.sku === groupSku);
              if (prod?.retail_price != null) {
                price = prod.retail_price;
              }
            }
          }
        }

        return {
          serial_number: sn,
          sale_price: isNaN(price) ? 0 : price,
        };
      }).filter((p) => p.sale_price > 0);

      const result = await createOutboundTransaction({
        route: route as 'TB' | 'B2B' | 'B2C',
        from_location_id: fromLocationId,
        to_location_id: toLocationId || undefined,
        serial_numbers: selectedSerials,
        user_id: userId,
        notes: notes || undefined,
        customer_name: (route === 'B2B' || route === 'B2C') ? customerName.trim() : undefined,
        sales_manager: (route === 'B2B' || route === 'B2C') ? salesManager.trim() : undefined,
        sold_at: soldAt || undefined,
        item_prices: (route === 'B2B' || route === 'B2C') && pricesArray.length > 0 ? pricesArray : undefined,
      });
      if (result.error) { setError(result.error); setShowConfirm(false); return; }
      setShowConfirm(false);
      onSuccess();
    });
  }

  const warehouseLocations = locations.filter((l) => l.type === 'WAREHOUSE');
  const branchLocations = locations.filter((l) => l.type === 'BRANCH');
  const fromLoc = locations.find((l) => l.id === fromLocationId);
  const toLoc = locations.find((l) => l.id === toLocationId);
  const uniqueProductCount = Object.keys(groupedSelected).length;

  return (
    <ModalWrapper isOpen={true} onClose={onClose} maxWidth="max-w-5xl" zIndex="z-50">
      <div className="h-[90vh] min-h-[660px] max-h-[920px] flex flex-col border border-slate-100">
        {/* Header with Stepper */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0 bg-white">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Create Outbound Order</h2>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {/* Step 1 Button */}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep(1);
                }}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  step === 1
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title="Go to Route & Destination"
              >
                <span
                  className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                    step > 1
                      ? 'bg-emerald-600 text-white'
                      : step === 1
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {step > 1 ? '✓' : '1'}
                </span>
                <span>Route & Destination</span>
              </button>

              <span className="text-slate-300 font-bold text-xs select-none">→</span>

              {/* Step 2 Button */}
              {(() => {
                const canGoToStep2 = Boolean(
                  route &&
                  fromLocationId &&
                  (route !== 'TB' || toLocationId) &&
                  ((route !== 'B2B' && route !== 'B2C') || (customerName.trim() && salesManager.trim()))
                );

                return (
                  <button
                    type="button"
                    disabled={!canGoToStep2}
                    onClick={() => {
                      if (!canGoToStep2) {
                        setError('Please complete Route and Destination details first');
                        return;
                      }
                      setError(null);
                      setStep(2);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                      step === 2
                        ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                        : canGoToStep2
                        ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer'
                        : 'text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                    title={canGoToStep2 ? 'Go to Add Items' : 'Complete Route & Destination first'}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                        step > 2
                          ? 'bg-emerald-600 text-white'
                          : step === 2
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {step > 2 ? '✓' : '2'}
                    </span>
                    <span>Add Items to Dispatch</span>
                  </button>
                );
              })()}

              <span className="text-slate-300 font-bold text-xs select-none">→</span>

              {/* Step 3 Button */}
              {(() => {
                const canGoToStep3 = Boolean(
                  route &&
                  fromLocationId &&
                  selectedSerials.length > 0
                );

                return (
                  <button
                    type="button"
                    disabled={!canGoToStep3}
                    onClick={() => {
                      if (!canGoToStep3) {
                        setError('Please add at least one item to dispatch first');
                        return;
                      }
                      setError(null);
                      setStep(3);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                      step === 3
                        ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                        : canGoToStep3
                        ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer'
                        : 'text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                    title={canGoToStep3 ? 'Go to Pricing & Review' : 'Add at least one item first'}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                        step === 3
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      3
                    </span>
                    <span>Pricing & Review</span>
                  </button>
                );
              })()}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {/* Step 1: Route & Locations */}
          {step === 1 && (
            <div className="px-6 py-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Select Route Type</h3>
                <p className="text-xs text-slate-400 mt-0.5">Choose how and where this inventory is being moved or sold.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(['TB', 'B2B', 'B2C'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoute(r)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      route === r
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl ${
                        route === r ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-indigo-950 font-bold'
                      }`}
                    >
                      {routeConfig[r].icon}
                    </div>
                    <span className="text-xs font-semibold text-slate-800">{r}</span>
                    <span className="text-[10px] text-slate-400 text-center leading-tight">
                      {routeConfig[r].label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <ComboboxSelect
                  label="From Location (Source Warehouse/Branch)"
                  options={locations.map((l) => ({
                    value: l.id,
                    label: l.name,
                    sublabel: l.type,
                  }))}
                  value={fromLocationId}
                  onChange={(val) => {
                    setFromLocationId(val);
                    // If source changes, reset selected serials to prevent location mismatch
                    if (selectedSerials.length > 0) {
                      setSelectedSerials([]);
                      setSerialSkuMap({});
                      setItemPrices({});
                    }
                  }}
                  placeholder="Select source location..."
                  searchPlaceholder="Type location name..."
                />
                {route === 'TB' && (
                  <ComboboxSelect
                    label="To Branch (Destination)"
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

              {(route === 'B2B' || route === 'B2C') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Customer / Client Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Dangote Industries Ltd, John Doe"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-800 placeholder:text-slate-400"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Name of the customer or business receiving this order.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sales Manager / Sold By <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={salesManager}
                      onChange={(e) => setSalesManager(e.target.value)}
                      placeholder="e.g. Adebayo Ogunlesi"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-800 placeholder:text-slate-400"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Sales person who made or closed this sale.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date of Sale / Outbound Date <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={soldAt}
                    onChange={(e) => setSoldAt(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-800 bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Defaults to today. Change this to backdate if recording past sales or dispatches.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dispatch Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Expedited delivery via GIG Logistics"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-800 placeholder:text-slate-400"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Optional reference, invoice number, or delivery remarks.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Add Items to Dispatch */}
          {step === 2 && (() => {
            const selectedProd = products.find((p) => p.sku === sku);
            const isSerialized = selectedProd ? selectedProd.is_serialized !== false : true;
            const availableStock = sku
              ? Math.max(locationStock[sku] ?? 0, isSerialized ? fifoSuggestions.length : 0)
              : 0;
            const pendingStock = sku ? (locationPending[sku] ?? 0) : 0;
            const alreadySelectedForThisSku = selectedSerials.filter(
              (s) => (serialSkuMap[s] || (s.startsWith('NS-') ? s.split('-')[1] : '')) === sku
            ).length;
            const remainingStock = Math.max(0, availableStock - alreadySelectedForThisSku);

            return (
              <div className="px-6 py-5 space-y-5">
                {/* Source & Route Context Banner */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                        Dispatching From
                      </span>
                      <strong className="text-slate-900 font-semibold text-sm">
                        {fromLoc?.name || 'Selected Location'}
                      </strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold text-right">
                      Route
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${routeConfig[route]?.color}`}>
                      {route === 'TB' ? `Branch: ${toLoc?.name}` : `${routeConfig[route]?.label} (${customerName || 'Direct'})`}
                    </span>
                  </div>
                </div>

                {/* Feedback Toast */}
                {recentAddedMessage && (
                  <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{recentAddedMessage}</span>
                  </div>
                )}

                {/* Two-Column Workspace: Left = Allocation; Right = Persistent Staged Items Sidebar (Option A) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Left Column: Product Selection and Serial/Quantity Allocation */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Select Products to Dispatch</h3>
                          <p className="text-xs text-slate-500">
                            Pick products to add FIFO units, specify quantities, or scan serial numbers.
                          </p>
                        </div>
                        {selectedSerials.length > 0 && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 self-start sm:self-auto">
                            {selectedSerials.length} unit(s) staged
                          </span>
                        )}
                      </div>

                      {/* Search Bar & Category Filters */}
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            placeholder="Filter by product name, SKU, or model..."
                            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400 transition-all"
                          />
                          {productSearch && (
                            <button
                              type="button"
                              onClick={() => setProductSearch('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                          {(
                            [
                              { key: 'ALL', label: 'All' },
                              { key: 'IN_STOCK', label: 'In Stock' },
                              { key: 'POWER_STATION', label: '⚡ Power Station' },
                              { key: 'SHS', label: '☀️ SHS' },
                              { key: 'ACCESSORIES', label: '🔌 Accessories' },
                            ] as const
                          ).map((tab) => (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => setCategoryFilter(tab.key)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors shrink-0 cursor-pointer ${
                                categoryFilter === tab.key
                                  ? 'bg-slate-900 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Product Catalogue List */}
                      {(() => {
                        const filteredProducts = products.filter((p) => {
                          const stock = locationStock[p.sku] ?? 0;
                          if (categoryFilter === 'IN_STOCK' && stock <= 0) return false;
                          if (categoryFilter === 'POWER_STATION' && (p as any).category_badge !== 'POWER_STATION') return false;
                          if (categoryFilter === 'SHS' && (p as any).category_badge !== 'SHS') return false;
                          if (categoryFilter === 'ACCESSORIES' && (p as any).category_badge !== 'ACCESSORIES') return false;

                          if (productSearch.trim()) {
                            const query = productSearch.toLowerCase().trim();
                            const matchName = p.model_name.toLowerCase().includes(query);
                            const matchSku = p.sku.toLowerCase().includes(query);
                            if (!matchName && !matchSku) return false;
                          }
                          return true;
                        });

                        if (filteredProducts.length === 0) {
                          return (
                            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/60 rounded-xl border border-slate-100">
                              No products match the selected filter or search.
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                            {filteredProducts.map((p) => {
                              const totalStock = locationStock[p.sku] ?? 0;
                              const pending = locationPending[p.sku] ?? 0;
                              const alreadyAdded = selectedSerials.filter(
                                (s) => (serialSkuMap[s] || (s.startsWith('NS-') ? s.split('-')[1] : '')) === p.sku
                              ).length;
                              const currentRemaining = Math.max(0, totalStock - alreadyAdded);
                              const isSerializedProd = p.is_serialized !== false;
                              const isSelected = sku === p.sku;

                              return (
                                <div
                                  key={p.sku}
                                  className={`rounded-xl border transition-all p-3 space-y-2.5 ${
                                    isSelected
                                      ? 'border-indigo-400 bg-indigo-50/20 ring-1 ring-indigo-400/30'
                                      : currentRemaining > 0
                                      ? 'border-slate-200 bg-white hover:border-slate-300'
                                      : 'border-slate-200/60 bg-slate-50/60 opacity-75'
                                  }`}
                                >
                                  {/* Row Header: Model, SKU, Badges & Stock Indicator */}
                                  <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <h4 className="text-xs font-bold text-slate-900 truncate">
                                          {p.model_name}
                                        </h4>
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                          {p.sku}
                                        </span>
                                        {(p as any).category_badge === 'POWER_STATION' && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                            ⚡ Power Station
                                          </span>
                                        )}
                                        {(p as any).category_badge === 'SHS' && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                            ☀️ SHS
                                          </span>
                                        )}
                                        {(p as any).category_badge === 'ACCESSORIES' && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-100">
                                            🔌 Accessories
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Stock Badge */}
                                    <div className="text-right shrink-0">
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                          currentRemaining > 0
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : totalStock > 0 && alreadyAdded >= totalStock
                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                            : pending > 0
                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                            : 'bg-slate-100 text-slate-400 border-slate-200'
                                        }`}
                                      >
                                        {currentRemaining > 0
                                          ? `${currentRemaining} in stock`
                                          : alreadyAdded >= totalStock && totalStock > 0
                                          ? `All ${alreadyAdded} staged`
                                          : pending > 0
                                          ? `0 (${pending} pending)`
                                          : 'Out of stock'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Quick Action Controls */}
                                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                                    {isSerializedProd ? (
                                      /* Serialized Controls: FIFO Batch + Specific Serials Picker */
                                      <div className="flex items-center justify-between w-full gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-[11px] text-slate-500 font-medium">FIFO Add:</span>
                                          {[1, 5, 10].map((batchCount) => {
                                            const disabled = currentRemaining < batchCount;
                                            return (
                                              <button
                                                key={batchCount}
                                                type="button"
                                                disabled={disabled}
                                                onClick={() => handleAddQuantity(p.sku, batchCount)}
                                                className="px-2 py-0.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-700 disabled:hover:border-slate-200 transition-colors cursor-pointer"
                                              >
                                                +{batchCount}
                                              </button>
                                            );
                                          })}
                                          {currentRemaining > 0 && (
                                            <button
                                              type="button"
                                              onClick={() => handleAddQuantity(p.sku, currentRemaining)}
                                              className="px-2 py-0.5 text-xs font-semibold rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                                            >
                                              All ({currentRemaining})
                                            </button>
                                          )}
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (sku === p.sku) {
                                              setSku('');
                                            } else {
                                              setSku(p.sku);
                                            }
                                          }}
                                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                                            isSelected
                                              ? 'bg-indigo-600 text-white'
                                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                          }`}
                                        >
                                          <Search className="w-3 h-3" />
                                          {isSelected ? 'Close Picker' : 'Scan / Pick Serials'}
                                        </button>
                                      </div>
                                    ) : (
                                      /* Non-Serialized (Accessory) Controls: Direct Quantity Stepper */
                                      <div className="flex items-center justify-between w-full gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[11px] text-slate-500 font-medium">Add Qty:</span>
                                          <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
                                            <button
                                              type="button"
                                              disabled={currentRemaining <= 0}
                                              onClick={() => {
                                                const cur = parseInt(nonSerializedQty, 10) || 1;
                                                setNonSerializedQty(String(Math.max(1, cur - 1)));
                                              }}
                                              className="px-2 py-1 text-slate-500 hover:bg-slate-100 transition-colors font-bold text-xs cursor-pointer disabled:opacity-40"
                                            >
                                              −
                                            </button>
                                            <input
                                              type="number"
                                              min="1"
                                              max={currentRemaining > 0 ? currentRemaining : undefined}
                                              value={sku === p.sku ? nonSerializedQty : ''}
                                              onFocus={() => {
                                                if (sku !== p.sku) {
                                                  setSku(p.sku);
                                                  setNonSerializedQty('1');
                                                }
                                              }}
                                              onChange={(e) => {
                                                setSku(p.sku);
                                                setNonSerializedQty(e.target.value);
                                              }}
                                              placeholder="1"
                                              className="w-12 text-center py-1 text-xs font-bold text-slate-800 focus:outline-none border-x border-slate-200"
                                            />
                                            <button
                                              type="button"
                                              disabled={currentRemaining <= 0}
                                              onClick={() => {
                                                setSku(p.sku);
                                                const cur = parseInt(nonSerializedQty, 10) || 0;
                                                const next = Math.min(cur + 1, currentRemaining);
                                                setNonSerializedQty(String(next));
                                              }}
                                              className="px-2 py-1 text-slate-500 hover:bg-slate-100 transition-colors font-bold text-xs cursor-pointer disabled:opacity-40"
                                            >
                                              +
                                            </button>
                                          </div>
                                          <button
                                            type="button"
                                            disabled={currentRemaining <= 0}
                                            onClick={() => {
                                              const qty = sku === p.sku && nonSerializedQty ? parseInt(nonSerializedQty, 10) : 1;
                                              if (qty > 0) handleAddQuantity(p.sku, qty);
                                            }}
                                            className="px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                                          >
                                            <Plus className="w-3 h-3" /> Add
                                          </button>
                                        </div>

                                        {currentRemaining > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => handleAddQuantity(p.sku, currentRemaining)}
                                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                                          >
                                            All ({currentRemaining})
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Expandable Manual / Barcode Serial Picker Drawer */}
                                  {isSelected && isSerializedProd && (
                                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-indigo-100 space-y-3 animate-fade-in">
                                      {/* FIFO Suggestions Chips */}
                                      {fifoSuggestions.length > 0 && (
                                        <div className="space-y-1.5">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-slate-700">
                                              Click serial to toggle:
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                              {fifoSuggestions.length} unit(s) available
                                            </span>
                                          </div>
                                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-white rounded-lg border border-slate-200">
                                            {fifoSuggestions.map((sn) => {
                                              const isChosen = selectedSerials.includes(sn);
                                              return (
                                                <button
                                                  key={sn}
                                                  type="button"
                                                  onClick={() => {
                                                    if (isChosen) removeSerial(sn);
                                                    else addSerial(sn, p.sku);
                                                  }}
                                                  className={`text-xs font-mono px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                                                    isChosen
                                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold shadow-2xs'
                                                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300'
                                                  }`}
                                                >
                                                  {isChosen ? '✓ ' : '+ '}
                                                  {sn}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* Barcode Scanner / Manual Serial Input */}
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          value={manualSerial}
                                          onChange={(e) => setManualSerial(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && manualSerial.trim()) {
                                              addSerial(manualSerial.trim(), p.sku);
                                              setManualSerial('');
                                            }
                                          }}
                                          placeholder="Scan barcode or type serial number…"
                                          className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono text-slate-800 bg-white"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (manualSerial.trim()) {
                                              addSerial(manualSerial.trim(), p.sku);
                                              setManualSerial('');
                                            }
                                          }}
                                          disabled={!manualSerial.trim()}
                                          className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer transition-colors"
                                        >
                                          Add Serial
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Right Column: Persistent Staged Items Sidebar (Option A) */}
                  <div className="lg:col-span-5 bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 space-y-3 sticky top-0 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <Truck className="w-4 h-4 text-indigo-600" />
                          Staged Items
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {selectedSerials.length === 0
                            ? 'No units added yet'
                            : `${selectedSerials.length} unit(s) across ${uniqueProductCount} product(s)`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white font-mono">
                          {selectedSerials.length}
                        </span>
                        {selectedSerials.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSerials([]);
                              setSerialSkuMap({});
                              setItemPrices({});
                            }}
                            className="text-[11px] text-rose-600 hover:text-rose-800 font-medium px-1.5 py-0.5 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Clear all staged items"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {selectedSerials.length === 0 ? (
                      <div className="py-10 text-center px-4 bg-white border border-slate-200/70 rounded-xl">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                          <Package className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-semibold text-slate-700">No items staged yet</p>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                          Select a product on the left to allocate FIFO serial numbers or enter quantities.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                        {Object.values(groupedSelected).map((group) => {
                          const isExpanded = expandedSerialsGroup[group.sku];
                          return (
                            <div
                              key={group.sku}
                              className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h5 className="font-bold text-xs text-slate-900 truncate">
                                      {group.modelName}
                                    </h5>
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                      {group.sku}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    Count: <strong className="text-slate-800">{group.items.length} unit(s)</strong>
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {group.isSerialized && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedSerialsGroup((prev) => ({
                                          ...prev,
                                          [group.sku]: !prev[group.sku],
                                        }))
                                      }
                                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                                      title={isExpanded ? 'Hide serials' : 'View serials'}
                                    >
                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSerials((prev) => prev.filter((s) => !group.items.includes(s)));
                                    }}
                                    className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                    title={`Remove all ${group.modelName}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Serial Chips */}
                              {isExpanded && group.isSerialized && (
                                <div className="pt-2 border-t border-slate-100">
                                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1.5 bg-slate-50 rounded-lg">
                                    {group.items.map((sn) => (
                                      <span
                                        key={sn}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono bg-white border border-slate-200 text-slate-700 rounded shadow-2xs"
                                      >
                                        {sn}
                                        <button
                                          type="button"
                                          onClick={() => removeSerial(sn)}
                                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                          title="Remove this serial"
                                        >
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Step 3: Review & Pricing */}
          {step === 3 && (
            <div className="px-6 py-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Confirm & Review Dispatch</h3>
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Route</span>
                  <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${routeConfig[route]?.color}`}>
                    {routeConfig[route]?.label}
                  </span>
                </div>
                {(route === 'B2B' || route === 'B2C') && customerName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer</span>
                    <span className="font-semibold text-slate-800">{customerName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">From Location</span>
                  <span className="font-medium text-slate-800">{fromLoc?.name}</span>
                </div>
                {toLocationId && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">To Branch</span>
                    <span className="font-medium text-slate-800">{toLoc?.name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Items</span>
                  <span className="font-bold text-slate-900">
                    {selectedSerials.length} unit(s) across {uniqueProductCount} product(s)
                  </span>
                </div>
              </div>

              {(route === 'B2B' || route === 'B2C') && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                      <Coins className="w-4 h-4 text-emerald-600" />
                      <span>Sales Pricing & Item Rates (₦)</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Total Order Value</span>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full font-mono">
                        {formatNaira(
                          selectedSerials.reduce((sum, sn) => {
                            const val = parseFloat(itemPrices[sn] || '0');
                            return sum + (isNaN(val) ? 0 : val);
                          }, 0)
                        )}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Default rates are populated from product retail prices. You can edit individual item rates or bulk-apply a total price per product group.
                  </p>

                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {Object.entries(
                      selectedSerials.reduce((acc, sn) => {
                        let itemSku = serialSkuMap[sn];
                        if (!itemSku && sn.startsWith('NS-')) {
                          const parts = sn.split('-');
                          const timestampIndex = parts.findIndex((p, idx) => idx > 0 && /^\d{13}$/.test(p));
                          itemSku = timestampIndex > 0 ? parts.slice(1, timestampIndex).join('-') : parts[1] || '';
                        }
                        const key = itemSku || '_other';
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(sn);
                        return acc;
                      }, {} as Record<string, string[]>)
                    ).map(([groupSku, serials]) => {
                      const prod = products.find((p) => p.sku === groupSku);
                      const isExpanded = showIndividualPrices[groupSku];
                      const groupSubtotal = serials.reduce((sum, sn) => {
                        const val = parseFloat(itemPrices[sn] || '0');
                        return sum + (isNaN(val) ? 0 : val);
                      }, 0);

                      const handleUnitChange = (valStr: string) => {
                        setBulkUnitInput((prev) => ({ ...prev, [groupSku]: valStr }));
                        const unitNum = parseFloat(valStr);
                        if (!isNaN(unitNum) && unitNum >= 0) {
                          const totalNum = Math.round(unitNum * serials.length * 100) / 100;
                          setBulkTotalInput((prev) => ({ ...prev, [groupSku]: String(totalNum) }));
                          setItemPrices((prev) => {
                            const updated = { ...prev };
                            serials.forEach((sn) => {
                              updated[sn] = String(unitNum);
                            });
                            return updated;
                          });
                        } else if (valStr === '') {
                          setBulkTotalInput((prev) => ({ ...prev, [groupSku]: '' }));
                          setItemPrices((prev) => {
                            const updated = { ...prev };
                            serials.forEach((sn) => {
                              delete updated[sn];
                            });
                            return updated;
                          });
                        }
                      };

                      const handleTotalChange = (valStr: string) => {
                        setBulkTotalInput((prev) => ({ ...prev, [groupSku]: valStr }));
                        const totalNum = parseFloat(valStr);
                        if (!isNaN(totalNum) && totalNum >= 0 && serials.length > 0) {
                          const unitNum = Math.round((totalNum / serials.length) * 100) / 100;
                          setBulkUnitInput((prev) => ({ ...prev, [groupSku]: String(unitNum) }));
                          setItemPrices((prev) => {
                            const updated = { ...prev };
                            serials.forEach((sn) => {
                              updated[sn] = String(unitNum);
                            });
                            return updated;
                          });
                        } else if (valStr === '') {
                          setBulkUnitInput((prev) => ({ ...prev, [groupSku]: '' }));
                          setItemPrices((prev) => {
                            const updated = { ...prev };
                            serials.forEach((sn) => {
                              delete updated[sn];
                            });
                            return updated;
                          });
                        }
                      };

                      return (
                        <div key={groupSku} className="border border-slate-200 rounded-xl bg-slate-50/70 p-3.5 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-semibold text-slate-800">
                                  {prod?.model_name || groupSku}{' '}
                                  <span className="font-mono text-[10px] text-slate-400 font-normal">({groupSku})</span>
                                </p>
                                {prod?.retail_price != null && prod.retail_price > 0 ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-mono">
                                    Catalog: {formatNaira(prod.retail_price)}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-normal bg-slate-100 text-slate-500 border border-slate-200">
                                    No catalog price set
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {serials.length} unit{serials.length > 1 ? 's' : ''} · Subtotal:{' '}
                                <strong className="text-emerald-700 font-mono">{formatNaira(groupSubtotal)}</strong>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setShowIndividualPrices((prev) => ({
                                  ...prev,
                                  [groupSku]: !prev[groupSku],
                                }))
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer"
                            >
                              {isExpanded ? (
                                <>Hide item breakdown <ChevronUp className="w-3.5 h-3.5" /></>
                              ) : (
                                <>Edit item rates ({serials.length}) <ChevronDown className="w-3.5 h-3.5" /></>
                              )}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                Total Price for all {serials.length} units (₦)
                              </label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">₦</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={bulkTotalInput[groupSku] ?? (groupSubtotal > 0 ? String(groupSubtotal) : '')}
                                  onChange={(e) => handleTotalChange(e.target.value)}
                                  placeholder={`Total for ${serials.length} items`}
                                  className="w-full pl-6 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                                Price Per Unit (₦)
                              </label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">₦</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={bulkUnitInput[groupSku] ?? (serials[0] && itemPrices[serials[0]] ? itemPrices[serials[0]] : '')}
                                  onChange={(e) => handleUnitChange(e.target.value)}
                                  placeholder="Rate per item"
                                  className="w-full pl-6 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
                                />
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5 max-h-40 overflow-y-auto">
                              <p className="text-[10px] text-slate-400">Custom rate per serial number / unit:</p>
                              {serials.map((sn) => (
                                <div key={sn} className="flex items-center justify-between gap-2 text-xs bg-white px-2.5 py-1 rounded-lg border border-slate-100">
                                  <span className="font-mono text-slate-600 truncate max-w-[160px] text-[11px]">{sn}</span>
                                  <div className="relative w-36">
                                    <span className="absolute left-2 top-1 text-slate-400 font-mono text-[10px]">₦</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={itemPrices[sn] ?? ''}
                                      onChange={(e) =>
                                        setItemPrices((prev) => ({ ...prev, [sn]: e.target.value }))
                                      }
                                      placeholder="0.00"
                                      className="w-full pl-5 pr-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-right"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(route === 'B2B' || route === 'B2C') && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  After creating, you can upload waybill and payment documents to verify this order and mark units as SOLD.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Global Error Notice */}
        {error && (
          <div className="px-6 py-2.5 bg-rose-50 border-t border-rose-100 flex-shrink-0 flex items-center gap-2 text-xs font-semibold text-rose-700">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Sticky Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex-shrink-0">
          <div>
            {step === 2 && (
              <span className="text-xs text-slate-500 font-medium">
                Total:{' '}
                <strong className="text-slate-900 font-semibold">{selectedSerials.length} unit(s)</strong>
                {uniqueProductCount > 0 && (
                  <span>
                    {' '}across{' '}
                    <strong className="text-slate-900 font-semibold">
                      {uniqueProductCount} product{uniqueProductCount > 1 ? 's' : ''}
                    </strong>
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {step > 1 && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep((s) => (s - 1) as any);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                ← Back
              </button>
            )}
            {step === 1 && (
              <button
                type="button"
                onClick={() => {
                  if (!route || !fromLocationId) {
                    setError('Select route and source location');
                    return;
                  }
                  if (route === 'TB' && !toLocationId) {
                    setError('Select destination branch for Transfer');
                    return;
                  }
                  if ((route === 'B2B' || route === 'B2C') && !customerName.trim()) {
                    setError('Please enter customer/client name for B2B/B2C sales');
                    return;
                  }
                  if ((route === 'B2B' || route === 'B2C') && !salesManager.trim()) {
                    setError('Please enter who made the sale (Sales Manager)');
                    return;
                  }
                  setError(null);
                  setStep(2);
                }}
                className="px-5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
              >
                Next: Add Items →
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                onClick={() => {
                  if (selectedSerials.length === 0) {
                    setError('Please add at least one unit or product to dispatch');
                    return;
                  }
                  setError(null);
                  setStep(3);
                }}
                className="px-5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                Review ({selectedSerials.length}) →
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={handlePreSubmit}
                disabled={isPending}
                className="px-5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                {isPending ? 'Creating…' : 'Confirm & Dispatch'}
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmedSubmit}
        isLoading={isPending}
        title="Confirm Outbound Dispatch"
        message={
          <div className="space-y-2">
            <p className="text-slate-600 font-medium">Review dispatch order details:</p>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1 text-slate-700">
              <p>
                <strong className="text-slate-900">Route:</strong> {routeConfig[route]?.label || route}
              </p>
              <p>
                <strong className="text-slate-900">Source:</strong>{' '}
                {locations.find((l) => l.id === fromLocationId)?.name || 'Source'}
              </p>
              {toLocationId && (
                <p>
                  <strong className="text-slate-900">Destination:</strong>{' '}
                  {locations.find((l) => l.id === toLocationId)?.name}
                </p>
              )}
              {customerName && (
                <p>
                  <strong className="text-slate-900">Customer:</strong> {customerName}
                </p>
              )}
              {salesManager && (
                <p>
                  <strong className="text-slate-900">Sales Manager:</strong> {salesManager}
                </p>
              )}
              <p>
                <strong className="text-slate-900">Units:</strong> {selectedSerials.length} unit(s)
              </p>
              {(route === 'B2B' || route === 'B2C') && (
                <p>
                  <strong className="text-slate-900">Total Value:</strong>{' '}
                  {formatNaira(
                    selectedSerials.reduce((sum, sn) => {
                      const val = parseFloat(itemPrices[sn] || '0');
                      return sum + (isNaN(val) ? 0 : val);
                    }, 0)
                  )}
                </p>
              )}
            </div>
          </div>
        }
        confirmText="Yes, Create Outbound"
      />
    </ModalWrapper>
  );
}

// ── Main Page ─────────────────────────────────────────────────
const ITEMS_PER_PAGE = 10;

export default function OutboundPage() {
  const { isViewer } = useUser();
  const [transactions, setTransactions] = useState<OutboundSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<{ id: string; tracking: string | null } | null>(null);
  const [deliveryTarget, setDeliveryTarget] = useState<OutboundSummary | null>(null);
  const [isDeliveryLoading, setIsDeliveryLoading] = useState(false);
  const [deliveryFeedback, setDeliveryFeedback] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'ALL' | 'NEEDS_WAYBILL' | 'TB' | 'SALES' | 'VERIFIED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const needsWaybillCount = useMemo(() => {
    return transactions.filter((t) => !t.verified && (t.route === 'B2B' || t.route === 'B2C')).length;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      if (activeTab === 'NEEDS_WAYBILL') {
        if (txn.verified || (txn.route !== 'B2B' && txn.route !== 'B2C')) return false;
      } else if (activeTab === 'TB') {
        if (txn.route !== 'TB') return false;
      } else if (activeTab === 'SALES') {
        if (txn.route !== 'B2B' && txn.route !== 'B2C') return false;
      } else if (activeTab === 'VERIFIED') {
        if (!txn.verified) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTracking = txn.tracking_number?.toLowerCase().includes(q);
        const matchModel = txn.model_name?.toLowerCase().includes(q);
        const matchSku = txn.sku?.toLowerCase().includes(q);
        const matchTo = txn.to_name?.toLowerCase().includes(q);
        const matchFrom = txn.from_name?.toLowerCase().includes(q);
        const matchCustomer = txn.customer_name?.toLowerCase().includes(q);
        const matchSalesMgr = txn.sales_manager?.toLowerCase().includes(q);
        return Boolean(matchTracking || matchModel || matchSku || matchTo || matchFrom || matchCustomer || matchSalesMgr);
      }

      return true;
    });
  }, [transactions, activeTab, searchQuery]);

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE) || 1;
  const paginatedTxns = filteredTransactions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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
        customer_name,
        sales_manager,
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
      .order('created_at', { ascending: false })
      .limit(50);

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
          customer_name: t.customer_name || null,
          sales_manager: t.sales_manager || null,
          from_name: t.from_loc?.name || 'Warehouse',
          to_name: t.to_loc?.name || t.customer_name || 'Customer / B2B',
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

  const [txnToDelete, setTxnToDelete] = useState<OutboundSummary | null>(null);

  async function handleConfirmDelete() {
    if (!txnToDelete) return;
    setIsDeleteLoading(true);
    const res = await deleteOutboundTransaction(txnToDelete.id);
    setIsDeleteLoading(false);
    if (res.error) {
      alert(res.error);
    } else {
      setTxnToDelete(null);
      await fetchTransactions();
    }
  }

  async function handleConfirmDelivery() {
    if (!deliveryTarget) return;
    setIsDeliveryLoading(true);
    const res = await markTransferDelivered(deliveryTarget.id);
    setIsDeliveryLoading(false);
    if (res.error) {
      setDeliveryFeedback({
        isOpen: true,
        type: 'error',
        title: 'Stock Delivery Failed',
        message: res.error,
      });
    } else {
      const branchName = deliveryTarget.to_name;
      const tracking = deliveryTarget.tracking_number || deliveryTarget.id;
      setDeliveryTarget(null);
      setDeliveryFeedback({
        isOpen: true,
        type: 'success',
        title: 'Stock Delivered Successfully',
        message: `Dispatch ${tracking} has been marked as Stock Delivered! All ${deliveryTarget.item_count} items are now available in active branch inventory at ${branchName}.`,
      });
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

      {/* Confirm Stock Delivery Modal */}
      {deliveryTarget && (
        <ConfirmModal
          isOpen={!!deliveryTarget}
          onClose={() => setDeliveryTarget(null)}
          onConfirm={handleConfirmDelivery}
          isLoading={isDeliveryLoading}
          isDestructive={false}
          title="Confirm Stock Delivered"
          icon={<PackageCheck className="w-6 h-6 text-emerald-600" />}
          message={
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                Are you sure you want to mark outbound dispatch{' '}
                <strong className="font-mono text-slate-900">{deliveryTarget.tracking_number || deliveryTarget.id}</strong>{' '}
                as <strong className="text-emerald-700 font-semibold">Stock Delivered</strong>?
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Destination Branch:</span>
                  <span className="font-semibold text-slate-800">{deliveryTarget.to_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Units:</span>
                  <span className="font-semibold text-slate-800">{deliveryTarget.item_count} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Product:</span>
                  <span className="font-semibold text-slate-800">{deliveryTarget.model_name || deliveryTarget.sku || 'Items'}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                All {deliveryTarget.item_count} unit(s) will be updated from <span className="font-mono text-blue-600 font-medium">IN_TRANSIT</span> to <span className="font-mono text-emerald-600 font-medium">IN_BRANCH</span> at <strong>{deliveryTarget.to_name}</strong>, and this order will show as <strong>Stock Delivered</strong>.
              </p>
            </div>
          }
          confirmText="Yes, Mark Stock Delivered"
        />
      )}

      {/* Stock Delivery Feedback Modal */}
      {deliveryFeedback && (
        <FeedbackModal
          isOpen={deliveryFeedback.isOpen}
          onClose={() => setDeliveryFeedback(null)}
          type={deliveryFeedback.type}
          title={deliveryFeedback.title}
          message={deliveryFeedback.message}
          buttonText="Close"
        />
      )}

      {/* Cancel Outbound Confirmation Modal */}
      <ConfirmModal
        isOpen={!!txnToDelete}
        onClose={() => setTxnToDelete(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleteLoading}
        isDestructive={true}
        title="Cancel Outbound Dispatch"
        message={
          <div className="space-y-2">
            <p>
              Are you sure you want to cancel and delete outbound dispatch{' '}
              <strong className="font-mono text-slate-800">{txnToDelete?.tracking_number || txnToDelete?.id}</strong>?
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              All {txnToDelete?.item_count} reserved or in-transit inventory units will be returned to active stock at{' '}
              <strong>{txnToDelete?.from_name}</strong>.
            </p>
          </div>
        }
        confirmText="Yes, Cancel Dispatch"
      />

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Outbound Operations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage dispatch workflows, branch transfers, and sales orders.</p>
        </div>
        {!isViewer && (
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 rounded-xl text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
          >
            <Plus className="w-4 h-4" />
            Create Outbound Order
          </button>
        )}
      </div>

      {/* ── Operational Banner: Needs Waybill Alert ── */}
      {needsWaybillCount > 0 && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {needsWaybillCount} Outbound Order{needsWaybillCount > 1 ? 's' : ''} Awaiting Waybill Verification
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Proof of delivery / customer waybill verification is required for direct sales before records are permanently stamped.
              </p>
            </div>
          </div>
          {activeTab !== 'NEEDS_WAYBILL' && (
            <button
              onClick={() => {
                setActiveTab('NEEDS_WAYBILL');
                setCurrentPage(1);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors shadow-xs shrink-0 cursor-pointer"
            >
              Filter Needs Waybill ({needsWaybillCount}) →
            </button>
          )}
        </div>
      )}

      {/* ── Table Container ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
        {/* Filter and Search Bar */}
        <div className="p-4 sm:px-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <button
              onClick={() => { setActiveTab('ALL'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({transactions.length})
            </button>

            <button
              onClick={() => { setActiveTab('NEEDS_WAYBILL'); setCurrentPage(1); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'NEEDS_WAYBILL'
                  ? 'bg-amber-600 text-white shadow-xs font-semibold'
                  : 'bg-amber-50 text-amber-800 border border-amber-200/60 hover:bg-amber-100'
              }`}
            >
              Needs Waybill
              {needsWaybillCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'NEEDS_WAYBILL' ? 'bg-white text-amber-800' : 'bg-amber-600 text-white'
                }`}>
                  {needsWaybillCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('TB'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'TB'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Branch Transfers
            </button>

            <button
              onClick={() => { setActiveTab('SALES'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'SALES'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Direct Sales
            </button>

            <button
              onClick={() => { setActiveTab('VERIFIED'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'VERIFIED'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Verified / Delivered
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search tracking, SKU, dest, rep..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {error && <div className="p-5 text-center text-red-500 bg-red-50/50">Failed to load: {error}</div>}
        {loading && <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>}

        {!loading && !error && transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-slate-50 rounded-2xl mb-3"><FileX className="w-8 h-8 text-slate-300" /></div>
            <p className="text-sm text-slate-500">No outbound transactions yet</p>
            {!isViewer && (
              <button onClick={() => setShowNewModal(true)} className="mt-4 text-sm text-indigo-600 font-medium hover:underline">
                Create your first outbound order →
              </button>
            )}
          </div>
        )}

        {!loading && !error && transactions.length > 0 && filteredTransactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-slate-50 rounded-2xl mb-3"><FileX className="w-8 h-8 text-slate-300" /></div>
            <p className="text-sm font-semibold text-slate-700">No outbound orders match your filter</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing your search query or switching tabs.</p>
            <button
              onClick={() => { setActiveTab('ALL'); setSearchQuery(''); setCurrentPage(1); }}
              className="mt-3 text-xs text-indigo-600 font-medium hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}

        {!loading && !error && filteredTransactions.length > 0 && (
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
                          {txn.customer_name && txn.customer_name !== txn.to_name && (
                            <span className="text-[11px] font-semibold text-violet-600 mt-0.5 flex items-center gap-1">
                              <User className="w-3 h-3" /> {txn.customer_name}
                            </span>
                          )}
                          {txn.sales_manager && (
                            <span className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <span className="text-slate-400">Rep:</span> {txn.sales_manager}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {txn.verified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-full px-2.5 py-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {txn.route === 'TB' ? 'Stock Delivered' : 'Verified'}
                          </span>
                        ) : txn.route === 'TB' ? (
                          isViewer ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200/50 rounded-full px-2.5 py-1">
                              <Truck className="w-3.5 h-3.5" />In Transit
                            </span>
                          ) : (
                            <button
                              onClick={() => setDeliveryTarget(txn)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200/80 rounded-full px-2.5 py-1 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 transition-all cursor-pointer group/tb shadow-2xs"
                              title="Click to mark this branch transfer as Stock Delivered"
                            >
                              <Truck className="w-3.5 h-3.5 text-blue-600 group-hover/tb:text-emerald-600" />
                              <span>In Transit</span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded transition-colors flex items-center gap-0.5 group-hover/tb:bg-emerald-200/80">
                                Deliver
                              </span>
                            </button>
                          )
                        ) : needsVerify ? (
                          isViewer ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200/50 rounded-full px-2.5 py-1">
                              <AlertCircle className="w-3.5 h-3.5" />Pending Verification
                            </span>
                          ) : (
                            <button
                              onClick={() => setVerifyTarget({ id: txn.id, tracking: txn.tracking_number })}
                              className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200/50 rounded-full px-2.5 py-1 hover:bg-amber-100 transition-colors cursor-pointer"
                            >
                              <AlertCircle className="w-3.5 h-3.5" />Verify Now
                            </button>
                          )
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
                        <div className="flex items-center justify-end gap-2.5">
                          {txn.route === 'TB' && !txn.verified && !isViewer && (
                            <button
                              onClick={() => setDeliveryTarget(txn)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg px-2.5 py-1 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                              title="Mark stock as delivered to destination branch"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Stock Delivered
                            </button>
                          )}
                          {needsVerify && !isViewer && (
                            <button
                              onClick={() => setVerifyTarget({ id: txn.id, tracking: txn.tracking_number })}
                              className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                            >
                              Verify <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!txn.verified && !isViewer && (
                            <button
                              onClick={() => setTxnToDelete(txn)}
                              disabled={isDeleteLoading}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-600 hover:text-red-800 hover:bg-red-100/70 border border-red-100 rounded-lg transition-colors cursor-pointer"
                              title="Cancel/Delete outbound dispatch"
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
                  {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredTransactions.length)}
                </strong>{' '}
                to{' '}
                <strong className="text-slate-800">
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)}
                </strong>{' '}
                of <strong className="text-slate-800">{filteredTransactions.length}</strong> orders
                {filteredTransactions.length !== transactions.length && (
                  <span className="text-slate-400 font-normal ml-1">
                    (filtered from {transactions.length})
                  </span>
                )}
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
