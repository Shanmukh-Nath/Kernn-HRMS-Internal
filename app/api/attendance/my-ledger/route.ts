import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { parseAppDate, formatAppDate, formatAppTime12 } from '@/lib/timezone';
import {
  employeesCol,
  attendanceEventsCol,
  attendanceRegularizationsCol,
  leaveRequestsCol,
  leaveTypesCol,
  devicesCol,
  attendanceRulesCol,
} from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetEmployeeId = searchParams.get('employeeId') || session.employeeId;

    // Strict access control: Non-admins can only see their own attendance ledger
    const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role || '');
    if (!isAdmin && targetEmployeeId !== session.employeeId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You can only access your own attendance reports.' } },
        { status: 403 }
      );
    }

    if (!targetEmployeeId) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_EMPLOYEE_LINK', message: 'User is not linked to an employee profile.' } },
        { status: 400 }
      );
    }

    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const monthParam = searchParams.get('month'); // 1 - 12
    const yearParam = searchParams.get('year'); // e.g. 2026

    const empCol = await employeesCol();
    const attCol = await attendanceEventsCol();
    const regCol = await attendanceRegularizationsCol();
    const leaveReqCol = await leaveRequestsCol();
    const leaveTypeCol = await leaveTypesCol();
    const devCol = await devicesCol();

    const employee = await empCol.findOne({ $or: [{ id: targetEmployeeId }, { _id: targetEmployeeId }] });
    if (!employee) {
      return NextResponse.json({ success: false, error: { code: 'EMPLOYEE_NOT_FOUND' } }, { status: 404 });
    }

    const devices = await devCol.find({}).toArray();
    const devMap = new Map(devices.map((d) => [String(d.id || d.deviceId), d.name || 'Terminal']));

    // 2. Fetch Active Attendance Shift Rules
    const attRuleCol = await attendanceRulesCol();
    const activeRule = (await attRuleCol.findOne({ isDefault: true })) || (await attRuleCol.findOne({})) || {};
    const shiftStartTime = activeRule?.shiftStartTime || '10:00';
    const [shiftHourStr, shiftMinStr] = shiftStartTime.split(':');
    const shiftStartHour = parseInt(shiftHourStr, 10) || 10;
    const shiftStartMin = parseInt(shiftMinStr, 10) || 0;
    const gracePeriodMinutes = Number(activeRule?.gracePeriodMinutes ?? 15);
    const graceCutoffMinuteOfDay = shiftStartHour * 60 + shiftStartMin + gracePeriodMinutes;

    // Fetch all punches for this employee
    const rawEvents = await attCol
      .find({
        $or: [
          { employeeId: employee.id },
          ...(employee.deviceUserId ? [{ deviceUserId: String(employee.deviceUserId) }] : []),
        ],
      })
      .sort({ timestamp: 1 })
      .toArray();

    // Fetch all regularizations for this employee
    const regularizations = await regCol
      .find({ employeeId: employee.id })
      .sort({ date: -1 })
      .toArray();

    const regByDate = new Map<string, any>();
    regularizations.forEach((r) => {
      const existing = regByDate.get(r.date);
      if (!existing || r.status === 'APPROVED' || (existing.status !== 'APPROVED' && r.status === 'PENDING')) {
        regByDate.set(r.date, r);
      }
    });

    // Fetch approved leaves
    const leaves = await leaveReqCol
      .find({ employeeId: employee.id, status: 'APPROVED' })
      .toArray();

    const leaveTypes = await leaveTypeCol.find({}).toArray();
    const ltMap = new Map(leaveTypes.map((t) => [t.id || t.code, t]));

    // Group punches by IST Date (YYYY-MM-DD)
    const eventsByDate = new Map<string, any[]>();
    for (const ev of rawEvents) {
      const d = parseAppDate(ev.timestamp);
      const istDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
      if (!eventsByDate.has(istDate)) {
        eventsByDate.set(istDate, []);
      }
      eventsByDate.get(istDate)!.push(ev);
    }

    // Ensure all raw events within each day are sorted in strict chronological order
    for (const [_, evList] of eventsByDate.entries()) {
      evList.sort((a, b) => parseAppDate(a.timestamp).getTime() - parseAppDate(b.timestamp).getTime());
    }

    // Determine dates list to return (Starting dates on top: Day 1, Day 2, Day 3, ...)
    let sortedDates: string[] = [];
    const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

    if (monthParam && yearParam) {
      const m = parseInt(monthParam, 10);
      const y = parseInt(yearParam, 10);
      const daysInMonth = new Date(y, m, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        sortedDates.push(dStr);
      }
      // Sort ascending (starting dates on top)
      sortedDates.sort((a, b) => a.localeCompare(b));
    } else {
      const allDatesSet = new Set<string>([
        ...Array.from(eventsByDate.keys()),
        ...Array.from(regByDate.keys()),
        todayIst,
      ]);
      sortedDates = Array.from(allDatesSet).sort((a, b) => a.localeCompare(b));
      if (startDateParam) sortedDates = sortedDates.filter((d) => d >= startDateParam);
      if (endDateParam) sortedDates = sortedDates.filter((d) => d <= endDateParam);
    }

    const ledger: any[] = [];
    let presentCount = 0;
    let lateCount = 0;
    let regularizedCount = 0;
    let onTimeCount = 0;
    let totalWorkHours = 0;

    for (const dateStr of sortedDates) {
      const dateEvents = eventsByDate.get(dateStr) || [];
      const reg = regByDate.get(dateStr);

      // Check if on leave
      const leave = leaves.find((l) => {
        const s = l.startDate
          ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(parseAppDate(l.startDate))
          : '';
        const e = l.endDate
          ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(parseAppDate(l.endDate))
          : '';
        return dateStr >= s && dateStr <= e;
      });

      if (leave) {
        const lt = ltMap.get(leave.leaveTypeId);
        ledger.push({
          date: dateStr,
          status: 'ON_LEAVE',
          statusLabel: `On Leave (${lt?.name || 'Approved Leave'})`,
          firstIn: null,
          lastOut: null,
          recordedIn: null,
          recordedOut: null,
          regularizedIn: null,
          regularizedOut: null,
          workingHours: 0,
          deviceName: null,
          isRegularized: false,
          regularization: null,
          leave: {
            name: lt?.name || 'Leave',
            code: lt?.code || 'LV',
            reason: leave.reason,
          },
        });
        continue;
      }

      // Raw recorded punches
      let rawFirstIn: Date | null = null;
      let rawLastOut: Date | null = null;
      let deviceName = 'Secureye S-FB3K';

      if (dateEvents.length > 0) {
        rawFirstIn = parseAppDate(dateEvents[0].timestamp);
        if (dateEvents.length > 1) {
          rawLastOut = parseAppDate(dateEvents[dateEvents.length - 1].timestamp);
        }
        deviceName = devMap.get(String(dateEvents[0].deviceId)) || 'Secureye Terminal';
      }

      // Effective punches after considering regularizations
      let effectiveIn: Date | null = rawFirstIn;
      let effectiveOut: Date | null = rawLastOut;
      let isReg = false;

      if (reg && reg.status === 'APPROVED') {
        isReg = true;
        if (reg.requestedCheckIn) {
          effectiveIn = parseAppDate(`${dateStr}T${reg.requestedCheckIn}:00+05:30`);
        }
        if (reg.requestedCheckOut) {
          effectiveOut = parseAppDate(`${dateStr}T${reg.requestedCheckOut}:00+05:30`);
        }
      }

      const dateObj = new Date(dateStr + 'T00:00:00');
      const isSunday = dateObj.getDay() === 0;
      const isFuture = dateStr > todayIst;

      if (!effectiveIn && !effectiveOut) {
        let status = 'ABSENT';
        let statusLabel = 'No Punch Detected';
        if (isFuture) {
          status = 'FUTURE';
          statusLabel = 'Upcoming Working Day';
        } else if (isSunday) {
          status = 'WEEKLY_OFF';
          statusLabel = 'Weekly Off (Sunday)';
        }

        ledger.push({
          date: dateStr,
          status,
          statusLabel,
          firstIn: null,
          lastOut: null,
          recordedIn: null,
          recordedOut: null,
          regularizedIn: null,
          regularizedOut: null,
          workingHours: 0,
          deviceName: null,
          isRegularized: false,
          regularization: reg ? { ...reg, status: reg.status } : null,
        });
        continue;
      }

      // Calculate working hours
      let hours = 0;
      if (effectiveIn && effectiveOut && effectiveOut > effectiveIn) {
        hours = Math.round(((effectiveOut.getTime() - effectiveIn.getTime()) / (1000 * 60 * 60)) * 10) / 10;
        totalWorkHours += hours;
      }

      // Punctuality determination
      let status = 'ON_TIME';
      let statusLabel = 'Present (On Time)';

      if (isReg) {
        status = 'REGULARIZED';
        statusLabel = 'Regularized (Manager Approved)';
        regularizedCount++;
        presentCount++;
      } else if (effectiveIn) {
        const timeParts = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
        }).formatToParts(effectiveIn);

        const inHour = Number(timeParts.find((p) => p.type === 'hour')?.value || '0');
        const inMin = Number(timeParts.find((p) => p.type === 'minute')?.value || '0');
        const checkInMinuteOfDay = inHour * 60 + inMin;

        if (checkInMinuteOfDay > graceCutoffMinuteOfDay) {
          status = 'LATE';
          statusLabel = 'Late Arrival';
          lateCount++;
        } else {
          onTimeCount++;
        }
        presentCount++;
      }

      ledger.push({
        date: dateStr,
        status,
        statusLabel,
        firstIn: effectiveIn ? effectiveIn.toISOString() : null,
        lastOut: effectiveOut ? effectiveOut.toISOString() : null,
        recordedIn: rawFirstIn ? rawFirstIn.toISOString() : null,
        recordedOut: rawLastOut ? rawLastOut.toISOString() : null,
        regularizedIn: reg?.requestedCheckIn || null,
        regularizedOut: reg?.requestedCheckOut || null,
        workingHours: hours,
        deviceName,
        isRegularized: isReg,
        regularization: reg
          ? {
              id: reg.id,
              status: reg.status,
              adjustmentType: reg.adjustmentType,
              requestedCheckIn: reg.requestedCheckIn,
              requestedCheckOut: reg.requestedCheckOut,
              reason: reg.reason,
              rejectionReason: reg.rejectionReason,
              reviewedBy: reg.reviewedBy,
              reviewedAt: reg.reviewedAt,
            }
          : null,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        employee: {
          id: employee.id,
          name: employee.name,
          employeeCode: employee.employeeCode,
          department: employee.department,
          designation: employee.designation,
          workShift: employee.workShift || 'Day (8h)',
        },
        metrics: {
          totalDaysRecorded: ledger.length,
          presentCount,
          onTimeCount,
          lateCount,
          regularizedCount,
          leavesCount: leaves.length,
          totalWorkHours: Math.round(totalWorkHours * 10) / 10,
          averageDailyHours: presentCount > 0 ? Math.round((totalWorkHours / presentCount) * 10) / 10 : 0,
        },
        ledger,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'LEDGER_FETCH_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
