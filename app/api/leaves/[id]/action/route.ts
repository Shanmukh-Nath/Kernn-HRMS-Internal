import { NextRequest, NextResponse } from 'next/server';
import { processLeaveApproval } from '@/lib/db';
import { getAuthSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (session && !hasPermission(session, 'leaves:approve')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to approve/reject leaves' } },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await req.json();
    const action = body.action as 'APPROVED' | 'REJECTED';
    const reason = body.rejectionReason;

    if (!action || !['APPROVED', 'REJECTED'].includes(action)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ACTION', message: 'Action must be APPROVED or REJECTED' } },
        { status: 400 }
      );
    }

    const approvedById = session?.userId || 'system_admin';
    const result = await processLeaveApproval(id, approvedById, action, reason);

    return NextResponse.json({
      success: true,
      data: result,
      message: `Leave request ${action.toLowerCase()} successfully`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ACTION_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
