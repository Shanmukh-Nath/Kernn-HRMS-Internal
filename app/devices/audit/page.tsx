'use client';

import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  Download,
  RefreshCw,
  Clock,
  UserCheck,
  AlertTriangle,
  Lock,
  Sliders,
  Trash2,
  Fingerprint,
  Radio,
  Eye,
  X,
  CheckCircle2,
  HardDrive,
  Cpu,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { formatAppDateTime } from '@/lib/timezone';

interface AuditRecord {
  id: string;
  deviceId: string;
  adminUserId: string;
  adminName: string;
  actionCode: number;
  actionCategory: string;
  actionDescription: string;
  targetUserId: string | null;
  targetName: string | null;
  timestamp: string;
  rawPayload: string | null;
  createdAt: string;
}

interface Stats {
  totalOperations: number;
  enrollments: number;
  configChanges: number;
  deletionWipes: number;
  menuLogins: number;
}

export default function HardwareAuditPage() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalOperations: 0,
    enrollments: 0,
    configChanges: 0,
    deletionWipes: 0,
    menuLogins: 0,
  });
  const [admins, setAdmins] = useState<{ adminUserId: string; adminName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAdmin, setSelectedAdmin] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [activeDatePreset, setActiveDatePreset] = useState<string>('ALL');

  // Inspection Modal State
  const [selectedItem, setSelectedItem] = useState<AuditRecord | null>(null);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedAdmin && selectedAdmin !== 'ALL') params.append('adminUserId', selectedAdmin);
      if (selectedCategory && selectedCategory !== 'ALL') params.append('actionCategory', selectedCategory);
      if (search) params.append('search', search);
      params.append('limit', '100');

      const res = await fetch(`/api/devices/audit?${params.toString()}`);
      const json = await res.json();

      if (json.success && json.data) {
        setRecords(json.data.records || []);
        setStats(json.data.stats || {});
        if (json.data.admins) setAdmins(json.data.admins);
      }
    } catch (err) {
      console.error('Failed to fetch hardware audit logs', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [startDate, endDate, selectedAdmin, selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAuditLogs();
  };

  const applyDatePreset = (preset: string) => {
    setActiveDatePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().substring(0, 10);

    if (preset === 'TODAY') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7DAYS') {
      const past = new Date(Date.now() - 7 * 86400000);
      setStartDate(past.toISOString().substring(0, 10));
      setEndDate(todayStr);
    } else if (preset === 'MONTH') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().substring(0, 10);
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (selectedAdmin && selectedAdmin !== 'ALL') params.append('adminUserId', selectedAdmin);
    if (selectedCategory && selectedCategory !== 'ALL') params.append('actionCategory', selectedCategory);
    if (search) params.append('search', search);
    params.append('format', 'csv');

    window.open(`/api/devices/audit?${params.toString()}`, '_blank');
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'ENROLLMENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Fingerprint className="w-3.5 h-3.5" />
            Biometric Enrollment
          </span>
        );
      case 'DELETION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <Trash2 className="w-3.5 h-3.5" />
            User / Template Deletion
          </span>
        );
      case 'TIME_SYNC':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            Clock / Time Shift
          </span>
        );
      case 'CONFIG_CHANGE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-violet-500/15 text-violet-400 border border-violet-500/30">
            <Sliders className="w-3.5 h-3.5" />
            Config & IP Setting
          </span>
        );
      case 'MEMORY_WIPE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-600/25 text-red-300 border border-red-500/40">
            <AlertTriangle className="w-3.5 h-3.5" />
            Memory / GLog Wipe
          </span>
        );
      case 'MENU_ACCESS':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <Lock className="w-3.5 h-3.5" />
            Admin Menu Access
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 p-6 md:p-8">
      {/* Header Banner */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-600 flex items-center justify-center shadow-lg shadow-rose-950/50">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                  Terminal Hardware & Supervisory Audit Trail
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-wider">
                    Super Admin Exclusive
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time cryptographic audit log of physical terminal menu access, setting modifications, biometric enrollments, and hardware events.
                </p>
              </div>
            </div>
          </div>

          {/* Action Header Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>SN: <strong className="text-white font-mono">102023050002456</strong></span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
            </div>

            <button
              onClick={() => {
                setRefreshing(true);
                fetchAuditLogs();
              }}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-2 transition hover:border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-rose-400' : ''}`} />
              Refresh
            </button>

            <button
              onClick={handleExportCsv}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-950/40 flex items-center gap-2 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-slate-800/80 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Admin Operations</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white font-mono mt-2">{stats.totalOperations}</div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <span>{stats.menuLogins} Terminal Menu Logins</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-slate-800/80 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Biometric Enrollments</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Fingerprint className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-2">{stats.enrollments}</div>
            <div className="text-[11px] text-emerald-400/80 mt-1">Faces, Fingerprints & PINs</div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-slate-800/80 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Config & Clock Shifts</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono mt-2">{stats.configChanges}</div>
            <div className="text-[11px] text-amber-400/80 mt-1">IP, Time Sync & Role Edits</div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-slate-800/80 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Deletions & Wipes</span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-rose-400 font-mono mt-2">{stats.deletionWipes}</div>
            <div className="text-[11px] text-rose-400/80 mt-1">High-Risk Hardware Events</div>
          </div>
        </div>

        {/* Fashionable Filter & Search Toolbar */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quick Date Presets */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800/80">
              <button
                onClick={() => applyDatePreset('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeDatePreset === 'ALL' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                All Time
              </button>
              <button
                onClick={() => applyDatePreset('TODAY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeDatePreset === 'TODAY' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Today
              </button>
              <button
                onClick={() => applyDatePreset('7DAYS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeDatePreset === '7DAYS' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => applyDatePreset('MONTH')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeDatePreset === 'MONTH' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                This Month
              </button>
            </div>

            {/* Custom Date Pickers */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActiveDatePreset('CUSTOM');
                  }}
                  className="bg-transparent text-white font-mono text-xs outline-none"
                />
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActiveDatePreset('CUSTOM');
                  }}
                  className="bg-transparent text-white font-mono text-xs outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800/60">
            {/* Filter by Admin User */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800">
              <UserCheck className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400 shrink-0">Admin:</span>
              <select
                value={selectedAdmin}
                onChange={(e) => setSelectedAdmin(e.target.value)}
                className="w-full bg-transparent text-white text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">All Administrators</option>
                {admins.map((adm) => (
                  <option key={adm.adminUserId} value={adm.adminUserId} className="bg-slate-900 text-white">
                    {adm.adminName} (ID: {adm.adminUserId})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Category */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400 shrink-0">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-transparent text-white text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">All Event Categories</option>
                <option value="MENU_ACCESS" className="bg-slate-900 text-white">Menu Access / Logins</option>
                <option value="ENROLLMENT" className="bg-slate-900 text-white">Biometric Enrollments</option>
                <option value="DELETION" className="bg-slate-900 text-white">Deletions</option>
                <option value="TIME_SYNC" className="bg-slate-900 text-white">Clock & Time Shifts</option>
                <option value="CONFIG_CHANGE" className="bg-slate-900 text-white">Config & Parameter Changes</option>
                <option value="MEMORY_WIPE" className="bg-slate-900 text-white">Memory / GLog Wipes</option>
              </select>
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search admin, action, or target..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-white text-xs placeholder:text-slate-500 outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    fetchAuditLogs();
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden shadow-2xl backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Administrator</th>
                  <th className="py-3.5 px-4">Event Category</th>
                  <th className="py-3.5 px-4">Action Summary</th>
                  <th className="py-3.5 px-4">Affected Parameter / Target</th>
                  <th className="py-3.5 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
                        <span className="text-xs font-semibold">Loading Hardware Audit Trail...</span>
                      </div>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <ShieldCheck className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                      <div className="text-sm font-bold text-slate-300">No hardware audit records found</div>
                      <div className="text-xs text-slate-500 mt-0.5">Try widening your date range or clearing filters.</div>
                    </td>
                  </tr>
                ) : (
                  records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-800/40 transition group">
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-slate-300 font-mono">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-white font-bold">{rec.timestamp}</span>
                        </div>
                      </td>

                      {/* Admin User */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-rose-600 to-indigo-600 text-white font-bold text-[10px] flex items-center justify-center uppercase">
                            {rec.adminName?.[0] || 'A'}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs">{rec.adminName || `Admin ${rec.adminUserId}`}</div>
                            <div className="text-[10px] text-slate-400 font-mono">ID: {rec.adminUserId}</div>
                          </div>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-4">
                        {getCategoryBadge(rec.actionCategory)}
                      </td>

                      {/* Action Description */}
                      <td className="py-3.5 px-4 text-slate-200">
                        <span className="font-medium">{rec.actionDescription}</span>
                      </td>

                      {/* Target User / Parameter */}
                      <td className="py-3.5 px-4">
                        {rec.targetName || rec.targetUserId ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[11px] font-mono text-amber-300">
                            {rec.targetName ? rec.targetName : `Target ID: ${rec.targetUserId}`}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Device System Global</span>
                        )}
                      </td>

                      {/* Inspect Modal Trigger */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedItem(rec)}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-600 text-slate-400 hover:text-white border border-slate-700 hover:border-rose-500 transition"
                          title="Inspect raw audit payload"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Payload Inspector */}
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-rose-500" />
                  <h3 className="font-bold text-white text-sm">Audit Payload Inspector</h3>
                </div>
                <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Action Category</span>
                    <div className="mt-1">{getCategoryBadge(selectedItem.actionCategory)}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Device Serial Number</span>
                    <div className="font-mono text-white font-bold mt-1">{selectedItem.deviceId}</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Administrator Name:</span>
                    <strong className="text-white">{selectedItem.adminName}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Admin User ID:</span>
                    <strong className="text-white font-mono">{selectedItem.adminUserId}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Action Description:</span>
                    <strong className="text-emerald-400">{selectedItem.actionDescription}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Exact Timestamp:</span>
                    <strong className="text-white font-mono">{selectedItem.timestamp}</strong>
                  </div>
                  {selectedItem.targetName && (
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Target Parameter:</span>
                      <strong className="text-amber-300 font-mono">{selectedItem.targetName}</strong>
                    </div>
                  )}
                </div>

                {selectedItem.rawPayload && (
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Raw Hardware Payload</span>
                    <pre className="mt-1 p-2.5 rounded-xl bg-black border border-slate-800 text-[10px] font-mono text-emerald-400 overflow-x-auto">
                      {selectedItem.rawPayload}
                    </pre>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
