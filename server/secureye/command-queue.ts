import { ProtocolCommandId, QueuedCommand } from './types';
import { DeviceTimeoutError } from './errors';

interface PendingPromise {
  resolve: (value: Record<string, unknown>) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

class CommandQueueManager {
  private queues: Map<string, QueuedCommand[]> = new Map();
  private pendingPromises: Map<string, PendingPromise> = new Map();
  private transCounter = 1000;

  /**
   * Generates a monotonically increasing transaction ID.
   */
  public nextTransId(): number {
    this.transCounter = (this.transCounter + 1) % 999999;
    return this.transCounter;
  }

  /**
   * Enqueues a command for a device and returns a Promise that resolves when the device posts back send_cmd_result.
   */
  public enqueue(
    deviceId: string,
    cmdId: ProtocolCommandId,
    parameters: Record<string, unknown> = {},
    timeoutMs = 8000
  ): Promise<Record<string, unknown>> {
    const transId = this.nextTransId();
    const commandId = `${deviceId}_${transId}`;

    const command: QueuedCommand = {
      id: commandId,
      deviceId,
      cmdId,
      transId,
      parameters,
      createdAt: new Date(),
      status: 'PENDING',
    };

    if (!this.queues.has(deviceId)) {
      this.queues.set(deviceId, []);
    }
    this.queues.get(deviceId)!.push(command);

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingPromises.delete(commandId);
        command.status = 'FAILED';
        command.error = 'Command timed out';
        // Resolve empty fallback instead of crashing unhandled
        resolve({ timeout: true, status: 'TIMEOUT' });
      }, timeoutMs);

      this.pendingPromises.set(commandId, { resolve, reject, timer });
    });
  }

  /**
   * Pops the next pending command for a device during its receive_cmd poll.
   */
  public popNext(deviceId: string): QueuedCommand | null {
    const queue = this.queues.get(deviceId);
    if (!queue || queue.length === 0) return null;

    const cmd = queue.shift() || null;
    if (cmd) {
      cmd.status = 'SENT';
    }
    return cmd;
  }

  /**
   * Completes a command when the device sends send_cmd_result.
   */
  public resolveResult(
    deviceId: string,
    transId: number,
    resultPayload: Record<string, unknown>
  ): boolean {
    const commandId = `${deviceId}_${transId}`;
    const pending = this.pendingPromises.get(commandId);

    if (pending) {
      clearTimeout(pending.timer);
      this.pendingPromises.delete(commandId);
      pending.resolve(resultPayload);
      return true;
    }

    return false;
  }

  /**
   * Rejects a pending command with an error.
   */
  public rejectResult(deviceId: string, transId: number, error: Error): boolean {
    const commandId = `${deviceId}_${transId}`;
    const pending = this.pendingPromises.get(commandId);

    if (pending) {
      clearTimeout(pending.timer);
      this.pendingPromises.delete(commandId);
      pending.reject(error);
      return true;
    }

    return false;
  }

  /**
   * Returns current queue length for a device.
   */
  public getPendingCount(deviceId: string): number {
    return this.queues.get(deviceId)?.length || 0;
  }
}

// Global singleton instance across Next.js dev reloads
const globalForQueue = globalThis as unknown as { deviceCommandQueue?: CommandQueueManager };
export const deviceCommandQueue = globalForQueue.deviceCommandQueue || new CommandQueueManager();

if (process.env.NODE_ENV !== 'production') {
  globalForQueue.deviceCommandQueue = deviceCommandQueue;
}
