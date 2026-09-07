'use client';

// ============================================================
// PSMI System — Global Search Bar Component
// ============================================================
// Instant search across products, serial numbers, inbound/outbound
// receipts, and sales orders. Features debounced querying,
// categorized results, keyboard navigation (Ctrl+K), and quick links.
// ============================================================

import { useState, useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Loader2,
  X,
  Boxes,
  Tag,
  Truck,
  ArrowRight,
  TrendingUp,
  PackageCheck,
  Building2,
  Clock,
} from 'lucide-react';
import { performGlobalSearch, GlobalSearchResponse, GlobalSearchResultItem } from '@/actions/search';

export default function GlobalSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResponse | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Flattened items list for keyboard navigation
  const allItems: GlobalSearchResultItem[] = results
    ? [...results.products, ...results.serials, ...results.orders]
    : [];

  // Global hotkey: Ctrl+K or Cmd+K focuses search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setSelectedIndex(-1);
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await performGlobalSearch(trimmed);
        setResults(res);
        setIsOpen(true);
        setSelectedIndex(-1);
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  function handleSelect(item: GlobalSearchResultItem) {
    setIsOpen(false);
    setQuery('');
    router.push(item.href);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < allItems.length) {
        handleSelect(allItems[selectedIndex]);
      }
    }
  }

  let itemCounter = -1;

  return (
    <div ref={containerRef} className="relative w-full sm:w-80 md:w-96 lg:w-[28rem]">
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen && e.target.value.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            if (query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleInputKeyDown}
          placeholder="Search inventory, orders..."
          className="w-full pl-10 pr-20 py-2 text-sm bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400 transition-all shadow-sm"
        />

        <div className="absolute right-2.5 flex items-center gap-1">
          {isPending ? (
            <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
          ) : query ? (
            <button
              onClick={() => {
                setQuery('');
                setResults(null);
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 bg-slate-200/60 border border-slate-300/60 rounded">
              Ctrl+K
            </kbd>
          )}
        </div>
      </div>

      {/* Floating Results Dropdown */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden z-50 animate-fade-in divide-y divide-slate-100 max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="px-4 py-2.5 bg-slate-50/80 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>
              {isPending
                ? 'Searching…'
                : results
                ? `${results.totalCount} result${results.totalCount === 1 ? '' : 's'} for "${query}"`
                : 'Searching…'}
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:inline">Use ↑↓ to navigate, Enter to select</span>
          </div>

          <div className="overflow-y-auto flex-1 p-2 space-y-3">
            {/* Empty State */}
            {!isPending && results && results.totalCount === 0 && (
              <div className="py-8 text-center px-4">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No results found</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  We couldn’t find any SKUs, serial numbers, or orders matching <span className="font-semibold text-slate-600 font-mono">"{query}"</span>.
                </p>
              </div>
            )}

            {/* Products / SKUs */}
            {results && results.products.length > 0 && (
              <div>
                <div className="px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                  <Boxes className="w-3 h-3 text-indigo-500" /> Products & SKUs
                </div>
                <div className="space-y-1 mt-1">
                  {results.products.map((p) => {
                    itemCounter++;
                    const isSelected = selectedIndex === itemCounter;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelect(p)}
                        className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors group cursor-pointer ${
                          isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-xs font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                            {p.title}
                          </p>
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5">{p.subtitle}</p>
                        </div>
                        {p.badge && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${p.badgeColor}`}>
                            {p.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Serial Numbers */}
            {results && results.serials.length > 0 && (
              <div>
                <div className="px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                  <Tag className="w-3 h-3 text-emerald-500" /> Serial Numbers
                </div>
                <div className="space-y-1 mt-1">
                  {results.serials.map((s) => {
                    itemCounter++;
                    const isSelected = selectedIndex === itemCounter;
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleSelect(s)}
                        className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors group cursor-pointer ${
                          isSelected ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-xs font-mono font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                            {s.title}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{s.subtitle}</p>
                        </div>
                        {s.badge && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${s.badgeColor}`}>
                            {s.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Orders & Shipments */}
            {results && results.orders.length > 0 && (
              <div>
                <div className="px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                  <Truck className="w-3 h-3 text-sky-500" /> Shipments & Orders
                </div>
                <div className="space-y-1 mt-1">
                  {results.orders.map((o) => {
                    itemCounter++;
                    const isSelected = selectedIndex === itemCounter;
                    return (
                      <button
                        key={o.id}
                        onClick={() => handleSelect(o)}
                        className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors group cursor-pointer ${
                          isSelected ? 'bg-sky-50 border border-sky-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-xs font-mono font-bold text-slate-900 group-hover:text-sky-700 transition-colors truncate">
                            {o.title}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{o.subtitle}</p>
                        </div>
                        {o.badge && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${o.badgeColor}`}>
                            {o.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer Quick Tips */}
          {results && results.totalCount > 0 && (
            <div className="px-4 py-2 bg-slate-50/60 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Click any item to view its details</span>
              <span className="flex items-center gap-1 text-indigo-600 font-medium hover:underline">
                Esc to close
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
