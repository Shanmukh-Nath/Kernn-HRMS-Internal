import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          employees: true,
          attendance: true,
          syncLogs: true,
        },
      },
    },
  });

  if (!device) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Device not found.' } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: device,
  });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    const body = await req.json();
    const updated = await prisma.device.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.ipAddress && { ipAddress: body.ipAddress.trim() }),
        ...(body.port && { port: parseInt(body.port, 10) }),
        ...(body.deviceId && { deviceId: body.deviceId.trim() }),
        ...(body.enabled !== undefined && { enabled: Boolean(body.enabled) }),
        ...(body.pollingEnabled !== undefined && { pollingEnabled: Boolean(body.pollingEnabled) }),
        ...(body.pollingInterval && { pollingInterval: parseInt(body.pollingInterval, 10) }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_ERROR', message: err instanceof Error ? err.message : 'Update failed' } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    await prisma.device.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { deleted: true },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_ERROR', message: err instanceof Error ? err.message : 'Delete failed' } },
      { status: 500 }
    );
  }
}
