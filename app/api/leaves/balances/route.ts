import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import {
  employeesCol,
  leaveTypesCol,
  leaveBalancesCol,
  getMongoDb,
  generateId,
} from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

function canManageBalances(session: any): boolean {
  if (!session) return false;
  const role = session.role || '';
  return (
    role === 'SUPER_ADMIN' ||
    role === 'HR_ADMIN' ||
    role === 'role_super_admin' ||
    role === 'role_hr_admin' ||
    session.permissions?.includes('leaves:manage') ||
    session.permissions?.includes('rules:write')
  );
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Session required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get('year')) || new Date().getFullYear();
    const department = searchParams.get('department');
    const employeeId = searchParams.get('employeeId');
    const search = searchParams.get('search')?.toLowerCase();

    const empCol = await employeesCol();
    const ltCol = await leaveTypesCol();
    const lbCol = await leaveBalancesCol();

    // 1. Fetch leave types
    const leaveTypes = await ltCol.find({}).sort({ name: 1 }).toArray();

    // 2. Fetch employees
    const query: any = { status: { $ne: 'TERMINATED' } };
    if (department && department !== 'ALL') query.department = department;
    if (employeeId) query.id = employeeId;

    const allEmployees = await empCol.find(query).sort({ name: 1 }).toArray();

    const filteredEmployees = search
      ? allEmployees.filter(
          (e) =>
            e.name?.toLowerCase().includes(search) ||
            e.employeeCode?.toLowerCase().includes(search) ||
            e.department?.toLowerCase().includes(search)
        )
      : allEmployees;

    // 3. Fetch balances for this year
    const balances = await lbCol.find({ year }).toArray();
    const balanceMap = new Map<string, any>();
    for (const b of balances) {
      balanceMap.set(`${b.employeeId}_${b.leaveTypeId}`, b);
    }

    // 4. Map employees with their leave type balances
    const mapped = filteredEmployees.map((emp) => {
      const empBalances = leaveTypes.map((lt) => {
        const key1 = `${emp.id}_${lt.id}`;
        const key2 = `${emp.id}_${lt.code}`;
        const b = balanceMap.get(key1) || balanceMap.get(key2);

        const defaultAlloc = Number(lt.defaultDaysPerYear ?? lt.daysPerYear) || 12;
        const defaultBal = lt.accrualEnabled ? 0 : defaultAlloc;

        return {
          id: b?.id || null,
          leaveTypeId: lt.id,
          code: lt.code,
          name: lt.name,
          category: lt.category,
          colorHex: lt.colorHex,
          isPaid: lt.isPaid,
          allocated: b ? Number(b.allocated) : defaultAlloc,
          accrued: b ? Number(b.accrued) : defaultBal,
          used: b ? Number(b.used) : 0,
          pending: b ? Number(b.pending) : 0,
          balance: b ? Number(b.balance) : defaultBal,
        };
      });

      return {
        employeeId: emp.id,
        name: emp.name,
        employeeCode: emp.employeeCode,
        department: emp.department,
        designation: emp.designation,
        status: emp.status,
        gender: emp.gender,
        balances: empBalances,
      };
    });

    // 5. Fetch recent balance adjustment audits
    const db = await getMongoDb();
    const auditCol = db.collection('leave_balance_audits');
    const recentAudits = await auditCol.find({}).sort({ createdAt: -1 }).limit(20).toArray();

    return NextResponse.json({
      success: true,
      data: {
        employees: mapped,
        leaveTypes,
        year,
        recentAudits,
        totalEmployees: mapped.length,
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
    if (!session || !canManageBalances(session)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only Super Admins and HR Admins can manually adjust leave balances' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { employeeId, leaveTypeId, action, amount, reason } = body;
    const year = Number(body.year) || new Date().getFullYear();

    if (!employeeId || !leaveTypeId || !action || amount === undefined || !reason?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Employee, Leave Type, Action, Amount, and Audit Remark Reason are required',
          },
        },
        { status: 400 }
      );
    }

    const empCol = await employeesCol();
    const ltCol = await leaveTypesCol();
    const lbCol = await leaveBalancesCol();

    const employee = await empCol.findOne({ id: employeeId });
    if (!employee) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } },
        { status: 404 }
      );
    }

    const leaveType = await ltCol.findOne({ $or: [{ id: leaveTypeId }, { code: leaveTypeId }] });
    if (!leaveType) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Leave type not found' } },
        { status: 404 }
      );
    }

    const actualLeaveTypeId = leaveType.id || leaveTypeId;

    // Find existing balance record or initialize
    let balanceRecord = await lbCol.findOne({
      employeeId,
      $or: [{ leaveTypeId: actualLeaveTypeId }, { leaveTypeId: leaveType.code }],
      year,
    });

    const defaultAlloc = Number(leaveType.defaultDaysPerYear ?? leaveType.daysPerYear) || 12;
    const defaultBal = leaveType.accrualEnabled ? 0 : defaultAlloc;

    const oldBalance = balanceRecord ? Number(balanceRecord.balance) : defaultBal;
    const oldAllocated = balanceRecord ? Number(balanceRecord.allocated) : defaultAlloc;
    const oldUsed = balanceRecord ? Number(balanceRecord.used) : 0;
    const oldAccrued = balanceRecord ? Number(balanceRecord.accrued) : defaultBal;

    let newBalance = oldBalance;
    let newAllocated = oldAllocated;
    const changeAmount = Number(amount);

    if (action === 'INCREMENT') {
      newBalance = oldBalance + changeAmount;
      newAllocated = oldAllocated + changeAmount;
    } else if (action === 'DECREMENT') {
      newBalance = oldBalance - changeAmount;
      newAllocated = oldAllocated - changeAmount;
    } else if (action === 'SET_BALANCE') {
      newBalance = changeAmount;
    } else if (action === 'SET_ALLOCATED') {
      newAllocated = changeAmount;
      newBalance = changeAmount - oldUsed;
    } else {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ACTION', message: 'Action must be INCREMENT, DECREMENT, SET_BALANCE, or SET_ALLOCATED' } },
        { status: 400 }
      );
    }

    const now = new Date();

    if (balanceRecord) {
      await lbCol.updateOne(
        { _id: balanceRecord._id },
        {
          $set: {
            balance: newBalance,
            allocated: newAllocated,
            updatedAt: now,
          },
        }
      );
    } else {
      await lbCol.insertOne({
        id: generateId(),
        employeeId,
        leaveTypeId: actualLeaveTypeId,
        year,
        allocated: newAllocated,
        accrued: oldAccrued,
        used: oldUsed,
        pending: 0,
        balance: newBalance,
        updatedAt: now,
      });
    }

    // Insert Audit Log Entry
    const db = await getMongoDb();
    const auditCol = db.collection('leave_balance_audits');
    const auditEntry = {
      id: generateId(),
      employeeId,
      employeeName: employee.name,
      employeeCode: employee.employeeCode,
      department: employee.department,
      leaveTypeId: actualLeaveTypeId,
      leaveTypeCode: leaveType.code,
      leaveTypeName: leaveType.name,
      year,
      action,
      amount: changeAmount,
      oldBalance,
      newBalance,
      oldAllocated,
      newAllocated,
      reason: reason.trim(),
      adjustedById: session.userId || 'admin',
      adjustedByName: session.name || 'Super Admin',
      adjustedByRole: session.role || 'SUPER_ADMIN',
      createdAt: now,
    };

    await auditCol.insertOne(auditEntry);

    return NextResponse.json({
      success: true,
      data: {
        employeeId,
        leaveTypeId: actualLeaveTypeId,
        oldBalance,
        newBalance,
        oldAllocated,
        newAllocated,
        auditEntry,
      },
      message: `Balance for '${leaveType.name}' adjusted from ${oldBalance} to ${newBalance} days (${action}: ${changeAmount > 0 ? '+' : ''}${changeAmount}).`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ADJUST_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
