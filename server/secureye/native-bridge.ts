import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { prisma } from '@/lib/prisma';
import { protocolCapture } from './protocol-capture';
import { attendanceEventBus } from '@/lib/events';

const execFileAsync = promisify(execFile);

export interface NativeUserInfo {
  userId: string;
  name: string;
  privilege: number;
  backupNumbers: number[];
  enabled: boolean;
}

export interface NativeLogRecord {
  userId: string;
  verifyMode: number;
  timestamp: string;
}

export interface NativeDeviceData {
  serialNumber: string;
  users: NativeUserInfo[];
  logs: NativeLogRecord[];
}

/**
 * Decodes the raw verifyMode integer from S-FB3K / Realand firmware into human-readable types.
 */
export function decodeVerifyMode(verifyMode: number): { eventType: string; verificationType: string } {
  // S-FB3K / Realand / SBXPC exact verifyMode decoding:
  // 436, 30, 692, 4, 15, 20, 50, 51, 808 -> FACE RECOGNITION
  // 1, 407, 101, 102 -> FINGERPRINT SENSOR
  // 1175, 2 -> PASSWORD / PIN KEYPAD
  // 408, 3 -> RFID CARD
  let verificationType = 'FINGERPRINT';
  if (
    verifyMode === 436 ||
    verifyMode === 30 ||
    verifyMode === 692 ||
    verifyMode === 4 ||
    verifyMode === 15 ||
    verifyMode === 20 ||
    verifyMode === 50 ||
    verifyMode === 51 ||
    verifyMode === 808
  ) {
    verificationType = 'FACE';
  } else if (verifyMode === 1175 || verifyMode === 2) {
    verificationType = 'PASSWORD';
  } else if (verifyMode === 408 || verifyMode === 3) {
    verificationType = 'CARD';
  } else {
    verificationType = 'FINGERPRINT';
  }

  const eventType = 'CHECK_IN';
  return { eventType, verificationType };
}

/**
 * Executes the compiled native sfb3k_driver.exe directly over LAN.
 */
export async function syncDeviceViaNativeDriver(
  ip: string,
  port = 5005,
  machineId = 1,
  password = 0
): Promise<NativeDeviceData> {
  const startTime = Date.now();
  const driverExePath = path.join(process.cwd(), 'scripts', 'sfb3k_driver.exe');

  // Log Outbound Request to Protocol Sniffer
  const reqPacket = {
    id: `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    direction: 'OUTBOUND',
    target: `${ip}:${port}`,
    action: 'NATIVE_SOCKET_QUERY',
    details: `_ConnectTcpip(Machine:${machineId}, ${ip}:${port}) -> _ReadAllUserID() -> _ReadAllGLogData()`,
    timestamp: new Date().toISOString(),
  };

  protocolCapture?.capture?.(reqPacket as any);

  const { stdout, stderr } = await execFileAsync(
    driverExePath,
    [ip, String(port), String(machineId)],
    { timeout: 20000, maxBuffer: 25 * 1024 * 1024 }
  );

  const durationMs = Date.now() - startTime;

  if (stderr && !stdout) {
    throw new Error(`Native driver execution failed: ${stderr}`);
  }

  // Parse JSON output from the driver
  const jsonStart = stdout.indexOf('___JSON_DATA_START___');
  const jsonEnd = stdout.indexOf('___JSON_DATA_END___');

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`Could not parse JSON output from native driver:\n${stdout}`);
  }

  const rawJson = stdout.substring(jsonStart + '___JSON_DATA_START___'.length, jsonEnd).trim();
  const parsed = JSON.parse(rawJson) as NativeDeviceData;

  // Log Device Inbound Response to Protocol Sniffer & Live SSE Bus
  const respPacket = {
    ip,
    direction: 'INBOUND',
    requestCode: 'native_sync_response',
    deviceId: parsed.serialNumber || String(machineId),
    headers: {
      status: 'SUCCESS',
      driver: 'SBXPCDLL64.dll',
      users_found: String(parsed.users.length),
      logs_found: String(parsed.logs.length),
    },
    payload: {
      serialNumber: parsed.serialNumber,
      usersCount: parsed.users.length,
      logsCount: parsed.logs.length,
      sampleUsers: parsed.users.map((u) => ({ id: u.userId, name: u.name })),
      latestLog: parsed.logs[parsed.logs.length - 1] || null,
    },
    statusCode: 200,
    responseHeaders: { response_code: 'OK' },
    durationMs,
    rawText: `[DEVICE -> SERVER] Retrieved Serial: ${parsed.serialNumber} | ${parsed.users.length} Users (${parsed.users.map(u => u.name).join(', ')}) | ${parsed.logs.length} Punch Logs`,
  };

  protocolCapture?.capture?.(respPacket as any);
  attendanceEventBus?.emitWirePacket?.(respPacket);

  return parsed;
}
