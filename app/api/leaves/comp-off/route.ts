import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { format } from 'date-fns';
import {
  leaveBalancesCol,
  leaveTypesCol,
  leaveAccrualLogsCol,
  attendanceEventsCol,
  holidaysCol,
  employeesCol,
  compOffClaimsCol,
  generateId,
} from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const claimsCol = await compOffClaimsCol();
    const empCol = await employeesCol();
    const lbCol = await leaveBalancesCol();
    const ltCol = await leaveTypesCol();

    const isManagerOrAdmin =
      session.role === 'SUPER_ADMIN' ||
      session.role === 'HR_ADMIN' ||
      session.role === 'MANAGER' ||
      hasPermission(session, 'leaves:approve');

    const filter: Record<string, any> = {};
    if (!isManagerOrAdmin) {
      filter.employeeId = session.employeeId;
    }

    const claims = await claimsCol.find(filter).sort({ createdAt: -1 }).toArray();
    const emps = await empCol.find({}).toArray();
    const empMap = new Map(emps.map((e) => [e.id, e]));

    // Fetch Comp-Off Type
    const compOffType = await ltCol.findOne({ code: 'COMP_OFF' });

    // Fetch current balances
    const compOffBalances = compOffType
      ? await lbCol.find({ leaveTypeId: compOffType.id }).toArray()
      : [];
    const balanceMap = new Map(compOffBalances.map((b) => [b.employeeId, b.balance || 0]));

    const enriched = claims.map((c: any) => {
      const emp = empMap.get(c.employeeId);
      return {
        ...c,
        id: c.id || c._id?.toString(),
        employeeName: emp?.name || 'Employee',
        employeeCode: emp?.employeeCode || '',
        department: emp?.department || '',
        currentCompOffBalance: balanceMap.get(c.employeeId) || 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: enriched,
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
    if (!session) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const body = await req.json();
    const { action = 'CLAIM', employeeId: targetEmpId, workedDate, creditDays = 1.0, reason } = body;

    const employeeId = targetEmpId || session.employeeId;
    if (!employeeId || !workedDate || !reason) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Employee ID, worked date, and reason are required' },
        },
        { status: 400 }
      );
    }

    const isManagerOrAdmin =
      session.role === 'SUPER_ADMIN' ||
      session.role === 'HR_ADMIN' ||
      session.role === 'MANAGER' ||
      hasPermission(session, 'leaves:approve');

    const claimsCol = await compOffClaimsCol();
    const attCol = await attendanceEventsCol();
    const holidayCol = await holidaysCol();
    const ltCol = await leaveTypesCol();
    const lbCol = await leaveBalancesCol();
    const alCol = await leaveAccrualLogsCol();

    // 1. Verify Date is a Weekend (Sat/Sun) or Public Holiday
    const workedDateObj = new Date(workedDate);
    const dayOfWeek = workedDateObj.getUTCDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const workedDateStart = new Date(`${workedDate}T00:00:00.000Z`);
    const workedDateEnd = new Date(`${workedDate}T23:59:59.999Z`);
    const isPublicHoliday = await holidayCol.findOne({
      date: { $gte: workedDateStart, $lte: workedDateEnd },
    });

    if (!isWeekend && !isPublicHoliday && !isManagerOrAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_ELIGIBLE_DAY',
            message: `The selected date (${workedDate}) is a regular working day. Comp-Off can only be earned on declared weekends (Saturday/Sunday) or public holidays.`,
          },
        },
        { status: 400 }
      );
    }

    // 2. Check Biometric Punch Verification
    const recordedEvents = await attCol
      .find({
        employeeId,
        timestamp: { $gte: workedDateStart, $lte: workedDateEnd },
      })
      .sort({ timestamp: 1 })
      .toArray();

    const punchCount = recordedEvents.length;
    let punchIn: string | null = null;
    let punchOut: string | null = null;
    let verifiedBiometric = false;

    if (punchCount > 0) {
      verifiedBiometric = true;
      punchIn = format(new Date(recordedEvents[0].timestamp), 'HH:mm');
      punchOut = format(new Date(recordedEvents[punchCount - 1].timestamp), 'HH:mm');
    }

    // 3. Find or Ensure COMP_OFF Leave Type
    let compOffType = await ltCol.findOne({ code: 'COMP_OFF' });
    if (!compOffType) {
      const newTypeId = 'lt_compoff';
      await ltCol.updateOne(
        { code: 'COMP_OFF' },
        {
          $set: {
            id: newTypeId,
            name: 'Compensatory Off',
            code: 'COMP_OFF',
            category: 'Compensatory',
            daysPerYear: 0,
            accrualFrequency: 'ON_DEMAND',
            isPaid: true,
            colorHex: '#F59E0B',
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
      compOffType = await ltCol.findOne({ code: 'COMP_OFF' });
    }

    const claimId = generateId();
    const now = new Date();
    const daysToCredit = Number(creditDays) || 1.0;
    const expiryDate = new Date(workedDateObj.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days validity

    // 4. Handle Direct Grant by Admin/Manager vs Employee Claim
    if (action === 'GRANT' && isManagerOrAdmin) {
      // Direct Admin Grant -> Immediate Credit
      await lbCol.updateOne(
        { employeeId, leaveTypeId: compOffType!.id, year: 2026 },
        {
          $inc: { balance: daysToCredit, earned: daysToCredit },
          $set: { updatedAt: now },
          $setOnInsert: { id: generateId(), used: 0, pending: 0, createdAt: now },
        },
        { upsert: true }
      );

      await alCol.insertOne({
        id: generateId(),
        employeeId,
        leaveTypeId: compOffType!.id,
        amount: daysToCredit,
        accrualDate: now,
        notes: `Comp-Off granted for working on ${workedDate} (${isWeekend ? 'Weekend' : 'Holiday'}). Verified biometric punches: ${punchCount}.`,
        createdAt: now,
      });

      await claimsCol.insertOne({
        id: claimId,
        employeeId,
        workedDate,
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
        isWeekend,
        isPublicHoliday: Boolean(isPublicHoliday),
        biometricPunchesFound: punchCount,
        punchIn,
        punchOut,
        verifiedBiometric,
        creditDays: daysToCredit,
        reason,
        status: 'APPROVED',
        approvedBy: session.userId || session.name,
        approvedAt: now,
        expiryDate,
        createdAt: now,
        updatedAt: now,
      });

      return NextResponse.json({
        success: true,
        data: { claimId, status: 'APPROVED', creditedDays: daysToCredit },
        message: `Successfully granted ${daysToCredit} Comp-Off day(s) to employee. Leave balance has been credited immediately.`,
      });
    }

    // 5. Employee Claim Submission -> Queued for Manager Approval
    await claimsCol.insertOne({
      id: claimId,
      employeeId,
      workedDate,
      dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
      isWeekend,
      isPublicHoliday: Boolean(isPublicHoliday),
      biometricPunchesFound: punchCount,
      punchIn,
      punchOut,
      verifiedBiometric,
      creditDays: daysToCredit,
      reason,
      status: 'PENDING',
      expiryDate,
      createdAt: now,
      updatedAt: now,
    });

    const punchMsg = verifiedBiometric
      ? `Biometric punches verified (${punchIn} to ${punchOut}).`
      : 'Note: No biometric punches detected for this date — supervisor manual verification will be required.';

    return NextResponse.json({
      success: true,
      data: { claimId, status: 'PENDING', verifiedBiometric },
      message: `Compensatory Off claim for ${workedDate} submitted. ${punchMsg} Balance will be credited upon manager approval.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'CLAIM_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
