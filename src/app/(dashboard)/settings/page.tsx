// ============================================================
// PSMI System — Settings & Administration Page
// ============================================================
// Client Component — manage SKUs, locations, and invite users.
// ============================================================

'use client';

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
} from 'lucide-react';
import { createProduct, updateProduct, deleteProduct, listProducts } from '@/actions/products';
import { createLocation, listLocations } from '@/actions/locations';
import { listUsers, updateUserRole, assignUserLocation, inviteUser } from '@/actions/users';
import { getSession } from '@/actions/auth';
import { listInboundTransactions, deleteInboundTransaction } from '@/actions/inbound';
import { UserRole } from '@/lib/types/database';

type Product = { sku: string; model_name: string; description: string | null; low_stock_threshold: number; is_serialized: boolean; created_at: string };
type Location = { id: string; name: string; type: string; address: string | null; created_at: string };
type UserProfile = { id: string; full_name: string; role: string; location_id: string | null; created_at: string; location_name?: string };

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
  const [editThreshold, setEditThreshold] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function loadProducts() {
    const result = await listProducts();
    setProducts((result.data || []) as any);
  }

  useEffect(() => { loadProducts(); }, []);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createProduct({
        sku,
        model_name: modelName,
        description: description || undefined,
        low_stock_threshold: parseInt(threshold) || 10,
        is_serialized: isSerialized,
      });
      if (result.error) { setError(result.error); return; }
      setSku(''); setModelName(''); setDescription(''); setThreshold('10'); setIsSerialized(true); setShowForm(false);
      await loadProducts();
    });
  }

  function handleEdit(p: Product) {
    setEditingSku(p.sku);
    setEditModelName(p.model_name);
    setEditThreshold(String(p.low_stock_threshold));
  }

  function handleSaveEdit(skuToEdit: string) {
    startTransition(async () => {
      await updateProduct(skuToEdit, { model_name: editModelName, low_stock_threshold: parseInt(editThreshold) || 10 });
      setEditingSku(null);
      await loadProducts();
    });
  }

  function handleDelete(skuToDelete: string) {
    startTransition(async () => {
      const result = await deleteProduct(skuToDelete);
      if (result.error) { setError(result.error); setDeleteConfirm(null); return; }
      setDeleteConfirm(null);
      await loadProducts();
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Barcode className="w-5 h-5 text-indigo-600" /> Product SKU Catalogue
        </h2>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New SKU
          </button>
        )}
      </div>

      {/* New SKU form */}
      {showForm && (
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">SKU Code</label>
                <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} required placeholder="e.g. EP600" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono uppercase" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Model Name</label>
                <input type="text" value={modelName} onChange={(e) => setModelName(e.target.value)} required placeholder="e.g. Bluetti EP600" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Low Stock Alert</label>
                  <input type="number" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
                <div className="flex items-center justify-center pt-5">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-600 select-none">
                    <input type="checkbox" checked={isSerialized} onChange={(e) => setIsSerialized(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500/30 w-4 h-4 border-slate-250" />
                    Track Serials
                  </label>
                </div>
              </div>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="flex-1 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Cancel</button>
              <button type="submit" disabled={isPending} className="flex-1 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60">
                {isPending ? 'Saving…' : 'Create SKU'}
              </button>
            </div>
          </form>
        </div>
      )}
 
      <div className="divide-y divide-slate-100">
        {products.length === 0 && <div className="p-6 text-center text-sm text-slate-400">No SKUs registered yet.</div>}
        {products.map((p) => (
          <div key={p.sku} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50">
            {editingSku === p.sku ? (
              <>
                <input value={editModelName} onChange={(e) => setEditModelName(e.target.value)} className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                <input type="number" value={editThreshold} onChange={(e) => setEditThreshold(e.target.value)} className="w-20 px-2 py-1 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                <button onClick={() => handleSaveEdit(p.sku)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingSku(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{p.model_name}</p>
                    {p.is_serialized === false && (
                      <span className="text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded-md">
                        Non-Serialized
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{p.sku}</p>
                </div>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-lg px-2 py-1">Alert at {p.low_stock_threshold}</span>
                {isAdmin && (
                  <>
                    <button onClick={() => handleEdit(p)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                    {deleteConfirm === p.sku ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-red-600 font-medium">Confirm?</span>
                        <button onClick={() => handleDelete(p.sku)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteConfirm(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(p.sku)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {error && !showForm && <div className="px-5 pb-4 text-xs text-red-600">{error}</div>}
    </div>
  );
}

// ── Location Management Section ───────────────────────────────
function LocationSection({ isAdmin }: { isAdmin: boolean }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'WAREHOUSE' | 'BRANCH'>('BRANCH');
  const [address, setAddress] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function loadLocations() {
    const result = await listLocations();
    setLocations(result.data || []);
  }

  useEffect(() => { loadLocations(); }, []);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createLocation({ name, type, address: address || undefined });
      if (result.error) { setError(result.error); return; }
      setName(''); setType('BRANCH'); setAddress(''); setShowForm(false);
      await loadLocations();
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-indigo-600" /> Operational Locations
        </h2>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Location
          </button>
        )}
      </div>

      {showForm && (
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Location Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Johannesburg Branch" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                  <option value="BRANCH">Branch</option>
                  <option value="WAREHOUSE">Warehouse</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Address (optional)</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 123 Industrial Rd, Johannesburg" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="flex-1 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Cancel</button>
              <button type="submit" disabled={isPending} className="flex-1 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60">
                {isPending ? 'Saving…' : 'Create Location'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {locations.length === 0 && <div className="p-6 text-center text-sm text-slate-400">No locations configured.</div>}
        {locations.map((loc) => (
          <div key={loc.id} className="flex items-start justify-between px-5 py-3.5 hover:bg-slate-50/50">
            <div>
              <p className="text-sm font-semibold text-slate-800">{loc.name}</p>
              {loc.address && <p className="text-xs text-slate-400 mt-0.5 max-w-xs">{loc.address}</p>}
            </div>
            <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${loc.type === 'WAREHOUSE' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
              {loc.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── User Management Section ───────────────────────────────────
function UserSection({ isAdmin, locations }: { isAdmin: boolean; locations: Location[] }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('BRANCH_STAFF');
  const [inviteLocation, setInviteLocation] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadUsers() {
    const result = await listUsers();
    setUsers((result.data || []) as any);
  }

  useEffect(() => { if (isAdmin) loadUsers(); }, [isAdmin]);

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);
    startTransition(async () => {
      const result = await inviteUser({
        email: inviteEmail,
        full_name: inviteName,
        role: inviteRole,
        location_id: inviteLocation || undefined,
      });
      if (result.error) { setError(result.error); return; }
      setSuccess(`Invite sent to ${inviteEmail}`);
      setInviteEmail(''); setInviteName(''); setInviteRole('BRANCH_STAFF'); setInviteLocation('');
      setShowInvite(false);
      await loadUsers();
    });
  }

  if (!isAdmin) return null;

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" /> Staff Accounts
        </h2>
        <button onClick={() => setShowInvite(!showInvite)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Mail className="w-3.5 h-3.5" /> Invite User
        </button>
      </div>

      {showInvite && (
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required placeholder="e.g. John Smith" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email Address</label>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required placeholder="staff@company.com" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as UserRole)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                  <option value="BRANCH_STAFF">Branch Staff</option>
                  <option value="WAREHOUSE_MANAGER">Warehouse Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assign Location</label>
                <select value={inviteLocation} onChange={(e) => setInviteLocation(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                  <option value="">No specific location</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            {success && <p className="text-xs text-emerald-600 font-medium">{success}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowInvite(false); setError(null); }} className="flex-1 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Cancel</button>
              <button type="submit" disabled={isPending} className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60">
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                {isPending ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {users.length === 0 && <div className="p-6 text-center text-sm text-slate-400">No users found.</div>}
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                {u.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{u.full_name}</p>
                {u.location_name && <p className="text-xs text-slate-400 mt-0.5">{u.location_name}</p>}
              </div>
            </div>
            <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${
              u.role === 'ADMIN' ? 'bg-red-50 text-red-600 border border-red-100'
              : u.role === 'WAREHOUSE_MANAGER' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
              : 'bg-slate-50 text-slate-600 border border-slate-200'
            }`}>
              {u.role?.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
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

    // Filter inbounds where product is non-serialized
    const txns = (txnRes.data || []).filter((t: any) => {
      const prod = prods.find((p: any) => p.sku === t.sku);
      return prod ? prod.is_serialized === false : false;
    });
    setInbounds(txns);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this accessory inbound receipt? This will remove all associated stock. This action CANNOT be undone and is for admin stock correction only!")) return;
    setIsDeleting(true);
    const res = await deleteInboundTransaction(id);
    setIsDeleting(false);
    if (res.error) {
      alert(res.error);
    } else {
      await load();
    }
  }

  if (loading) return null;
  if (inbounds.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/10">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Admin Stock Adjustments (Accessories)</h2>
          <p className="text-xs text-slate-400 mt-0.5">Delete non-serialized receipts to correct stock errors (only if undispatched)</p>
        </div>
      </div>
      <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
        {inbounds.map((txn) => (
          <div key={txn.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50">
            <div>
              <p className="text-sm font-semibold text-slate-800">{txn.model_name}</p>
              <p className="text-xs font-mono text-slate-400 mt-0.5">Receipt: {txn.tracking_number} · SKU: {txn.sku}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-800">Qty: {txn.total_items}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {new Date(txn.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
              </div>
              <button
                onClick={() => handleDelete(txn.id)}
                disabled={isDeleting}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
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

// ── Main Page ─────────────────────────────────────────────────
export default function SettingsPage() {
  const [session, setSession] = useState<any>(null);
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    async function load() {
      const s = await getSession();
      setSession(s);
      const result = await listLocations();
      setLocations(result.data || []);
    }
    load();
  }, []);

  const profile = session?.profile || { full_name: 'Loading…', role: 'BRANCH_STAFF' };
  const isAdmin = profile.role === 'ADMIN';
  const isManager = profile.role === 'ADMIN' || profile.role === 'WAREHOUSE_MANAGER';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings &amp; Control Panel</h1>
        <p className="text-sm text-slate-500 mt-1">Manage system configurations, SKUs, locations, and staff.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: SKUs + Locations */}
        <div className="lg:col-span-2 space-y-6">
          <SkuSection isAdmin={isManager} />
          <LocationSection isAdmin={isAdmin} />
          <UserSection isAdmin={isAdmin} locations={locations} />
          {isAdmin && <AccessoryDeletionSection />}
        </div>

        {/* Right: Profile Card */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5">
            <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" /> Your Profile
            </h2>
            <div className="flex flex-col items-center py-6 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-900 text-white text-xl font-bold shadow-md mb-3">
                {profile.full_name.charAt(0).toUpperCase()}
              </div>
              <p className="text-base font-semibold text-slate-800">{profile.full_name}</p>
              <p className="text-xs text-slate-400 font-medium font-mono mt-1">{session?.user?.email || '—'}</p>
            </div>
            <div className="space-y-3 mt-2 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Access Level</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
                  <ShieldCheck className="w-3.5 h-3.5" />{profile.role?.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">System Mode</span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">Connected</span>
              </div>
            </div>
          </div>

          {/* Quick reference */}
          <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] p-5">
            <h2 className="text-base font-semibold text-slate-800 mb-3">Status Key</h2>
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
                  <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${s.color}`}>●</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
