import { NextRequest } from 'next/server';
import { attendanceEventBus } from '@/lib/events';
import { NormalizedAttendanceEvent } from '@/server/secureye/types';
import { startBackgroundAutoPoller } from '@/server/secureye/auto-poller';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Ensure background auto sync is running
  startBackgroundAutoPoller(15000);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat comment
      controller.enqueue(encoder.encode(': connected\n\n'));

      const onPunch = (event: NormalizedAttendanceEvent) => {
        try {
          const payload = `event: punch\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream might be closed
        }
      };

      const onWirePacket = (packet: any) => {
        try {
          const payload = `event: wire_packet\ndata: ${JSON.stringify(packet)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream might be closed
        }
      };

      const cleanupPunch = attendanceEventBus.onPunch(onPunch);
      const cleanupWire = attendanceEventBus.onWirePacket(onWirePacket);

      const cleanup = () => {
        cleanupPunch();
        cleanupWire();
      };

      // Keepalive heartbeat every 15s
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(interval);
          cleanup();
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
