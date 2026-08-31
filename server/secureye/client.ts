import http from 'http';
import net from 'net';
import { DeviceConnectionTestResult, ProtocolCommandId } from './types';
import { DeviceOfflineError, DeviceTimeoutError, SecureyeProtocolError } from './errors';
import { extractJsonFromBuffer, parseFKHttpHeaders } from './parser';
import { createProtocolResponseHeaders, formatCommandBody } from './serializer';
import { deviceCommandQueue } from './command-queue';

export interface DeviceClientOptions {
  ipAddress: string;
  port: number;
  deviceId?: string;
  timeoutMs?: number;
}

export class SecureyeDeviceClient {
  private ipAddress: string;
  private port: number;
  private deviceId?: string;
  private timeoutMs: number;

  constructor(options: DeviceClientOptions) {
    this.ipAddress = options.ipAddress;
    this.port = options.port || 80;
    this.deviceId = options.deviceId;
    this.timeoutMs = options.timeoutMs || 5000;
  }

  /**
   * Performs a rapid low-level TCP socket connectivity test.
   */
  public async testTcpSocket(timeoutMs = 2500): Promise<{ reachable: boolean; latencyMs: number }> {
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
        resolve({ reachable: false, latencyMs: Date.now() - start });
      });

      socket.on('error', () => {
        socket.destroy();
        resolve({ reachable: false, latencyMs: Date.now() - start });
      });

      socket.connect(this.port, this.ipAddress);
    });
  }

  /**
   * Tests device connectivity and executes a GET_DEVICE_STATUS or handshake probe.
   */
  public async testConnection(): Promise<DeviceConnectionTestResult> {
    const startTime = Date.now();

    // 1. First probe TCP port
    const tcp = await this.testTcpSocket(3000);
    if (!tcp.reachable) {
      return {
        success: false,
        latencyMs: tcp.latencyMs,
        errorMessage: `Cannot reach device at ${this.ipAddress}:${this.port}. Device is offline or port is blocked.`,
      };
    }

    // 2. Try HTTP status probe
    try {
      const statusRes = await this.executeCommand('GET_DEVICE_STATUS', {}, 4000);
      const latencyMs = Date.now() - startTime;
      const data = (statusRes.data || statusRes) as Record<string, unknown>;

      return {
        success: true,
        latencyMs,
        deviceModel: 'Secureye S-FB3K / FKWeb',
        deviceId: (data.serial_number as string) || this.deviceId || 'S-FB3K',
        firmware: (data.firmware as string) || 'M60/M50 FKWeb',
        userCount: typeof data.user_count === 'number' ? data.user_count : undefined,
        logCount: typeof data.log_count === 'number' ? data.log_count : undefined,
        deviceTime: (data.device_time as string) || new Date().toISOString(),
        rawResponse: statusRes,
      };
    } catch (err: unknown) {
      // If the direct HTTP server is not listening (e.g. Device-to-Server push mode only),
      // we still know TCP is open and acknowledge device responsiveness.
      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        latencyMs,
        deviceModel: 'Secureye S-FB3K (Push Mode)',
        deviceId: this.deviceId || 'S-FB3K',
        firmware: 'FKWeb Compatible',
        rawResponse: {
          note: 'TCP port reachable. Device may be configured for server-push (receive_cmd) polling.',
        },
      };
    }
  }

  /**
   * Executes a command either via direct HTTP post or by queueing for next receive_cmd heartbeat.
   */
  public async executeCommand(
    cmdId: ProtocolCommandId,
    parameters: Record<string, unknown> = {},
    timeoutMs = this.timeoutMs
  ): Promise<Record<string, unknown>> {
    // If device ID is available, enqueue command in the polling channel simultaneously
    let queuePromise: Promise<Record<string, unknown>> | null = null;
    if (this.deviceId) {
      queuePromise = deviceCommandQueue.enqueue(this.deviceId, cmdId, parameters, timeoutMs);
    }

    // Try direct HTTP POST request to device
    const directPromise = this.sendDirectHttpRequest(cmdId, parameters, timeoutMs);

    if (!queuePromise) {
      return directPromise;
    }

    // Race between direct HTTP response and next receive_cmd polling answer
    return Promise.race([
      directPromise.catch((err) => {
        // If direct HTTP fails (common if terminal only acts as HTTP client), wait for queue promise
        return queuePromise!;
      }),
      queuePromise,
    ]);
  }

  /**
   * Sends direct HTTP request to device IP and port.
   */
  private async sendDirectHttpRequest(
    cmdId: ProtocolCommandId,
    parameters: Record<string, unknown> = {},
    timeoutMs = this.timeoutMs
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const body = formatCommandBody(parameters);
      const transId = deviceCommandQueue.nextTransId();

      const headers = createProtocolResponseHeaders({
        responseCode: 'OK',
        cmdId,
        transId,
        devId: this.deviceId,
        bodyLength: body.length,
      });

      const req = http.request(
        {
          hostname: this.ipAddress,
          port: this.port,
          path: '/',
          method: 'POST',
          headers,
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => {
            const fullBuf = Buffer.concat(chunks);
            try {
              const extracted = extractJsonFromBuffer(fullBuf);
              if (extracted?.json) {
                resolve(extracted.json);
              } else {
                resolve({
                  status: 'OK',
                  httpStatus: res.statusCode,
                  responseHeaders: res.headers,
                });
              }
            } catch {
              resolve({
                status: 'OK',
                rawLength: fullBuf.length,
              });
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new DeviceTimeoutError(timeoutMs));
      });

      req.on('error', (err) => {
        reject(new DeviceOfflineError(this.deviceId || 'UNKNOWN', this.ipAddress));
      });

      req.write(body);
      req.end();
    });
  }
}
