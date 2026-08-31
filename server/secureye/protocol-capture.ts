/**
 * Diagnostic Protocol Capture Logger for Developer & Troubleshooting Mode
 */

export interface CapturedPacket {
  id: string;
  timestamp: string;
  direction: 'INCOMING' | 'OUTGOING';
  sourceIp: string;
  requestCode?: string;
  cmdId?: string;
  devId?: string;
  transId?: number;
  headers: Record<string, string>;
  bodySize: number;
  bodyPreview?: string;
  rawPayload?: unknown;
  status: 'SUCCESS' | 'ERROR' | 'UNSUPPORTED';
  durationMs?: number;
  error?: string;
}

class ProtocolCaptureManager {
  private enabled = true;
  private maxBufferSize = 500;
  private buffer: CapturedPacket[] = [];

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public capture(packet: any): CapturedPacket {
    const item: CapturedPacket = {
      ...packet,
      id: packet.id || `pkt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: packet.timestamp || new Date().toISOString(),
      direction: packet.direction || 'INCOMING',
      sourceIp: packet.sourceIp || packet.ip || '127.0.0.1',
      headers: packet.headers || {},
      bodySize: packet.bodySize || 0,
      status: packet.status || 'SUCCESS',
    };

    if (this.enabled) {
      this.buffer.unshift(item);
      if (this.buffer.length > this.maxBufferSize) {
        this.buffer.pop();
      }
    }

    return item;
  }

  public addPacket(packet: any): CapturedPacket {
    return this.capture(packet);
  }

  public getRecent(limit = 50): CapturedPacket[] {
    return this.buffer.slice(0, limit);
  }

  public clear(): void {
    this.buffer = [];
  }

  public exportSanitized(): string {
    const sanitized = this.buffer.map((p) => {
      const copy = { ...p };
      if (copy.rawPayload && typeof copy.rawPayload === 'object') {
        const payload = { ...(copy.rawPayload as Record<string, unknown>) };
        if (payload.fp_data) payload.fp_data = '[MASKED_BIOMETRIC_TEMPLATE]';
        if (payload.face_data) payload.face_data = '[MASKED_FACE_TEMPLATE]';
        if (payload.password) payload.password = '[MASKED_CREDENTIAL]';
        copy.rawPayload = payload;
      }
      return copy;
    });

    return JSON.stringify(sanitized, null, 2);
  }
}

// Global singleton to persist buffer across Next.js dev reloads
const globalForProtocol = globalThis as unknown as { protocolCapture?: ProtocolCaptureManager };
export const protocolCapture = globalForProtocol.protocolCapture || new ProtocolCaptureManager();

if (process.env.NODE_ENV !== 'production') {
  globalForProtocol.protocolCapture = protocolCapture;
}
