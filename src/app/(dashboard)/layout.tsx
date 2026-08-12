'use client';

// ============================================================
// PSMI System — Dashboard Layout
// ============================================================
// Responsive sidebar (desktop) + hamburger menu (mobile).
// Top header with global search and user avatar.
// ============================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PackageOpen,
  Truck,
  Boxes,
  Settings,
  Search,
  Menu,
  X,
  LogOut,
  Bell,
  ChevronDown,
  Zap,
  ArrowLeftRight,
} from 'lucide-react';
import { signOut, getSession } from '@/actions/auth';

// ── Navigation Items ──────────────────────────────────────────
const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Inbound', href: '/inbound', icon: PackageOpen },
  { label: 'Outbound', href: '/outbound', icon: Truck },
  { label: 'Inventory', href: '/inventory', icon: Boxes },
  { label: 'SKU Swap', href: '/sku-swap', icon: ArrowLeftRight },
  { label: 'Settings', href: '/settings', icon: Settings },
];

// ── Logo Component ────────────────────────────────────────────
// Replace the Zap icon with your company logo by placing your
// logo file at /public/logo.svg (or logo.png) and uncommenting
// the <Image> tag below.
function AppLogo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3 group">
      {/* Option A: Icon placeholder (default) */}
      <div className="flex items-center justify-center w-9 h-9 bg-slate-900 rounded-xl shadow-md group-hover:shadow-lg transition-shadow">
        <Zap className="w-5 h-5 text-white" />
      </div>

      {/* Option B: Custom logo file — uncomment and replace Zap above
      <Image
        src="/logo.svg"
        alt="Company Logo"
        width={36}
        height={36}
        className="rounded-xl"
        priority
      />
      */}

      {!collapsed && (
        <div className="flex flex-col">
          <span className="text-base font-bold text-slate-900 leading-tight tracking-tight">
            PSMI
          </span>
          <span className="text-[10px] font-medium text-slate-400 leading-tight">
            Inventory System
          </span>
        </div>
      )}
    </Link>
  );
}

// ── Main Layout ───────────────────────────────────────────────
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileName, setProfileName] = useState<string>('');
  const [profileRole, setProfileRole] = useState<string>('');

  // Fetch user profile on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const session = await getSession();
        if (session?.profile) {
          setProfileName(session.profile.full_name || 'User');
          setProfileRole(session.profile.role || '');
        }
      } catch {
        // Silently handle — middleware will redirect if not authed
      }
    }
    loadProfile();
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ── Mobile Overlay ──────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[260px] bg-white border-r border-slate-200/80
          flex flex-col transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-100">
          <AppLogo />
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 lg:hidden transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${
                    active
                      ? 'bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }
                `}
              >
                <item.icon
                  className={`w-5 h-5 flex-shrink-0 ${
                    active ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                  strokeWidth={active ? 2 : 1.5}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-900 text-white text-sm font-semibold flex-shrink-0">
              {profileName ? profileName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">
                {profileName || 'Loading...'}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {profileRole
                  ? profileRole.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
                  : ''}
              </p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors" // impeccable-disable-line gray-on-color
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ───────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-4 lg:px-6">
          {/* Left: Hamburger + Search */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 lg:hidden transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search inventory, orders..."
                className="w-64 lg:w-80 pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition-all"
              />
            </div>
          </div>

          {/* Right: Notifications + Avatar */}
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            </button>

            <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-slate-200">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-semibold">
                {profileName ? profileName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-slate-700">
                  {profileName || '...'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
