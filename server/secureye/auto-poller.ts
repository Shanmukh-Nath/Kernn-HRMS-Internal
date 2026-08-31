import { prisma } from '@/lib/prisma';
import { syncDeviceViaNativeDriver, decodeVerifyMode } from './native-bridge';
import { attendanceEventBus } from '@/lib/events';

let isPolling = false;
let pollingIntervalHandle: NodeJS.Timeout | null = null;

/**
 * Runs a single sync pass across all enabled biometric devices.
 */
export async function runAutoSyncPass(): Promise<{ newPunches: number; newUsers: number }> {
  if (isPolling) return { newPunches: 0, newUsers: 0 };
  isPolling = true;

  let totalNewPunches = 0;
  let totalNewUsers = 0;

  try {
    const devices = await prisma.device.findMany({
      where: { enabled: true, pollingEnabled: true },
    });

    for (const dev of devices) {
      try {
        const data = await syncDeviceViaNativeDriver(
          dev.ipAddress,
          dev.port,
          parseInt(dev.deviceId, 10) || 1
        );

        // 1. Sync users
        for (const u of data.users) {
          const uId = String(u.userId);
          const hasFp = u.backupNumbers.some((b) => b >= 0 && b <= 9);
          const hasPwd = u.backupNumbers.includes(17);
          const hasFace = u.backupNumbers.includes(50) || u.backupNumbers.some((b) => b >= 20 && b <= 30);

          const existing = await prisma.employee.findUnique({
            where: {
              deviceId_deviceUserId: {
                deviceId: dev.id,
                deviceUserId: uId,
              },
            },
          });

          if (!existing) {
            await prisma.employee.create({
              data: {
                deviceId: dev.id,
                deviceUserId: uId,
                name: u.name || `Employee ${uId}`,
                employeeCode: `EMP-${uId}`,
                privilege: u.privilege,
                fingerprintEnabled: hasFp,
                passwordEnabled: hasPwd,
                faceEnabled: hasFace,
                status: u.enabled ? 'ACTIVE' : 'INACTIVE',
              },
            });
            totalNewUsers++;
          }
        }

        // 2. Sync attendance punches
        for (const log of data.logs) {
          const timestamp = new Date(log.timestamp);
          const existing = await prisma.attendanceEvent.findFirst({
            where: {
              deviceId: dev.id,
              deviceUserId: log.userId,
              timestamp,
            },
          });

          if (!existing) {
            const emp = await prisma.employee.findUnique({
              where: {
                deviceId_deviceUserId: {
                  deviceId: dev.id,
                  deviceUserId: log.userId,
                },
              },
            });

            const { eventType, verificationType } = decodeVerifyMode(log.verifyMode);

            const created = await prisma.attendanceEvent.create({
              data: {
                deviceId: dev.id,
                deviceUserId: log.userId,
                employeeId: emp?.id,
                timestamp,
                eventType,
                verificationType,
                source: 'SYNC',
                rawPayload: JSON.stringify(log),
              },
            });

            totalNewPunches++;

            // Emit live event to UI monitor
            attendanceEventBus?.emitPunch?.({
              id: created.id,
              deviceId: dev.id,
              deviceName: dev.name,
              userId: log.userId,
              employeeName: emp?.name || `Employee ${log.userId}`,
              employeeCode: emp?.employeeCode || `EMP-${log.userId}`,
              timestamp: new Date(log.timestamp),
              eventType: eventType as any,
              verifyType: verificationType,
            } as any);
          }
        }

        // Update device status
        await prisma.device.update({
          where: { id: dev.id },
          data: {
            status: 'ONLINE',
            lastSeenAt: new Date(),
            lastSyncAt: new Date(),
            userCount: data.users.length,
            logCount: data.logs.length,
          },
        });
      } catch (devErr) {
        // Individual device sync failure
      }
    }
  } finally {
    isPolling = false;
  }

  return { newPunches: totalNewPunches, newUsers: totalNewUsers };
}

/**
 * Starts periodic background polling every intervalMs (default: 60s to reduce hardware load).
 */
export function startBackgroundAutoPoller(intervalMs = 60000) {
  if (pollingIntervalHandle) return;
  pollingIntervalHandle = setInterval(() => {
    runAutoSyncPass().catch(() => {});
  }, intervalMs);
}
