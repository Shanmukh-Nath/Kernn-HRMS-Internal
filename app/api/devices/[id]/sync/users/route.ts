import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncDeviceViaNativeDriver } from '@/server/secureye/native-bridge';

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
      syncType: 'USERS',
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

    // Update serial number if available
    if (nativeData.serialNumber) {
      await prisma.device.update({
        where: { id },
        data: {
          firmware: `S-FB3K (SN: ${nativeData.serialNumber})`,
          lastSeenAt: new Date(),
          status: 'ONLINE',
        },
      });
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const u of nativeData.users) {
      const uId = String(u.userId);
      const uName = u.name || `Employee ${uId}`;
      const hasFp = u.backupNumbers.some((b) => b >= 0 && b <= 9);
      const hasPwd = u.backupNumbers.includes(17);
      const hasFace = u.backupNumbers.includes(50) || u.backupNumbers.some((b) => b >= 20 && b <= 30);

      const existing = await prisma.employee.findUnique({
        where: {
          deviceId_deviceUserId: {
            deviceId: id,
            deviceUserId: uId,
          },
        },
      });

      if (existing) {
        await prisma.employee.update({
          where: { id: existing.id },
          data: {
            name: uName,
            privilege: u.privilege,
            fingerprintEnabled: hasFp,
            passwordEnabled: hasPwd,
            faceEnabled: hasFace,
            status: u.enabled ? 'ACTIVE' : 'INACTIVE',
            updatedAt: new Date(),
          },
        });
        updatedCount++;
      } else {
        await prisma.employee.create({
          data: {
            deviceId: id,
            deviceUserId: uId,
            name: uName,
            employeeCode: `EMP-${uId}`,
            privilege: u.privilege,
            fingerprintEnabled: hasFp,
            passwordEnabled: hasPwd,
            faceEnabled: hasFace,
            status: u.enabled ? 'ACTIVE' : 'INACTIVE',
          },
        });
        createdCount++;
      }
    }

    await prisma.deviceSync.update({
      where: { id: syncRecord.id },
      data: {
        status: 'SUCCESS',
        recordsProcessed: nativeData.users.length,
        recordsCreated: createdCount,
        recordsSkipped: updatedCount,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        serialNumber: nativeData.serialNumber,
        processed: nativeData.users.length,
        created: createdCount,
        updated: updatedCount,
        users: nativeData.users,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'User synchronization failed';

    await prisma.deviceSync.update({
      where: { id: syncRecord.id },
      data: {
        status: 'FAILED',
        error: errorMsg,
        completedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: { code: 'SYNC_ERROR', message: errorMsg },
      },
      { status: 500 }
    );
  }
}
