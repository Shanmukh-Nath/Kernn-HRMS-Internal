import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { LeaveRulesEngine } from '@/lib/leave-rules-engine';
import { differenceInCalendarDays, format } from 'date-fns';
import {
  leaveBalancesCol,
  leaveTypesCol,
  leaveRequestsCol,
  employeesCol,
  attendanceRulesCol,
  holidaysCol,
  generateId,
} from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId') || session.employeeId;

    const lbCol = await leaveBalancesCol();
    const ltCol = await leaveTypesCol();
    const lrCol = await leaveRequestsCol();
    const empCol = await employeesCol();

    const leaveTypes = await ltCol.find({}).toArray();
    const ltMap = new Map(leaveTypes.map((t) => [t.id || t.code, t]));

    // Query Leave Balances
    let balances: any[] = [];
    if (employeeId) {
      const rawBalances = await lbCol.find({ employeeId }).toArray();
      balances = rawBalances.map((b) => {
        const lt = ltMap.get(b.leaveTypeId) || {};
        return {
          ...b,
          leaveType: {
            name: lt.name || 'Leave',
            code: lt.code || 'LV',
            isPaid: Boolean(lt.isPaid),
            category: lt.category,
            proofDocumentLabel: lt.proofDocumentLabel,
            proofThresholdDays: lt.proofThresholdDays,
            priorNoticeDays: lt.priorNoticeDays,
            maxConsecutiveDays: lt.maxConsecutiveDays,
            applySandwichRule: Boolean(lt.applySandwichRule),
          },
        };
      });
    }

    // Query Requests
    let requests: any[] = [];
    const filter: Record<string, any> = {};

    if (session.role === 'SUPER_ADMIN' || session.role === 'HR_ADMIN' || session.role === 'MANAGER') {
      // Sees all requests
    } else if (employeeId) {
      filter.employeeId = employeeId;
    }

    const rawRequests = await lrCol.find(filter).sort({ createdAt: -1 }).toArray();
    const employees = await empCol.find({}).toArray();
    const empMap = new Map(employees.map((e) => [e.id, e]));

    requests = rawRequests.map((r) => {
      const e = empMap.get(r.employeeId);
      const lt = ltMap.get(r.leaveTypeId);
      return {
        ...r,
        employee: {
          name: e?.name || 'Employee',
          employeeCode: e?.employeeCode || '',
          department: e?.department || '',
        },
        leaveType: {
          name: lt?.name || '',
          code: lt?.code || '',
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        balances,
        requests,
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
    const body = await req.json();

    const employeeId = body.employeeId || session?.employeeId;
    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Employee ID is required' } },
        { status: 400 }
      );
    }

    if (!body.leaveTypeId || !body.startDate || !body.endDate || !body.reason) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Leave category, start date, end date, and reason are required' },
        },
        { status: 400 }
      );
    }

    const ltCol = await leaveTypesCol();
    const empCol = await employeesCol();
    const attRuleCol = await attendanceRulesCol();
    const holidayCol = await holidaysCol();
    const lrCol = await leaveRequestsCol();
    const lbCol = await leaveBalancesCol();

    // 1. Fetch Policy & Employee Records
    const leaveType = await ltCol.findOne({ $or: [{ id: body.leaveTypeId }, { code: body.leaveTypeId }] });
    if (!leaveType) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Selected leave policy not found' } },
        { status: 404 }
      );
    }

    const employee = await empCol.findOne({ id: employeeId });

    // 2. Evaluate Demographic & Service Restrictions
    if (employee) {
      const demoResult = LeaveRulesEngine.validateDemographics(
        {
          id: employee.id,
          name: employee.name,
          gender: employee.gender,
          employeeType: employee.employmentType || employee.department,
          department: employee.department,
          designation: employee.designation,
          joiningDate: employee.joiningDate,
          isProbation: employee.status === 'Probation',
        },
        leaveType
      );

      if (!demoResult.eligible) {
        return NextResponse.json(
          { success: false, error: { code: 'DEMOGRAPHIC_RESTRICTION', message: demoResult.reason } },
          { status: 400 }
        );
      }
    }

    // 3. Evaluate Sandwich Rule
    const attRule = await attRuleCol.findOne({ isDefault: true });
    let weeklyOffDays = ['Saturday', 'Sunday'];
    if (attRule?.weeklyOffDays) {
      try {
        weeklyOffDays = typeof attRule.weeklyOffDays === 'string' ? JSON.parse(attRule.weeklyOffDays) : attRule.weeklyOffDays;
      } catch {}
    }

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    const holidaysInRange = await holidayCol.find({ date: { $gte: startDate, $lte: endDate } }).toArray();
    const holidayDates = holidaysInRange.map((h) =>
      h.date instanceof Date ? h.date.toISOString().split('T')[0] : String(h.date).split('T')[0]
    );

    const sandwichResult = LeaveRulesEngine.evaluateSandwichRule(
      body.startDate,
      body.endDate,
      Boolean(leaveType.applySandwichRule),
      weeklyOffDays,
      holidayDates
    );

    const totalDays = sandwichResult.effectiveChargeableDays;

    // 4. Evaluate Advance Notice Window
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(body.startDate);
    start.setHours(0, 0, 0, 0);
    const advanceNoticeDays = differenceInCalendarDays(start, today);

    // 5. Evaluate Application Limits & Proof Requirements
    const proofProvided = Boolean((body.proofDocumentNotes || body.medicalCertificateNotes || '').trim().length >= 3);

    const currentMonth = format(new Date(), 'yyyy-MM');
    const currentYear = format(new Date(), 'yyyy');
    const monthStart = new Date(`${currentMonth}-01T00:00:00.000Z`);
    const yearStart = new Date(`${currentYear}-01-01T00:00:00.000Z`);

    const monthCount = await lrCol.countDocuments({
      employeeId,
      leaveTypeId: leaveType.id || body.leaveTypeId,
      startDate: { $gte: monthStart },
    });

    const yearCount = await lrCol.countDocuments({
      employeeId,
      leaveTypeId: leaveType.id || body.leaveTypeId,
      startDate: { $gte: yearStart },
    });

    const appValidation = LeaveRulesEngine.validateApplication(
      totalDays,
      advanceNoticeDays,
      proofProvided,
      leaveType,
      monthCount,
      yearCount
    );

    if (!appValidation.valid) {
      return NextResponse.json(
        { success: false, error: { code: 'POLICY_VIOLATION', message: appValidation.error } },
        { status: 400 }
      );
    }

    // 6. Balance & Overdraft Validation
    const balanceRecord = await lbCol.findOne({
      employeeId,
      leaveTypeId: leaveType.id || body.leaveTypeId,
    });

    const isCompOff = leaveType.code === 'COMP_OFF' || leaveType.category === 'Compensatory';
    const currentBalance = Number(balanceRecord?.balance) || 0;

    if (isCompOff) {
      if (currentBalance < totalDays) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INSUFFICIENT_COMP_OFF_BALANCE',
              message: `Insufficient Compensatory Off balance. You currently have ${currentBalance} Comp-Off days earned. Comp-Off is granted only after an approved weekend or public holiday work shift.`,
            },
          },
          { status: 400 }
        );
      }
    } else if (!leaveType.allowNegativeBalance) {
      if (currentBalance < totalDays) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INSUFFICIENT_BALANCE',
              message: `Insufficient balance: You have ${currentBalance} days available, but requested ${totalDays} day(s). Negative balance overdraft is not permitted for '${leaveType.name}'.`,
            },
          },
          { status: 400 }
        );
      }
    } else if (balanceRecord && leaveType.allowNegativeBalance) {
      const overdraftFloor = Number(leaveType.negativeBalanceLimit) || -5.0;
      if (currentBalance - totalDays < overdraftFloor) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'OVERDRAFT_LIMIT_EXCEEDED',
              message: `Overdraft Limit Reached: '${leaveType.name}' permits maximum negative balance of ${overdraftFloor} days. Your balance would become ${(currentBalance - totalDays).toFixed(1)} days.`,
            },
          },
          { status: 400 }
        );
      }
    }

    // 7. Insert Leave Request into Ledger
    const id = generateId();
    const now = new Date();
    const reasonText =
      sandwichResult.sandwichOffDaysCount > 0 && leaveType.applySandwichRule
        ? `${body.reason} [Sandwich Rule Applied: ${sandwichResult.sandwichOffDaysCount} off-day(s) charged: ${sandwichResult.sandwichedDates.join(', ')}]`
        : body.reason;

    await lrCol.insertOne({
      id,
      employeeId,
      leaveTypeId: leaveType.id || body.leaveTypeId,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      totalDays,
      reason: reasonText,
      proofDocumentUrl: body.proofDocumentUrl || null,
      proofDocumentName: body.proofDocumentName || null,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    });

    let message = 'Leave application submitted and queued for supervisor review.';
    if (sandwichResult.sandwichOffDaysCount > 0 && leaveType.applySandwichRule) {
      message += ` (Sandwich Policy Applied: ${sandwichResult.sandwichOffDaysCount} weekend/holiday off-day(s) included in leave count).`;
    }

    return NextResponse.json({
      success: true,
      data: { id, totalDays, status: 'PENDING' },
      message,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SUBMIT_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
