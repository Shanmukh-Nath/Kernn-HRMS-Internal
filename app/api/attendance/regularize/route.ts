import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { format } from 'date-fns';
import {
  attendanceRegularizationsCol,
  attendanceEventsCol,
  employeesCol,
  generateId,
} from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const regCol = await attendanceRegularizationsCol();
    const empCol = await employeesCol();

    const isManagerOrAdmin =
      session.role === 'SUPER_ADMIN' ||
      session.role === 'HR_ADMIN' ||
      session.role === 'MANAGER' ||
      hasPermission(session, 'attendance:approve_regularization');

    const filter: Record<string, any> = {};
    if (!isManagerOrAdmin) {
      filter.employeeId = session.employeeId;
    }

    const requests = await regCol.find(filter).sort({ createdAt: -1 }).limit(100).toArray();
    const emps = await empCol.find({}).toArray();
    const empMap = new Map(emps.map((e) => [e.id, e]));

    const enriched = requests.map((ar) => {
      const e = empMap.get(ar.employeeId);
      return {
        ...ar,
        id: ar.id || ar._id?.toString(),
        employeeName: e?.name || 'Employee',
        employeeCode: e?.employeeCode || '',
        department: e?.department || '',
        designation: e?.designation || '',
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
    if (!session || !session.employeeId) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const body = await req.json();
    const { date, requestedCheckIn, requestedCheckOut, reason, adjustmentType } = body;

    if (!date || (!requestedCheckIn && !requestedCheckOut) || !reason) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Date, at least one adjusted time (Check-in or Check-out), and reason are required' },
        },
        { status: 400 }
      );
    }

    const regCol = await attendanceRegularizationsCol();
    const attCol = await attendanceEventsCol();

    const targetDayStart = new Date(`${date}T00:00:00+05:30`);
    const targetDayEnd = new Date(`${date}T23:59:59.999+05:30`);

    const recordedEvents = await attCol
      .find({
        employeeId: session.employeeId,
        timestamp: { $gte: targetDayStart, $lte: targetDayEnd },
      })
      .sort({ timestamp: 1 })
      .toArray();

    const recordedCheckIn =
      recordedEvents.length > 0 ? format(new Date(recordedEvents[0].timestamp), 'HH:mm') : null;
    const recordedCheckOut =
      recordedEvents.length > 1
        ? format(new Date(recordedEvents[recordedEvents.length - 1].timestamp), 'HH:mm')
        : null;

    const id = generateId();
    const now = new Date();

    const doc = {
      id,
      employeeId: session.employeeId,
      date,
      adjustmentType: adjustmentType || (requestedCheckIn && requestedCheckOut ? 'BOTH' : requestedCheckIn ? 'CHECK_IN' : 'CHECK_OUT'),
      recordedCheckIn,
      recordedCheckOut,
      requestedCheckIn: requestedCheckIn || null,
      requestedCheckOut: requestedCheckOut || null,
      reason,
      status: 'PENDING',
      createdAt: now,
    };

    await regCol.insertOne(doc);

    return NextResponse.json({
      success: true,
      message: 'Attendance correction request submitted to your reporting manager for approval.',
      data: { id, date, requestedCheckIn, requestedCheckOut },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'CREATE_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (
      !session ||
      (!hasPermission(session, 'attendance:approve_regularization') &&
        session.role !== 'MANAGER' &&
        session.role !== 'SUPER_ADMIN' &&
        session.role !== 'HR_ADMIN')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have permission to approve attendance corrections' },
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, action, rejectionReason } = body;

    if (!id || !action) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT' } }, { status: 400 });
    }

    const regCol = await attendanceRegularizationsCol();
    const attCol = await attendanceEventsCol();

    const request = await regCol.findOne({ $or: [{ id }, { _id: id }] });
    if (!request) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    }

    const now = new Date();

    if (action === 'APPROVE') {
      await regCol.updateOne(
        { $or: [{ id }, { _id: id }] },
        {
          $set: {
            status: 'APPROVED',
            reviewedBy: session.name || 'SUPERVISOR',
            reviewedAt: now,
          },
        }
      );

      // Create proper IST timestamps for the punches
      if (request.requestedCheckIn) {
        const checkInDateTime = new Date(`${request.date}T${request.requestedCheckIn}:00+05:30`);
        await attCol.insertOne({
          id: generateId(),
          deviceId: 'default_device',
          employeeId: request.employeeId,
          timestamp: checkInDateTime,
          eventType: 'CHECK_IN',
          verificationType: 'REGULARIZED_BY_MANAGER',
          verificationMode: 'REGULARIZED_BY_MANAGER',
          rawPayload: `Regularized by ${session.name}: ${request.reason}`,
          createdAt: now,
        });
      }

      if (request.requestedCheckOut) {
        const checkOutDateTime = new Date(`${request.date}T${request.requestedCheckOut}:00+05:30`);
        await attCol.insertOne({
          id: generateId(),
          deviceId: 'default_device',
          employeeId: request.employeeId,
          timestamp: checkOutDateTime,
          eventType: 'CHECK_OUT',
          verificationType: 'REGULARIZED_BY_MANAGER',
          verificationMode: 'REGULARIZED_BY_MANAGER',
          rawPayload: `Regularized by ${session.name}: ${request.reason}`,
          createdAt: now,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Attendance correction approved and punch record updated.',
      });
    } else {
      await regCol.updateOne(
        { $or: [{ id }, { _id: id }] },
        {
          $set: {
            status: 'REJECTED',
            rejectionReason: rejectionReason || 'Declined by supervisor',
            reviewedBy: session.name || 'SUPERVISOR',
            reviewedAt: now,
          },
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Attendance correction rejected.',
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ACTION_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
