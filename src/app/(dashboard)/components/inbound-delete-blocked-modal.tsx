'use client';

// ============================================================
// PSMI System — Inbound Deletion Blocked Modal
// ============================================================
// Displays an authoritative, high-fidelity security & audit
// notification preventing users from deleting inbound receipts
// that already have serial numbers uploaded or are linked to
// active warehouse stock, branch transfers, or customer sales.
// ============================================================

import React from 'react';
import { ShieldAlert, Lock, AlertTriangle, ArrowRight, X, Layers, SendHorizontal } from 'lucide-react';
import { ModalWrapper } from './modal-wrapper';

export interface InboundDeleteBlockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackingNumber?: string | null;
  sku?: string | null;
  modelName?: string | null;
  totalItems?: number;
  reason?: 'SERIALS_UPLOADED' | 'OUTBOUND_DISPATCHED' | 'ACTIVE_STOCK' | 'GENERAL';
  customMessage?: string | null;
}

export function InboundDeleteBlockedModal({
  isOpen,
  onClose,
  trackingNumber,
  sku,
  modelName,
  totalItems,
  reason = 'GENERAL',
  customMessage,
}: InboundDeleteBlockedModalProps) {
  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg" zIndex="z-[80]">
      <div className="relative p-6 sm:p-7 overflow-hidden">
        {/* Subtle decorative background pattern */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-rose-50/80 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-amber-50/60 rounded-full blur-2xl pointer-events-none" />

        {/* Header with close button */}
        <div className="flex items-start justify-between gap-4 relative">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-xs">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-slate-900 text-white rounded-full p-1 shadow-xs border-2 border-white">
                <Lock className="w-2.5 h-2.5" />
              </div>
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-rose-100/70 text-rose-800 border border-rose-200/60">
                Action Prohibited
              </span>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight mt-1">
                Inbound Receipt Protected
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inbound Details Card */}
        <div className="mt-5 p-3.5 bg-slate-50/80 rounded-xl border border-slate-100/80">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Tracking Ref:</span>
              <span className="font-mono font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                {trackingNumber || 'N/A'}
              </span>
            </div>
            {totalItems !== undefined && (
              <span className="font-semibold text-slate-700 bg-slate-200/60 px-2 py-0.5 rounded-full text-[11px]">
                {totalItems.toLocaleString()} Unit{totalItems === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {(modelName || sku) && (
            <p className="text-xs text-slate-600 mt-2 font-medium">
              Product: <span className="text-slate-900 font-semibold">{modelName || sku}</span>
              {sku && modelName && <span className="text-slate-400 font-mono ml-1.5">({sku})</span>}
            </p>
          )}
        </div>

        {/* Explanation Points */}
        <div className="mt-5 space-y-3">
          <div className="flex items-start gap-3 p-3 bg-amber-50/50 border border-amber-200/50 rounded-xl text-amber-900">
            <Layers className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <p className="font-semibold text-amber-950">Serial Numbers Uploaded to Stock</p>
              <p className="text-amber-800/90 mt-0.5">
                Physical serial numbers have already been registered in warehouse inventory. Deleting this receipt would orphan active units and corrupt stock ledgers.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-rose-50/50 border border-rose-200/50 rounded-xl text-rose-900">
            <SendHorizontal className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <p className="font-semibold text-rose-950">Outbound Dispatches & Sales Protection</p>
              <p className="text-rose-800/90 mt-0.5">
                Units from this inbound batch cannot be deleted if any units have been transferred to branch locations or outbounded for customer sales.
              </p>
            </div>
          </div>

          {customMessage && (
            <div className="p-3 bg-slate-100/70 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-mono">
              {customMessage}
            </div>
          )}
        </div>

        {/* Operational Guidance */}
        <div className="mt-5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            Need stock adjustments? Use <strong>Outbound Transfers</strong> or <strong>Stock Write-Offs</strong> to maintain complete audit compliance.
          </span>
        </div>

        {/* Action Button */}
        <div className="mt-6 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <span>Understood, Keep Protected</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

export default InboundDeleteBlockedModal;
