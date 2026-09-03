import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { getMongoDb, employeesCol, generateId } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

    const db = await getMongoDb();
    const pdrCol = db.collection('payslip_download_requests');
    const empCol = await employeesCol();

    const isApprover =
      session.role === 'SUPER_ADMIN' ||
      session.role === 'HR_ADMIN' ||
      session.role === 'MANAGER' ||
      hasPermission(session, 'payslip:approve_download');

    const filter: Record<string, any> = {};
    if (!isApprover) {
      filter.employeeId = session.employeeId;
    }

    const requests = await pdrCol.find(filter).sort({ requestedAt: -1 }).limit(100).toArray();
    const employees = await empCol.find({}).toArray();
    const empMap = new Map(employees.map((e) => [e.id, e]));

    const enriched = requests.map((r) => {
      const e = empMap.get(r.employeeId);
      return {
        ...r,
        id: r.id || r._id?.toString(),
        employeeName: e?.name || 'Employee',
        employeeCode: e?.employeeCode || '',
        department: e?.department || '',
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: { code: 'FETCH_FAILED', message: err.message } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || !session.employeeId) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { month, year } = body;

    // Super Admin & HR Admins are pre-authorized with zero approval requirement
    if (session.role === 'SUPER_ADMIN' || session.role === 'HR_ADMIN' || session.role === 'ADMIN') {
      return NextResponse.json({
        success: true,
        message: 'Super Admin direct download authorized.',
        data: { status: 'APPROVED' },
      });
    }

    if (!month || !year) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Month and year are required' } }, { status: 400 });
    }

    const db = await getMongoDb();
    const pdrCol = db.collection('payslip_download_requests');

    const existing = await pdrCol.findOne({
      employeeId: session.employeeId,
      month: Number(month),
      year: Number(year),
    });

    if (existing && existing.status === 'APPROVED') {
      return NextResponse.json({
        success: true,
        message: 'Download already authorized for this payslip.',
        data: existing,
      });
    }

    if (existing && existing.status === 'PENDING') {
      return NextResponse.json({
        success: true,
        message: 'Download request is already awaiting manager approval.',
        data: existing,
      });
    }

    const id = generateId();
    const now = new Date();

    const doc = {
      id,
      employeeId: session.employeeId,
      month: Number(month),
      year: Number(year),
      status: 'PENDING',
      requestedAt: now,
    };

    await pdrCol.insertOne(doc);

    return NextResponse.json({
      success: true,
      message: 'Payslip download request submitted to your supervisor.',
      data: { id, status: 'PENDING' },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: { code: 'REQUEST_FAILED', message: err.message } }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (
      !session ||
      (!hasPermission(session, 'payslip:approve_download') &&
        session.role !== 'MANAGER' &&
        session.role !== 'SUPER_ADMIN' &&
        session.role !== 'HR_ADMIN')
    ) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
    }

    const { id, action, rejectionReason } = await req.json();
    const db = await getMongoDb();
    const pdrCol = db.collection('payslip_download_requests');
    const now = new Date();

    const approverName = session.name || session.userId || 'Supervisor';
    const approverRole = session.role || 'SUPER_ADMIN';

    if (action === 'APPROVE') {
      await pdrCol.updateOne(
        { $or: [{ id }, { _id: id }] },
        {
          $set: {
            status: 'APPROVED',
            reviewedBy: approverName,
            reviewedByName: approverName,
            reviewedByRole: approverRole,
            reviewedAt: now,
            updatedAt: now,
          },
        }
      );

      return NextResponse.json({ success: true, message: 'Payslip download authorization granted.' });
    } else if (action === 'REVERT' || action === 'PENDING') {
      await pdrCol.updateOne(
        { $or: [{ id }, { _id: id }] },
        {
          $set: {
            status: 'PENDING',
            reviewedBy: approverName,
            reviewedByName: approverName,
            reviewedByRole: approverRole,
            rejectionReason: null,
            reviewedAt: now,
            updatedAt: now,
          },
        }
      );

      return NextResponse.json({ success: true, message: 'Payslip authorization reverted back to Pending.' });
    } else {
      await pdrCol.updateOne(
        { $or: [{ id }, { _id: id }] },
        {
          $set: {
            status: 'REJECTED',
            rejectionReason: rejectionReason || 'Declined by supervisor',
            reviewedBy: approverName,
            reviewedByName: approverName,
            reviewedByRole: approverRole,
            reviewedAt: now,
            updatedAt: now,
          },
        }
      );

      return NextResponse.json({ success: true, message: 'Payslip download request declined.' });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: { code: 'ACTION_FAILED', message: err.message } }, { status: 500 });
  }
}
