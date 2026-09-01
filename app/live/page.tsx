'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Fingerprint,
  ScanFace,
  CreditCard,
  KeyRound,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  Volume2,
  VolumeX,
  Activity,
  Terminal,
  Server,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { formatAppDate, formatAppTime } from '@/lib/timezone';

export default function LiveMonitorPage() {
  const [punches, setPunches] = useState<any[]>([]);
  const [livePackets, setLivePackets] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const lastPunchIdRef = useRef<string | null>(null);

  // Fetch recent punches
  const fetchRecentPunches = async () => {
    try {
      const res = await fetch('/api/attendance?page=1&limit=30');
      const json = await res.json();
      if (json.success && json.data?.events) {
        const events = json.data.events;
        setPunches(events);

        // Check if there is a new punch to play chime
        if (events.length > 0) {
          const latest = events[0];
          if (lastPunchIdRef.current && lastPunchIdRef.current !== latest.id && soundEnabled) {
            playChime();
          }
          lastPunchIdRef.current = latest.id;
        }
      }
    } catch {}
  };

  const fetchLivePackets = async () => {
    try {
      const res = await fetch('/api/debug/capture');
      const json = await res.json();
      if (json.success && json.data?.packets) {
        setLivePackets(json.data.packets.slice(0, 30));
      }
    } catch {}
  };

  const playChime = () => {
    try {
      if (typeof window !== 'undefined') {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      }
    } catch {}
  };

  useEffect(() => {
    fetchRecentPunches();
    fetchLivePackets();

    // 1. High-Frequency Auto-Refresh Poller (Every 2 seconds)
    const pollInterval = setInterval(() => {
      fetchRecentPunches();
      fetchLivePackets();
    }, 2000);

    // 2. Real-Time SSE Stream
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/attendance/live');
      es.onopen = () => setConnected(true);

      es.addEventListener('punch', (evt: MessageEvent) => {
        try {
          const punch = JSON.parse(evt.data);
          setPunches((prev) => {
            if (prev.some((p) => p.id === punch.id)) return prev;
            return [punch, ...prev.slice(0, 49)];
          });
          if (soundEnabled) playChime();
        } catch {}
      });

      es.addEventListener('wire_packet', (evt: MessageEvent) => {
        try {
          const pkt = JSON.parse(evt.data);
          setLivePackets((prev) => [pkt, ...prev.slice(0, 29)]);
        } catch {}
      });

      es.onerror = () => setConnected(false);
    } catch {}

    return () => {
      clearInterval(pollInterval);
      if (es) es.close();
    };
  }, [soundEnabled]);

  const getVerificationIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'FACE':
        return <ScanFace className="w-5 h-5 text-purple-600" />;
      case 'CARD':
        return <CreditCard className="w-5 h-5 text-blue-600" />;
      case 'PASSWORD':
        return <KeyRound className="w-5 h-5 text-amber-600" />;
      default:
        return <Fingerprint className="w-5 h-5 text-emerald-600" />;
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchRecentPunches(), fetchLivePackets()]);
      const now = new Date();
      setLastRefreshedAt(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} IST`
      );
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Live Monitor Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </span>
            <h2 className="text-xl font-bold tracking-tight">Real-Time Biometric Terminal Monitor</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Live auto-updating stream between Server (<code className="text-blue-400 font-mono">192.168.29.108</code>) and Secureye S-FB3K (<code className="text-emerald-400 font-mono">192.168.29.83:5005</code>).
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition disabled:opacity-50 cursor-pointer"
            title="Fetch latest punches and packets immediately"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Live Feed'}</span>
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              soundEnabled
                ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {soundEnabled ? 'Chime Active' : 'Mute'}
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs font-medium text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            AUTO-SYNC (2s)
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Punch Feed (2 Columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Live Punch Events ({punches.length})
            </h3>
            <div className="flex items-center gap-2">
              {lastRefreshedAt && (
                <span className="text-[11px] text-slate-400 font-mono">
                  Synced: {lastRefreshedAt}
                </span>
              )}
              <button
                onClick={handleManualRefresh}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 transition"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {punches.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm text-slate-400">
              <Radio className="w-10 h-10 mx-auto mb-3 opacity-40 animate-pulse text-blue-500" />
              <p className="text-base font-semibold text-slate-700">Waiting for biometric punch events...</p>
              <p className="text-xs text-slate-400 mt-1">Place your finger, face, or card on the S-FB3K machine.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {punches.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        {getVerificationIcon(p.verificationType || p.verifyType)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{p.employee?.name || p.employeeName || `Employee ${p.deviceUserId || p.userId}`}</div>
                        <div className="text-xs text-slate-400 font-mono">
                          ID: #{p.deviceUserId || p.userId} {p.employee?.employeeCode ? `• ${p.employee.employeeCode}` : ''}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        (p.eventType || 'CHECK_IN') === 'CHECK_IN'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {(p.eventType || 'CHECK_IN') === 'CHECK_IN' ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                      {p.eventType || 'CHECK_IN'}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-600">{p.device?.name || p.deviceName || 'Secureye S-FB3K'}</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {formatAppTime(p.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Real-time Wire Packet Activity Panel (1 Column) */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-600" />
            Live Hardware Wire Activity
          </h3>

          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 shadow-lg text-xs font-mono text-slate-300 h-[520px] overflow-y-auto space-y-3">
            {livePackets.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Cpu className="w-8 h-8 mx-auto mb-2 opacity-30 text-purple-400 animate-spin" />
                <p>Sniffing socket packets...</p>
                <p className="text-[10px] mt-1 text-slate-600">Auto-poller active (every 4s)</p>
              </div>
            ) : (
              livePackets.map((pkt, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 font-bold">
                      {pkt.rawText?.includes('SERVER -> DEVICE') ? '📤 [SERVER QUERY]' : '📥 [DEVICE RESPONSE]'}
                    </span>
                    <span className="text-slate-500 text-[10px]">{formatAppTime(pkt.timestamp || new Date())}</span>
                  </div>

                  <div className="text-slate-200 text-[11px] leading-relaxed">
                    {pkt.rawText || pkt.requestCode || 'Socket Packet Frame'}
                  </div>

                  {pkt.payload && (
                    <div className="p-2 rounded bg-black/50 text-[10px] text-slate-400 border border-slate-800/80 overflow-x-auto">
                      {JSON.stringify(pkt.payload, null, 2)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
