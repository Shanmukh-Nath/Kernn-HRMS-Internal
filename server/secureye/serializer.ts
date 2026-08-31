import { ProtocolCommandId } from './types';
import { UnsupportedCommandError } from './errors';

// Block dangerous commands that wipe flash memory
export const DANGEROUS_COMMANDS = new Set([
  'CLEAR_LOG_DATA',
  'CLEAR_ENROLL_DATA',
  'CLEAR_ALL_ADMIN',
  'CLEAR_ADMIN',
  'RESET_FACTORY',
]);

/**
 * Formats a command body into the FKWeb binary framing format:
 * [4-byte Little-Endian JSON length] + [UTF-8 JSON string] + [null byte 0x00]
 */
export function formatCommandBody(bodyValue?: Record<string, unknown> | null): Buffer {
  if (!bodyValue || Object.keys(bodyValue).length === 0) {
    return Buffer.alloc(0);
  }

  const jsonString = JSON.stringify(bodyValue);
  const jsonBuffer = Buffer.from(jsonString, 'utf8');
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32LE(jsonBuffer.length, 0);

  return Buffer.concat([prefix, jsonBuffer, Buffer.from([0])]);
}

/**
 * Constructs HTTP response headers compliant with the FKWeb protocol.
 */
export function createProtocolResponseHeaders(options: {
  responseCode?: 'OK' | 'ERROR';
  cmdId?: ProtocolCommandId;
  transId?: number;
  devId?: string;
  bodyLength?: number;
}): Record<string, string> {
  const headers: Record<string, string> = {
    'response_code': options.responseCode || 'OK',
    'Connection': 'close',
    'Content-Type': 'application/octet-stream',
  };

  if (options.cmdId) {
    headers['cmd_id'] = options.cmdId;
  }

  if (options.transId !== undefined) {
    headers['trans_id'] = String(options.transId);
  }

  if (options.devId) {
    headers['dev_id'] = options.devId;
  }

  if (options.bodyLength !== undefined) {
    headers['Content-Length'] = String(options.bodyLength);
  }

  return headers;
}

/**
 * Validates and serializes a command before dispatching or queuing.
 */
export function serializeCommand(
  cmdId: ProtocolCommandId,
  transId: number,
  parameters: Record<string, unknown> = {}
): {
  cmdId: ProtocolCommandId;
  transId: number;
  body: Buffer;
  headers: Record<string, string>;
} {
  if (DANGEROUS_COMMANDS.has(cmdId)) {
    throw new UnsupportedCommandError(cmdId);
  }

  const body = formatCommandBody(parameters);
  const headers = createProtocolResponseHeaders({
    responseCode: 'OK',
    cmdId,
    transId,
    bodyLength: body.length,
  });

  return {
    cmdId,
    transId,
    body,
    headers,
  };
}
