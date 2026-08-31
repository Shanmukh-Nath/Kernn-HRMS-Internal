'use client';

import { Activity, Clock, Shield, LogOut, ChevronDown, Bell } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_TIMEZONE } from '@/lib/timezone';

export function Navbar() {
  const router = useRouter();
  const [timeStr, setTimeStr] = useState<string>('');
  const [sessionUser, setSessionUser] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.user) setSessionUser(d.data.user);
      })
      .catch(() => {});

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
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 sm:px-8 flex items-center justify-between shadow-xs sticky top-0 z-30">
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

      {/* Right: Live IST Clock & User Profile Pill */}
      <div className="flex items-center gap-4 text-sm">
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

            <div className="text-left leading-none max-w-[140px] sm:max-w-[180px]">
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
