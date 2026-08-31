import { NextRequest, NextResponse } from 'next/server';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { getAuthSession } from '@/lib/auth';
import { decodeVerifyMode } from '@/server/secureye/native-bridge';

export const dynamic = 'force-dynamic';

function getDb() {
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  return new DatabaseSync(dbPath);
}

function cuid(): string {
  return 'c' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
}

/**
 * CLOUD SYNC RECEIVER (Vercel & Cloud Compatible)
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

    const db = getDb();

    // 1. Ensure Device record exists
    let device: any = db.prepare(`SELECT id, name FROM Device WHERE deviceId = ? OR id = ?`).get(deviceId, deviceId);
    if (!device) {
      const devId = cuid();
      db.prepare(`
        INSERT INTO Device (id, name, ipAddress, port, deviceId, protocol, status, lastSeenAt, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
      `).run(devId, `Secureye Terminal (${deviceIp})`, deviceIp, 5005, deviceId, 'Secureye/FKWeb', 'ONLINE');
      device = { id: devId, name: `Secureye Terminal (${deviceIp})` };
    } else {
      db.prepare(`UPDATE Device SET status = 'ONLINE', lastSeenAt = datetime('now') WHERE id = ?`).run(device.id);
    }

    let insertedCount = 0;
    let skippedCount = 0;

    const checkStmt = db.prepare(`
      SELECT id FROM AttendanceEvent 
      WHERE deviceId = ? AND deviceUserId = ? AND timestamp = ?
    `);

    const insertStmt = db.prepare(`
      INSERT INTO AttendanceEvent (id, deviceId, employeeId, deviceUserId, timestamp, eventType, verificationType, source, rawPayload, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const findEmpStmt = db.prepare(`SELECT id, name FROM Employee WHERE deviceUserId = ? OR employeeCode = ?`);
    const createEmpStmt = db.prepare(`
      INSERT INTO Employee (id, deviceId, name, employeeCode, deviceUserId, department, designation, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 'Operations', 'Staff Member', 'ACTIVE', datetime('now'), datetime('now'))
    `);

    for (const punch of punches) {
      if (!punch.userId || !punch.timestamp) continue;

      const uId = String(punch.userId);
      const timestampIso = new Date(punch.timestamp).toISOString();

      // Find or create employee
      let emp: any = findEmpStmt.get(uId, `EMP-${uId}`);
      if (!emp) {
        const empId = cuid();
        const empName = punch.name || `Employee ${uId}`;
        try {
          createEmpStmt.run(empId, device.id, empName, `EMP-${uId}`, uId);
          emp = { id: empId, name: empName };
        } catch (e: any) {
          // If already exists under another deviceId
          emp = db.prepare(`SELECT id, name FROM Employee WHERE deviceUserId = ?`).get(uId);
        }
      }

      // Check for duplicate punch
      const existing = checkStmt.get(device.id, uId, timestampIso);
      if (existing) {
        skippedCount++;
      } else {
        const { eventType, verificationType } = decodeVerifyMode(punch.verifyMode || 1);
        const eventId = cuid();

        insertStmt.run(
          eventId,
          device.id,
          emp.id,
          uId,
          timestampIso,
          punch.eventType || eventType,
          punch.verificationType || verificationType,
          'DESKTOP_BRIDGE_SYNC',
          JSON.stringify(punch)
        );
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
        deviceId: device.id,
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SYNC_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
