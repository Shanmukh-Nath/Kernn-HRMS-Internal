'use client';

import { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Search,
  Filter,
  Download,
  Upload,
  Calendar,
  Fingerprint,
  ScanFace,
  CreditCard,
  KeyRound,
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  PlusCircle,
  UserCheck,
  Clock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { formatAppDate, formatAppTime } from '@/lib/timezone';

export default function AttendancePage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filter States
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('');
  const [verificationType, setVerificationType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // User session & Employees list
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [employeesList, setEmployeesList] = useState<any[]>([]);

  // Super Admin Manual Attendance State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manualSuccess, setManualSuccess] = useState('');
  const [manualEmployeeId, setManualEmployeeId] = useState('');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualTime, setManualTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [manualEventType, setManualEventType] = useState('CHECK_IN');
  const [manualVerificationType, setManualVerificationType] = useState('MANUAL_OVERRIDE');
  const [manualRemarks, setManualRemarks] = useState('');

  // CSV Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importDeviceId, setImportDeviceId] = useState('');
  const [devices, setDevices] = useState<any[]>([]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (search) params.set('search', search);
      if (eventType) params.set('eventType', eventType);
      if (verificationType) params.set('verificationType', verificationType);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/attendance?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setEvents(json.data.events);
        setTotalPages(json.data.pagination.totalPages);
        setTotalCount(json.data.pagination.totalCount);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [page, eventType, verificationType, startDate, endDate, search]);

  useEffect(() => {
    // Fetch Current User
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.user) {
          setCurrentUser(d.data.user);
        }
      })
      .catch(() => {});

    // Fetch Employees list for manual logging
    fetch('/api/employees?limit=200')
      .then((r) => r.json())
      .then((d) => {
        const list = d.data?.employees || d.data || [];
        if (Array.isArray(list) && list.length > 0) {
          setEmployeesList(list);
          setManualEmployeeId(list[0].id || list[0]._id);
        }
      })
      .catch(() => {});

    // Fetch Devices
    fetch('/api/devices')
      .then((r) => r.json())
      .then((d) => {
        const list = d.data?.devices || d.data || [];
        if (Array.isArray(list)) {
          setDevices(list);
          if (list.length > 0) setImportDeviceId(list[0].id || list[0].deviceId);
        }
      })
      .catch(() => {});
  }, []);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError('');
    setManualSuccess('');
    setManualSubmitting(true);

    try {
      const res = await fetch('/api/attendance/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: manualEmployeeId,
          date: manualDate,
          time: manualTime,
          eventType: manualEventType,
          verificationType: manualVerificationType,
          remarks: manualRemarks,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to log manual attendance.');
      }

      setManualSuccess(json.message || 'Attendance logged successfully!');
      setTimeout(() => {
        setShowManualModal(false);
        setManualSuccess('');
        setManualRemarks('');
        fetchAttendance();
      }, 1000);
    } catch (err: any) {
      setManualError(err.message || 'An error occurred.');
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAttendance();
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: importDeviceId, csvText }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`Successfully imported ${json.data.imported} records!`);
        setShowImportModal(false);
        setCsvText('');
        fetchAttendance();
      } else {
        alert(json.error?.message || 'Import failed');
      }
    } catch {
      alert('Error importing CSV.');
    }
  };

  const getVerificationBadge = (type: string) => {
    switch (type) {
      case 'FACE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            <ScanFace className="w-3 h-3" /> Face
          </span>
        );
      case 'CARD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <CreditCard className="w-3 h-3" /> RFID Card
          </span>
        );
      case 'PASSWORD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <KeyRound className="w-3 h-3" /> Password
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Fingerprint className="w-3 h-3" /> Fingerprint
          </span>
        );
    }
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'CHECK_IN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ArrowDownRight className="w-3 h-3" /> Check-In
          </span>
        );
      case 'CHECK_OUT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <ArrowUpRight className="w-3 h-3" /> Check-Out
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {type}
          </span>
        );
    }
  };

  const canManage =
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'HR_ADMIN' ||
    currentUser?.role === 'ADMIN';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Attendance Logs</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Complete audit trail of biometric punch events across all S-FB3K terminals.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {canManage && (
            <button
              onClick={() => {
                setShowManualModal(true);
                setManualError('');
                setManualSuccess('');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-bold rounded-lg shadow-sm shadow-emerald-500/20 transition"
            >
              <PlusCircle className="w-4 h-4" />
              + Manual Punch / Log Attendance
            </button>
          )}

          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 shadow-sm transition"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            Import CSV Fallback
          </button>

          <a
            href={`/api/attendance?format=csv${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}${eventType ? `&eventType=${eventType}` : ''}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm shadow-blue-500/20 transition"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </a>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-sm">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-0 md:min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search employee name or device ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Event Type Filter */}
          <select
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Punch Modes</option>
            <option value="CHECK_IN">Check-In</option>
            <option value="CHECK_OUT">Check-Out</option>
            <option value="BREAK_IN">Break-In</option>
            <option value="BREAK_OUT">Break-Out</option>
            <option value="GENERAL_PUNCH">General Punch</option>
          </select>

          {/* Verification Method Filter */}
          <select
            value={verificationType}
            onChange={(e) => {
              setVerificationType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Verifications</option>
            <option value="FINGERPRINT">Fingerprint</option>
            <option value="FACE">Face</option>
            <option value="CARD">Card</option>
            <option value="PASSWORD">Password</option>
            <option value="MANUAL_OVERRIDE">Manual Override</option>
          </select>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* Attendance Events Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">User ID</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Event Type</th>
                <th className="px-6 py-4">Verification</th>
                <th className="px-6 py-4">Device</th>
                <th className="px-6 py-4">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <CalendarCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No attendance records match your filter criteria.
                  </td>
                </tr>
              ) : (
                events.map((evt) => {
                  let rawMeta: any = null;
                  try {
                    if (evt.rawPayload) rawMeta = JSON.parse(evt.rawPayload);
                  } catch (_) {}

                  return (
                    <tr key={evt.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {evt.employee?.name || `Employee ${evt.deviceUserId}`}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {evt.employee?.employeeCode || `EMP-${evt.deviceUserId}`}
                        </div>
                      </td>

                      <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-700">
                        #{evt.deviceUserId}
                      </td>

                      <td className="px-6 py-4 font-mono text-xs text-slate-700">
                        {formatAppDate(evt.timestamp)}
                      </td>

                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-900">
                        {formatAppTime(evt.timestamp)}
                      </td>

                      <td className="px-6 py-4">{getEventBadge(evt.eventType)}</td>

                      <td className="px-6 py-4">
                        {evt.verificationType === 'MANUAL_OVERRIDE' || evt.source === 'MANUAL_ENTRY' ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                            title={rawMeta?.remarks ? `Admin Remark: ${rawMeta.remarks}` : 'Manual entry by Administrator'}
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Manual Override
                          </span>
                        ) : (
                          getVerificationBadge(evt.verificationType)
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-600">
                        {evt.device?.name || evt.deviceId}
                      </td>

                      <td className="px-6 py-4">
                        {evt.source === 'MANUAL_ENTRY' ? (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded bg-emerald-100/70 font-bold text-emerald-800 border border-emerald-300"
                            title={rawMeta?.manualLoggedBy ? `Logged by: ${rawMeta.manualLoggedBy}` : 'Super Admin Override'}
                          >
                            MANUAL ENTRY
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-600 border border-slate-200">
                            {evt.source}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <span>
            Showing <span className="font-semibold text-slate-800">{events.length}</span> of{' '}
            <span className="font-semibold text-slate-800">{totalCount}</span> records
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-slate-700">
              Page {page} of {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Super Admin Manual Attendance Logging Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Manual Attendance Entry</h3>
                  <p className="text-xs text-slate-400">Super Admin & HR Direct Punch Override</p>
                </div>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {manualError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{manualError}</span>
              </div>
            )}

            {manualSuccess && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{manualSuccess}</span>
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Employee *</label>
                <select
                  required
                  value={manualEmployeeId}
                  onChange={(e) => setManualEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-medium bg-white"
                >
                  {employeesList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeCode || `ID #${emp.deviceUserId}`}) — {emp.department || 'General'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Punch Date *</label>
                  <input
                    type="date"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Punch Time *</label>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setManualTime(
                          `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
                        );
                      }}
                      className="text-[10px] text-emerald-600 font-bold hover:underline"
                    >
                      Set Current Time
                    </button>
                  </div>
                  <input
                    type="time"
                    step="1"
                    required
                    value={manualTime}
                    onChange={(e) => setManualTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Event Type *</label>
                  <select
                    value={manualEventType}
                    onChange={(e) => setManualEventType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 bg-white"
                  >
                    <option value="CHECK_IN">Check-In</option>
                    <option value="CHECK_OUT">Check-Out</option>
                    <option value="BREAK_IN">Break-In</option>
                    <option value="BREAK_OUT">Break-Out</option>
                    <option value="GENERAL_PUNCH">General Punch</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Verification Mode</label>
                  <select
                    value={manualVerificationType}
                    onChange={(e) => setManualVerificationType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 bg-white"
                  >
                    <option value="MANUAL_OVERRIDE">Admin Manual Override</option>
                    <option value="FINGERPRINT">Fingerprint Verified</option>
                    <option value="FACE">Facial Recognition</option>
                    <option value="CARD">RFID Smart Card</option>
                    <option value="PASSWORD">Keypad PIN / Password</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Audit Reason / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Device connectivity downtime, field duty on-site, biometric sensor glitch"
                  value={manualRemarks}
                  onChange={(e) => setManualRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  This manual log entry will be saved to the permanent audit ledger with administrator credentials.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm shadow-emerald-600/30 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {manualSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Logging...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Save Manual Punch</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Fallback Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3.5 sm:p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Import Legacy Attendance CSV</h3>
            <p className="text-xs text-slate-500 mb-4">
              Paste CSV text exported from Secureye Ontime or external biometric software.
            </p>

            <form onSubmit={handleImportSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Assign to Device *</label>
                <select
                  value={importDeviceId}
                  onChange={(e) => setImportDeviceId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.deviceId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">CSV Content *</label>
                <p className="text-[11px] text-slate-400 mb-1">
                  Format: EmployeeID,Name,Date(YYYY-MM-DD),Time(HH:MM:SS),EventType,VerificationType
                </p>
                <textarea
                  required
                  rows={6}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`1001,John Smith,2026-08-28,09:30:00,CHECK_IN,FINGERPRINT\n1002,Priya Sharma,2026-08-28,09:35:12,CHECK_IN,FACE`}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition"
                >
                  Import Records
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

