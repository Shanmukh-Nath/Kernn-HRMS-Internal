/**
 * CROSS-PLATFORM DEVICE PULL & CLOUD SYNC ENGINE
 * Compatible with macOS (Apple Silicon & Intel), Windows, and Linux.
 */

const net = require('net');
const http = require('http');
const https = require('https');
const { URL } = require('url');

class DevicePuller {
  constructor(options = {}) {
    this.ip = options.ip || '192.168.1.201';
    this.port = parseInt(options.port || 5005, 10);
    this.machineId = parseInt(options.machineId || 1, 10);
    this.cloudUrl = options.cloudUrl || 'http://localhost:3000';
    this.authToken = options.authToken || '';
  }

  /**
   * Ping / Check if device socket is reachable
   */
  async pingDevice(timeoutMs = 2000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ reachable: true, latencyMs: latency });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ reachable: false, latencyMs: Date.now() - start, error: 'Connection timed out' });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({ reachable: false, latencyMs: Date.now() - start, error: err.message });
      });

      socket.connect(this.port, this.ip);
    });
  }

  /**
   * Actively PULL attendance logs from Secureye S-FB3K over TCP socket
   */
  async pullAttendanceLogs(timeoutMs = 8000) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const logs = [];
      let isConnected = false;

      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        isConnected = true;

        // 1. Send Handshake
        const handshakeBuf = Buffer.from([0x53, 0x46, 0x08, 0x00, this.machineId & 0xff, 0x00, 0x01, 0x00]);
        socket.write(handshakeBuf);

        // 2. Request Attendance Records
        setTimeout(() => {
          const pullBuf = Buffer.from([0x53, 0x46, 0x08, 0x00, this.machineId & 0xff, 0x00, 0x03, 0x00]);
          socket.write(pullBuf);
        }, 300);
      });

      socket.on('data', (chunk) => {
        // Parse binary packets
        if (chunk.length >= 8) {
          for (let i = 0; i <= chunk.length - 12; i += 12) {
            const uId = chunk.readUInt32LE ? chunk.readUInt32LE(i) : chunk[i];
            if (uId > 0 && uId < 1000000) {
              logs.push({
                userId: String(uId),
                verifyMode: chunk[i + 4] || 1,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ success: isConnected, logs, count: logs.length });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({ success: false, logs, count: logs.length, error: err.message });
      });

      socket.on('close', () => {
        resolve({ success: isConnected, logs, count: logs.length });
      });

      socket.connect(this.port, this.ip);
    });
  }

  /**
   * PUSH pulled logs to Cloud Server (Vercel / Azure / Localhost)
   */
  async pushToCloud(punches, deviceId = 'SFB3K_MAIN') {
    if (!punches || punches.length === 0) {
      return { success: true, message: 'No new punches to sync.' };
    }

    return new Promise((resolve, reject) => {
      const targetEndpoint = `${this.cloudUrl.replace(/\/$/, '')}/api/devices/sync/push`;
      const urlObj = new URL(targetEndpoint);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      const payload = JSON.stringify({
        deviceId,
        deviceIp: this.ip,
        punches,
      });

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
        },
        timeout: 10000,
      };

      const req = client.request(options, (res) => {
        let resData = '';
        res.on('data', (chunk) => { resData += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(resData);
            resolve(parsed);
          } catch {
            resolve({ success: res.statusCode === 200, raw: resData });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Cloud push request timed out' });
      });

      req.write(payload);
      req.end();
    });
  }
}

// Standalone execution test
if (require.main === module) {
  const ip = process.argv[2] || '192.168.1.201';
  const port = process.argv[3] || 5005;
  const cloud = process.argv[4] || 'http://localhost:3000';

  console.log(`[TEST RUN] Pulling from ${ip}:${port} and syncing to ${cloud}...`);
  const puller = new DevicePuller({ ip, port, cloudUrl: cloud });

  puller.pullAttendanceLogs().then(async (result) => {
    console.log('Pull Result:', result);
    if (result.logs && result.logs.length > 0) {
      console.log(`Pushing ${result.logs.length} logs to cloud...`);
      const pushRes = await puller.pushToCloud(result.logs);
      console.log('Cloud Push Response:', pushRes);
    }
  });
}

module.exports = { DevicePuller };
