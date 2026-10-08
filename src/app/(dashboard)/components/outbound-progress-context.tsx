'use client';

// ============================================================
// PSMI System — Outbound Background Progress Context & Widget
// ============================================================
// Manages non-blocking background batch dispatching for large
// outbound transfers (e.g. 1,000+ units to branches) preventing
// Vercel serverless timeouts and providing live progress updates.
// ============================================================

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Truck, CheckCircle2, AlertTriangle, Loader2, X, ArrowUpRight } from 'lucide-react';
import {
  reserveUnits,
  initiateOutboundTransaction,
  processOutboundBatchChunk,
  finalizeOutboundTransaction,
} from '@/actions/outbound';
import type { OutboundRoute } from '@/lib/types/database';

export interface OutboundJob {
  id: string;
  transactionId?: string;
  route: string;
  fromLocationName: string;
  toLocationName: string;
  totalUnits: number;
  processedUnits: number;
  status: 'processing' | 'completed' | 'error';
  error?: string;
  startedAt: number;
}

export interface StartOutboundParams {
  route: OutboundRoute;
  fromLocationId: string;
  toLocationId?: string;
  fromLocationName: string;
  toLocationName: string;
  serials: string[];
  userId: string;
  notes?: string;
  customerName?: string;
  salesManager?: string;
  soldAt?: string;
  isDonation?: boolean;
  donationProgram?: string;
  itemPrices?: { serial_number: string; sale_price: number }[];
  onComplete?: (transactionId: string) => void;
}

interface OutboundProgressContextType {
  startOutboundJob: (params: StartOutboundParams) => Promise<{ success: boolean; error?: string }>;
  getActiveProgress: (transactionIdOrJobId: string) => OutboundJob | undefined;
  activeJobs: OutboundJob[];
  toastMessage: string | null;
  dismissToast: () => void;
}

const OutboundProgressContext = createContext<OutboundProgressContextType | undefined>(undefined);

export function useOutboundProgress() {
  const context = useContext(OutboundProgressContext);
  if (!context) {
    throw new Error('useOutboundProgress must be used within an OutboundProgressProvider');
  }
  return context;
}

const CHUNK_SIZE = 200;

export function OutboundProgressProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<OutboundJob[]>([]);
  const [activeModalJobId, setActiveModalJobId] = useState<string | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(null);
  }, []);

  const updateJob = useCallback((id: string, updater: (prev: OutboundJob) => OutboundJob) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === id ? updater(job) : job))
    );
  }, []);

  const startOutboundJob = useCallback(
    async (params: StartOutboundParams): Promise<{ success: boolean; error?: string }> => {
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const totalUnits = params.serials.length;

      const newJob: OutboundJob = {
        id: jobId,
        route: params.route,
        fromLocationName: params.fromLocationName,
        toLocationName: params.toLocationName,
        totalUnits,
        processedUnits: 0,
        status: 'processing',
        startedAt: Date.now(),
      };

      setJobs((prev) => [...prev, newJob]);

      // Enforce user rule: The bottom-left modal ONLY displays the FIRST initiated outbound!
      setActiveModalJobId((current) => current || jobId);
      setIsDismissing(false);

      // Show immediate confirmation toast: "Your outbound is in progress"
      showToast('Your outbound is in progress');

      // Kick off background execution asynchronously (non-blocking)
      (async () => {
        try {
          // 1. Fast transaction initiation (< 150ms)
          const initRes = await initiateOutboundTransaction({
            route: params.route,
            from_location_id: params.fromLocationId,
            to_location_id: params.toLocationId,
            total_units: totalUnits,
            user_id: params.userId,
            notes: params.notes,
            customer_name: params.customerName,
            sales_manager: params.salesManager,
            sold_at: params.soldAt,
            is_donation: params.isDonation,
            donation_program: params.donationProgram,
          });

          if (initRes.error || !initRes.data) {
            updateJob(jobId, (j) => ({
              ...j,
              status: 'error',
              error: initRes.error || 'Failed to initiate outbound order',
            }));
            return;
          }

          const transactionId = initRes.data.id;
          updateJob(jobId, (j) => ({ ...j, transactionId }));

          // 2. Process chunks of 200 units to guarantee fast, reliable serverless calls
          const serials = params.serials;
          let processedCount = 0;

          for (let i = 0; i < serials.length; i += CHUNK_SIZE) {
            const chunkSerials = serials.slice(i, i + CHUNK_SIZE);

            // Reserve this chunk
            const reserveRes = await reserveUnits({
              serial_numbers: chunkSerials,
              user_id: params.userId,
            });

            if (reserveRes.errors && reserveRes.errors.length > 0) {
              console.warn('Chunk reservation warnings:', reserveRes.errors);
            }

            // Insert transaction items and set status to IN_TRANSIT
            const chunkPrices = params.itemPrices
              ? params.itemPrices.filter((p) => chunkSerials.includes(p.serial_number))
              : undefined;

            const batchRes = await processOutboundBatchChunk({
              transaction_id: transactionId,
              serial_numbers: chunkSerials,
              item_prices: chunkPrices,
            });

            if (batchRes.error) {
              console.error('Batch chunk error:', batchRes.error);
            }

            processedCount += chunkSerials.length;
            updateJob(jobId, (j) => ({
              ...j,
              processedUnits: Math.min(processedCount, totalUnits),
            }));
          }

          // 3. Finalize transaction totals, verification triggers, and notifications
          await finalizeOutboundTransaction({
            transaction_id: transactionId,
            route: params.route,
            from_location_id: params.fromLocationId,
            to_location_id: params.toLocationId,
            user_id: params.userId,
            items_count: totalUnits,
            notes: params.notes,
          });

          // 4. Mark status as completed
          updateJob(jobId, (j) => ({
            ...j,
            processedUnits: totalUnits,
            status: 'completed',
          }));

          if (params.onComplete) {
            params.onComplete(transactionId);
          }

          // 5. Completion animation behavior:
          // Stay on "Outbound complete" for 1.8 seconds, then animate/ease out downwards
          setTimeout(() => {
            setIsDismissing(true);
            // After CSS transition ends (700ms), clear active modal job
            setTimeout(() => {
              setActiveModalJobId(null);
              setIsDismissing(false);
              // Clean up completed job from list
              setJobs((prev) => prev.filter((j) => j.id !== jobId));
            }, 750);
          }, 1800);
        } catch (err: any) {
          console.error('Outbound background processing error:', err);
          updateJob(jobId, (j) => ({
            ...j,
            status: 'error',
            error: err?.message || 'Unexpected error processing outbound',
          }));
        }
      })();

      return { success: true };
    },
    [showToast, updateJob]
  );

  const getActiveProgress = useCallback(
    (transactionIdOrJobId: string): OutboundJob | undefined => {
      return jobs.find(
        (j) => j.id === transactionIdOrJobId || j.transactionId === transactionIdOrJobId
      );
    },
    [jobs]
  );

  // Retrieve the first initiated job to display in the modal
  const activeModalJob = jobs.find((j) => j.id === activeModalJobId) || null;

  return (
    <OutboundProgressContext.Provider
      value={{
        startOutboundJob,
        getActiveProgress,
        activeJobs: jobs,
        toastMessage,
        dismissToast,
      }}
    >
      {children}

      {/* ── Top-Center Toast: "Your outbound is in progress" ── */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[110] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-900/95 text-white backdrop-blur-md rounded-xl shadow-xl border border-slate-700/80 text-xs sm:text-sm font-medium">
            <span className="flex h-2 w-2 rounded-full bg-sky-400 animate-ping" />
            <span>{toastMessage}</span>
            <button
              onClick={dismissToast}
              className="ml-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Floating Bottom-Left Progress Widget ──────────────── */}
      {activeModalJob && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-6 z-[100] w-[320px] sm:w-[360px] bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/70 p-4 transition-all duration-700 ease-out select-none ${
            isDismissing
              ? 'translate-y-16 opacity-0 pointer-events-none'
              : 'translate-y-0 opacity-100'
          }`}
        >
          {/* Top Row: Icon + Title + Status Badge */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {activeModalJob.status === 'completed' ? (
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              ) : activeModalJob.status === 'error' ? (
                <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}

              <div className="min-w-0">
                <h4 className="text-sm font-semibold tracking-tight truncate">
                  {activeModalJob.status === 'completed' ? (
                    <span className="text-emerald-400 font-bold">Outbound complete</span>
                  ) : activeModalJob.status === 'error' ? (
                    <span className="text-rose-400 font-bold">Transfer Error</span>
                  ) : (
                    <span className="text-slate-100">Outbound in progress</span>
                  )}
                </h4>
                <p className="text-[11px] text-slate-400 truncate">
                  {activeModalJob.fromLocationName} → {activeModalJob.toLocationName}
                </p>
              </div>
            </div>

            {/* Percentage pill */}
            <div className="flex-shrink-0">
              {(() => {
                const percent =
                  activeModalJob.totalUnits > 0
                    ? Math.round((activeModalJob.processedUnits / activeModalJob.totalUnits) * 100)
                    : 0;
                return (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${
                      activeModalJob.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : activeModalJob.status === 'error'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        : 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                    }`}
                  >
                    {percent}%
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Unit Count + Progress Bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5 font-medium">
              <span>Units Dispatched</span>
              <span className="font-mono text-slate-200">
                {activeModalJob.processedUnits.toLocaleString()} /{' '}
                {activeModalJob.totalUnits.toLocaleString()}
              </span>
            </div>

            {/* Progress Bar Container */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/50">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${
                  activeModalJob.status === 'completed'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : activeModalJob.status === 'error'
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                    : 'bg-gradient-to-r from-sky-500 via-indigo-500 to-cyan-400'
                }`}
                style={{
                  width: `${
                    activeModalJob.totalUnits > 0
                      ? Math.round(
                          (activeModalJob.processedUnits / activeModalJob.totalUnits) * 100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Error Message if any */}
          {activeModalJob.error && (
            <div className="mt-2 text-[11px] text-rose-300 bg-rose-950/60 border border-rose-800/40 rounded-lg p-2 leading-snug">
              {activeModalJob.error}
            </div>
          )}
        </div>
      )}
    </OutboundProgressContext.Provider>
  );
}
