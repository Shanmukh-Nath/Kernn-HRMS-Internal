'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarCheck,
  CheckCircle2,
  Palmtree,
  Megaphone,
  Menu,
} from 'lucide-react';

interface MobileTabBarProps {
  onToggleMenu: () => void;
  isMenuOpen: boolean;
  userRole?: string;
}

export function MobileTabBar({ onToggleMenu, isMenuOpen, userRole }: MobileTabBarProps) {
  const pathname = usePathname();

  const isManagerOrAdmin =
    userRole === 'SUPER_ADMIN' ||
    userRole === 'HR_ADMIN' ||
    userRole === 'MANAGER';

  const approvalsOrLeavesHref = isManagerOrAdmin ? '/approvals' : '/leaves';
  const approvalsOrLeavesLabel = isManagerOrAdmin ? 'Approvals' : 'Leaves';
  const ApprovalsOrLeavesIcon = isManagerOrAdmin ? CheckCircle2 : Palmtree;

  const tabs = [
    {
      name: 'Home',
      href: '/',
      icon: LayoutDashboard,
      isActive: pathname === '/',
    },
    {
      name: 'Attendance',
      href: '/daily-attendance',
      icon: CalendarCheck,
      isActive: pathname.startsWith('/daily-attendance') || pathname.startsWith('/attendance'),
    },
    {
      name: approvalsOrLeavesLabel,
      href: approvalsOrLeavesHref,
      icon: ApprovalsOrLeavesIcon,
      isActive: pathname.startsWith(approvalsOrLeavesHref),
    },
    {
      name: 'Notices',
      href: '/announcements',
      icon: Megaphone,
      isActive: pathname.startsWith('/announcements'),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0f1d]/95 backdrop-blur-xl border-t border-slate-800/90 shadow-[0_-4px_20px_rgba(0,0,0,0.3)] pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex items-center justify-around px-2 py-1.5 h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-all rounded-xl active:scale-95 ${
                tab.isActive
                  ? 'text-[#f87171] font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all ${
                  tab.isActive ? 'bg-[#a92427]/30 shadow-xs' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${tab.isActive ? 'text-[#f87171]' : 'text-slate-400'}`} />
                {tab.isActive && (
                  <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#f87171]" />
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">{tab.name}</span>
            </Link>
          );
        })}

        {/* Menu Toggle Button */}
        <button
          onClick={onToggleMenu}
          aria-label={isMenuOpen ? 'Close Navigation Menu' : 'Open Full Navigation Menu'}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition-all rounded-xl active:scale-95 ${
            isMenuOpen ? 'text-[#f87171] font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all ${
              isMenuOpen ? 'bg-[#a92427]/30 shadow-xs' : ''
            }`}
          >
            <Menu className={`w-5 h-5 ${isMenuOpen ? 'text-[#f87171]' : 'text-slate-400'}`} />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Menu</span>
        </button>
      </div>
    </nav>
  );
}
