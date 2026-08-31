'use client';

import { useState } from 'react';
import { Settings, Shield, Clock, HardDrive, Save, RefreshCw, Key, Network } from 'lucide-react';
import { DEFAULT_TIMEZONE } from '@/lib/timezone';

export default function SettingsPage() {
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [pollInterval, setPollInterval] = useState('3000');
  const [retentionDays, setRetentionDays] = useState('365');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings & Configuration</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure regional timezones, connector daemon settings, and biometric security parameters.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Timezone Configuration */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Regional Timezone Configuration
          </h3>
          <p className="text-xs text-slate-500">
            Biometric terminal timestamps are synchronized and converted according to this standard timezone.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Application Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30) - Default</option>
                <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT +08:00)</option>
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Device Heartbeat Interval</label>
              <select
                value={pollInterval}
                onChange={(e) => setPollInterval(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="1000">1000 ms (1 second)</option>
                <option value="3000">3000 ms (3 seconds) - Recommended</option>
                <option value="5000">5000 ms (5 seconds)</option>
                <option value="10000">10000 ms (10 seconds)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cloud Connector Relay Setup */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Network className="w-4 h-4 text-emerald-600" />
            Mode B — Cloud Connector Node Configuration
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            When deploying Next.js in the cloud, run the standalone connector agent (<code className="font-mono text-emerald-600">npm run connector</code>) on a local PC connected to the same switch as the S-FB3K.
          </p>

          <div className="space-y-3 text-xs font-mono bg-slate-950 p-4 rounded-xl text-slate-200 border border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-400">Node Identifier:</span>
              <span className="text-emerald-400">sfb3k-lan-node-01</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Connector Port:</span>
              <span className="text-emerald-400">5005</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Command Channel:</span>
              <span className="text-blue-400">Bidirectional receive_cmd</span>
            </div>
          </div>
        </div>

        {/* Data Retention */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-600" />
            Data Retention & Privacy
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Attendance Audit Retention</label>
              <select
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="90">90 Days</option>
                <option value="180">180 Days</option>
                <option value="365">365 Days (1 Year)</option>
                <option value="9999">Indefinite (Never delete)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Raw Payload Storage</label>
              <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="ENABLED">Enabled (JSON Audit Trail)</option>
                <option value="MASKED">Masked (Mask Biometric Templates)</option>
                <option value="DISABLED">Disabled (Discard Raw Payloads)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {saved ? (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
              <Save className="w-4 h-4" /> Settings updated successfully.
            </span>
          ) : (
            <span></span>
          )}

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm shadow-blue-500/20 transition"
          >
            <Save className="w-4 h-4" />
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
