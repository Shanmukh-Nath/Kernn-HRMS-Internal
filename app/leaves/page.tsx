'use client';

import { useState, useEffect, Suspense } from 'react';
import {
  Palmtree,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  AlertCircle,
  Check,
  X,
  User,
  Coffee,
  HeartPulse,
  Briefcase,
  Layers,
  Sliders,
  FileCheck2,
  HelpCircle,
  Info,
  ShieldCheck,
  FileText,
  Trash2,
  Edit2,
  Save,
  Settings2,
  Sparkles,
  Award,
  Users,
  DollarSign,
  UploadCloud,
  Eye,
  FileDown,
  RefreshCw,
  Play,
  RotateCcw,
  TrendingUp,
  Gift,
} from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import { useSearchParams } from 'next/navigation';

function LeavesContent() {
  const searchParams = useSearchParams();
  const initialTab =
    searchParams.get('tab') === 'POLICIES'
      ? 'POLICIES'
      : searchParams.get('tab') === 'APPROVALS'
      ? 'APPROVALS'
      : searchParams.get('tab') === 'ACCRUALS'
      ? 'ACCRUALS'
      : searchParams.get('tab') === 'COMPOFF'
      ? 'COMPOFF'
      : 'DESK';

  const [activeTab, setActiveTab] = useState<'DESK' | 'APPROVALS' | 'POLICIES' | 'ACCRUALS' | 'COMPOFF'>(initialTab);
  const [balances, setBalances] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // Comp-Off state
  const [compOffClaims, setCompOffClaims] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [compOffLoading, setCompOffLoading] = useState(false);
  const [claimForm, setClaimForm] = useState({
    workedDate: format(new Date(), 'yyyy-MM-dd'),
    reason: '',
    creditDays: 1.0,
  });
  const [grantForm, setGrantForm] = useState({
    employeeId: '',
    workedDate: format(new Date(), 'yyyy-MM-dd'),
    reason: '',
    creditDays: 1.0,
  });

  // Accruals state
  const [accrualData, setAccrualData] = useState<{
    policies: any[];
    logs: any[];
    stats: { totalEmployees: number; totalDaysAccruedHistory: number; totalAccrualEvents: number };
  }>({
    policies: [],
    logs: [],
    stats: { totalEmployees: 0, totalDaysAccruedHistory: 0, totalAccrualEvents: 0 },
  });
  const [accrualRunning, setAccrualRunning] = useState(false);
  const [accrualCycle, setAccrualCycle] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [accrualFrequency, setAccrualFrequency] = useState('ALL');
  const [accrualTypeId, setAccrualTypeId] = useState('');
  const [accrualResultMsg, setAccrualResultMsg] = useState<string | null>(null);

  // Apply Modal State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leaveTypeId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    totalDays: 1,
    reason: '',
    proofDocumentNotes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Document Upload & Compression State
  const [uploadedDoc, setUploadedDoc] = useState<{
    name: string;
    dataUrl: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  } | null>(null);
  const [compressing, setCompressing] = useState(false);

  // Document Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<{
    name: string;
    url: string;
    employeeName?: string;
  } | null>(null);

  // 6-Tab Policy Builder Modal State (Manager/Admin View)
  const [editingType, setEditingType] = useState<any | null>(null);
  const [policyBuilderTab, setPolicyBuilderTab] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Rejection Modal State
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const defaultPolicyTemplate = {
    name: '',
    code: '',
    description: '',
    category: 'Casual',
    defaultDaysPerYear: 12,
    accrualEnabled: true,
    accrualFrequency: 'Monthly',
    accrualAmount: 1.0,
    allowCarryForward: true,
    carryForwardLimit: 15,
    carryForwardExpiryDays: 365,
    maxAccumulation: 30,
    allowEncashment: false,
    encashmentMaxDays: 0,
    genderEligibility: 'All',
    eligibleEmployeeTypes: ['Teaching', 'Non-Teaching', 'Admin', 'Support', 'Engineering', 'Contractual', 'PartTime'],
    minServiceYears: 0,
    maxServiceYears: 99,
    minAge: 18,
    maxAge: 70,
    allowedDuringProbation: true,
    allowedDuringNoticePeriod: false,
    minDaysAllowed: 1,
    maxDaysAllowed: 30,
    minConsecutiveDays: 1,
    maxConsecutiveDays: 5,
    maxTimesPerYear: 12,
    maxTimesPerMonth: 3,
    minGapDays: 0,
    priorNoticeDays: 0,
    priorApprovalRequiredDays: 0,
    requireProofDocument: false,
    requiresMedicalCertificate: false,
    proofDocumentLabel: 'Doctor Prescription & Medical Certificate',
    proofThresholdDays: 1,
    medicalCertificateAfterDays: 1,
    isPaid: true,
    affectsPayroll: true,
    applySandwichRule: false,
    allowNegativeBalance: false,
    negativeBalanceLimit: -5.0,
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [meRes, leavesRes, typesRes, accrualsRes, compOffRes, empRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/leaves'),
        fetch('/api/leaves/types'),
        fetch('/api/leaves/accruals'),
        fetch('/api/leaves/comp-off'),
        fetch('/api/employees'),
      ]);

      const meJson = await meRes.json();
      const leavesJson = await leavesRes.json();
      const typesJson = await typesRes.json();
      const accrualsJson = await accrualsRes.json();
      const compOffJson = await compOffRes.json();
      const empJson = await empRes.json();

      if (meJson.success) {
        setCurrentUser(meJson.data.user);
      }
      if (leavesJson.success) {
        setRequests(leavesJson.data.requests || []);
        setBalances(leavesJson.data.balances || []);
      }
      if (typesJson.success) {
        setLeaveTypes(typesJson.data || []);
        if (typesJson.data?.length > 0 && !applyForm.leaveTypeId) {
          setApplyForm((prev) => ({ ...prev, leaveTypeId: typesJson.data[0].id }));
        }
      }
      if (accrualsJson.success) {
        setAccrualData(accrualsJson.data);
      }
      if (compOffJson.success) {
        setCompOffClaims(compOffJson.data || []);
      }
      if (empJson.success) {
        setAllEmployees(empJson.data || []);
        if (empJson.data?.length > 0 && !grantForm.employeeId) {
          setGrantForm((prev) => ({ ...prev, employeeId: empJson.data[0].id }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimCompOff = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompOffLoading(true);
    try {
      const res = await fetch('/api/leaves/comp-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CLAIM',
          workedDate: claimForm.workedDate,
          creditDays: Number(claimForm.creditDays) || 1.0,
          reason: claimForm.reason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message || 'Comp-Off claim submitted for approval!');
        setShowClaimModal(false);
        setClaimForm({
          workedDate: format(new Date(), 'yyyy-MM-dd'),
          reason: '',
          creditDays: 1.0,
        });
        fetchData();
      } else {
        alert(json.error?.message || 'Failed to submit claim');
      }
    } catch {
      alert('Network error submitting Comp-Off claim');
    } finally {
      setCompOffLoading(false);
    }
  };

  const handleGrantCompOff = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompOffLoading(true);
    try {
      const res = await fetch('/api/leaves/comp-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GRANT',
          employeeId: grantForm.employeeId,
          workedDate: grantForm.workedDate,
          creditDays: Number(grantForm.creditDays) || 1.0,
          reason: grantForm.reason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message || 'Comp-Off credit granted successfully!');
        setShowGrantModal(false);
        setGrantForm({
          employeeId: allEmployees[0]?.id || '',
          workedDate: format(new Date(), 'yyyy-MM-dd'),
          reason: '',
          creditDays: 1.0,
        });
        fetchData();
      } else {
        alert(json.error?.message || 'Failed to grant Comp-Off');
      }
    } catch {
      alert('Network error granting Comp-Off');
    } finally {
      setCompOffLoading(false);
    }
  };

  const handleCompOffAction = async (claimId: string, action: 'APPROVED' | 'REJECTED') => {
    const reason = action === 'REJECTED' ? prompt('Enter rejection reason:') : null;
    if (action === 'REJECTED' && !reason) return;
    if (!confirm(`${action === 'APPROVED' ? 'Approve and credit balance for' : 'Reject'} this Comp-Off claim?`)) return;

    try {
      const res = await fetch(`/api/leaves/comp-off/${claimId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectionReason: reason }),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchData();
      } else {
        alert(json.error?.message || 'Action failed');
      }
    } catch {
      alert('Error updating claim status');
    }
  };

  useEffect(() => {
    fetchData();

    const handleHrmsRefresh = () => {
      fetchData();
    };
    window.addEventListener('hrms-refresh', handleHrmsRefresh);
    return () => window.removeEventListener('hrms-refresh', handleHrmsRefresh);
  }, []);

  const selectedType = leaveTypes.find((t) => t.id === applyForm.leaveTypeId);

  const calculateDaysBetween = () => {
    try {
      const s = new Date(applyForm.startDate);
      const e = new Date(applyForm.endDate);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
      if (e < s) return 0;
      const days = differenceInCalendarDays(e, s) + 1;
      return days > 0 ? days : 1;
    } catch {
      return 1;
    }
  };

  const calculateAdvanceNotice = () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const s = new Date(applyForm.startDate);
      s.setHours(0, 0, 0, 0);
      return differenceInCalendarDays(s, today);
    } catch {
      return 0;
    }
  };

  const computedDays = calculateDaysBetween();
  const advanceNoticeDays = calculateAdvanceNotice();

  // Dynamic validation checks referencing manager's DB policy settings
  const noticeRequired = Number(selectedType?.priorNoticeDays ?? selectedType?.priorApprovalRequiredDays) || 0;
  const noticeViolation = noticeRequired > 0 && advanceNoticeDays < noticeRequired;
  const minDaysViolation = selectedType?.minDaysAllowed && computedDays < selectedType.minDaysAllowed;
  const maxDaysViolation = selectedType?.maxDaysAllowed && computedDays > selectedType.maxDaysAllowed;
  const proofThreshold = Number(selectedType?.proofThresholdDays ?? selectedType?.medicalCertificateAfterDays) || 1;
  const isProofRequired = Boolean(selectedType?.requireProofDocument || selectedType?.requiresMedicalCertificate) && computedDays >= proofThreshold;

  // Client-Side Canvas Image Compression
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    try {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDim = 1200;

            if (width > height && width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.65);
            const head = 'data:image/jpeg;base64,';
            const compressedSize = Math.round(((compressedDataUrl.length - head.length) * 3) / 4);
            const ratio = Math.round((1 - compressedSize / file.size) * 100);

            setUploadedDoc({
              name: file.name,
              dataUrl: compressedDataUrl,
              originalSize: file.size,
              compressedSize,
              compressionRatio: Math.max(0, ratio),
            });
            setCompressing(false);
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          setUploadedDoc({
            name: file.name,
            dataUrl: event.target?.result as string,
            originalSize: file.size,
            compressedSize: file.size,
            compressionRatio: 0,
          });
          setCompressing(false);
        };
        reader.readAsDataURL(file);
      }
    } catch {
      setCompressing(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (applyForm.endDate < applyForm.startDate) {
      setErrorMsg('End date cannot be earlier than start date. Please select a valid duration.');
      setSubmitting(false);
      return;
    }

    if (isProofRequired && !uploadedDoc) {
      setErrorMsg(`Policy Mandate: A valid certificate/document is required for ${selectedType?.name}. Please upload the requested file.`);
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveTypeId: applyForm.leaveTypeId,
          startDate: applyForm.startDate,
          endDate: applyForm.endDate,
          totalDays: computedDays,
          reason: applyForm.reason,
          proofDocumentNotes: applyForm.proofDocumentNotes || (uploadedDoc ? `Uploaded: ${uploadedDoc.name}` : ''),
          proofDocumentUrl: uploadedDoc?.dataUrl || null,
          proofDocumentName: uploadedDoc?.name || null,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMsg(json.message || 'Leave request submitted successfully!');
        setTimeout(() => {
          setShowApplyModal(false);
          setSuccessMsg(null);
          setUploadedDoc(null);
          setApplyForm({
            leaveTypeId: leaveTypes[0]?.id || '',
            startDate: format(new Date(), 'yyyy-MM-dd'),
            endDate: format(new Date(), 'yyyy-MM-dd'),
            totalDays: 1,
            reason: '',
            proofDocumentNotes: '',
          });
          fetchData();
        }, 1400);
      } else {
        setErrorMsg(json.error?.message || 'Failed to submit leave request');
      }
    } catch {
      setErrorMsg('A network error occurred while submitting.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingType) return;

    try {
      const isNew = !editingType.id;
      const res = await fetch('/api/leaves/types', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingType),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message || 'Policy saved successfully!');
        setEditingType(null);
        fetchData();
      } else {
        alert(json.error?.message || 'Failed to save policy');
      }
    } catch {
      alert('Error saving policy');
    }
  };

  const handleDeletePolicy = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete policy '${name}'?\n\nThis will remove the policy and clean up associated balances.`)) return;
    try {
      const res = await fetch(`/api/leaves/types?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        alert(json.message || 'Policy deleted successfully');
        fetchData();
      } else {
        alert(json.error?.message || 'Failed to delete policy');
      }
    } catch {
      alert('Error deleting policy');
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this leave request?')) return;
    try {
      const res = await fetch(`/api/leaves/${id}/approve`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        fetchData();
      } else {
        alert(json.error?.message || 'Approval failed');
      }
    } catch {
      alert('Error approving leave');
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    try {
      const res = await fetch(`/api/leaves/${rejectingId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason }),
      });
      const json = await res.json();
      if (json.success) {
        setRejectingId(null);
        setRejectionReason('');
        fetchData();
      } else {
        alert(json.error?.message || 'Rejection failed');
      }
    } catch {
      alert('Error rejecting leave');
    }
  };

  // Accrual Trigger Handlers
  const handleRunAccrual = async () => {
    if (!confirm(`Execute leave accruals for cycle ${accrualCycle}? Eligible employee balances will be credited according to policy rates.`)) return;
    setAccrualRunning(true);
    setAccrualResultMsg(null);
    try {
      const res = await fetch('/api/leaves/accruals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycle: accrualCycle,
          frequency: accrualFrequency,
          leaveTypeId: accrualTypeId || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAccrualResultMsg(json.message);
        fetchData();
      } else {
        alert(json.error?.message || 'Accrual run failed');
      }
    } catch {
      alert('Network error executing accruals');
    } finally {
      setAccrualRunning(false);
    }
  };

  const handleRollover = async () => {
    const fromYear = Number(prompt('Enter expiring year (e.g. 2025):', String(new Date().getFullYear() - 1)));
    if (!fromYear) return;
    const toYear = fromYear + 1;
    if (!confirm(`Roll over unused leaves from ${fromYear} into ${toYear}? Balances will be carried forward up to each policy's limit.`)) return;

    try {
      const res = await fetch('/api/leaves/accruals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ROLLOVER', fromYear, toYear }),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchData();
      } else {
        alert(json.error?.message || 'Rollover failed');
      }
    } catch {
      alert('Error executing rollover');
    }
  };

  const isPolicyAdmin =
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'HR_ADMIN';

  const isManagerOrAdmin =
    isPolicyAdmin ||
    currentUser?.role === 'MANAGER' ||
    currentUser?.permissions?.includes('leaves:approve');

  const [selectedLeaveDetail, setSelectedLeaveDetail] = useState<any | null>(null);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#a92427]/10 text-[#a92427] border border-[#a92427]/20">
              Workforce Time Off Engine
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              Dynamic Accruals & Roll-Overs
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Palmtree className="w-7 h-7 text-[#a92427]" />
            Leave Management & Balances
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Periodic leave accrual cadences, carry-forward caps, and self-service time off requests.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setUploadedDoc(null);
              setShowApplyModal(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#a92427] hover:bg-[#8e1d20] text-white text-xs font-bold shadow-xs transition shadow-[#a92427]/20"
          >
            <Plus className="w-4 h-4" />
            <span>Apply For Leave</span>
          </button>
        </div>
      </div>

      {/* Primary Navigator */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100/70 p-2 rounded-2xl border border-slate-200/80">
        <button
          onClick={() => setActiveTab('DESK')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'DESK'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Calendar className="w-4 h-4 text-[#a92427]" />
          <span>My Leave Balances</span>
        </button>

        {isManagerOrAdmin && (
          <button
            onClick={() => setActiveTab('APPROVALS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'APPROVALS'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Team Approvals</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 text-slate-700">
              {requests.filter((r) => r.status === 'PENDING').length}
            </span>
          </button>
        )}

        {isPolicyAdmin && (
          <button
            onClick={() => setActiveTab('ACCRUALS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'ACCRUALS'
                ? 'bg-purple-700 text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Accrual Engine & History</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${activeTab === 'ACCRUALS' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {accrualData.stats.totalDaysAccruedHistory}d
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('COMPOFF')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'COMPOFF'
              ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Gift className="w-4 h-4 text-amber-700" />
          <span>Comp-Off Desk</span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${activeTab === 'COMPOFF' ? 'bg-slate-950 text-amber-400' : 'bg-amber-100 text-amber-900'}`}>
            {balances.find((b) => b.leaveType?.code === 'COMP_OFF')?.balance || 0}d Available
          </span>
        </button>

        {isPolicyAdmin && (
          <button
            onClick={() => setActiveTab('POLICIES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'POLICIES'
                ? 'bg-[#a92427] text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>6-Tab Leave Policy Builder</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${activeTab === 'POLICIES' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {leaveTypes.length}
            </span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MY LEAVE BALANCES & DESK */}
      {/* ========================================================================= */}
      {activeTab === 'DESK' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {balances.length > 0 ? (
              balances.map((b) => {
                const typeInfo = leaveTypes.find((t) => t.id === b.leaveTypeId || t.code === b.leaveType?.code);
                return (
                  <div
                    key={b.id}
                    className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-[#a92427]/30 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            {b.leaveType?.name || 'Leave Category'}
                          </span>
                          {typeInfo?.applySandwichRule && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200" title="Sandwich rule applies">
                              Sandwich
                            </span>
                          )}
                        </div>
                        <div className="text-2xl font-black font-mono text-slate-900 mt-1">
                          {b.balance} <span className="text-xs text-slate-400 font-sans font-normal">days</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold font-mono bg-slate-100 text-slate-700">
                        {b.leaveType?.code || 'LV'}
                      </span>
                    </div>

                    <div className="my-3 space-y-1">
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#a92427] rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (b.balance / (b.allocated || 12)) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>Used: {b.used || 0}d</span>
                        <span>Accrued: {b.accrued || 0}d</span>
                      </div>
                    </div>

                    {typeInfo && (
                      <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 space-y-1">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1 font-semibold text-purple-700">
                            <Clock className="w-3 h-3" />
                            {typeInfo.accrualEnabled ? `+${typeInfo.accrualAmount}d/${typeInfo.accrualFrequency}` : 'Upfront Quota'}
                          </span>
                          <span>Cap: {typeInfo.maxAccumulation || 30}d</span>
                        </div>
                        {typeInfo.requireProofDocument && (
                          <div className="flex items-center gap-1 text-amber-700 font-semibold truncate">
                            <FileCheck2 className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Proof req (&ge;{typeInfo.proofThresholdDays || 1}d)</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="col-span-4 p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
                No personal leave balance records initialized yet.
              </div>
            )}
          </div>

          {/* History Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">My Leave Applications History</h3>
                <p className="text-xs text-slate-500">Track all time-off submissions, uploaded proofs, and supervisor approvals.</p>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                {requests.length} Submissions
              </span>
            </div>

            {requests.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <Palmtree className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-700">No Leave Applications Yet</div>
                <p className="text-xs text-slate-400">Click &quot;Apply For Leave&quot; above to submit a new time-off request.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-4 px-6">Leave Category</th>
                      <th className="py-4 px-6">Duration</th>
                      <th className="py-4 px-6">Days Charged</th>
                      <th className="py-4 px-6">Reason / Attachment</th>
                      <th className="py-4 px-6 text-center">Status</th>
                      <th className="py-4 px-6 text-right">Application</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {requests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800">
                            {r.leaveType?.name || 'Leave'}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-mono text-slate-700">
                          {format(new Date(r.startDate), 'dd MMM')} - {format(new Date(r.endDate), 'dd MMM yyyy')}
                        </td>
                        <td className="py-4 px-6 font-mono font-bold text-slate-900">{r.totalDays} day(s)</td>
                        <td className="py-4 px-6 max-w-sm text-slate-600">
                          <div className="truncate" title={r.reason}>{r.reason}</div>
                          {r.proofDocumentUrl && (
                            <button
                              onClick={() => setPreviewDoc({ name: r.proofDocumentName || 'Prescription / Certificate', url: r.proofDocumentUrl, employeeName: r.employee?.name })}
                              className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-semibold transition"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View Attached Document</span>
                            </button>
                          )}
                          {r.rejectionReason && (
                            <div className="text-[10px] text-rose-600 italic mt-0.5">Rejected: {r.rejectionReason}</div>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center whitespace-nowrap">
                          {r.status === 'APPROVED' && (
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Approved
                            </span>
                          )}
                          {r.status === 'PENDING' && (
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Pending Approval
                            </span>
                          )}
                          {r.status === 'REJECTED' && (
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Rejected
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedLeaveDetail(r)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEAM APPROVALS QUEUE */}
      {/* ========================================================================= */}
      {activeTab === 'APPROVALS' && isManagerOrAdmin && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Workforce Leave Requests Queue</h3>
              <p className="text-xs text-slate-500">Review employee applications, examine compressed certificates, and approve/reject.</p>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
              {requests.length} Total Requests
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-6">Employee</th>
                  <th className="py-4 px-6">Category</th>
                  <th className="py-4 px-6">Dates</th>
                  <th className="py-4 px-6">Days Charged</th>
                  <th className="py-4 px-6">Reason / Document</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Manager Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {requests.map((r) => {
                  const isPending = r.status === 'PENDING';
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900">{r.employee?.name || 'Employee'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {r.employee?.employeeCode} • {r.employee?.department}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800">
                          {r.leaveType?.name || 'Leave'}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-slate-700">
                        {format(new Date(r.startDate), 'dd MMM')} - {format(new Date(r.endDate), 'dd MMM yyyy')}
                      </td>
                      <td className="py-4 px-6 font-mono font-bold text-slate-900">{r.totalDays}d</td>
                      <td className="py-4 px-6 max-w-sm text-slate-600">
                        <div className="truncate" title={r.reason}>{r.reason}</div>
                        {r.proofDocumentUrl && (
                          <button
                            onClick={() => setPreviewDoc({ name: r.proofDocumentName || 'Prescription / Certificate', url: r.proofDocumentUrl, employeeName: r.employee?.name })}
                            className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Compressed Proof</span>
                          </button>
                        )}
                        {r.rejectionReason && (
                          <div className="text-[10px] text-rose-600 italic mt-0.5">Rejected: {r.rejectionReason}</div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        {r.status === 'APPROVED' && (
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Approved
                          </span>
                        )}
                        {r.status === 'PENDING' && (
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending
                          </span>
                        )}
                        {r.status === 'REJECTED' && (
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Rejected
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleApprove(r.id)}
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition flex items-center gap-1 shadow-2xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => setRejectingId(r.id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 text-xs font-semibold transition"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">Processed</span>
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

      {/* ========================================================================= */}
      {/* TAB 3: ACCRUAL ENGINE & AUDIT LEDGER */}
      {/* ========================================================================= */}
      {activeTab === 'ACCRUALS' && isManagerOrAdmin && (
        <div className="space-y-6">
          {/* Action & Run Header */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-600" />
                  <span>Periodic Leave Accrual & Rollover Engine</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automate monthly and quarterly quota earnings according to each leave policy&apos;s custom rules, accumulation ceilings, and year-end rollovers.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRollover}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
                  title="Roll over unused balances into next fiscal year"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Year-End Rollover</span>
                </button>
              </div>
            </div>

            {/* Run Controls Strip */}
            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <span className="text-purple-900 font-bold block text-[10px] mb-0.5">Accrual Cycle:</span>
                  <input
                    type="month"
                    value={accrualCycle}
                    onChange={(e) => setAccrualCycle(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-purple-200 font-mono font-bold text-purple-950 focus:outline-none"
                  />
                </div>

                <div>
                  <span className="text-purple-900 font-bold block text-[10px] mb-0.5">Cadence Filter:</span>
                  <select
                    value={accrualFrequency}
                    onChange={(e) => setAccrualFrequency(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-purple-200 font-semibold text-purple-950 focus:outline-none"
                  >
                    <option value="ALL">All Configured Cadences</option>
                    <option value="Monthly">Monthly Cadence Only</option>
                    <option value="Quarterly">Quarterly Cadence Only</option>
                    <option value="HalfYearly">Half-Yearly Only</option>
                  </select>
                </div>

                <div>
                  <span className="text-purple-900 font-bold block text-[10px] mb-0.5">Target Policy (Optional):</span>
                  <select
                    value={accrualTypeId}
                    onChange={(e) => setAccrualTypeId(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-purple-200 font-semibold text-purple-950 focus:outline-none"
                  >
                    <option value="">All Accrual Policies</option>
                    {accrualData.policies
                      .filter((p) => p.accrualEnabled)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (+{p.accrualAmount}d/{p.accrualFrequency})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleRunAccrual}
                disabled={accrualRunning}
                className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${accrualRunning ? 'animate-spin' : ''}`} />
                <span>{accrualRunning ? 'Calculating & Crediting...' : 'Run Accrual Cycle'}</span>
              </button>
            </div>

            {accrualResultMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{accrualResultMsg}</span>
              </div>
            )}
          </div>

          {/* Active Policies Cadence Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accrualData.policies.map((p) => (
              <div
                key={p.id}
                className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3 hover:border-purple-300 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{p.name}</h4>
                    <span className="font-mono text-[10px] text-slate-400">{p.code} • {p.category}</span>
                  </div>
                  {p.accrualEnabled ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      Active Cadence
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                      Upfront Quota
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-2.5">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Cadence Credit:</span>
                    <span className="font-mono font-bold text-purple-700 text-sm">
                      {p.accrualEnabled ? `+${p.accrualAmount}d` : 'Lump Sum'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">/ {p.accrualFrequency || 'Year'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Max Accumulation:</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {p.maxAccumulation || 30}d
                    </span>
                    <span className="text-[10px] text-slate-400 block">Ceiling cap</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Carry Forward:</span>
                    <span className="font-bold text-slate-800">
                      {p.allowCarryForward ? `Max ${p.carryForwardLimit || 15}d` : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Accrued:</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {p.totalWorkforceAccrued}d
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Audit Ledger Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Workforce Accrual Audit Ledger</h3>
                <p className="text-xs text-slate-500">
                  Immutable record of every periodic credit event, showing previous vs new balance and ceiling caps.
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                {accrualData.logs.length} Events Logged
              </span>
            </div>

            {accrualData.logs.length === 0 ? (
              <div className="p-16 text-center space-y-2">
                <Clock className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-700">No Accruals Run Yet</div>
                <p className="text-xs text-slate-400">Click &quot;Run Accrual Cycle&quot; above to execute periodic credits.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-4 px-6">Timestamp / Cycle</th>
                      <th className="py-4 px-6">Employee</th>
                      <th className="py-4 px-6">Leave Category</th>
                      <th className="py-4 px-6 text-right">Credit Added</th>
                      <th className="py-4 px-6 text-right">Previous Balance</th>
                      <th className="py-4 px-6 text-right">New Balance</th>
                      <th className="py-4 px-6 text-center">Ceiling Cap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {accrualData.logs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-4 px-6 font-mono text-slate-600">
                          <div>{log.createdAt ? format(new Date(log.createdAt), 'dd MMM yyyy, HH:mm') : 'Recent'}</div>
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                            Cycle {log.cycle}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900">{log.employeeName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {log.employeeCode} • {log.department}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800">
                            {log.leaveTypeName} ({log.leaveTypeCode})
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-black text-emerald-700 text-sm">
                          +{log.creditedAmount}d
                        </td>
                        <td className="py-4 px-6 text-right font-mono text-slate-500">
                          {log.previousBalance}d
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-bold text-slate-900">
                          {log.newBalance}d
                        </td>
                        <td className="py-4 px-6 text-center">
                          {log.cappedAtMaximum ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Capped at Max
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px] font-mono">Standard</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: 6-TAB LEAVE POLICY BUILDER */}
      {/* ========================================================================= */}
      {activeTab === 'POLICIES' && isManagerOrAdmin && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#a92427]" />
                Master 6-Tab Leave Policy Engine
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Primary Standard Types: Casual Leave (CL), Sick Leave (SL), Earned Leave (EL), Medical Leave (ML). Create or delete custom policies at will.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingType({ ...defaultPolicyTemplate });
                setPolicyBuilderTab(1);
              }}
              className="px-4 py-2.5 rounded-2xl bg-[#a92427] hover:bg-[#8e1d20] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Leave Policy</span>
            </button>
          </div>

          {/* List of Configured Policies with Live Edit and Delete Action */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {leaveTypes.map((t) => (
              <div key={t.id} className="p-6 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-xs hover:border-[#a92427]/40 transition">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-black text-base text-slate-900 flex items-center gap-2 flex-wrap">
                      <span>{t.name}</span>
                      <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {t.code}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {t.category || 'Casual'}
                      </span>
                      {t.isPaid ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Paid
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                          Unpaid
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{t.description || 'Configurable corporate leave policy'}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setEditingType({ ...t });
                        setPolicyBuilderTab(1);
                      }}
                      className="px-3 py-1.5 rounded-xl text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 text-xs font-bold flex items-center gap-1 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Configure</span>
                    </button>
                    <button
                      onClick={() => handleDeletePolicy(t.id, t.name)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title={`Permanently delete ${t.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 6-Module Summary Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3">
                  <div className="text-slate-500">Accrual Cadence:</div>
                  <div className="font-mono font-bold text-slate-900 text-right">
                    {t.accrualEnabled ? `${t.accrualAmount}d / ${t.accrualFrequency}` : 'Upfront Quota'}
                  </div>

                  <div className="text-slate-500">Max Accumulation:</div>
                  <div className="font-mono font-bold text-purple-700 text-right">
                    {t.maxAccumulation || 30} Days Cap
                  </div>

                  <div className="text-slate-500">Carry Forward:</div>
                  <div className="font-mono font-bold text-slate-900 text-right">
                    {t.allowCarryForward ? `Max ${t.carryForwardLimit || 15}d` : 'No'}
                  </div>

                  <div className="text-slate-500">Sandwich Rule:</div>
                  <div className={`font-mono font-bold text-right ${t.applySandwichRule ? 'text-amber-800' : 'text-slate-600'}`}>
                    {t.applySandwichRule ? 'Enforced (Off-days Charged)' : 'Disabled'}
                  </div>

                  <div className="text-slate-500">Duration Limit:</div>
                  <div className="font-mono font-bold text-slate-900 text-right">
                    {t.minDaysAllowed || 1}d min • {t.maxConsecutiveDays || 5}d max
                  </div>

                  <div className="text-slate-500">Proof / Certificate:</div>
                  <div className={`font-semibold text-right ${t.requireProofDocument ? 'text-amber-800' : 'text-slate-400'}`}>
                    {t.requireProofDocument ? `Mandatory (&ge;${t.proofThresholdDays || 1}d)` : 'None'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: COMPENSATORY OFF (COMP-OFF) DESK */}
      {/* ========================================================================= */}
      {activeTab === 'COMPOFF' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Banner & Summary */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                <Gift className="w-3 h-3 text-amber-700" />
                <span>Earn-On-Demand Policy</span>
              </div>
              <h3 className="text-xl font-black text-slate-900">Compensatory Off (Comp-Off) Desk</h3>
              <p className="text-xs text-slate-600 max-w-2xl">
                Employees earn Comp-Off credit by working on declared weekends (Saturday/Sunday) or company holidays.
                Credit is earned upon biometric punch verification and manager approval, and remains valid for 90 days.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowClaimModal(true)}
                className="px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Claim Weekend Shift</span>
              </button>

              {isManagerOrAdmin && (
                <button
                  onClick={() => setShowGrantModal(true)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Direct Grant Comp-Off</span>
                </button>
              )}
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                My Available Comp-Off Balance
              </div>
              <div className="text-3xl font-black font-mono text-amber-600 mt-1 flex items-baseline gap-1.5">
                {balances.find((b) => b.leaveType?.code === 'COMP_OFF')?.balance || 0}
                <span className="text-xs font-normal text-slate-500 font-sans">days available</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                100% Paid Leave · 0 Loss of Pay (LOP)
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                My Total Shifts Claimed
              </div>
              <div className="text-3xl font-black font-mono text-slate-900 mt-1 flex items-baseline gap-1.5">
                {compOffClaims.length}
                <span className="text-xs font-normal text-slate-500 font-sans">total shift(s)</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                {compOffClaims.filter((c) => c.status === 'APPROVED').length} Approved · {compOffClaims.filter((c) => c.status === 'PENDING').length} Pending
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Comp-Off Policy Rules
              </div>
              <div className="text-xs font-bold text-slate-800 mt-1">
                Valid for 90 Days from Worked Date
              </div>
              <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                <div>• Automatic biometric punch verification</div>
                <div>• Applicable for unforeseen holiday day-swaps</div>
              </div>
            </div>
          </div>

          {/* Pending Claims Table for Managers / Admins */}
          {isManagerOrAdmin && compOffClaims.filter((c) => c.status === 'PENDING').length > 0 && (
            <div className="bg-white rounded-3xl border border-amber-200 shadow-xs overflow-hidden">
              <div className="p-5 bg-amber-50/50 border-b border-amber-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Pending Weekend Work Comp-Off Claims (Action Required)</span>
                  </h3>
                  <p className="text-[11px] text-amber-800">
                    Verify biometric machine attendance and approve to credit employee Comp-Off leave balance.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-200 text-amber-900">
                  {compOffClaims.filter((c) => c.status === 'PENDING').length} Pending
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-6">Employee</th>
                      <th className="py-3.5 px-6">Worked Date</th>
                      <th className="py-3.5 px-6">Biometric Punch Record</th>
                      <th className="py-3.5 px-6">Reason / Tasks Done</th>
                      <th className="py-3.5 px-6">Credit Requested</th>
                      <th className="py-3.5 px-6 text-right">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {compOffClaims
                      .filter((c) => c.status === 'PENDING')
                      .map((c) => (
                        <tr key={c.id} className="hover:bg-amber-50/30 transition">
                          <td className="py-4 px-6 font-medium text-slate-900">
                            <div className="font-bold">{c.employeeName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{c.employeeCode} · {c.department}</div>
                          </td>
                          <td className="py-4 px-6 font-mono font-bold text-slate-800">
                            <div>{c.workedDate}</div>
                            <div className="text-[10px] font-normal text-amber-700 font-sans">
                              {c.dayOfWeek} ({c.isWeekend ? 'Weekend' : 'Public Holiday'})
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {c.verifiedBiometric ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                {c.punchIn} - {c.punchOut} (Biometric Verified)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <Clock className="w-3 h-3" />
                                Manual Claim (No Punch Found)
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 max-w-xs text-slate-600">
                            <div className="truncate" title={c.reason}>{c.reason}</div>
                          </td>
                          <td className="py-4 px-6 font-mono font-bold text-amber-700">
                            +{c.creditDays} day(s)
                          </td>
                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleCompOffAction(c.id, 'APPROVED')}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition"
                              >
                                Approve & Credit
                              </button>
                              <button
                                onClick={() => handleCompOffAction(c.id, 'REJECTED')}
                                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold text-[11px] border border-slate-200 transition"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* All Comp-Off History */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Comp-Off Shift Claims & Grant History</h3>
                <p className="text-xs text-slate-500">Record of all weekend/holiday shifts claimed, verified, and approved.</p>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                {compOffClaims.length} Records
              </span>
            </div>

            {compOffClaims.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Gift className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-700">No Comp-Off Claims Yet</div>
                <p className="text-xs text-slate-400">
                  Click &quot;Claim Weekend Shift&quot; above to submit credit after working on a Saturday, Sunday, or Holiday.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-6">Employee</th>
                      <th className="py-3.5 px-6">Worked Date</th>
                      <th className="py-3.5 px-6">Punches / Verification</th>
                      <th className="py-3.5 px-6">Reason</th>
                      <th className="py-3.5 px-6">Credit</th>
                      <th className="py-3.5 px-6 text-center">Status</th>
                      <th className="py-3.5 px-6 text-right">Approval / Expiry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {compOffClaims.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-4 px-6 font-medium text-slate-900">
                          <div className="font-bold">{c.employeeName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{c.employeeCode}</div>
                        </td>
                        <td className="py-4 px-6 font-mono font-bold text-slate-800">
                          <div>{c.workedDate}</div>
                          <div className="text-[10px] font-normal text-slate-500 font-sans">{c.dayOfWeek}</div>
                        </td>
                        <td className="py-4 px-6">
                          {c.verifiedBiometric ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              {c.punchIn} - {c.punchOut} (Biometric)
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Manual Entry</span>
                          )}
                        </td>
                        <td className="py-4 px-6 max-w-xs text-slate-600">
                          <div className="truncate" title={c.reason}>{c.reason}</div>
                          {c.rejectionReason && (
                            <div className="text-[10px] text-rose-600 italic mt-0.5">Rejected: {c.rejectionReason}</div>
                          )}
                        </td>
                        <td className="py-4 px-6 font-mono font-bold text-amber-700">
                          +{c.creditDays}d
                        </td>
                        <td className="py-4 px-6 text-center whitespace-nowrap">
                          {c.status === 'APPROVED' && (
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Approved & Credited
                            </span>
                          )}
                          {c.status === 'PENDING' && (
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Pending Approval
                            </span>
                          )}
                          {c.status === 'REJECTED' && (
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Rejected
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right font-mono text-[11px] text-slate-500">
                          {c.approvedBy ? (
                            <div>
                              <div className="text-slate-800 font-semibold">{c.approvedBy}</div>
                              <div className="text-[10px] text-slate-400">
                                Expires: {c.expiryDate ? format(new Date(c.expiryDate), 'dd MMM yyyy') : '90 Days'}
                              </div>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6-TAB LEAVE POLICY BUILDER MODAL */}
      {/* ========================================================================= */}
      {editingType && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-scaleUp text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#a92427]" />
                  <span>{editingType.id ? `Edit Policy: ${editingType.name}` : 'Create Dynamic Leave Policy'}</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Configure demographic eligibility, accrual rates, carry forward, sandwich rules, and proofs.
                </p>
              </div>
              <button onClick={() => setEditingType(null)} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 6-Tab Strip */}
            <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
              {[
                { id: 1, label: '1. Basic & Category', icon: Palmtree },
                { id: 2, label: '2. Accrual & Cadence', icon: Clock },
                { id: 3, label: '3. Carry Over & Encash', icon: Award },
                { id: 4, label: '4. Demographics', icon: Users },
                { id: 5, label: '5. Application Limits', icon: FileCheck2 },
                { id: 6, label: '6. Sandwich & Financials', icon: DollarSign },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPolicyBuilderTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    policyBuilderTab === tab.id
                      ? 'bg-[#a92427] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleSavePolicy} className="space-y-4">
              {/* TAB 1: BASIC INFO & CATEGORY */}
              {policyBuilderTab === 1 && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Policy Display Name</label>
                      <input
                        type="text"
                        value={editingType.name}
                        onChange={(e) => setEditingType({ ...editingType, name: e.target.value })}
                        placeholder="e.g. Sabbatical Leave"
                        required
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Unique Short Code</label>
                      <input
                        type="text"
                        value={editingType.code}
                        onChange={(e) => setEditingType({ ...editingType, code: e.target.value.toUpperCase() })}
                        placeholder="e.g. SAB"
                        required
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Category Classification</label>
                      <select
                        value={editingType.category || 'Casual'}
                        onChange={(e) => setEditingType({ ...editingType, category: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                      >
                        {['Casual', 'Earned', 'Medical', 'Maternity', 'Paternity', 'Compensatory', 'LossOfPay', 'Sabbatical', 'Special', 'HalfDay'].map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Default Quota (Days / Year)</label>
                      <input
                        type="number"
                        value={editingType.defaultDaysPerYear ?? editingType.daysPerYear}
                        onChange={(e) => setEditingType({ ...editingType, defaultDaysPerYear: Number(e.target.value), daysPerYear: Number(e.target.value) })}
                        required
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Policy Description</label>
                    <textarea
                      value={editingType.description || ''}
                      onChange={(e) => setEditingType({ ...editingType, description: e.target.value })}
                      placeholder="Brief details explaining the intention and entitlement of this leave..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: ACCRUAL & CADENCE */}
              {policyBuilderTab === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <label className="flex items-center gap-2 font-bold text-slate-800 text-xs cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      checked={Boolean(editingType.accrualEnabled)}
                      onChange={(e) => setEditingType({ ...editingType, accrualEnabled: e.target.checked })}
                      className="rounded text-[#a92427]"
                    />
                    <span>Enable Periodic Accrual (Staff earn days over time rather than lump sum upfront)</span>
                  </label>

                  {editingType.accrualEnabled && (
                    <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Accrual Frequency</label>
                        <select
                          value={editingType.accrualFrequency || 'Monthly'}
                          onChange={(e) => setEditingType({ ...editingType, accrualFrequency: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200"
                        >
                          <option value="Monthly">Monthly (1st of every month)</option>
                          <option value="Quarterly">Quarterly</option>
                          <option value="HalfYearly">Half-Yearly</option>
                          <option value="Yearly">Yearly Pro-rata</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Accrual Credit per Cycle (Days)</label>
                        <input
                          type="number"
                          step="0.05"
                          value={editingType.accrualAmount || 1.0}
                          onChange={(e) => setEditingType({ ...editingType, accrualAmount: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-mono font-bold text-purple-700"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CARRY FORWARD & ENCASHMENT */}
              {policyBuilderTab === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <label className="flex items-center gap-2 font-bold text-slate-800 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingType.allowCarryForward)}
                        onChange={(e) => setEditingType({ ...editingType, allowCarryForward: e.target.checked })}
                        className="rounded text-[#a92427]"
                      />
                      <span>Allow Carry Forward to Next Year</span>
                    </label>

                    {editingType.allowCarryForward && (
                      <div className="grid grid-cols-3 gap-3 pt-2">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Max Carry Forward (Days)</label>
                          <input
                            type="number"
                            value={editingType.carryForwardLimit || 0}
                            onChange={(e) => setEditingType({ ...editingType, carryForwardLimit: Number(e.target.value) })}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Carried Days Expiry (Days)</label>
                          <input
                            type="number"
                            value={editingType.carryForwardExpiryDays || 365}
                            onChange={(e) => setEditingType({ ...editingType, carryForwardExpiryDays: Number(e.target.value) })}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Max Total Accumulation Cap</label>
                          <input
                            type="number"
                            value={editingType.maxAccumulation || 30}
                            onChange={(e) => setEditingType({ ...editingType, maxAccumulation: Number(e.target.value) })}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-mono font-bold text-purple-700"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <label className="flex items-center gap-2 font-bold text-slate-800 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingType.allowEncashment)}
                        onChange={(e) => setEditingType({ ...editingType, allowEncashment: e.target.checked })}
                        className="rounded text-[#a92427]"
                      />
                      <span>Allow Leave Encashment (Converted to salary payout)</span>
                    </label>

                    {editingType.allowEncashment && (
                      <div className="pt-2">
                        <label className="block font-bold text-slate-700 mb-1">Max Encashable Days per Year</label>
                        <input
                          type="number"
                          value={editingType.encashmentMaxDays || 0}
                          onChange={(e) => setEditingType({ ...editingType, encashmentMaxDays: Number(e.target.value) })}
                          className="w-48 px-3 py-2 rounded-xl bg-white border border-slate-200 font-mono"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: DEMOGRAPHICS & RESTRICTIONS */}
              {policyBuilderTab === 4 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Gender Eligibility</label>
                      <select
                        value={editingType.genderEligibility || 'All'}
                        onChange={(e) => setEditingType({ ...editingType, genderEligibility: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                      >
                        <option value="All">All Genders</option>
                        <option value="Male">Male Staff Only</option>
                        <option value="Female">Female Staff Only</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Min Service Tenure (Years)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={editingType.minServiceYears || 0}
                        onChange={(e) => setEditingType({ ...editingType, minServiceYears: Number(e.target.value) })}
                        placeholder="0 for immediate"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <label className="flex items-center gap-2 font-bold text-slate-800 text-xs cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <input
                        type="checkbox"
                        checked={Boolean(editingType.allowedDuringProbation)}
                        onChange={(e) => setEditingType({ ...editingType, allowedDuringProbation: e.target.checked })}
                        className="rounded text-[#a92427]"
                      />
                      <span>Allowed During Probation Period</span>
                    </label>

                    <label className="flex items-center gap-2 font-bold text-slate-800 text-xs cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <input
                        type="checkbox"
                        checked={Boolean(editingType.allowedDuringNoticePeriod)}
                        onChange={(e) => setEditingType({ ...editingType, allowedDuringNoticePeriod: e.target.checked })}
                        className="rounded text-[#a92427]"
                      />
                      <span>Allowed During Notice Period</span>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 5: APPLICATION CONSTRAINTS & PROOFS */}
              {policyBuilderTab === 5 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Min Days / Req</label>
                      <input
                        type="number"
                        value={editingType.minDaysAllowed || 1}
                        onChange={(e) => setEditingType({ ...editingType, minDaysAllowed: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Max Days / Req</label>
                      <input
                        type="number"
                        value={editingType.maxDaysAllowed || 30}
                        onChange={(e) => setEditingType({ ...editingType, maxDaysAllowed: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Max Consecutive</label>
                      <input
                        type="number"
                        value={editingType.maxConsecutiveDays || 5}
                        onChange={(e) => setEditingType({ ...editingType, maxConsecutiveDays: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Advance Notice (Days)</label>
                      <input
                        type="number"
                        value={editingType.priorNoticeDays || 0}
                        onChange={(e) => setEditingType({ ...editingType, priorNoticeDays: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <label className="flex items-center gap-2 font-bold text-slate-800 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingType.requireProofDocument || editingType.requiresMedicalCertificate)}
                        onChange={(e) => setEditingType({ ...editingType, requireProofDocument: e.target.checked, requiresMedicalCertificate: e.target.checked })}
                        className="rounded text-[#a92427]"
                      />
                      <span>Require Supporting Proof / Medical Certificate</span>
                    </label>

                    {(editingType.requireProofDocument || editingType.requiresMedicalCertificate) && (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Custom Document Label</label>
                          <input
                            type="text"
                            value={editingType.proofDocumentLabel || 'Doctor Prescription & Hospital Certificate'}
                            onChange={(e) => setEditingType({ ...editingType, proofDocumentLabel: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Required for Leaves &ge; (Days)</label>
                          <input
                            type="number"
                            value={editingType.proofThresholdDays || 1}
                            onChange={(e) => setEditingType({ ...editingType, proofThresholdDays: Number(e.target.value) })}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: SANDWICH RULE & FINANCIALS */}
              {policyBuilderTab === 6 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-1">
                    <label className="flex items-center gap-2 font-bold text-amber-950 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingType.applySandwichRule)}
                        onChange={(e) => setEditingType({ ...editingType, applySandwichRule: e.target.checked })}
                        className="rounded text-[#a92427]"
                      />
                      <span>Enforce Sandwich Rule</span>
                    </label>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      When active, any weekend off-days or public holidays that fall between the leave start date and end date are automatically treated and charged as leave days.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 font-bold text-slate-800 text-xs cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <input
                        type="checkbox"
                        checked={Boolean(editingType.isPaid)}
                        onChange={(e) => setEditingType({ ...editingType, isPaid: e.target.checked })}
                        className="rounded text-[#a92427]"
                      />
                      <span>Paid Leave (No salary deduction)</span>
                    </label>

                    <label className="flex items-center gap-2 font-bold text-slate-800 text-xs cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <input
                        type="checkbox"
                        checked={Boolean(editingType.allowNegativeBalance)}
                        onChange={(e) => setEditingType({ ...editingType, allowNegativeBalance: e.target.checked })}
                        className="rounded text-[#a92427]"
                      />
                      <span>Allow Negative Balance (Overdraft)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="text-slate-400 text-[11px]">
                  Configuring Tab {policyBuilderTab} of 6
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingType(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#a92427] hover:bg-[#8e1d20] text-white font-bold shadow-xs transition"
                  >
                    Save & Enforce Policy Rules
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* APPLY LEAVE MODAL WITH CANVAS CLIENT COMPRESSION */}
      {/* ========================================================================= */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-8 shadow-2xl space-y-5 animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Apply for Time Off</h3>
                <p className="text-xs text-slate-500">Rules and certificate mandates are enforced dynamically based on policy.</p>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleApply} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Leave Category</label>
                <select
                  value={applyForm.leaveTypeId}
                  onChange={(e) => setApplyForm({ ...applyForm, leaveTypeId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#a92427]"
                >
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              {selectedType && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                    <span>Active Policy: {selectedType.name}</span>
                    <span className="font-mono text-[#a92427]">
                      {advanceNoticeDays} day(s) advance notice given
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600">
                    <div>• Accrual: <strong>{selectedType.accrualEnabled ? `+${selectedType.accrualAmount}d/${selectedType.accrualFrequency}` : 'Upfront Quota'}</strong></div>
                    <div>• Advance Notice: <strong>{noticeRequired > 0 ? `${noticeRequired} day(s)` : 'None'}</strong></div>
                    <div>• Min Duration: <strong>{selectedType.minDaysAllowed || 1} day(s)</strong></div>
                    <div>• Max Consecutive: <strong>{selectedType.maxConsecutiveDays || 5} days</strong></div>
                  </div>

                  {selectedType.applySandwichRule && (
                    <div className="p-2 rounded-xl bg-amber-100/70 border border-amber-200 text-amber-900 text-[10px] font-semibold flex items-center gap-1.5 mt-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>Sandwich Policy Active: Any weekends or holidays falling within your dates are charged as leave.</span>
                    </div>
                  )}

                  {noticeViolation && (
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold flex items-center gap-1.5 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Policy Alert: Requires at least {noticeRequired} days advance notice. (Current: ${advanceNoticeDays}d).</span>
                    </div>
                  )}

                  {minDaysViolation && (
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold flex items-center gap-1.5 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Policy Alert: Minimum duration allowed is {selectedType.minDaysAllowed} days.</span>
                    </div>
                  )}

                  {maxDaysViolation && (
                    <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-semibold flex items-center gap-1.5 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Policy Alert: Exceeds max duration limit of {selectedType.maxDaysAllowed} days.</span>
                    </div>
                  )}

                  {(selectedType.code === 'COMP_OFF' || selectedType.category === 'Compensatory') && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5 mt-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                        <span className="flex items-center gap-1.5">
                          <Gift className="w-3.5 h-3.5 text-amber-700" />
                          <span>Comp-Off Balance Available:</span>
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-100 border border-amber-300 font-black">
                          {balances.find((b) => b.leaveType?.code === 'COMP_OFF')?.balance || 0} Day(s)
                        </span>
                      </div>
                      {(balances.find((b) => b.leaveType?.code === 'COMP_OFF')?.balance || 0) < computedDays ? (
                        <p className="text-[10px] text-rose-700 font-semibold leading-relaxed">
                          ⚠ Insufficient balance: You currently have {balances.find((b) => b.leaveType?.code === 'COMP_OFF')?.balance || 0} Comp-Off day(s) earned. Comp-Off is granted only after working on a weekend (Saturday/Sunday) or public holiday. Use the &quot;Comp-Off Desk&quot; to claim credit for weekend shifts worked.
                        </p>
                      ) : (
                        <p className="text-[10px] text-emerald-800 font-medium">
                          ✓ Sufficient Comp-Off balance. {computedDays} day(s) will be deducted upon approval.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={applyForm.startDate}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setApplyForm((prev) => ({
                        ...prev,
                        startDate: newStart,
                        endDate: prev.endDate < newStart ? newStart : prev.endDate,
                      }));
                    }}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#a92427]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    value={applyForm.endDate}
                    min={applyForm.startDate}
                    onChange={(e) => {
                      const newEnd = e.target.value;
                      if (newEnd >= applyForm.startDate) {
                        setApplyForm((prev) => ({ ...prev, endDate: newEnd }));
                      }
                    }}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#a92427]"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium">Requested Calendar Span:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{computedDays} Day(s)</span>
              </div>

              {isProofRequired && (
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-900 flex items-center gap-1.5">
                      <FileCheck2 className="w-4 h-4 text-amber-700" />
                      <span>{selectedType.proofDocumentLabel || 'Supporting Doctor Prescription / Certificate'}</span>
                    </label>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-full">
                      Mandatory Proof
                    </span>
                  </div>

                  {!uploadedDoc ? (
                    <div className="relative border-2 border-dashed border-amber-300 rounded-2xl p-5 text-center bg-white/70 hover:bg-white transition cursor-pointer group">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileSelect}
                        disabled={compressing}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="space-y-1.5">
                        <UploadCloud className="w-8 h-8 text-amber-600 mx-auto group-hover:scale-110 transition" />
                        <div className="font-bold text-slate-800 text-xs">
                          {compressing ? 'Compressing document...' : 'Click to Upload Document / Photo'}
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Prescriptions & certificates are automatically compressed to save storage.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-white border border-amber-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {uploadedDoc.dataUrl.startsWith('data:image/') ? (
                          <img
                            src={uploadedDoc.dataUrl}
                            alt="Preview"
                            className="w-12 h-12 rounded-lg object-cover border border-slate-200 shadow-2xs"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                            PDF
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900 truncate max-w-[200px]">{uploadedDoc.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              Compressed: {(uploadedDoc.compressedSize / 1024).toFixed(0)} KB
                            </span>
                            {uploadedDoc.compressionRatio > 0 && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({uploadedDoc.compressionRatio}% saved)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setUploadedDoc(null)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <input
                    type="text"
                    value={applyForm.proofDocumentNotes}
                    onChange={(e) => setApplyForm({ ...applyForm, proofDocumentNotes: e.target.value })}
                    placeholder="Optional reference notes (e.g. Dr. Name, Hospital Name, Rx #)..."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-amber-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Leave</label>
                <textarea
                  value={applyForm.reason}
                  onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                  placeholder="Explain why you are requesting time off..."
                  rows={2}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
                />
              </div>

              {(() => {
                const isCompOffActive = selectedType?.code === 'COMP_OFF' || selectedType?.category === 'Compensatory';
                const compOffBal = balances.find((b) => b.leaveType?.code === 'COMP_OFF')?.balance || 0;
                const isCompOffShortage = isCompOffActive && compOffBal < computedDays;

                return (
                  <button
                    type="submit"
                    disabled={submitting || compressing || isCompOffShortage}
                    className="w-full py-2.5 bg-[#a92427] hover:bg-[#8e1d20] text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting
                      ? 'Validating against Policy Engine...'
                      : isCompOffShortage
                      ? 'Cannot Submit: Insufficient Comp-Off Balance'
                      : 'Submit Application'}
                  </button>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* Reject Leave Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <h3 className="text-sm font-bold text-slate-900">Reason for Rejection</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Critical project sprint, please reschedule..."
              rows={3}
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                className="w-1/2 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
              >
                Confirm Reject
              </button>
              <button
                onClick={() => setRejectingId(null)}
                className="w-1/2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Document Viewer Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-600" />
                  <span>{previewDoc.name}</span>
                </h4>
                {previewDoc.employeeName && (
                  <p className="text-[11px] text-slate-500">Submitted by: {previewDoc.employeeName}</p>
                )}
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-50 rounded-2xl p-2 border border-slate-200">
              {previewDoc.url.startsWith('data:image/') ? (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.name}
                  className="max-h-[65vh] max-w-full rounded-xl object-contain shadow-xs"
                />
              ) : (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.name}
                  className="w-full h-[60vh] rounded-xl border"
                />
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Application Details Modal */}
      {selectedLeaveDetail && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scaleUp text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Palmtree className="w-4 h-4 text-[#a92427]" />
                  <span>Leave Application Details</span>
                </h4>
                <p className="text-[11px] text-slate-400">Complete time-off request breakdown and proof review</p>
              </div>
              <button
                onClick={() => setSelectedLeaveDetail(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block text-[10px]">Leave Type</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedLeaveDetail.leaveType?.name} ({selectedLeaveDetail.leaveType?.code})</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Days Charged</span>
                  <span className="font-bold font-mono text-purple-700 text-base">{selectedLeaveDetail.totalDays} day(s)</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Calendar Dates</span>
                <span className="font-bold text-slate-900 font-mono">
                  {format(new Date(selectedLeaveDetail.startDate), 'dd MMMM yyyy')} &rarr; {format(new Date(selectedLeaveDetail.endDate), 'dd MMMM yyyy')}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Current Status</span>
                <div className="mt-1">
                  {selectedLeaveDetail.status === 'APPROVED' && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Approved by Supervisor
                    </span>
                  )}
                  {selectedLeaveDetail.status === 'PENDING' && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Pending Supervisor Review
                    </span>
                  )}
                  {selectedLeaveDetail.status === 'REJECTED' && (
                    <div className="space-y-1">
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        Rejected
                      </span>
                      {selectedLeaveDetail.rejectionReason && (
                        <p className="text-[11px] text-rose-700 italic">Reason: {selectedLeaveDetail.rejectionReason}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Reason Given</span>
                <p className="text-slate-800 font-medium mt-1 leading-relaxed">{selectedLeaveDetail.reason}</p>
              </div>

              {selectedLeaveDetail.proofDocumentUrl && (
                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
                  <span className="text-amber-900 font-bold block text-[11px] flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-amber-700" />
                    <span>Uploaded Supporting Certificate / Proof</span>
                  </span>
                  <div className="max-h-52 overflow-hidden rounded-xl border border-amber-200 bg-white flex items-center justify-center p-2">
                    <img
                      src={selectedLeaveDetail.proofDocumentUrl}
                      alt="Supporting document"
                      className="max-h-48 max-w-full rounded-lg object-contain"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedLeaveDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CLAIM WEEKEND / HOLIDAY SHIFT COMP-OFF MODAL */}
      {/* ========================================================================= */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Gift className="w-5 h-5 text-amber-600" />
                  <span>Claim Weekend / Holiday Shift Credit</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Submit a Comp-Off credit request for working on a Saturday, Sunday, or declared holiday.
                </p>
              </div>
              <button onClick={() => setShowClaimModal(false)} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleClaimCompOff} className="space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Date Worked (Weekend / Holiday)</label>
                <input
                  type="date"
                  value={claimForm.workedDate}
                  onChange={(e) => setClaimForm({ ...claimForm, workedDate: e.target.value })}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Credit Requested</label>
                <select
                  value={claimForm.creditDays}
                  onChange={(e) => setClaimForm({ ...claimForm, creditDays: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold"
                >
                  <option value={1.0}>1.0 Full Day Comp-Off Credit (&gt; 7.5 hrs)</option>
                  <option value={0.5}>0.5 Half Day Comp-Off Credit (4 to 7.5 hrs)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tasks / Reason for Working on Off-Day</label>
                <textarea
                  value={claimForm.reason}
                  onChange={(e) => setClaimForm({ ...claimForm, reason: e.target.value })}
                  placeholder="e.g. Worked Saturday to compensate for upcoming Friday holiday / Server migration sprint..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[10px] space-y-0.5">
                <div className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-700" />
                  <span>Biometric Machine Verification Active</span>
                </div>
                <p>The system will automatically match your biometric terminal punch times when submitted for approval.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={compOffLoading}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs transition disabled:opacity-50"
                >
                  {compOffLoading ? 'Verifying & Submitting...' : 'Submit Comp-Off Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIRECT GRANT COMP-OFF MODAL (MANAGER / ADMIN) */}
      {/* ========================================================================= */}
      {showGrantModal && isManagerOrAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-600" />
                  <span>Direct Grant Comp-Off Leave Balance</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Manager/Admin override: Immediately credit Comp-Off days to an employee.
                </p>
              </div>
              <button onClick={() => setShowGrantModal(false)} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGrantCompOff} className="space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Employee</label>
                <select
                  value={grantForm.employeeId}
                  onChange={(e) => setGrantForm({ ...grantForm, employeeId: e.target.value })}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold"
                >
                  {allEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeCode || 'EMP'}) — {emp.department}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Worked Date</label>
                  <input
                    type="date"
                    value={grantForm.workedDate}
                    onChange={(e) => setGrantForm({ ...grantForm, workedDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Credit Amount</label>
                  <select
                    value={grantForm.creditDays}
                    onChange={(e) => setGrantForm({ ...grantForm, creditDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold font-mono text-amber-700"
                  >
                    <option value={1.0}>+1.0 Day</option>
                    <option value={0.5}>+0.5 Day</option>
                    <option value={2.0}>+2.0 Days</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Grant Note / Authorization Reason</label>
                <textarea
                  value={grantForm.reason}
                  onChange={(e) => setGrantForm({ ...grantForm, reason: e.target.value })}
                  placeholder="e.g. Authorized weekend hardware deployment / sudden holiday compensation..."
                  rows={2}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={compOffLoading}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-xs transition disabled:opacity-50"
                >
                  {compOffLoading ? 'Crediting Balance...' : 'Grant & Credit Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeavesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-semibold">Loading Leaves Desk...</div>}>
      <LeavesContent />
    </Suspense>
  );
}
