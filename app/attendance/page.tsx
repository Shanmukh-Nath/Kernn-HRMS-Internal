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

    const interval = setInterval(() => {
      fetchAttendance();
    }, 4000);

    return () => clearInterval(interval);
  }, [page, eventType, verificationType, startDate, endDate, search]);

  useEffect(() => {
    fetch('/api/devices')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data.length > 0) {
          setDevices(d.data);
          setImportDeviceId(d.data[0].id);
        }
      });
  }, []);

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

        <div className="flex items-center gap-3">
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
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between text-sm">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search employee name or device ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3">
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
          </select>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
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
                events.map((evt) => (
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

                    <td className="px-6 py-4">{getVerificationBadge(evt.verificationType)}</td>

                    <td className="px-6 py-4 text-xs text-slate-600">
                      {evt.device?.name || evt.deviceId}
                    </td>

                    <td className="px-6 py-4">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-600 border border-slate-200">
                        {evt.source}
                      </span>
                    </td>
                  </tr>
                ))
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

      {/* CSV Import Fallback Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
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
