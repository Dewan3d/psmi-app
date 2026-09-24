'use client';

// ============================================================
// PSMI System — Outbound Detail Modal
// ============================================================
// High-craft inspection modal for outbound transactions.
// Features route & dispatch metadata, personnel attribution,
// grouped item manifests with serial inspection, verification
// document previews, and contextual actions (e.g. Mark Delivered).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Truck,
  ArrowUpRight,
  Clock,
  User,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle2,
  Package,
  Layers,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Download,
  Trash2,
  Calendar,
  Building,
} from 'lucide-react';
import { ModalWrapper } from '@/app/(dashboard)/components/modal-wrapper';
import { getOutboundDetail, OutboundDetailData } from '@/actions/outbound';

interface OutboundDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string | null;
  summaryFallback?: {
    tracking_number: string | null;
    route: string;
    verified: boolean;
    from_name: string;
    to_name: string;
    created_at: string;
    item_count: number;
    model_name?: string;
    sku?: string;
  } | null;
  onMarkDelivered?: (txnId: string) => void;
  onVerify?: (txnId: string, tracking: string) => void;
  onCancelDispatch?: (txnId: string) => void;
  isViewer?: boolean;
}

export function OutboundDetailModal({
  isOpen,
  onClose,
  transactionId,
  summaryFallback,
  onMarkDelivered,
  onVerify,
  onCancelDispatch,
  isViewer = false,
}: OutboundDetailModalProps) {
  const [detail, setDetail] = useState<OutboundDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSkus, setExpandedSkus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen || !transactionId) {
      setDetail(null);
      setError(null);
      setSearchTerm('');
      setExpandedSkus({});
      return;
    }

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const res = await getOutboundDetail(transactionId!);
        if (!isMounted) return;
        if (res.error) {
          setError(res.error);
        } else {
          setDetail(res.data);
          // By default expand all SKU groups if fewer than 4 SKUs
          if (res.data?.items) {
            const initialExpanded: Record<string, boolean> = {};
            const uniqueSkus = Array.from(new Set(res.data.items.map((i) => i.sku)));
            uniqueSkus.forEach((sku) => {
              initialExpanded[sku] = true;
            });
            setExpandedSkus(initialExpanded);
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load details');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, transactionId]);

  const handleCopyTracking = (tracking: string) => {
    navigator.clipboard.writeText(tracking);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 1800);
  };

  const toggleSku = (sku: string) => {
    setExpandedSkus((prev) => ({
      ...prev,
      [sku]: !prev[sku],
    }));
  };

  // Group items by SKU
  const groupedItems = useMemo(() => {
    if (!detail?.items) return [];

    const map = new Map<
      string,
      {
        sku: string;
        model_name: string;
        category_badge: string;
        items: typeof detail.items;
      }
    >();

    for (const item of detail.items) {
      if (!map.has(item.sku)) {
        map.set(item.sku, {
          sku: item.sku,
          model_name: item.model_name,
          category_badge: item.category_badge,
          items: [],
        });
      }
      map.get(item.sku)!.items.push(item);
    }

    let list = Array.from(map.values());

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list
        .map((group) => {
          const matchGroup =
            group.sku.toLowerCase().includes(q) ||
            group.model_name.toLowerCase().includes(q);
          const matchedItems = group.items.filter((item) =>
            item.serial_number.toLowerCase().includes(q)
          );
          if (matchGroup) return group;
          if (matchedItems.length > 0) return { ...group, items: matchedItems };
          return null;
        })
        .filter(Boolean) as typeof list;
    }

    return list;
  }, [detail?.items, searchTerm]);

  const totalItemCount = detail?.items?.length ?? summaryFallback?.item_count ?? 0;
  const isTB = (detail?.route || summaryFallback?.route) === 'TB';
  const isVerified = detail?.verified ?? summaryFallback?.verified ?? false;
  const trackingNumber =
    detail?.tracking_number || summaryFallback?.tracking_number || '—';
  const route = detail?.route || summaryFallback?.route || 'UNKNOWN';

  const routeStyles: Record<string, { label: string; bg: string; text: string; border: string }> = {
    TB: { label: 'Transfer Branch', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    B2B: { label: 'B2B Commercial', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    B2C: { label: 'B2C Direct Retail', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    SCRAP: { label: 'Scrap & Decommission', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    INTERNAL_USE: { label: 'Internal Office Use', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  };

  const currentRouteStyle = routeStyles[route] || {
    label: route,
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl" zIndex="z-[80]">
      <div className="flex flex-col max-h-[88vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/80">
        {/* ── Modal Header ───────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-600 rounded-xl">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Outbound Dispatch Manifest
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${currentRouteStyle.bg} ${currentRouteStyle.text} ${currentRouteStyle.border}`}
                >
                  {currentRouteStyle.label}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs font-medium text-slate-500">
                  {trackingNumber}
                </span>
                {trackingNumber !== '—' && (
                  <button
                    onClick={() => handleCopyTracking(trackingNumber)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-200/60 transition-colors"
                    title="Copy tracking number"
                  >
                    {copiedTracking ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Pill */}
            {isVerified ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isTB ? 'Stock Delivered' : 'Verified'}
              </span>
            ) : isTB ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Truck className="w-3.5 h-3.5" />
                In Transit
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5" />
                Pending Verification
              </span>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Dispatch Journey & Parties Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Origin & Destination Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                Route & Destination
              </div>
              <div className="space-y-2.5">
                <div className="flex items-start justify-between text-sm">
                  <span className="text-slate-500 text-xs">Origin Location:</span>
                  <span className="font-semibold text-slate-800 text-right">
                    {detail?.from_location?.name || summaryFallback?.from_name || 'Main Warehouse'}
                  </span>
                </div>
                <div className="flex items-start justify-between text-sm">
                  <span className="text-slate-500 text-xs">Destination:</span>
                  <div className="text-right">
                    <span className="font-semibold text-slate-900 block">
                      {detail?.to_location?.name ||
                        detail?.customer_name ||
                        summaryFallback?.to_name ||
                        'Direct Customer'}
                    </span>
                    {detail?.customer_name &&
                      detail.to_location &&
                      detail.customer_name !== detail.to_location.name && (
                        <span className="text-xs text-violet-600 font-medium block">
                          Client: {detail.customer_name}
                        </span>
                      )}
                  </div>
                </div>
                {detail?.customer_phone && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Contact:</span>
                    <span className="font-mono text-slate-700">{detail.customer_phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Attribution & Timestamp Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                Attribution & Logistics
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 text-xs">Created By:</span>
                  <span className="font-medium text-slate-800">
                    {detail?.created_by_name || 'System Dispatcher'}
                    {detail?.created_by_role && (
                      <span className="text-[10px] ml-1.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        {detail.created_by_role}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 text-xs">Sales Rep / Mgr:</span>
                  <span className="font-medium text-slate-800">
                    {detail?.sales_manager || 'None Assigned'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 text-xs">Dispatch Date:</span>
                  <span className="text-slate-700 flex items-center gap-1 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(
                      detail?.created_at || summaryFallback?.created_at || Date.now()
                    ).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    •{' '}
                    {new Date(
                      detail?.created_at || summaryFallback?.created_at || Date.now()
                    ).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dispatch Notes (if any) */}
          {detail?.notes && (
            <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-3.5 text-xs text-amber-900">
              <span className="font-semibold text-amber-950 block mb-0.5">
                Dispatch / Logistics Notes:
              </span>
              <p className="leading-relaxed whitespace-pre-wrap">{detail.notes}</p>
            </div>
          )}

          {/* 2. Equipment Manifest Section */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Itemized Manifest</h3>
                  <p className="text-xs text-slate-500">
                    {totalItemCount} Total Unit{totalItemCount !== 1 ? 's' : ''} across{' '}
                    {groupedItems.length} Product SKU{groupedItems.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Search filter for items */}
              {totalItemCount > 5 && (
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search SKU or serial..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Loading Skeleton */}
            {loading && !detail && (
              <div className="p-6 space-y-3">
                <div className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                <div className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                <div className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            )}

            {/* Empty state */}
            {!loading && groupedItems.length === 0 && (
              <div className="p-8 text-center">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No items found matching criteria.</p>
              </div>
            )}

            {/* Grouped SKU List */}
            <div className="divide-y divide-slate-100">
              {groupedItems.map((group) => {
                const isExpanded = !!expandedSkus[group.sku];
                const nonSerializedCount = group.items.filter((i) =>
                  i.serial_number.startsWith('NS-')
                ).length;
                const serializedItems = group.items.filter(
                  (i) => !i.serial_number.startsWith('NS-')
                );

                return (
                  <div key={group.sku} className="transition-colors">
                    {/* Group Header */}
                    <div
                      onClick={() => toggleSku(group.sku)}
                      className="p-3.5 px-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        <span className="p-1.5 bg-slate-100 text-slate-600 rounded-md">
                          <Package className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {group.model_name}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {group.sku}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                              {group.category_badge}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 rounded-full px-2.5 py-0.5">
                          {group.items.length} units
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Serial Numbers Expansion */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 bg-slate-50/50 border-t border-slate-100 space-y-3">
                        {/* Non-serialized indicator if any */}
                        {nonSerializedCount > 0 && (
                          <div className="flex items-center justify-between p-2.5 bg-slate-100/70 rounded-lg text-xs">
                            <span className="text-slate-600">
                              Non-serialized bulk accessories:
                            </span>
                            <span className="font-semibold text-slate-800">
                              {nonSerializedCount} units dispatched
                            </span>
                          </div>
                        )}

                        {/* Serialized Chips */}
                        {serializedItems.length > 0 && (
                          <div>
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                              Individual Serial Numbers ({serializedItems.length}):
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {serializedItems.map((item) => (
                                <div
                                  key={item.serial_number}
                                  className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200/80 text-xs hover:border-slate-300"
                                >
                                  <span className="font-mono text-slate-800 font-medium">
                                    {item.serial_number}
                                  </span>
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                      item.status === 'SOLD'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : item.status === 'IN_BRANCH'
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'bg-amber-50 text-amber-700'
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Verification Documents Section */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Verification Documents & Waybills
                  </h3>
                  <p className="text-xs text-slate-500">
                    Proof of delivery, signed gate passes, and customer receipts
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {detail?.verification_documents?.length || 0} attached
              </span>
            </div>

            <div className="p-4">
              {!detail?.verification_documents || detail.verification_documents.length === 0 ? (
                <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center">
                  <FileText className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                  <p className="text-xs text-slate-500 font-medium">
                    No verification documents uploaded yet.
                  </p>
                  {!isVerified && !isViewer && onVerify && (
                    <button
                      onClick={() => {
                        onClose();
                        onVerify(transactionId!, trackingNumber);
                      }}
                      className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Upload Waybill or Receipt &rarr;
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {detail.verification_documents.map((doc) => {
                    const isImg =
                      doc.storage_url.match(/\.(jpeg|jpg|gif|png|webp)/i) != null;
                    return (
                      <a
                        key={doc.id}
                        href={doc.storage_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col p-3 rounded-xl border border-slate-200/80 hover:border-indigo-400 bg-white hover:bg-slate-50/50 transition-all shadow-2xs hover:shadow-xs"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-700 text-slate-600 rounded">
                            {doc.document_type.replace('_', ' ')}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                        </div>

                        {isImg ? (
                          <div className="h-24 w-full bg-slate-100 rounded-lg overflow-hidden mb-2 relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={doc.storage_url}
                              alt={doc.document_type}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          </div>
                        ) : (
                          <div className="h-24 w-full bg-slate-50 rounded-lg flex items-center justify-center mb-2 border border-slate-100">
                            <FileText className="w-8 h-8 text-slate-400" />
                          </div>
                        )}

                        <span className="text-[11px] text-slate-400 mt-auto">
                          Uploaded{' '}
                          {new Date(doc.uploaded_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Modal Footer with Contextual Actions ───────────── */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {!isVerified && !isViewer && onCancelDispatch && (
              <button
                onClick={() => {
                  onClose();
                  onCancelDispatch(transactionId!);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl border border-red-200 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Cancel Dispatch
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Close
            </button>

            {/* If TB transfer and in transit: Allow quick Stock Delivered action */}
            {isTB && !isVerified && !isViewer && onMarkDelivered && (
              <button
                onClick={() => {
                  onClose();
                  onMarkDelivered(transactionId!);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark Stock Delivered
              </button>
            )}

            {/* If direct sales and needs verification: Allow quick Verify action */}
            {!isTB && !isVerified && !isViewer && onVerify && (
              <button
                onClick={() => {
                  onClose();
                  onVerify(transactionId!, trackingNumber);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <AlertCircle className="w-4 h-4" />
                Verify Now
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
}
