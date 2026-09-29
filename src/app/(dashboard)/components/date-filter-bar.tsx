// ============================================================
// PSMI System — Shared Date Filter Components & Utilities
// ============================================================
// Provides weekly (Sunday start), today, 3 days, month, and
// custom single-date / date-range filtering with an Apple-style
// popover picker.
// ============================================================

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check, X, Clock, CalendarDays } from 'lucide-react';

export type TemporalScope =
  | 'this_week'
  | 'today'
  | '3d'
  | 'this_month'
  | 'custom_date'
  | 'all';

export interface TemporalDateRange {
  from?: string; // ISO string
  to?: string;   // ISO string
  label: string;
  scope: TemporalScope;
}

/**
 * Calculates start and end timestamps according to the requested scope.
 * Week starts strictly on Sunday (Day 0) to align with Sales analytics.
 */
export function getTemporalDateRange(
  scope: TemporalScope,
  customFrom?: string,
  customTo?: string
): TemporalDateRange {
  const now = new Date();

  switch (scope) {
    case 'this_week': {
      // Week starts Sunday (0)
      const currentDay = now.getDay();
      const sunday = new Date(now);
      sunday.setDate(now.getDate() - currentDay);
      sunday.setHours(0, 0, 0, 0);

      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      saturday.setHours(23, 59, 59, 999);

      const sunLabel = sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const satLabel = saturday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

      return {
        from: sunday.toISOString(),
        to: saturday.toISOString(),
        label: `This Week (${sunLabel} – ${satLabel})`,
        scope,
      };
    }

    case 'today': {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      return {
        from: startOfDay.toISOString(),
        to: endOfDay.toISOString(),
        label: 'Today',
        scope,
      };
    }

    case '3d': {
      // Past 3 days: 2 days ago 00:00:00 to today 23:59:59
      const start = new Date(now);
      start.setDate(now.getDate() - 2);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);

      const fLabel = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

      return {
        from: start.toISOString(),
        to: end.toISOString(),
        label: `3 Days (from ${fLabel})`,
        scope,
      };
    }

    case 'this_month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthName = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      return {
        from: startOfMonth.toISOString(),
        to: endOfMonth.toISOString(),
        label: `This Month (${monthName})`,
        scope,
      };
    }

    case 'custom_date': {
      if (customFrom) {
        const start = new Date(customFrom);
        start.setHours(0, 0, 0, 0);
        
        const end = customTo ? new Date(customTo) : new Date(customFrom);
        end.setHours(23, 59, 59, 999);

        const fLabel = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const tLabel = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

        return {
          from: start.toISOString(),
          to: end.toISOString(),
          label: customFrom === customTo || !customTo ? fLabel : `${fLabel} – ${tLabel}`,
          scope,
        };
      }

      return {
        label: 'Custom Date',
        scope,
      };
    }

    case 'all':
    default:
      return {
        label: 'All Time',
        scope: 'all',
      };
  }
}

/**
 * Checks whether an ISO date string falls inside a TemporalDateRange
 */
export function matchesTemporalRange(dateStr: string | null | undefined, range: TemporalDateRange): boolean {
  if (!dateStr || range.scope === 'all') return true;
  const time = new Date(dateStr).getTime();
  if (isNaN(time)) return true;

  if (range.from && time < new Date(range.from).getTime()) return false;
  if (range.to && time > new Date(range.to).getTime()) return false;

  return true;
}

interface DateFilterBarProps {
  currentScope: TemporalScope;
  customFrom?: string;
  customTo?: string;
  onScopeChange: (scope: TemporalScope, customFrom?: string, customTo?: string) => void;
  className?: string;
}

export function DateFilterBar({
  currentScope,
  customFrom,
  customTo,
  onScopeChange,
  className = '',
}: DateFilterBarProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dateMode, setDateMode] = useState<'single' | 'range'>(
    customFrom && customTo && customFrom !== customTo ? 'range' : 'single'
  );
  const [singleDate, setSingleDate] = useState(customFrom || new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState(customFrom || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(customTo || new Date().toISOString().slice(0, 10));
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }
    if (popoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popoverOpen]);

  const activeRange = getTemporalDateRange(currentScope, customFrom, customTo);

  const presets: { id: TemporalScope; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'today', label: 'Today' },
    { id: '3d', label: '3 Days' },
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
  ];

  function applyCustom() {
    if (dateMode === 'single') {
      if (!singleDate) return;
      onScopeChange('custom_date', singleDate, singleDate);
    } else {
      if (!startDate) return;
      onScopeChange('custom_date', startDate, endDate || startDate);
    }
    setPopoverOpen(false);
  }

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      {/* Preset pills */}
      <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
        {presets.map((preset) => {
          const isActive = currentScope === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onScopeChange(preset.id)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Custom Date / Range Popover Trigger */}
      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setPopoverOpen(!popoverOpen)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
            currentScope === 'custom_date'
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>
            {currentScope === 'custom_date' ? activeRange.label : 'Select Date'}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        {popoverOpen && (
          <div className="absolute right-0 sm:left-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-4 z-40 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
                Custom Date Filter
              </span>
              <button
                type="button"
                onClick={() => setPopoverOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mode selection: Single Date vs Date Range */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl my-3 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setDateMode('single')}
                className={`py-1.5 rounded-lg transition-all ${
                  dateMode === 'single'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'hover:text-slate-900'
                }`}
              >
                Specific Date
              </button>
              <button
                type="button"
                onClick={() => setDateMode('range')}
                className={`py-1.5 rounded-lg transition-all ${
                  dateMode === 'range'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'hover:text-slate-900'
                }`}
              >
                Date Range
              </button>
            </div>

            {/* Inputs based on mode */}
            {dateMode === 'single' ? (
              <div className="space-y-1.5 mb-4">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Select Calendar Date
                </label>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                />
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  onScopeChange('all');
                  setPopoverOpen(false);
                }}
                className="flex-1 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={applyCustom}
                className="flex-1 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs"
              >
                Apply Filter
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Clear filter indicator if custom */}
      {currentScope !== 'all' && (
        <button
          type="button"
          onClick={() => onScopeChange('all')}
          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          title="Reset date filter to All Time"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
