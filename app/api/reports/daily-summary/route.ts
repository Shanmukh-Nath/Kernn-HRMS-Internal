import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateDailyAttendance, ShiftRuleConfig } from '@/lib/attendance-calculator';
import { getStoredShiftRule } from '@/lib/rules-store';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate'); // "YYYY-MM-DD"
    const endDate = searchParams.get('endDate');     // "YYYY-MM-DD"
    const employeeId = searchParams.get('employeeId');
    const search = searchParams.get('search')?.toLowerCase();
    const statusFilter = searchParams.get('status');

    // 1. Fetch active shift rule
    const rule: ShiftRuleConfig = getStoredShiftRule();

    // 2. Build where filter for attendance events
    const where: any = {};

    if (startDate && endDate) {
      where.timestamp = {
        gte: new Date(`${startDate}T00:00:00.000Z`),
        lte: new Date(`${endDate}T23:59:59.999Z`),
      };
    } else if (startDate) {
      where.timestamp = {
        gte: new Date(`${startDate}T00:00:00.000Z`),
      };
    }

    if (employeeId) {
      where.OR = [
        { employeeId },
        { deviceUserId: employeeId },
      ];
    }

    // 3. Query all attendance events with employees
    const rawEvents = await prisma.attendanceEvent.findMany({
      where,
      include: {
        employee: true,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    // 4. Group punches by Date (YYYY-MM-DD) and Employee (deviceUserId)
    const groupedMap = new Map<string, {
      dateStr: string;
      deviceUserId: string;
      employeeInfo: { name: string; code?: string; id?: string };
      punches: any[];
    }>();

    for (const ev of rawEvents) {
      const dateStr = format(new Date(ev.timestamp), 'yyyy-MM-dd');
      const key = `${dateStr}__${ev.deviceUserId}`;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          dateStr,
          deviceUserId: ev.deviceUserId,
          employeeInfo: {
            name: ev.employee?.name || `Employee ${ev.deviceUserId}`,
            code: ev.employee?.employeeCode || `EMP-${ev.deviceUserId}`,
            id: ev.employeeId || undefined,
          },
          punches: [],
        });
      }

      groupedMap.get(key)!.punches.push({
        id: ev.id,
        timestamp: ev.timestamp,
        verificationType: ev.verificationType,
        eventType: ev.eventType,
        deviceUserId: ev.deviceUserId,
        employeeName: ev.employee?.name,
        employeeCode: ev.employee?.employeeCode,
      });
    }

    // 5. Calculate Daily Attendance Record for each group
    let records = Array.from(groupedMap.values()).map((item) =>
      calculateDailyAttendance(item.dateStr, item.punches, rule, item.employeeInfo)
    );

    // 6. Apply search and status filters
    if (search) {
      records = records.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(search) ||
          r.deviceUserId.toLowerCase().includes(search) ||
          r.employeeCode.toLowerCase().includes(search)
      );
    }

    if (statusFilter && statusFilter !== 'ALL') {
      records = records.filter((r) => r.status === statusFilter);
    }

    // Sort by Date desc, then Employee Name asc
    records.sort((a, b) => {
      const cmpDate = b.date.localeCompare(a.date);
      if (cmpDate !== 0) return cmpDate;
      return a.employeeName.localeCompare(b.employeeName);
    });

    // 7. Calculate Aggregated Summary KPIs
    const totalDaysRecorded = records.length;
    const presentCount = records.filter((r) => r.status === 'PRESENT' || r.status === 'OVERTIME').length;
    const lateCount = records.filter((r) => r.status === 'LATE' || r.checkInStatus === 'LATE' || r.checkInStatus === 'VERY_LATE').length;
    const earlyExitCount = records.filter((r) => r.status === 'EARLY_EXIT' || r.checkOutStatus === 'EARLY_EXIT').length;
    const halfDayCount = records.filter((r) => r.status === 'HALF_DAY').length;
    const totalOvertimeMinutes = records.reduce((acc, r) => acc + r.minutesOvertime, 0);
    const totalBreaksMinutes = records.reduce((acc, r) => acc + r.totalBreakMinutes, 0);
    const totalWorkHours = Math.round(records.reduce((acc, r) => acc + r.netWorkHours, 0) * 10) / 10;

    return NextResponse.json({
      success: true,
      data: {
        records,
        rule,
        kpis: {
          totalDaysRecorded,
          presentCount,
          lateCount,
          earlyExitCount,
          halfDayCount,
          totalOvertimeMinutes,
          totalBreaksMinutes,
          totalWorkHours,
          onTimePercentage: totalDaysRecorded > 0 ? Math.round(((totalDaysRecorded - lateCount) / totalDaysRecorded) * 100) : 100,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'REPORT_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
