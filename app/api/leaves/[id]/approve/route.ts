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
    const approvedById = session?.userId || 'system_admin';
    const approverName = session?.name || session?.userId || 'Super Admin';
    const approverRole = session?.role || 'SUPER_ADMIN';
    const result = await processLeaveApproval(id, approvedById, 'APPROVED', undefined, approverName, approverRole);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Leave request approved successfully. Leave days will be deducted on the leave date if no attendance punch is detected.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ACTION_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
