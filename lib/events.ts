import { EventEmitter } from 'events';
import { NormalizedAttendanceEvent } from '../server/secureye/types';

class AttendanceEventBus extends EventEmitter {
  public emitPunch(event: NormalizedAttendanceEvent) {
    this.emit('punch', event);
  }

  public onPunch(listener: (event: NormalizedAttendanceEvent) => void) {
    this.on('punch', listener);
    return () => this.off('punch', listener);
  }

  public emitSyncProgress(data: { deviceId: string; progress: number; message: string; stage: string }) {
    this.emit('sync_progress', data);
  }

  public onSyncProgress(listener: (data: { deviceId: string; progress: number; message: string; stage: string }) => void) {
    this.on('sync_progress', listener);
    return () => this.off('sync_progress', listener);
  }

  public emitDeviceStatusChange(data: { deviceId: string; status: string; lastSeenAt: Date }) {
    this.emit('device_status', data);
  }

  public onDeviceStatusChange(listener: (data: { deviceId: string; status: string; lastSeenAt: Date }) => void) {
    this.on('device_status', listener);
    return () => this.off('device_status', listener);
  }

  public emitWirePacket(packet: any) {
    this.emit('wire_packet', packet);
  }

  public onWirePacket(listener: (packet: any) => void) {
    this.on('wire_packet', listener);
    return () => this.off('wire_packet', listener);
  }
}

// Global EventEmitter for server environment
const globalForEvents = globalThis as unknown as { attendanceEventBus?: AttendanceEventBus };
if (!globalForEvents.attendanceEventBus || typeof globalForEvents.attendanceEventBus.emitWirePacket !== 'function') {
  globalForEvents.attendanceEventBus = new AttendanceEventBus();
}
export const attendanceEventBus = globalForEvents.attendanceEventBus;
