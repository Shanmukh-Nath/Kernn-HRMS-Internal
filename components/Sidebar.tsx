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
  History,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  sessionUser?: any;
}

export function Sidebar({ isOpen = false, onClose, sessionUser: propUser }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [internalUser, setInternalUser] = useState<any | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  const sessionUser = propUser !== undefined ? propUser : internalUser;

  useEffect(() => {
    if (propUser === undefined) {
      fetch('/api/auth/me')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.data?.user) {
            setInternalUser(d.data.user);
          }
        })
        .catch(() => {});
    }

    // Fetch pending approvals count to show/hide "Action Required" badge dynamically
    fetch('/api/approvals/count')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && typeof d.count === 'number') {
          setPendingApprovalsCount(d.count);
        }
      })
      .catch(() => {});
  }, [pathname, propUser]);

  const handleLogout = async () => {
    onClose?.();
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
          title: 'CORE PLATFORM',
          items: [
            { name: 'Dashboard', href: '/', icon: LayoutDashboard },
            { name: 'Universal Reports', href: '/reports', icon: FileSpreadsheet, badge: 'All Hub' },
          ],
        },
        {
          title: 'TIME & ATTENDANCE',
          items: [
            { name: "Today's Attendance", href: '/daily-attendance', icon: CalendarCheck, highlight: true },
            { name: 'Raw Biometric Ledger', href: '/attendance', icon: Clock },
            { name: 'Shift & Timing Rules', href: '/settings/rules', icon: Sliders },
            { name: 'Terminals & LAN', href: '/devices', icon: HardDrive },
          ],
        },
        {
          title: 'PEOPLE & WORKFORCE',
          items: [
            { name: 'Employee Directory', href: '/employees', icon: Users },
            {
              name: 'Approvals Hub',
              href: '/approvals',
              icon: CheckCircle2,
              badge: pendingApprovalsCount > 0 ? 'Action Required' : undefined,
              highlight: pendingApprovalsCount > 0,
            },
            { name: 'Leave Policies & Accruals', href: '/leaves?tab=POLICIES', icon: Palmtree },
            { name: 'Public Holidays', href: '/holidays', icon: Calendar },
            { name: 'Notice Board', href: '/announcements', icon: Megaphone },
          ],
        },
        {
          title: 'FINANCE & SECURITY',
          items: [
            { name: 'Payroll & Payslips', href: '/payroll', icon: DollarSign },
            { name: 'Audit Trail & Forensics', href: '/audit', icon: History, badge: 'Live' },
            { name: 'Passkey Credentials', href: '/settings/passkeys', icon: Fingerprint },
            { name: 'RBAC Roles Matrix', href: '/roles', icon: Shield },
            { name: 'System Settings', href: '/settings', icon: Settings2 },
          ],
        },
      ];
    }

    if (role === 'HR_ADMIN') {
      return [
        {
          title: 'CORE PLATFORM',
          items: [
            { name: 'Dashboard', href: '/', icon: LayoutDashboard },
            { name: 'Universal Reports', href: '/reports', icon: FileSpreadsheet, badge: 'All Hub' },
          ],
        },
        {
          title: 'TIME & ATTENDANCE',
          items: [
            { name: "Today's Attendance", href: '/daily-attendance', icon: CalendarCheck, highlight: true },
            { name: 'Raw Biometric Ledger', href: '/attendance', icon: Clock },
            { name: 'Shift & Timing Rules', href: '/settings/rules', icon: Sliders },
          ],
        },
        {
          title: 'PEOPLE & WORKFORCE',
          items: [
            { name: 'Employee Directory', href: '/employees', icon: Users },
            {
              name: 'Approvals Hub',
              href: '/approvals',
              icon: CheckCircle2,
              badge: pendingApprovalsCount > 0 ? 'Action Required' : undefined,
              highlight: pendingApprovalsCount > 0,
            },
            { name: 'Leave Policies & Accruals', href: '/leaves?tab=POLICIES', icon: Palmtree },
            { name: 'Public Holidays', href: '/holidays', icon: Calendar },
            { name: 'Notice Board', href: '/announcements', icon: Megaphone },
          ],
        },
        {
          title: 'FINANCE & COMPLIANCE',
          items: [
            { name: 'Payroll Register', href: '/payroll', icon: DollarSign },
            { name: 'Audit Trail & Forensics', href: '/audit', icon: History, badge: 'Live' },
            { name: 'Passkey Credentials', href: '/settings/passkeys', icon: Fingerprint },
            { name: 'System Settings', href: '/settings', icon: Settings2 },
          ],
        },
      ];
    }

    if (role === 'MANAGER') {
      return [
        {
          title: 'CORE PLATFORM',
          items: [
            { name: 'Dashboard', href: '/', icon: LayoutDashboard },
            { name: "Team Attendance", href: '/daily-attendance', icon: CalendarCheck, highlight: true },
            {
              name: 'Approvals Hub',
              href: '/approvals',
              icon: CheckCircle2,
              badge: pendingApprovalsCount > 0 ? 'Action Required' : undefined,
              highlight: pendingApprovalsCount > 0,
            },
          ],
        },
        {
          title: 'MY WORKSPACE',
          items: [
            { name: 'Leave Desk', href: '/leaves', icon: Palmtree },
            { name: 'Notice Board', href: '/announcements', icon: Megaphone },
            { name: 'Public Holidays', href: '/holidays', icon: Calendar },
            { name: 'My Payslips', href: '/payroll', icon: DollarSign },
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
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] md:static md:w-64 md:translate-x-0 bg-[#0a0f1d] border-r border-slate-800/80 flex flex-col justify-between shrink-0 text-slate-300 select-none shadow-2xl md:shadow-xl transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="overflow-y-auto flex-1 py-2 custom-scrollbar">
        {/* Brand Header with Kernn Logo & Mobile Close Button */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800/60 bg-slate-950/40">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/kernn-icon.png"
              alt="Kernn"
              className="w-8 h-8 rounded-xl object-contain shadow-lg shadow-[#a92427]/40 ring-1 ring-white/10 shrink-0"
            />
            <div className="overflow-hidden">
              <h1 className="font-black text-sm text-white tracking-wider leading-tight truncate">KERNN HRMS</h1>
              <p className="text-[9px] text-[#f87171] font-bold tracking-widest uppercase truncate">Workforce Suite</p>
            </div>
          </div>

          {/* Mobile Drawer Close Button */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/70 transition shrink-0 ml-2"
            aria-label="Close navigation drawer"
          >
            <X className="w-5 h-5" />
          </button>
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
                  const itemBase = item.href.split('?')[0];
                  const isActive = pathname === item.href || pathname === itemBase || (itemBase !== '/' && pathname.startsWith(itemBase));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => onClose?.()}
                      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 min-h-[40px] ${
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
