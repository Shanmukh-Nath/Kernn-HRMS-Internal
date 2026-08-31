import { NextRequest, NextResponse } from 'next/server';
import { calculateDailyAttendance, ShiftRuleConfig } from '@/lib/attendance-calculator';
import { getStoredShiftRule } from '@/lib/rules-store';
import { format } from 'date-fns';
import {
  attendanceEventsCol,
  employeesCol,
  usersCol,
  rolesCol,
  leaveRequestsCol,
  leaveTypesCol,
  payrollRecordsCol,
} from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

function safeParseDate(val: any): Date {
  if (val instanceof Date) return val;
  if (typeof val === 'number') return new Date(val);
  const n = Number(val);
  if (!isNaN(n) && n > 1000000000) return new Date(n);
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get('type') || 'attendance';
    const search = searchParams.get('search')?.toLowerCase() || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const department = searchParams.get('department');
    const statusFilter = searchParams.get('status');

    // ==========================================
    // 1. ATTENDANCE REPORT
    // ==========================================
    if (reportType === 'attendance') {
      const rule: ShiftRuleConfig = getStoredShiftRule();
      const attCol = await attendanceEventsCol();
      const empCol = await employeesCol();

      const filter: Record<string, any> = {};
      if (startDate && endDate) {
        filter.timestamp = {
          $gte: new Date(`${startDate}T00:00:00.000Z`),
          $lte: new Date(`${endDate}T23:59:59.999Z`),
        };
      } else if (startDate) {
        filter.timestamp = { $gte: new Date(`${startDate}T00:00:00.000Z`) };
      }

      const rawEvents = await attCol.find(filter).sort({ timestamp: 1 }).toArray();
      const employees = await empCol.find({}).toArray();
      const empById = new Map(employees.map((e) => [e.id, e]));
      const empByDeviceUserId = new Map(employees.map((e) => [e.deviceUserId, e]));

      const groupedMap = new Map<
        string,
        {
          dateStr: string;
          deviceUserId: string;
          employeeInfo: { name: string; code?: string; id?: string; department?: string };
          punches: any[];
        }
      >();

      for (const ev of rawEvents) {
        const parsedDate = safeParseDate(ev.timestamp);
        const dStr = format(parsedDate, 'yyyy-MM-dd');
        const key = `${dStr}_${ev.deviceUserId}`;
        const emp = (ev.employeeId && empById.get(ev.employeeId)) || empByDeviceUserId.get(ev.deviceUserId);

        if (!groupedMap.has(key)) {
          groupedMap.set(key, {
            dateStr: dStr,
            deviceUserId: ev.deviceUserId,
            employeeInfo: {
              name: emp?.name || `User #${ev.deviceUserId}`,
              code: emp?.employeeCode || `EMP-${ev.deviceUserId}`,
              id: ev.employeeId || emp?.id,
              department: emp?.department || 'General',
            },
            punches: [],
          });
        }

        groupedMap.get(key)!.punches.push({
          id: ev.id,
          timestamp: parsedDate,
          verificationType: ev.verificationType,
          terminalName: ev.terminalName,
          status: ev.status,
        });
      }

      let consolidated = Array.from(groupedMap.values()).map((g) => {
        const summary = calculateDailyAttendance(g.dateStr, g.punches, rule, g.employeeInfo);
        return {
          ...summary,
          firstCheckIn: summary.checkInTime
            ? { time: summary.checkInTime, verificationType: summary.checkInVerification }
            : null,
          lastCheckOut: summary.checkOutTime
            ? { time: summary.checkOutTime, verificationType: summary.checkOutVerification }
            : null,
          netWorkMinutes: summary.netWorkDurationMinutes,
          isLate: summary.minutesLate > 0,
          lateMinutes: summary.minutesLate,
          isEarlyExit: summary.minutesEarlyExit > 0,
          earlyExitMinutes: summary.minutesEarlyExit,
          employee: {
            name: summary.employeeName,
            code: summary.employeeCode,
            department: g.employeeInfo.department,
          },
        };
      });

      if (search) {
        consolidated = consolidated.filter(
          (c) =>
            c.employee.name.toLowerCase().includes(search) ||
            (c.employee.code && c.employee.code.toLowerCase().includes(search)) ||
            c.deviceUserId.toLowerCase().includes(search)
        );
      }

      if (department && department !== 'ALL') {
        consolidated = consolidated.filter((c) => c.employee.department === department);
      }

      if (statusFilter && statusFilter !== 'ALL') {
        consolidated = consolidated.filter((c) => c.status === statusFilter);
      }

      consolidated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const totalDays = consolidated.length;
      const presentCount = consolidated.filter((c) => c.status === 'PRESENT').length;
      const lateCount = consolidated.filter((c) => c.isLate).length;
      const earlyExitCount = consolidated.filter((c) => c.isEarlyExit).length;
      const singlePunchCount = consolidated.filter((c) => c.status === 'SINGLE_PUNCH').length;
      const totalWorkMins = consolidated.reduce((acc, c) => acc + c.netWorkMinutes, 0);
      const totalWorkHours = (totalWorkMins / 60).toFixed(1);
      const onTimeRate = totalDays > 0 ? Math.round(((totalDays - lateCount) / totalDays) * 100) : 100;

      return NextResponse.json({
        success: true,
        data: {
          type: 'attendance',
          records: consolidated,
          kpis: {
            totalDays,
            presentCount,
            lateCount,
            earlyExitCount,
            singlePunchCount,
            totalWorkHours,
            onTimeRate,
          },
        },
      });
    }

    // ==========================================
    // 2. EMPLOYEE MASTER REPORT
    // ==========================================
    if (reportType === 'employees') {
      const empCol = await employeesCol();
      const userCol = await usersCol();
      const roleCol = await rolesCol();

      const filter: Record<string, any> = {};
      if (department && department !== 'ALL') filter.department = department;
      if (statusFilter && statusFilter !== 'ALL') filter.status = statusFilter;

      const rawEmployees = await empCol.find(filter).sort({ name: 1 }).toArray();
      const users = await userCol.find({}).toArray();
      const roles = await roleCol.find({}).toArray();

      const userByEmpId = new Map(users.map((u) => [u.employeeId, u]));
      const roleById = new Map(roles.map((r) => [r.id, r.name]));

      let employees = rawEmployees.map((e) => {
        const u = userByEmpId.get(e.id);
        return {
          ...e,
          id: e.id || e._id?.toString(),
          userMobile: u?.mobileNumber || null,
          userEmail: u?.email || null,
          userStatus: u?.status || null,
          roleName: (u?.roleId && roleById.get(u.roleId)) || 'EMPLOYEE',
        };
      });

      if (search) {
        employees = employees.filter(
          (e) =>
            e.name?.toLowerCase().includes(search) ||
            e.employeeCode?.toLowerCase().includes(search) ||
            e.department?.toLowerCase().includes(search) ||
            e.userMobile?.includes(search) ||
            e.userEmail?.toLowerCase().includes(search)
        );
      }

      const totalEmployees = employees.length;
      const activeCount = employees.filter((e) => e.status === 'ACTIVE').length;
      const enrolledCount = employees.filter((e) => Boolean(e.deviceUserId)).length;
      const totalSalaryBudget = employees.reduce(
        (sum, e) => sum + (e.baseSalary || 0) + (e.hra || 0) + (e.allowances || 0),
        0
      );

      return NextResponse.json({
        success: true,
        data: {
          type: 'employees',
          records: employees,
          kpis: {
            totalEmployees,
            activeCount,
            enrolledCount,
            totalSalaryBudget,
          },
        },
      });
    }

    // ==========================================
    // 3. LEAVE AUDIT REPORT
    // ==========================================
    if (reportType === 'leaves') {
      const lrCol = await leaveRequestsCol();
      const ltCol = await leaveTypesCol();
      const empCol = await employeesCol();

      const filter: Record<string, any> = {};
      if (statusFilter && statusFilter !== 'ALL') filter.status = statusFilter;

      const rawLeaves = await lrCol.find(filter).sort({ createdAt: -1 }).toArray();
      const leaveTypes = await ltCol.find({}).toArray();
      const employees = await empCol.find({}).toArray();

      const ltMap = new Map(leaveTypes.map((t) => [t.id, t]));
      const empMap = new Map(employees.map((e) => [e.id, e]));

      let leaves = rawLeaves.map((lr) => {
        const lt = ltMap.get(lr.leaveTypeId);
        const emp = empMap.get(lr.employeeId);
        return {
          ...lr,
          id: lr.id || lr._id?.toString(),
          days: lr.totalDays,
          leaveTypeName: lt?.name || 'Leave',
          leaveTypeCode: lt?.code || 'LV',
          employeeName: emp?.name || 'Employee',
          employeeDept: emp?.department || '',
        };
      });

      if (search) {
        leaves = leaves.filter(
          (l) =>
            l.employeeName?.toLowerCase().includes(search) ||
            l.leaveTypeName?.toLowerCase().includes(search) ||
            l.employeeDept?.toLowerCase().includes(search)
        );
      }

      const totalRequests = leaves.length;
      const pendingCount = leaves.filter((l) => l.status === 'PENDING').length;
      const approvedCount = leaves.filter((l) => l.status === 'APPROVED').length;
      const rejectedCount = leaves.filter((l) => l.status === 'REJECTED').length;
      const totalDaysTaken = leaves
        .filter((l) => l.status === 'APPROVED')
        .reduce((sum, l) => sum + (l.days || 0), 0);

      return NextResponse.json({
        success: true,
        data: {
          type: 'leaves',
          records: leaves,
          kpis: {
            totalRequests,
            pendingCount,
            approvedCount,
            rejectedCount,
            totalDaysTaken,
          },
        },
      });
    }

    // ==========================================
    // 4. PAYROLL & COMPENSATION REPORT
    // ==========================================
    if (reportType === 'payroll') {
      const prCol = await payrollRecordsCol();
      const empCol = await employeesCol();

      const rawPayrolls = await prCol.find({}).sort({ year: -1, month: -1 }).toArray();
      const employees = await empCol.find({}).toArray();
      const empMap = new Map(employees.map((e) => [e.id, e]));

      let payrolls = rawPayrolls
        .map((p) => {
          const emp = empMap.get(p.employeeId);
          return {
            ...p,
            id: p.id || p._id?.toString(),
            employeeName: emp?.name || '',
            employeeDept: emp?.department || '',
            employeeDesig: emp?.designation || '',
            employeeCode: emp?.employeeCode || '',
          };
        })
        .sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));

      if (department && department !== 'ALL') {
        payrolls = payrolls.filter((p) => p.employeeDept === department);
      }

      if (search) {
        payrolls = payrolls.filter(
          (p) =>
            p.employeeName?.toLowerCase().includes(search) ||
            p.employeeDept?.toLowerCase().includes(search) ||
            p.employeeCode?.toLowerCase().includes(search)
        );
      }

      const totalRecords = payrolls.length;
      const totalNetPayout = payrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);
      const totalPfDeduction = payrolls.reduce((sum, p) => sum + (p.pfDeduction || 0), 0);
      const totalEsiDeduction = payrolls.reduce((sum, p) => sum + (p.esiDeduction || 0), 0);
      const totalLopDeduction = payrolls.reduce((sum, p) => sum + (p.lopDeduction || 0), 0);

      return NextResponse.json({
        success: true,
        data: {
          type: 'payroll',
          records: payrolls,
          kpis: {
            totalRecords,
            totalNetPayout,
            totalPfDeduction,
            totalEsiDeduction,
            totalLopDeduction,
          },
        },
      });
    }

    // ==========================================
    // 5. VIOLATIONS & PUNCTUALITY AUDIT REPORT
    // ==========================================
    if (reportType === 'violations') {
      const rule: ShiftRuleConfig = getStoredShiftRule();
      const attCol = await attendanceEventsCol();
      const empCol = await employeesCol();

      const rawEvents = await attCol.find({}).sort({ timestamp: 1 }).toArray();
      const employees = await empCol.find({}).toArray();
      const empById = new Map(employees.map((e) => [e.id, e]));
      const empByDeviceUserId = new Map(employees.map((e) => [e.deviceUserId, e]));

      const groupedMap = new Map<string, any>();
      for (const ev of rawEvents) {
        const parsedDate = safeParseDate(ev.timestamp);
        const dStr = format(parsedDate, 'yyyy-MM-dd');
        const key = `${dStr}_${ev.deviceUserId}`;
        const emp = (ev.employeeId && empById.get(ev.employeeId)) || empByDeviceUserId.get(ev.deviceUserId);

        if (!groupedMap.has(key)) {
          groupedMap.set(key, {
            dateStr: dStr,
            deviceUserId: ev.deviceUserId,
            employeeInfo: {
              name: emp?.name || `User #${ev.deviceUserId}`,
              code: emp?.employeeCode,
              department: emp?.department,
            },
            punches: [],
          });
        }
        groupedMap.get(key)!.punches.push({
          id: ev.id,
          timestamp: parsedDate,
          verificationType: ev.verificationType,
          terminalName: ev.terminalName,
          status: ev.status,
        });
      }

      const violations: any[] = [];
      for (const g of groupedMap.values()) {
        const summary = calculateDailyAttendance(g.dateStr, g.punches, rule, g.employeeInfo);
        const isLate = summary.minutesLate > 0;
        const isEarlyExit = summary.minutesEarlyExit > 0;
        const isSingle = summary.status === 'SINGLE_PUNCH';

        if (isLate || isEarlyExit || isSingle) {
          violations.push({
            date: summary.date,
            deviceUserId: g.deviceUserId,
            employee: {
              name: summary.employeeName,
              code: summary.employeeCode,
              department: g.employeeInfo.department,
            },
            isLate,
            lateMinutes: summary.minutesLate,
            isEarlyExit,
            earlyExitMinutes: summary.minutesEarlyExit,
            status: summary.status,
            firstCheckIn: summary.checkInTime ? { time: summary.checkInTime } : null,
            lastCheckOut: summary.checkOutTime ? { time: summary.checkOutTime } : null,
            netWorkHours: (summary.netWorkDurationMinutes / 60).toFixed(1),
          });
        }
      }

      let filtered = violations;
      if (search) {
        filtered = filtered.filter(
          (v) =>
            v.employee.name.toLowerCase().includes(search) ||
            v.deviceUserId.toLowerCase().includes(search) ||
            (v.employee.code && v.employee.code.toLowerCase().includes(search))
        );
      }

      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const lateCount = filtered.filter((v) => v.isLate).length;
      const earlyCount = filtered.filter((v) => v.isEarlyExit).length;
      const singleCount = filtered.filter((v) => v.status === 'SINGLE_PUNCH').length;

      return NextResponse.json({
        success: true,
        data: {
          type: 'violations',
          records: filtered,
          kpis: {
            totalViolations: filtered.length,
            lateCount,
            earlyCount,
            singleCount,
          },
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown report type' }, { status: 400 });
  } catch (err: any) {
    console.error('Universal report error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'REPORT_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}
