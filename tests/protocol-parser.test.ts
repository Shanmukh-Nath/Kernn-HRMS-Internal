import { describe, it, expect } from 'vitest';
import {
  parseFKHttpHeaders,
  extractJsonFromBuffer,
  parseDeviceTimestamp,
  decodeVerificationType,
  decodeAttendanceEventType,
  normalizeRealtimeGlog,
} from '../server/secureye/parser';
import { AttendanceEventType, VerificationType } from '../server/secureye/types';
import { formatCommandBody } from '../server/secureye/serializer';

describe('Secureye S-FB3K Protocol Parser', () => {
  it('should parse headers with underscores and normalize casing', () => {
    const rawHeaders = {
      'request_code': 'realtime_glog',
      'dev_id': '123456',
      'trans_id': '1082',
      'content-type': 'application/octet-stream',
    };

    const parsed = parseFKHttpHeaders(rawHeaders);
    expect(parsed.requestCode).toBe('realtime_glog');
    expect(parsed.devId).toBe('123456');
    expect(parsed.transId).toBe(1082);
  });

  it('should extract JSON from length-prefixed binary buffer with binary tail', () => {
    const jsonPayload = { user_id: '1024', verify_mode: 1, io_mode: 16777216, io_time: '2026-08-28 09:32:14' };
    const buffer = formatCommandBody(jsonPayload);

    const extracted = extractJsonFromBuffer(buffer);
    expect(extracted).not.toBeNull();
    expect(extracted?.json.user_id).toBe('1024');
    expect(extracted?.json.io_mode).toBe(16777216);
  });

  it('should cleanly extract JSON using brace-depth matching even if binary tail contains closing brace', () => {
    const jsonStr = JSON.stringify({ user_id: '1001', name: 'John Smith' });
    const jsonBuf = Buffer.from(jsonStr, 'utf8');
    // Attach binary data containing byte 0x7D ('}') to simulate biometric template
    const binaryTail = Buffer.from([0x00, 0x7D, 0x12, 0x34, 0x7D, 0x56]);
    const fullBuffer = Buffer.concat([jsonBuf, binaryTail]);

    const extracted = extractJsonFromBuffer(fullBuffer);
    expect(extracted).not.toBeNull();
    expect(extracted?.json.user_id).toBe('1001');
    expect(extracted?.json.name).toBe('John Smith');
  });

  it('should decode bitmask io_mode correctly into semantic attendance event types', () => {
    expect(decodeAttendanceEventType(16777216)).toBe(AttendanceEventType.CHECK_IN);
    expect(decodeAttendanceEventType(33554432)).toBe(AttendanceEventType.CHECK_OUT);
    expect(decodeAttendanceEventType(50331648)).toBe(AttendanceEventType.BREAK_IN);
    expect(decodeAttendanceEventType(67108864)).toBe(AttendanceEventType.BREAK_OUT);
    expect(decodeAttendanceEventType(83886080)).toBe(AttendanceEventType.OVERTIME_IN);
    expect(decodeAttendanceEventType(100663296)).toBe(AttendanceEventType.OVERTIME_OUT);
    expect(decodeAttendanceEventType(0)).toBe(AttendanceEventType.CHECK_IN);
    expect(decodeAttendanceEventType(1)).toBe(AttendanceEventType.CHECK_OUT);
  });

  it('should decode verification types correctly', () => {
    expect(decodeVerificationType(1)).toBe(VerificationType.FINGERPRINT);
    expect(decodeVerificationType(2)).toBe(VerificationType.PASSWORD);
    expect(decodeVerificationType(3)).toBe(VerificationType.CARD);
    expect(decodeVerificationType(4)).toBe(VerificationType.FACE);
    expect(decodeVerificationType(5)).toBe(VerificationType.PALM);
  });

  it('should parse various timestamp formats', () => {
    const d1 = parseDeviceTimestamp('2026-08-28 09:32:14');
    expect(d1.getFullYear()).toBe(2026);
    expect(d1.getMonth()).toBe(7); // August is 7 in JS Date

    const d2 = parseDeviceTimestamp('20260828093214');
    expect(d2.getFullYear()).toBe(2026);
    expect(d2.getDate()).toBe(28);
    expect(d2.getHours()).toBe(9);
  });

  it('should normalize realtime_glog into a structured AttendanceEvent', () => {
    const payload = {
      user_id: '1024',
      verify_mode: 1,
      io_mode: 16777216,
      io_time: '2026-08-28 09:32:14',
    };

    const event = normalizeRealtimeGlog(payload, 'dev_123', 42);
    expect(event.deviceId).toBe('dev_123');
    expect(event.deviceUserId).toBe('1024');
    expect(event.eventType).toBe(AttendanceEventType.CHECK_IN);
    expect(event.verificationType).toBe(VerificationType.FINGERPRINT);
    expect(event.source).toBe('REALTIME');
    expect(event.transactionId).toBe(42);
  });
});
