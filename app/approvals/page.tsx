'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Palmtree,
  FileCheck2,
  Download,
  Search,
  Filter,
  Check,
  X,
  Eye,
  AlertCircle,
  Calendar,
  Sparkles,
  Layers,
  ArrowRight,
  UserCheck,
  ShieldCheck,
  Building,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';

function ApprovalMobileCard({
  item,
  isSupervisor,
  actionLoading,
  onApprove,
  onReject,
  onChangeDecision,
  onInspect,
  onPreviewDoc,
}: {
  item: any;
  isSupervisor: boolean;
  actionLoading: boolean;
  onApprove: (item: any) => void;
  onReject: (item: any) => void;
  onChangeDecision: (item: any) => void;
  onInspect: (item: any) => void;
  onPreviewDoc?: (doc: any) => void;
}) {
  const isPending = item.status === 'PENDING';

  return (
    <div className="p-4 space-y-3 bg-white">
      {/* Category + Status Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          {item.category === 'LEAVE' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Palmtree className="w-3 h-3" />
              <span>Leave</span>
            </span>
          )}
          {item.category === 'REGULARIZATION' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <Clock className="w-3 h-3" />
              <span>Punch Regularization</span>
            </span>
          )}
          {item.category === 'PAYSLIP' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              <Download className="w-3 h-3" />
              <span>Payslip Authorization</span>
            </span>
          )}
        </div>

        <div>
          {item.status === 'APPROVED' && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Approved
            </span>
          )}
          {item.status === 'PENDING' && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Pending
            </span>
          )}
          {item.status === 'REJECTED' && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              Rejected
            </span>
          )}
        </div>
      </div>

      {/* Staff Identifier */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs shrink-0">
          {item.employeeName?.charAt(0) || 'E'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-900 text-sm truncate">{item.employeeName}</div>
          <div className="text-[11px] text-slate-400 font-mono truncate">
            {item.employeeCode} • {item.department}
          </div>
        </div>
      </div>

      {/* Item Details Box */}
      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
        <div className="font-bold text-slate-800">{item.title}</div>
        <div className="text-[11px] text-slate-500 font-mono">{item.subtitle}</div>
        {item.reason && (
          <div className="text-slate-600 mt-1.5 text-[11px] italic line-clamp-2">
            &ldquo;{item.reason}&rdquo;
          </div>
        )}
        {item.proofDocumentUrl && onPreviewDoc && (
          <button
            onClick={() => onPreviewDoc({ name: item.proofDocumentName || 'Proof Certificate', url: item.proofDocumentUrl, employeeName: item.employeeName })}
            className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold text-[10px] border border-blue-200"
          >
            <Eye className="w-3 h-3" />
            <span>View Proof Document</span>
          </button>
        )}
      </div>

      {/* Managerial Attribution / Decision Remark */}
      {(item.approvedByName || item.rejectionReason) && (
        <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-[11px] space-y-0.5">
          {item.approvedByName && (
            <div className="text-slate-700">
              Actioned by: <strong>{item.approvedByName}</strong>
              {item.reviewedAt && (
                <span className="text-slate-400 font-mono ml-1">
                  ({format(new Date(item.reviewedAt), 'dd MMM, HH:mm')})
                </span>
              )}
            </div>
          )}
          {item.rejectionReason && (
            <div className="text-rose-700 font-medium">
              Reason: &ldquo;{item.rejectionReason}&rdquo;
            </div>
          )}
        </div>
      )}

      {/* Action Toolbar (Touch-friendly & prominent) */}
      <div className="flex items-center gap-2 pt-1">
        {isPending ? (
          <>
            <button
              onClick={() => onApprove(item)}
              disabled={actionLoading}
              className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>Approve</span>
            </button>
            <button
              onClick={() => onReject(item)}
              disabled={actionLoading}
              className="flex-1 py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              <span>Reject</span>
            </button>
          </>
        ) : (
          isSupervisor && (
            <button
              onClick={() => onChangeDecision(item)}
              disabled={actionLoading}
              className="flex-1 py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-800 border border-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50 shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
              <span>Change Decision</span>
            </button>
          )
        )}
        <button
          onClick={() => onInspect(item)}
          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition shrink-0"
          title="Inspect full details"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<'ALL' | 'LEAVES' | 'REGULARIZATIONS' | 'PAYSLIPS'>('ALL');
  const [leaves, setLeaves] = useState<any[]>([]);
  const [regularizations, setRegularizations] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  // Detail & Action Modals
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ name: string; url: string; employeeName?: string } | null>(null);
  const [rejectingItem, setRejectingItem] = useState<{ type: 'LEAVE' | 'REG' | 'PAYSLIP'; id: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [changeDecisionItem, setChangeDecisionItem] = useState<any | null>(null);
  const [newDecisionAction, setNewDecisionAction] = useState<'APPROVED' | 'REJECTED' | 'PENDING'>('APPROVED');
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Date Range Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState('ALL');

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      const today = format(now, 'yyyy-MM-dd');
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'THIS_MONTH') {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      setStartDate(`${y}-${m}-01`);
      setEndDate(`${y}-${m}-${lastDay}`);
    } else if (preset === 'LAST_30_DAYS') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(format(past30, 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
    } else if (preset === 'LAST_3_MONTHS') {
      const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      setStartDate(format(past90, 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
    }
  };

  const fetchAllApprovals = async () => {
    setLoading(true);
    try {
      const [meRes, lRes, rRes, pRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/leaves'),
        fetch('/api/attendance/regularize'),
        fetch('/api/payroll/download-approval'),
      ]);

      const meJson = await meRes.json();
      const lJson = await lRes.json();
      const rJson = await rRes.json();
      const pJson = await pRes.json();

      if (meJson.success) setCurrentUser(meJson.data.user);
      if (lJson.success) setLeaves(lJson.data?.requests || []);
      if (rJson.success) setRegularizations(rJson.data || []);
      if (pJson.success) setPayslips(pJson.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllApprovals();

    const handleHrmsRefresh = () => {
      fetchAllApprovals();
    };
    window.addEventListener('hrms-refresh', handleHrmsRefresh);
    return () => window.removeEventListener('hrms-refresh', handleHrmsRefresh);
  }, []);

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

  const handleApproveLeave = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/leaves/${id}/approve`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Leave request approved successfully!', 'success');
        fetchAllApprovals();
        if (selectedItem?.id === id) setSelectedItem(null);
      } else {
        showToast(json.error?.message || 'Approval failed', 'error');
      }
    } catch {
      showToast('Network error approving leave', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveReg = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/attendance/regularize', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'APPROVE' }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Attendance correction approved and punch times updated!', 'success');
        fetchAllApprovals();
        if (selectedItem?.id === id) setSelectedItem(null);
      } else {
        showToast(json.error?.message || 'Approval failed', 'error');
      }
    } catch {
      showToast('Network error approving attendance correction', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprovePayslip = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/payroll/download-approval', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'APPROVE' }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Payslip download authorized successfully!', 'success');
        fetchAllApprovals();
        if (selectedItem?.id === id) setSelectedItem(null);
      } else {
        showToast(json.error?.message || 'Approval failed', 'error');
      }
    } catch {
      showToast('Network error approving payslip download', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingItem) return;
    if (!rejectionReason.trim()) {
      showToast('Please provide a reason for rejection.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      if (rejectingItem.type === 'LEAVE') {
        await fetch(`/api/leaves/${rejectingItem.id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rejectionReason }),
        });
      } else if (rejectingItem.type === 'REG') {
        await fetch('/api/attendance/regularize', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: rejectingItem.id, action: 'REJECT', rejectionReason }),
        });
      } else if (rejectingItem.type === 'PAYSLIP') {
        await fetch('/api/payroll/download-approval', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: rejectingItem.id, action: 'REJECT', rejectionReason }),
        });
      }
      showToast('Request rejected with feedback note.', 'success');
      setRejectingItem(null);
      setRejectionReason('');
      if (selectedItem?.id === rejectingItem.id) setSelectedItem(null);
      fetchAllApprovals();
    } catch {
      showToast('Network error rejecting request', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmChangeDecision = async () => {
    if (!changeDecisionItem) return;
    if (!decisionRemarks.trim()) {
      showToast('Please provide a reason or note for changing the decision.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      if (changeDecisionItem.category === 'LEAVE') {
        const res = await fetch(`/api/leaves/${changeDecisionItem.id}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: newDecisionAction, rejectionReason: decisionRemarks }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message || 'Failed to update decision');
      } else if (changeDecisionItem.category === 'REGULARIZATION') {
        const actionCode = newDecisionAction === 'APPROVED' ? 'APPROVE' : newDecisionAction === 'REJECTED' ? 'REJECT' : 'REVERT';
        const res = await fetch('/api/attendance/regularize', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: changeDecisionItem.id, action: actionCode, rejectionReason: decisionRemarks }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message || 'Failed to update decision');
      } else if (changeDecisionItem.category === 'PAYSLIP') {
        const actionCode = newDecisionAction === 'APPROVED' ? 'APPROVE' : newDecisionAction === 'REJECTED' ? 'REJECT' : 'REVERT';
        const res = await fetch('/api/payroll/download-approval', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: changeDecisionItem.id, action: actionCode, rejectionReason: decisionRemarks }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message || 'Failed to update decision');
      }

      showToast(`Decision updated to ${newDecisionAction.toLowerCase()} successfully!`, 'success');
      setChangeDecisionItem(null);
      setDecisionRemarks('');
      if (selectedItem?.id === changeDecisionItem.id) setSelectedItem(null);
      fetchAllApprovals();
    } catch (err: any) {
      showToast(err.message || 'Error updating decision', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDirectApprove = (item: any) => {
    if (item.category === 'LEAVE') handleApproveLeave(item.id);
    else if (item.category === 'REGULARIZATION') handleApproveReg(item.id);
    else if (item.category === 'PAYSLIP') handleApprovePayslip(item.id);
  };

  const handleDirectReject = (item: any) => {
    setRejectingItem({
      type: item.category === 'LEAVE' ? 'LEAVE' : item.category === 'REGULARIZATION' ? 'REG' : 'PAYSLIP',
      id: item.id,
    });
    setRejectionReason('');
  };

  const handleOpenChangeDecision = (item: any) => {
    setChangeDecisionItem(item);
    setNewDecisionAction(item.status === 'APPROVED' ? 'REJECTED' : 'APPROVED');
    setDecisionRemarks('');
  };

  // Build unified items list
  const allItems = useMemo(() => {
    const unified: any[] = [];

    leaves.forEach((l) => {
      unified.push({
        id: l.id,
        category: 'LEAVE',
        employeeId: l.employeeId,
        employeeName: l.employee?.name || 'Employee',
        employeeCode: l.employee?.employeeCode || 'EMP',
        department: l.employee?.department || 'Operations',
        title: `${l.leaveType?.name || 'Leave'} (${l.totalDays} day${l.totalDays > 1 ? 's' : ''})`,
        subtitle: `${format(new Date(l.startDate), 'dd MMM')} - ${format(new Date(l.endDate), 'dd MMM yyyy')}`,
        reason: l.reason,
        proofDocumentUrl: l.proofDocumentUrl,
        proofDocumentName: l.proofDocumentName,
        status: l.status,
        rejectionReason: l.rejectionReason,
        decisionRemarks: l.decisionRemarks || l.rejectionReason,
        approvedById: l.approvedById,
        approvedByName: l.approvedByName || l.approvedBy || l.approvedById,
        approvedByRole: l.approvedByRole || 'Admin',
        reviewedAt: l.reviewedAt,
        createdAt: l.createdAt,
        rawItem: l,
      });
    });

    regularizations.forEach((r) => {
      unified.push({
        id: r.id,
        category: 'REGULARIZATION',
        employeeId: r.employeeId,
        employeeName: r.employeeName || 'Employee',
        employeeCode: r.employeeCode || 'EMP',
        department: r.department || 'Operations',
        title: `Attendance Time Correction (${format(new Date(r.date), 'dd MMM yyyy')})`,
        subtitle: `Req: ${r.requestedCheckIn || '--:--'} - ${r.requestedCheckOut || '--:--'} (Rec: ${r.recordedCheckIn || 'None'})`,
        reason: r.reason,
        status: r.status,
        rejectionReason: r.rejectionReason,
        decisionRemarks: r.decisionRemarks || r.rejectionReason,
        approvedById: r.reviewedBy,
        approvedByName: r.reviewedByName || r.reviewedBy,
        approvedByRole: r.reviewedByRole || 'Supervisor',
        reviewedAt: r.reviewedAt,
        createdAt: r.createdAt,
        rawItem: r,
      });
    });

    payslips.forEach((p) => {
      unified.push({
        id: p.id,
        category: 'PAYSLIP',
        employeeId: p.employeeId,
        employeeName: p.employeeName || 'Employee',
        employeeCode: p.employeeCode || 'EMP',
        department: p.department || 'Operations',
        title: `Official Payslip Download Sign-Off`,
        subtitle: `Cycle: Month ${p.month}/${p.year}`,
        reason: 'Employee requested authorized PDF download',
        status: p.status,
        rejectionReason: p.rejectionReason,
        decisionRemarks: p.decisionRemarks || p.rejectionReason,
        approvedById: p.reviewedBy,
        approvedByName: p.reviewedByName || p.reviewedBy,
        approvedByRole: p.reviewedByRole || 'Supervisor',
        reviewedAt: p.reviewedAt,
        createdAt: p.requestedAt,
        rawItem: p,
      });
    });

    // Sort newest first
    return unified.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [leaves, regularizations, payslips]);

  // Counts
  const pendingLeavesCount = leaves.filter((r) => r.status === 'PENDING').length;
  const pendingRegsCount = regularizations.filter((r) => r.status === 'PENDING').length;
  const pendingPayslipsCount = payslips.filter((r) => r.status === 'PENDING').length;
  const totalPendingCount = pendingLeavesCount + pendingRegsCount + pendingPayslipsCount;

  const totalApprovedCount = allItems.filter((i) => i.status === 'APPROVED').length;
  const totalRejectedCount = allItems.filter((i) => i.status === 'REJECTED').length;
  const totalAllCount = allItems.length;

  // Item date extractor
  const getItemDate = (item: any) => {
    if (item.date) return item.date;
    if (item.startDate) return item.startDate.split('T')[0];
    if (item.createdAt) {
      try {
        return new Date(item.createdAt).toISOString().split('T')[0];
      } catch {}
    }
    return '';
  };

  // Filter unified items
  const filteredAllItems = allItems.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const dStr = getItemDate(item);
    const matchesDate = (!startDate || (dStr && dStr >= startDate)) && (!endDate || (dStr && dStr <= endDate));

    return matchesSearch && matchesStatus && matchesDate;
  });

  const isSupervisor = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_ADMIN' || currentUser?.role === 'MANAGER';
  const isEmployee = !!currentUser && !isSupervisor;

  // ── Employee Self-Service Portal ──────────────────────────────────────────
  if (isEmployee) {
    const myPendingCount  = allItems.filter((i) => i.status === 'PENDING').length;
    const myApprovedCount = allItems.filter((i) => i.status === 'APPROVED').length;
    const myRejectedCount = allItems.filter((i) => i.status === 'REJECTED').length;

    const myFiltered = allItems.filter((item) => {
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const dStr = (() => {
        if (item.date) return item.date;
        if (item.createdAt) { try { return new Date(item.createdAt).toISOString().split('T')[0]; } catch {} }
        return '';
      })();
      const matchesDate = (!startDate || (dStr && dStr >= startDate)) && (!endDate || (dStr && dStr <= endDate));
      const matchesSearch = !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subtitle?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesDate && matchesSearch;
    });

    const StatusBadge = ({ status }: { status: string }) => {
      if (status === 'APPROVED')
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Approved</span>;
      if (status === 'REJECTED')
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1"><XCircle className="w-3 h-3" />Rejected</span>;
      return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1"><Clock className="w-3 h-3" />Pending Review</span>;
    };

    const CategoryBadge = ({ category }: { category: string }) => {
      if (category === 'LEAVE')
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><Palmtree className="w-3 h-3" />Leave</span>;
      if (category === 'REGULARIZATION')
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"><Clock className="w-3 h-3" />Punch Fix</span>;
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200"><Download className="w-3 h-3" />Payslip</span>;
    };

    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fadeIn relative">
        {/* Toast */}
        {toast.show && (
          <div className="fixed top-6 right-6 z-50 animate-fadeIn">
            <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-xs font-bold border ${toast.type === 'success' ? 'bg-emerald-900/95 text-emerald-100 border-emerald-500/30' : 'bg-rose-900/95 text-rose-100 border-rose-500/30'}`}>
              {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              <span>{toast.message}</span>
              <button onClick={() => setToast({ show: false, message: '', type: 'success' })} className="ml-2 text-slate-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                My Requests Portal
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <FileCheck2 className="w-6 h-6 sm:w-7 sm:h-7 text-[#a92427]" />
              My Request History &amp; Status
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Track all your submitted Leave Applications, Attendance Corrections, and Payslip Authorizations — along with who reviewed them and their final decision.
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold font-mono shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>{myPendingCount} Awaiting Review</span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div onClick={() => setStatusFilter('PENDING')} className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs cursor-pointer hover:border-amber-400 transition group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pending</span>
              <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-amber-700">{myPendingCount}</div>
          </div>
          <div onClick={() => setStatusFilter('APPROVED')} className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs cursor-pointer hover:border-emerald-400 transition group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Approved</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-700">{myApprovedCount}</div>
          </div>
          <div onClick={() => setStatusFilter('REJECTED')} className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs cursor-pointer hover:border-rose-400 transition group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Rejected</span>
              <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition">
                <XCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-rose-700">{myRejectedCount}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 whitespace-nowrap ${
                  statusFilter === s
                    ? s === 'PENDING' ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/30'
                      : s === 'APPROVED' ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/30'
                      : s === 'REJECTED' ? 'bg-rose-600 text-white ring-2 ring-rose-500/30'
                      : 'bg-slate-900 text-white ring-2 ring-slate-700/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s === 'ALL' ? 'All' : s === 'PENDING' ? 'Pending' : s === 'APPROVED' ? 'Approved' : 'Rejected'}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative ml-auto">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#a92427] w-44"
            />
          </div>

          {/* Date Preset */}
          <select
            value={datePreset}
            onChange={(e) => handleDatePresetChange(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Time</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="LAST_30_DAYS">Last 30 Days</option>
            <option value="LAST_3_MONTHS">Last 3 Months</option>
          </select>

          <span className="text-xs text-slate-400 font-mono ml-1">{myFiltered.length} record{myFiltered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Requests List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-slate-400 text-xs">Loading your requests...</div>
          ) : myFiltered.length === 0 ? (
            <div className="p-16 text-center space-y-2">
              <FileCheck2 className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-700">No Requests Found</div>
              <p className="text-xs text-slate-400">
                {statusFilter === 'PENDING'
                  ? "You don't have any pending requests awaiting review."
                  : statusFilter === 'APPROVED'
                  ? "No approved requests found for the selected period."
                  : statusFilter === 'REJECTED'
                  ? "No rejected requests found for the selected period."
                  : "You haven't submitted any requests yet."}
              </p>
            </div>
          ) : (
            <div>
              {/* Mobile Cards (< md) */}
              <div className="md:hidden divide-y divide-slate-100">
                {myFiltered.map((item) => (
                  <div key={`emp-m-${item.category}-${item.id}`} className="p-4 space-y-3 bg-white">
                    <div className="flex items-center justify-between">
                      <CategoryBadge category={item.category} />
                      <StatusBadge status={item.status} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{item.title}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{item.subtitle}</div>
                    </div>
                    {item.reason && (
                      <div className="text-[11px] text-slate-600 italic bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                        &ldquo;{item.reason}&rdquo;
                      </div>
                    )}
                    {/* Approver Attribution */}
                    {item.approvedByName && item.status !== 'PENDING' && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] border ${item.status === 'APPROVED' ? 'bg-emerald-50/70 border-emerald-200/60 text-emerald-800' : 'bg-rose-50/70 border-rose-200/60 text-rose-800'}`}>
                        <UserCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {item.status === 'APPROVED' ? 'Approved' : 'Reviewed'} by <strong>{item.approvedByName}</strong>
                          {item.approvedByRole && ` (${item.approvedByRole})`}
                          {item.reviewedAt && ` · ${format(new Date(item.reviewedAt), 'dd MMM yyyy')}`}
                        </span>
                      </div>
                    )}
                    {item.decisionRemarks && item.status !== 'PENDING' && (
                      <div className="text-[11px] text-rose-700 bg-rose-50/70 px-3 py-2 rounded-xl border border-rose-200/60">
                        <span className="font-bold">Remarks:</span> {item.decisionRemarks}
                      </div>
                    )}
                    <div className="flex justify-end">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-4 px-5">Type</th>
                      <th className="py-4 px-5">Request Details</th>
                      <th className="py-4 px-5">Submitted On</th>
                      <th className="py-4 px-5 text-center">Status</th>
                      <th className="py-4 px-5">Reviewed By</th>
                      <th className="py-4 px-5">Remarks</th>
                      <th className="py-4 px-5 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {myFiltered.map((item) => (
                      <tr key={`emp-${item.category}-${item.id}`} className="hover:bg-slate-50/80 transition group">
                        <td className="py-4 px-5 whitespace-nowrap">
                          <CategoryBadge category={item.category} />
                        </td>
                        <td className="py-4 px-5">
                          <div className="font-bold text-slate-900">{item.title}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{item.subtitle}</div>
                          {item.reason && (
                            <div className="text-[11px] text-slate-500 italic mt-1 max-w-xs truncate" title={item.reason}>
                              &ldquo;{item.reason}&rdquo;
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-5 font-mono text-slate-500 whitespace-nowrap">
                          {item.createdAt ? format(new Date(item.createdAt), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="py-4 px-5 text-center whitespace-nowrap">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="py-4 px-5">
                          {item.approvedByName && item.status !== 'PENDING' ? (
                            <div>
                              <div className="font-bold text-slate-800 flex items-center gap-1">
                                <UserCheck className="w-3 h-3 text-slate-500" />
                                {item.approvedByName}
                              </div>
                              {item.approvedByRole && (
                                <div className="text-[10px] text-slate-400 mt-0.5">{item.approvedByRole}</div>
                              )}
                              {item.reviewedAt && (
                                <div className="text-[10px] text-slate-400 font-mono">{format(new Date(item.reviewedAt), 'dd MMM yyyy, hh:mm a')}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-[11px]">Awaiting review</span>
                          )}
                        </td>
                        <td className="py-4 px-5 max-w-xs">
                          {item.decisionRemarks && item.status !== 'PENDING' ? (
                            <div className="text-[11px] text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200/60 truncate max-w-[180px]" title={item.decisionRemarks}>
                              {item.decisionRemarks}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] transition"
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
            </div>
          )}
        </div>

        {/* Inspection Modal (read-only for employee) */}
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-[#a92427]" />
                  Request Details
                </h3>
                <button onClick={() => setSelectedItem(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CategoryBadge category={selectedItem.category} />
                  <StatusBadge status={selectedItem.status} />
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5 border border-slate-100">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Request</div>
                    <div className="font-bold text-slate-900 text-sm">{selectedItem.title}</div>
                    <div className="text-xs text-slate-500 font-mono">{selectedItem.subtitle}</div>
                  </div>
                  {selectedItem.reason && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Reason Provided</div>
                      <div className="text-xs text-slate-700 italic">&ldquo;{selectedItem.reason}&rdquo;</div>
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Submitted On</div>
                    <div className="text-xs font-mono text-slate-700">
                      {selectedItem.createdAt ? format(new Date(selectedItem.createdAt), 'dd MMM yyyy, hh:mm a') : '—'}
                    </div>
                  </div>
                </div>

                {/* Review Trail */}
                {selectedItem.status !== 'PENDING' && (
                  <div className={`rounded-2xl p-4 border space-y-2 ${selectedItem.status === 'APPROVED' ? 'bg-emerald-50/70 border-emerald-200' : 'bg-rose-50/70 border-rose-200'}`}>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      {selectedItem.status === 'APPROVED'
                        ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span className="text-emerald-700">Approval Trail</span></>
                        : <><XCircle className="w-3.5 h-3.5 text-rose-600" /><span className="text-rose-700">Rejection Trail</span></>
                      }
                    </div>
                    {selectedItem.approvedByName && (
                      <div className="flex items-center gap-2 text-xs">
                        <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>
                          <strong>{selectedItem.approvedByName}</strong>
                          {selectedItem.approvedByRole && <span className="text-slate-500"> ({selectedItem.approvedByRole})</span>}
                        </span>
                      </div>
                    )}
                    {selectedItem.reviewedAt && (
                      <div className="text-[11px] text-slate-500 font-mono pl-5">
                        {format(new Date(selectedItem.reviewedAt), 'dd MMM yyyy, hh:mm a')}
                      </div>
                    )}
                    {selectedItem.decisionRemarks && (
                      <div className="text-xs text-slate-700 bg-white/70 rounded-xl px-3 py-2 border border-white/80 mt-1">
                        <span className="font-bold text-slate-600">Remarks: </span>
                        {selectedItem.decisionRemarks}
                      </div>
                    )}
                  </div>
                )}

                {selectedItem.status === 'PENDING' && (
                  <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-800">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Your request is currently <strong>awaiting review</strong> by your manager or HR team. You'll be notified once a decision is made.</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Doc Preview Modal */}
        {previewDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-5 space-y-4 max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-900">{previewDoc.name}</span>
                <button onClick={() => setPreviewDoc(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
              </div>
              <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-50 rounded-2xl p-2 border border-slate-200">
                <img src={previewDoc.url} alt={previewDoc.name} className="max-h-[65vh] max-w-full rounded-xl object-contain" />
              </div>
              <div className="flex justify-end">
                <button onClick={() => setPreviewDoc(null)} className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  // ── End Employee Self-Service Portal ──────────────────────────────────────

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

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#a92427]/10 text-[#a92427] border border-[#a92427]/20">
              Unified Approvals Hub
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              Multi-Domain Sign-off Console
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-[#a92427]" />
            Workforce Approvals & Regularizations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            One unified command center to review, inspect, and approve all Leave Applications, Attendance Punch Regularizations, and Payslip Download Authorizations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold font-mono">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>{totalPendingCount} Sign-offs Pending</span>
          </div>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div
          onClick={() => { setActiveTab('ALL'); setStatusFilter('PENDING'); }}
          className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs cursor-pointer hover:border-[#a92427]/50 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">All Pending</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-[#a92427] group-hover:text-white transition">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 mt-1 sm:mt-2">{totalPendingCount}</div>
          <div className="text-[9px] sm:text-[10px] text-slate-400 mt-1">Across all workforce domains</div>
        </div>

        <div
          onClick={() => { setActiveTab('LEAVES'); setStatusFilter('PENDING'); }}
          className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs cursor-pointer hover:border-emerald-400 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Leave Applications</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition">
              <Palmtree className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-700 mt-1 sm:mt-2">{pendingLeavesCount}</div>
          <div className="text-[9px] sm:text-[10px] text-slate-400 mt-1">CL, SL, EL & Medical Leaves</div>
        </div>

        <div
          onClick={() => { setActiveTab('REGULARIZATIONS'); setStatusFilter('PENDING'); }}
          className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs cursor-pointer hover:border-blue-400 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-blue-600 uppercase tracking-wider">Punch Adjustments</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-blue-700 mt-1 sm:mt-2">{pendingRegsCount}</div>
          <div className="text-[9px] sm:text-[10px] text-slate-400 mt-1">Biometric regularizations</div>
        </div>

        <div
          onClick={() => { setActiveTab('PAYSLIPS'); setStatusFilter('PENDING'); }}
          className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs cursor-pointer hover:border-purple-400 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-purple-600 uppercase tracking-wider">Payslip Clearance</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition">
              <Download className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-purple-700 mt-1 sm:mt-2">{pendingPayslipsCount}</div>
          <div className="text-[9px] sm:text-[10px] text-slate-400 mt-1">Authorized PDF export requests</div>
        </div>
      </div>

      {/* Primary Tab Navigator & Filter Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80 overflow-x-auto max-w-full no-scrollbar">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap ${
                activeTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 text-[#a92427]" />
              <span>All Approvals Feed</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 text-slate-700">
                {totalPendingCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('LEAVES')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap ${
                activeTab === 'LEAVES'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Palmtree className="w-4 h-4 text-emerald-600" />
              <span>Leave Approvals</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 text-slate-700">
                {pendingLeavesCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('REGULARIZATIONS')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap ${
                activeTab === 'REGULARIZATIONS'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Attendance Approvals</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 text-slate-700">
                {pendingRegsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('PAYSLIPS')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap ${
                activeTab === 'PAYSLIPS'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Download className="w-4 h-4 text-purple-600" />
              <span>Payslip Approvals</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 text-slate-700">
                {pendingPayslipsCount}
              </span>
            </button>
          </div>

          {/* Search, Date Range & Status Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search staff, code, dept..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
              />
            </div>

            {/* Date Preset Dropdown */}
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
              <option value="LAST_3_MONTHS">Last 3 Months</option>
            </select>

            {/* Date Pickers */}
            <div className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-xl border border-slate-200">
              <input
                type="date"
                value={startDate}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('CUSTOM');
                }}
                className="text-xs font-mono bg-transparent text-slate-700 focus:outline-none"
                title="From Date"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('CUSTOM');
                }}
                className="text-xs font-mono bg-transparent text-slate-700 focus:outline-none"
                title="To Date"
              />
              {(startDate || endDate || searchQuery || statusFilter !== 'PENDING') && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setDatePreset('ALL');
                    setSearchQuery('');
                    setStatusFilter('PENDING');
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                  title="Reset Filters"
                >
                  Reset
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Prominent Status Pill Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Approval Status:
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-500 text-slate-950 font-black ring-2 ring-amber-500/30'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending Review</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${statusFilter === 'PENDING' ? 'bg-amber-600 text-slate-950 font-bold' : 'bg-slate-100 text-slate-600'}`}>
                {totalPendingCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('APPROVED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs ${
                statusFilter === 'APPROVED'
                  ? 'bg-emerald-600 text-white font-black ring-2 ring-emerald-600/30'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approved (History)</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${statusFilter === 'APPROVED' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {totalApprovedCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('REJECTED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs ${
                statusFilter === 'REJECTED'
                  ? 'bg-rose-600 text-white font-black ring-2 ring-rose-600/30'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Rejected (History)</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${statusFilter === 'REJECTED' ? 'bg-rose-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {totalRejectedCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white font-black ring-2 ring-slate-900/30'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Feed</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${statusFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {totalAllCount}
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Showing <strong>{filteredAllItems.length}</strong> record{filteredAllItems.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Main Approvals Tables Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs">Loading workforce approvals...</div>
        ) : (
          <div>
            {/* ========================================================================= */}
            {/* TAB 1: ALL APPROVALS (UNIFIED FEED) */}
            {/* ========================================================================= */}
            {activeTab === 'ALL' && (
              <div>
                {filteredAllItems.length === 0 ? (
                  <div className="p-16 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                    <div className="text-sm font-bold text-slate-800">All Caught Up!</div>
                    <p className="text-xs text-slate-400">No requests match the current status filter.</p>
                  </div>
                ) : (
                  <div>
                    {/* Mobile Feed (< md) */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {filteredAllItems.map((item) => (
                        <ApprovalMobileCard
                          key={`${item.category}-${item.id}`}
                          item={item}
                          isSupervisor={isSupervisor}
                          actionLoading={actionLoading}
                          onApprove={handleDirectApprove}
                          onReject={handleDirectReject}
                          onChangeDecision={handleOpenChangeDecision}
                          onInspect={setSelectedItem}
                          onPreviewDoc={setPreviewDoc}
                        />
                      ))}
                    </div>

                    {/* Desktop Data Table (>= md) */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                          <th className="py-4 px-6">Domain Type</th>
                          <th className="py-4 px-6">Employee</th>
                          <th className="py-4 px-6">Request Details</th>
                          <th className="py-4 px-6">Explanation / Reason</th>
                          <th className="py-4 px-6 text-center">Status</th>
                          <th className="py-4 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredAllItems.map((item) => {
                          const isPending = item.status === 'PENDING';
                          return (
                            <tr key={`${item.category}-${item.id}`} className="hover:bg-slate-50/80 transition">
                              <td className="py-4 px-6 whitespace-nowrap">
                                {item.category === 'LEAVE' && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Palmtree className="w-3.5 h-3.5" />
                                    <span>Leave</span>
                                  </span>
                                )}
                                {item.category === 'REGULARIZATION' && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>Punch Adjust</span>
                                  </span>
                                )}
                                {item.category === 'PAYSLIP' && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Payslip</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-6">
                                <div className="font-bold text-slate-900">{item.employeeName}</div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {item.employeeCode} • {item.department}
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <div className="font-bold text-slate-800">{item.title}</div>
                                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{item.subtitle}</div>
                              </td>
                              <td className="py-4 px-6 max-w-xs text-slate-600">
                                <div className="truncate" title={item.reason}>{item.reason}</div>
                                {item.proofDocumentUrl && (
                                  <button
                                    onClick={() => setPreviewDoc({ name: item.proofDocumentName || 'Certificate', url: item.proofDocumentUrl, employeeName: item.employeeName })}
                                    className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-semibold transition"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>View Attached Proof</span>
                                  </button>
                                )}
                                {item.rejectionReason && (
                                  <div className="text-[10px] text-rose-600 italic mt-0.5">Rejected: {item.rejectionReason}</div>
                                )}
                              </td>
                              <td className="py-4 px-6 text-center whitespace-nowrap">
                                {item.status === 'APPROVED' && (
                                  <div>
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Approved
                                    </span>
                                    {item.approvedByName && (
                                      <div className="text-[10px] text-emerald-700 font-medium mt-1">
                                        by {item.approvedByName}
                                      </div>
                                    )}
                                    {item.reviewedAt && (
                                      <div className="text-[9px] text-slate-400 font-mono">
                                        {format(new Date(item.reviewedAt), 'dd MMM, HH:mm')}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {item.status === 'PENDING' && (
                                  <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Pending Review
                                  </span>
                                )}
                                {item.status === 'REJECTED' && (
                                  <div>
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      Rejected
                                    </span>
                                    {item.approvedByName && (
                                      <div className="text-[10px] text-rose-700 font-medium mt-1">
                                        by {item.approvedByName}
                                      </div>
                                    )}
                                    {item.rejectionReason && (
                                      <div className="text-[9px] text-rose-600 italic truncate max-w-[130px] mx-auto mt-0.5" title={item.rejectionReason}>
                                        "{item.rejectionReason}"
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-6 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setSelectedItem(item)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                                    title="View full details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>

                                  {isSupervisor && isPending && (
                                    <>
                                      <button
                                        onClick={() => {
                                          if (item.category === 'LEAVE') handleApproveLeave(item.id);
                                          else if (item.category === 'REGULARIZATION') handleApproveReg(item.id);
                                          else if (item.category === 'PAYSLIP') handleApprovePayslip(item.id);
                                        }}
                                        disabled={actionLoading}
                                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1 shadow-2xs"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Approve</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          setRejectingItem({
                                            type: item.category === 'LEAVE' ? 'LEAVE' : item.category === 'REGULARIZATION' ? 'REG' : 'PAYSLIP',
                                            id: item.id,
                                          });
                                          setRejectionReason('');
                                        }}
                                        disabled={actionLoading}
                                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        <span>Reject</span>
                                      </button>
                                    </>
                                  )}

                                  {isSupervisor && !isPending && (
                                    <button
                                      onClick={() => {
                                        setChangeDecisionItem(item);
                                        setNewDecisionAction(item.status === 'APPROVED' ? 'REJECTED' : 'APPROVED');
                                        setDecisionRemarks('');
                                      }}
                                      disabled={actionLoading}
                                      className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs transition flex items-center gap-1 shadow-2xs"
                                      title="Change decision on this request"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Change Decision</span>
                                    </button>
                                  )}
                                </div>
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
            )}

            {/* ========================================================================= */}
            {/* TAB 2: LEAVE APPROVALS */}
            {/* ========================================================================= */}
            {activeTab === 'LEAVES' && (
              <div>
                {/* Mobile Feed (< md) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredAllItems
                    .filter((item) => item.category === 'LEAVE')
                    .map((item) => (
                      <ApprovalMobileCard
                        key={`leave-mobile-${item.id}`}
                        item={item}
                        isSupervisor={isSupervisor}
                        actionLoading={actionLoading}
                        onApprove={handleDirectApprove}
                        onReject={handleDirectReject}
                        onChangeDecision={handleOpenChangeDecision}
                        onInspect={setSelectedItem}
                        onPreviewDoc={setPreviewDoc}
                      />
                    ))}
                </div>

                {/* Desktop Data Table (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        <th className="py-4 px-6">Employee</th>
                        <th className="py-4 px-6">Leave Category</th>
                        <th className="py-4 px-6">Duration</th>
                        <th className="py-4 px-6">Days Charged</th>
                        <th className="py-4 px-6">Reason / Supporting Proof</th>
                        <th className="py-4 px-6 text-center">Status</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {leaves
                        .filter((r) => {
                          const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
                          const dStr = getItemDate(r);
                          const matchesDate = (!startDate || (dStr && dStr >= startDate)) && (!endDate || (dStr && dStr <= endDate));
                          const matchesSearch =
                            !searchQuery ||
                            (r.employee?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (r.employee?.employeeCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (r.employee?.department || '').toLowerCase().includes(searchQuery.toLowerCase());
                          return matchesStatus && matchesDate && matchesSearch;
                        })
                        .map((r) => {
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
                              <td className="py-4 px-6 font-mono font-bold text-slate-900">{r.totalDays} day(s)</td>
                              <td className="py-4 px-6 max-w-xs text-slate-600">
                                <div className="truncate" title={r.reason}>{r.reason}</div>
                                {r.proofDocumentUrl && (
                                  <button
                                    onClick={() => setPreviewDoc({ name: r.proofDocumentName || 'Prescription', url: r.proofDocumentUrl, employeeName: r.employee?.name })}
                                    className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-semibold transition"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>View Attached Proof</span>
                                  </button>
                                )}
                                {r.rejectionReason && (
                                  <div className="text-[10px] text-rose-600 italic mt-0.5">Rejected: {r.rejectionReason}</div>
                                )}
                              </td>
                              <td className="py-4 px-6 text-center whitespace-nowrap">
                                {r.status === 'APPROVED' && (
                                  <div>
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Approved
                                    </span>
                                    {r.approvedByName && (
                                      <div className="text-[10px] text-emerald-700 font-medium mt-1">
                                        by {r.approvedByName}
                                      </div>
                                    )}
                                    {r.reviewedAt && (
                                      <div className="text-[9px] text-slate-400 font-mono">
                                        {format(new Date(r.reviewedAt), 'dd MMM, HH:mm')}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {r.status === 'PENDING' && (
                                  <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Pending Review
                                  </span>
                                )}
                                {r.status === 'REJECTED' && (
                                  <div>
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      Rejected
                                    </span>
                                    {r.approvedByName && (
                                      <div className="text-[10px] text-rose-700 font-medium mt-1">
                                        by {r.approvedByName}
                                      </div>
                                    )}
                                    {r.rejectionReason && (
                                      <div className="text-[9px] text-rose-600 italic truncate max-w-[130px] mx-auto mt-0.5" title={r.rejectionReason}>
                                        "{r.rejectionReason}"
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-6 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isSupervisor && isPending && (
                                    <>
                                      <button
                                        onClick={() => handleApproveLeave(r.id)}
                                        disabled={actionLoading}
                                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1 shadow-2xs"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Approve</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          setRejectingItem({ type: 'LEAVE', id: r.id });
                                          setRejectionReason('');
                                        }}
                                        disabled={actionLoading}
                                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        <span>Reject</span>
                                      </button>
                                    </>
                                  )}

                                  {isSupervisor && !isPending && (
                                    <button
                                      onClick={() => {
                                        setChangeDecisionItem({
                                          id: r.id,
                                          category: 'LEAVE',
                                          title: `${r.leaveType?.name || 'Leave'} (${r.totalDays} day${r.totalDays > 1 ? 's' : ''})`,
                                          employeeName: r.employee?.name || 'Employee',
                                          status: r.status,
                                          approvedByName: r.approvedByName || r.approvedBy || r.approvedById,
                                          rejectionReason: r.rejectionReason,
                                          decisionRemarks: r.decisionRemarks,
                                        });
                                        setNewDecisionAction(r.status === 'APPROVED' ? 'REJECTED' : 'APPROVED');
                                        setDecisionRemarks('');
                                      }}
                                      disabled={actionLoading}
                                      className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs transition flex items-center gap-1 shadow-2xs"
                                      title="Change decision on this leave request"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Change Decision</span>
                                    </button>
                                  )}
                                </div>
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
            {/* TAB 3: ATTENDANCE REGULARIZATIONS */}
            {/* ========================================================================= */}
            {activeTab === 'REGULARIZATIONS' && (
              <div>
                {/* Mobile Feed (< md) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredAllItems
                    .filter((item) => item.category === 'REGULARIZATION')
                    .map((item) => (
                      <ApprovalMobileCard
                        key={`reg-mobile-${item.id}`}
                        item={item}
                        isSupervisor={isSupervisor}
                        actionLoading={actionLoading}
                        onApprove={handleDirectApprove}
                        onReject={handleDirectReject}
                        onChangeDecision={handleOpenChangeDecision}
                        onInspect={setSelectedItem}
                        onPreviewDoc={setPreviewDoc}
                      />
                    ))}
                </div>

                {/* Desktop Data Table (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        <th className="py-4 px-6">Employee</th>
                        <th className="py-4 px-6">Date</th>
                        <th className="py-4 px-6">Terminal Recorded Time</th>
                        <th className="py-4 px-6">Requested Corrected Time</th>
                        <th className="py-4 px-6">Variance Explanation</th>
                        <th className="py-4 px-6 text-center">Status</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {regularizations
                        .filter((r) => {
                          const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
                          const dStr = getItemDate(r);
                          const matchesDate = (!startDate || (dStr && dStr >= startDate)) && (!endDate || (dStr && dStr <= endDate));
                          const matchesSearch =
                            !searchQuery ||
                            (r.employeeName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (r.employeeCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (r.department || '').toLowerCase().includes(searchQuery.toLowerCase());
                          return matchesStatus && matchesDate && matchesSearch;
                        })
                        .map((r) => {
                          const isPending = r.status === 'PENDING';
                          return (
                            <tr key={r.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-4 px-6">
                                <div className="font-bold text-slate-900">{r.employeeName}</div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {r.employeeCode} • {r.department}
                                </div>
                              </td>
                              <td className="py-4 px-6 font-mono font-bold text-slate-800">
                                {format(new Date(r.date), 'dd MMM yyyy')}
                              </td>
                              <td className="py-4 px-6 font-mono">
                                <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-semibold">
                                  {r.recordedCheckIn ? `${r.recordedCheckIn}` : 'No Punch Detected'}
                                </span>
                              </td>
                              <td className="py-4 px-6 font-mono">
                                <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-800 font-bold border border-blue-200">
                                  In: {r.requestedCheckIn || '--:--'} | Out: {r.requestedCheckOut || '--:--'}
                                </span>
                              </td>
                              <td className="py-4 px-6 max-w-xs text-slate-600">
                                <div className="truncate" title={r.reason}>{r.reason}</div>
                                {r.rejectionReason && (
                                  <div className="text-[10px] text-rose-600 italic mt-0.5">Rejected: {r.rejectionReason}</div>
                                )}
                              </td>
                              <td className="py-4 px-6 text-center whitespace-nowrap">
                                {r.status === 'APPROVED' && (
                                  <div>
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Punch Regularized
                                    </span>
                                    {(r.reviewedByName || r.reviewedBy) && (
                                      <div className="text-[10px] text-emerald-700 font-medium mt-1">
                                        by {r.reviewedByName || r.reviewedBy}
                                      </div>
                                    )}
                                    {r.reviewedAt && (
                                      <div className="text-[9px] text-slate-400 font-mono">
                                        {format(new Date(r.reviewedAt), 'dd MMM, HH:mm')}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {r.status === 'PENDING' && (
                                  <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Pending Review
                                  </span>
                                )}
                                {r.status === 'REJECTED' && (
                                  <div>
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      Rejected
                                    </span>
                                    {(r.reviewedByName || r.reviewedBy) && (
                                      <div className="text-[10px] text-rose-700 font-medium mt-1">
                                        by {r.reviewedByName || r.reviewedBy}
                                      </div>
                                    )}
                                    {r.rejectionReason && (
                                      <div className="text-[9px] text-rose-600 italic truncate max-w-[130px] mx-auto mt-0.5" title={r.rejectionReason}>
                                        "{r.rejectionReason}"
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-6 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isSupervisor && isPending && (
                                    <>
                                      <button
                                        onClick={() => handleApproveReg(r.id)}
                                        disabled={actionLoading}
                                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1 shadow-2xs"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Regularize</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          setRejectingItem({ type: 'REG', id: r.id });
                                          setRejectionReason('');
                                        }}
                                        disabled={actionLoading}
                                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        <span>Reject</span>
                                      </button>
                                    </>
                                  )}

                                  {isSupervisor && !isPending && (
                                    <button
                                      onClick={() => {
                                        setChangeDecisionItem({
                                          id: r.id,
                                          category: 'REGULARIZATION',
                                          title: `Attendance Time Correction (${format(new Date(r.date), 'dd MMM yyyy')})`,
                                          employeeName: r.employeeName || 'Employee',
                                          status: r.status,
                                          approvedByName: r.reviewedByName || r.reviewedBy,
                                          rejectionReason: r.rejectionReason,
                                          decisionRemarks: r.decisionRemarks,
                                        });
                                        setNewDecisionAction(r.status === 'APPROVED' ? 'REJECTED' : 'APPROVED');
                                        setDecisionRemarks('');
                                      }}
                                      disabled={actionLoading}
                                      className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs transition flex items-center gap-1 shadow-2xs"
                                      title="Change decision on this attendance request"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Change Decision</span>
                                    </button>
                                  )}
                                </div>
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
            {/* TAB 4: PAYSLIP DOWNLOAD REQUESTS */}
            {/* ========================================================================= */}
            {activeTab === 'PAYSLIPS' && (
              <div>
                {/* Mobile Feed (< md) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredAllItems
                    .filter((item) => item.category === 'PAYSLIP')
                    .map((item) => (
                      <ApprovalMobileCard
                        key={`payslip-mobile-${item.id}`}
                        item={item}
                        isSupervisor={isSupervisor}
                        actionLoading={actionLoading}
                        onApprove={handleDirectApprove}
                        onReject={handleDirectReject}
                        onChangeDecision={handleOpenChangeDecision}
                        onInspect={setSelectedItem}
                        onPreviewDoc={setPreviewDoc}
                      />
                    ))}
                </div>

                {/* Desktop Data Table (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        <th className="py-4 px-6">Employee</th>
                        <th className="py-4 px-6">Disbursement Cycle</th>
                        <th className="py-4 px-6">Requested At</th>
                        <th className="py-4 px-6 text-center">Status</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {payslips
                        .filter((p) => {
                          const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
                          const dStr = getItemDate(p);
                          const matchesDate = (!startDate || (dStr && dStr >= startDate)) && (!endDate || (dStr && dStr <= endDate));
                          const matchesSearch =
                            !searchQuery ||
                            (p.employeeName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (p.employeeCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (p.department || '').toLowerCase().includes(searchQuery.toLowerCase());
                          return matchesStatus && matchesDate && matchesSearch;
                        })
                        .map((p) => {
                          const isPending = p.status === 'PENDING';
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-4 px-6">
                                <div className="font-bold text-slate-900">{p.employeeName}</div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {p.employeeCode} • {p.department}
                                </div>
                              </td>
                              <td className="py-4 px-6 font-mono font-bold text-slate-900">
                                Month {p.month}, {p.year}
                              </td>
                              <td className="py-4 px-6 font-mono text-slate-500">
                                {format(new Date(p.requestedAt), 'dd MMM yyyy, hh:mm a')}
                              </td>
                              <td className="py-4 px-6 text-center whitespace-nowrap">
                                {p.status === 'APPROVED' && (
                                  <div>
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Download Authorized
                                    </span>
                                    {(p.reviewedByName || p.reviewedBy) && (
                                      <div className="text-[10px] text-emerald-700 font-medium mt-1">
                                        by {p.reviewedByName || p.reviewedBy}
                                      </div>
                                    )}
                                    {p.reviewedAt && (
                                      <div className="text-[9px] text-slate-400 font-mono">
                                        {format(new Date(p.reviewedAt), 'dd MMM, HH:mm')}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {p.status === 'PENDING' && (
                                  <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Pending Sign-off
                                  </span>
                                )}
                                {p.status === 'REJECTED' && (
                                  <div>
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      Denied
                                    </span>
                                    {(p.reviewedByName || p.reviewedBy) && (
                                      <div className="text-[10px] text-rose-700 font-medium mt-1">
                                        by {p.reviewedByName || p.reviewedBy}
                                      </div>
                                    )}
                                    {p.rejectionReason && (
                                      <div className="text-[9px] text-rose-600 italic truncate max-w-[130px] mx-auto mt-0.5" title={p.rejectionReason}>
                                        "{p.rejectionReason}"
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-6 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isSupervisor && isPending && (
                                    <>
                                      <button
                                        onClick={() => handleApprovePayslip(p.id)}
                                        disabled={actionLoading}
                                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1 shadow-2xs"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Authorize</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          setRejectingItem({ type: 'PAYSLIP', id: p.id });
                                          setRejectionReason('');
                                        }}
                                        disabled={actionLoading}
                                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        <span>Deny</span>
                                      </button>
                                    </>
                                  )}

                                  {isSupervisor && !isPending && (
                                    <button
                                      onClick={() => {
                                        setChangeDecisionItem({
                                          id: p.id,
                                          category: 'PAYSLIP',
                                          title: `Official Payslip Download Sign-Off (Month ${p.month}/${p.year})`,
                                          employeeName: p.employeeName || 'Employee',
                                          status: p.status,
                                          approvedByName: p.reviewedByName || p.reviewedBy,
                                          rejectionReason: p.rejectionReason,
                                          decisionRemarks: p.decisionRemarks,
                                        });
                                        setNewDecisionAction(p.status === 'APPROVED' ? 'REJECTED' : 'APPROVED');
                                        setDecisionRemarks('');
                                      }}
                                      disabled={actionLoading}
                                      className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs transition flex items-center gap-1 shadow-2xs"
                                      title="Change decision on this payslip authorization"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Change Decision</span>
                                    </button>
                                  )}
                                </div>
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
        )}
      </div>

      {/* Rejection Reason Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>Provide Rejection Reason</span>
                </h4>
                <p className="text-[11px] text-slate-400">Employee will be notified with this audit reasoning</p>
              </div>
              <button
                onClick={() => setRejectingItem(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Audit Reason</label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Incomplete documentation, overlapping team shifts, biometric punch logs conflict..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-xs disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Decision Modal */}
      {changeDecisionItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Change Supervisor Decision</h4>
                  <p className="text-[11px] text-slate-500">
                    Re-evaluate and revise previously completed action
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChangeDecisionItem(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="text-[11px] text-slate-500">Target Request Details</div>
              <div className="font-bold text-slate-900">{changeDecisionItem.employeeName}</div>
              <div className="text-[11px] text-slate-700">{changeDecisionItem.title}</div>
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                <span className="text-[10px] text-slate-500">Current Status:</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    changeDecisionItem.status === 'APPROVED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {changeDecisionItem.status}
                </span>
                {changeDecisionItem.approvedByName && (
                  <span className="text-[10px] text-slate-500">by {changeDecisionItem.approvedByName}</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-700 font-bold block">Select New Decision Outcome</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNewDecisionAction('APPROVED')}
                  className={`p-2.5 rounded-xl border text-center font-bold text-xs transition ${
                    newDecisionAction === 'APPROVED'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setNewDecisionAction('REJECTED')}
                  className={`p-2.5 rounded-xl border text-center font-bold text-xs transition ${
                    newDecisionAction === 'REJECTED'
                      ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <XCircle className="w-4 h-4 mx-auto mb-1 text-rose-600" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => setNewDecisionAction('PENDING')}
                  className={`p-2.5 rounded-xl border text-center font-bold text-xs transition ${
                    newDecisionAction === 'PENDING'
                      ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Clock className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                  Reopen / Pending
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-700 font-bold block">
                Decision Change Justification / Remarks <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={decisionRemarks}
                onChange={(e) => setDecisionRemarks(e.target.value)}
                placeholder="Explain the reason for changing the decision (e.g. Employee provided physical certificate, management approval granted)..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs bg-slate-50"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setChangeDecisionItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmChangeDecision}
                disabled={actionLoading || !decisionRemarks.trim()}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirm Decision Change</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Details Inspection Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scaleUp text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {selectedItem.category === 'LEAVE' && (
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Leave Application
                    </span>
                  )}
                  {selectedItem.category === 'REGULARIZATION' && (
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Attendance Time Correction
                    </span>
                  )}
                  {selectedItem.category === 'PAYSLIP' && (
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      Payslip Authorization
                    </span>
                  )}

                  {selectedItem.status === 'APPROVED' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Approved
                    </span>
                  )}
                  {selectedItem.status === 'PENDING' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      Pending Review
                    </span>
                  )}
                  {selectedItem.status === 'REJECTED' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      Rejected
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-slate-900 text-sm">{selectedItem.title}</h4>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Employee Header */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Employee</span>
                  <span className="font-bold text-slate-900">{selectedItem.employeeName}</span>
                  <span className="text-slate-400 font-mono text-[11px] block">{selectedItem.employeeCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Department</span>
                  <span className="font-semibold text-slate-800">{selectedItem.department}</span>
                </div>
              </div>

              {/* Attendance Regularization Punch Comparison */}
              {selectedItem.category === 'REGULARIZATION' && (
                <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-200 grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold font-sans">Raw Machine Scan</span>
                    <span className="text-slate-700 font-bold text-xs">
                      {selectedItem.rawItem?.recordedCheckIn ? `${selectedItem.rawItem.recordedCheckIn}` : 'No Punch Detected'}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-800 block text-[10px] uppercase font-bold font-sans">Requested Adjustment</span>
                    <span className="text-blue-900 font-bold text-xs">
                      {selectedItem.rawItem?.requestedCheckIn || '--:--'} - {selectedItem.rawItem?.requestedCheckOut || '--:--'}
                    </span>
                  </div>
                </div>
              )}

              {/* Reason */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Submitted Explanation / Notes</span>
                <p className="text-slate-800 mt-1">{selectedItem.reason}</p>
              </div>

              {/* Reviewer / Decision Trail */}
              {(selectedItem.approvedByName || selectedItem.rawItem?.reviewedBy || selectedItem.rawItem?.approvedByName || selectedItem.rejectionReason || selectedItem.decisionRemarks) && (
                <div className={`p-3.5 rounded-2xl border ${selectedItem.status === 'APPROVED' ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' : selectedItem.status === 'REJECTED' ? 'bg-rose-50/60 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                  <span className="block text-[10px] uppercase font-bold">Managerial Review Audit Trail</span>
                  <div className="mt-1 space-y-0.5">
                    {(selectedItem.approvedByName || selectedItem.rawItem?.reviewedByName || selectedItem.rawItem?.reviewedBy || selectedItem.rawItem?.approvedByName) && (
                      <div>Actioned by: <strong>{selectedItem.approvedByName || selectedItem.rawItem?.reviewedByName || selectedItem.rawItem?.reviewedBy || selectedItem.rawItem?.approvedByName}</strong> ({selectedItem.approvedByRole || 'Admin'})</div>
                    )}
                    {(selectedItem.reviewedAt || selectedItem.rawItem?.reviewedAt) && (
                      <div className="text-[10px] opacity-75 font-mono">
                        Timestamp: {format(new Date(selectedItem.reviewedAt || selectedItem.rawItem?.reviewedAt), 'dd MMM yyyy, HH:mm:ss')} IST
                      </div>
                    )}
                    {selectedItem.rejectionReason && (
                      <div className="text-rose-700 font-semibold mt-1">Rejection Note: {selectedItem.rejectionReason}</div>
                    )}
                    {selectedItem.decisionRemarks && selectedItem.decisionRemarks !== selectedItem.rejectionReason && (
                      <div className="text-slate-700 italic mt-1">Remarks: "{selectedItem.decisionRemarks}"</div>
                    )}
                  </div>
                </div>
              )}

              {/* Supporting Document */}
              {selectedItem.proofDocumentUrl && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                  <span className="text-amber-900 font-bold block text-[11px]">Supporting Certificate Preview</span>
                  <div className="max-h-48 overflow-hidden rounded-xl border border-amber-200 bg-white flex items-center justify-center p-2">
                    <img
                      src={selectedItem.proofDocumentUrl}
                      alt="Certificate"
                      className="max-h-44 max-w-full rounded-lg object-contain"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Lightbox Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{previewDoc.name}</h4>
                {previewDoc.employeeName && (
                  <p className="text-[11px] text-slate-400">Attached by {previewDoc.employeeName}</p>
                )}
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-50 rounded-2xl p-2 border border-slate-200">
              <img
                src={previewDoc.url}
                alt={previewDoc.name}
                className="max-h-[65vh] max-w-full rounded-xl object-contain"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
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
