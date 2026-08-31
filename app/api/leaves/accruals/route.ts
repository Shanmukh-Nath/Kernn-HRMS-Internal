import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { LeaveAccrualEngine } from '@/lib/leave-accrual-engine';
import { leaveTypesCol, leaveBalancesCol, leaveAccrualLogsCol, employeesCol } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const ltCol = await leaveTypesCol();
    const lbCol = await leaveBalancesCol();
    const alCol = await leaveAccrualLogsCol();
    const empCol = await employeesCol();

    // 1. Fetch policies and calculate balances
    const leaveTypes = await ltCol.find({}).sort({ name: 1 }).toArray();
    const balances = await lbCol.find({}).toArray();

    const policyMap = leaveTypes.map((lt) => {
      const relatedBalances = balances.filter((b) => b.leaveTypeId === lt.id || b.leaveTypeId === lt.code);
      const uniqueEmps = new Set(relatedBalances.map((b) => b.employeeId));
      const totalBalance = relatedBalances.reduce((sum, b) => sum + (Number(b.balance) || 0), 0);
      const totalAccrued = relatedBalances.reduce((sum, b) => sum + (Number(b.accrued) || 0), 0);

      return {
        id: lt.id || lt._id?.toString(),
        name: lt.name,
        code: lt.code,
        category: lt.category || 'Casual',
        defaultDaysPerYear: lt.defaultDaysPerYear || 12,
        accrualEnabled: Boolean(lt.accrualEnabled),
        accrualFrequency: lt.accrualFrequency || 'Monthly',
        accrualAmount: lt.accrualAmount || 1.0,
        maxAccumulation: lt.maxAccumulation || 30,
        allowCarryForward: Boolean(lt.allowCarryForward),
        carryForwardLimit: lt.carryForwardLimit || 0,
        allowEncashment: Boolean(lt.allowEncashment),
        encashmentMaxDays: lt.encashmentMaxDays || 0,
        totalEmployeesCovered: uniqueEmps.size,
        totalWorkforceBalance: totalBalance,
        totalWorkforceAccrued: totalAccrued,
      };
    });

    // 2. Fetch recent accrual history logs
    const logs = await alCol.find({}).sort({ createdAt: -1 }).limit(100).toArray();
    const emps = await empCol.find({}).toArray();
    const empMap = new Map(emps.map((e) => [e.id, e]));
    const ltMap = new Map(leaveTypes.map((t) => [t.id, t]));

    const enrichedLogs = logs.map((al) => {
      const e = empMap.get(al.employeeId);
      const lt = ltMap.get(al.leaveTypeId);
      return {
        ...al,
        id: al.id || al._id?.toString(),
        leaveTypeName: lt?.name || 'Leave',
        leaveTypeCode: lt?.code || 'LV',
        employeeName: e?.name || 'Employee',
        employeeCode: e?.employeeCode || '',
        department: e?.department || '',
      };
    });

    // 3. Stats
    const uniqueEmployeesInLogs = new Set(logs.map((l) => l.employeeId));
    const totalDaysAccruedHistory = logs.reduce((sum, l) => sum + (Number(l.creditedAmount) || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        policies: policyMap,
        logs: enrichedLogs,
        stats: {
          totalEmployees: uniqueEmployeesInLogs.size,
          totalDaysAccruedHistory: Math.round(totalDaysAccruedHistory * 100) / 100,
          totalAccrualEvents: logs.length,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (session && !hasPermission(session, 'leaves:approve') && !hasPermission(session, 'rules:write')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to execute leave accruals' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const action = body.action || 'ACCRUE';

    if (action === 'ROLLOVER') {
      const fromYear = Number(body.fromYear) || new Date().getFullYear();
      const toYear = Number(body.toYear) || fromYear + 1;
      const result = await LeaveAccrualEngine.runYearEndCarryForward(fromYear, toYear, session?.name || 'ADMIN');
      return NextResponse.json(result);
    }

    // Default: Run Accrual Cycle
    const result = await LeaveAccrualEngine.runAccrualCycle({
      leaveTypeId: body.leaveTypeId || undefined,
      frequency: body.frequency || 'ALL',
      cycle: body.cycle || undefined,
      executedBy: session?.name || 'ADMIN_USER',
      forceRerun: Boolean(body.forceRerun),
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ACCRUAL_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
