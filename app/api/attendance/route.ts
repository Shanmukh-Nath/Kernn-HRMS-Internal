import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatAppDate, formatAppTime } from '@/lib/timezone';
import { decodeVerifyMode } from '@/server/secureye/native-bridge';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const format = searchParams.get('format'); // 'json' or 'csv'
  const deviceId = searchParams.get('deviceId');
  const employeeId = searchParams.get('employeeId');
  const eventType = searchParams.get('eventType');
  const verificationType = searchParams.get('verificationType');
  const search = searchParams.get('search');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const page = parseInt(searchParams.get('page') || '1', 10);

  const whereClause: Record<string, unknown> = {};

  if (deviceId) whereClause.deviceId = deviceId;
  if (employeeId) whereClause.employeeId = employeeId;
  if (eventType) whereClause.eventType = eventType;
  if (verificationType) whereClause.verificationType = verificationType;

  if (startDate || endDate) {
    whereClause.timestamp = {};
    if (startDate) {
      (whereClause.timestamp as Record<string, unknown>).gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      (whereClause.timestamp as Record<string, unknown>).lte = end;
    }
  }

  if (search) {
    whereClause.OR = [
      { deviceUserId: { contains: search } },
      { employee: { name: { contains: search } } },
      { employee: { employeeCode: { contains: search } } },
    ];
  }

  try {
    if (format === 'csv') {
      const allEvents = await prisma.attendanceEvent.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        include: {
          device: { select: { name: true, deviceId: true } },
          employee: { select: { name: true, employeeCode: true } },
        },
      });

      const csvHeader = 'Employee ID,Employee Name,Device,Date,Time,Event Type,Verification Type,Source\n';
      const csvRows = allEvents.map((evt) => {
        const empId = evt.employee?.employeeCode || evt.deviceUserId;
        const empName = `"${(evt.employee?.name || `Employee ${evt.deviceUserId}`).replace(/"/g, '""')}"`;
        const devName = `"${(evt.device.name || evt.deviceId).replace(/"/g, '""')}"`;
        const dateStr = formatAppDate(evt.timestamp);
        const timeStr = formatAppTime(evt.timestamp);
        return `${empId},${empName},${devName},${dateStr},${timeStr},${evt.eventType},${evt.verificationType},${evt.source}`;
      });

      const csvContent = csvHeader + csvRows.join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="attendance_export_${new Date().toISOString().substring(0, 10)}.csv"`,
        },
      });
    }

    const [events, totalCount] = await Promise.all([
      prisma.attendanceEvent.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          device: { select: { name: true, deviceId: true } },
          employee: { select: { name: true, employeeCode: true } },
        },
      }),
      prisma.attendanceEvent.count({ where: whereClause }),
    ]);

    const normalizedEvents = events.map((ev) => {
      let vType = ev.verificationType;
      try {
        if (ev.rawPayload) {
          const parsed = JSON.parse(ev.rawPayload);
          if (parsed.verifyMode !== undefined) {
            vType = decodeVerifyMode(parsed.verifyMode).verificationType;
          }
        }
      } catch {}

      return {
        ...ev,
        verificationType: vType,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        events: normalizedEvents,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: { code: 'QUERY_ERROR', message: err instanceof Error ? err.message : 'Query failed' } },
      { status: 500 }
    );
  }
}

/**
 * Fallback CSV Import endpoint for manual uploads
 */
export async function POST(req: NextRequest) {
  try {
    const { deviceId, csvText } = await req.json();
    if (!deviceId || !csvText) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'deviceId and csvText are required' } },
        { status: 400 }
      );
    }

    const lines = csvText.split('\n').map((l: string) => l.trim()).filter(Boolean);
    let imported = 0;

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p: string) => p.replace(/(^"|"$)/g, '').trim());
      if (parts.length >= 4) {
        const [uId, name, dateStr, timeStr, evtType, verType] = parts;
        const timestamp = new Date(`${dateStr} ${timeStr}`);

        if (!isNaN(timestamp.getTime())) {
          let employee = await prisma.employee.findUnique({
            where: { deviceId_deviceUserId: { deviceId, deviceUserId: uId } },
          });

          if (!employee) {
            employee = await prisma.employee.create({
              data: {
                deviceId,
                deviceUserId: uId,
                name: name || `Employee ${uId}`,
                employeeCode: `EMP-${uId}`,
              },
            });
          }

          await prisma.attendanceEvent.upsert({
            where: {
              deviceId_deviceUserId_timestamp_eventType: {
                deviceId,
                deviceUserId: uId,
                timestamp,
                eventType: evtType || 'CHECK_IN',
              },
            },
            update: {},
            create: {
              deviceId,
              employeeId: employee.id,
              deviceUserId: uId,
              timestamp,
              eventType: evtType || 'CHECK_IN',
              verificationType: verType || 'FINGERPRINT',
              source: 'CSV_IMPORT',
            },
          });
          imported++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { imported },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: { code: 'IMPORT_ERROR', message: err instanceof Error ? err.message : 'Import failed' } },
      { status: 500 }
    );
  }
}
