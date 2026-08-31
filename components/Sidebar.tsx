'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  CalendarCheck,
  Clock,
  HardDrive,
  Users,
  Palmtree,
  Settings2,
  Bug,
  Radio,
  Sliders,
  DollarSign,
  Fingerprint,
  LogOut,
  User as UserIcon,
  Shield,
  Megaphone,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.user) {
          setSessionUser(d.data.user);
        }
      })
      .catch(() => {});
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const role = sessionUser?.role || 'EMPLOYEE';

  // Strict Role-Tailored Navigation Sections
  const getNavSections = () => {
    if (role === 'SUPER_ADMIN') {
      return [
        {
          title: 'OVERVIEW',
          items: [
            { name: 'Dashboard', href: '/', icon: LayoutDashboard },
            { name: 'Universal Reports', href: '/reports', icon: FileSpreadsheet, badge: 'All Hub' },
          ],
        },
        {
          title: 'ATTENDANCE & HARDWARE',
          items: [
            { name: "Today's Attendance", href: '/daily-attendance', icon: CalendarCheck, highlight: true },
            { name: 'Live Biometrics', href: '/live', icon: Radio, highlight: true },
            { name: 'Raw Punches', href: '/attendance', icon: CalendarCheck },
            { name: 'Hardware Audit Trail', href: '/devices/audit', icon: ShieldCheck, badge: 'Audit' },
            { name: 'Shift Rules', href: '/settings/rules', icon: Clock },
            { name: 'Devices & LAN', href: '/devices', icon: HardDrive },
            { name: 'Protocol Sniffer', href: '/debug', icon: Bug },
          ],
        },
        {
          title: 'PEOPLE & WORKFORCE',
          items: [
            { name: 'Employee Directory', href: '/employees', icon: Users },
            { name: 'Approvals Hub', href: '/approvals', icon: CheckCircle2, badge: 'All Types', highlight: true },
            { name: 'Leave Desk', href: '/leaves', icon: Palmtree },
            { name: 'Leave Accruals', href: '/leaves?tab=ACCRUALS', icon: Clock },
            { name: 'Leave Policies & Rules', href: '/leaves?tab=POLICIES', icon: Sliders },
            { name: 'Public Holidays', href: '/holidays', icon: Calendar },
            { name: 'Notice Board', href: '/announcements', icon: Megaphone },
          ],
        },
        {
          title: 'PAYROLL & SECURITY',
          items: [
            { name: 'Payroll Register', href: '/payroll', icon: DollarSign },
            { name: 'Salary Structures', href: '/payroll?tab=STRUCTURES', icon: Sliders },
            { name: 'Passkey Devices', href: '/settings/passkeys', icon: Fingerprint },
            { name: 'RBAC Roles Matrix', href: '/roles', icon: Shield },
          ],
        },
      ];
    }

    if (role === 'HR_ADMIN') {
      return [
        {
          title: 'OVERVIEW',
          items: [
            { name: 'Dashboard', href: '/', icon: LayoutDashboard },
            { name: 'Universal Reports', href: '/reports', icon: FileSpreadsheet, badge: 'All Hub' },
          ],
        },
        {
          title: 'ATTENDANCE & TIME',
          items: [
            { name: "Today's Attendance", href: '/daily-attendance', icon: CalendarCheck, highlight: true },
            { name: 'Shift Rules', href: '/settings/rules', icon: Clock },
          ],
        },
        {
          title: 'PEOPLE & WORKFORCE',
          items: [
            { name: 'Employee Directory', href: '/employees', icon: Users },
            { name: 'Approvals Hub', href: '/approvals', icon: CheckCircle2, badge: 'All Types', highlight: true },
            { name: 'Leave Desk', href: '/leaves', icon: Palmtree },
            { name: 'Leave Accruals', href: '/leaves?tab=ACCRUALS', icon: Clock },
            { name: 'Leave Policies & Rules', href: '/leaves?tab=POLICIES', icon: Sliders },
            { name: 'Public Holidays', href: '/holidays', icon: Calendar },
            { name: 'Notice Board', href: '/announcements', icon: Megaphone },
          ],
        },
        {
          title: 'PAYROLL & COMPLIANCE',
          items: [
            { name: 'Payroll Register', href: '/payroll', icon: DollarSign },
            { name: 'Salary Structures', href: '/payroll?tab=STRUCTURES', icon: Sliders },
            { name: 'Passkey Devices', href: '/settings/passkeys', icon: Fingerprint },
          ],
        },
      ];
    }

    if (role === 'MANAGER') {
      return [
        {
          title: 'OVERVIEW',
          items: [
            { name: 'Dashboard', href: '/', icon: LayoutDashboard },
          ],
        },
        {
          title: 'TEAM & ATTENDANCE',
          items: [
            { name: "Today's Attendance", href: '/daily-attendance', icon: CalendarCheck, highlight: true },
            { name: 'Approvals Hub', href: '/approvals', icon: CheckCircle2, badge: 'All Types', highlight: true },
          ],
        },
        {
          title: 'MY WORKSPACE',
          items: [
            { name: 'My Leave Desk', href: '/leaves', icon: Palmtree },
            { name: 'Notice Board', href: '/announcements', icon: Megaphone },
            { name: 'Public Holidays', href: '/holidays', icon: Calendar },
          ],
        },
        {
          title: 'SELF SERVICE',
          items: [
            { name: 'My Payslips', href: '/payroll', icon: DollarSign },
            { name: 'Passkey Devices', href: '/settings/passkeys', icon: Fingerprint },
          ],
        },
      ];
    }

    // EMPLOYEE (Self-Service Portal)
    return [
      {
        title: 'OVERVIEW',
        items: [
          { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        ],
      },
      {
        title: 'MY TIME & LEAVES',
        items: [
          { name: "Today's Attendance", href: '/daily-attendance', icon: CalendarCheck },
          { name: 'My Approvals Status', href: '/approvals', icon: CheckCircle2 },
          { name: 'My Leave Desk', href: '/leaves', icon: Palmtree },
          { name: 'Public Holidays', href: '/holidays', icon: Calendar },
          { name: 'Notice Board', href: '/announcements', icon: Megaphone },
        ],
      },
      {
        title: 'MY COMPENSATION & SECURITY',
        items: [
          { name: 'My Payslips', href: '/payroll', icon: DollarSign },
          { name: 'Passkey Devices', href: '/settings/passkeys', icon: Fingerprint },
        ],
      },
    ];
  };

  const navSections = getNavSections();

  return (
    <aside className="w-64 bg-[#0a0f1d] border-r border-slate-800/80 flex flex-col justify-between shrink-0 text-slate-300 select-none shadow-xl">
      <div className="overflow-y-auto flex-1 py-2 custom-scrollbar">
        {/* Brand Header with Kernn Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800/60 bg-slate-950/40">
          <img
            src="/kernn-icon.png"
            alt="Kernn"
            className="w-8 h-8 rounded-xl object-contain shadow-lg shadow-[#a92427]/40 ring-1 ring-white/10"
          />
          <div className="overflow-hidden">
            <h1 className="font-black text-sm text-white tracking-wider leading-tight">KERNN HRMS</h1>
            <p className="text-[9px] text-[#f87171] font-bold tracking-widest uppercase">Workforce Suite</p>
          </div>
        </div>

        {/* Categorized Navigation Sections */}
        <nav className="p-3 space-y-5">
          {navSections.map((sec) => (
            <div key={sec.title} className="space-y-1">
              <p className="px-3 text-[10px] font-extrabold text-slate-400 tracking-wider uppercase">
                {sec.title}
              </p>
              <div className="space-y-0.5">
                {sec.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                        isActive
                          ? 'bg-[#a92427] text-white shadow-md shadow-[#a92427]/25 font-bold'
                          : 'hover:bg-slate-800/60 hover:text-white text-slate-400'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 shrink-0 ${
                          isActive
                            ? 'text-white'
                            : (item as any).highlight
                            ? 'text-[#f87171]'
                            : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      <span className="truncate">{item.name}</span>

                      {(item as any).badge && !isActive && (
                        <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {(item as any).badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
        {sessionUser ? (
          <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#a92427] to-[#781215] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs border border-white/10">
                {sessionUser.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-slate-200 truncate leading-tight" title={sessionUser.name}>
                  {sessionUser.name}
                </div>
                <div className="text-[10px] text-[#f87171] font-mono font-medium truncate mt-0.5">
                  {sessionUser.role?.replace('_', ' ')}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0 ml-1"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#a92427] hover:bg-[#8e1d20] text-white text-xs font-bold shadow-md transition"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
