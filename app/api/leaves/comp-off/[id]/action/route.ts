import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import {
  compOffClaimsCol,
  leaveBalancesCol,
  leaveTypesCol,
  leaveAccrualLogsCol,
  generateId,
} from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const isManagerOrAdmin =
      session.role === 'SUPER_ADMIN' ||
      session.role === 'HR_ADMIN' ||
      session.role === 'MANAGER' ||
      hasPermission(session, 'leaves:approve');

    if (!isManagerOrAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Manager or HR Admin privilege required' } },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await req.json();
    const { action, rejectionReason } = body;

    if (!action || !['APPROVED', 'REJECTED'].includes(action)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ACTION', message: 'Action must be APPROVED or REJECTED' } },
        { status: 400 }
      );
    }

    const claimsCol = await compOffClaimsCol();
    const ltCol = await leaveTypesCol();
    const lbCol = await leaveBalancesCol();
    const alCol = await leaveAccrualLogsCol();

    const claim = await claimsCol.findOne({ id });
    if (!claim || claim.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Claim not found or already processed' } },
        { status: 404 }
      );
    }

    const now = new Date();

    if (action === 'APPROVED') {
      const compOffType = await ltCol.findOne({ code: 'COMP_OFF' });
      const daysToCredit = Number(claim.creditDays) || 1.0;

      if (compOffType) {
        // Credit the employee's Comp-Off balance
        await lbCol.updateOne(
          { employeeId: claim.employeeId, leaveTypeId: compOffType.id },
          {
            $inc: { balance: daysToCredit, earned: daysToCredit },
            $set: { updatedAt: now },
            $setOnInsert: { id: generateId(), used: 0, pending: 0, year: now.getFullYear(), createdAt: now },
          },
          { upsert: true }
        );

        await alCol.insertOne({
          id: generateId(),
          employeeId: claim.employeeId,
          leaveTypeId: compOffType.id,
          amount: daysToCredit,
          creditedAmount: daysToCredit,
          accrualDate: now,
          notes: `Comp-Off approved by ${session.name || session.userId} for working on ${claim.workedDate} (${claim.dayOfWeek}).`,
          createdAt: now,
        });
      }

      await claimsCol.updateOne(
        { id },
        {
          $set: {
            status: 'APPROVED',
            approvedBy: session.name || session.userId,
            approvedAt: now,
            updatedAt: now,
          },
        }
      );

      return NextResponse.json({
        success: true,
        data: { id, status: 'APPROVED' },
        message: `Compensatory Off claim approved. Credited ${claim.creditDays} day(s) to employee leave balance.`,
      });
    }

    // REJECTED
    await claimsCol.updateOne(
      { id },
      {
        $set: {
          status: 'REJECTED',
          rejectedBy: session.name || session.userId,
          rejectionReason: rejectionReason || 'Claim rejected by manager',
          updatedAt: now,
        },
      }
    );

    return NextResponse.json({
      success: true,
      data: { id, status: 'REJECTED' },
      message: 'Compensatory Off claim has been rejected.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ACTION_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
