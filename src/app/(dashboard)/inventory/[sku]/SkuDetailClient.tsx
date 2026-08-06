'use client';

// ============================================================
// PSMI System — SKU Detail Interactive Client Component
// ============================================================

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Barcode,
  Boxes,
  Package,
  Truck,
  ShoppingCart,
  AlertTriangle,
  MapPin,
  Edit,
  ScanLine,
  Copy,
  Clock,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { Product, UnitStatus } from '@/lib/types/database';
import { updateProduct } from '@/actions/products';

type UnitItem = {
  serial_number: string;
  sku: string;
  status: UnitStatus;
  location_id: string;
  upload_date: string;
  locations?: { name: string; type: string };
};

const ITEMS_PER_PAGE = 20;

// ── SVG Barcode Generator ─────────────────────────────────────
function SvgBarcode({ value, label }: { value: string; label?: string }) {
  const bars: { x: number; w: number }[] = [];
  let x = 0;

  // Start guard
  bars.push({ x, w: 2 }); x += 3;
  bars.push({ x, w: 2 }); x += 3;
  bars.push({ x, w: 2 }); x += 4;

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const w1 = (code % 3) + 1;
    const g1 = ((code >> 2) % 2) + 1;
    const w2 = ((code >> 4) % 3) + 1;
    const g2 = ((code >> 1) % 2) + 1;

    bars.push({ x, w: w1 });
    x += w1 + g1;
    bars.push({ x, w: w2 });
    x += w2 + g2;
  }

  // End guard
  bars.push({ x, w: 2 }); x += 3;
  bars.push({ x, w: 2 }); x += 3;
  bars.push({ x, w: 2 }); x += 2;

  const totalWidth = x;
  const height = 60;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full max-w-[220px] h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {bars.map((bar, i) => (
          <rect
            key={i}
            x={bar.x}
            y={0}
            width={bar.w}
            height={height}
            fill="#1e293b"
            rx={0.3}
          />
        ))}
      </svg>
      <div className="text-center">
        <p className="text-xs font-mono text-slate-800 font-semibold tracking-wider">
          {label || value}
        </p>
      </div>
    </div>
  );
}

// ── Status Config ─────────────────────────────────────────────
const statusConfig: Record<
  UnitStatus,
  { label: string; bgClass: string; textClass: string; icon: React.ElementType }
> = {
  IN_WAREHOUSE: {
    label: 'In Warehouse',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-700',
    icon: Boxes,
  },
  RESERVED: {
    label: 'Reserved',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    icon: Package,
  },
  IN_TRANSIT: {
    label: 'In Transit',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    icon: Truck,
  },
  IN_BRANCH: {
    label: 'In Branch',
    bgClass: 'bg-violet-100',
    textClass: 'text-violet-700',
    icon: MapPin,
  },
  SOLD: {
    label: 'Sold',
    bgClass: 'bg-teal-100',
    textClass: 'text-teal-700',
    icon: ShoppingCart,
  },
  DAMAGED_REPAIR: {
    label: 'Damaged / Repair',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    icon: AlertTriangle,
  },
  PENDING_SERIAL: {
    label: 'Pending Serial',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-700',
    icon: Clock,
  },
};

export default function SkuDetailClient({
  initialProduct,
  initialUnits,
}: {
  initialProduct: Product;
  initialUnits: UnitItem[];
}) {
  const router = useRouter();
  const [product, setProduct] = useState<Product>(initialProduct);
  const [units] = useState<UnitItem[]>(initialUnits);

  // Edit Modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [modelName, setModelName] = useState(product.model_name);
  const [description, setDescription] = useState(product.description || '');
  const [lowStockThreshold, setLowStockThreshold] = useState(String(product.low_stock_threshold));
  const [barcode, setBarcode] = useState(product.barcode || '');
  const [imageUrl, setImageUrl] = useState(product.image_url || '');
  const [editError, setEditError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Copy indicator state
  const [copiedSn, setCopiedSn] = useState<string | null>(null);

  // Serial Numbers Table Filter & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Image load error fallback state
  const [imageLoadError, setImageLoadError] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSn(text);
    setTimeout(() => setCopiedSn(null), 2000);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    startTransition(async () => {
      const res = await updateProduct(product.sku, {
        model_name: modelName,
        description,
        low_stock_threshold: parseInt(lowStockThreshold, 10) || 10,
        barcode,
        image_url: imageUrl,
      });

      if (res.error) {
        setEditError(res.error);
      } else if (res.data) {
        setProduct(res.data);
        setImageLoadError(false);
        setIsEditOpen(false);
        router.refresh();
      }
    });
  };

  // Filter units
  const filteredUnits = units.filter((u) => {
    const matchesSearch = u.serial_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredUnits.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedUnits = filteredUnits.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Status breakdown
  const statusBreakdown: Record<UnitStatus, number> = {
    IN_WAREHOUSE: 0,
    RESERVED: 0,
    IN_TRANSIT: 0,
    IN_BRANCH: 0,
    SOLD: 0,
    DAMAGED_REPAIR: 0,
    PENDING_SERIAL: 0,
  };
  for (const u of units) {
    statusBreakdown[u.status as UnitStatus]++;
  }

  const totalStock = units.length;
  const barcodeValue = product.barcode || product.sku;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Back Navigation ──────────────────────────────────── */}
      <div>
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Inventory
        </Link>
      </div>

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {product.model_name}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 font-mono">
              <Barcode className="w-3.5 h-3.5" />
              {product.sku}
            </span>
            <span className="text-sm text-slate-400">
              {totalStock} unit{totalStock !== 1 ? 's' : ''} total
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setIsEditOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
          >
            <Edit className="w-4 h-4 text-indigo-600" />
            Edit Product
          </button>
          <Link
            href={`/outbound?sku=${encodeURIComponent(product.sku)}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 rounded-xl text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
          >
            <ScanLine className="w-4 h-4" />
            Scan Outbound
          </Link>
        </div>
      </div>

      {/* ── Main Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Product Specifications & Status Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Specs */}
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">
                Product Specifications
              </h2>
              <button
                onClick={() => setIsEditOpen(true)}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Edit details
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              <div className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                <span className="text-sm text-slate-500 font-medium">SKU</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800 font-mono">
                    {product.sku}
                  </span>
                  <button
                    onClick={() => handleCopy(product.sku)}
                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Copy SKU"
                  >
                    {copiedSn === product.sku ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {product.barcode && (
                <div className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                  <span className="text-sm text-slate-500 font-medium">Custom Barcode</span>
                  <span className="text-sm font-semibold text-slate-800 font-mono">
                    {product.barcode}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                <span className="text-sm text-slate-500 font-medium">Model Name</span>
                <span className="text-sm font-semibold text-slate-800">
                  {product.model_name}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                <span className="text-sm text-slate-500 font-medium">Description</span>
                <span className="text-sm text-slate-700 max-w-xs text-right">
                  {product.description || '—'}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                <span className="text-sm text-slate-500 font-medium">Total in Stock</span>
                <span className="text-sm font-bold text-slate-900">{totalStock}</span>
              </div>

              <div className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                <span className="text-sm text-slate-500 font-medium">Low Stock Threshold</span>
                <span
                  className={`text-sm font-semibold ${
                    totalStock < product.low_stock_threshold
                      ? 'text-amber-600'
                      : 'text-slate-800'
                  }`}
                >
                  {product.low_stock_threshold}
                </span>
              </div>
            </div>
          </div>

          {/* Status Breakdown Grid */}
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5">
            <h2 className="text-base font-semibold text-slate-800 mb-4">
              Status Breakdown
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(Object.entries(statusBreakdown) as [UnitStatus, number][])
                .filter(([status]) => status !== 'SOLD')
                .map(([status, count]) => {
                  const cfg = statusConfig[status];
                  const IconComponent = cfg.icon;
                  return (
                    <div
                      key={status}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 hover:bg-slate-50 transition-colors"
                    >
                      <div className={`p-2 rounded-lg ${cfg.bgClass}`}>
                        <IconComponent className={`w-4 h-4 ${cfg.textClass}`} />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-900">{count}</p>
                        <p className="text-xs text-slate-500">{cfg.label}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right Column: Product Barcode & Device Image */}
        <div className="space-y-6">
          {/* Barcode Card */}
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4 text-center">
              Product Barcode
            </h2>
            <SvgBarcode value={barcodeValue} label={`SKU: ${product.sku}`} />
          </div>

          {/* Product Visual Card */}
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
            <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6 relative">
              {product.image_url && !imageLoadError ? (
                <img
                  src={product.image_url}
                  alt={product.model_name}
                  onError={() => setImageLoadError(true)}
                  className="w-full h-full object-contain max-h-[220px]"
                />
              ) : (
                /* Fallback SVG Illustration */
                <div className="relative w-full max-w-[180px]">
                  <svg viewBox="0 0 200 200" className="w-full h-auto">
                    <rect x="30" y="50" width="140" height="100" rx="12" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
                    <rect x="70" y="35" width="60" height="20" rx="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
                    <rect x="50" y="70" width="25" height="60" rx="4" fill="#6366f1" opacity="0.9" />
                    <rect x="85" y="80" width="25" height="50" rx="4" fill="#6366f1" opacity="0.65" />
                    <rect x="120" y="90" width="25" height="40" rx="4" fill="#6366f1" opacity="0.4" />
                    <circle cx="100" cy="170" r="8" fill="#22c55e" opacity="0.8" />
                  </svg>
                </div>
              )}
            </div>
            <div className="p-4 text-center border-t border-slate-100">
              <p className="text-sm font-medium text-slate-700">{product.model_name}</p>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">SKU: {product.sku}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Serial Numbers Inventory Table (Paginated at 20/page) ──────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              Serial Numbers Inventory ({filteredUnits.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Every individual physical unit tracked for this SKU
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search serial number..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-3 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Statuses ({units.length})</option>
                <option value="IN_WAREHOUSE">In Warehouse ({statusBreakdown.IN_WAREHOUSE})</option>
                <option value="RESERVED">Reserved ({statusBreakdown.RESERVED})</option>
                <option value="IN_TRANSIT">In Transit ({statusBreakdown.IN_TRANSIT})</option>
                <option value="IN_BRANCH">In Branch ({statusBreakdown.IN_BRANCH})</option>
                <option value="SOLD">Sold ({statusBreakdown.SOLD})</option>
                <option value="DAMAGED_REPAIR">Damaged ({statusBreakdown.DAMAGED_REPAIR})</option>
                <option value="PENDING_SERIAL">Pending Serial ({statusBreakdown.PENDING_SERIAL})</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Serial Number</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Receive Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedUnits.length > 0 ? (
                paginatedUnits.map((unit, index) => {
                  const cfg = statusConfig[unit.status as UnitStatus] || statusConfig.IN_WAREHOUSE;
                  const globalIndex = startIndex + index + 1;
                  return (
                    <tr key={unit.serial_number} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono">{globalIndex}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 font-mono font-medium text-slate-900">
                          {unit.serial_number}
                          <button
                            onClick={() => handleCopy(unit.serial_number)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                            title="Copy Serial Number"
                          >
                            {copiedSn === unit.serial_number ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bgClass} ${cfg.textClass}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {unit.locations?.name || 'Main Warehouse'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {new Date(unit.upload_date).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No serial numbers found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredUnits.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-800">{startIndex + 1}</span> to{' '}
              <span className="font-semibold text-slate-800">
                {Math.min(startIndex + ITEMS_PER_PAGE, filteredUnits.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-800">{filteredUnits.length}</span> serials
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-indigo-600 text-white font-bold shadow-sm'
                      : 'text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Product Modal ────────────────────────────────────────── */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Edit Product — {product.sku}</h2>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 text-xs bg-red-50 text-red-600 rounded-xl border border-red-100">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Model Name *
                </label>
                <input
                  type="text"
                  required
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Custom Barcode
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. EAN / UPC code"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Image URL
                </label>
                <div className="relative">
                  <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    placeholder="https://example.com/device-photo.png"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-xs"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Provide a direct web image URL to display photo of the device.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
