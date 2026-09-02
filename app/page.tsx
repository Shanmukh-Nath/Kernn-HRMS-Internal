'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Clock,
  CalendarCheck,
  Palmtree,
  DollarSign,
  Megaphone,
  Radio,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Activity,
  UserCheck,
  UserX,
  Plus,
  FileSpreadsheet,
  Download,
  Calendar,
  Sliders,
  Sparkles,
  Eye,
  Check,
  Layers,
} from 'lucide-react';
import { format } from 'date-fns';

export default function DashboardPage() {
  const [sessionUser, setSessionUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Super Admin / HR Data
  const [todayData, setTodayData] = useState<any>(null);
  const [recentPunches, setRecentPunches] = useState<any[]>([]);

  // Manager Data
  const [pendingApprovals, setPendingApprovals] = useState<{ leaves: any[]; regularizations: any[] }>({
    leaves: [],
    regularizations: [],
  });

  // Employee Data
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [myRegularizations, setMyRegularizations] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);

  // Time Correction Modal State (for Employee)
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionForm, setCorrectionForm] = useState<{
    date: string;
    adjustmentType: 'CHECK_IN' | 'CHECK_OUT' | 'BOTH';
    requestedCheckIn: string;
    requestedCheckOut: string;
    reason: string;
  }>({
    date: format(new Date(), 'yyyy-MM-dd'),
    adjustmentType: 'CHECK_IN',
    requestedCheckIn: '09:00',
    requestedCheckOut: '18:00',
    reason: '',
  });
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [correctionMsg, setCorrectionMsg] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      const meJson = await meRes.json();
      if (!meJson.success || !meJson.data?.user) return;
      const user = meJson.data.user;
      setSessionUser(user);

      // Common: Announcements & Holidays
      const [annRes, holRes] = await Promise.all([
        fetch('/api/announcements'),
        fetch('/api/holidays'),
      ]);
      const annJson = await annRes.json();
      const holJson = await holRes.json();
      if (annJson.success) setAnnouncements(annJson.data?.slice(0, 3) || []);
      if (holJson.success) setHolidays(holJson.data?.slice(0, 3) || []);

      // Role Specific Fetches
      if (user.role === 'SUPER_ADMIN') {
        const [todayRes, attRes] = await Promise.all([
          fetch('/api/attendance/today'),
          fetch('/api/attendance?limit=6'),
        ]);
        const todayJson = await todayRes.json();
        const attJson = await attRes.json();
        if (todayJson.success) setTodayData(todayJson.data);
        if (attJson.success) setRecentPunches(attJson.data?.events || []);
      } else if (user.role === 'HR_ADMIN') {
        const todayRes = await fetch('/api/attendance/today');
        const todayJson = await todayRes.json();
        if (todayJson.success) setTodayData(todayJson.data);
      } else if (user.role === 'MANAGER') {
        const [leavesRes, regRes, todayRes] = await Promise.all([
          fetch('/api/leaves'),
          fetch('/api/attendance/regularize'),
          fetch('/api/attendance/today'),
        ]);
        const lJson = await leavesRes.json();
        const rJson = await regRes.json();
        const tJson = await todayRes.json();
        if (lJson.success) setPendingApprovals((p) => ({ ...p, leaves: (lJson.data?.requests || []).filter((r: any) => r.status === 'PENDING') }));
        if (rJson.success) setPendingApprovals((p) => ({ ...p, regularizations: (rJson.data || []).filter((r: any) => r.status === 'PENDING') }));
        if (tJson.success) setTodayData(tJson.data);
      } else {
        // EMPLOYEE
        const [leavesRes, regRes, todayRes] = await Promise.all([
          fetch('/api/leaves'),
          fetch('/api/attendance/regularize'),
          fetch('/api/attendance/today'),
        ]);
        const lJson = await leavesRes.json();
        const rJson = await regRes.json();
        const tJson = await todayRes.json();
        if (lJson.success) setLeaveBalances(lJson.data?.balances || []);
        if (rJson.success) setMyRegularizations(rJson.data || []);
        if (tJson.success) setTodayData(tJson.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCorrectionSubmitting(true);
    setCorrectionMsg(null);
    try {
      const res = await fetch('/api/attendance/regularize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(correctionForm),
      });
      const json = await res.json();
      if (json.success) {
        setCorrectionMsg('Correction submitted to your reporting manager for approval.');
        setTimeout(() => {
          setShowCorrectionModal(false);
          setCorrectionMsg(null);
          fetchDashboard();
        }, 1200);
      } else {
        setCorrectionMsg(json.error?.message || 'Submission failed');
      }
    } catch {
      setCorrectionMsg('Network error submitting correction request');
    } finally {
      setCorrectionSubmitting(false);
    }
  };

  const role = sessionUser?.role || 'EMPLOYEE';
  const myCheckIn = todayData?.todayCheckIns?.find((c: any) => c.employeeId === sessionUser?.employeeId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn">
      {/* ========================================================================= */}
      {/* 1. SUPER ADMIN DASHBOARD */}
      {/* ========================================================================= */}
      {role === 'SUPER_ADMIN' && (
        <div className="space-y-6">
          <div className="p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-[#3b0b0c] to-slate-950 text-white border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#a92427]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#a92427]/30 border border-[#a92427]/50 text-[#f8b4b4] text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Master Infrastructure & Terminal Console</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                  Welcome, Super Admin {sessionUser?.name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                  Unrestricted system control: monitor live terminal biometrics, raw device packet sniffer, and statutory payroll structures.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/live"
                  className="px-5 py-2.5 rounded-2xl bg-[#a92427] hover:bg-[#8e1d20] text-white text-xs font-bold shadow-lg shadow-[#a92427]/30 transition flex items-center gap-2"
                >
                  <Radio className="w-4 h-4 text-emerald-300" />
                  <span>Live Biometrics</span>
                </Link>
                <Link
                  href="/reports"
                  className="px-5 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-white text-xs font-bold transition flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Universal Reports</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Super Admin Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Headcount</span>
              <div className="text-3xl font-black font-mono text-slate-900 mt-2">
                {todayData?.metrics?.totalActiveStaff || 8}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Active workforce profiles</div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Today&apos;s Presence</span>
              <div className="text-3xl font-black font-mono text-emerald-700 mt-2">
                {todayData?.metrics?.presentCount || 0}
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-1">
                {todayData?.metrics?.attendanceRate || 0}% roll-call rate
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Secureye S-FB3K</span>
              <div className="text-xl font-black font-mono text-slate-900 mt-2 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>ONLINE</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">IP 192.168.1.201:80 (Polling 60s)</div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">On Leave Today</span>
              <div className="text-3xl font-black font-mono text-purple-700 mt-2">
                {todayData?.metrics?.onLeaveCount || 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Authorized time off</div>
            </div>
          </div>

          {/* Quick Actions Strip */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Administrator Console Hubs</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Link href="/daily-attendance" className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition text-center space-y-1 group">
                <CalendarCheck className="w-6 h-6 text-[#a92427] mx-auto group-hover:scale-110 transition" />
                <div className="font-bold text-xs text-slate-800">Today&apos;s Attendance</div>
                <div className="text-[10px] text-slate-400">Live check-ins roll call</div>
              </Link>
              <Link href="/attendance" className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition text-center space-y-1 group">
                <Clock className="w-6 h-6 text-blue-600 mx-auto group-hover:scale-110 transition" />
                <div className="font-bold text-xs text-slate-800">Raw Device Punches</div>
                <div className="text-[10px] text-slate-400">Unfiltered biometric logs</div>
              </Link>
              <Link href="/devices" className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition text-center space-y-1 group">
                <HardDrive className="w-6 h-6 text-purple-600 mx-auto group-hover:scale-110 transition" />
                <div className="font-bold text-xs text-slate-800">Devices & LAN</div>
                <div className="text-[10px] text-slate-400">Terminal discovery & ping</div>
              </Link>
              <Link href="/payroll" className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition text-center space-y-1 group">
                <DollarSign className="w-6 h-6 text-emerald-600 mx-auto group-hover:scale-110 transition" />
                <div className="font-bold text-xs text-slate-800">Payroll Register</div>
                <div className="text-[10px] text-slate-400">Batch salary calculations</div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. HR ADMIN DASHBOARD */}
      {/* ========================================================================= */}
      {role === 'HR_ADMIN' && (
        <div className="space-y-6">
          <div className="p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-200 text-xs font-semibold">
                  <Users className="w-3.5 h-3.5" />
                  <span>Workforce Operations & Statutory Compliance</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                  Welcome back, HR Lead {sessionUser?.name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                  Manage the employee lifecycle across 6 cohesive modules, configure custom leave policies, trigger periodic accrual cycles, and disburse statutory payroll.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/employees"
                  className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-lg transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Onboard Employee</span>
                </Link>
                <Link
                  href="/leaves?tab=ACCRUALS"
                  className="px-5 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-white text-xs font-bold transition flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  <span>Run Accrual Cycle</span>
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Workforce</span>
              <div className="text-3xl font-black font-mono text-slate-900 mt-2">
                {todayData?.metrics?.totalActiveStaff || 8}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Across 6 enterprise modules</div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Present Today</span>
              <div className="text-3xl font-black font-mono text-emerald-700 mt-2">
                {todayData?.metrics?.presentCount || 0}
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-1">
                {todayData?.metrics?.attendanceRate || 0}% attendance rate
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">On Leave Today</span>
              <div className="text-3xl font-black font-mono text-purple-700 mt-2">
                {todayData?.metrics?.onLeaveCount || 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Approved time off</div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Late Arrivals</span>
              <div className="text-3xl font-black font-mono text-amber-700 mt-2">
                {todayData?.metrics?.lateCount || 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Requires grace review</div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MANAGER DASHBOARD */}
      {/* ========================================================================= */}
      {role === 'MANAGER' && (
        <div className="space-y-6">
          <div className="p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-200 text-xs font-semibold">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Supervisor Desk & Team Leadership</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                  Welcome, Team Lead {sessionUser?.name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                  Review subordinate time-off applications, inspect recorded vs requested punch regularizations, and publish team bulletins.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/approvals"
                  className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg transition flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Team Approvals Queue ({pendingApprovals.leaves.length + pendingApprovals.regularizations.length})</span>
                </Link>
                <Link
                  href="/announcements"
                  className="px-5 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-white text-xs font-bold transition flex items-center gap-2"
                >
                  <Megaphone className="w-4 h-4" />
                  <span>Post Notice</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Supervisor Action Queue Alerts */}
          {(pendingApprovals.leaves.length > 0 || pendingApprovals.regularizations.length > 0) && (
            <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 text-xs">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <strong>Action Required:</strong> You have{' '}
                  <span className="font-bold font-mono">{pendingApprovals.leaves.length} pending leave request(s)</span> and{' '}
                  <span className="font-bold font-mono">{pendingApprovals.regularizations.length} attendance correction(s)</span> awaiting your sign-off.
                </div>
              </div>
              <Link
                href="/approvals"
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs whitespace-nowrap shadow-2xs"
              >
                Review Approvals Now &rarr;
              </Link>
            </div>
          )}

          {/* Team Operational Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Today&apos;s Checked-In Staff</span>
              <div className="text-3xl font-black font-mono text-emerald-700 mt-2">
                {todayData?.todayCheckIns?.length || 0}
              </div>
              <Link href="/daily-attendance" className="text-xs font-bold text-blue-600 hover:underline mt-2 inline-block">
                View Roll Call &rarr;
              </Link>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Team on Leave Today</span>
              <div className="text-3xl font-black font-mono text-purple-700 mt-2">
                {todayData?.todayOnLeave?.length || 0}
              </div>
              <Link href="/daily-attendance" className="text-xs font-bold text-purple-600 hover:underline mt-2 inline-block">
                View Leave Details &rarr;
              </Link>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Company Notices</span>
              <div className="text-3xl font-black font-mono text-slate-900 mt-2">
                {announcements.length}
              </div>
              <Link href="/announcements" className="text-xs font-bold text-slate-600 hover:underline mt-2 inline-block">
                Publish or View Notices &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. EMPLOYEE SELF-SERVICE DASHBOARD */}
      {/* ========================================================================= */}
      {role === 'EMPLOYEE' && (
        <div className="space-y-6">
          <div className="p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-[#2d1214] to-slate-950 text-white border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#a92427]/30 border border-[#a92427]/50 text-[#f8b4b4] text-xs font-semibold">
                  <span>{sessionUser?.department || 'Operations'} • {sessionUser?.designation || 'Specialist'}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                  Welcome, {sessionUser?.name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                  Your employee portal: check your daily attendance, place punch correction requests, apply for time-off, and view your monthly salary slips.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/leaves"
                  className="px-5 py-2.5 rounded-2xl bg-[#a92427] hover:bg-[#8e1d20] text-white text-xs font-bold shadow-lg shadow-[#a92427]/30 transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Apply For Leave</span>
                </Link>
                <button
                  onClick={() => setShowCorrectionModal(true)}
                  className="px-5 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-white text-xs font-bold transition flex items-center gap-2"
                >
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span>Request Time Correction</span>
                </button>
              </div>
            </div>
          </div>

          {/* Today's Punch Card */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${myCheckIn ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                <CalendarCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today&apos;s Biometric Punch</span>
                <div className="text-lg font-black text-slate-900">
                  {myCheckIn ? (
                    <span className="text-emerald-700">
                      Checked in at {format(new Date(myCheckIn.checkInTime), 'hh:mm a')} ({myCheckIn.status === 'ON_TIME' ? 'On Time' : 'Late'})
                    </span>
                  ) : (
                    <span className="text-slate-500">No Terminal Punch Recorded Today</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {myCheckIn
                    ? `Source: ${myCheckIn.deviceName || 'Main Terminal'}`
                    : 'Scan your RFID badge or fingerprint at the Secureye terminal upon arrival.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowCorrectionModal(true)}
              className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition"
            >
              Time Not Matching? Request Adjustment
            </button>
          </div>

          {/* Leave Quota Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">My Leave Balances</h3>
              <Link href="/leaves" className="text-xs font-bold text-[#a92427] hover:underline">
                View Full Leave Desk &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {leaveBalances.map((b) => (
                <div key={b.id} className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">{b.leaveType?.name || 'Leave'}</span>
                    <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-100 text-slate-700">
                      {b.leaveType?.code || 'LV'}
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900">
                    {b.balance} <span className="text-xs font-sans text-slate-400 font-normal">days left</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#a92427] rounded-full"
                      style={{ width: `${Math.min(100, (b.balance / 15) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* My Attendance Regularizations & Adjustment History */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>My Attendance Correction History</span>
                </h3>
                <p className="text-[11px] text-slate-400">Track the lifecycle of your submitted time adjustment requests</p>
              </div>

              <button
                onClick={() => {
                  setCorrectionForm({
                    date: format(new Date(), 'yyyy-MM-dd'),
                    adjustmentType: 'CHECK_IN',
                    requestedCheckIn: '09:00',
                    requestedCheckOut: '18:00',
                    reason: '',
                  });
                  setShowCorrectionModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Time Adjustment</span>
              </button>
            </div>

            {myRegularizations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-600">No Attendance Correction Requests</p>
                <p className="text-slate-400">If your biometric punch was missed or delayed by a hardware glitch, submit a correction here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Adjustment Scope</th>
                      <th className="py-3 px-4 font-mono">Requested Times</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Audit / Reviewer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myRegularizations.map((reg) => (
                      <tr key={reg.id || reg._id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          {format(new Date(reg.date), 'dd MMM yyyy')}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                            {reg.adjustmentType === 'CHECK_IN'
                              ? 'Check-In Only'
                              : reg.adjustmentType === 'CHECK_OUT'
                              ? 'Check-Out Only'
                              : 'Both (In & Out)'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                          {reg.requestedCheckIn && <span>In: <strong className="text-emerald-700">{reg.requestedCheckIn}</strong> </span>}
                          {reg.requestedCheckOut && <span>Out: <strong className="text-blue-700">{reg.requestedCheckOut}</strong></span>}
                        </td>
                        <td className="py-3.5 px-4 max-w-xs text-slate-600">
                          <div className="truncate" title={reg.reason}>{reg.reason}</div>
                          {reg.rejectionReason && (
                            <div className="text-[10px] text-rose-600 font-semibold mt-0.5">Note: {reg.rejectionReason}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {reg.status === 'APPROVED' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Approved & Active
                            </span>
                          )}
                          {reg.status === 'PENDING' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Pending Review
                            </span>
                          )}
                          {reg.status === 'REJECTED' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Rejected
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right text-[11px] text-slate-500">
                          {reg.reviewedBy ? (
                            <div>
                              <span className="font-semibold text-slate-700">{reg.reviewedBy}</span>
                              <div className="text-[9px] text-slate-400">
                                {reg.reviewedAt ? format(new Date(reg.reviewedAt), 'dd MMM, HH:mm') : ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Awaiting Manager</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Company Notices & Upcoming Holidays */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Notices */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-[#a92427]" />
                  <span>Company Notices</span>
                </h3>
                <Link href="/announcements" className="text-xs text-slate-400 hover:underline">
                  View all
                </Link>
              </div>

              {announcements.length === 0 ? (
                <p className="text-xs text-slate-400">No active notices.</p>
              ) : (
                <div className="space-y-3 text-xs">
                  {announcements.map((a) => (
                    <div key={a.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                      <div className="font-bold text-slate-900">{a.title}</div>
                      <p className="text-slate-600 text-[11px] line-clamp-2">{a.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Holidays */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span>Upcoming Public Holidays</span>
                </h3>
                <Link href="/holidays" className="text-xs text-slate-400 hover:underline">
                  View calendar
                </Link>
              </div>

              {holidays.length === 0 ? (
                <p className="text-xs text-slate-400">No upcoming public holidays.</p>
              ) : (
                <div className="space-y-3 text-xs">
                  {holidays.map((h) => (
                    <div key={h.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{h.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {h.date ? format(new Date(h.date), 'EEEE, dd MMM yyyy') : ''}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        {h.isOptional ? 'Optional' : 'Mandatory'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ATTENDANCE CORRECTION REQUEST MODAL (FOR EMPLOYEES) */}
      {/* ========================================================================= */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Request Punch Time Adjustment</span>
                </h3>
                <p className="text-[11px] text-slate-400">Select what needs adjustment: Check-in, Check-out, or both</p>
              </div>
              <button onClick={() => setShowCorrectionModal(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                &times;
              </button>
            </div>

            {correctionMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{correctionMsg}</span>
              </div>
            )}

            <form onSubmit={handleCorrectionSubmit} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Date of Punch *</label>
                <input
                  type="date"
                  value={correctionForm.date}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, date: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                />
              </div>

              {/* Adjustment Type Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">What needs adjustment? *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrectionForm({ ...correctionForm, adjustmentType: 'CHECK_IN' as any })}
                    className={`py-2 px-2.5 rounded-xl font-bold text-[11px] border transition text-center ${
                      correctionForm.adjustmentType === 'CHECK_IN'
                        ? 'bg-blue-50 border-blue-400 text-blue-800 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Check-In Only
                  </button>

                  <button
                    type="button"
                    onClick={() => setCorrectionForm({ ...correctionForm, adjustmentType: 'CHECK_OUT' as any })}
                    className={`py-2 px-2.5 rounded-xl font-bold text-[11px] border transition text-center ${
                      correctionForm.adjustmentType === 'CHECK_OUT'
                        ? 'bg-blue-50 border-blue-400 text-blue-800 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Check-Out Only
                  </button>

                  <button
                    type="button"
                    onClick={() => setCorrectionForm({ ...correctionForm, adjustmentType: 'BOTH' as any })}
                    className={`py-2 px-2.5 rounded-xl font-bold text-[11px] border transition text-center ${
                      correctionForm.adjustmentType === 'BOTH'
                        ? 'bg-blue-50 border-blue-400 text-blue-800 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Both In & Out
                  </button>
                </div>
              </div>

              {/* Time Inputs based on Selection */}
              <div className="grid grid-cols-2 gap-3">
                {(correctionForm.adjustmentType === 'CHECK_IN' || correctionForm.adjustmentType === 'BOTH') && (
                  <div className={correctionForm.adjustmentType === 'CHECK_IN' ? 'col-span-2' : 'col-span-1'}>
                    <label className="block font-bold text-slate-700 mb-1">Actual Check-In Time (IST) *</label>
                    <input
                      type="time"
                      value={correctionForm.requestedCheckIn}
                      onChange={(e) => setCorrectionForm({ ...correctionForm, requestedCheckIn: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900"
                    />
                  </div>
                )}

                {(correctionForm.adjustmentType === 'CHECK_OUT' || correctionForm.adjustmentType === 'BOTH') && (
                  <div className={correctionForm.adjustmentType === 'CHECK_OUT' ? 'col-span-2' : 'col-span-1'}>
                    <label className="block font-bold text-slate-700 mb-1">Actual Check-Out Time (IST) *</label>
                    <input
                      type="time"
                      value={correctionForm.requestedCheckOut}
                      onChange={(e) => setCorrectionForm({ ...correctionForm, requestedCheckOut: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Explanation Reason *</label>
                <textarea
                  rows={3}
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                  placeholder="e.g. Device sensor did not beep, attended early client discussion at 09:00 AM..."
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={correctionSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#a92427] hover:bg-[#8e1d20] text-white font-bold transition disabled:opacity-50"
                >
                  {correctionSubmitting ? 'Submitting...' : 'Submit to Manager'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
