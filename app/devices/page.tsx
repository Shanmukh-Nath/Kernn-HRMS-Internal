'use client';

import { useState, useEffect } from 'react';
import {
  HardDrive,
  Plus,
  Play,
  RefreshCw,
  Clock,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Radio,
  ExternalLink,
  ShieldCheck,
  Activity,
  Cpu,
  Radar,
  Wifi,
  Search,
  Zap,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { formatAppDateTime } from '@/lib/timezone';

interface DeviceItem {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  deviceId: string;
  protocol: string;
  enabled: boolean;
  pollingEnabled: boolean;
  pollingInterval: number;
  status: string;
  firmware: string | null;
  userCount: number;
  logCount: number;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  _count?: {
    employees: number;
    attendance: number;
  };
}

interface DiscoveredDeviceItem {
  ip: string;
  openPorts: number[];
  primaryPort: number;
  deviceType: 'CONFIRMED_BIOMETRIC' | 'CANDIDATE_BIOMETRIC' | 'ACTIVE_HOST';
  latencyMs: number;
  macAddress?: string;
  model?: string;
  firmware?: string;
  deviceId?: string;
  notes?: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceItem | null>(null);

  // Network Scanner Modal State
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [networkInterfaces, setNetworkInterfaces] = useState<any[]>([]);
  const [selectedSubnet, setSelectedSubnet] = useState('');
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDeviceItem[]>([]);
  const [filterBiometricOnly, setFilterBiometricOnly] = useState(true);

  // Diagnostic Test Modal State
  const [testDevice, setTestDevice] = useState<DeviceItem | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  // Status Info Sheet State
  const [statusDevice, setStatusDevice] = useState<DeviceItem | null>(null);
  const [statusData, setStatusData] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Form inputs
  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    port: 80,
    deviceId: '',
    protocol: 'Secureye/FKWeb',
    pollingEnabled: true,
    pollingInterval: 3000,
  });

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices');
      const json = await res.json();
      if (json.success) setDevices(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleStartNetworkScan = async (subnet?: string) => {
    setScanning(true);
    setDiscoveredDevices([]);

    try {
      const targetSubnet = subnet || selectedSubnet;
      const res = await fetch('/api/devices/discover', {
        method: targetSubnet ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        ...(targetSubnet ? { body: JSON.stringify({ subnetPrefix: targetSubnet }) } : {}),
      });

      const json = await res.json();
      if (json.success) {
        setDiscoveredDevices(json.data.devices || []);
        if (json.data.interfaces) {
          setNetworkInterfaces(json.data.interfaces);
          if (!selectedSubnet && json.data.interfaces.length > 0) {
            setSelectedSubnet(json.data.interfaces[0].subnetPrefix);
          }
        }
      }
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleQuickAddDiscovered = async (item: DiscoveredDeviceItem) => {
    const defaultName = item.model || `Secureye S-FB3K (${item.ip})`;
    const defaultId = item.deviceId || `SFB3K_${item.ip.replace(/\./g, '_')}`;

    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: defaultName,
          ipAddress: item.ip,
          port: item.primaryPort || 80,
          deviceId: defaultId,
          protocol: 'Secureye/FKWeb',
          pollingEnabled: true,
          pollingInterval: 3000,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowScanModal(false);
        fetchDevices();
        handleRunTest(json.data);
      } else {
        alert(json.error?.message || 'Failed to add device');
      }
    } catch {
      alert('Error adding discovered device');
    }
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingDevice ? `/api/devices/${editingDevice.id}` : '/api/devices';
      const method = editingDevice ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setEditingDevice(null);
        fetchDevices();
        if (!editingDevice) {
          handleRunTest(json.data);
        }
      } else {
        alert(json.error?.message || 'Failed to save device');
      }
    } catch (err) {
      alert('Network error while saving device.');
    }
  };

  const handleDeleteDevice = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}? Attendance history will be detached.`)) return;
    try {
      await fetch(`/api/devices/${id}`, { method: 'DELETE' });
      fetchDevices();
    } catch (err) {
      alert('Failed to delete device');
    }
  };

  const handleRunTest = async (device: DeviceItem) => {
    setTestDevice(device);
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(`/api/devices/${device.id}/test`, { method: 'POST' });
      const json = await res.json();
      setTestResult(json.data || json.error);
    } catch (err) {
      setTestResult({ success: false, errorMessage: 'Network communication error with server.' });
    } finally {
      setTesting(false);
      fetchDevices();
    }
  };

  const handleFetchStatus = async (device: DeviceItem) => {
    setStatusDevice(device);
    setLoadingStatus(true);
    try {
      const res = await fetch(`/api/devices/${device.id}/status`);
      const json = await res.json();
      setStatusData(json.data?.liveStatus || {});
    } catch (err) {
      setStatusData({ error: 'Failed to retrieve live status' });
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleTriggerSync = async (deviceId: string, type: 'users' | 'attendance' | 'time') => {
    try {
      const res = await fetch(`/api/devices/${deviceId}/sync/${type}`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        alert(`Sync (${type}) completed successfully!`);
        fetchDevices();
      } else {
        alert(`Sync failed: ${json.error?.message || 'Unknown error'}`);
      }
    } catch {
      alert(`Sync failed due to connection timeout.`);
    }
  };

  const filteredDiscovered = discoveredDevices.filter((d) =>
    filterBiometricOnly ? d.deviceType === 'CONFIRMED_BIOMETRIC' || d.deviceType === 'CANDIDATE_BIOMETRIC' : true
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Connected Devices</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure Secureye S-FB3K terminals, scan local LAN subnets, and monitor connectivity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Discovery Button */}
          <button
            onClick={() => {
              setShowScanModal(true);
              if (discoveredDevices.length === 0) {
                handleStartNetworkScan();
              }
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <Radar className="w-4 h-4 text-emerald-400" />
            Scan LAN for S-FB3K
          </button>

          {/* Add Manual Device Button */}
          <button
            onClick={() => {
              setEditingDevice(null);
              setFormData({
                name: '',
                ipAddress: '',
                port: 80,
                deviceId: '',
                protocol: 'Secureye/FKWeb',
                pollingEnabled: true,
                pollingInterval: 3000,
              });
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm shadow-blue-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            Manual Add
          </button>
        </div>
      </div>

      {/* Devices List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Terminal & Hardware ID</th>
                <th className="px-6 py-4">Network / IP</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Last Seen</th>
                <th className="px-6 py-4 text-center">Users</th>
                <th className="px-6 py-4 text-center">Logs</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium text-slate-700">No biometric terminals connected yet.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Click <strong className="text-slate-700">"Scan LAN for S-FB3K"</strong> to automatically discover devices on your network.
                    </p>
                  </td>
                </tr>
              ) : (
                devices.map((dev) => (
                  <tr key={dev.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{dev.name}</div>
                      <div className="text-xs font-mono text-slate-400">SN: {dev.deviceId}</div>
                      {dev.firmware && (
                        <div className="text-[11px] text-blue-600 font-medium">{dev.firmware}</div>
                      )}
                    </td>

                    <td className="px-6 py-4 font-mono text-xs text-slate-700">
                      <div>{dev.ipAddress}:{dev.port}</div>
                      <div className="text-[10px] text-slate-400">{dev.protocol}</div>
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge status={dev.status} lastSeen={dev.lastSeenAt} />
                      {dev.lastError && (
                        <p className="text-[11px] text-amber-600 mt-1 max-w-xs truncate" title={dev.lastError}>
                          {dev.lastError}
                        </p>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-500">
                      {formatAppDateTime(dev.lastSeenAt)}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="font-semibold text-slate-900">{dev.userCount || dev._count?.employees || 0}</span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="font-semibold text-slate-900">{dev.logCount || dev._count?.attendance || 0}</span>
                    </td>

                    <td className="px-6 py-4 text-right space-x-1">
                      <button
                        onClick={() => handleRunTest(dev)}
                        title="Test TCP & Protocol Connectivity"
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleFetchStatus(dev)}
                        title="Query Device Status"
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 text-blue-600 transition"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleTriggerSync(dev.id, 'attendance')}
                        title="Sync Attendance Logs"
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-emerald-50 text-emerald-600 transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleTriggerSync(dev.id, 'time')}
                        title="Sync Device Clock with Server"
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-amber-50 text-amber-600 transition"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setEditingDevice(dev);
                          setFormData({
                            name: dev.name,
                            ipAddress: dev.ipAddress,
                            port: dev.port,
                            deviceId: dev.deviceId,
                            protocol: dev.protocol,
                            pollingEnabled: dev.pollingEnabled,
                            pollingInterval: dev.pollingInterval,
                          });
                          setShowAddModal(true);
                        }}
                        title="Edit Device Settings"
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteDevice(dev.id, dev.name)}
                        title="Remove Device"
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-rose-600 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Network Auto-Discovery Modal */}
      {showScanModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Radar className="w-5 h-5 text-blue-600" />
                  LAN Device Discovery & Auto-Scanner
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scans your local subnet for responsive Secureye S-FB3K terminals and biometric access hardware.
                </p>
              </div>

              <button
                onClick={() => handleStartNetworkScan()}
                disabled={scanning}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                {scanning ? 'Scanning Network...' : 'Rescan Subnet'}
              </button>
            </div>

            {/* Subnet selector & Filter */}
            <div className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-100 bg-slate-50/50 -mx-6 px-6">
              <div className="flex items-center gap-2">
                <Wifi className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold text-slate-700">Subnet:</span>
                {networkInterfaces.length > 0 ? (
                  <select
                    value={selectedSubnet}
                    onChange={(e) => {
                      setSelectedSubnet(e.target.value);
                      handleStartNetworkScan(e.target.value);
                    }}
                    className="px-2 py-1 bg-white border border-slate-300 rounded font-mono font-semibold"
                  >
                    {networkInterfaces.map((iface) => (
                      <option key={iface.name} value={iface.subnetPrefix}>
                        {iface.name} ({iface.subnetPrefix}.0/24)
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-mono font-semibold text-slate-700">192.168.29.0/24</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterBiometricOnly}
                    onChange={(e) => setFilterBiometricOnly(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700 font-medium">Biometric Candidates Only</span>
                </label>
              </div>
            </div>

            {/* Discovered List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {scanning && discoveredDevices.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-3">
                  <div className="relative flex justify-center">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 animate-pulse">
                      <Radar className="w-6 h-6 animate-spin" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">Sweeping Subnet IP Range (1 to 254)...</p>
                  <p className="text-xs text-slate-400">Probing biometric ports 80, 5005, 7005, 8080, 4370...</p>
                </div>
              ) : filteredDiscovered.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500 opacity-60" />
                  <p className="text-sm font-medium text-slate-700">No matching devices discovered on this subnet.</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Make sure the S-FB3K is connected to the same Wi-Fi/switch. Try unchecking "Biometric Candidates Only" to view all active network hosts.
                  </p>
                </div>
              ) : (
                filteredDiscovered.map((item) => (
                  <div
                    key={item.ip}
                    className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      item.deviceType === 'CONFIRMED_BIOMETRIC'
                        ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-500/20'
                        : item.deviceType === 'CANDIDATE_BIOMETRIC'
                        ? 'bg-blue-50/60 border-blue-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono text-sm">{item.ip}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            item.deviceType === 'CONFIRMED_BIOMETRIC'
                              ? 'bg-emerald-600 text-white'
                              : item.deviceType === 'CANDIDATE_BIOMETRIC'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {item.deviceType === 'CONFIRMED_BIOMETRIC'
                            ? 'Confirmed S-FB3K'
                            : item.deviceType === 'CANDIDATE_BIOMETRIC'
                            ? 'Biometric Port Open'
                            : 'Network Host'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span>
                          Open Port(s): <strong className="font-mono text-blue-700">{item.openPorts.join(', ')}</strong>
                        </span>
                        {item.macAddress && <span>MAC: <span className="font-mono">{item.macAddress}</span></span>}
                        <span>Latency: <strong>{item.latencyMs}ms</strong></span>
                      </div>

                      {item.notes && (
                        <p className="text-[11px] text-slate-500 mt-1">{item.notes}</p>
                      )}
                    </div>

                    <button
                      onClick={() => handleQuickAddDiscovered(item)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition whitespace-nowrap"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      1-Click Connect
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                Found {filteredDiscovered.length} candidate(s)
              </span>

              <button
                onClick={() => setShowScanModal(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingDevice ? 'Edit Device Configuration' : 'Add Secureye S-FB3K Device'}
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Enter the LAN network credentials configured on the biometric terminal.
            </p>

            <form onSubmit={handleSaveDevice} className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Device Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Office Reception"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">IP Address *</label>
                  <input
                    type="text"
                    required
                    placeholder="192.168.1.100"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Port *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={65535}
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Device Hardware ID / Serial</label>
                <input
                  type="text"
                  placeholder="e.g. 123456 (or auto-discover)"
                  value={formData.deviceId}
                  onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Protocol Dialect</label>
                  <select
                    value={formData.protocol}
                    onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Secureye/FKWeb">Secureye / FKWeb (M50)</option>
                    <option value="FKDataHS101">FKDataHS101 / HS102</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Polling Interval (ms)</label>
                  <input
                    type="number"
                    min={1000}
                    step={500}
                    value={formData.pollingInterval}
                    onChange={(e) => setFormData({ ...formData, pollingInterval: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition"
                >
                  Save Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diagnostic Connection Test Modal */}
      {testDevice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Device Connectivity Diagnostic
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Testing low-level TCP handshake and FKWeb protocol response for <span className="font-semibold text-slate-800">{testDevice.name}</span> ({testDevice.ipAddress}:{testDevice.port})
            </p>

            <div className="my-5 p-4 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs space-y-2">
              {testing ? (
                <div className="flex items-center gap-3 py-4 text-blue-600">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Probing TCP port and protocol handshake...</span>
                </div>
              ) : testResult ? (
                testResult.success ? (
                  <div className="space-y-2 text-slate-700">
                    <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Connection Successful!</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-slate-400">Latency:</span> <span className="font-bold">{testResult.latencyMs}ms</span></div>
                      <div><span className="text-slate-400">Firmware:</span> <span className="font-bold">{testResult.firmware || 'FKWeb M50'}</span></div>
                      <div><span className="text-slate-400">Hardware ID:</span> <span className="font-bold">{testResult.deviceId}</span></div>
                      <div><span className="text-slate-400">Clock:</span> <span className="font-bold">{testResult.deviceTime?.substring(0, 19) || 'Synced'}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-slate-700">
                    <div className="flex items-center gap-2 text-rose-600 font-semibold">
                      <XCircle className="w-4 h-4" />
                      <span>Connection Failed</span>
                    </div>
                    <p className="text-rose-700 text-xs">{testResult.message || testResult.errorMessage}</p>
                    <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
                      <p className="font-semibold text-slate-700">Possible Causes:</p>
                      <p>&bull; Biometric terminal is powered off or disconnected from switch.</p>
                      <p>&bull; IP address or subnet mismatch between server and device.</p>
                      <p>&bull; Terminal is operating in Push-to-Server mode (configure server IP in device menu).</p>
                    </div>
                  </div>
                )
              ) : null}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => handleRunTest(testDevice)}
                disabled={testing}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium"
              >
                Retest
              </button>
              <button
                onClick={() => setTestDevice(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Status Live Sheet */}
      {statusDevice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-600" />
              Live Device Status (GET_DEVICE_STATUS)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Raw telemetry and hardware counters for {statusDevice.name}
            </p>

            <div className="my-5 p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs max-h-72 overflow-y-auto">
              {loadingStatus ? (
                <div className="flex items-center gap-2 text-blue-400 py-4">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Querying S-FB3K terminal...</span>
                </div>
              ) : (
                <pre>{JSON.stringify(statusData, null, 2)}</pre>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStatusDevice(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium"
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
