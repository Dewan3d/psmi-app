'use client';

// ============================================================
// PSMI System — User Profile Top-Right Dropdown
// ============================================================
// Displays user profile, role pill, Settings link, and
// animated Sign Out confirmation / action.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  Settings,
  LogOut,
  User,
  Shield,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { signOut } from '@/actions/auth';
import { useUser } from './user-context';
import ConfirmModal from './confirm-modal';

export function UserProfileDropdown() {
  const router = useRouter();
  const { profile, role, isAdmin, isViewer } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmSignOut, setShowConfirmSignOut] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const profileName = profile?.full_name || 'PSMI User';
  const roleDisplay = isViewer
    ? 'Viewer'
    : role
    ? role.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
    : 'Staff';

  // Handle outside click & escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleConfirmSignOut = async () => {
    setShowConfirmSignOut(false);
    setIsSigningOut(true);
    try {
      await signOut();
    } catch {
      router.push('/login');
    }
  };

  return (
    <>
      {/* Confirmation Warning Modal */}
      <ConfirmModal
        isOpen={showConfirmSignOut}
        onClose={() => setShowConfirmSignOut(false)}
        onConfirm={handleConfirmSignOut}
        title="Sign Out of PSMI"
        isDestructive={true}
        confirmText="Yes, Sign Out"
        cancelText="Stay Signed In"
        icon={<LogOut className="w-6 h-6 text-rose-600" />}
        message={
          <div className="space-y-1.5 text-xs text-slate-600">
            <p className="text-sm font-medium text-slate-800">
              Are you sure you want to sign out?
            </p>
            <p>
              Your active session will be securely terminated. You will need to enter your credentials to access the PSMI workspace again.
            </p>
          </div>
        }
      />

      {/* Full-screen exit transition overlay when signing out (teleported to body) */}
      {mounted && isSigningOut && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in text-white p-6">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm text-center animate-scale-in">
            <Loader2 className="w-9 h-9 text-indigo-500 animate-spin mb-3.5" />
            <p className="text-base font-bold text-white tracking-tight">Signing out...</p>
            <p className="text-xs text-slate-400 mt-1">Clearing active session securely.</p>
          </div>
        </div>,
        document.body
      )}

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200 select-none"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-bold tracking-wider ring-2 ring-indigo-500/20">
            {profileName ? profileName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-800 line-clamp-1 max-w-[120px]">
              {profileName}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {roleDisplay}
            </span>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-600' : 'rotate-0'
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-scale-in">
            {/* Header info */}
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
              <p className="text-xs font-bold text-slate-900 truncate">{profileName}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  <Shield className="w-2.5 h-2.5" />
                  {roleDisplay}
                </span>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <Link
                href="/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                Settings
              </Link>
            </div>

            <div className="border-t border-slate-100 pt-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowConfirmSignOut(true);
                }}
                disabled={isSigningOut}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer text-left"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
