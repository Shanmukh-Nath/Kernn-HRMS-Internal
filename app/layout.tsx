import './globals.css';
import type { Metadata } from 'next';
import { AppLayout } from '@/components/AppLayout';

export const metadata: Metadata = {
  title: 'Kernn HRMS Suite | Kernn Automations',
  description: 'Enterprise Workforce, Intelligent Attendance & Statutory Payroll Platform by Kernn Automations',
  icons: {
    icon: '/kernn-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
