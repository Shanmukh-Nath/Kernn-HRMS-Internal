import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SecureyeDeviceClient } from '@/server/secureye/client';
import { deviceCommandQueue } from '@/server/secureye/command-queue';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const device = await prisma.device.findUnique({
    where: { id },
  });

  if (!device) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Device not found' } }, { status: 404 });
  }

  const client = new SecureyeDeviceClient({
    ipAddress: device.ipAddress,
    port: device.port,
    deviceId: device.deviceId,
  });

  try {
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    let res: Record<string, unknown> = {};
    try {
      res = await client.executeCommand('SET_TIME', { time: nowStr }, 3000);
    } catch {
      res = await deviceCommandQueue.enqueue(device.deviceId, 'SET_TIME', { time: nowStr }, 5000);
    }

    return NextResponse.json({
      success: true,
      data: {
        syncedTime: nowStr,
        deviceResponse: res,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'SET_TIME_ERROR',
        message: err instanceof Error ? err.message : 'Time sync failed',
      },
    });
  }
}
