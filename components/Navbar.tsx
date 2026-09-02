'use client';

import {
  Activity,
  Clock,
  Shield,
  LogOut,
  ChevronDown,
  Bell,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  Palmtree,
  FileCheck2,
  ExternalLink,
  Check,
  X,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DEFAULT_TIMEZONE } from '@/lib/timezone';

export function Navbar() {
  const router = useRouter();
  const [timeStr, setTimeStr] = useState<string>('');
  const [sessionUser, setSessionUser] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Notification State
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const d = await res.json();
      if (d.success && d.data?.user) setSessionUser(d.data.user);
    } catch {}
  };

  const fetchNotifications = async () => {
    try {
      setLoadingNotifs(true);
      const res = await fetch('/api/notifications');
      const d = await res.json();
      if (d.success && d.data) {
        setNotifications(d.data.notifications || []);
        setUnreadCount(d.data.unreadCount || 0);
      }
    } catch {
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    fetchSession();
    fetchNotifications();

    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        new Intl.DateTimeFormat('en-IN', {
          timeZone: DEFAULT_TIMEZONE,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour12: false,
        }).format(now)
      );
    };

    updateTime();
    const clockInterval = setInterval(updateTime, 1000);
    const notifInterval = setInterval(fetchNotifications, 30000); // Polling every 30s

    // Click outside handler for notification dropdown
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      clearInterval(clockInterval);
      clearInterval(notifInterval);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleGlobalRefresh = () => {
    setRefreshing(true);
    // Dispatch custom event that active pages listen to for refreshing their local states
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hrms-refresh'));
    }
    fetchSession();
    fetchNotifications();
    router.refresh();
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  };

  const handleMarkAllRead = async () => {
    try {
      const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
      if (unreadIds.length === 0) return;
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MARK_ALL_READ', notificationIds: unreadIds }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.isRead) {
      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: notif.id }),
      }).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setShowNotifs(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-[#a92427]/10 text-[#a92427] border-[#a92427]/20';
      case 'HR_ADMIN':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'MANAGER':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between shadow-xs sticky top-0 z-30">
      {/* Left: Clean Breadcrumb & Live Hardware Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">Kernn Enterprise HRMS</span>
        </div>

        <span className="hidden md:inline-block text-slate-300">|</span>

        {sessionUser?.role === 'SUPER_ADMIN' ? (
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
            Hardware & LAN Active
          </span>
        ) : (
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Cloud HRMS Active
          </span>
        )}
      </div>

      {/* Right: Refresh Button, Notifications Bell, Digital Clock & User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 text-sm">
        {/* Global Live Refresh Button */}
        <button
          onClick={handleGlobalRefresh}
          title="Refresh HRMS Data & State"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition text-xs font-bold active:scale-95"
        >
          <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin text-[#a92427]' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        {/* Real-time Notification Center */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setShowNotifs(!showNotifs);
              if (!showNotifs) fetchNotifications();
            }}
            title="Notification Center"
            className={`relative p-2 rounded-xl border transition ${
              showNotifs
                ? 'bg-[#a92427]/10 border-[#a92427]/30 text-[#a92427]'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-600'
            }`}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#a92427] px-1 text-[9px] font-black text-white shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotifs && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden animate-scaleUp">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#a92427]" />
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Notifications & Alerts
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[10px] font-bold text-[#a92427] hover:underline flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>Mark all read</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifs(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Notification Items Feed */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                {loadingNotifs && notifications.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">Loading notifications...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <div className="text-xs font-bold text-slate-800">All Caught Up!</div>
                    <p className="text-[11px] text-slate-400">No new notices or sign-off requests.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-4 transition cursor-pointer hover:bg-slate-50 flex items-start gap-3 ${
                        !n.isRead ? 'bg-[#a92427]/[0.03]' : ''
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {n.type === 'ANNOUNCEMENT' ? (
                          <div className="w-7 h-7 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
                            <Megaphone className="w-3.5 h-3.5" />
                          </div>
                        ) : n.type === 'LEAVE' ? (
                          <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                            <Palmtree className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                            <FileCheck2 className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-slate-900 truncate">{n.title}</span>
                          {!n.isRead && (
                            <span className="w-2 h-2 rounded-full bg-[#a92427] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">{n.message}</p>
                        <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400 font-medium">
                          <span>{n.timeAgo}</span>
                          <span className="text-[#a92427] font-semibold flex items-center gap-0.5">
                            View <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                <Link
                  href="/announcements"
                  onClick={() => setShowNotifs(false)}
                  className="text-[11px] font-bold text-slate-700 hover:text-[#a92427] transition"
                >
                  View All Company Notices →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* IST Digital Clock */}
        <div className="hidden sm:flex items-center gap-2 bg-slate-50 hover:bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200/80 transition shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono text-xs font-semibold text-slate-700 tracking-tight">{timeStr || 'Loading...'}</span>
          <span className="text-[9px] text-slate-500 font-bold px-1.5 py-0.5 rounded bg-slate-200/70 font-mono">IST</span>
        </div>

        {/* User Profile Pill */}
        <div className="flex items-center gap-3 pl-2 sm:border-l border-slate-200">
          <div className="flex items-center gap-2.5 bg-slate-50/80 hover:bg-slate-100 p-1.5 pr-3 rounded-2xl border border-slate-200/80 transition">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#a92427] to-[#781215] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
              {sessionUser?.name ? sessionUser.name.charAt(0).toUpperCase() : 'U'}
            </div>

            <div className="text-left leading-none max-w-[120px] sm:max-w-[180px]">
              <div className="font-bold text-xs text-slate-900 truncate" title={sessionUser?.name}>
                {sessionUser?.name || 'Administrator'}
              </div>
              <div className="mt-1">
                <span className={`inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border tracking-wider font-mono ${getRoleBadge(sessionUser?.role)}`}>
                  {sessionUser?.role?.replace('_', ' ') || 'EMPLOYEE'}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="ml-1 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
