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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to approve leaves' } },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const approvedById = session?.name || session?.userId || 'system_admin';
    const result = await processLeaveApproval(id, approvedById, 'APPROVED');

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Leave request approved successfully and balances updated.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ACTION_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
