import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { parseAppDate } from '@/lib/timezone';
import { getMongoDb, generateId } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'You must be signed in to log attendance.' } },
        { status: 401 }
      );
    }

    const isSuperAdminOrHR =
      session.role === 'SUPER_ADMIN' ||
      session.role === 'HR_ADMIN' ||
      session.role === 'ADMIN';

    if (!isSuperAdminOrHR) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only Super Admin or HR can manually log attendance.' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { employeeId, date, time, eventType, verificationType, remarks } = body;

    if (!employeeId || !date || !time) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Employee, Date, and Time are required.' } },
        { status: 400 }
      );
    }

    // Lookup employee by id or employeeCode
    let employee = await prisma.employee.findFirst({
      where: {
        OR: [{ id: employeeId }, { employeeCode: employeeId }, { deviceUserId: employeeId }],
      },
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, error: { code: 'EMPLOYEE_NOT_FOUND', message: `Employee '${employeeId}' not found.` } },
        { status: 404 }
      );
    }

    // Lookup or fallback default device
    let device = await prisma.device.findFirst({
      where: { id: employee.deviceId || undefined },
    });

    if (!device) {
      device = await prisma.device.findFirst();
    }

    const deviceId = device?.id || '102023050002456';
    const deviceUserId = employee.deviceUserId || employee.employeeCode || '1';

    // Normalize timestamp in Indian Standard Time (IST, UTC+05:30)
    const timeFormatted = time.length === 5 ? `${time}:00` : time;
    const timestamp = parseAppDate(`${date}T${timeFormatted}`);

    if (isNaN(timestamp.getTime())) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DATE', message: 'Invalid Date or Time format.' } },
        { status: 400 }
      );
    }

    const finalEventType = eventType || 'CHECK_IN';
    const finalVerType = verificationType || 'MANUAL_OVERRIDE';

    // Create or Upsert the Attendance Event
    const event = await prisma.attendanceEvent.upsert({
      where: {
        deviceId_deviceUserId_timestamp_eventType: {
          deviceId,
          deviceUserId,
          timestamp,
          eventType: finalEventType,
        },
      },
      update: {
        verificationType: finalVerType,
        source: 'MANUAL_ENTRY',
        rawPayload: JSON.stringify({
          manualLoggedBy: session.name || session.mobileNumber,
          loggedById: session.userId,
          role: session.role,
          remarks: remarks || 'Super Admin manual attendance override',
          loggedAt: new Date().toISOString(),
        }),
      },
      create: {
        deviceId,
        employeeId: employee.id,
        deviceUserId,
        timestamp,
        eventType: finalEventType,
        verificationType: finalVerType,
        source: 'MANUAL_ENTRY',
        rawPayload: JSON.stringify({
          manualLoggedBy: session.name || session.mobileNumber,
          loggedById: session.userId,
          role: session.role,
          remarks: remarks || 'Super Admin manual attendance override',
          loggedAt: new Date().toISOString(),
        }),
      },
      include: {
        employee: { select: { name: true, employeeCode: true } },
        device: { select: { name: true, deviceId: true } },
      },
    });

    // Record immutable audit trail
    try {
      const db = await getMongoDb();
      await db.collection('audit_logs').insertOne({
        id: generateId(),
        action: 'MANUAL_ATTENDANCE_LOG',
        userId: session.userId,
        userName: session.name,
        role: session.role,
        targetEmployeeId: employee.id,
        targetEmployeeName: employee.name,
        timestamp: new Date(),
        details: {
          date,
          time: timeFormatted,
          eventType: finalEventType,
          verificationType: finalVerType,
          remarks: remarks || 'Manual entry',
        },
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: `Manual attendance successfully logged for ${employee.name} (${date} ${timeFormatted}).`,
      data: event,
    });
  } catch (err: any) {
    console.error('Manual attendance error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'MANUAL_LOG_FAILED', message: err.message || 'Failed to log manual attendance.' } },
      { status: 500 }
    );
  }
}
