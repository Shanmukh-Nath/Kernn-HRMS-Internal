'use client';

import { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Coffee,
  Eye,
  RefreshCw,
  Sparkles,
  Users,
  Palmtree,
  DollarSign,
  ShieldAlert,
  ArrowUpDown,
  Building2,
  Printer,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { format, subDays, startOfWeek, startOfMonth } from 'date-fns';

type ReportTab = 'attendance' | 'employees' | 'leaves' | 'payroll' | 'violations';

export default function UniversalReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('attendance');
  const [records, setRecords] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Drilldown modal
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('type', activeTab);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (search) params.set('search', search);
      if (department && department !== 'ALL') params.set('department', department);
      if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await fetch(`/api/reports/universal?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setRecords(json.data.records || []);
        setKpis(json.data.kpis || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [activeTab, startDate, endDate, department, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReports();
  };

  const applyPreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
    const today = new Date();
    if (preset === 'today') {
      const s = format(today, 'yyyy-MM-dd');
      setStartDate(s);
      setEndDate(s);
    } else if (preset === 'yesterday') {
      const s = format(subDays(today, 1), 'yyyy-MM-dd');
      setStartDate(s);
      setEndDate(s);
    } else if (preset === 'week') {
      setStartDate(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    } else if (preset === 'month') {
      setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // Universal CSV Export
  const handleExportCsv = () => {
    if (records.length === 0) {
      alert('No data available to export.');
      return;
    }

    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `kernn_${activeTab}_report_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;

    if (activeTab === 'attendance') {
      headers = ['Date', 'Employee Name', 'Employee Code', 'Department', 'First Check-In', 'Last Check-Out', 'Net Work Hours', 'Late Status', 'Early Exit', 'Daily Status'];
      rows = records.map((r) => [
        r.date,
        `"${r.employee?.name || ''}"`,
        r.employee?.code || '',
        `"${r.employee?.department || 'General'}"`,
        r.firstCheckIn?.time || 'N/A',
        r.lastCheckOut?.time || 'N/A',
        (r.netWorkMinutes / 60).toFixed(2),
        r.isLate ? `Late (${r.lateMinutes}m)` : 'On-Time',
        r.isEarlyExit ? `Early Exit (${r.earlyExitMinutes}m)` : 'Normal',
        r.status,
      ]);
    } else if (activeTab === 'employees') {
      headers = ['Employee ID', 'Name', 'Employee Code', 'Department', 'Designation', 'Mobile', 'Email', 'Device ID', 'Status', 'Base Salary', 'Gross Pay'];
      rows = records.map((e) => [
        e.id,
        `"${e.name}"`,
        e.employeeCode || '',
        `"${e.department}"`,
        `"${e.designation}"`,
        e.userMobile || '',
        e.userEmail || '',
        e.deviceUserId || 'Not Enrolled',
        e.status,
        String(e.baseSalary || 0),
        String((e.baseSalary || 0) + (e.hra || 0) + (e.allowances || 0)),
      ]);
    } else if (activeTab === 'leaves') {
      headers = ['Request ID', 'Employee Name', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Reason', 'Status', 'Applied At'];
      rows = records.map((l) => [
        l.id,
        `"${l.employeeName}"`,
        `"${l.employeeDept || ''}"`,
        l.leaveTypeName,
        l.startDate,
        l.endDate,
        String(l.days),
        `"${(l.reason || '').replace(/"/g, '""')}"`,
        l.status,
        l.createdAt,
      ]);
    } else if (activeTab === 'payroll') {
      headers = ['Period', 'Employee Code', 'Employee Name', 'Department', 'Gross Salary', 'Basic', 'HRA', 'Allowances', 'PF (12%)', 'ESI (0.75%)', 'PT', 'LOP Deduction', 'Net Payout', 'Status'];
      rows = records.map((p) => [
        `${p.month}/${p.year}`,
        p.employeeCode || '',
        `"${p.employeeName}"`,
        `"${p.employeeDept || ''}"`,
        String(p.grossSalary || 0),
        String(p.baseSalary || 0),
        String(p.hra || 0),
        String(p.allowances || 0),
        String(p.pfDeduction || 0),
        String(p.esiDeduction || 0),
        String(p.ptDeduction || 0),
        String(p.lopDeduction || 0),
        String(p.netSalary || 0),
        p.status || 'PROCESSED',
      ]);
    } else if (activeTab === 'violations') {
      headers = ['Date', 'Employee Name', 'Department', 'Violation Type', 'First Punch', 'Last Punch', 'Net Work Hours'];
      rows = records.map((v) => [
        v.date,
        `"${v.employee?.name || ''}"`,
        `"${v.employee?.department || ''}"`,
        v.isLate && v.isEarlyExit ? 'LATE & EARLY EXIT' : v.isLate ? 'LATE ARRIVAL' : v.isEarlyExit ? 'EARLY EXIT' : 'SINGLE PUNCH',
        v.firstCheckIn?.time || 'N/A',
        v.lastCheckOut?.time || 'N/A',
        v.netWorkHours,
      ]);
    }

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fixed Non-Wrapping Status Badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return (
          <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 text-xs font-bold rounded-full min-w-[95px] bg-emerald-50 text-emerald-700 border border-emerald-200">
            Present
          </span>
        );
      case 'LATE':
        return (
          <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 text-xs font-bold rounded-full min-w-[95px] bg-amber-50 text-amber-700 border border-amber-200">
            Late Arrival
          </span>
        );
      case 'HALF_DAY':
        return (
          <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 text-xs font-bold rounded-full min-w-[95px] bg-yellow-50 text-yellow-700 border border-yellow-200">
            Half Day
          </span>
        );
      case 'SINGLE_PUNCH':
        return (
          <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 text-xs font-bold rounded-full min-w-[95px] bg-purple-50 text-purple-700 border border-purple-200">
            Single Punch
          </span>
        );
      case 'ABSENT':
        return (
          <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 text-xs font-bold rounded-full min-w-[95px] bg-rose-50 text-rose-700 border border-rose-200">
            Absent
          </span>
        );
      case 'APPROVED':
        return (
          <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 text-xs font-bold rounded-full min-w-[95px] bg-emerald-50 text-emerald-700 border border-emerald-200">
            Approved
          </span>
        );
      case 'PENDING':
        return (
          <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 text-xs font-bold rounded-full min-w-[95px] bg-amber-50 text-amber-700 border border-amber-200">
            Pending
          </span>
        );
      case 'REJECTED':
        return (
          <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 text-xs font-bold rounded-full min-w-[95px] bg-rose-50 text-rose-700 border border-rose-200">
            Rejected
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 text-xs font-bold rounded-full min-w-[95px] bg-emerald-50 text-emerald-700 border border-emerald-200">
            Active
          </span>
        );
      default:
        return (
          <span className="whitespace-nowrap inline-flex items-center justify-center px-3 py-1 text-xs font-bold rounded-full min-w-[95px] bg-slate-100 text-slate-700 border border-slate-200">
            {status || 'Recorded'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#a92427]/10 text-[#a92427] border border-[#a92427]/20">
              Kernn Analytics Hub
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="w-7 h-7 text-[#a92427]" />
            Universal HRMS Intelligence Reports
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Generate, filter, and audit reports across Attendance, Headcount, Leave Quotas, Payroll Registers, and Shift Violations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={fetchReports}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition shadow-2xs"
            title="Print Report"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#a92427] hover:bg-[#8e1d20] text-white text-xs font-bold rounded-xl shadow-sm transition shadow-[#a92427]/20"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Report Module Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        {[
          { id: 'attendance', label: 'Attendance & Timesheets', icon: Clock },
          { id: 'employees', label: 'Employee Master Register', icon: Users },
          { id: 'leaves', label: 'Leave & Balances Audit', icon: Palmtree },
          { id: 'payroll', label: 'Statutory Payroll Register', icon: DollarSign },
          { id: 'violations', label: 'Shift Violations & Lates', icon: ShieldAlert },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as ReportTab);
                setStatusFilter('ALL');
              }}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#f87171]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Context-Aware KPI Summary Cards */}
      {activeTab === 'attendance' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Days Logged</span>
            <div className="text-2xl font-black text-slate-900 font-mono">{kpis.totalDays || 0}</div>
            <span className="text-[10px] text-slate-500 font-medium">Distinct shifts</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Present</span>
            <div className="text-2xl font-black text-emerald-700 font-mono">{kpis.presentCount || 0}</div>
            <span className="text-[10px] text-emerald-600 font-medium">Fulfilled work</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Late Arrivals</span>
            <div className="text-2xl font-black text-amber-700 font-mono">{kpis.lateCount || 0}</div>
            <span className="text-[10px] text-amber-600 font-medium">Past grace period</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-yellow-600 uppercase tracking-wider">Early Exits</span>
            <div className="text-2xl font-black text-yellow-700 font-mono">{kpis.earlyExitCount || 0}</div>
            <span className="text-[10px] text-yellow-600 font-medium">Left before cutoff</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Total Work</span>
            <div className="text-2xl font-black text-purple-700 font-mono">{kpis.totalWorkHours || 0}h</div>
            <span className="text-[10px] text-purple-600 font-medium">Cumulative net hours</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-[#a92427] uppercase tracking-wider">Punctuality</span>
            <div className="text-2xl font-black text-[#a92427] font-mono">{kpis.onTimeRate || 100}%</div>
            <span className="text-[10px] text-slate-500 font-medium">On-time ratio</span>
          </div>
        </div>
      )}

      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Headcount</span>
            <div className="text-2xl font-black text-slate-900 font-mono">{kpis.totalEmployees || 0}</div>
            <span className="text-[10px] text-emerald-600 font-medium">Registered personnel</span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Active Staff</span>
            <div className="text-2xl font-black text-emerald-700 font-mono">{kpis.activeCount || 0}</div>
            <span className="text-[10px] text-slate-500 font-medium">Active contract status</span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Hardware Enrolled</span>
            <div className="text-2xl font-black text-blue-700 font-mono">{kpis.enrolledCount || 0}</div>
            <span className="text-[10px] text-blue-600 font-medium">Biometric ID configured</span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-[#a92427] uppercase tracking-wider">Monthly Base Payroll</span>
            <div className="text-2xl font-black text-[#a92427] font-mono">₹{(kpis.totalSalaryBudget || 0).toLocaleString('en-IN')}</div>
            <span className="text-[10px] text-slate-500 font-medium">Total payroll liability</span>
          </div>
        </div>
      )}

      {activeTab === 'leaves' && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Requests</span>
            <div className="text-2xl font-black text-slate-900 font-mono">{kpis.totalRequests || 0}</div>
            <span className="text-[10px] text-slate-500 font-medium">Recorded applications</span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Pending Action</span>
            <div className="text-2xl font-black text-amber-700 font-mono">{kpis.pendingCount || 0}</div>
            <span className="text-[10px] text-amber-600 font-medium">Awaiting supervisor review</span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Approved Leaves</span>
            <div className="text-2xl font-black text-emerald-700 font-mono">{kpis.approvedCount || 0}</div>
            <span className="text-[10px] text-emerald-600 font-medium">Sanctioned time-off</span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Days Consumed</span>
            <div className="text-2xl font-black text-blue-700 font-mono">{kpis.totalDaysTaken || 0} Days</div>
            <span className="text-[10px] text-slate-500 font-medium">Approved time-off days</span>
          </div>
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Total Net Disbursed</span>
            <div className="text-2xl font-black text-emerald-700 font-mono">₹{(kpis.totalNetPayout || 0).toLocaleString('en-IN')}</div>
            <span className="text-[10px] text-slate-500 font-medium">Direct salary payout</span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Provident Fund (12%)</span>
            <div className="text-2xl font-black text-blue-700 font-mono">₹{(kpis.totalPfDeduction || 0).toLocaleString('en-IN')}</div>
            <span className="text-[10px] text-slate-500 font-medium">Statutory EPFO deposit</span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">ESIC Medical Fund</span>
            <div className="text-2xl font-black text-purple-700 font-mono">₹{(kpis.totalEsiDeduction || 0).toLocaleString('en-IN')}</div>
            <span className="text-[10px] text-slate-500 font-medium">Statutory insurance</span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">LOP Penalties</span>
            <div className="text-2xl font-black text-rose-700 font-mono">₹{(kpis.totalLopDeduction || 0).toLocaleString('en-IN')}</div>
            <span className="text-[10px] text-rose-600 font-medium">Loss of Pay deductions</span>
          </div>
        </div>
      )}

      {activeTab === 'violations' && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Total Breaches</span>
            <div className="text-2xl font-black text-rose-700 font-mono">{kpis.totalViolations || 0}</div>
            <span className="text-[10px] text-slate-500 font-medium">Shift discipline flags</span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Late Arrivals</span>
            <div className="text-2xl font-black text-amber-700 font-mono">{kpis.lateCount || 0}</div>
            <span className="text-[10px] text-amber-600 font-medium">Past grace window</span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-yellow-600 uppercase tracking-wider">Early Exits</span>
            <div className="text-2xl font-black text-yellow-700 font-mono">{kpis.earlyCount || 0}</div>
            <span className="text-[10px] text-yellow-600 font-medium">Left before work end</span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Single Punches</span>
            <div className="text-2xl font-black text-purple-700 font-mono">{kpis.singleCount || 0}</div>
            <span className="text-[10px] text-purple-600 font-medium">Missing checkout</span>
          </div>
        </div>
      )}

      {/* Unified Filter Ribbon */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 space-y-4">
        {/* Presets and Dates */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-2xl text-xs font-bold text-slate-600">
            <button
              onClick={() => applyPreset('all')}
              className={`px-3 py-1.5 rounded-xl transition ${!startDate && !endDate ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
            >
              All Time
            </button>
            <button
              onClick={() => applyPreset('today')}
              className={`px-3 py-1.5 rounded-xl transition ${startDate === format(new Date(), 'yyyy-MM-dd') ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
            >
              Today
            </button>
            <button
              onClick={() => applyPreset('yesterday')}
              className={`px-3 py-1.5 rounded-xl transition hover:text-slate-900`}
            >
              Yesterday
            </button>
            <button
              onClick={() => applyPreset('week')}
              className={`px-3 py-1.5 rounded-xl transition hover:text-slate-900`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => applyPreset('month')}
              className={`px-3 py-1.5 rounded-xl transition hover:text-slate-900`}
            >
              This Month
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="date"
              value={startDate}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-800 bg-slate-50/60 focus:ring-2 focus:ring-[#a92427] focus:outline-none font-mono"
            />
            <span className="text-slate-400 font-normal">to</span>
            <input
              type="date"
              value={endDate}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-800 bg-slate-50/60 focus:ring-2 focus:ring-[#a92427] focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Search, Department, and Status Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by employee name, ID, department, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50/60 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-[#a92427] focus:bg-white focus:outline-none transition"
            />
          </form>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/60 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
            >
              <option value="ALL">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Operations">Operations</option>
              <option value="Sales & Marketing">Sales & Marketing</option>
              <option value="Finance & Accounts">Finance & Accounts</option>
              <option value="HR & Admin">HR & Admin</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/60 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late Arrival</option>
              <option value="SINGLE_PUNCH">Single Punch</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ABSENT">Absent</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Tabular Data Register */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#a92427] animate-spin mx-auto" />
            <div className="text-xs font-bold text-slate-500">Loading {activeTab.toUpperCase()} report records...</div>
          </div>
        ) : records.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-700">No matching records found</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try adjusting your date range, search query, or department filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* 1. ATTENDANCE TABLE */}
            {activeTab === 'attendance' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6">Employee</th>
                    <th className="py-4 px-6">First Check-In</th>
                    <th className="py-4 px-6">Last Check-Out</th>
                    <th className="py-4 px-6">Breaks</th>
                    <th className="py-4 px-6 text-center">Net Working Time</th>
                    <th className="py-4 px-6 text-center">Daily Status</th>
                    <th className="py-4 px-6 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {records.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition group">
                      <td className="py-4 px-6 font-bold text-slate-900 whitespace-nowrap">
                        {format(new Date(r.date), 'dd MMM yyyy')}
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900">{r.employee?.name || `User #${r.deviceUserId}`}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {r.employee?.code || `#${r.deviceUserId}`} • {r.employee?.department || 'General'}
                        </div>
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        {r.firstCheckIn ? (
                          <div>
                            <div className="font-bold text-slate-900">{r.firstCheckIn.time}</div>
                            <div className="text-[10px] text-slate-400 uppercase font-mono">
                              {r.firstCheckIn.verificationType}
                              {r.isLate && <span className="ml-1 text-rose-600 font-bold">(&gt;{r.lateMinutes}m late)</span>}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        {r.lastCheckOut ? (
                          <div>
                            <div className="font-bold text-slate-900">{r.lastCheckOut.time}</div>
                            <div className="text-[10px] text-slate-400 uppercase font-mono">
                              {r.lastCheckOut.verificationType}
                              {r.isEarlyExit && <span className="ml-1 text-amber-600 font-bold">({r.earlyExitMinutes}m early)</span>}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        {r.breaks && r.breaks.length > 0 ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200/80">
                            <Coffee className="w-3 h-3 text-amber-600" />
                            <span>{r.breaks.length} Break ({r.totalBreakMinutes}m)</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No Breaks</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        <div className="font-black text-slate-900 font-mono text-sm">
                          {(r.netWorkMinutes / 60).toFixed(1)} hrs
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {r.punches?.length || 1} punches logged
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        {getStatusBadge(r.status)}
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedRecord(r)}
                          className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
                          title="View Punch Timeline"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 2. EMPLOYEE MASTER TABLE */}
            {activeTab === 'employees' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-4 px-6">Code</th>
                    <th className="py-4 px-6">Employee Name</th>
                    <th className="py-4 px-6">Department</th>
                    <th className="py-4 px-6">Designation</th>
                    <th className="py-4 px-6">Contact Details</th>
                    <th className="py-4 px-6 text-center">Biometric Terminal ID</th>
                    <th className="py-4 px-6 text-right">Compensation</th>
                    <th className="py-4 px-6 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {records.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-4 px-6 font-mono font-bold text-slate-800">{emp.employeeCode || '—'}</td>
                      <td className="py-4 px-6 font-bold text-slate-900">{emp.name}</td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {emp.department}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-600">{emp.designation}</td>
                      <td className="py-4 px-6 font-mono text-[11px] text-slate-500">
                        <div>{emp.userMobile || emp.mobileNumber || 'N/A'}</div>
                        <div className="text-slate-400">{emp.userEmail || emp.email || ''}</div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {emp.deviceUserId ? (
                          <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-mono font-bold text-xs border border-blue-200">
                            #{emp.deviceUserId}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right font-mono font-bold text-slate-900">
                        ₹{((emp.baseSalary || 0) + (emp.hra || 0) + (emp.allowances || 0)).toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {getStatusBadge(emp.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 3. LEAVE TABLE */}
            {activeTab === 'leaves' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-4 px-6">Employee</th>
                    <th className="py-4 px-6">Department</th>
                    <th className="py-4 px-6">Leave Category</th>
                    <th className="py-4 px-6">Duration Range</th>
                    <th className="py-4 px-6 text-center">Days</th>
                    <th className="py-4 px-6">Reason Given</th>
                    <th className="py-4 px-6 text-center">Approval Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {records.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-4 px-6 font-bold text-slate-900">{l.employeeName}</td>
                      <td className="py-4 px-6 text-slate-600">{l.employeeDept || 'General'}</td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 font-bold text-xs border border-purple-200">
                          {l.leaveTypeName} ({l.leaveTypeCode})
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-[11px] text-slate-600">
                        {l.startDate} to {l.endDate}
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-slate-900 font-mono">
                        {l.days} Day{l.days > 1 ? 's' : ''}
                      </td>
                      <td className="py-4 px-6 text-slate-500 max-w-xs truncate">{l.reason}</td>
                      <td className="py-4 px-6 text-center">
                        {getStatusBadge(l.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 4. PAYROLL TABLE */}
            {activeTab === 'payroll' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-4 px-6">Month / Year</th>
                    <th className="py-4 px-6">Employee</th>
                    <th className="py-4 px-6 text-right">Gross Salary</th>
                    <th className="py-4 px-6 text-right">PF (12%)</th>
                    <th className="py-4 px-6 text-right">ESI (0.75%)</th>
                    <th className="py-4 px-6 text-right">Prof Tax</th>
                    <th className="py-4 px-6 text-right">LOP Deduction</th>
                    <th className="py-4 px-6 text-right">Net Payout</th>
                    <th className="py-4 px-6 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-mono">
                  {records.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-4 px-6 font-bold text-slate-800">
                        {p.month}/{p.year}
                      </td>
                      <td className="py-4 px-6 font-sans">
                        <div className="font-bold text-slate-900">{p.employeeName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{p.employeeCode} • {p.employeeDept}</div>
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-slate-800">₹{(p.grossSalary || 0).toLocaleString('en-IN')}</td>
                      <td className="py-4 px-6 text-right text-slate-600">₹{(p.pfDeduction || 0).toLocaleString('en-IN')}</td>
                      <td className="py-4 px-6 text-right text-slate-600">₹{(p.esiDeduction || 0).toLocaleString('en-IN')}</td>
                      <td className="py-4 px-6 text-right text-slate-600">₹{(p.ptDeduction || 0).toLocaleString('en-IN')}</td>
                      <td className="py-4 px-6 text-right text-rose-600 font-bold">₹{(p.lopDeduction || 0).toLocaleString('en-IN')}</td>
                      <td className="py-4 px-6 text-right font-black text-emerald-700 text-sm">
                        ₹{(p.netSalary || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-6 text-center font-sans">
                        <span className="whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Disbursed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 5. VIOLATIONS TABLE */}
            {activeTab === 'violations' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6">Employee</th>
                    <th className="py-4 px-6">Violation Type</th>
                    <th className="py-4 px-6">First Check-In</th>
                    <th className="py-4 px-6">Last Check-Out</th>
                    <th className="py-4 px-6 text-center">Net Working Hours</th>
                    <th className="py-4 px-6 text-center">Action Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {records.map((v, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-4 px-6 font-bold text-slate-900 whitespace-nowrap">
                        {format(new Date(v.date), 'dd MMM yyyy')}
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900">{v.employee?.name || `User #${v.deviceUserId}`}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {v.employee?.code || `#${v.deviceUserId}`} • {v.employee?.department || 'General'}
                        </div>
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        {v.isLate && v.isEarlyExit ? (
                          <span className="whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Late ({v.lateMinutes}m) & Early Exit ({v.earlyExitMinutes}m)
                          </span>
                        ) : v.isLate ? (
                          <span className="whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Late Arrival ({v.lateMinutes} mins)
                          </span>
                        ) : v.isEarlyExit ? (
                          <span className="whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-200">
                            Early Exit ({v.earlyExitMinutes} mins)
                          </span>
                        ) : (
                          <span className="whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            Missing Checkout (Single Punch)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap font-mono">
                        {v.firstCheckIn?.time || '—'}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap font-mono">
                        {v.lastCheckOut?.time || '—'}
                      </td>
                      <td className="py-4 px-6 text-center font-bold font-mono text-slate-900">
                        {v.netWorkHours}h
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          Regularize Request
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Drilldown Timeline Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Biometric Punch Audit</h3>
                <p className="text-xs text-slate-500">
                  {selectedRecord.employee?.name} • {selectedRecord.date}
                </p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                &times;
              </button>
            </div>

            {selectedRecord.breaks && selectedRecord.breaks.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5 text-amber-600" />
                  Break Intervals & Timestamps:
                </h4>
                <div className="divide-y divide-amber-100 border border-amber-200 bg-amber-50/40 rounded-2xl overflow-hidden text-xs">
                  {selectedRecord.breaks.map((b: any, bIdx: number) => (
                    <div key={bIdx} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 font-mono">
                          {b.goOutTime} → {b.returnTime}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          Out ({b.outVerification || 'BIOMETRIC'}) • Return ({b.returnVerification || 'BIOMETRIC'})
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold font-mono bg-amber-100 text-amber-900 border border-amber-200">
                        {b.durationMinutes} mins
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Punch Sequence:</h4>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden text-xs max-h-48 overflow-y-auto">
                {selectedRecord.punches?.map((p: any, idx: number) => (
                  <div key={idx} className="p-3 flex items-center justify-between bg-white hover:bg-slate-50">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 font-mono">
                          {p.timestamp?.includes(' ') || p.timestamp?.includes('T') ? p.timestamp.slice(11, 19) : p.timestamp}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.terminalName || 'LAN Terminal'}</div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold font-mono uppercase bg-slate-100 text-slate-700">
                      {p.verificationType || 'BIOMETRIC'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Net Working Time:</span>
                <span className="font-bold font-mono text-slate-900">{(selectedRecord.netWorkMinutes / 60).toFixed(2)} Hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Break Duration:</span>
                <span className="font-bold font-mono text-slate-900">{selectedRecord.totalBreakMinutes || 0} Minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Daily Attendance Status:</span>
                <span>{getStatusBadge(selectedRecord.status)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedRecord(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
            >
              Close Punch Audit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
