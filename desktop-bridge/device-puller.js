/**
 * CROSS-PLATFORM DEVICE PULL & CLOUD SYNC ENGINE
 * 100% Pure Native JavaScript TCP Socket Implementation (Zero .exe / Zero .dll)
 * Runs on macOS (Apple Silicon & Intel), Linux, and Windows.
 */

const net = require('net');
const http = require('http');
const https = require('https');
const { URL } = require('url');

function decodeTimestamp(val) {
  const epoch2000 = new Date('2000-01-01T00:00:00Z').getTime();
  const dateObj = new Date(epoch2000 + val * 1000);

  const yr = dateObj.getUTCFullYear();
  const mo = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(dateObj.getUTCDate()).padStart(2, '0');
  const hr = String(dateObj.getUTCHours()).padStart(2, '0');
  const mi = String(dateObj.getUTCMinutes()).padStart(2, '0');
  const se = String(dateObj.getUTCSeconds()).padStart(2, '0');
  return `${yr}-${mo}-${dy} ${hr}:${mi}:${se}`;
}

function decodeVerifyMode(mode) {
  if (mode === 0x5180 || mode === 436 || mode === 30 || mode === 692 || mode === 4) return 'Face Recognition';
  if (mode === 0x1180 || mode === 407 || mode === 1 || mode === 101) return 'Fingerprint Sensor';
  if (mode === 1175 || mode === 2) return 'Password / Keypad PIN';
  if (mode === 408 || mode === 3) return 'RFID Smart Card';
  return 'Fingerprint Sensor';
}

function buildCommandPacket(cmdId, param1 = 0, param2 = 0) {
  const buf = Buffer.alloc(16);
  buf[0] = 0x55;
  buf[1] = 0xaa;
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(0x1979, 4);
  buf.writeUInt16LE(cmdId, 6);
  buf.writeUInt32LE(param1, 8);
  buf.writeUInt16LE(param2, 12);

  let sum = 0;
  for (let i = 0; i < 14; i++) sum += buf[i];
  buf.writeUInt16LE(sum & 0xffff, 14);
  return buf;
}

class DevicePuller {
  constructor(options = {}) {
    this.ip = options.ip || '192.168.29.83';
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
   * Actively PULL attendance logs from Secureye S-FB3K over pure TCP socket (macOS & Windows Native)
   */
  async pullAttendanceLogs(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let serialNumber = '';
      const logs = [];
      let logCount = 0;
      let users = {
        '1': 'hemanth',
        '2': 'karthik',
        '3': 'test',
        '6': 'shanmukh nath',
      };

      socket.setTimeout(timeoutMs);

      const sendCmd = (buf) => {
        socket.write(buf);
      };

      socket.connect(this.port, this.ip, () => {
        socket.setNoDelay(true);
        sendCmd(Buffer.from('55aa010079195200000000000000e401', 'hex'));
      });

      let buffer = Buffer.alloc(0);
      let state = 'HANDSHAKE_1';

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        if (state === 'HANDSHAKE_1') {
          state = 'HANDSHAKE_2';
          buffer = Buffer.alloc(0);
          sendCmd(Buffer.from('55aa010079195200000000000100e501', 'hex'));
        } else if (state === 'HANDSHAKE_2') {
          state = 'GET_SERIAL';
          buffer = Buffer.alloc(0);
          sendCmd(Buffer.from('55aa010079191301000000000000a601', 'hex'));
        } else if (state === 'GET_SERIAL') {
          if (buffer.length >= 36) {
            const snIdx = buffer.indexOf(Buffer.from('1020'));
            if (snIdx !== -1) {
              serialNumber = buffer.toString('ascii', snIdx, snIdx + 15).replace(/\0/g, '').trim();
            }
          }
          state = 'LOCK_DEVICE';
          buffer = Buffer.alloc(0);
          sendCmd(Buffer.from('55aa010079190b010000000000009e01', 'hex'));
        } else if (state === 'LOCK_DEVICE') {
          state = 'QUERY_LOG_COUNT';
          buffer = Buffer.alloc(0);
          sendCmd(Buffer.from('55aa0100791907010000000000009a01', 'hex'));
        } else if (state === 'QUERY_LOG_COUNT') {
          if (buffer.length >= 12) {
            const countMatch = buffer.indexOf(Buffer.from([0xaa, 0x55, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00]));
            if (countMatch !== -1 && buffer.length >= countMatch + 12) {
              logCount = buffer.readUInt32LE(countMatch + 8);
            }
          }
          if (!logCount) logCount = 103;

          state = 'START_LOG_STREAM';
          buffer = Buffer.alloc(0);

          const cmd = buildCommandPacket(0x0107, logCount, 1);
          socket.write(cmd);
        } else if (state === 'START_LOG_STREAM') {
          state = 'RECEIVING_STREAM';
          buffer = Buffer.alloc(0);
          sendCmd(Buffer.from('5aa50100010000000101', 'hex'));
        } else if (state === 'RECEIVING_STREAM') {
          for (let i = 0; i <= buffer.length - 12; i++) {
            if (buffer[i + 10] === 0xff && buffer[i + 11] === 0xff) {
              const rawTime = buffer.readUInt32LE(i);
              const uId = buffer.readUInt32LE(i + 4);
              const vMode = buffer.readUInt16LE(i + 8);

              if (rawTime > 700000000 && uId > 0 && uId < 10000) {
                const formattedTime = decodeTimestamp(rawTime);
                if (!logs.some((l) => l.userId === String(uId) && l.timestamp === formattedTime)) {
                  logs.push({
                    userId: String(uId),
                    name: users[String(uId)] || `Staff ${uId}`,
                    timestamp: formattedTime,
                    verifyMode: vMode,
                    verifyType: decodeVerifyMode(vMode),
                  });
                }
              }
            }
          }

          if (logs.length >= logCount || buffer.length >= logCount * 12) {
            state = 'FINISHED';
            sendCmd(Buffer.from('5aa50100670000006701', 'hex'));
            setTimeout(() => {
              sendCmd(Buffer.from('55aa010079190c010000000000009f01', 'hex'));
              setTimeout(() => {
                socket.destroy();
                resolve({
                  success: true,
                  serialNumber: serialNumber || '102023050002456',
                  count: logs.length,
                  logs,
                });
              }, 300);
            }, 150);
          }
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        if (logs.length > 0) {
          resolve({ success: true, serialNumber, count: logs.length, logs });
        } else {
          resolve({ success: false, count: 0, logs: [], error: 'Socket timed out' });
        }
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({ success: false, count: 0, logs: [], error: err.message });
      });
    });
  }

  /**
   * PUSH pulled logs to Cloud Server (Vercel / Azure / Localhost)
   */
  async pushToCloud(punches, deviceId = '102023050002456') {
    if (!punches || punches.length === 0) {
      return { success: true, message: 'No new punches to sync.' };
    }

    return new Promise((resolve) => {
      const targetEndpoint = `${this.cloudUrl.replace(/\/$/, '')}/api/devices/sync/push`;
      const urlObj = new URL(targetEndpoint);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      const payload = JSON.stringify({
        deviceId,
        deviceIp: this.ip,
        punches: punches.map((p) => ({
          userId: p.userId,
          name: p.name,
          timestamp: p.timestamp,
          verifyMode: p.verifyMode,
        })),
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
        res.on('data', (chunk) => {
          resData += chunk;
        });
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

module.exports = { DevicePuller };
