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
} from '@/lib/mongodb';

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
    const checkinMap: Record<string, { firstIn: string; lastOut: string; deviceName: string; punchCount: number }> = {};
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
      if (!checkinMap[reg.employeeId]) {
        checkinMap[reg.employeeId] = {
          firstIn: `${todayStr}T${reg.requestedCheckIn}:00`,
          lastOut: reg.requestedCheckOut ? `${todayStr}T${reg.requestedCheckOut}:00` : `${todayStr}T${reg.requestedCheckIn}:00`,
          deviceName: 'Regularized (Manager Approved)',
          punchCount: reg.requestedCheckOut ? 2 : 1,
        };
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

    // 4. Categorize employees
    const todayCheckIns: any[] = [];
    const todayOnLeave: any[] = [];
    const notYetArrived: any[] = [];

    let lateCount = 0;
    const SHIFT_START_HOUR = 9;
    const SHIFT_START_MINUTE = 15;

    for (const emp of employees) {
      if (onLeaveSet.has(emp.id)) {
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
        const isLate = inHour > SHIFT_START_HOUR || (inHour === SHIFT_START_HOUR && inMin > SHIFT_START_MINUTE);
        if (isLate) lateCount++;

        const hasCheckOut = checkinMap[emp.id].punchCount > 1 || checkinMap[emp.id].firstIn !== checkinMap[emp.id].lastOut;

        todayCheckIns.push({
          employeeId: emp.id,
          name: emp.name,
          employeeCode: emp.employeeCode,
          department: emp.department,
          designation: emp.designation,
          checkInTime: checkinMap[emp.id].firstIn,
          checkOutTime: hasCheckOut ? checkinMap[emp.id].lastOut : null,
          status: isLate ? 'LATE' : 'ON_TIME',
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
