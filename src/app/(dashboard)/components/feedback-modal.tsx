'use client';

// ============================================================
// PSMI System — Global Feedback / Alert Modal
// ============================================================
// Displays user-friendly success and error confirmations
// without falling back to raw browser alert() popups.
// ============================================================

import { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: 'success' | 'error' | 'info';
  title: string;
  message: ReactNode;
  buttonText?: string;
}

export default function FeedbackModal({
  isOpen,
  onClose,
  type = 'info',
  title,
  message,
  buttonText,
}: FeedbackModalProps) {
  if (!isOpen) return null;

  const isSuccess = type === 'success';
  const isError = type === 'error';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden transform transition-all">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-2xl flex-shrink-0 ${
                isSuccess
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/80'
                  : isError
                  ? 'bg-rose-50 text-rose-600 border border-rose-100/80'
                  : 'bg-indigo-50 text-indigo-600 border border-indigo-100/80'
              }`}
            >
              {isSuccess ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : isError ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                {title}
              </h3>
              <div className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                {message}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-6 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`w-full py-2.5 px-4 text-xs sm:text-sm font-semibold text-white rounded-xl shadow-sm transition-all cursor-pointer ${
                isSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                  : isError
                  ? 'bg-slate-900 hover:bg-slate-800'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {buttonText || (isSuccess ? 'Great, Continue' : isError ? 'Dismiss' : 'Got it')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
