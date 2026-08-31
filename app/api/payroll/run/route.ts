import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { POST as processBatchPayroll } from '@/app/api/payroll/route';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (session && !hasPermission(session, 'payroll:process') && session.role !== 'SUPER_ADMIN' && session.role !== 'HR_ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to run payroll' } },
        { status: 403 }
      );
    }

    return await processBatchPayroll(req);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'PAYROLL_RUN_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
