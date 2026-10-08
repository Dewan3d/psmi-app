'use client';

// ============================================================
// PSMI System — Inbound Serial Confirmation Modal
// ============================================================
// Responsive confirmation modal displayed before any serial numbers
// are inbounded into inventory. Lists all serials to be uploaded with
// search/filtering, metadata context, and verified confirmation.
// ============================================================

import React, { useState, useMemo } from 'react';
import {
  Upload,
  Search,
  Hash,
  X,
  Loader2,
  Package,
  MapPin,
  Check,
  Copy,
} from 'lucide-react';
import { ModalWrapper } from './modal-wrapper';

export interface InboundSerialConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  serials: string[];
  sku?: string;
  modelName?: string;
  locationName?: string;
  isLoading?: boolean;
  title?: string;
  confirmButtonText?: string;
}

export default function InboundSerialConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  serials,
  sku,
  modelName,
  locationName,
  isLoading = false,
  title = 'Confirm Inbound Serials',
  confirmButtonText = 'Yes, Upload Serials',
}: InboundSerialConfirmModalProps) {
  const [search, setSearch] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Normalize and clean serial list
  const cleanSerials = useMemo(() => {
    return serials.map((s) => s.trim()).filter(Boolean);
  }, [serials]);

  const filteredSerials = useMemo(() => {
    if (!search.trim()) return cleanSerials;
    const q = search.trim().toLowerCase();
    return cleanSerials.filter((s) => s.toLowerCase().includes(q));
  }, [cleanSerials, search]);

  const handleCopy = (serial: string, idx: number) => {
    navigator.clipboard?.writeText(serial);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg" zIndex="z-[120]">
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-white">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 flex-shrink-0 mt-0.5">
              <Upload className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">
                {title}
              </h2>
              <p className="text-sm font-medium text-slate-600 mt-1">
                Are you sure you want to upload the following serials?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Metadata badges strip */}
        <div className="px-5 py-3 sm:px-6 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-100/70 text-indigo-800 font-semibold">
            <Hash className="w-3.5 h-3.5 text-indigo-600" />
            {cleanSerials.length.toLocaleString()} {cleanSerials.length === 1 ? 'Serial' : 'Serials'}
          </span>

          {(modelName || sku) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200/80 text-slate-700 font-medium">
              <Package className="w-3.5 h-3.5 text-slate-500" />
              <span>{modelName || sku}</span>
              {sku && modelName && sku !== modelName && (
                <span className="text-slate-400 font-mono text-[11px]">({sku})</span>
              )}
            </span>
          )}

          {locationName && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200/80 text-slate-700 font-medium">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>{locationName}</span>
            </span>
          )}
        </div>

        {/* Content body with search and serials list */}
        <div className="p-5 sm:p-6 space-y-3 overflow-hidden flex flex-col flex-1 bg-white">
          {cleanSerials.length > 5 && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search among ${cleanSerials.length} serials…`}
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Serials List */}
          <div className="border border-slate-200/80 rounded-xl overflow-hidden flex flex-col flex-1 bg-slate-50/50">
            <div className="px-3.5 py-2 bg-slate-100/70 border-b border-slate-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <span>Serial Numbers List</span>
              <span>
                {filteredSerials.length} of {cleanSerials.length}
              </span>
            </div>

            <div className="max-h-60 sm:max-h-72 overflow-y-auto divide-y divide-slate-100 p-1">
              {filteredSerials.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No matching serial numbers found
                </div>
              ) : (
                filteredSerials.map((sn, idx) => (
                  <div
                    key={`${sn}-${idx}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-white rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[11px] font-mono font-medium text-slate-400 select-none w-6 text-right">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-xs sm:text-sm font-mono font-semibold text-slate-800 tracking-wide truncate">
                        {sn}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(sn, idx)}
                      title="Copy serial"
                      className="p-1 text-slate-300 hover:text-slate-600 group-hover:text-slate-400 hover:bg-slate-100 rounded transition-colors"
                    >
                      {copiedIndex === idx ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="py-2.5 px-4 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || cleanSerials.length === 0}
            className="flex items-center justify-center gap-2 py-2.5 px-5 text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-60"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmButtonText}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
