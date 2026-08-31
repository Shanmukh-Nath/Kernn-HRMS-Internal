'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Bug,
  Activity,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Code,
  Layers,
  Shield,
  Eye,
  Terminal,
  Radio,
  Copy,
  Check,
  Filter,
  Zap,
  Server,
  ArrowRightLeft,
} from 'lucide-react';
import { formatAppTime } from '@/lib/timezone';

export default function DiagnosticsPage() {
  const [packets, setPackets] = useState<any[]>([]);
  const [requestLogs, setRequestLogs] = useState<any[]>([]);
  const [captureEnabled, setCaptureEnabled] = useState(true);
  const [selectedPacket, setSelectedPacket] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [activeTab, setActiveTab] = useState<'terminal' | 'packets' | 'logs'>('terminal');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const terminalBottomRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      const [capRes, logRes] = await Promise.all([
        fetch('/api/debug/capture'),
        fetch('/api/debug/logs'),
      ]);

      const capJson = await capRes.json();
      const logJson = await logRes.json();

      if (capJson.success) {
        setPackets(capJson.data.packets || []);
        setCaptureEnabled(capJson.data.enabled);
        if (!selectedPacket && capJson.data.packets?.length > 0) {
          setSelectedPacket(capJson.data.packets[0]);
        }
      }

      if (logJson.success) {
        setRequestLogs(logJson.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // 1. Automatic 2-second background refresh
    const autoRefreshInterval = setInterval(() => {
      fetchData();
    }, 2000);

    // 2. Real-time SSE stream listener
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/attendance/live');

      eventSource.addEventListener('wire_packet', (e: MessageEvent) => {
        try {
          const pkt = JSON.parse(e.data);
          setPackets((prev) => {
            if (prev.some((p) => p.id === pkt.id)) return prev;
            return [pkt, ...prev.slice(0, 499)];
          });
        } catch (err) {
          console.error('Error parsing SSE wire packet:', err);
        }
      });
    } catch {}

    return () => {
      clearInterval(autoRefreshInterval);
      if (eventSource) eventSource.close();
    };
  }, []);

  const handleTriggerProbe = async () => {
    setProbing(true);
    try {
      const devRes = await fetch('/api/devices');
      const devJson = await devRes.json();
      if (devJson.data?.[0]?.id) {
        await fetch(`/api/devices/${devJson.data[0].id}/sync/attendance`, { method: 'POST' });
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProbing(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Bug className="w-6 h-6 text-purple-600" />
            Live Hardware Protocol & Wire Sniffer
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time inspection of Server requests & S-FB3K hardware responses over TCP/IP LAN.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            AUTO-REFRESHING (2s)
          </div>

          <button
            onClick={handleTriggerProbe}
            disabled={probing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${probing ? 'animate-spin' : ''}`} />
            {probing ? 'Probing Hardware...' : 'Trigger Live Wire Query'}
          </button>
        </div>
      </div>

      {/* Connection Info Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Server Host IP</div>
            <div className="text-sm font-bold text-slate-900 font-mono">192.168.29.108:3000</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">S-FB3K Hardware IP</div>
            <div className="text-sm font-bold text-slate-900 font-mono">192.168.29.83:5005</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Hardware Serial #</div>
            <div className="text-sm font-bold text-purple-700 font-mono">102023050002456</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('terminal')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
            activeTab === 'terminal'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Terminal Stream ({packets.length})
        </button>

        <button
          onClick={() => setActiveTab('packets')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
            activeTab === 'packets'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Frame Breakdown Inspector
        </button>
      </div>

      {/* Tab: Terminal Stream */}
      {activeTab === 'terminal' && (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl p-5 text-slate-300 font-mono text-xs overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-yellow-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-green-500/80"></span>
              <span className="text-xs text-slate-400 ml-2 font-bold">secureye-sfb3k-wire-sniffer</span>
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              ACTIVE SOCKET CAPTURE
            </div>
          </div>

          <div className="h-[480px] overflow-y-auto space-y-3.5 pr-2">
            {packets.length === 0 ? (
              <div className="text-slate-600 text-center py-24">
                <Terminal className="w-8 h-8 mx-auto mb-2 opacity-40 text-purple-400 animate-pulse" />
                <p>Waiting for wire packets...</p>
                <p className="text-[11px] text-slate-500 mt-1">Click "Trigger Live Wire Query" or place finger on device.</p>
              </div>
            ) : (
              packets.map((pkt, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                      {pkt.rawText?.includes('SERVER -> DEVICE') ? '📤 SERVER -> DEVICE (QUERY)' : '📥 DEVICE -> SERVER (RESPONSE)'}
                    </span>
                    <span className="text-slate-500 text-[11px]">{formatAppTime(pkt.timestamp || new Date())}</span>
                  </div>

                  <div className="text-slate-200 text-xs font-semibold leading-relaxed">
                    {pkt.rawText || pkt.requestCode}
                  </div>

                  {pkt.payload && (
                    <div className="p-3 rounded-lg bg-black/60 text-[11px] text-emerald-300 border border-slate-800/80 overflow-x-auto">
                      <pre>{JSON.stringify(pkt.payload, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={terminalBottomRef} />
          </div>
        </div>
      )}

      {/* Tab: Frame Breakdown Inspector */}
      {activeTab === 'packets' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 h-[500px] overflow-y-auto">
            <h4 className="text-sm font-bold text-slate-900">Captured Wire Frames</h4>
            {packets.map((pkt, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedPacket(pkt)}
                className={`p-3 rounded-xl border transition cursor-pointer ${
                  selectedPacket === pkt
                    ? 'bg-purple-50 border-purple-300 shadow-sm'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold font-mono text-slate-800">{pkt.requestCode || 'SOCKET_PACKET'}</span>
                  <span className="text-slate-400">{formatAppTime(pkt.timestamp || new Date())}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1 truncate">{pkt.rawText}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 h-[500px] overflow-y-auto">
            <h4 className="text-sm font-bold text-slate-900">Frame Details & Payload</h4>
            {selectedPacket ? (
              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 font-bold block mb-1">Raw Description:</span>
                  <span className="text-slate-900">{selectedPacket.rawText}</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 text-emerald-400 overflow-x-auto">
                  <span className="text-slate-400 font-bold block mb-1">Payload JSON:</span>
                  <pre>{JSON.stringify(selectedPacket.payload || selectedPacket, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 text-xs">
                Select a wire frame on the left to inspect its contents.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
