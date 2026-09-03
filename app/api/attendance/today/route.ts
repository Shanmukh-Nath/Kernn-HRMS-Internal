import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { parseAppDate } from '@/lib/timezone';
import {
  employeesCol,
  attendanceEventsCol,
  devicesCol,
  attendanceRegularizationsCol,
  leaveRequestsCol,
  leaveTypesCol,
  attendanceRulesCol,
} from '@/lib/mongodb';
import { syncLeaveAttendanceForDate } from '@/lib/leave-attendance-sync';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    // Current IST date (YYYY-MM-DD)
    const nowIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const todayStr = nowIst;
    const startOfToday = new Date(`${todayStr}T00:00:00+05:30`);
    const endOfToday = new Date(`${todayStr}T23:59:59.999+05:30`);

    const empCol = await employeesCol();
    const attCol = await attendanceEventsCol();
    const devCol = await devicesCol();
    const regCol = await attendanceRegularizationsCol();
    const leaveReqCol = await leaveRequestsCol();
    const leaveTypeCol = await leaveTypesCol();

    // 1. Fetch active employees
    const employees = await empCol
      .find({ status: { $in: ['ACTIVE', 'PROBATION'] } })
      .sort({ name: 1 })
      .toArray();

    const empById = new Map(employees.map((e) => [String(e.id || e._id), e]));
    const empByDeviceUserId = new Map(employees.map((e) => [String(e.deviceUserId), e]));

    // 2. Fetch today's attendance events across Date and string timestamps
    const rawEvents = await attCol.find({}).sort({ timestamp: 1 }).toArray();
    const todayEvents = rawEvents.filter((ev) => {
      const d = parseAppDate(ev.timestamp);
      return d >= startOfToday && d <= endOfToday;
    });

    const devices = await devCol.find({}).toArray();
    const devMap = new Map(devices.map((d) => [String(d.id || d.deviceId), d.name || 'Terminal 1']));

    // Group events by employee
    const checkinMap: Record<string, { firstIn: string; lastOut: string; deviceName: string; punchCount: number; isRegularized?: boolean }> = {};
    for (const ev of todayEvents) {
      const emp = (ev.employeeId && empById.get(String(ev.employeeId))) || (ev.deviceUserId && empByDeviceUserId.get(String(ev.deviceUserId)));
      if (!emp) continue;
      const empId = String(emp.id || emp._id);

      const d = parseAppDate(ev.timestamp);
      const tsIso = d.toISOString();

      if (!checkinMap[empId]) {
        checkinMap[empId] = {
          firstIn: tsIso,
          lastOut: tsIso,
          deviceName: devMap.get(String(ev.deviceId)) || 'Secureye S-FB3K',
          punchCount: 1,
        };
      } else {
        const existingLast = parseAppDate(checkinMap[empId].lastOut);
        if (d >= existingLast) {
          checkinMap[empId].lastOut = tsIso;
        }
        checkinMap[empId].punchCount++;
      }
    }

    // Include approved regularizations for today
    const regularizations = await regCol
      .find({ date: todayStr, status: 'APPROVED' })
      .toArray();

    for (const reg of regularizations) {
      const empId = String(reg.employeeId);
      const regInDate = reg.requestedCheckIn ? parseAppDate(`${todayStr}T${reg.requestedCheckIn}:00+05:30`) : null;
      const regOutDate = reg.requestedCheckOut ? parseAppDate(`${todayStr}T${reg.requestedCheckOut}:00+05:30`) : null;

      if (!checkinMap[empId]) {
        checkinMap[empId] = {
          firstIn: regInDate ? regInDate.toISOString() : (regOutDate ? regOutDate.toISOString() : ''),
          lastOut: regOutDate ? regOutDate.toISOString() : (regInDate ? regInDate.toISOString() : ''),
          deviceName: 'Regularized (Manager Approved)',
          punchCount: reg.requestedCheckIn && reg.requestedCheckOut ? 2 : 1,
          isRegularized: true,
        };
      } else {
        if (regInDate) {
          checkinMap[empId].firstIn = regInDate.toISOString();
        }
        if (regOutDate) {
          checkinMap[empId].lastOut = regOutDate.toISOString();
        }
        checkinMap[empId].deviceName = 'Regularized (Manager Approved)';
        checkinMap[empId].isRegularized = true;
      }
    }

    // 3. Fetch approved leaves for today
    const approvedLeaves = await leaveReqCol
      .find({
        status: 'APPROVED',
        startDate: { $lte: endOfToday },
        endDate: { $gte: startOfToday },
      })
      .toArray();

    const leaveTypes = await leaveTypeCol.find({}).toArray();
    const ltMap = new Map(leaveTypes.map((lt) => [lt.id || lt.code, lt]));

    const onLeaveSet = new Set(approvedLeaves.map((l) => l.employeeId));

    // 4. Scope employees by role
    const isEmployeeRole = session.role === 'EMPLOYEE' || (!['SUPER_ADMIN', 'HR_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role || ''));
    let filteredEmployees = employees;
    if (isEmployeeRole && session.employeeId) {
      filteredEmployees = employees.filter((e) => String(e.id || e._id) === String(session.employeeId));
    }

    // 5. Categorize employees
    const todayCheckIns: any[] = [];
    const todayOnLeave: any[] = [];
    const notYetArrived: any[] = [];

    let lateCount = 0;
    const attRuleCol = await attendanceRulesCol();
    const activeRule = (await attRuleCol.findOne({ isDefault: true })) || (await attRuleCol.findOne({})) || {};
    const shiftStartTime = activeRule?.shiftStartTime || '10:00';
    const [shiftHourStr, shiftMinStr] = shiftStartTime.split(':');
    const shiftStartHour = parseInt(shiftHourStr, 10) || 10;
    const shiftStartMin = parseInt(shiftMinStr, 10) || 0;
    const gracePeriodMinutes = Number(activeRule?.gracePeriodMinutes ?? 15);
    const graceCutoffMinuteOfDay = shiftStartHour * 60 + shiftStartMin + gracePeriodMinutes;

    // Sync leave deductions conditionally based on attendance punches
    await syncLeaveAttendanceForDate(todayStr);

    for (const emp of filteredEmployees) {
      const hasAttendancePunches = Boolean(checkinMap[emp.id]);

      // Only mark as ON_LEAVE if employee has approved leave AND has NO attendance punches today
      if (onLeaveSet.has(emp.id) && !hasAttendancePunches) {
        const leaveInfo = approvedLeaves.find((l) => l.employeeId === emp.id);
        const lt = leaveInfo ? ltMap.get(leaveInfo.leaveTypeId) : null;
        todayOnLeave.push({
          employeeId: emp.id,
          name: emp.name,
          employeeCode: emp.employeeCode,
          department: emp.department,
          designation: emp.designation,
          leaveTypeName: lt?.name || 'Approved Leave',
          leaveTypeCode: lt?.code || 'LV',
          startDate: leaveInfo?.startDate,
          endDate: leaveInfo?.endDate,
          reason: leaveInfo?.reason,
        });
        continue;
      }

      if (checkinMap[emp.id]) {
        const inDate = parseAppDate(checkinMap[emp.id].firstIn);
        const timeParts = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
        }).formatToParts(inDate);

        const inHour = Number(timeParts.find((p) => p.type === 'hour')?.value || '0');
        const inMin = Number(timeParts.find((p) => p.type === 'minute')?.value || '0');
        const checkInMinuteOfDay = inHour * 60 + inMin;
        const isLate = checkinMap[emp.id].isRegularized
          ? false
          : checkInMinuteOfDay > graceCutoffMinuteOfDay;
        if (isLate) lateCount++;

        const hasCheckOut = Boolean(checkinMap[emp.id].lastOut && checkinMap[emp.id].lastOut !== checkinMap[emp.id].firstIn);

        todayCheckIns.push({
          employeeId: emp.id,
          name: emp.name,
          employeeCode: emp.employeeCode,
          department: emp.department,
          designation: emp.designation,
          checkInTime: checkinMap[emp.id].firstIn,
          checkOutTime: hasCheckOut ? checkinMap[emp.id].lastOut : null,
          status: checkinMap[emp.id].isRegularized ? 'REGULARIZED' : (isLate ? 'LATE' : 'ON_TIME'),
          deviceName: checkinMap[emp.id].deviceName,
        });
      } else {
        notYetArrived.push({
          employeeId: emp.id,
          name: emp.name,
          employeeCode: emp.employeeCode,
          department: emp.department,
          designation: emp.designation,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        date: todayStr,
        metrics: {
          totalActiveStaff: employees.length,
          presentCount: todayCheckIns.length,
          onLeaveCount: todayOnLeave.length,
          lateCount,
          notYetArrivedCount: notYetArrived.length,
          attendanceRate: employees.length > 0 ? Math.round((todayCheckIns.length / employees.length) * 100) : 0,
        },
        todayCheckIns,
        todayOnLeave,
        notYetArrived,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
