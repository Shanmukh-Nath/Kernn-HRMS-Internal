import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SecureyeDeviceClient } from '@/server/secureye/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    const statusData = await client.executeCommand('GET_DEVICE_STATUS', {}, 4000);
    return NextResponse.json({
      success: true,
      data: {
        device,
        liveStatus: statusData,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: true,
      data: {
        device,
        liveStatus: {
          note: 'Direct GET_DEVICE_STATUS is queued or waiting for next device polling cycle.',
        },
      },
    });
  }
}
