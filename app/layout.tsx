import './globals.css';
import type { Metadata, Viewport } from 'next';
import { AppLayout } from '@/components/AppLayout';
import { LoadingProvider } from '@/components/LoadingProvider';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0a0f1d',
};

export const metadata: Metadata = {
  title: 'Kernn HRMS Suite | Kernn Automations',
  description: 'Enterprise Workforce, Intelligent Attendance & Statutory Payroll Platform by Kernn Automations',
  icons: {
    icon: '/kernn-icon.png',
    apple: '/kernn-icon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kernn HRMS',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased font-sans text-slate-900 bg-slate-100 min-h-screen">
        <LoadingProvider>
          <AppLayout>{children}</AppLayout>
        </LoadingProvider>
      </body>
    </html>
  );
}
