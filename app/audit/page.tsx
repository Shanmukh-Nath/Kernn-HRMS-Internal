"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Shield, Search, Download, RefreshCw, Globe, Monitor,
  Smartphone, Tablet, Bot, MapPin, Wifi, Clock, User,
  ChevronLeft, ChevronRight, Filter, AlertTriangle, CheckCircle2,
  XCircle, Activity, Eye, X, Building2, Server, Terminal,
  MousePointer, FileSpreadsheet, Lock, AlertOctagon,
  Copy, Check, ExternalLink, Calendar, ArrowUpRight, Zap,
  UserCheck, HelpCircle, HardDrive, ShieldAlert, FileText,
  SlidersHorizontal, Radio
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────
interface AuditLog {
  _id?: string;
  id?: string;
  timestamp: string;
  eventType: 'API_CALL' | 'BUTTON_CLICK' | 'NAVIGATION' | 'FORM_SUBMIT' | 'DATA_EXPORT' | 'LOGIN_ATTEMPT' | 'SECURITY_ALERT';
  action: string;
  resource?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  user: {
    userId: string;
    employeeId?: string;
    name?: string;
    mobileNumber?: string;
    role?: string;
    department?: string;
  };
  ip: string;
  geo?: {
    country?: string;
    countryCode?: string;
    region?: string;
    regionName?: string;
    city?: string;
    lat?: number;
    lon?: number;
    timezone?: string;
  };
  isp?: {
    isp?: string;
    org?: string;
    as?: string;
    name?: string;
  };
  device?: {
    browser?: string;
    browserVersion?: string;
    os?: string;
    osVersion?: string;
    deviceType?: 'DESKTOP' | 'MOBILE' | 'TABLET' | 'BOT' | 'UNKNOWN';
    screenResolution?: string;
    viewport?: string;
    language?: string;
  };
  metadata?: Record<string, any>;
  userAgent?: string;
}

interface StatsData {
  totalEvents: number;
  todayEvents: number;
  highRiskEvents: number;
  uniqueIpCount: number;
}

// ── Visual Helpers ─────────────────────────────────────────────────────────
function EventTypeBadge({ type }: { type: string }) {
  switch (type) {
    case 'BUTTON_CLICK':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
          <MousePointer className="w-2.5 h-2.5" /> Click
        </span>
      );
    case 'DATA_EXPORT':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
          <Download className="w-2.5 h-2.5" /> Export
        </span>
      );
    case 'SECURITY_ALERT':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
          <ShieldAlert className="w-2.5 h-2.5" /> Alert
        </span>
      );
    case 'LOGIN_ATTEMPT':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
          <Lock className="w-2.5 h-2.5" /> Auth
        </span>
      );
    case 'NAVIGATION':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
          <Globe className="w-2.5 h-2.5" /> Nav
        </span>
      );
    case 'FORM_SUBMIT':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
          <FileText className="w-2.5 h-2.5" /> Submit
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Terminal className="w-2.5 h-2.5" /> API
        </span>
      );
  }
}

function RiskBadge({ level }: { level: string }) {
  switch (level) {
    case 'CRITICAL':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-rose-600 text-white shadow-xs animate-pulse">
          <AlertOctagon className="w-2.5 h-2.5" /> CRITICAL
        </span>
      );
    case 'HIGH':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-amber-500 text-white shadow-xs">
          <AlertTriangle className="w-2.5 h-2.5" /> HIGH
        </span>
      );
    case 'MEDIUM':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-amber-100 text-amber-800 border border-amber-200">
          MEDIUM
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-slate-100 text-slate-600 border border-slate-200">
          LOW
        </span>
      );
  }
}

function DeviceIcon({ type }: { type?: string }) {
  const cls = "w-3.5 h-3.5";
  if (type === "MOBILE") return <Smartphone className={cls} />;
  if (type === "TABLET") return <Tablet className={cls} />;
  if (type === "BOT") return <Bot className={cls} />;
  return <Monitor className={cls} />;
}

function StatusBadge({ code }: { code?: number }) {
  if (!code) return <span className="text-[10px] text-slate-400 font-mono">—</span>;
  let color = "bg-slate-100 text-slate-600 border-slate-200";
  if (code < 300) color = "bg-emerald-50 text-emerald-700 border-emerald-200";
  else if (code < 400) color = "bg-sky-50 text-sky-700 border-sky-200";
  else if (code < 500) color = "bg-amber-50 text-amber-700 border-amber-200";
  else color = "bg-rose-50 text-rose-700 border-rose-200";

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black font-mono border ${color}`}>
      {code}
    </span>
  );
}

const PAGE_SIZE = 50;

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<StatsData>({
    totalEvents: 0,
    todayEvents: 0,
    highRiskEvents: 0,
    uniqueIpCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // View Mode: 'LEDGER' | 'LEAK_INVESTIGATION'
  const [viewMode, setViewMode] = useState<'LEDGER' | 'LEAK_INVESTIGATION'>('LEDGER');

  // Filters
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [role, setRole] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [liveMode, setLiveMode] = useState(false);

  // Leak Investigation specific target
  const [investigateTarget, setInvestigateTarget] = useState("");

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const fetchLogs = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const activeSearch = viewMode === 'LEAK_INVESTIGATION' && investigateTarget.trim()
        ? investigateTarget.trim()
        : search.trim();

      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
        ...(activeSearch && { search: activeSearch }),
        ...(eventType && { eventType }),
        ...(riskLevel && { riskLevel }),
        ...(role && { role }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });

      const res = await fetch(`/api/audit/logs?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setLogs(json.data.logs || []);
        if (json.data.pagination) {
          setPage(json.data.pagination.page || targetPage);
          setTotalPages(json.data.pagination.totalPages || 1);
        }
        if (json.data.stats) {
          setStats(json.data.stats);
        }
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [viewMode, investigateTarget, search, eventType, riskLevel, role, startDate, endDate]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  // Live Auto-Refresh Heartbeat (every 5 seconds when toggled)
  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(() => {
      fetchLogs(1);
    }, 5000);
    return () => clearInterval(interval);
  }, [liveMode, fetchLogs]);

  const handleExport = (formatType: 'csv' | 'json') => {
    const params = new URLSearchParams({
      export: formatType,
      ...(search.trim() && { search: search.trim() }),
      ...(eventType && { eventType }),
      ...(riskLevel && { riskLevel }),
      ...(role && { role }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    });
    window.open(`/api/audit/logs?${params.toString()}`, '_blank');
  };

  const clearFilters = () => {
    setSearch("");
    setEventType("");
    setRiskLevel("");
    setRole("");
    setStartDate("");
    setEndDate("");
    setInvestigateTarget("");
  };

  const hasActiveFilters = Boolean(search || eventType || riskLevel || role || startDate || endDate);

  // Leak Investigation attribution profile from currently displayed logs
  const leakSummary = useMemo(() => {
    if (viewMode !== 'LEAK_INVESTIGATION' || logs.length === 0) return null;
    const targetUser = logs[0]?.user;
    const uniqueIps = Array.from(new Set(logs.map(l => l.ip).filter(Boolean)));
    const uniqueLocations = Array.from(new Set(logs.map(l => [l.geo?.city, l.geo?.country].filter(Boolean).join(", ")).filter(Boolean)));
    const uniqueIsps = Array.from(new Set(logs.map(l => l.isp?.isp || l.isp?.name || l.isp?.org).filter(Boolean)));
    const uniqueDevices = Array.from(new Set(logs.map(l => `${l.device?.os || ''} · ${l.device?.browser || ''}`).filter(Boolean)));
    const exportEvents = logs.filter(l => l.eventType === 'DATA_EXPORT' || (l.action && l.action.toLowerCase().includes('export')));
    const highRiskEvents = logs.filter(l => l.riskLevel === 'HIGH' || l.riskLevel === 'CRITICAL');

    return {
      user: targetUser,
      uniqueIps,
      uniqueLocations,
      uniqueIsps,
      uniqueDevices,
      exportCount: exportEvents.length,
      highRiskCount: highRiskEvents.length,
      totalTracked: logs.length,
    };
  }, [viewMode, logs]);

  return (
    <div className="space-y-6 max-w-full mx-auto pb-16 animate-fadeIn">
      {/* ── Top Header & Mission Control Bar ───────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-7 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-50 text-[#a92427] border border-rose-200 shadow-xs">
                <Shield className="w-3.5 h-3.5 text-[#a92427]" />
                Super Admin Security Center
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide bg-slate-900 text-white">
                <Lock className="w-2.5 h-2.5 text-emerald-400" />
                Immutable Audit Trail
              </span>
              {liveMode && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                  <Radio className="w-3 h-3 text-emerald-600 animate-ping" />
                  Live Syncing (5s)
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              Forensic Audit Trail & Leak Tracker
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-3xl leading-relaxed">
              Cryptographically verified, tamper-evident record of every button click, API transaction, and data mutation.
              Includes high-precision IP geolocation, autonomous system (ISP) attribution, and hardware device fingerprinting for data leak identification.
            </p>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Mode Switcher */}
            <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => { setViewMode('LEDGER'); fetchLogs(1); }}
                className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                  viewMode === 'LEDGER'
                    ? "bg-white text-slate-900 shadow-xs font-extrabold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-slate-500" />
                Ledger
              </button>
              <button
                onClick={() => { setViewMode('LEAK_INVESTIGATION'); fetchLogs(1); }}
                className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 ${
                  viewMode === 'LEAK_INVESTIGATION'
                    ? "bg-[#a92427] text-white shadow-xs font-extrabold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                Leak Investigation
              </button>
            </div>

            {/* Live Toggle */}
            <button
              onClick={() => setLiveMode((v) => !v)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold border transition-all shadow-xs ${
                liveMode
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-emerald-200"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Activity className={`w-3.5 h-3.5 ${liveMode ? "animate-spin" : ""}`} />
              {liveMode ? "Live On" : "Live Off"}
            </button>

            {/* Manual Refresh */}
            <button
              onClick={() => fetchLogs(page)}
              disabled={loading}
              className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {/* Export Dropdown */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs"
                title="Download CSV report"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition shadow-xs"
                title="Download full JSON dataset"
              >
                JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Metric Statistics ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Today's Footprint</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono tracking-tight">
            {stats.todayEvents.toLocaleString()}
          </div>
          <div className="text-[11px] font-medium text-slate-500 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Real-time active today
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Total Recorded</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono tracking-tight">
            {stats.totalEvents.toLocaleString()}
          </div>
          <div className="text-[11px] font-medium text-slate-500 mt-1">
            Global ledger archive
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden group hover:border-rose-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-rose-500 uppercase tracking-wider">Security Alerts</span>
            <div className="p-2 rounded-xl bg-rose-50 text-[#a92427]">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-700 font-mono tracking-tight">
            {stats.highRiskEvents.toLocaleString()}
          </div>
          <div className="text-[11px] font-bold text-rose-600 mt-1">
            High & Critical risk flags
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Unique Networks</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-700 font-mono tracking-tight">
            {stats.uniqueIpCount.toLocaleString()}
          </div>
          <div className="text-[11px] font-medium text-slate-500 mt-1">
            Distinct IP origin addresses
          </div>
        </div>
      </div>

      {/* ── Mode 2: Leak Investigation Assistant Header ────────────────────── */}
      {viewMode === 'LEAK_INVESTIGATION' && (
        <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg space-y-6 animate-scaleUp border border-rose-800/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-400/30">
                <AlertOctagon className="w-3.5 h-3.5" /> Incident Forensics Reconstructor
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Pinpoint Who Viewed or Leaked Confidential Information
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
                Enter an employee’s name, ID, or suspicious IP address. We reconstruct their exact clickstream, export actions, and network identity down to ISP and GPS coordinates.
              </p>
            </div>
            <div className="relative min-w-[280px] sm:min-w-[340px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Target Employee Name, ID, or IP..."
                value={investigateTarget}
                onChange={(e) => setInvestigateTarget(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchLogs(1); }}
                className="w-full pl-10 pr-24 py-3 bg-white/10 border border-white/20 rounded-2xl text-xs font-semibold text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white/15"
              />
              <button
                onClick={() => fetchLogs(1)}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-black transition shadow-xs"
              >
                Inspect
              </button>
            </div>
          </div>

          {/* Investigation Attribution Dossier */}
          {leakSummary && leakSummary.totalTracked > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Identity</span>
                <div className="text-base font-black text-white">{leakSummary.user?.name || "Unknown"}</div>
                <div className="text-xs text-rose-300 font-medium">Role: {leakSummary.user?.role?.replace("_", " ") || "N/A"}</div>
                <div className="text-[11px] text-slate-400 font-mono">Emp ID: {leakSummary.user?.employeeId || leakSummary.user?.userId || "—"}</div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Network & ISP</span>
                <div className="text-xs font-bold text-white font-mono truncate">{leakSummary.uniqueIps.join(", ") || "No IP logged"}</div>
                <div className="text-[11px] text-emerald-300 truncate">{leakSummary.uniqueIsps.join(" · ") || "ISP Unknown"}</div>
                <div className="text-[10px] text-slate-400">{leakSummary.uniqueLocations.join(" · ") || "Location Unknown"}</div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Device Hardware</span>
                <div className="text-xs font-bold text-white truncate">{leakSummary.uniqueDevices.join(", ") || "Unknown Device"}</div>
                <div className="text-[11px] text-slate-400">Total Captured Clicks: {leakSummary.totalTracked}</div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Risk Level Analysis</span>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-500/30 text-rose-300 border border-rose-500/40">
                    {leakSummary.exportCount} Exports
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-500/30 text-amber-300 border border-amber-500/40">
                    {leakSummary.highRiskCount} Alerts
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Timeline below shows exact chronological trail.</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Advanced Filter Console ───────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3.5">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user, employee ID, action, button text, IP, city, or ISP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchLogs(1); }}
              className="pl-9 pr-4 py-2.5 w-full bg-slate-50/80 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#a92427] focus:bg-white transition"
            />
          </div>

          {/* Event Type Filter */}
          <select
            value={eventType}
            onChange={(e) => { setEventType(e.target.value); }}
            className="px-3 py-2.5 bg-slate-50/80 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
          >
            <option value="">All Event Types</option>
            <option value="BUTTON_CLICK">Button Click</option>
            <option value="API_CALL">API Call</option>
            <option value="DATA_EXPORT">Data Export</option>
            <option value="FORM_SUBMIT">Form Submit</option>
            <option value="LOGIN_ATTEMPT">Login Attempt</option>
            <option value="NAVIGATION">Page Navigation</option>
            <option value="SECURITY_ALERT">Security Alert</option>
          </select>

          {/* Risk Level Filter */}
          <select
            value={riskLevel}
            onChange={(e) => { setRiskLevel(e.target.value); }}
            className="px-3 py-2.5 bg-slate-50/80 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
          >
            <option value="">All Risk Levels</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="LOW">Low Risk</option>
          </select>

          {/* Role Filter */}
          <select
            value={role}
            onChange={(e) => { setRole(e.target.value); }}
            className="px-3 py-2.5 bg-slate-50/80 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#a92427]"
          >
            <option value="">All User Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="HR_ADMIN">HR Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="EMPLOYEE">Employee</option>
          </select>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-1.5 bg-slate-50/80 border border-slate-200 rounded-2xl px-3 py-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs font-mono bg-transparent text-slate-700 focus:outline-none"
              title="From date"
            />
            <span className="text-slate-300 text-xs font-bold">–</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs font-mono bg-transparent text-slate-700 focus:outline-none"
              title="To date"
            />
          </div>

          <button
            onClick={() => fetchLogs(1)}
            className="px-4 py-2.5 rounded-2xl text-xs font-black bg-[#a92427] text-white hover:bg-[#8b1e20] transition shadow-xs"
          >
            Apply Filters
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2.5 rounded-2xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 overflow-x-auto pb-1 text-xs">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">Quick Presets:</span>
          <button
            onClick={() => { setEventType("BUTTON_CLICK"); }}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition shrink-0 ${
              eventType === 'BUTTON_CLICK' ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            🖱️ Clicks Only
          </button>
          <button
            onClick={() => { setEventType("DATA_EXPORT"); }}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition shrink-0 ${
              eventType === 'DATA_EXPORT' ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            📥 Exports & Downloads
          </button>
          <button
            onClick={() => { setRiskLevel("HIGH"); }}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition shrink-0 ${
              riskLevel === 'HIGH' ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            ⚠️ High & Critical Risk
          </button>
          <button
            onClick={() => {
              const today = new Date().toISOString().split('T')[0];
              setStartDate(today);
              setEndDate(today);
            }}
            className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition shrink-0"
          >
            📅 Today Only
          </button>
        </div>
      </div>

      {/* ── Main Forensic Table & Stream ──────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <Shield className="w-10 h-10 mx-auto text-slate-300 animate-pulse" />
            <div className="text-sm font-bold text-slate-700">Loading Forensics Ledger...</div>
            <p className="text-xs text-slate-400">Verifying tamper-evident records across database nodes...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-24 text-center space-y-3">
            <Shield className="w-12 h-12 text-slate-300 mx-auto" />
            <div className="text-base font-black text-slate-800">No Forensic Events Match Query</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No audit logs matched your search terms or filters. Try clearing or expanding your date range.
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="overflow-x-auto hidden lg:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-5">Timestamp (UTC)</th>
                    <th className="py-3.5 px-5">Actor / Identity</th>
                    <th className="py-3.5 px-5">Event & Action</th>
                    <th className="py-3.5 px-5">Target / Resource</th>
                    <th className="py-3.5 px-5">Network & ISP Footprint</th>
                    <th className="py-3.5 px-5">Device Environment</th>
                    <th className="py-3.5 px-5 text-center">Status</th>
                    <th className="py-3.5 px-5 text-right">Forensics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {logs.map((log, index) => {
                    const userName = log.user?.name || "Unknown User";
                    const initials = userName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
                    const logId = log.id || log._id || String(index);

                    return (
                      <tr
                        key={logId}
                        onClick={() => setSelected(log)}
                        className="hover:bg-slate-50/90 transition-colors group cursor-pointer"
                      >
                        {/* Timestamp */}
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <div className="font-bold text-slate-800 font-mono text-[11px]">
                            {log.timestamp ? format(new Date(log.timestamp), "dd MMM yyyy") : "—"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-300" />
                            {log.timestamp ? format(new Date(log.timestamp), "HH:mm:ss.SSS") : ""}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {log.timestamp ? formatDistanceToNow(new Date(log.timestamp), { addSuffix: true }) : ""}
                          </div>
                        </td>

                        {/* User Identity */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-black text-[11px] flex items-center justify-center border border-slate-200 shrink-0">
                              {initials}
                            </div>
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-900 leading-tight">{userName}</div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                  {log.user?.role?.replace("_", " ") || "UNKNOWN"}
                                </span>
                                {log.user?.employeeId && (
                                  <span className="text-[10px] font-mono text-slate-400">
                                    #{log.user.employeeId}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Event & Action */}
                        <td className="py-3.5 px-5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <EventTypeBadge type={log.eventType} />
                              <RiskBadge level={log.riskLevel} />
                            </div>
                            <div className="font-semibold text-slate-800 text-[11px] max-w-[220px] truncate" title={log.action}>
                              {log.action}
                            </div>
                          </div>
                        </td>

                        {/* Target / Resource */}
                        <td className="py-3.5 px-5 max-w-[220px]">
                          <div className="space-y-0.5">
                            {log.metadata?.buttonText && (
                              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50/80 text-indigo-700 font-mono text-[10px] truncate max-w-[200px]" title={log.metadata.buttonText}>
                                <MousePointer className="w-2.5 h-2.5" />
                                "{log.metadata.buttonText}"
                              </div>
                            )}
                            <div className="font-mono text-[10px] text-slate-500 truncate" title={log.resource || log.metadata?.targetElement}>
                              {log.resource || log.metadata?.targetElement || "—"}
                            </div>
                            {log.method && (
                              <span className="text-[9px] font-black font-mono text-slate-400 uppercase">
                                Method: {log.method}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Network & ISP */}
                        <td className="py-3.5 px-5">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-slate-800 font-bold text-[11px]">
                              <MapPin className="w-3 h-3 text-[#a92427] shrink-0" />
                              <span className="truncate max-w-[140px]">
                                {[log.geo?.city, log.geo?.country].filter(Boolean).join(", ") || "Location Unknown"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                              <Globe className="w-2.5 h-2.5 text-slate-400" />
                              <span>{log.ip || "—"}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                              <Building2 className="w-2.5 h-2.5 text-slate-400" />
                              <span className="truncate max-w-[150px]" title={log.isp?.isp || log.isp?.name || log.isp?.org}>
                                {log.isp?.isp || log.isp?.name || log.isp?.org || "ISP Unknown"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Device Environment */}
                        <td className="py-3.5 px-5">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-[11px]">
                              <DeviceIcon type={log.device?.deviceType} />
                              <span>{log.device?.os || "OS Unknown"}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                              {log.device?.browser} {log.device?.browserVersion}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          <StatusBadge code={log.statusCode} />
                          {log.durationMs != null && (
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                              {log.durationMs}ms
                            </div>
                          )}
                        </td>

                        {/* Details Button */}
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(log);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition shadow-2xs group-hover:bg-[#a92427] group-hover:text-white"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Card View */}
            <div className="lg:hidden divide-y divide-slate-100">
              {logs.map((log, idx) => (
                <div
                  key={log.id || log._id || idx}
                  onClick={() => setSelected(log)}
                  className="p-4 sm:p-5 space-y-3 hover:bg-slate-50 transition cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-black text-slate-900 text-sm">{log.user?.name || "Unknown User"}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {log.timestamp ? format(new Date(log.timestamp), "dd MMM yyyy, HH:mm:ss") : "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <EventTypeBadge type={log.eventType} />
                      <RiskBadge level={log.riskLevel} />
                    </div>
                  </div>

                  <div className="text-xs font-bold text-slate-800 bg-slate-50 p-2 rounded-xl border border-slate-100 break-words">
                    {log.action}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#a92427]" />
                      <span className="truncate">{[log.geo?.city, log.geo?.country].filter(Boolean).join(", ") || "—"}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      <Globe className="w-3 h-3 text-slate-400" />
                      <span className="truncate">{log.ip}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span className="truncate">{log.isp?.isp || log.isp?.name || "—"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DeviceIcon type={log.device?.deviceType} />
                      <span className="truncate">{log.device?.os} · {log.device?.browser}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
              <span className="text-xs text-slate-500 font-medium font-mono">
                Showing Page {page} of {Math.max(totalPages, 1)} ({stats.totalEvents.toLocaleString()} total logged events)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1 || loading}
                  onClick={() => fetchLogs(page - 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-40 transition shadow-2xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <div className="text-xs font-black text-slate-800 px-3 py-1 bg-white border border-slate-200 rounded-xl font-mono">
                  {page} / {Math.max(totalPages, 1)}
                </div>
                <button
                  disabled={page >= totalPages || loading}
                  onClick={() => fetchLogs(page + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-40 transition shadow-2xs"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Deep Forensic Investigation Modal ─────────────────────────────── */}
      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md animate-fadeIn"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-900 text-white p-6 flex items-start justify-between border-b border-slate-800">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Audit Forensics Dossier
                  </span>
                  <EventTypeBadge type={selected.eventType} />
                  <RiskBadge level={selected.riskLevel} />
                  <StatusBadge code={selected.statusCode} />
                </div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#a92427]" />
                  {selected.action}
                </h3>
                <div className="text-xs text-slate-400 font-mono">
                  Captured at: {selected.timestamp ? format(new Date(selected.timestamp), "EEEE, dd MMMM yyyy HH:mm:ss.SSS 'UTC'") : "—"}
                </div>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Top Summary Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* User Identity Dossier */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-500" />
                      Actor Attribution
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700">
                      {selected.user?.role?.replace("_", " ") || "UNKNOWN"}
                    </span>
                  </div>
                  <DossierRow label="Full Name" value={selected.user?.name || "Unknown"} />
                  <DossierRow label="Employee ID" value={selected.user?.employeeId || "—"} mono />
                  <DossierRow label="User ID" value={selected.user?.userId || "—"} mono copyable />
                  <DossierRow label="Mobile / Contact" value={selected.user?.mobileNumber || "—"} />
                  <DossierRow label="Department" value={selected.user?.department || "General"} />
                </div>

                {/* Geolocation & Network Dossier */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-[#a92427]" />
                      Location & Network Origin
                    </span>
                    {selected.geo?.lat && selected.geo?.lon && (
                      <a
                        href={`https://www.google.com/maps?q=${selected.geo.lat},${selected.geo.lon}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#a92427] hover:underline"
                      >
                        Map Pin <ArrowUpRight className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <DossierRow label="IP Address" value={selected.ip || "—"} mono copyable />
                  <DossierRow label="City & Country" value={[selected.geo?.city, selected.geo?.country].filter(Boolean).join(", ") || "—"} />
                  <DossierRow label="ISP Provider" value={selected.isp?.isp || selected.isp?.name || "—"} />
                  <DossierRow label="Org / Autonomous Sys" value={selected.isp?.org || selected.isp?.as || "—"} />
                  <DossierRow label="Timezone" value={selected.geo?.timezone || "—"} mono />
                  {selected.geo?.lat && selected.geo?.lon && (
                    <DossierRow label="GPS Coordinates" value={`${selected.geo.lat.toFixed(5)}, ${selected.geo.lon.toFixed(5)}`} mono />
                  )}
                </div>
              </div>

              {/* Hardware Device Fingerprint */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-purple-600" />
                    Hardware & Browser Fingerprint
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-50 text-purple-700">
                    {selected.device?.deviceType || "DESKTOP"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DossierRow label="Operating System" value={`${selected.device?.os || "—"} ${selected.device?.osVersion || ""}`} />
                  <DossierRow label="Browser" value={`${selected.device?.browser || "—"} ${selected.device?.browserVersion || ""}`} />
                  <DossierRow label="Screen Resolution" value={selected.device?.screenResolution || "—"} mono />
                  <DossierRow label="Active Viewport" value={selected.device?.viewport || "—"} mono />
                  <DossierRow label="System Language" value={selected.device?.language || "—"} />
                </div>
                {selected.userAgent && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Raw User-Agent Header
                    </span>
                    <div className="bg-white rounded-xl p-2.5 border border-slate-200 text-[10px] font-mono text-slate-600 break-all select-all">
                      {selected.userAgent}
                    </div>
                  </div>
                )}
              </div>

              {/* Resource & Operation Target */}
              <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Action Target & API Route
                </span>
                <div className="font-mono text-xs text-emerald-400 break-all select-all">
                  {selected.method ? `[${selected.method}] ` : ""}{selected.resource || "N/A"}
                </div>
                {selected.metadata?.targetElement && (
                  <div className="text-[11px] font-mono text-slate-300">
                    DOM Selector: <span className="text-amber-300">{selected.metadata.targetElement}</span>
                  </div>
                )}
                {selected.metadata?.buttonText && (
                  <div className="text-[11px] font-mono text-slate-300">
                    Button Label: <span className="text-sky-300">"{selected.metadata.buttonText}"</span>
                  </div>
                )}
              </div>

              {/* Extended Metadata / Payload JSON */}
              {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-slate-500" />
                      Payload Context & Form Parameters
                    </span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(selected.metadata, null, 2), "payload")}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-white px-2 py-1 rounded-lg border border-slate-200 transition"
                    >
                      {copiedField === "payload" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      {copiedField === "payload" ? "Copied" : "Copy JSON"}
                    </button>
                  </div>
                  <pre className="text-[11px] text-slate-800 font-mono bg-white p-3.5 rounded-xl border border-slate-200 overflow-x-auto whitespace-pre-wrap max-h-48">
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                Log Record ID: {selected.id || selected._id || "—"}
              </span>
              <button
                onClick={() => setSelected(null)}
                className="px-5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs"
              >
                Close Forensics Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper Component for Dossier Rows ──────────────────────────────────────
function DossierRow({
  label,
  value,
  mono = false,
  copyable = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between gap-2 py-0.5 text-xs">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-1.5 truncate">
        <span className={`font-semibold text-slate-800 truncate ${mono ? "font-mono text-[11px]" : ""}`}>
          {value}
        </span>
        {copyable && value && value !== "—" && (
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
            title="Copy value"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
          </button>
        )}
      </div>
    </div>
  );
}
