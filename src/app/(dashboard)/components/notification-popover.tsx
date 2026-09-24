'use client';

// ============================================================
// PSMI System — Notification Popover Component
// ============================================================
// Notification drawer triggered by header bell icon.
// Displays live alerts, inbound onboardings, and verified sales.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bell,
  AlertTriangle,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Check,
  Clock,
  Loader2,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { getSystemNotifications, AppNotification, NotificationType } from '@/actions/notifications';

export function NotificationBellPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'ALERT' | 'INBOUND' | 'SALE_VERIFIED'>('ALL');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const popoverRef = useRef<HTMLDivElement>(null);

  // Load read notifications from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('psmi_read_notifications');
      if (stored) {
        setReadIds(new Set(JSON.parse(stored)));
      }
    } catch {}
  }, []);

  const fetchNotifs = async () => {
    setLoading(true);
    const res = await getSystemNotifications();
    if (res.data) {
      setNotifications(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifs();
    // Poll every 60 seconds
    const interval = setInterval(fetchNotifs, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click & escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
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

  const markAllAsRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
    try {
      localStorage.setItem('psmi_read_notifications', JSON.stringify(Array.from(allIds)));
    } catch {}
  };

  const markSingleAsRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem('psmi_read_notifications', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const filteredNotifs = notifications.filter((n) => {
    if (activeTab === 'ALL') return true;
    return n.type === activeTab;
  });

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white animate-scale-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200/60">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 bg-slate-50/40 text-[11px] font-medium overflow-x-auto">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('ALERT')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                activeTab === 'ALERT'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Alerts
            </button>
            <button
              onClick={() => setActiveTab('INBOUND')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                activeTab === 'INBOUND'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Inbound
            </button>
            <button
              onClick={() => setActiveTab('SALE_VERIFIED')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                activeTab === 'SALE_VERIFIED'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Sales
            </button>
          </div>

          {/* Body List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                <p className="text-xs">Loading updates...</p>
              </div>
            ) : filteredNotifs.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Check className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium text-slate-500">No notifications in this category</p>
              </div>
            ) : (
              filteredNotifs.map((notif) => {
                const isRead = readIds.has(notif.id);

                let icon = <AlertCircle className="w-4 h-4 text-amber-600" />;
                let iconBg = 'bg-amber-50 text-amber-600 border-amber-200/70';

                if (notif.type === 'INBOUND') {
                  icon = <ArrowDownLeft className="w-4 h-4 text-blue-600" />;
                  iconBg = 'bg-blue-50 text-blue-600 border-blue-200/70';
                } else if (notif.type === 'SALE_VERIFIED') {
                  icon = <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
                  iconBg = 'bg-emerald-50 text-emerald-600 border-emerald-200/70';
                } else if (notif.severity === 'critical') {
                  icon = <AlertTriangle className="w-4 h-4 text-red-600" />;
                  iconBg = 'bg-red-50 text-red-600 border-red-200/70';
                }

                return (
                  <Link
                    key={notif.id}
                    href={notif.linkUrl}
                    onClick={() => {
                      markSingleAsRead(notif.id);
                      setIsOpen(false);
                    }}
                    className={`block p-3.5 hover:bg-slate-50 transition-colors relative group ${
                      isRead ? 'opacity-70 bg-white' : 'bg-indigo-50/20'
                    }`}
                  >
                    {!isRead && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                    )}

                    <div className="flex items-start gap-3 pl-1">
                      <div className={`p-2 rounded-xl border shrink-0 ${iconBg}`}>
                        {icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {notif.title}
                          </p>
                          <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(notif.timestamp).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {notif.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-slate-100 bg-slate-50/70 text-center">
            <Link
              href="/dashboard/low-stock"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-semibold text-slate-600 hover:text-indigo-600 inline-flex items-center gap-1"
            >
              View Full Alerts & Thresholds <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
