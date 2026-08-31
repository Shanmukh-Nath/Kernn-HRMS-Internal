import {
  AttendanceEventType,
  FKWebRawHeaders,
  NormalizedAttendanceEvent,
  RealtimeGlogPayload,
  VerificationType,
} from './types';
import { MalformedPacketError } from './errors';

/**
 * Extracts and normalizes FKWeb protocol headers from raw HTTP incoming headers.
 * Supports variations in casing and proxy header naming.
 */
export function parseFKHttpHeaders(headers: Record<string, string | string[] | undefined>): FKWebRawHeaders {
  const getHeader = (key: string): string | undefined => {
    const val = headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()];
    if (Array.isArray(val)) return val[0];
    return val;
  };

  const requestCode = getHeader('request_code') || getHeader('request-code') || getHeader('cmd_id') || getHeader('command');
  const devId = getHeader('dev_id') || getHeader('dev-id') || getHeader('device_id') || getHeader('device-id') || getHeader('sn');
  const transIdRaw = getHeader('trans_id') || getHeader('trans-id') || getHeader('transaction_id');
  const cmdId = getHeader('cmd_id') || getHeader('cmd-id');
  const responseCode = getHeader('response_code') || getHeader('response-code');
  const contentType = getHeader('content-type');

  let transId: number | undefined = undefined;
  if (transIdRaw) {
    const parsed = parseInt(transIdRaw, 10);
    if (!isNaN(parsed)) transId = parsed;
  }

  return {
    requestCode,
    devId,
    transId,
    cmdId,
    responseCode,
    contentType,
    rawHeaders: headers,
  };
}

/**
 * Robust JSON extractor using brace-depth scanning.
 * This avoids failures when binary template data contains ASCII 0x7D ('}').
 */
export function extractJsonFromBuffer(buffer: Buffer): { json: Record<string, unknown>; binaryTail?: Buffer } | null {
  if (!buffer || buffer.length === 0) return null;

  // Check if buffer has 4-byte LE length prefix
  let startIndex = 0;
  if (buffer.length >= 4) {
    const potentialLen = buffer.readUInt32LE(0);
    // If the 4-byte prefix is a reasonable JSON length (4 to 10MB)
    if (potentialLen > 0 && potentialLen < buffer.length) {
      const slice = buffer.subarray(4, 4 + potentialLen);
      try {
        const text = slice.toString('utf8').trim();
        if (text.startsWith('{') && text.endsWith('}')) {
          const parsed = JSON.parse(text);
          const binaryTail = buffer.length > 4 + potentialLen ? buffer.subarray(4 + potentialLen) : undefined;
          return { json: parsed, binaryTail };
        }
      } catch {
        // Fallback to brace-depth scan
      }
    }
  }

  const str = buffer.toString('utf8');
  const start = str.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  let endIndex = -1;

  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex === -1) {
    throw new MalformedPacketError('Unbalanced JSON structure in payload buffer.');
  }

  const jsonStr = str.substring(start, endIndex + 1);
  try {
    const parsed = JSON.parse(jsonStr);
    const byteLengthConsumed = Buffer.byteLength(str.substring(0, endIndex + 1), 'utf8');
    const binaryTail = buffer.length > byteLengthConsumed ? buffer.subarray(byteLengthConsumed) : undefined;
    return { json: parsed, binaryTail };
  } catch (err: unknown) {
    throw new MalformedPacketError(`Failed to parse extracted JSON: ${err instanceof Error ? err.message : String(err)}`, jsonStr);
  }
}

/**
 * Parses timestamps in various formats produced by biometric devices:
 * - "2026-08-28 09:32:14"
 * - "2026/08/28 09:32:14"
 * - "20260828093214"
 * - ISO-8601 strings
 */
export function parseDeviceTimestamp(timeStr: string | number): Date {
  if (!timeStr) return new Date();

  if (typeof timeStr === 'number') {
    // Unix epoch in seconds vs ms
    return timeStr < 10000000000 ? new Date(timeStr * 1000) : new Date(timeStr);
  }

  const clean = timeStr.trim();

  // Compact format: YYYYMMDDHHmmss
  if (/^\d{14}$/.test(clean)) {
    const y = parseInt(clean.substring(0, 4), 10);
    const m = parseInt(clean.substring(4, 6), 10) - 1;
    const d = parseInt(clean.substring(6, 8), 10);
    const h = parseInt(clean.substring(8, 10), 10);
    const min = parseInt(clean.substring(10, 12), 10);
    const s = parseInt(clean.substring(12, 14), 10);
    return new Date(y, m, d, h, min, s);
  }

  // Standard date parsing
  const parsed = new Date(clean.replace(/\//g, '-'));
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date();
}

/**
 * Decodes the verification method from raw integer code.
 */
export function decodeVerificationType(mode: number | string | undefined): VerificationType {
  const num = typeof mode === 'string' ? parseInt(mode, 10) : mode;
  switch (num) {
    case 1:
      return VerificationType.FINGERPRINT;
    case 2:
      return VerificationType.PASSWORD;
    case 3:
      return VerificationType.CARD;
    case 4:
      return VerificationType.FACE;
    case 5:
      return VerificationType.PALM;
    default:
      return VerificationType.DEFAULT;
  }
}

/**
 * Decodes the io_mode punch type bitmask / value.
 */
export function decodeAttendanceEventType(ioMode: number | string | undefined): AttendanceEventType {
  const mode = typeof ioMode === 'string' ? parseInt(ioMode, 10) : ioMode;

  if (mode === undefined || isNaN(mode)) {
    return AttendanceEventType.GENERAL_PUNCH;
  }

  // Check bitmask values or integer codes
  if (mode === 16777216 || mode === 0) {
    return AttendanceEventType.CHECK_IN;
  } else if (mode === 33554432 || mode === 1) {
    return AttendanceEventType.CHECK_OUT;
  } else if (mode === 50331648 || mode === 2) {
    return AttendanceEventType.BREAK_IN;
  } else if (mode === 67108864 || mode === 3) {
    return AttendanceEventType.BREAK_OUT;
  } else if (mode === 83886080 || mode === 4) {
    return AttendanceEventType.OVERTIME_IN;
  } else if (mode === 100663296 || mode === 5) {
    return AttendanceEventType.OVERTIME_OUT;
  }

  return AttendanceEventType.GENERAL_PUNCH;
}

/**
 * Normalizes a raw realtime_glog payload into an internal AttendanceEvent object.
 */
export function normalizeRealtimeGlog(
  payload: RealtimeGlogPayload,
  deviceId: string,
  transId?: number
): NormalizedAttendanceEvent {
  const userIdStr = String(payload.user_id || payload.userId || payload.pin || 'UNKNOWN');
  const rawTime = (payload.io_time || payload.time || payload.timestamp || '') as string | number;
  const timestamp = parseDeviceTimestamp(rawTime);
  const verificationType = decodeVerificationType(payload.verify_mode);
  const eventType = decodeAttendanceEventType(payload.io_mode);

  return {
    deviceId,
    deviceUserId: userIdStr,
    timestamp,
    eventType,
    verificationType,
    source: 'REALTIME',
    transactionId: transId,
    rawPayload: payload as Record<string, unknown>,
  };
}
