import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncDeviceViaNativeDriver, decodeVerifyMode } from '@/server/secureye/native-bridge';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const device = await prisma.device.findUnique({
    where: { id },
  });

  if (!device) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Device not found' } }, { status: 404 });
  }

  const syncRecord = await prisma.deviceSync.create({
    data: {
      deviceId: id,
      syncType: 'ATTENDANCE',
      status: 'IN_PROGRESS',
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsSkipped: 0,
      startedAt: new Date(),
    },
  });

  try {
    const nativeData = await syncDeviceViaNativeDriver(
      device.ipAddress,
      device.port,
      parseInt(device.deviceId, 10) || 1
    );

    let createdCount = 0;
    let skippedCount = 0;

    for (const log of nativeData.logs) {
      const uId = String(log.userId);
      const timestamp = new Date(log.timestamp);

      // Verify or upsert employee
      let employee = await prisma.employee.findUnique({
        where: {
          deviceId_deviceUserId: {
            deviceId: id,
            deviceUserId: uId,
          },
        },
      });

      if (!employee) {
        employee = await prisma.employee.create({
          data: {
            deviceId: id,
            deviceUserId: uId,
            name: `Employee ${uId}`,
            employeeCode: `EMP-${uId}`,
            status: 'ACTIVE',
          },
        });
      }

      // Check deduplication
      const existingEvent = await prisma.attendanceEvent.findFirst({
        where: {
          deviceId: id,
          deviceUserId: uId,
          timestamp,
        },
      });

      if (existingEvent) {
        skippedCount++;
      } else {
        const { eventType, verificationType } = decodeVerifyMode(log.verifyMode);

        await prisma.attendanceEvent.create({
          data: {
            deviceId: id,
            deviceUserId: uId,
            employeeId: employee.id,
            timestamp,
            eventType,
            verificationType,
            source: 'SYNC',
            rawPayload: JSON.stringify(log),
          },
        });
        createdCount++;
      }
    }

    await prisma.deviceSync.update({
      where: { id: syncRecord.id },
      data: {
        status: 'SUCCESS',
        recordsProcessed: nativeData.logs.length,
        recordsCreated: createdCount,
        recordsSkipped: skippedCount,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        processed: nativeData.logs.length,
        created: createdCount,
        skipped: skippedCount,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Attendance sync failed';

    await prisma.deviceSync.update({
      where: { id: syncRecord.id },
      data: {
        status: 'FAILED',
        error: errorMsg,
        completedAt: new Date(),
      },
    });

    return NextResponse.json(
      { success: false, error: { code: 'SYNC_ERROR', message: errorMsg } },
      { status: 500 }
    );
  }
}
