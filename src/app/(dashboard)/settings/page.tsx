'use client';

// ============================================================
// PSMI System — Settings & Administration Control Panel
// ============================================================
// Card-Based Navigation Architecture with Breadcrumb UX
// Supports editing SKU descriptions, Location Names, Types & Addresses.
// ============================================================

import { useState, useEffect, useTransition } from 'react';
import {
  Settings,
  MapPin,
  Barcode,
  User,
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Mail,
  Users,
  Building2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { createProduct, updateProduct, deleteProduct, listProducts } from '@/actions/products';
import { createLocation, updateLocation, listLocations } from '@/actions/locations';
import { listUsers, updateUserRole, assignUserLocation, inviteUser } from '@/actions/users';
import { getSession } from '@/actions/auth';
import { listInboundTransactions, deleteInboundTransaction } from '@/actions/inbound';
import { UserRole } from '@/lib/types/database';

type Product = {
  sku: string;
  model_name: string;
  description: string | null;
  low_stock_threshold: number;
  is_serialized: boolean;
  created_at: string;
};

type Location = {
  id: string;
  name: string;
  type: string;
  address: string | null;
  created_at: string;
};

type UserProfile = {
  id: string;
  full_name: string;
  role: string;
  location_id: string | null;
  created_at: string;
  location_name?: string;
};

const ITEMS_PER_PAGE = 10;

// ── SKU Management Section ────────────────────────────────────
function SkuSection({ isAdmin }: { isAdmin: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [sku, setSku] = useState('');
  const [modelName, setModelName] = useState('');
  const [description, setDescription] = useState('');
  const [threshold, setThreshold] = useState('10');
  const [isSerialized, setIsSerialized] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [editModelName, setEditModelName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editThreshold, setEditThreshold] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  async function loadProducts() {
    const result = await listProducts();
    setProducts((result.data || []) as any);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = products.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createProduct({
        sku,
        model_name: modelName,
        description: description || undefined,
        low_stock_threshold: parseInt(threshold, 10) || 10,
        is_serialized: isSerialized,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSku('');
      setModelName('');
      setDescription('');
      setThreshold('10');
      setIsSerialized(true);
      setShowForm(false);
      await loadProducts();
    });
  }

  function handleEdit(p: Product) {
    setEditingSku(p.sku);
    setEditModelName(p.model_name);
    setEditDescription(p.description || '');
    setEditThreshold(String(p.low_stock_threshold));
  }

  function handleSaveEdit(skuToEdit: string) {
    startTransition(async () => {
      await updateProduct(skuToEdit, {
        model_name: editModelName,
        description: editDescription,
        low_stock_threshold: parseInt(editThreshold, 10) || 10,
      });
      setEditingSku(null);
      await loadProducts();
    });
  }

  function handleDelete(skuToDelete: string) {
    startTransition(async () => {
      const result = await deleteProduct(skuToDelete);
      if (result.error) {
        setError(result.error);
        setDeleteConfirm(null);
        return;
      }
      setDeleteConfirm(null);
      await loadProducts();
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden border border-slate-100">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              Product SKU Catalogue
            </h2>
            <p className="text-xs text-slate-400">
              {products.length} product SKU(s) catalogued
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> New SKU
          </button>
        )}
      </div>

      {/* New SKU form */}
      {showForm && (
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 animate-fade-in">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  SKU Code *
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  required
                  placeholder="e.g. EP600"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Model Name *
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  required
                  placeholder="e.g. Bluetti EP600"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Low Stock Alert
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
                <div className="flex items-center justify-center pt-5">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-600 select-none">
                    <input
                      type="checkbox"
                      checked={isSerialized}
                      onChange={(e) => setIsSerialized(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500/30 w-4 h-4 border-slate-250"
                    />
                    Track Serials
                  </label>
                </div>
              </div>
            </div>
            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                }}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60"
              >
                {isPending ? 'Saving…' : 'Create SKU'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {products.length === 0 && (
          <div className="p-12 text-center text-sm text-slate-400">
            No SKUs registered yet.
          </div>
        )}
        {paginatedProducts.map((p) => (
          <div
            key={p.sku}
            className="px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
          >
            {editingSku === p.sku ? (
              <div className="space-y-2.5">
                {/* Header row in edit mode showing SKU Code clearly */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">
                      SKU Code:
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-800 font-mono">
                      <Barcode className="w-3.5 h-3.5 text-indigo-600" />
                      {p.sku}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSaveEdit(p.sku)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <Check className="w-4 h-4" /> Save
                    </button>
                    <button
                      onClick={() => setEditingSku(null)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" /> Cancel
                    </button>
                  </div>
                </div>

                {/* Edit Form Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                      Model Name
                    </label>
                    <input
                      value={editModelName}
                      onChange={(e) => setEditModelName(e.target.value)}
                      placeholder="Model Name"
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                      Description
                    </label>
                    <input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Optional description..."
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                      Low Stock Alert
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editThreshold}
                      onChange={(e) => setEditThreshold(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {p.model_name}
                    </p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-md bg-slate-100 text-slate-700 font-mono">
                      {p.sku}
                    </span>
                    {p.is_serialized === false && (
                      <span className="text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded-md">
                        Non-Serialized
                      </span>
                    )}
                  </div>
                  {p.description ? (
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      {p.description}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic mt-0.5">
                      No description provided
                    </p>
                  )}
                </div>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-lg px-2.5 py-1">
                  Alert at {p.low_stock_threshold}
                </span>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(p)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit SKU & Description"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {deleteConfirm === p.sku ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-red-600 font-medium">
                          Confirm?
                        </span>
                        <button
                          onClick={() => handleDelete(p.sku)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(p.sku)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete SKU"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── 10-Item Pagination Controls ───────────────────────── */}
      {products.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <span className="text-xs text-slate-500 font-medium">
            Showing{' '}
            <strong className="text-slate-800">
              {Math.min(
                (currentPage - 1) * ITEMS_PER_PAGE + 1,
                products.length
              )}
            </strong>{' '}
            to{' '}
            <strong className="text-slate-800">
              {Math.min(currentPage * ITEMS_PER_PAGE, products.length)}
            </strong>{' '}
            of <strong className="text-slate-800">{products.length}</strong> SKUs
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>

            <span className="px-3 py-1 text-xs font-semibold text-slate-700">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors flex items-center gap-1 cursor-pointer"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {error && !showForm && (
        <div className="px-5 pb-4 text-xs text-red-600">{error}</div>
      )}
    </div>
  );
}

// ── Location Management Section (WITH EDITABLE BRANCH NAME & DETAILS) ───────────
function LocationSection({ isAdmin }: { isAdmin: boolean }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'WAREHOUSE' | 'BRANCH'>('BRANCH');
  const [address, setAddress] = useState('');

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'WAREHOUSE' | 'BRANCH'>('BRANCH');
  const [editAddress, setEditAddress] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function loadLocations() {
    const result = await listLocations();
    setLocations(result.data || []);
  }

  useEffect(() => {
    loadLocations();
  }, []);

  const totalPages = Math.ceil(locations.length / ITEMS_PER_PAGE) || 1;
  const paginatedLocations = locations.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createLocation({
        name,
        type,
        address: address || undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setName('');
      setType('BRANCH');
      setAddress('');
      setShowForm(false);
      await loadLocations();
    });
  }

  function handleEdit(loc: Location) {
    setEditingId(loc.id);
    setEditName(loc.name);
    setEditType(loc.type as 'WAREHOUSE' | 'BRANCH');
    setEditAddress(loc.address || '');
  }

  function handleSaveEdit(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateLocation(id, {
        name: editName,
        type: editType,
        address: editAddress,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setEditingId(null);
        await loadLocations();
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden border border-slate-100">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              Operational Locations
            </h2>
            <p className="text-xs text-slate-400">
              {locations.length} location(s) configured
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> New Location
          </button>
        )}
      </div>

      {/* New Location Form */}
      {showForm && (
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 animate-fade-in">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Location Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Ikeja Central Branch"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Location Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  <option value="BRANCH">Branch</option>
                  <option value="WAREHOUSE">Warehouse</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Address / City Details (optional)
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Allen Avenue, Ikeja - Lagos State"
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                }}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60"
              >
                {isPending ? 'Saving…' : 'Create Location'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Locations List with Edit Mode */}
      <div className="divide-y divide-slate-100">
        {locations.length === 0 && (
          <div className="p-12 text-center text-sm text-slate-400">
            No locations configured yet.
          </div>
        )}
        {paginatedLocations.map((loc) => (
          <div
            key={loc.id}
            className="px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
          >
            {editingId === loc.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                      Location Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Location Name"
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                      Location Type
                    </label>
                    <select
                      value={editType}
                      onChange={(e) =>
                        setEditType(e.target.value as 'WAREHOUSE' | 'BRANCH')
                      }
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    >
                      <option value="BRANCH">Branch</option>
                      <option value="WAREHOUSE">Warehouse</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                      Address Details
                    </label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="Address or State"
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveEdit(loc.id)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> Save Location
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {loc.name}
                    </p>
                    <span
                      className={`text-[10px] font-bold rounded-full px-2.5 py-0.5 ${
                        loc.type === 'WAREHOUSE'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {loc.type}
                    </span>
                  </div>
                  {loc.address ? (
                    <p className="text-xs text-slate-500 mt-0.5">{loc.address}</p>
                  ) : (
                    <p className="text-xs text-slate-400 italic mt-0.5">
                      No address details provided
                    </p>
                  )}
                </div>

                {isAdmin && (
                  <button
                    onClick={() => handleEdit(loc)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    title="Edit Location Name & Details"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── 10-Item Pagination Controls ───────────────────────── */}
      {locations.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <span className="text-xs text-slate-500 font-medium">
            Showing{' '}
            <strong className="text-slate-800">
              {Math.min(
                (currentPage - 1) * ITEMS_PER_PAGE + 1,
                locations.length
              )}
            </strong>{' '}
            to{' '}
            <strong className="text-slate-800">
              {Math.min(currentPage * ITEMS_PER_PAGE, locations.length)}
            </strong>{' '}
            of <strong className="text-slate-800">{locations.length}</strong> locations
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>

            <span className="px-3 py-1 text-xs font-semibold text-slate-700">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors flex items-center gap-1 cursor-pointer"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── User Management Section ───────────────────────────────────
function UserSection({
  isAdmin,
  locations,
}: {
  isAdmin: boolean;
  locations: Location[];
}) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('BRANCH_STAFF');
  const [inviteLocation, setInviteLocation] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadUsers() {
    const result = await listUsers();
    setUsers((result.data || []) as any);
  }

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE) || 1;
  const paginatedUsers = users.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await inviteUser({
        email: inviteEmail,
        full_name: inviteName,
        role: inviteRole,
        location_id: inviteLocation || undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('BRANCH_STAFF');
      setInviteLocation('');
      setShowInvite(false);
      await loadUsers();
    });
  }

  if (!isAdmin) return null;

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden border border-slate-100">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-50 text-violet-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              Staff Accounts & Access
            </h2>
            <p className="text-xs text-slate-400">
              {users.length} active staff account(s)
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm"
        >
          <Mail className="w-3.5 h-3.5" /> Invite User
        </button>
      </div>

      {showInvite && (
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 animate-fade-in">
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  required
                  placeholder="e.g. John Smith"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="staff@company.com"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  <option value="BRANCH_STAFF">Branch Staff</option>
                  <option value="WAREHOUSE_MANAGER">Warehouse Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Assign Location
                </label>
                <select
                  value={inviteLocation}
                  onChange={(e) => setInviteLocation(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  <option value="">No specific location</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            {success && (
              <p className="text-xs text-emerald-600 font-semibold">{success}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowInvite(false);
                  setError(null);
                }}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5" />
                )}
                {isPending ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {users.length === 0 && (
          <div className="p-12 text-center text-sm text-slate-400">
            No users registered.
          </div>
        )}
        {paginatedUsers.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                {u.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {u.full_name}
                </p>
                {u.location_name && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {u.location_name}
                  </p>
                )}
              </div>
            </div>
            <span
              className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${
                u.role === 'ADMIN'
                  ? 'bg-red-50 text-red-600 border border-red-100'
                  : u.role === 'WAREHOUSE_MANAGER'
                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                  : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              {u.role?.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>

      {/* ── 10-Item Pagination Controls ───────────────────────── */}
      {users.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <span className="text-xs text-slate-500 font-medium">
            Showing{' '}
            <strong className="text-slate-800">
              {Math.min(
                (currentPage - 1) * ITEMS_PER_PAGE + 1,
                users.length
              )}
            </strong>{' '}
            to{' '}
            <strong className="text-slate-800">
              {Math.min(currentPage * ITEMS_PER_PAGE, users.length)}
            </strong>{' '}
            of <strong className="text-slate-800">{users.length}</strong> staff
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>

            <span className="px-3 py-1 text-xs font-semibold text-slate-700">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors flex items-center gap-1 cursor-pointer"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin Accessory Deletion Section ──────────────────────────
function AccessoryDeletionSection() {
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  async function load() {
    setLoading(true);
    const prodRes = await listProducts();
    const txnRes = await listInboundTransactions();

    const prods = prodRes.data || [];
    setProducts(prods);

    const txns = (txnRes.data || []).filter((t: any) => {
      const prod = prods.find((p: any) => p.sku === t.sku);
      return prod ? prod.is_serialized === false : false;
    });
    setInbounds(txns);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    if (
      !confirm(
        'Are you sure you want to delete this accessory inbound receipt? This will remove all associated stock.'
      )
    )
      return;
    setIsDeleting(true);
    const res = await deleteInboundTransaction(id);
    setIsDeleting(false);
    if (res.error) {
      alert(res.error);
    } else {
      await load();
    }
  }

  if (loading || inbounds.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden border border-slate-100">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/10">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Admin Stock Adjustments (Accessories)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Delete non-serialized receipts to correct stock errors
          </p>
        </div>
      </div>
      <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
        {inbounds.map((txn) => (
          <div
            key={txn.id}
            className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50"
          >
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {txn.model_name}
              </p>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                Receipt: {txn.tracking_number} · SKU: {txn.sku}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-800">
                  Qty: {txn.total_items}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {new Date(txn.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              </div>
              <button
                onClick={() => handleDelete(txn.id)}
                disabled={isDeleting}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                title="Delete accessory receipt"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Settings Page Component with Card-Based Navigation & Breadcrumb UX ──
export default function SettingsPage() {
  const [session, setSession] = useState<any>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [usersCount, setUsersCount] = useState(0);
  const [activeSection, setActiveSection] = useState<
    'overview' | 'skus' | 'locations' | 'staff'
  >('overview');

  useEffect(() => {
    async function load() {
      const s = await getSession();
      setSession(s);
      const locRes = await listLocations();
      setLocations(locRes.data || []);

      const prodRes = await listProducts();
      setProductsCount((prodRes.data || []).length);

      const uRes = await listUsers();
      setUsersCount((uRes.data || []).length);
    }
    load();
  }, []);

  const profile = session?.profile || {
    full_name: 'Loading…',
    role: 'BRANCH_STAFF',
  };
  const isAdmin = profile.role === 'ADMIN';
  const isManager =
    profile.role === 'ADMIN' || profile.role === 'WAREHOUSE_MANAGER';

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Header & Breadcrumbs ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Settings &amp; Control Panel
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage system configurations, SKUs, locations, and staff access.
          </p>
        </div>

        {/* ── BREADCRUMB UX FEATURE ───────────────────────────────────────── */}
        {activeSection !== 'overview' && (
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm w-fit">
            <button
              onClick={() => setActiveSection('overview')}
              className="hover:text-indigo-600 transition-colors flex items-center gap-1.5 font-semibold text-slate-600 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-600" />
              Settings
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-slate-800 font-bold flex items-center gap-1.5">
              {activeSection === 'skus' && (
                <>
                  <Barcode className="w-3.5 h-3.5 text-indigo-600" /> Product SKU
                  Catalogue
                </>
              )}
              {activeSection === 'locations' && (
                <>
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Operational
                  Locations
                </>
              )}
              {activeSection === 'staff' && (
                <>
                  <Users className="w-3.5 h-3.5 text-violet-600" /> Staff
                  Accounts
                </>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Main Control Panel Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* ── CARD-BASED SETTINGS OVERVIEW HUB ───────────────────────────── */}
          {activeSection === 'overview' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 gap-4">
                {/* CARD 1: Product SKU Catalogue */}
                <div
                  onClick={() => setActiveSection('skus')}
                  className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-105 transition-transform">
                        <Barcode className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-800 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                          Product SKU Catalogue
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-md">
                          Manage product models, SKUs, descriptions, low stock
                          alert limits, and custom barcode tags.
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {productsCount} Registered SKUs
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* CARD 2: Operational Locations */}
                <div
                  onClick={() => setActiveSection('locations')}
                  className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-105 transition-transform">
                        <MapPin className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-800 group-hover:text-emerald-600 transition-colors flex items-center gap-2">
                          Operational Locations
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-md">
                          Configure central warehouses, distribution hubs, and
                          retail branch locations across Nigeria. Edit branch names
                          and addresses.
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                            {locations.length} Active Locations
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* CARD 3: Staff Accounts & Access */}
                {isAdmin && (
                  <div
                    onClick={() => setActiveSection('staff')}
                    className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 hover:border-violet-300 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl group-hover:scale-105 transition-transform">
                          <Users className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-800 group-hover:text-violet-600 transition-colors flex items-center gap-2">
                            Staff Accounts &amp; Access
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-md">
                            Invite team members, assign access roles (Admin,
                            Warehouse Manager, Branch Staff), and location
                            permissions.
                          </p>
                          <div className="mt-3 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                              {usersCount} Active Staff Members
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="p-2 text-slate-400 group-hover:text-violet-600 group-hover:translate-x-1 transition-all">
                        <ArrowRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DEDICATED MODULE VIEWS ────────────────────────────────────── */}
          {activeSection === 'skus' && (
            <div className="space-y-6 animate-fade-in">
              <SkuSection isAdmin={isManager} />
              {isAdmin && <AccessoryDeletionSection />}
            </div>
          )}

          {activeSection === 'locations' && (
            <div className="space-y-6 animate-fade-in">
              <LocationSection isAdmin={isAdmin} />
            </div>
          )}

          {activeSection === 'staff' && (
            <div className="space-y-6 animate-fade-in">
              <UserSection isAdmin={isAdmin} locations={locations} />
            </div>
          )}
        </div>

        {/* Right: Profile Card & Quick Reference */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5 border border-slate-100">
            <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" /> Your Profile
            </h2>
            <div className="flex flex-col items-center py-6 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-900 text-white text-xl font-bold shadow-md mb-3">
                {profile.full_name.charAt(0).toUpperCase()}
              </div>
              <p className="text-base font-semibold text-slate-800">
                {profile.full_name}
              </p>
              <p className="text-xs text-slate-400 font-medium font-mono mt-1">
                {session?.user?.email || '—'}
              </p>
            </div>
            <div className="space-y-3 mt-2 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Access Level</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {profile.role?.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">System Mode</span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                  Connected
                </span>
              </div>
            </div>
          </div>

          {/* Quick Status Key Reference */}
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5 border border-slate-100">
            <h2 className="text-base font-semibold text-slate-800 mb-3">
              Status Key
            </h2>
            <div className="space-y-2">
              {[
                { label: 'In Warehouse', color: 'bg-emerald-100 text-emerald-700' },
                { label: 'Reserved', color: 'bg-amber-100 text-amber-700' },
                { label: 'In Transit', color: 'bg-blue-100 text-blue-700' },
                { label: 'In Branch', color: 'bg-violet-100 text-violet-700' },
                { label: 'Sold', color: 'bg-teal-100 text-teal-700' },
                { label: 'Damaged / Repair', color: 'bg-red-100 text-red-700' },
                { label: 'Pending Serial', color: 'bg-orange-100 text-orange-700' },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{s.label}</span>
                  <span
                    className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${s.color}`}
                  >
                    ●
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
