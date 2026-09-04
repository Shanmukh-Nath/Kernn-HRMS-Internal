'use client';

import { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Users,
  UserCheck,
  UserX,
  Clock,
  Palmtree,
  Search,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
  Download,
  ArrowRight,
  Plus,
  Eye,
  Check,
  X,
  Radio,
  FileText,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpDown,
  ShieldAlert,
} from 'lucide-react';
import { format } from 'date-fns';
import { formatAppTime12, formatAppDate } from '@/lib/timezone';

const MONTH_NAMES = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const AVAILABLE_YEARS = [2024, 2025, 2026].filter((y) => y <= CURRENT_YEAR);

export default function DailyAttendancePage() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [data, setData] = useState<any>(null);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Month & Year Picker State (Dynamically defaults to current calendar month & year, capped to current date)
  const [selectedMonth, setSelectedMonth] = useState(() => CURRENT_MONTH);
  const [selectedYear, setSelectedYear] = useState(() => CURRENT_YEAR);

  // Admin View States
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [activeListTab, setActiveListTab] = useState<'PRESENT' | 'ON_LEAVE' | 'ABSENT'>('PRESENT');

  // Time Correction Modal State
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
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 4000);
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const json = await res.json();
      if (json.success && json.data?.user) {
        setCurrentUser(json.data.user);
      }
    } catch {
    } finally {
      setUserLoaded(true);
    }
  };

  const fetchDailyData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/today');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyMonthlyLedger = async (m: number, y: number) => {
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/attendance/my-ledger?month=${m}&year=${y}`);
      const json = await res.json();
      if (json.success) {
        setLedgerData(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchDailyData();

    const handleHrmsRefresh = () => {
      fetchDailyData();
      fetchMyMonthlyLedger(selectedMonth, selectedYear);
    };
    window.addEventListener('hrms-refresh', handleHrmsRefresh);
    return () => window.removeEventListener('hrms-refresh', handleHrmsRefresh);
  }, []);

  useEffect(() => {
    fetchMyMonthlyLedger(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => Math.max(2026, y - 1));
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedYear > CURRENT_YEAR || (selectedYear === CURRENT_YEAR && selectedMonth >= CURRENT_MONTH)) {
      return;
    }
    if (selectedMonth === 12) {
      if (selectedYear + 1 > CURRENT_YEAR) return;
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCorrectionSubmitting(true);
    try {
      const res = await fetch('/api/attendance/regularize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(correctionForm),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Time adjustment submitted to manager for approval!', 'success');
        setShowCorrectionModal(false);
        fetchDailyData();
        fetchMyMonthlyLedger(selectedMonth, selectedYear);
      } else {
        showToast(json.error?.message || 'Submission failed', 'error');
      }
    } catch {
      showToast('Network error submitting adjustment', 'error');
    } finally {
      setCorrectionSubmitting(false);
    }
  };

  const isEmployee = currentUser && (currentUser.role === 'EMPLOYEE' || !['SUPER_ADMIN', 'HR_ADMIN', 'ADMIN', 'MANAGER'].includes(currentUser.role || ''));

  const departments = Array.from(
    new Set([
      ...(data?.todayCheckIns?.map((e: any) => e.department) || []),
      ...(data?.todayOnLeave?.map((e: any) => e.department) || []),
      ...(data?.notYetArrived?.map((e: any) => e.department) || []),
    ])
  ).filter(Boolean);

  const filterList = (list: any[]) => {
    return (list || []).filter((item: any) => {
      const matchesSearch =
        !search ||
        item.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.employeeCode?.toLowerCase().includes(search.toLowerCase());
      const matchesDept = deptFilter === 'ALL' || item.department === deptFilter;
      return matchesSearch && matchesDept;
    });
  };

  const filteredCheckIns = filterList(data?.todayCheckIns || []);
  const filteredOnLeave = filterList(data?.todayOnLeave || []);
  const filteredNotArrived = filterList(data?.notYetArrived || []);

  const todayFormatted = format(new Date(), 'EEEE, dd MMMM yyyy');
  const myTodayRecord = data?.todayCheckIns?.[0] || null;

  if (!userLoaded) {
    return (
      <div className="flex items-center justify-center p-24 text-slate-400 text-xs">
        <RefreshCw className="w-6 h-6 animate-spin text-[#a92427] mr-2" />
        <span>Loading attendance portal...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn relative">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-50 animate-fadeIn">
          <div
            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-xs font-bold border ${
              toast.type === 'success'
                ? 'bg-emerald-900/95 text-emerald-100 border-emerald-500/30'
                : 'bg-rose-900/95 text-rose-100 border-rose-500/30'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast({ show: false, message: '', type: 'success' })}
              className="ml-2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. EMPLOYEE PERSONAL MONTHLY ATTENDANCE SUITE */}
      {/* ========================================================================= */}
      {isEmployee ? (
        <div className="space-y-6">
          {/* Top Header with Month & Year Picker */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-72 h-72 bg-[#a92427]/25 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Personal Attendance Suite
                </span>
                <span className="text-xs text-slate-400 font-mono">Today: {todayFormatted}</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight">
                My Attendance & Monthly Reports
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                Select any month to inspect date-wise punctuality, verified punch times, and manager regularizations.
              </p>
            </div>

            {/* Year & Month Picker Controls */}
            <div className="relative z-10 flex flex-wrap items-center gap-1.5 sm:gap-2 bg-slate-900/90 p-2 rounded-2xl border border-slate-700 shadow-lg">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#a92427]"
              >
                {MONTH_NAMES.map((m) => {
                  const isFutureMonth = selectedYear === CURRENT_YEAR && m.value > CURRENT_MONTH;
                  return (
                    <option key={m.value} value={m.value} disabled={isFutureMonth}>
                      {m.label} {isFutureMonth ? '(Upcoming)' : ''}
                    </option>
                  );
                })}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#a92427]"
              >
                {AVAILABLE_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <button
                onClick={handleNextMonth}
                disabled={selectedYear >= CURRENT_YEAR && selectedMonth >= CURRENT_MONTH}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

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
                className="ml-2 px-4 py-2 rounded-xl bg-[#a92427] hover:bg-[#8e1d20] text-white text-xs font-bold shadow-md transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Request Adjustment</span>
              </button>
            </div>
          </div>

          {/* Today's Live Duty Widget */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Clock className="w-6 h-6 text-[#a92427]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">Today&apos;s Status ({todayFormatted})</span>
                  {myTodayRecord?.status === 'REGULARIZED' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Regularized (Approved)
                    </span>
                  )}
                  {myTodayRecord?.status === 'ON_TIME' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      On Time
                    </span>
                  )}
                  {myTodayRecord?.status === 'LATE' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      Late Arrival
                    </span>
                  )}
                  {!myTodayRecord && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                      No Scan Recorded Yet
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  First In: <strong className="text-slate-800 font-mono">{myTodayRecord?.checkInTime ? formatAppTime12(myTodayRecord.checkInTime) : '--:--'}</strong> •
                  Last Out: <strong className="text-slate-800 font-mono">{myTodayRecord?.checkOutTime ? formatAppTime12(myTodayRecord.checkOutTime) : 'Active on Duty'}</strong> •
                  Shift: <strong>Day Shift (09:30 AM – 06:30 PM)</strong>
                </p>
              </div>
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
              className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition self-start sm:self-auto"
            >
              Time Incorrect? Adjust Today
            </button>
          </div>

          {/* Personal Monthly Attendance Statistics (NO Headcount!) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Days in Month</span>
              <div className="text-2xl font-black font-mono text-slate-900">
                {ledgerData?.ledger?.length || 0} <span className="text-xs font-sans text-slate-400 font-normal">days</span>
              </div>
              <div className="text-[10px] text-slate-500">
                {MONTH_NAMES.find((m) => m.value === selectedMonth)?.label} {selectedYear}
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Days Present</span>
              <div className="text-2xl font-black font-mono text-emerald-700">
                {ledgerData?.metrics?.presentCount || 0} <span className="text-xs font-sans text-slate-400 font-normal">days</span>
              </div>
              <div className="text-[10px] text-emerald-600 font-medium">
                {ledgerData?.metrics?.onTimeCount || 0} on-time arrivals
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Regularized</span>
              <div className="text-2xl font-black font-mono text-blue-700">
                {ledgerData?.metrics?.regularizedCount || 0} <span className="text-xs font-sans text-slate-400 font-normal">days</span>
              </div>
              <div className="text-[10px] text-blue-600 font-medium">
                Manager verified punches
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Approved Leaves</span>
              <div className="text-2xl font-black font-mono text-purple-700">
                {ledgerData?.metrics?.leavesCount || 0} <span className="text-xs font-sans text-slate-400 font-normal">days</span>
              </div>
              <div className="text-[10px] text-purple-600 font-medium">
                Authorized time off
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Total Work Hours</span>
              <div className="text-2xl font-black font-mono text-slate-900">
                {ledgerData?.metrics?.totalWorkHours || 0}h
              </div>
              <div className="text-[10px] text-slate-500">
                Avg: {ledgerData?.metrics?.averageDailyHours || 0}h/day
              </div>
            </div>
          </div>

          {/* Date-wise Detailed Attendance Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#a92427]" />
                  <span>Date-wise Attendance Ledger — {MONTH_NAMES.find((m) => m.value === selectedMonth)?.label} {selectedYear}</span>
                </h3>
                <p className="text-xs text-slate-400">Complete day-by-day record of punches, regularizations, and shift duration</p>
              </div>

              <div className="text-xs text-slate-500 font-mono">
                Employee: <strong>{currentUser.name}</strong> ({currentUser.employeeCode || 'EMP-005'})
              </div>
            </div>

            {ledgerLoading ? (
              <div className="p-16 text-center text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-[#a92427] mx-auto mb-2" />
                <span>Loading monthly attendance ledger...</span>
              </div>
            ) : (
              <div>
                {/* Mobile Attendance Day Cards (< md) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {ledgerData?.ledger?.map((row: any) => {
                    const dObj = new Date(row.date + 'T00:00:00');
                    const dayName = format(dObj, 'EEEE');
                    const isSunday = dObj.getDay() === 0;

                    return (
                      <div
                        key={`m-att-${row.date}`}
                        className={`p-4 space-y-2.5 bg-white ${isSunday ? 'bg-slate-50/50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {format(dObj, 'dd MMM yyyy')}
                            </span>
                            <span className="text-slate-400 text-[11px] ml-1.5 font-medium">({dayName})</span>
                          </div>

                          {row.status === 'REGULARIZED' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Regularized
                            </span>
                          )}
                          {row.status === 'ON_TIME' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              On Time
                            </span>
                          )}
                          {row.status === 'LATE' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Late Arrival
                            </span>
                          )}
                          {row.status === 'ON_LEAVE' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              {row.statusLabel}
                            </span>
                          )}
                          {row.status === 'WEEKLY_OFF' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                              Sunday Off
                            </span>
                          )}
                          {row.status === 'FUTURE' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-100">
                              Upcoming
                            </span>
                          )}
                          {row.status === 'ABSENT' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Missed Punch
                            </span>
                          )}
                        </div>

                        {/* Punch times grid */}
                        {!isSunday && row.status !== 'FUTURE' && (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">First In</span>
                              <span className="font-mono font-bold text-slate-800">
                                {row.firstIn ? formatAppTime12(row.firstIn) : '--:--'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Last Out</span>
                              <span className="font-mono font-bold text-slate-800">
                                {row.lastOut ? formatAppTime12(row.lastOut) : (row.firstIn ? 'Active' : '--:--')}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-semibold">Duration</span>
                              <span className="font-mono font-bold text-indigo-700">
                                {row.workingHours ? `${row.workingHours}h` : '--'}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Regularization details */}
                        {row.isRegularized && (
                          <div className="text-[11px] text-emerald-800 bg-emerald-50/70 p-2 rounded-lg border border-emerald-200/60 flex items-center justify-between">
                            <span>Adj: {row.regularizedIn} - {row.regularizedOut}</span>
                            {row.regularization?.reviewedBy && (
                              <span className="text-[10px] text-emerald-700">By {row.regularization.reviewedBy}</span>
                            )}
                          </div>
                        )}

                        {/* Fix punch button */}
                        {(row.status === 'ABSENT' || row.status === 'LATE') && !row.isRegularized && (
                          <button
                            onClick={() => {
                              setCorrectionForm({
                                date: row.date,
                                adjustmentType: 'CHECK_IN',
                                requestedCheckIn: '09:00',
                                requestedCheckOut: '18:00',
                                reason: '',
                              });
                              setShowCorrectionModal(true);
                            }}
                            className="w-full py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition"
                          >
                            Fix Punch / Request Correction
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Attendance Table (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-4 font-mono">Date</th>
                      <th className="py-3.5 px-4">Day</th>
                      <th className="py-3.5 px-4">Shift</th>
                      <th className="py-3.5 px-4 font-mono">First Check-In</th>
                      <th className="py-3.5 px-4 font-mono">Latest Check-Out</th>
                      <th className="py-3.5 px-4 font-mono">Work Hours</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4">Raw vs Adjusted</th>
                      <th className="py-3.5 px-4 text-right">Actions / Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgerData?.ledger?.map((row: any) => {
                      const dObj = new Date(row.date + 'T00:00:00');
                      const dayName = format(dObj, 'EEEE');
                      const isSunday = dObj.getDay() === 0;

                      return (
                        <tr key={row.date} className={`hover:bg-slate-50/80 transition ${isSunday ? 'bg-slate-50/40' : ''}`}>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {format(dObj, 'dd MMM yyyy')}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-600">
                            {dayName}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                            {isSunday ? 'Off' : '09:30 - 18:30'}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {row.firstIn ? formatAppTime12(row.firstIn) : '--'}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700">
                            {row.lastOut ? formatAppTime12(row.lastOut) : (row.firstIn ? 'Active on Duty' : '--')}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700 font-semibold">
                            {row.workingHours ? `${row.workingHours} hrs` : '--'}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {row.status === 'REGULARIZED' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                Regularized (Approved)
                              </span>
                            )}
                            {row.status === 'ON_TIME' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Present (On Time)
                              </span>
                            )}
                            {row.status === 'LATE' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Late Arrival
                              </span>
                            )}
                            {row.status === 'ON_LEAVE' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                {row.statusLabel}
                              </span>
                            )}
                            {row.status === 'WEEKLY_OFF' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                Weekly Off (Sunday)
                              </span>
                            )}
                            {row.status === 'FUTURE' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-100">
                                Upcoming
                              </span>
                            )}
                            {row.status === 'ABSENT' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Missed Punch
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-slate-500">
                            {row.isRegularized ? (
                              <div>
                                <span className="text-emerald-700 font-bold font-mono">
                                  Adj: {row.regularizedIn || '--'} - {row.regularizedOut || '--'}
                                </span>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Raw: {row.recordedIn ? formatAppTime12(row.recordedIn) : 'None'}
                                </div>
                              </div>
                            ) : row.recordedIn ? (
                              <span className="text-slate-400 font-mono">Hardware Scan</span>
                            ) : (
                              <span className="text-slate-300">--</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {row.isRegularized && row.regularization?.reviewedBy ? (
                              <div className="text-[10px] text-slate-500">
                                <span className="font-semibold text-slate-700">{row.regularization.reviewedBy}</span>
                                <div className="text-[9px] text-slate-400">Approved</div>
                              </div>
                            ) : (row.status === 'ABSENT' || row.status === 'LATE') ? (
                              <button
                                onClick={() => {
                                  setCorrectionForm({
                                    date: row.date,
                                    adjustmentType: 'CHECK_IN',
                                    requestedCheckIn: '09:00',
                                    requestedCheckOut: '18:00',
                                    reason: '',
                                  });
                                  setShowCorrectionModal(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] border border-blue-200 transition"
                              >
                                Fix Punch
                              </button>
                            ) : (
                              <span className="text-slate-300">--</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. SUPER ADMIN / MANAGER ROLL CALL VIEW */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Presence Feed
                </span>
                <span className="text-xs text-slate-400 font-mono">{todayFormatted}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <CalendarCheck className="w-6 h-6 sm:w-7 sm:h-7 text-[#a92427]" />
                Today&apos;s Attendance & Daily Roll Call
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Current date operational view: real-time check-ins, punctuality metrics, and staff on approved leave.
              </p>
            </div>

            <button
              onClick={fetchDailyData}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition disabled:opacity-50 active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Feed</span>
            </button>
          </div>

          {/* 4 Summary Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Headcount</span>
                <Users className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900">{data?.metrics?.totalActiveStaff || 0}</div>
              <div className="text-[9px] sm:text-[10px] text-slate-400">Scheduled active roster</div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Present on Duty</span>
                <UserCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-700">{data?.metrics?.presentCount || 0}</div>
              <div className="text-[9px] sm:text-[10px] text-emerald-600 font-medium">
                {data?.metrics?.presentCount - (data?.metrics?.lateCount || 0)} on time, {data?.metrics?.lateCount || 0} late
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Approved Leaves</span>
                <Palmtree className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-3xl font-black font-mono text-blue-700">{data?.metrics?.onLeaveCount || 0}</div>
              <div className="text-[10px] text-blue-600 font-medium">Authorized absence</div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Awaiting Punch</span>
                <UserX className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-3xl font-black font-mono text-rose-700">{data?.metrics?.notYetArrivedCount || 0}</div>
              <div className="text-[10px] text-rose-600 font-medium">No check-in detected</div>
            </div>
          </div>

          {/* Tab Controls & Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto max-w-full">
              <button
                onClick={() => setActiveListTab('PRESENT')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap ${
                  activeListTab === 'PRESENT'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Present Staff</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${activeListTab === 'PRESENT' ? 'bg-[#a92427] text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {data?.todayCheckIns?.length || 0}
                </span>
              </button>

              <button
                onClick={() => setActiveListTab('ON_LEAVE')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap ${
                  activeListTab === 'ON_LEAVE'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Palmtree className="w-3.5 h-3.5 text-blue-600" />
                <span>On Leave</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${activeListTab === 'ON_LEAVE' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {data?.todayOnLeave?.length || 0}
                </span>
              </button>

              <button
                onClick={() => setActiveListTab('ABSENT')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap ${
                  activeListTab === 'ABSENT'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserX className="w-3.5 h-3.5 text-rose-500" />
                <span>Awaiting Check-in</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${activeListTab === 'ABSENT' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {data?.notYetArrived?.length || 0}
                </span>
              </button>
            </div>

            {/* Search & Department Selector */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search staff or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
                />
              </div>

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d: any) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-16 text-center text-slate-400 text-xs">Loading real-time attendance roll call...</div>
            ) : (
              <div>
                {/* TAB 1: PRESENT STAFF */}
                {activeListTab === 'PRESENT' && (
                  <div>
                    {filteredCheckIns.length === 0 ? (
                      <div className="p-16 text-center text-slate-400 text-xs space-y-2">
                        <UserCheck className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="font-bold text-slate-700">No Check-in Punches Recorded Today</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                              <th className="py-4 px-6">Employee</th>
                              <th className="py-4 px-6">Department & Role</th>
                              <th className="py-4 px-6 font-mono">First Check-In (IST)</th>
                              <th className="py-4 px-6 font-mono">Latest Check-Out (IST)</th>
                              <th className="py-4 px-6 text-center">Status</th>
                              <th className="py-4 px-6">Terminal Device</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredCheckIns.map((emp: any) => (
                              <tr key={emp.employeeId} className="hover:bg-slate-50/80 transition">
                                <td className="py-4 px-6">
                                  <div className="font-bold text-slate-900">{emp.name}</div>
                                  <div className="text-[11px] text-slate-400 font-mono">{emp.employeeCode}</div>
                                </td>
                                <td className="py-4 px-6">
                                  <div className="text-slate-700 font-medium">{emp.department}</div>
                                  <div className="text-[11px] text-slate-400">{emp.designation}</div>
                                </td>
                                <td className="py-4 px-6 font-mono font-bold text-slate-900">
                                  {emp.checkInTime ? formatAppTime12(emp.checkInTime) : '--'}
                                </td>
                                <td className="py-4 px-6 font-mono text-slate-600">
                                  {emp.checkOutTime ? formatAppTime12(emp.checkOutTime) : '--'}
                                </td>
                                <td className="py-4 px-6 text-center whitespace-nowrap">
                                  {emp.status === 'REGULARIZED' ? (
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                      Regularized (Approved)
                                    </span>
                                  ) : emp.status === 'ON_TIME' ? (
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      On Time
                                    </span>
                                  ) : (
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                      Late Arrival
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 px-6 text-slate-500 font-mono text-[11px]">
                                  {emp.deviceName || 'Secureye S-FB3K'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: ON LEAVE TODAY */}
                {activeListTab === 'ON_LEAVE' && (
                  <div>
                    {filteredOnLeave.length === 0 ? (
                      <div className="p-16 text-center text-slate-400 text-xs space-y-2">
                        <Palmtree className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="font-bold text-slate-700">No Staff on Leave Today</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                              <th className="py-4 px-6">Employee</th>
                              <th className="py-4 px-6">Department</th>
                              <th className="py-4 px-6">Leave Type</th>
                              <th className="py-4 px-6">Duration</th>
                              <th className="py-4 px-6">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredOnLeave.map((emp: any) => (
                              <tr key={emp.employeeId} className="hover:bg-slate-50/80 transition">
                                <td className="py-4 px-6">
                                  <div className="font-bold text-slate-900">{emp.name}</div>
                                  <div className="text-[11px] text-slate-400 font-mono">{emp.employeeCode}</div>
                                </td>
                                <td className="py-4 px-6 text-slate-600">{emp.department}</td>
                                <td className="py-4 px-6">
                                  <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    {emp.leaveTypeName}
                                  </span>
                                </td>
                                <td className="py-4 px-6 font-mono text-slate-600">
                                  {emp.startDate ? format(new Date(emp.startDate), 'dd MMM') : ''} - {emp.endDate ? format(new Date(emp.endDate), 'dd MMM yyyy') : ''}
                                </td>
                                <td className="py-4 px-6 text-slate-500 max-w-xs truncate">{emp.reason || 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: AWAITING CHECK-IN */}
                {activeListTab === 'ABSENT' && (
                  <div>
                    {filteredNotArrived.length === 0 ? (
                      <div className="p-16 text-center text-slate-400 text-xs space-y-2">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                        <p className="font-bold text-slate-700">All Scheduled Staff Checked In!</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                              <th className="py-4 px-6">Employee</th>
                              <th className="py-4 px-6">Department & Role</th>
                              <th className="py-4 px-6">Expected Shift</th>
                              <th className="py-4 px-6 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredNotArrived.map((emp: any) => (
                              <tr key={emp.employeeId} className="hover:bg-slate-50/80 transition">
                                <td className="py-4 px-6">
                                  <div className="font-bold text-slate-900">{emp.name}</div>
                                  <div className="text-[11px] text-slate-400 font-mono">{emp.employeeCode}</div>
                                </td>
                                <td className="py-4 px-6">
                                  <div className="text-slate-700 font-medium">{emp.department}</div>
                                  <div className="text-[11px] text-slate-400">{emp.designation}</div>
                                </td>
                                <td className="py-4 px-6 text-slate-600 font-mono">
                                  Day Shift (09:30 AM – 06:30 PM)
                                </td>
                                <td className="py-4 px-6 text-center whitespace-nowrap">
                                  <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    No Punch Detected
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ATTENDANCE CORRECTION REQUEST MODAL */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* ATTENDANCE CORRECTION REQUEST MODAL */}
      {/* ========================================================================= */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3.5 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="bg-white border border-slate-200/90 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-scaleUp text-xs my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-950 via-[#1c1d24] to-slate-950 text-white p-5 sm:p-6 relative border-b border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-inner shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Attendance Regularization
                      </span>
                      <span className="text-slate-400 text-[10px]">•</span>
                      <span className="text-slate-300 text-[10px] font-mono">IST (UTC+05:30)</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                      Request Punch Time Adjustment
                    </h3>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Submit missing or corrected punch logs for manager approval.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/60 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <form onSubmit={handleCorrectionSubmit} className="space-y-4">
                {/* Date of Punch */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                    <span>Date of Missed / Incorrect Punch *</span>
                    <span className="text-[11px] font-normal text-slate-400">YYYY-MM-DD</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={correctionForm.date}
                      onChange={(e) => setCorrectionForm({ ...correctionForm, date: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition outline-hidden"
                    />
                  </div>
                </div>

                {/* Adjustment Type Segmented Selector */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">
                    What needs adjustment? *
                  </label>
                  <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => setCorrectionForm({ ...correctionForm, adjustmentType: 'CHECK_IN' })}
                      className={`py-2 px-2 rounded-xl font-bold text-[11px] transition flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                        correctionForm.adjustmentType === 'CHECK_IN'
                          ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      <span>Check-In Only</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCorrectionForm({ ...correctionForm, adjustmentType: 'CHECK_OUT' })}
                      className={`py-2 px-2 rounded-xl font-bold text-[11px] transition flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                        correctionForm.adjustmentType === 'CHECK_OUT'
                          ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <ArrowUpFromLine className="w-3.5 h-3.5" />
                      <span>Check-Out Only</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCorrectionForm({ ...correctionForm, adjustmentType: 'BOTH' })}
                      className={`py-2 px-2 rounded-xl font-bold text-[11px] transition flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                        correctionForm.adjustmentType === 'BOTH'
                          ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span>Both In & Out</span>
                    </button>
                  </div>
                </div>

                {/* Time Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(correctionForm.adjustmentType === 'CHECK_IN' || correctionForm.adjustmentType === 'BOTH') && (
                    <div className={correctionForm.adjustmentType === 'CHECK_IN' ? 'sm:col-span-2' : 'sm:col-span-1'}>
                      <label className="block font-bold text-slate-800 mb-1">
                        Actual Check-In Time (IST) *
                      </label>
                      <div className="relative">
                        <input
                          type="time"
                          value={correctionForm.requestedCheckIn}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, requestedCheckIn: e.target.value })}
                          required
                          className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 text-xs focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition outline-hidden"
                        />
                      </div>
                    </div>
                  )}

                  {(correctionForm.adjustmentType === 'CHECK_OUT' || correctionForm.adjustmentType === 'BOTH') && (
                    <div className={correctionForm.adjustmentType === 'CHECK_OUT' ? 'sm:col-span-2' : 'sm:col-span-1'}>
                      <label className="block font-bold text-slate-800 mb-1">
                        Actual Check-Out Time (IST) *
                      </label>
                      <div className="relative">
                        <input
                          type="time"
                          value={correctionForm.requestedCheckOut}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, requestedCheckOut: e.target.value })}
                          required
                          className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 text-xs focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition outline-hidden"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Reason & Quick Suggestion Chips */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-800">
                      Reason / Justification *
                    </label>
                    <span className="text-[10px] text-slate-400">Click quick reason below:</span>
                  </div>

                  {/* Quick Reason Suggestions */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[
                      'Terminal scanner did not beep',
                      'Attended early client meeting on site',
                      'Extended client deployment handover',
                      'Official field duty travel',
                    ].map((reasonText) => (
                      <button
                        key={reasonText}
                        type="button"
                        onClick={() => setCorrectionForm({ ...correctionForm, reason: reasonText })}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 hover:border-blue-300 transition active:scale-95"
                      >
                        + {reasonText}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={3}
                    value={correctionForm.reason}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                    placeholder="Provide a detailed operational justification for this punch time adjustment..."
                    required
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition outline-hidden"
                  />
                </div>

                {/* Security Audit Footnote */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5 text-[11px] text-slate-500">
                  <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    This adjustment will be cryptographically signed with your IP & device telemetry and routed to your reporting supervisor.
                  </span>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCorrectionModal(false)}
                    className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition active:scale-95"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={correctionSubmitting}
                    className="px-6 py-2.5 rounded-2xl bg-[#a92427] hover:bg-[#8e1d20] text-white font-bold transition shadow-md shadow-[#a92427]/20 disabled:opacity-50 active:scale-95 flex items-center gap-2"
                  >
                    {correctionSubmitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Submitting Request...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit for Manager Approval</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
