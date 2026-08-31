import { describe, it, expect } from 'vitest';
import {
  formatCommandBody,
  createProtocolResponseHeaders,
  serializeCommand,
} from '../server/secureye/serializer';
import { UnsupportedCommandError } from '../server/secureye/errors';

describe('Secureye S-FB3K Protocol Serializer', () => {
  it('should format 4-byte LE length prefix with JSON and null terminator', () => {
    const bodyObj = { user_id: '1001' };
    const buf = formatCommandBody(bodyObj);

    expect(buf.length).toBeGreaterThan(4);
    const jsonLen = buf.readUInt32LE(0);
    const jsonStr = buf.subarray(4, 4 + jsonLen).toString('utf8');
    expect(JSON.parse(jsonStr)).toEqual(bodyObj);
  });

  it('should generate compliant ACK headers with Connection: close and response_code: OK', () => {
    const headers = createProtocolResponseHeaders({
      responseCode: 'OK',
      transId: 501,
      devId: 'SFB3K_01',
    });

    expect(headers['response_code']).toBe('OK');
    expect(headers['Connection']).toBe('close');
    expect(headers['trans_id']).toBe('501');
    expect(headers['dev_id']).toBe('SFB3K_01');
  });

  it('should serialize safe commands like GET_DEVICE_STATUS and GET_USER_ID_LIST', () => {
    const serialized = serializeCommand('GET_DEVICE_STATUS', 105, {});
    expect(serialized.cmdId).toBe('GET_DEVICE_STATUS');
    expect(serialized.headers['cmd_id']).toBe('GET_DEVICE_STATUS');
    expect(serialized.headers['trans_id']).toBe('105');
  });

  it('should block dangerous destructive wipe commands', () => {
    expect(() => serializeCommand('CLEAR_LOG_DATA', 106, {})).toThrow(UnsupportedCommandError);
    expect(() => serializeCommand('CLEAR_ENROLL_DATA', 107, {})).toThrow(UnsupportedCommandError);
    expect(() => serializeCommand('CLEAR_ALL_ADMIN', 108, {})).toThrow(UnsupportedCommandError);
  });
});
