import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { leaveRequestsCol, attendanceRegularizationsCol, getMongoDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const isApprover =
      session.role === 'SUPER_ADMIN' ||
      session.role === 'HR_ADMIN' ||
      session.role === 'MANAGER';

    const filter: Record<string, any> = { status: 'PENDING' };
    if (!isApprover) {
      // Regular employee: count their own pending requests awaiting decision
      if (!session.employeeId) {
        return NextResponse.json({ success: true, count: 0 });
      }
      filter.employeeId = session.employeeId;
    }

    const lrCol = await leaveRequestsCol();
    const arCol = await attendanceRegularizationsCol();
    const db = await getMongoDb();
    const pdrCol = db.collection('payslip_download_requests');

    const [pendingLeaves, pendingRegs, pendingPayslips] = await Promise.all([
      lrCol.countDocuments(filter),
      arCol.countDocuments(filter),
      pdrCol.countDocuments(filter),
    ]);

    const totalPending = pendingLeaves + pendingRegs + pendingPayslips;

    return NextResponse.json({
      success: true,
      count: totalPending,
      breakdown: {
        leaves: pendingLeaves,
        regularizations: pendingRegs,
        payslips: pendingPayslips,
      },
    });
  } catch (err: any) {
    console.error('[API /api/approvals/count] Error:', err);
    return NextResponse.json({ success: true, count: 0 });
  }
}
