import os from 'os';
import net from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SecureyeDeviceClient } from './client';

const execAsync = promisify(exec);

export interface DiscoveredDevice {
  ip: string;
  openPorts: number[];
  primaryPort: number;
  deviceType: 'CONFIRMED_BIOMETRIC' | 'CANDIDATE_BIOMETRIC' | 'ACTIVE_HOST' | 'GATEWAY_ROUTER';
  latencyMs: number;
  macAddress?: string;
  vendor?: string;
  model?: string;
  firmware?: string;
  deviceId?: string;
  notes?: string;
}

export interface NetworkInterfaceInfo {
  name: string;
  ip: string;
  netmask: string;
  subnetPrefix: string; // e.g. "192.168.29"
  cidr: number;
  rangeStart: string;
  rangeEnd: string;
}

const COMMON_BIOMETRIC_PORTS = [5005, 80, 7005, 8080, 4370, 8000, 9000];

/**
 * Returns all local host IPv4 addresses to exclude them from being reported as remote biometric devices.
 */
export function getLocalHostIps(): Set<string> {
  const ips = new Set<string>(['127.0.0.1', 'localhost']);
  const interfaces = os.networkInterfaces();
  for (const addrs of Object.values(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4') {
        ips.add(addr.address);
      }
    }
  }
  return ips;
}

/**
 * Lists all active IPv4 network interfaces on the host + standard factory subnets.
 */
export function getLocalNetworkInterfaces(): NetworkInterfaceInfo[] {
  const interfaces = os.networkInterfaces();
  const results: NetworkInterfaceInfo[] = [];
  const seenPrefixes = new Set<string>();

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')) {
        const parts = addr.address.split('.');
        const subnetPrefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
        const cidr = addr.cidr ? parseInt(addr.cidr.split('/')[1] || '24', 10) : 24;

        if (!seenPrefixes.has(subnetPrefix)) {
          seenPrefixes.add(subnetPrefix);
          results.push({
            name: `${name} (Current LAN)`,
            ip: addr.address,
            netmask: addr.netmask,
            subnetPrefix,
            cidr,
            rangeStart: `${subnetPrefix}.1`,
            rangeEnd: `${subnetPrefix}.254`,
          });
        }
      }
    }
  }

  // Add standard Secureye / Realand factory default subnets as quick options
  if (!seenPrefixes.has('192.168.1')) {
    results.push({
      name: 'Secureye Factory Default Subnet',
      ip: '192.168.1.1',
      netmask: '255.255.255.0',
      subnetPrefix: '192.168.1',
      cidr: 24,
      rangeStart: '192.168.1.1',
      rangeEnd: '192.168.1.254',
    });
  }

  if (!seenPrefixes.has('192.168.0')) {
    results.push({
      name: 'Common Router Default Subnet',
      ip: '192.168.0.1',
      netmask: '255.255.255.0',
      subnetPrefix: '192.168.0',
      cidr: 24,
      rangeStart: '192.168.0.1',
      rangeEnd: '192.168.0.254',
    });
  }

  return results;
}

/**
 * Reads ARP table entries from the operating system.
 */
export async function getArpTable(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const { stdout } = await execAsync('arp -a');
    const lines = stdout.split('\n');
    const arpRegex = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\s+([0-9a-fA-F\:\-]{11,17})/;

    for (const line of lines) {
      const match = line.match(arpRegex);
      if (match) {
        const ip = match[1];
        const mac = match[2].replace(/-/g, ':').toUpperCase();
        if (!ip.startsWith('224.') && !ip.startsWith('239.') && !ip.endsWith('.255')) {
          map.set(ip, mac);
        }
      }
    }
  } catch {}
  return map;
}

/**
 * Fast probe to test if a specific TCP port is open.
 */
function probePort(ip: string, port: number, timeoutMs = 250): Promise<{ open: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve({ open: true, latencyMs: latency });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ open: false, latencyMs: timeoutMs });
    });

    socket.on('error', () => {
      socket.destroy();
      resolve({ open: false, latencyMs: Date.now() - start });
    });

    socket.connect(port, ip);
  });
}

/**
 * Rapidly scans an IP across biometric ports in parallel.
 */
async function scanIpAddress(
  ip: string,
  localIps: Set<string>,
  ports: number[] = COMMON_BIOMETRIC_PORTS
): Promise<DiscoveredDevice | null> {
  // Exclude the local computer's own IP address
  if (localIps.has(ip)) {
    return null;
  }

  const probePromises = ports.map(async (port) => {
    const res = await probePort(ip, port, 300);
    return { port, ...res };
  });

  const results = await Promise.all(probePromises);
  const openResults = results.filter((r) => r.open);

  if (openResults.length === 0) {
    return null;
  }

  const openPorts = openResults.map((r) => r.port);
  const bestLatency = Math.min(...openResults.map((r) => r.latencyMs));

  // Identify router gateway (usually .1 or .254 with 80/8080 open)
  const isGateway = (ip.endsWith('.1') || ip.endsWith('.254')) && !openPorts.includes(5005) && !openPorts.includes(7005);

  const primaryPort = openPorts.includes(5005)
    ? 5005
    : openPorts.includes(80)
    ? 80
    : openPorts.includes(7005)
    ? 7005
    : openPorts.includes(8080)
    ? 8080
    : openPorts[0];

  let deviceType: DiscoveredDevice['deviceType'] = isGateway ? 'GATEWAY_ROUTER' : 'ACTIVE_HOST';
  let model: string | undefined;
  let firmware: string | undefined;
  let deviceId: string | undefined;
  let notes: string | undefined;

  if (isGateway) {
    notes = 'Network Router Gateway (Web Admin)';
  } else if (openPorts.includes(5005) || openPorts.includes(7005)) {
    deviceType = 'CONFIRMED_BIOMETRIC';
    model = 'Secureye S-FB3K / FKWeb';
    firmware = 'FKWeb Hardware Dialect';
    notes = `Biometric port ${primaryPort} active`;
  } else if (openPorts.includes(80) || openPorts.includes(8080) || openPorts.includes(4370)) {
    deviceType = 'CANDIDATE_BIOMETRIC';
    notes = `Open port(s): ${openPorts.join(', ')}`;
  }

  return {
    ip,
    openPorts,
    primaryPort,
    deviceType,
    latencyMs: bestLatency,
    model,
    firmware,
    deviceId,
    notes,
  };
}

/**
 * Scans an entire IPv4 subnet range with high concurrency.
 */
export async function scanSubnet(
  subnetPrefix: string,
  startHost = 1,
  endHost = 254,
  ports: number[] = COMMON_BIOMETRIC_PORTS,
  onDeviceFound?: (device: DiscoveredDevice) => void
): Promise<DiscoveredDevice[]> {
  const parts = subnetPrefix.split('.');
  const cleanPrefix = parts.length >= 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : subnetPrefix.trim();

  const localIps = getLocalHostIps();
  const arpMap = await getArpTable();
  const discovered: DiscoveredDevice[] = [];

  const targetIps: string[] = [];

  // Prioritize ARP cached entries first (known active hosts)
  for (const [arpIp] of arpMap) {
    if (arpIp.startsWith(`${cleanPrefix}.`)) {
      targetIps.push(arpIp);
    }
  }

  // Include ARP entries from secondary active subnets
  for (const [arpIp] of arpMap) {
    if (!targetIps.includes(arpIp) && !arpIp.startsWith('127.')) {
      targetIps.push(arpIp);
    }
  }

  // Add the remainder of the /24 subnet
  for (let i = startHost; i <= endHost; i++) {
    const candidateIp = `${cleanPrefix}.${i}`;
    if (!targetIps.includes(candidateIp)) {
      targetIps.push(candidateIp);
    }
  }

  // Concurrency pool with 50 parallel workers
  const CONCURRENCY = 50;
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < targetIps.length) {
      const idx = currentIndex++;
      const ip = targetIps[idx];

      try {
        const result = await scanIpAddress(ip, localIps, ports);
        if (result) {
          if (arpMap.has(ip)) {
            result.macAddress = arpMap.get(ip);
          }
          discovered.push(result);
          if (onDeviceFound) {
            onDeviceFound(result);
          }
        }
      } catch {}
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // Sort discovered devices: Confirmed first, then Candidates, then Active Hosts, then Gateways
  discovered.sort((a, b) => {
    const priority = { CONFIRMED_BIOMETRIC: 1, CANDIDATE_BIOMETRIC: 2, ACTIVE_HOST: 3, GATEWAY_ROUTER: 4 };
    if (priority[a.deviceType] !== priority[b.deviceType]) {
      return priority[a.deviceType] - priority[b.deviceType];
    }
    return a.latencyMs - b.latencyMs;
  });

  return discovered;
}
