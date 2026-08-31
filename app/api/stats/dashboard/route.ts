import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalDevices,
      onlineDevices,
      totalEmployees,
      todayPunches,
      todayCheckIns,
      todayCheckOuts,
      latestPunch,
      mostRecentSync,
      failedRequestsCount,
      recentPunches,
    ] = await Promise.all([
      prisma.device.count(),
      prisma.device.count({ where: { status: 'ONLINE' } }),
      prisma.employee.count(),
      prisma.attendanceEvent.count({ where: { timestamp: { gte: todayStart } } }),
      prisma.attendanceEvent.count({ where: { timestamp: { gte: todayStart }, eventType: 'CHECK_IN' } }),
      prisma.attendanceEvent.count({ where: { timestamp: { gte: todayStart }, eventType: 'CHECK_OUT' } }),
      prisma.attendanceEvent.findFirst({
        orderBy: { timestamp: 'desc' },
        include: {
          device: { select: { name: true } },
          employee: { select: { name: true, employeeCode: true } },
        },
      }),
      prisma.deviceSync.findFirst({
        orderBy: { startedAt: 'desc' },
        include: { device: { select: { name: true } } },
      }),
      prisma.deviceRequestLog.count({ where: { responseStatus: { gte: 400 } } }),
      prisma.attendanceEvent.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: {
          device: { select: { name: true } },
          employee: { select: { name: true, employeeCode: true } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalDevices,
        onlineDevices,
        totalEmployees,
        todayPunches,
        todayCheckIns,
        todayCheckOuts,
        latestPunch,
        lastSyncTime: mostRecentSync?.completedAt || mostRecentSync?.startedAt || null,
        failedRequestsCount,
        recentPunches,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: { code: 'STATS_ERROR', message: err instanceof Error ? err.message : 'Stats query failed' } },
      { status: 500 }
    );
  }
}
