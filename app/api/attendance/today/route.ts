import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { format } from 'date-fns';
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

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const startOfToday = new Date(`${todayStr}T00:00:00.000Z`);
    const endOfToday = new Date(`${todayStr}T23:59:59.999Z`);

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

    // 2. Fetch today's attendance events
    const todayEvents = await attCol
      .find({ timestamp: { $gte: startOfToday, $lte: endOfToday } })
      .sort({ timestamp: 1 })
      .toArray();

    const devices = await devCol.find({}).toArray();
    const devMap = new Map(devices.map((d) => [d.id || d.deviceId, d.name || 'Terminal 1']));

    // Group events by employee
    const checkinMap: Record<string, { firstIn: string; lastOut: string; deviceName: string }> = {};
    for (const ev of todayEvents) {
      if (!ev.employeeId) continue;
      const tsStr = ev.timestamp instanceof Date ? ev.timestamp.toISOString() : String(ev.timestamp);
      if (!checkinMap[ev.employeeId]) {
        checkinMap[ev.employeeId] = {
          firstIn: tsStr,
          lastOut: tsStr,
          deviceName: devMap.get(ev.deviceId) || 'Terminal 1',
        };
      } else {
        checkinMap[ev.employeeId].lastOut = tsStr;
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
        const inDate = new Date(checkinMap[emp.id].firstIn);
        const inHour = inDate.getHours();
        const inMin = inDate.getMinutes();
        const isLate = inHour > SHIFT_START_HOUR || (inHour === SHIFT_START_HOUR && inMin > SHIFT_START_MINUTE);
        if (isLate) lateCount++;

        todayCheckIns.push({
          employeeId: emp.id,
          name: emp.name,
          employeeCode: emp.employeeCode,
          department: emp.department,
          designation: emp.designation,
          checkInTime: checkinMap[emp.id].firstIn,
          checkOutTime: checkinMap[emp.id].firstIn !== checkinMap[emp.id].lastOut ? checkinMap[emp.id].lastOut : null,
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
