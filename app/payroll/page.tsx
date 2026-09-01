'use client';

import { useState, useEffect, Suspense } from 'react';
import {
  DollarSign,
  Play,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Building,
  CreditCard,
  Printer,
  ChevronRight,
  TrendingUp,
  Receipt,
  User,
  Sliders,
  Lock,
  Unlock,
  Edit3,
  Plus,
  Trash2,
  ShieldCheck,
  Sparkles,
  Info,
  X,
  Layers,
  Edit2,
  Check,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function PayrollContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'STRUCTURES' ? 'STRUCTURES' : searchParams.get('tab') === 'SIMULATOR' ? 'SIMULATOR' : 'REGISTER';
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'STRUCTURES' | 'SIMULATOR'>(initialTab);

  const [records, setRecords] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // Modals
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  // Salary Structures state
  const [structures, setStructures] = useState<any[]>([]);
  const [editingStructure, setEditingStructure] = useState<any | null>(null);
  const [showAddStructure, setShowAddStructure] = useState(false);

  // Default structure template for builder
  const defaultStructureForm = {
    name: '',
    description: '',
    baseSalaryType: 'Fixed',
    baseSalaryAmount: 35000,
    ctcMinimum: 420000,
    ctcMaximum: 700000,
    pfEnabled: true,
    pfEmployeeRate: 12.0,
    pfEmployerRate: 12.0,
    pfWageCeiling: 15000.0,
    esicEnabled: true,
    esicEmployeeRate: 0.75,
    esicWageCeiling: 21000.0,
    ptEnabled: true,
    components: [
      { name: 'Basic Pay', type: 'EARNING', calculationType: 'Percentage', percentageOf: 'BaseSalary', percentageValue: 50, fixedAmount: 0, formula: '', condition: '', isTaxable: true, isMandatory: true },
      { name: 'House Rent Allowance (HRA)', type: 'EARNING', calculationType: 'Formula', formula: '(basic * 0.40)', percentageOf: 'BaseSalary', percentageValue: 0, fixedAmount: 0, condition: '', isTaxable: false, isMandatory: true },
      { name: 'Special Allowance', type: 'EARNING', calculationType: 'Formula', formula: 'base - (basic + (basic * 0.40))', percentageOf: 'BaseSalary', percentageValue: 0, fixedAmount: 0, condition: '', isTaxable: true, isMandatory: false },
      { name: 'Performance Bonus', type: 'EARNING', calculationType: 'Fixed', fixedAmount: 3000, percentageOf: 'BaseSalary', percentageValue: 0, formula: '', condition: 'base > 25000', isTaxable: true, isMandatory: false },
    ],
  };

  const [structureForm, setStructureForm] = useState<any>(defaultStructureForm);

  // Live Math Simulator State
  const [simBaseSalary, setSimBaseSalary] = useState(40000);
  const [simCtc, setSimCtc] = useState(600000);
  const [simSelectedStructureId, setSimSelectedStructureId] = useState('');
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const [meRes, payRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch(`/api/payroll?month=${month}&year=${year}`),
      ]);

      const meJson = await meRes.json();
      const payJson = await payRes.json();

      if (meJson.success) setCurrentUser(meJson.data.user);
      if (payJson.success) {
        setRecords(payJson.data || []);
        setMeta(payJson.meta || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStructures = async () => {
    try {
      const res = await fetch('/api/payroll/structures');
      const json = await res.json();
      if (json.success) {
        setStructures(json.data || []);
        if (json.data?.length > 0 && !simSelectedStructureId) {
          setSimSelectedStructureId(json.data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, [month, year]);

  useEffect(() => {
    fetchStructures();
  }, []);

  const runSimulator = async () => {
    setSimLoading(true);
    try {
      const res = await fetch('/api/payroll/structures/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structureId: simSelectedStructureId || undefined,
          baseSalary: simBaseSalary,
          ctc: simCtc,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSimResult(json.data);
      } else {
        alert(json.error?.message || 'Simulation error');
      }
    } catch {
      alert('Failed to run simulation');
    } finally {
      setSimLoading(false);
    }
  };

  const handleRunPayroll = async () => {
    if (!confirm(`Run statutory payroll batch calculation for ${MONTH_NAMES[month - 1]} ${year}? Calculated records will be generated in ReadyForReview draft state for supervisor sign-off.`)) return;
    setRunning(true);
    try {
      const res = await fetch('/api/payroll/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message || 'Draft payroll calculated successfully! Review and edit if needed before approving.');
        fetchPayroll();
      } else {
        alert(json.error?.message || 'Payroll run failed');
      }
    } catch {
      alert('Error executing payroll');
    } finally {
      setRunning(false);
    }
  };

  const handleLockPayroll = async () => {
    if (!confirm(`Are you sure you want to APPROVE and LOCK payroll for ${MONTH_NAMES[month - 1]} ${year}?\n\nOnce locked, figures are sealed and protected from automated changes.`)) return;
    try {
      const res = await fetch('/api/payroll/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchPayroll();
      } else {
        alert(json.error?.message || 'Failed to lock payroll');
      }
    } catch {
      alert('Error locking payroll');
    }
  };

  const handleUnlockPayroll = async () => {
    const reason = prompt(`Enter super admin authorization reason to unlock payroll for ${MONTH_NAMES[month - 1]} ${year}:`);
    if (!reason) return;
    try {
      const res = await fetch('/api/payroll/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year, reason }),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchPayroll();
      } else {
        alert(json.error?.message || 'Failed to unlock');
      }
    } catch {
      alert('Error unlocking payroll');
    }
  };

  const handleSaveEditRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    try {
      const res = await fetch('/api/payroll', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRecord),
      });
      const json = await res.json();
      if (json.success) {
        alert('Line item adjusted and saved to 7-year audit ledger!');
        setEditingRecord(null);
        fetchPayroll();
      } else {
        alert(json.error?.message || 'Adjustment failed');
      }
    } catch {
      alert('Network error saving adjustment');
    }
  };

  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isNew = !editingStructure?.id;
      const res = await fetch('/api/payroll/structures', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? structureForm : { ...structureForm, id: editingStructure.id }),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message || 'Structure saved successfully!');
        setShowAddStructure(false);
        setEditingStructure(null);
        setStructureForm(defaultStructureForm);
        fetchStructures();
      } else {
        alert(json.error?.message || 'Failed to save structure');
      }
    } catch {
      alert('Error saving structure');
    }
  };

  const handleDeleteStructure = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete salary structure '${name}'?`)) return;
    try {
      const res = await fetch(`/api/payroll/structures?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        alert(json.message || 'Structure deleted successfully');
        fetchStructures();
      } else {
        alert(json.error?.message || 'Failed to delete structure');
      }
    } catch {
      alert('Error deleting structure');
    }
  };

  const handleAddComponent = () => {
    setStructureForm({
      ...structureForm,
      components: [
        ...structureForm.components,
        {
          name: 'Custom Component',
          type: 'EARNING',
          calculationType: 'Fixed',
          fixedAmount: 1000,
          percentageOf: 'BaseSalary',
          percentageValue: 0,
          formula: '',
          condition: '',
          isTaxable: true,
          isMandatory: false,
        },
      ],
    });
  };

  const handleRemoveComponent = (index: number) => {
    const updated = structureForm.components.filter((_: any, i: number) => i !== index);
    setStructureForm({ ...structureForm, components: updated });
  };

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const canManage = isSuperAdmin || currentUser?.role === 'HR_ADMIN' || currentUser?.permissions?.includes('payroll:process');
  const isSelfServiceOnly = !canManage;

  const [downloadApprovalStatus, setDownloadApprovalStatus] = useState<'NONE' | 'PENDING' | 'APPROVED'>('NONE');
  const [requestingDownload, setRequestingDownload] = useState(false);

  const checkDownloadApproval = async (empId: string, m: number, y: number) => {
    // Super Admin / HR Admins / Admins have instant privileged access with zero approvals needed
    if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_ADMIN' || currentUser?.role === 'ADMIN') {
      setDownloadApprovalStatus('APPROVED');
      return;
    }

    try {
      const res = await fetch('/api/payroll/download-approval');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const match = json.data.find((d: any) => d.employeeId === empId && Number(d.month) === Number(m) && Number(d.year) === Number(y));
        if (match) {
          setDownloadApprovalStatus(match.status);
        } else {
          setDownloadApprovalStatus('NONE');
        }
      }
    } catch {
      setDownloadApprovalStatus('NONE');
    }
  };

  const handleRequestDownload = async () => {
    setRequestingDownload(true);
    try {
      const res = await fetch('/api/payroll/download-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message || 'Request submitted to your manager');
        setDownloadApprovalStatus('PENDING');
      } else {
        alert(json.error?.message || 'Request failed');
      }
    } catch {
      alert('Error requesting download authorization');
    } finally {
      setRequestingDownload(false);
    }
  };

  const totalDisbursement = records.reduce((sum, r) => sum + (r.netSalary || 0), 0);
  const totalPfDeduction = records.reduce((sum, r) => sum + (r.pfDeduction || 0), 0);
  const totalEsiDeduction = records.reduce((sum, r) => sum + (r.esiDeduction || 0), 0);
  const totalLopDeduction = records.reduce((sum, r) => sum + (r.lopDeduction || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#a92427]/10 text-[#a92427] border border-[#a92427]/20">
              {canManage ? 'Statutory Compensation Hub' : 'Employee Self-Service Desk'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {canManage ? 'Safe AST Formula Engine & 7-Year Audit' : 'Official Payslips & Earnings Record'}
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <DollarSign className="w-7 h-7 text-[#a92427]" />
            {canManage ? 'Enterprise Payroll & Custom CTC Structures' : 'My Monthly Payslips & Earnings'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {canManage
              ? 'Configure custom salary packages (Interns, Contractors, FTEs), simulate formulas, and execute attendance-integrated payroll.'
              : 'Review your itemized earnings, statutory PF/ESIC deductions, net take-home salary, and request authorized payslip downloads.'}
          </p>
        </div>

        {/* Month Selector */}
        {activeTab === 'REGISTER' && (
          <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80 text-xs">
            <Calendar className="w-4 h-4 text-slate-500 ml-2" />
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-transparent font-medium focus:outline-none text-slate-800"
            >
              {MONTH_NAMES.map((mName, idx) => (
                <option key={idx} value={idx + 1}>{mName}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-transparent font-mono font-medium focus:outline-none text-slate-800"
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
            </select>
          </div>
        )}
      </div>

      {/* Primary 3-Tab Navigator (Only for Payroll Admins) */}
      {canManage && (
        <div className="flex flex-wrap items-center gap-2.5 bg-slate-100/70 p-2 rounded-2xl border border-slate-200/80">
          <button
            onClick={() => setActiveTab('REGISTER')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'REGISTER'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <CreditCard className="w-4 h-4 text-[#a92427]" />
            <span>Monthly Payroll Register & Disbursement</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 text-slate-700">
              {records.length} Employees
            </span>
          </button>

          <button
            onClick={() => setActiveTab('STRUCTURES')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'STRUCTURES'
                ? 'bg-[#a92427] text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Salary Structures & CTC Builder</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${activeTab === 'STRUCTURES' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {structures.length} Packages
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('SIMULATOR');
              runSimulator();
            }}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'SIMULATOR'
                ? 'bg-purple-700 text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Live Math Simulator</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: PAYROLL REGISTER & DISBURSEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'REGISTER' && (
        <div className="space-y-6">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Disbursement Cycle:</span>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900">
                {MONTH_NAMES[month - 1]} {year}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {canManage && !meta.isLocked && (
                <button
                  onClick={handleRunPayroll}
                  disabled={running}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
                  <span>{running ? 'Calculating Attendance & LOP...' : 'Run Draft Calculation'}</span>
                </button>
              )}

              {canManage && !meta.isLocked && records.length > 0 && (
                <button
                  onClick={handleLockPayroll}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#a92427] hover:bg-[#8e1d20] text-white text-xs font-bold rounded-xl shadow-xs transition shadow-[#a92427]/20"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Approve & Lock Payroll</span>
                </button>
              )}

              {isSuperAdmin && meta.isLocked && (
                <button
                  onClick={handleUnlockPayroll}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Unlock Month</span>
                </button>
              )}
            </div>
          </div>

          {/* Audit Lock Status Alert */}
          {meta.isLocked && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <strong>Payroll Locked & Sealed:</strong> Approved by <strong>{meta.approvedBy || 'Management'}</strong> on {meta.approvedAt ? new Date(meta.approvedAt).toLocaleString('en-IN') : 'Record'}. Figures are locked to prevent post-audit drift.
                </div>
              </div>
            </div>
          )}

          {/* KPI Stats Cards (Only for Payroll Admins) */}
          {canManage && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Net Salary Disbursement</span>
                  <div className="text-2xl font-black font-mono text-emerald-700">
                    ₹{totalDisbursement.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">{records.length} Employees Active</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PF Statutory Deposit (12%)</span>
                  <div className="text-2xl font-black font-mono text-blue-700">
                    ₹{totalPfDeduction.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">EPFO Remittance (Ceiling ₹15k)</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CreditCard className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ESIC Medical Fund</span>
                  <div className="text-2xl font-black font-mono text-purple-700">
                    ₹{totalEsiDeduction.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">0.75% Contribution (Ceiling ₹21k)</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Building className="w-6 h-6" />
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total LOP Reductions</span>
                  <div className="text-2xl font-black font-mono text-rose-700">
                    -₹{totalLopDeduction.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">Biometric & Unapproved Leave</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Receipt className="w-6 h-6" />
                </div>
              </div>
            </div>
          )}

          {/* Payroll Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Disbursement Register for {MONTH_NAMES[month - 1]} {year}
                </h3>
                <p className="text-xs text-slate-500">
                  Calculated using assigned custom salary structures, biometric attendance logs, and statutory deductions.
                </p>
              </div>

              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                {records.length} Employees
              </span>
            </div>

            {isSelfServiceOnly && !meta.isLocked && (
              <div className="m-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <strong>Monthly Payslips Under Review:</strong> Calculations for {MONTH_NAMES[month - 1]} {year} are currently in <strong>DRAFT</strong> status. Per enterprise HR policy, payslips are sealed and will become visible once reviewed, approved, and locked by management.
                </div>
              </div>
            )}

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs">Loading payroll register...</div>
            ) : records.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-slate-700">No Payroll Processed for {MONTH_NAMES[month - 1]} {year}</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Click &quot;Run Draft Calculation&quot; to calculate salary according to biometric attendance and salary structures.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-4 px-6">Employee</th>
                      <th className="py-4 px-6">Structure</th>
                      <th className="py-4 px-6 text-right">Gross Salary</th>
                      <th className="py-4 px-6 text-right">LOP Deduction</th>
                      <th className="py-4 px-6 text-right">Statutory (PF+ESI+PT)</th>
                      <th className="py-4 px-6 text-right">Net Payout</th>
                      <th className="py-4 px-6 text-center">Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {records.map((r) => {
                      const statDeductions = (r.pfDeduction || 0) + (r.esiDeduction || 0) + (r.ptDeduction || 0);
                      const isLocked = r.status === 'APPROVED_LOCKED';

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-4 px-6">
                            <div className="font-bold text-slate-900">{r.employeeName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {r.employeeCode} • {r.employeeDept}
                            </div>
                            {r.auditNotes && (
                              <div className="text-[10px] text-amber-700 italic mt-0.5">Note: {r.auditNotes}</div>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                              {r.structureName || 'Standard FTE'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-bold text-slate-800">
                            {r.isDraft ? '₹ --' : `₹${(r.grossSalary || 0).toLocaleString('en-IN')}`}
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-semibold text-rose-600">
                            {r.isDraft ? '₹ --' : (r.lopDeduction > 0 ? `-₹${r.lopDeduction.toLocaleString('en-IN')}` : '₹0')}
                          </td>
                          <td className="py-4 px-6 text-right font-mono text-slate-600">
                            {r.isDraft ? '₹ --' : `-₹${statDeductions.toLocaleString('en-IN')}`}
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-black text-emerald-700 text-sm">
                            {r.isDraft ? (
                              <span className="text-xs font-sans text-amber-700 font-bold">Pending HR Lock</span>
                            ) : (
                              `₹${(r.netSalary || 0).toLocaleString('en-IN')}`
                            )}
                          </td>
                          <td className="py-4 px-6 text-center whitespace-nowrap">
                            {isLocked ? (
                              <span className="whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Approved & Sealed
                              </span>
                            ) : (
                              <span className="whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Draft (Under Review)
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {canManage && !isLocked && (
                                <button
                                  onClick={() => setEditingRecord({ ...r })}
                                  className="px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 text-xs font-semibold flex items-center gap-1 transition"
                                  title="Edit line item before approving"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                              )}

                              {isLocked || canManage ? (
                                <button
                                  onClick={() => {
                                    setSelectedPayslip(r);
                                    checkDownloadApproval(r.employeeId, month, year);
                                  }}
                                  className={`px-3 py-1 rounded-lg text-xs font-semibold shadow-2xs transition flex items-center gap-1 text-white ${
                                    isLocked ? 'bg-slate-900 hover:bg-slate-800' : 'bg-amber-600 hover:bg-amber-700'
                                  }`}
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>{isLocked ? 'Payslip' : 'Draft Preview'}</span>
                                </button>
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  Sealed in Draft
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SALARY STRUCTURES & CTC BUILDER */}
      {/* ========================================================================= */}
      {activeTab === 'STRUCTURES' && canManage && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#a92427]" />
                Salary Structure Configurator & Formula Packages
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Create custom compensation packages for Interns, Contractors, or FTEs with formulas, dynamic condition guards, and statutory ceilings.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingStructure(null);
                setStructureForm(defaultStructureForm);
                setShowAddStructure(true);
              }}
              className="px-4 py-2.5 rounded-2xl bg-[#a92427] hover:bg-[#8e1d20] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Structure Package</span>
            </button>
          </div>

          {/* List of Configured Structures */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {structures.map((s) => (
              <div key={s.id} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-[#a92427]/40 transition space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base text-slate-900">{s.name}</h4>
                      {s.isDefault && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Default FTE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{s.description || 'Custom compensation structure'}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setEditingStructure(s);
                        setStructureForm({
                          name: s.name,
                          description: s.description || '',
                          baseSalaryType: s.baseSalaryType || 'Fixed',
                          baseSalaryAmount: s.baseSalaryAmount || 35000,
                          ctcMinimum: s.ctcMinimum || 400000,
                          ctcMaximum: s.ctcMaximum || 700000,
                          pfEnabled: s.pfEnabled,
                          pfEmployeeRate: s.pfEmployeeRate || 12.0,
                          pfEmployerRate: s.pfEmployerRate || 12.0,
                          pfWageCeiling: s.pfWageCeiling || 15000.0,
                          esicEnabled: s.esicEnabled,
                          esicEmployeeRate: s.esicEmployeeRate || 0.75,
                          esicWageCeiling: s.esicWageCeiling || 21000.0,
                          ptEnabled: s.ptEnabled,
                          components: s.components || [],
                        });
                        setShowAddStructure(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    {!s.isDefault && (
                      <button
                        onClick={() => handleDeleteStructure(s.id, s.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition"
                        title="Delete structure"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Base Pay:</span>
                    <span className="font-mono font-bold text-slate-900">₹{(s.baseSalaryAmount || 35000).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Annual CTC Cap:</span>
                    <span className="font-mono font-bold text-slate-900">₹{(s.ctcMaximum || 600000).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Assigned Staff:</span>
                    <span className="font-mono font-bold text-slate-900">{s.employeeCount || 0} Employees</span>
                  </div>
                </div>

                {/* Components Pills */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Components ({s.components?.length || 0})</span>
                  <div className="flex flex-wrap gap-1.5">
                    {s.components?.map((c: any, idx: number) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          c.type === 'EARNING' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                        title={c.formula ? `Formula: ${c.formula}` : c.condition ? `Condition: ${c.condition}` : 'Fixed amount'}
                      >
                        {c.name} {c.calculationType === 'Formula' ? '(fx)' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Create / Edit Salary Structure Form */}
          {showAddStructure && (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
              <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-scaleUp text-xs">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-[#a92427]" />
                      <span>{editingStructure ? `Edit Structure: ${editingStructure.name}` : 'Create Salary Structure Package'}</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">Configure base salary, CTC brackets, formulas, and statutory deductions.</p>
                  </div>
                  <button onClick={() => setShowAddStructure(false)} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveStructure} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Structure Package Name</label>
                      <input
                        type="text"
                        value={structureForm.name}
                        onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
                        placeholder="e.g. Intern / Stipend Track"
                        required
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Description</label>
                      <input
                        type="text"
                        value={structureForm.description}
                        onChange={(e) => setStructureForm({ ...structureForm, description: e.target.value })}
                        placeholder="e.g. For interns with fixed stipend and no PF"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Base Salary (₹)</label>
                      <input
                        type="number"
                        value={structureForm.baseSalaryAmount}
                        onChange={(e) => setStructureForm({ ...structureForm, baseSalaryAmount: Number(e.target.value) })}
                        required
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Min Annual CTC (₹)</label>
                      <input
                        type="number"
                        value={structureForm.ctcMinimum}
                        onChange={(e) => setStructureForm({ ...structureForm, ctcMinimum: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Max Annual CTC (₹)</label>
                      <input
                        type="number"
                        value={structureForm.ctcMaximum}
                        onChange={(e) => setStructureForm({ ...structureForm, ctcMaximum: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Statutory Toggles */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <span className="font-bold text-slate-800 block">Statutory Compliance Modules</span>
                    <div className="grid grid-cols-3 gap-3">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={structureForm.pfEnabled}
                          onChange={(e) => setStructureForm({ ...structureForm, pfEnabled: e.target.checked })}
                          className="rounded text-[#a92427]"
                        />
                        <span>EPF (12% capped at ₹15k)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={structureForm.esicEnabled}
                          onChange={(e) => setStructureForm({ ...structureForm, esicEnabled: e.target.checked })}
                          className="rounded text-[#a92427]"
                        />
                        <span>ESIC (0.75% ceiling ₹21k)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={structureForm.ptEnabled}
                          onChange={(e) => setStructureForm({ ...structureForm, ptEnabled: e.target.checked })}
                          className="rounded text-[#a92427]"
                        />
                        <span>Professional Tax Slabs</span>
                      </label>
                    </div>
                  </div>

                  {/* Dynamic Components Builder */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-1">
                      <span className="font-bold text-slate-900">Configured Components & Formulas</span>
                      <button
                        type="button"
                        onClick={handleAddComponent}
                        className="px-3 py-1 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Component</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {structureForm.components.map((comp: any, idx: number) => (
                        <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Name</label>
                            <input
                              type="text"
                              value={comp.name}
                              onChange={(e) => {
                                const copy = [...structureForm.components];
                                copy[idx].name = e.target.value;
                                setStructureForm({ ...structureForm, components: copy });
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-bold"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Type</label>
                            <select
                              value={comp.type}
                              onChange={(e) => {
                                const copy = [...structureForm.components];
                                copy[idx].type = e.target.value;
                                setStructureForm({ ...structureForm, components: copy });
                              }}
                              className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 font-medium"
                            >
                              <option value="EARNING">Earning</option>
                              <option value="DEDUCTION">Deduction</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Calculation</label>
                            <select
                              value={comp.calculationType || 'Fixed'}
                              onChange={(e) => {
                                const copy = [...structureForm.components];
                                copy[idx].calculationType = e.target.value;
                                setStructureForm({ ...structureForm, components: copy });
                              }}
                              className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 font-medium"
                            >
                              <option value="Fixed">Fixed Amount</option>
                              <option value="Percentage">Percentage of Base</option>
                              <option value="Formula">AST Formula (fx)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              {comp.calculationType === 'Formula' ? 'Formula String' : comp.calculationType === 'Percentage' ? '% Value' : 'Amount (₹)'}
                            </label>
                            {comp.calculationType === 'Formula' ? (
                              <input
                                type="text"
                                value={comp.formula || ''}
                                onChange={(e) => {
                                  const copy = [...structureForm.components];
                                  copy[idx].formula = e.target.value;
                                  setStructureForm({ ...structureForm, components: copy });
                                }}
                                placeholder="(basic * 0.40)"
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px]"
                              />
                            ) : comp.calculationType === 'Percentage' ? (
                              <input
                                type="number"
                                value={comp.percentageValue || 0}
                                onChange={(e) => {
                                  const copy = [...structureForm.components];
                                  copy[idx].percentageValue = Number(e.target.value);
                                  setStructureForm({ ...structureForm, components: copy });
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono"
                              />
                            ) : (
                              <input
                                type="number"
                                value={comp.fixedAmount || comp.value || 0}
                                onChange={(e) => {
                                  const copy = [...structureForm.components];
                                  copy[idx].fixedAmount = Number(e.target.value);
                                  copy[idx].value = Number(e.target.value);
                                  setStructureForm({ ...structureForm, components: copy });
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono"
                              />
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-1 pt-3">
                            <input
                              type="text"
                              value={comp.condition || ''}
                              onChange={(e) => {
                                const copy = [...structureForm.components];
                                copy[idx].condition = e.target.value;
                                setStructureForm({ ...structureForm, components: copy });
                              }}
                              placeholder="Condition: base > 20000"
                              className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 font-mono text-[10px]"
                              title="Optional boolean condition string to activate component"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveComponent(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 shrink-0"
                              title="Remove component"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAddStructure(false)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 rounded-xl bg-[#a92427] hover:bg-[#8e1d20] text-white font-bold shadow-xs transition"
                    >
                      Save Structure Package
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REAL-TIME MATHEMATICAL SALARY SIMULATOR */}
      {/* ========================================================================= */}
      {activeTab === 'SIMULATOR' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs space-y-6 text-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                Safe AST Math Simulator
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <span>Real-Time Mathematical Salary Simulator</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Execute live AST formula evaluations and test statutory ceilings (PF ₹15k, ESIC ₹21k, PT Slabs) without writing to the database.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Select Structure Package</label>
              <select
                value={simSelectedStructureId}
                onChange={(e) => setSimSelectedStructureId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold"
              >
                <option value="">Default FTE Structure Template</option>
                {structures.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Monthly Base Salary (₹)</label>
              <input
                type="number"
                value={simBaseSalary}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSimBaseSalary(val);
                  setSimCtc(val * 12);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Annual CTC (₹)</label>
              <input
                type="number"
                value={simCtc}
                onChange={(e) => setSimCtc(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={runSimulator}
            disabled={simLoading}
            className="w-full py-3 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{simLoading ? 'Evaluating Formulas...' : 'Run Mathematical Simulation'}</span>
          </button>

          {/* Simulation Results View */}
          {simResult && (
            <div className="space-y-4 pt-2 animate-fadeIn">
              {simResult.isNetNegative && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5 shadow-2xs">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block">Negative Net Salary Guard Triggered!</strong>
                    <span>
                      Deductions exceed gross salary by <strong>₹{simResult.shortfallAmount.toLocaleString('en-IN')}</strong>. Net Take-Home pay is securely guarded and capped at ₹0 to prevent negative payroll generation.
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center font-bold text-slate-900 border-b pb-1 text-emerald-800">
                    <span>Itemized Earnings</span>
                    <span className="font-mono">₹{simResult.totalEarnings.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="space-y-1.5 font-mono text-slate-700">
                    {simResult.earnings.map((e: any, idx: number) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-slate-600">{e.name}:</span>
                        <span className="font-bold">₹{(e.amount || 0).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center font-bold text-slate-900 border-b pb-1 text-rose-800">
                    <span>Statutory Deductions (Slabs & Ceilings)</span>
                    <span className="font-mono">₹{simResult.totalDeductions.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="space-y-1.5 font-mono text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-600">PF Employee (12% capped at ₹15k):</span>
                      <span className="font-bold">₹{(simResult.statutoryDeductions.pfEmployee || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">PF Employer Contribution (12%):</span>
                      <span className="font-bold">₹{(simResult.statutoryDeductions.pfEmployer || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">ESIC Employee (0.75% ceiling ₹21k):</span>
                      <span className="font-bold">₹{(simResult.statutoryDeductions.esicEmployee || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">ESIC Employer Fund (3.25%):</span>
                      <span className="font-bold">₹{(simResult.statutoryDeductions.esicEmployer || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Professional Tax (Slab):</span>
                      <span className="font-bold">₹{(simResult.statutoryDeductions.professionalTax || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex justify-between items-center text-sm">
                <div>
                  <span className="font-bold text-emerald-900 block">Simulated Net Take-Home Pay:</span>
                  <span className="text-[11px] text-emerald-700 font-mono">
                    Gross (₹{simResult.grossSalary.toLocaleString('en-IN')}) - Total Deductions (₹{simResult.totalDeductions.toLocaleString('en-IN')})
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono text-emerald-800">
                    ₹{simResult.netSalary.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-emerald-600 block">per month</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Line Item Modal with 7-Year Statutory Audit Notice */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-8 shadow-2xl space-y-5 animate-scaleUp text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Manual Payroll Adjustment</h3>
                <p className="text-[11px] text-slate-500">
                  {editingRecord.employeeName} ({editingRecord.employeeCode}) • {MONTH_NAMES[month - 1]} {year}
                </p>
              </div>
              <button onClick={() => setEditingRecord(null)} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditRecord} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Gross Salary (₹)</label>
                  <input
                    type="number"
                    value={editingRecord.grossSalary}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const totalDeds = (editingRecord.pfDeduction || 0) + (editingRecord.esiDeduction || 0) + (editingRecord.ptDeduction || 0) + (editingRecord.lopDeduction || 0) + (editingRecord.customDeductions || 0);
                      setEditingRecord({ ...editingRecord, grossSalary: val, netSalary: Math.max(0, val - totalDeds) });
                    }}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">LOP Deduction (₹)</label>
                  <input
                    type="number"
                    value={editingRecord.lopDeduction}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const totalDeds = (editingRecord.pfDeduction || 0) + (editingRecord.esiDeduction || 0) + (editingRecord.ptDeduction || 0) + val + (editingRecord.customDeductions || 0);
                      setEditingRecord({ ...editingRecord, lopDeduction: val, netSalary: Math.max(0, editingRecord.grossSalary - totalDeds) });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-rose-700 font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Custom Deductions / TDS (₹)</label>
                  <input
                    type="number"
                    value={editingRecord.customDeductions || 0}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const totalDeds = (editingRecord.pfDeduction || 0) + (editingRecord.esiDeduction || 0) + (editingRecord.ptDeduction || 0) + (editingRecord.lopDeduction || 0) + val;
                      setEditingRecord({ ...editingRecord, customDeductions: val, netSalary: Math.max(0, editingRecord.grossSalary - totalDeds) });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Net Payable Salary (₹)</label>
                  <input
                    type="number"
                    value={editingRecord.netSalary}
                    readOnly
                    className="w-full px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 font-mono font-black text-emerald-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Manager Audit Reasoning</label>
                <textarea
                  value={editingRecord.auditNotes || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, auditNotes: e.target.value })}
                  placeholder="Reason for manual adjustment (e.g. approved LOP waiver, performance incentive, tax correction)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
                />
              </div>

              <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  <strong>7-Year Statutory Audit Compliance:</strong> All manual line-item overrides, before/after diffs, and editor credentials are saved to the immutable <code className="font-mono bg-white/70 px-1 py-0.5 rounded">AuditLog</code> ledger.
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#a92427] hover:bg-[#8e1d20] text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                Save Line Item Adjustment & Log to Audit
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Printable Payslip Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/kernn-icon.png"
                  alt="Kernn"
                  className="w-8 h-8 rounded-xl object-contain shadow-xs"
                />
                <div>
                  <h3 className="text-base font-bold text-slate-900">KERNN AUTOMATIONS - HRMS SUITE</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Official Salary Slip • {MONTH_NAMES[month - 1]} {year}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPayslip(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block">Employee Name:</span>
                <span className="font-bold text-slate-900">{selectedPayslip.employeeName}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Employee Code:</span>
                <span className="font-mono font-bold text-slate-900">{selectedPayslip.employeeCode}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Department:</span>
                <span className="font-semibold text-slate-800">{selectedPayslip.employeeDept}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Salary Structure:</span>
                <span className="font-semibold text-slate-800">{selectedPayslip.structureName || 'Standard FTE'}</span>
              </div>
            </div>

            {/* Earnings & Deductions Breakdown */}
            <div className="grid grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 border-b pb-1 text-emerald-800">Earnings</h4>
                <div className="space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Basic Salary:</span>
                    <span className="font-bold text-slate-900">₹{(selectedPayslip.basicSalary || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">House Rent (HRA):</span>
                    <span className="font-bold text-slate-900">₹{(selectedPayslip.hra || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Allowances & Special:</span>
                    <span className="font-bold text-slate-900">₹{(selectedPayslip.allowances || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="border-t pt-1 flex justify-between font-bold text-emerald-700">
                    <span>Gross Earnings:</span>
                    <span>₹{(selectedPayslip.grossSalary || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 border-b pb-1 text-rose-800">Deductions</h4>
                <div className="space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-600">PF Contribution:</span>
                    <span className="font-bold text-slate-900">₹{(selectedPayslip.pfDeduction || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">ESIC Fund:</span>
                    <span className="font-bold text-slate-900">₹{(selectedPayslip.esiDeduction || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Prof Tax (PT):</span>
                    <span className="font-bold text-slate-900">₹{(selectedPayslip.ptDeduction || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Loss of Pay (LOP):</span>
                    <span className="font-bold text-rose-600">₹{(selectedPayslip.lopDeduction || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="border-t pt-1 flex justify-between font-bold text-rose-700">
                    <span>Total Deductions:</span>
                    <span>₹{((selectedPayslip.totalDeductions || (selectedPayslip.pfDeduction + selectedPayslip.esiDeduction + selectedPayslip.ptDeduction + selectedPayslip.lopDeduction)) || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex justify-between items-center text-sm">
              <span className="font-bold text-emerald-900">Net Take-Home Pay:</span>
              <span className="text-xl font-black font-mono text-emerald-700">
                ₹{(selectedPayslip.netSalary || 0).toLocaleString('en-IN')}
              </span>
            </div>

            {/* Download Authorization Status Banner */}
            {currentUser?.role === 'EMPLOYEE' && downloadApprovalStatus === 'PENDING' && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Payslip download is pending approval from your reporting manager / HR.</span>
              </div>
            )}

            {currentUser?.role === 'EMPLOYEE' && downloadApprovalStatus === 'APPROVED' && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Payslip download authorization approved by management.</span>
              </div>
            )}

            {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_ADMIN' || currentUser?.role === 'ADMIN') && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">Super Admin Direct Clearance: Instant Download & Print Authorized (No approvals needed)</span>
              </div>
            )}

            <div className="flex gap-2">
              {currentUser?.role === 'EMPLOYEE' && downloadApprovalStatus !== 'APPROVED' ? (
                <button
                  onClick={handleRequestDownload}
                  disabled={requestingDownload || downloadApprovalStatus === 'PENDING'}
                  className="w-1/2 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{downloadApprovalStatus === 'PENDING' ? 'Download Awaiting Sign-off' : 'Request Download Approval'}</span>
                </button>
              ) : (
                <button
                  onClick={() => window.print()}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download / Print Official Payslip</span>
                </button>
              )}
              <button
                onClick={() => setSelectedPayslip(null)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PayrollPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-semibold">Loading Payroll Hub...</div>}>
      <PayrollContent />
    </Suspense>
  );
}
