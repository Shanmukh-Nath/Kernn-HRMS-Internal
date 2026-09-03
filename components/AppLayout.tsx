'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { MobileTabBar } from '@/components/MobileTabBar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<any | null>(null);

  // Auto-close mobile drawer whenever route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Fetch current user session for role-aware mobile navigation
  useEffect(() => {
    if (!isAuthPage) {
      fetch('/api/auth/me')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.data?.user) {
            setSessionUser(d.data.user);
          }
        })
        .catch(() => {});
    }
  }, [pathname, isAuthPage]);

  if (isAuthPage) {
    return <main className="min-h-screen w-full bg-slate-50">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-900 antialiased relative">
      {/* Mobile Drawer Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden fixed inset-0 z-45 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-fadeIn"
          aria-hidden="true"
        />
      )}

      {/* Sidebar: Fixed left column on desktop, slide-over off-canvas drawer on mobile */}
      <Sidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        sessionUser={sessionUser}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          onToggleSidebar={() => setMobileMenuOpen(!mobileMenuOpen)}
          isSidebarOpen={mobileMenuOpen}
        />

        <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8 pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< md) */}
      <MobileTabBar
        onToggleMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        isMenuOpen={mobileMenuOpen}
        userRole={sessionUser?.role}
      />
    </div>
  );
}
