'use client';

// ============================================================
// PSMI System — Searchable Combobox Autocomplete Select
// ============================================================
// Replaces raw native HTML <select> dropdowns with a clean,
// searchable input dropdown. Filters options as user types keywords
// and displays clear model/SKU/badge details.
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
  extra?: string;
  extraColor?: string;
}

interface ComboboxSelectProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export default function ComboboxSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option…',
  searchPlaceholder = 'Type to search…',
  emptyText = 'No matching options found',
  label,
  className = '',
  disabled = false,
}: ComboboxSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find currently selected option
  const selectedOption = options.find((opt) => opt.value === value);

  const [openUpwards, setOpenUpwards] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check available space below button and auto-focus search
  useEffect(() => {
    if (isOpen) {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        // If less than 280px below, flip open upwards
        setOpenUpwards(spaceBelow < 280 && rect.top > 280);
      }
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [isOpen]);

  // Filter options based on search query
  const filteredOptions = options.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      opt.label.toLowerCase().includes(q) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
      (opt.badge && opt.badge.toLowerCase().includes(q)) ||
      (opt.extra && opt.extra.toLowerCase().includes(q))
    );
  });

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label}
        </label>
      )}

      {/* Input / Trigger Field */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm border rounded-xl text-left bg-white transition-all cursor-pointer ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
            : 'border-slate-200 hover:border-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
          {selectedOption ? (
            <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
              <span className="font-semibold text-slate-800 truncate">
                {selectedOption.label}
              </span>
              {selectedOption.sublabel && (
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 truncate">
                  {selectedOption.sublabel}
                </span>
              )}
              {selectedOption.badge && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border flex-shrink-0 ${
                    selectedOption.badgeColor || 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {selectedOption.badge}
                </span>
              )}
              {selectedOption.extra && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${
                    selectedOption.extraColor || 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {selectedOption.extra}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 text-slate-400">
          {selectedOption && !disabled && (
            <span
              onClick={handleClear}
              className="p-1 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Floating Dropdown Popover */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-[80] bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden animate-fade-in ${
            openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {/* Live Search Input inside Popover */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-7 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Filtered Options List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/80 text-indigo-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {opt.label}
                      </span>
                      {opt.sublabel && (
                        <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 truncate">
                          {opt.sublabel}
                        </span>
                      )}
                      {opt.badge && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border flex-shrink-0 ${
                            opt.badgeColor || 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      {opt.extra && (
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            opt.extraColor || 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {opt.extra}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                {emptyText}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
