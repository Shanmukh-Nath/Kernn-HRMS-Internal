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
  Server,
  Layers,
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
  const [activeDatePreset, setActiveDatePreset] = useState<'ALL' | 'TODAY' | '7DAYS' | 'MONTH'>('ALL');

  // Modal Inspection
  const [inspectRecord, setInspectRecord] = useState<AuditRecord | null>(null);

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedAdmin && selectedAdmin !== 'ALL') params.append('adminUserId', selectedAdmin);
      if (selectedCategory && selectedCategory !== 'ALL') params.append('actionCategory', selectedCategory);
      if (search) params.append('search', search);

      const res = await fetch(`/api/devices/audit?${params.toString()}`);
      const json = await res.json();

      if (json.success && json.data) {
        setRecords(json.data.records || []);
        setStats(json.data.stats || {
          totalOperations: 0,
          enrollments: 0,
          configChanges: 0,
          deletionWipes: 0,
          menuLogins: 0,
        });
        setAdmins(json.data.admins || []);
      }
    } catch (err) {
      console.error('Failed to fetch hardware audit logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [startDate, endDate, selectedAdmin, selectedCategory, search]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAuditData();
  };

  const handleDatePreset = (preset: 'ALL' | 'TODAY' | '7DAYS' | 'MONTH') => {
    setActiveDatePreset(preset);
    const now = new Date();

    if (preset === 'TODAY') {
      const todayStr = now.toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7DAYS') {
      const prior = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(prior.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Fingerprint className="w-3.5 h-3.5 text-emerald-600" />
            Biometric Enrollment
          </span>
        );
      case 'DELETION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            User / Template Deletion
          </span>
        );
      case 'TIME_SYNC':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Clock / Time Shift
          </span>
        );
      case 'CONFIG_CHANGE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
            <Sliders className="w-3.5 h-3.5 text-violet-600" />
            Config & IP Setting
          </span>
        );
      case 'MEMORY_WIPE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-800 border border-red-300">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            Memory / GLog Wipe
          </span>
        );
      case 'MENU_ACCESS':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
            Admin Menu Access
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#a92427]/10 text-[#a92427] flex items-center justify-center shadow-xs border border-[#a92427]/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black tracking-tight text-slate-900">
                  Terminal Hardware & Supervisory Audit Trail
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#a92427]/10 text-[#a92427] border border-[#a92427]/20 uppercase tracking-wider">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Real-time cryptographic audit log of physical terminal menu access, setting modifications, biometric enrollments, and hardware events.
              </p>
            </div>
          </div>
        </div>

        {/* Action Header Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-mono">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>SN: <strong>102023050002456</strong></span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">192.168.29.83:5005</span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition disabled:opacity-50"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#a92427]' : ''}`} />
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#a92427] hover:bg-[#8e1d20] text-white text-xs font-bold shadow-sm shadow-[#a92427]/20 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Operations */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Admin Operations</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{stats.totalOperations}</div>
          <div className="text-[11px] text-slate-400 font-medium">
            <span className="text-indigo-600 font-bold">{stats.menuLogins}</span> Terminal Menu Logins
          </div>
        </div>

        {/* Biometric Enrollments */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Biometric Enrollments</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Fingerprint className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">{stats.enrollments}</div>
          <div className="text-[11px] text-slate-400 font-medium">Faces, Fingerprints & PINs</div>
        </div>

        {/* Config & Clock Shifts */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Config & Clock Shifts</span>
            <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-violet-600 font-mono">{stats.configChanges}</div>
          <div className="text-[11px] text-slate-400 font-medium">IP, Time Sync & Role Edits</div>
        </div>

        {/* Deletions & Wipes */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Deletions & Wipes</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono">{stats.deletionWipes}</div>
          <div className="text-[11px] text-slate-400 font-medium">High Risk Hardware Events</div>
        </div>
      </div>

      {/* 3. Filter Bar & Quick Date Selector */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 text-xs font-bold">
            <button
              onClick={() => handleDatePreset('ALL')}
              className={`px-3.5 py-1.5 rounded-xl transition ${
                activeDatePreset === 'ALL'
                  ? 'bg-[#a92427] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => handleDatePreset('TODAY')}
              className={`px-3.5 py-1.5 rounded-xl transition ${
                activeDatePreset === 'TODAY'
                  ? 'bg-[#a92427] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handleDatePreset('7DAYS')}
              className={`px-3.5 py-1.5 rounded-xl transition ${
                activeDatePreset === '7DAYS'
                  ? 'bg-[#a92427] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => handleDatePreset('MONTH')}
              className={`px-3.5 py-1.5 rounded-xl transition ${
                activeDatePreset === 'MONTH'
                  ? 'bg-[#a92427] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
          </div>

          {/* Custom Date Pickers */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
              <span className="text-slate-400 font-semibold">From:</span>
              <input
                type="date"
                value={startDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActiveDatePreset('ALL');
                }}
                className="bg-transparent text-slate-800 focus:outline-none text-xs font-mono"
              />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
              <span className="text-slate-400 font-semibold">To:</span>
              <input
                type="date"
                value={endDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActiveDatePreset('ALL');
                }}
                className="bg-transparent text-slate-800 focus:outline-none text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Dropdowns & Search Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-100">
          {/* Admin Filter */}
          <div className="relative">
            <select
              value={selectedAdmin}
              onChange={(e) => setSelectedAdmin(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-[#a92427] focus:bg-white focus:outline-none"
            >
              <option value="ALL">Administrator: All Admins</option>
              {admins.map((a) => (
                <option key={a.adminUserId} value={a.adminUserId}>
                  Admin: {a.adminName} (ID: {a.adminUserId})
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-[#a92427] focus:bg-white focus:outline-none"
            >
              <option value="ALL">Event Category: All Categories</option>
              <option value="MENU_ACCESS">Admin Menu Access</option>
              <option value="ENROLLMENT">Biometric Enrollment</option>
              <option value="CONFIG_CHANGE">Config & IP Setting</option>
              <option value="TIME_SYNC">Clock / Time Shift</option>
              <option value="DELETION">User / Template Deletion</option>
              <option value="MEMORY_WIPE">Memory / GLog Wipe</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search admin, action, target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#a92427] focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 4. Audit Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Physical Terminal Supervisory Ledger</h3>
            <p className="text-xs text-slate-500">
              Audit trail captured directly from EEPROM memory block <code>0x55AA (Cmd 0x02)</code>.
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
            {records.length} Audit Events
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#a92427]" />
            <div>Loading cryptographic audit trail...</div>
          </div>
        ) : records.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">No Hardware Audit Records Found</div>
            <p className="text-xs text-slate-400">
              No physical terminal setting changes or menu operations match the selected criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Administrator</th>
                  <th className="py-4 px-6">Event Category</th>
                  <th className="py-4 px-6">Action Summary</th>
                  <th className="py-4 px-6">Affected Target</th>
                  <th className="py-4 px-6 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                    {/* Timestamp */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatAppDateTime(rec.timestamp)}</span>
                      </div>
                    </td>

                    {/* Administrator */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-[#a92427]/10 text-[#a92427] font-bold flex items-center justify-center text-xs uppercase">
                          {rec.adminName ? rec.adminName.charAt(0) : 'A'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{rec.adminName || `Admin ${rec.adminUserId}`}</div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {rec.adminUserId}</div>
                        </div>
                      </div>
                    </td>

                    {/* Category Badge */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      {getCategoryBadge(rec.actionCategory)}
                    </td>

                    {/* Action Summary */}
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-800">{rec.actionDescription}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">Opcode: 0x{rec.actionCode.toString(16).padStart(2, '0').toUpperCase()}</div>
                    </td>

                    {/* Affected Target */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      {rec.targetName || rec.targetUserId ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-slate-100 text-slate-700">
                          {rec.targetName ? `${rec.targetName} (#${rec.targetUserId})` : `User #${rec.targetUserId}`}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">Device System Global</span>
                      )}
                    </td>

                    {/* Inspect Button */}
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <button
                        onClick={() => setInspectRecord(rec)}
                        className="px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 text-xs font-semibold inline-flex items-center gap-1 transition"
                        title="View raw hardware packet"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Raw Hardware Packet Inspection Modal */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-xl bg-white rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#a92427]/10 text-[#a92427] flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Hardware Supervisory Packet</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Event ID: {inspectRecord.id}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Admin Operator</span>
                <span className="font-bold text-slate-900">{inspectRecord.adminName} (ID: {inspectRecord.adminUserId})</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Timestamp</span>
                <span className="font-mono font-bold text-slate-900">{formatAppDateTime(inspectRecord.timestamp)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Event Category</span>
                <span className="font-semibold text-slate-800">{inspectRecord.actionCategory}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Parameter</span>
                <span className="font-mono font-semibold text-slate-800">{inspectRecord.targetName || inspectRecord.targetUserId || 'Global'}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Decoded EEPROM Payload Buffer
              </label>
              <pre className="p-3.5 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-52 leading-relaxed border border-slate-800">
                {inspectRecord.rawPayload || JSON.stringify(inspectRecord, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setInspectRecord(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
