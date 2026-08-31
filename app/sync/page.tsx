'use client';

import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Users,
  CalendarCheck,
  Clock,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Activity,
} from 'lucide-react';
import { formatAppDateTime } from '@/lib/timezone';

export default function SyncPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [syncingType, setSyncingType] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');

  const fetchSyncData = async () => {
    try {
      const [devRes, histRes] = await Promise.all([
        fetch('/api/devices'),
        fetch('/api/sync/history'),
      ]);

      const devJson = await devRes.json();
      const histJson = await histRes.json();

      if (devJson.success && devJson.data.length > 0) {
        setDevices(devJson.data);
        if (!selectedDevice) setSelectedDevice(devJson.data[0].id);
      }

      if (histJson.success) {
        setHistory(histJson.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSyncData();
  }, []);

  const handleExecuteSync = async (type: 'users' | 'attendance' | 'time') => {
    if (!selectedDevice) return;

    setSyncingType(type);
    setSyncProgress(25);
    setSyncStatusMsg(`Connecting to S-FB3K device for ${type.toUpperCase()}...`);

    try {
      setTimeout(() => setSyncProgress(65), 500);

      const res = await fetch(`/api/devices/${selectedDevice}/sync/${type}`, { method: 'POST' });
      const json = await res.json();

      setSyncProgress(100);

      if (json.success) {
        setSyncStatusMsg(`Synchronization of ${type.toUpperCase()} completed successfully!`);
      } else {
        setSyncStatusMsg(`Error: ${json.error?.message || 'Sync failed'}`);
      }
    } catch (err) {
      setSyncStatusMsg('Network timeout during sync execution.');
    } finally {
      setTimeout(() => {
        setSyncingType(null);
        setSyncProgress(0);
        fetchSyncData();
      }, 2000);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Device Synchronization Hub</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Execute full, incremental, or scheduled data sync operations between Secureye S-FB3K terminals and the central database.
        </p>
      </div>

      {/* Sync Control Center */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Select Target Biometric Terminal
            </label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm min-w-[280px]"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.ipAddress}:{d.port})
                </option>
              ))}
            </select>
          </div>

          {syncingType && (
            <div className="flex-1 max-w-md">
              <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                <span>{syncStatusMsg}</span>
                <span>{syncProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${syncProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Sync Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Sync Users Card */}
          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between hover:bg-slate-50 transition">
            <div>
              <div className="w-10 h-10 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 mb-3">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Synchronize User Roster</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Executes <code className="font-mono text-blue-600 font-semibold">GET_USER_ID_LIST</code> to pull all enrolled users, card IDs, and privileges.
              </p>
            </div>

            <button
              onClick={() => handleExecuteSync('users')}
              disabled={Boolean(syncingType)}
              className="mt-5 w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingType === 'users' ? 'animate-spin' : ''}`} />
              Sync Users
            </button>
          </div>

          {/* Sync Attendance Card */}
          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between hover:bg-slate-50 transition">
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-3">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Synchronize Attendance Logs</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Executes <code className="font-mono text-emerald-600 font-semibold">GET_LOG_DATA</code> to download offline historical punches and deduplicate locally.
              </p>
            </div>

            <button
              onClick={() => handleExecuteSync('attendance')}
              disabled={Boolean(syncingType)}
              className="mt-5 w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingType === 'attendance' ? 'animate-spin' : ''}`} />
              Sync Attendance Logs
            </button>
          </div>

          {/* Sync Clock Card */}
          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between hover:bg-slate-50 transition">
            <div>
              <div className="w-10 h-10 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 mb-3">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Synchronize Terminal Clock</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Executes <code className="font-mono text-amber-600 font-semibold">SET_TIME</code> to calibrate the hardware RTC clock with current server UTC/IST time.
              </p>
            </div>

            <button
              onClick={() => handleExecuteSync('time')}
              disabled={Boolean(syncingType)}
              className="mt-5 w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center justify-center gap-2"
            >
              <Clock className="w-3.5 h-3.5" />
              Sync Device Clock
            </button>
          </div>
        </div>
      </div>

      {/* Sync Audit History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-900 text-sm">Synchronization Audit History</h3>
          <span className="text-xs text-slate-500">Last 50 operations</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Device</th>
                <th className="px-6 py-3.5">Operation</th>
                <th className="px-6 py-3.5">Started</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-center">Processed</th>
                <th className="px-6 py-3.5 text-center">Created</th>
                <th className="px-6 py-3.5 text-center">Skipped (Dedup)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400 text-xs">
                    No sync operations recorded yet.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/60 transition text-xs font-mono">
                    <td className="px-6 py-3.5 font-sans font-semibold text-slate-900">
                      {h.device?.name || h.deviceId}
                    </td>

                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700 border border-slate-200">
                        {h.syncType}
                      </span>
                    </td>

                    <td className="px-6 py-3.5 text-slate-500">
                      {formatAppDateTime(h.startedAt)}
                    </td>

                    <td className="px-6 py-3.5 font-sans">
                      {h.status === 'SUCCESS' ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Success
                        </span>
                      ) : (
                        <span className="text-rose-700 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Failed
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-3.5 text-center font-semibold text-slate-800">
                      {h.recordsProcessed}
                    </td>

                    <td className="px-6 py-3.5 text-center font-semibold text-emerald-700">
                      +{h.recordsCreated}
                    </td>

                    <td className="px-6 py-3.5 text-center text-slate-400">
                      {h.recordsSkipped}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
