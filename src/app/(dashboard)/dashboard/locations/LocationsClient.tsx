'use client';

// ============================================================
// PSMI System — Active Locations Endless Cards Client
// ============================================================

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  Search,
  Warehouse,
  Store,
  ChevronDown,
  Boxes,
  Package,
} from 'lucide-react';
import { LocationStock } from '@/lib/types/database';

const INITIAL_VISIBLE = 20;
const LOAD_MORE_COUNT = 20;

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

type LocationFilter = 'ALL' | 'WAREHOUSE' | 'BRANCH';

const statusColors: Record<string, { bg: string; text: string }> = {
  IN_WAREHOUSE: { bg: 'bg-emerald-500', text: 'text-emerald-700' },
  IN_BRANCH: { bg: 'bg-violet-500', text: 'text-violet-700' },
  PENDING_SERIAL: { bg: 'bg-orange-400', text: 'text-orange-700' },
  RESERVED: { bg: 'bg-amber-400', text: 'text-amber-700' },
  IN_TRANSIT: { bg: 'bg-blue-400', text: 'text-blue-700' },
  DAMAGED_REPAIR: { bg: 'bg-red-400', text: 'text-red-700' },
};

export default function LocationsClient({
  locations,
}: {
  locations: LocationStock[];
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<LocationFilter>('ALL');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const filteredLocations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return locations
      .filter((loc) => {
        if (activeFilter !== 'ALL' && loc.location_type !== activeFilter) return false;
        if (!query) return true;
        return loc.location_name.toLowerCase().includes(query);
      })
      .sort((a, b) => b.total_units - a.total_units);
  }, [locations, searchQuery, activeFilter]);

  const visibleLocations = filteredLocations.slice(0, visibleCount);
  const hasMore = visibleCount < filteredLocations.length;

  const filterCounts = useMemo(() => {
    const counts = { ALL: locations.length, WAREHOUSE: 0, BRANCH: 0 };
    for (const loc of locations) {
      if (loc.location_type === 'WAREHOUSE') counts.WAREHOUSE++;
      else if (loc.location_type === 'BRANCH') counts.BRANCH++;
    }
    return counts;
  }, [locations]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Back + Header ──────────────────────────────────────── */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors group mb-3"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Dashboard
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <MapPin className="w-6 h-6 text-violet-600" />
              Active Locations
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              All warehouses and branches with their current inventory levels.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-violet-50 rounded-xl">
              <Package className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 leading-tight">
                {locations.length}
              </p>
              <p className="text-xs text-slate-400">locations</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search + Type Filters ──────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by location name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleCount(INITIAL_VISIBLE);
            }}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'ALL' as const, label: 'All Locations', icon: MapPin, activeClass: 'bg-violet-600 text-white' },
            { key: 'WAREHOUSE' as const, label: 'Warehouses', icon: Warehouse, activeClass: 'bg-indigo-600 text-white' },
            { key: 'BRANCH' as const, label: 'Branches', icon: Store, activeClass: 'bg-violet-600 text-white' },
          ].map((tab) => {
            const isActive = activeFilter === tab.key;
            const count = filterCounts[tab.key] || 0;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveFilter(tab.key);
                  setVisibleCount(INITIAL_VISIBLE);
                }}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? `${tab.activeClass} shadow-sm`
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {tab.label}
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Cards Grid ─────────────────────────────────────────── */}
      {visibleLocations.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] py-20 flex flex-col items-center justify-center text-center">
          <div className="p-4 bg-slate-50 rounded-2xl mb-4">
            <MapPin className="w-10 h-10 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-500">No locations found</p>
          <p className="text-xs text-slate-400 mt-1">
            Try adjusting your search or filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {visibleLocations.map((loc, index) => {
            const isWarehouse = loc.location_type === 'WAREHOUSE';
            const LocationIcon = isWarehouse ? Warehouse : Store;
            const gradientClass = isWarehouse
              ? 'from-indigo-500/20 via-indigo-400/10 to-slate-50'
              : 'from-violet-500/20 via-violet-400/10 to-slate-50';
            const badgeClass = isWarehouse
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-violet-100 text-violet-700';

            // Build status bars
            const breakdown = loc.status_breakdown;
            const activeStatuses = Object.entries(breakdown)
              .filter(([status, count]) => count > 0 && status !== 'SOLD')
              .sort((a, b) => b[1] - a[1]);

            return (
              <div
                key={loc.location_id}
                className="group bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.08)] hover:shadow-[0_8px_30px_-5px_rgba(6,81,237,0.15)] transition-all duration-300 overflow-hidden hover:-translate-y-1"
                style={{ animationDelay: `${Math.min(index * 40, 600)}ms` }}
              >
                {/* Icon Section */}
                <div className={`relative aspect-[5/3] bg-gradient-to-br ${gradientClass} flex items-center justify-center p-6 overflow-hidden`}>
                  <div className="w-20 h-20 rounded-2xl bg-white/60 backdrop-blur-sm flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500">
                    <LocationIcon className={`w-10 h-10 ${isWarehouse ? 'text-indigo-500/80' : 'text-violet-500/80'}`} />
                  </div>

                  {/* Type Badge */}
                  <span className={`absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full ${badgeClass} backdrop-blur-sm`}>
                    <LocationIcon className="w-3 h-3" />
                    {loc.location_type}
                  </span>
                </div>

                {/* Content Section */}
                <div className="p-4">
                  <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
                    {loc.location_name}
                  </h3>

                  {/* Total Units */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <span className="text-xs font-medium text-slate-500">Total Units</span>
                    <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {formatNumber(loc.total_units)}
                    </span>
                  </div>

                  {/* Status Breakdown Bar */}
                  {loc.total_units > 0 && (
                    <div className="mt-3">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                        {activeStatuses.map(([status, count]) => {
                          const pct = (count / loc.total_units) * 100;
                          const color = statusColors[status]?.bg || 'bg-slate-400';
                          return (
                            <div
                              key={status}
                              className={`h-full ${color} transition-all duration-700`}
                              style={{ width: `${pct}%` }}
                              title={`${status.replace(/_/g, ' ')}: ${count}`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        {activeStatuses.slice(0, 3).map(([status, count]) => {
                          const color = statusColors[status]?.bg || 'bg-slate-400';
                          return (
                            <div key={status} className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${color}`} />
                              <span className="text-[10px] text-slate-500 font-medium">
                                {status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} ({count})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Load More ──────────────────────────────────────────── */}
      {hasMore && (
        <div className="flex justify-center pt-2 pb-4">
          <button
            onClick={() => setVisibleCount((prev) => prev + LOAD_MORE_COUNT)}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors cursor-pointer border border-violet-100"
          >
            <ChevronDown className="w-4 h-4" />
            Load More ({filteredLocations.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {/* ── Results Count Footer ───────────────────────────────── */}
      <div className="text-center pb-4">
        <p className="text-xs text-slate-400">
          Showing {visibleLocations.length} of {filteredLocations.length} location{filteredLocations.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
