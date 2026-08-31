import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { decodeVerifyMode } from '@/server/secureye/native-bridge';
import {
  devicesCol,
  employeesCol,
  attendanceEventsCol,
  generateId,
} from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

/**
 * CLOUD SYNC RECEIVER (Vercel & MongoDB Atlas Compatible)
 * Receives pulled attendance logs from Desktop Sync Bridge (Windows/macOS)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deviceId = 'SFB3K_MAIN', deviceIp = '192.168.1.201', punches = [] } = body;

    if (!Array.isArray(punches)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'punches must be an array' } },
        { status: 400 }
      );
    }

    const devices = await devicesCol();
    const employees = await employeesCol();
    const attendanceEvents = await attendanceEventsCol();

    // 1. Ensure Device record exists
    let device = await devices.findOne({ $or: [{ deviceId }, { id: deviceId }] });
    const now = new Date();

    if (!device) {
      const devId = generateId();
      const newDev = {
        id: devId,
        name: `Secureye Terminal (${deviceIp})`,
        ipAddress: deviceIp,
        port: 5005,
        deviceId,
        protocol: 'Secureye/FKWeb',
        status: 'ONLINE',
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      };
      await devices.insertOne(newDev);
      device = newDev;
    } else {
      await devices.updateOne(
        { _id: device._id },
        { $set: { status: 'ONLINE', lastSeenAt: now, updatedAt: now } }
      );
    }

    let insertedCount = 0;
    let skippedCount = 0;

    for (const punch of punches) {
      if (!punch.userId || !punch.timestamp) continue;

      const uId = String(punch.userId);
      const punchDate = new Date(punch.timestamp);
      const timestampIso = isNaN(punchDate.getTime()) ? punch.timestamp : punchDate.toISOString();

      // Find or create employee
      let emp = await employees.findOne({
        $or: [{ deviceUserId: uId }, { employeeCode: `EMP-${uId}` }],
      });

      if (!emp) {
        const empId = generateId();
        const empName = punch.name || `Employee ${uId}`;
        const newEmp = {
          id: empId,
          deviceId: device.id || deviceId,
          name: empName,
          employeeCode: `EMP-${uId}`,
          deviceUserId: uId,
          department: 'Operations',
          designation: 'Staff Member',
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        };
        await employees.insertOne(newEmp);
        emp = newEmp;
      }

      // Check for duplicate punch
      const existing = await attendanceEvents.findOne({
        deviceId: device.id || deviceId,
        deviceUserId: uId,
        timestamp: timestampIso,
      });

      if (existing) {
        skippedCount++;
      } else {
        const { eventType, verificationType } = decodeVerifyMode(punch.verifyMode || 1);
        const eventId = generateId();

        await attendanceEvents.insertOne({
          id: eventId,
          deviceId: device.id || deviceId,
          employeeId: emp.id || emp._id?.toString(),
          deviceUserId: uId,
          timestamp: timestampIso,
          eventType: punch.eventType || eventType,
          verificationType: punch.verificationType || verificationType,
          source: 'DESKTOP_BRIDGE_SYNC',
          rawPayload: JSON.stringify(punch),
          createdAt: now,
        });
        insertedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sync successful! Processed ${punches.length} records (${insertedCount} new, ${skippedCount} existing).`,
      data: {
        totalReceived: punches.length,
        insertedCount,
        skippedCount,
        deviceId: device.id || deviceId,
        syncedAt: now.toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[SYNC_PUSH_ERROR]', err);
    return NextResponse.json(
      { success: false, error: { code: 'SYNC_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
