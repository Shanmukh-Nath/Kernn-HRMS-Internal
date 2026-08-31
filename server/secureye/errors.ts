/**
 * Custom Error Classes for Secureye / FKWeb Protocol
 */

export class SecureyeProtocolError extends Error {
  public code: string;
  public details?: unknown;

  constructor(message: string, code = 'PROTOCOL_ERROR', details?: unknown) {
    super(message);
    this.name = 'SecureyeProtocolError';
    this.code = code;
    this.details = details;
  }
}

export class DeviceOfflineError extends SecureyeProtocolError {
  constructor(deviceId: string, ipAddress?: string) {
    super(`Device ${deviceId} (${ipAddress || 'LAN'}) is offline or unreachable.`, 'DEVICE_OFFLINE');
  }
}

export class DeviceTimeoutError extends SecureyeProtocolError {
  constructor(timeoutMs: number) {
    super(`Device communication timed out after ${timeoutMs}ms.`, 'DEVICE_TIMEOUT');
  }
}

export class MalformedPacketError extends SecureyeProtocolError {
  constructor(message: string, rawData?: unknown) {
    super(`Malformed packet received: ${message}`, 'MALFORMED_PACKET', rawData);
  }
}

export class UnsupportedCommandError extends SecureyeProtocolError {
  constructor(command: string) {
    super(`Command '${command}' is unsupported or blocked for safety on this device.`, 'UNSUPPORTED_COMMAND');
  }
}
