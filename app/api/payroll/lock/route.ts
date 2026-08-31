import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { payrollRecordsCol } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'HR_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Manager or Admin privileges required' } },
        { status: 403 }
      );
    }

    const { month, year } = await req.json();
    if (!month || !year) {
      return NextResponse.json({ success: false, error: 'Month and year are required' }, { status: 400 });
    }

    const prCol = await payrollRecordsCol();
    const now = new Date();

    const result = await prCol.updateMany(
      { month: Number(month), year: Number(year) },
      {
        $set: {
          status: 'APPROVED_LOCKED',
          approvedBy: session.name,
          approvedAt: now,
          updatedAt: now,
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: `Payroll for ${month}/${year} approved and locked successfully (${result.modifiedCount} records sealed).`,
      data: {
        status: 'APPROVED_LOCKED',
        approvedBy: session.name,
        approvedAt: now,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'LOCK_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only Super Admin can unlock a sealed payroll' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    if (!month || !year) {
      return NextResponse.json({ success: false, error: 'Month and year required' }, { status: 400 });
    }

    const prCol = await payrollRecordsCol();
    await prCol.updateMany(
      { month: Number(month), year: Number(year) },
      {
        $set: {
          status: 'DRAFT_PENDING_APPROVAL',
          approvedBy: null,
          approvedAt: null,
          auditNotes: 'Unlocked by Super Admin',
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: `Payroll for ${month}/${year} unlocked for editing.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'UNLOCK_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
