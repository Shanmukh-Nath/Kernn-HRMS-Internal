import http from 'http';
import { formatCommandBody } from '../server/secureye/serializer';
import { extractJsonFromBuffer } from '../server/secureye/parser';

interface SimulatorConfig {
  serverUrl: string;
  serverHost: string;
  serverPort: number;
  serverPath: string;
  deviceId: string;
  heartbeatIntervalMs: number;
  continuousMode: boolean;
}

const config: SimulatorConfig = {
  serverUrl: process.env.SIMULATOR_SERVER_URL || 'http://127.0.0.1:3000/api/device/secureye',
  serverHost: '127.0.0.1',
  serverPort: 3000,
  serverPath: '/api/device/secureye',
  deviceId: 'SFB3K_SIM_987654',
  heartbeatIntervalMs: 3000,
  continuousMode: process.argv.includes('--continuous'),
};

let transIdCounter = 100;

// Mock internal database of the simulated device
const mockUsers = [
  { user_id: '1001', name: 'John Smith', card_number: '9847281', privilege: 0 },
  { user_id: '1002', name: 'Priya Sharma', card_number: '9847282', privilege: 0 },
  { user_id: '1003', name: 'Rahul Kumar', card_number: '9847283', privilege: 0 },
  { user_id: '1004', name: 'Anil Kumar', card_number: '9847284', privilege: 14 },
  { user_id: '1005', name: 'Sneha Patel', card_number: '9847285', privilege: 0 },
  { user_id: '1006', name: 'Vikram Singh', card_number: '9847286', privilege: 0 },
];

const mockLogs: Array<{ user_id: string; io_time: string; verify_mode: number; io_mode: number }> = [];

console.log('====================================================');
console.log('🤖 Secureye S-FB3K Hardware Simulator (FKWeb Protocol)');
console.log(`📡 Target Server : http://${config.serverHost}:${config.serverPort}${config.serverPath}`);
console.log(`🏷️ Device Serial : ${config.deviceId}`);
console.log('====================================================\n');

/**
 * Sends a raw HTTP POST request representing an S-FB3K packet.
 */
function sendDevicePacket(
  requestCode: string,
  payload?: Record<string, unknown>,
  cmdId?: string,
  customTransId?: number
): Promise<{ headers: http.IncomingHttpHeaders; bodyBuffer: Buffer; parsedJson?: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const transId = customTransId || ++transIdCounter;
    const bodyBuf = payload ? formatCommandBody(payload) : Buffer.alloc(0);

    const headers: Record<string, string | number> = {
      'Content-Type': 'application/octet-stream',
      'request_code': requestCode,
      'dev_id': config.deviceId,
      'trans_id': transId,
      'Content-Length': bodyBuf.length,
      'User-Agent': 'Realand-FK/1.0',
    };

    if (cmdId) {
      headers['cmd_id'] = cmdId;
    }

    const req = http.request(
      {
        hostname: config.serverHost,
        port: config.serverPort,
        path: config.serverPath,
        method: 'POST',
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const full = Buffer.concat(chunks);
          let parsedJson: Record<string, unknown> | undefined;
          try {
            const extracted = extractJsonFromBuffer(full);
            if (extracted?.json) parsedJson = extracted.json;
          } catch {}

          resolve({
            headers: res.headers,
            bodyBuffer: full,
            parsedJson,
          });
        });
      }
    );

    req.on('error', (err) => {
      reject(err);
    });

    if (bodyBuf.length > 0) {
      req.write(bodyBuf);
    }
    req.end();
  });
}

/**
 * Sends a realtime_glog punch event.
 */
export async function simulatePunch(
  userId = '1001',
  verifyMode = 1, // 1: FP, 3: Card, 4: Face
  ioMode = 16777216 // Check-in bitmask
) {
  const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const payload = {
    user_id: userId,
    verify_mode: verifyMode,
    io_mode: ioMode,
    io_time: timestampStr,
    fk_bin_data_lib: 'M50',
    log_image: null,
  };

  mockLogs.push({ user_id: userId, io_time: timestampStr, verify_mode: verifyMode, io_mode: ioMode });

  try {
    const res = await sendDevicePacket('realtime_glog', payload);
    const ack = res.headers['response_code'] || 'OK';
    console.log(`[PUNCH SENT] User: ${userId} | Mode: ${verifyMode} | Time: ${timestampStr} -> Server ACK: ${ack}`);
  } catch (err: unknown) {
    console.error(`[PUNCH FAILED] Could not send punch: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Handles incoming server commands received during receive_cmd poll.
 */
async function processServerCommand(cmdId: string, transId: number, params?: Record<string, unknown>) {
  console.log(`[DEVICE CMD RECEIVED] Server issued command '${cmdId}' (Trans: ${transId})`);

  let responseData: Record<string, unknown> = {};

  switch (cmdId) {
    case 'GET_DEVICE_STATUS':
      responseData = {
        result: 1,
        cmd_id: 'GET_DEVICE_STATUS',
        trans_id: transId,
        data: {
          user_count: mockUsers.length,
          log_count: mockLogs.length + 150,
          fp_count: mockUsers.length * 2,
          face_count: mockUsers.length,
          firmware: 'M60 v3.16.1286s',
          device_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
          mac_address: '00:1A:6B:4F:92:10',
          serial_number: config.deviceId,
        },
      };
      break;

    case 'GET_USER_ID_LIST':
    case 'GET_USER_INFO':
      responseData = {
        result: 1,
        cmd_id: cmdId,
        trans_id: transId,
        users: mockUsers,
      };
      break;

    case 'GET_LOG_DATA':
      responseData = {
        result: 1,
        cmd_id: 'GET_LOG_DATA',
        trans_id: transId,
        logs: mockLogs.slice(-50),
      };
      break;

    case 'SET_TIME':
      responseData = {
        result: 1,
        cmd_id: 'SET_TIME',
        trans_id: transId,
        message: 'Time synchronized successfully',
      };
      break;

    default:
      console.log(`[CMD UNSUPPORTED] Command ${cmdId} is not handled by simulator.`);
      responseData = { result: 0, cmd_id: cmdId, trans_id: transId, error: 'UNSUPPORTED' };
      break;
  }

  // Send result back to server
  try {
    await sendDevicePacket('send_cmd_result', responseData, cmdId, transId);
    console.log(`[CMD RESULT SENT] Result for '${cmdId}' posted to server.`);
  } catch (err) {
    console.error(`[CMD RESULT ERROR]`, err);
  }
}

/**
 * Heartbeat polling loop (receive_cmd).
 */
async function startHeartbeatLoop() {
  setInterval(async () => {
    try {
      const res = await sendDevicePacket('receive_cmd');
      const cmdId = res.headers['cmd_id'] as string | undefined;
      const transIdRaw = res.headers['trans_id'] as string | undefined;
      const transId = transIdRaw ? parseInt(transIdRaw, 10) : ++transIdCounter;

      if (cmdId) {
        await processServerCommand(cmdId, transId, res.parsedJson);
      }
    } catch (err) {
      // Server not reachable yet
    }
  }, config.heartbeatIntervalMs);
}

// Continuous Punch Simulation
if (config.continuousMode) {
  console.log('🔄 Continuous punch mode enabled. Generating punches every 5-10 seconds...');
  setInterval(() => {
    const randomUser = mockUsers[Math.floor(Math.random() * mockUsers.length)];
    const verifyModes = [1, 3, 4]; // Fingerprint, Card, Face
    const ioModes = [16777216, 33554432]; // Check-in, Check-out
    const randomVerify = verifyModes[Math.floor(Math.random() * verifyModes.length)];
    const randomIo = ioModes[Math.floor(Math.random() * ioModes.length)];

    simulatePunch(randomUser.user_id, randomVerify, randomIo);
  }, 6000);
}

// Initial punches on boot
setTimeout(() => {
  simulatePunch('1001', 1, 16777216); // John Smith Check-in (FP)
  setTimeout(() => simulatePunch('1002', 4, 16777216), 2000); // Priya Sharma Check-in (Face)
  setTimeout(() => simulatePunch('1003', 3, 16777216), 4000); // Rahul Kumar Check-in (Card)
}, 1500);

startHeartbeatLoop();
console.log('✅ S-FB3K Simulator active. Heartbeat polling started every 3s.\n');
