import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateDailyAttendance, ShiftRuleConfig } from '@/lib/attendance-calculator';
import { getStoredShiftRule } from '@/lib/rules-store';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const rule: ShiftRuleConfig = getStoredShiftRule();

    const where: any = {};
    if (startDate && endDate) {
      where.timestamp = {
        gte: new Date(`${startDate}T00:00:00.000Z`),
        lte: new Date(`${endDate}T23:59:59.999Z`),
      };
    }

    const rawEvents = await prisma.attendanceEvent.findMany({
      where,
      include: { employee: true },
      orderBy: { timestamp: 'asc' },
    });

    const groupedMap = new Map<string, any>();
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
      });
    }

    const records = Array.from(groupedMap.values()).map((item) =>
      calculateDailyAttendance(item.dateStr, item.punches, rule, item.employeeInfo)
    );

    records.sort((a, b) => b.date.localeCompare(a.date));

    // Generate CSV Header & Rows
    const headers = [
      'Date',
      'Employee Code',
      'Employee Name',
      'Device User ID',
      'Scheduled Shift',
      'First Check-In',
      'Check-In Verify',
      'Check-In Status',
      'Minutes Late',
      'Last Check-Out',
      'Check-Out Verify',
      'Check-Out Status',
      'Early Exit Minutes',
      'Overtime Minutes',
      'Total Breaks Count',
      'Total Break (Mins)',
      'Gross Duration (Mins)',
      'Net Work Hours',
      'Daily Status',
      'Raw Punches Cleaned',
    ];

    const rows = records.map((r) => [
      `"${r.formattedDate}"`,
      `"${r.employeeCode}"`,
      `"${r.employeeName}"`,
      `"#${r.deviceUserId}"`,
      `"${r.scheduledShift}"`,
      `"${r.checkInTime || 'N/A'}"`,
      `"${r.checkInVerification || 'N/A'}"`,
      `"${r.checkInStatus}"`,
      r.minutesLate,
      `"${r.checkOutTime || 'N/A'}"`,
      `"${r.checkOutVerification || 'N/A'}"`,
      `"${r.checkOutStatus}"`,
      r.minutesEarlyExit,
      r.minutesOvertime,
      r.breaks.length,
      r.totalBreakMinutes,
      r.grossDurationMinutes,
      r.netWorkHours,
      `"${r.status}"`,
      `"${r.cleanPunchesCount} (of ${r.rawPunchesCount})"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="Attendance_Report_${format(new Date(), 'yyyy-MM-dd')}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
