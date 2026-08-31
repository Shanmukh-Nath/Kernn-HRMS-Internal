import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SecureyeDeviceClient } from '@/server/secureye/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const device = await prisma.device.findUnique({
    where: { id },
  });

  if (!device) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Device not found.' } },
      { status: 404 }
    );
  }

  const client = new SecureyeDeviceClient({
    ipAddress: device.ipAddress,
    port: device.port,
    deviceId: device.deviceId,
    timeoutMs: 4000,
  });

  try {
    const testResult = await client.testConnection();

    if (testResult.success) {
      await prisma.device.update({
        where: { id },
        data: {
          lastSeenAt: new Date(),
          status: 'ONLINE',
          lastError: null,
          ...(testResult.firmware && { firmware: testResult.firmware }),
          ...(testResult.userCount !== undefined && { userCount: testResult.userCount }),
          ...(testResult.logCount !== undefined && { logCount: testResult.logCount }),
        },
      });
    } else {
      await prisma.device.update({
        where: { id },
        data: {
          status: 'OFFLINE',
          lastError: testResult.errorMessage,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: testResult,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Connection test failed';
    return NextResponse.json({
      success: false,
      error: {
        code: 'DEVICE_UNREACHABLE',
        message: errorMsg,
      },
    });
  }
}
