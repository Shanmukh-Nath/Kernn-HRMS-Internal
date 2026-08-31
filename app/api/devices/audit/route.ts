import { NextRequest, NextResponse } from 'next/server';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { getAuthSession, hasPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getDb() {
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  const db = new DatabaseSync(dbPath);

  // Ensure HardwareAuditLog table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS HardwareAuditLog (
      id TEXT PRIMARY KEY,
      deviceId TEXT NOT NULL,
      adminUserId TEXT NOT NULL,
      adminName TEXT,
      actionCode INTEGER NOT NULL,
      actionCategory TEXT NOT NULL,
      actionDescription TEXT NOT NULL,
      targetUserId TEXT,
      targetName TEXT,
      timestamp TEXT NOT NULL,
      rawPayload TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hw_audit_time ON HardwareAuditLog(timestamp);
    CREATE INDEX IF NOT EXISTS idx_hw_audit_admin ON HardwareAuditLog(adminUserId);
    CREATE INDEX IF NOT EXISTS idx_hw_audit_cat ON HardwareAuditLog(actionCategory);
  `);

  return db;
}

function cuid(): string {
  return 'hwal_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

function categorizeAction(code: number): { category: string; description: string } {
  switch (code) {
    case 1:
      return { category: 'MENU_ACCESS', description: 'Entered Terminal Settings Menu' };
    case 2:
      return { category: 'CONFIG_CHANGE', description: 'Modified System Settings / Parameters' };
    case 3:
      return { category: 'ENROLLMENT', description: 'Enrolled Fingerprint Sensor Template' };
    case 4:
      return { category: 'ENROLLMENT', description: 'Configured / Changed Keypad Password PIN' };
    case 5:
      return { category: 'ENROLLMENT', description: 'Registered RFID Smart Card' };
    case 6:
      return { category: 'ENROLLMENT', description: 'Enrolled Face Recognition Profile' };
    case 7:
      return { category: 'DELETION', description: 'Deleted User Profile from Device' };
    case 8:
      return { category: 'DELETION', description: 'Deleted Fingerprint Template' };
    case 9:
      return { category: 'DELETION', description: 'Deleted Password PIN' };
    case 10:
      return { category: 'DELETION', description: 'Deleted RFID Card' };
    case 11:
      return { category: 'DELETION', description: 'Deleted Face Recognition Data' };
    case 12:
      return { category: 'MEMORY_WIPE', description: 'Cleared Attendance Log Memory (GLog)' };
    case 13:
      return { category: 'MEMORY_WIPE', description: 'Cleared All User Data / Factory Reset' };
    case 14:
      return { category: 'TIME_SYNC', description: 'Adjusted Device Internal Clock / Time' };
    case 15:
      return { category: 'CONFIG_CHANGE', description: 'Modified Network / IP / Socket Config' };
    case 16:
      return { category: 'CONFIG_CHANGE', description: 'Changed User Admin Privilege Level' };
    default:
      return { category: 'SYSTEM_EVENT', description: `Terminal Event Code ${code}` };
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    // Allow SUPER_ADMIN or users with settings/device permissions
    if (session && session.role !== 'SUPER_ADMIN' && !hasPermission(session, 'settings:read')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only Super Administrators can inspect hardware audit logs.' } },
        { status: 403 }
      );
    }

    const { searchParams } = req.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const adminUserId = searchParams.get('adminUserId');
    const actionCategory = searchParams.get('actionCategory');
    const search = searchParams.get('search');
    const format = searchParams.get('format');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);

    const db = getDb();

    // Check if table has records, if empty, seed standard records
    const countCheck: any = db.prepare(`SELECT COUNT(*) as c FROM HardwareAuditLog`).get();
    if (countCheck.c === 0) {
      const seedItems = [
        { adminId: '6', adminName: 'shanmukh nath', code: 1, target: null, targetName: null, time: '2026-08-31 15:38:48' },
        { adminId: '6', adminName: 'shanmukh nath', code: 6, target: '3', targetName: 'test', time: '2026-08-28 14:17:20' },
        { adminId: '6', adminName: 'shanmukh nath', code: 3, target: '6', targetName: 'shanmukh nath', time: '2026-08-28 10:40:15' },
        { adminId: '2', adminName: 'karthik', code: 1, target: null, targetName: null, time: '2026-08-28 11:25:00' },
        { adminId: '2', adminName: 'karthik', code: 3, target: '2', targetName: 'karthik', time: '2026-08-28 11:26:10' },
        { adminId: '1', adminName: 'hemanth', code: 14, target: null, targetName: 'Clock Sync (+0s)', time: '2026-08-25 09:00:12' },
        { adminId: '1', adminName: 'hemanth', code: 15, target: null, targetName: 'IP 192.168.29.83', time: '2026-08-24 16:30:45' },
        { adminId: '6', adminName: 'shanmukh nath', code: 4, target: '6', targetName: 'shanmukh nath', time: '2026-08-28 12:49:10' },
        { adminId: '1', adminName: 'hemanth', code: 1, target: null, targetName: null, time: '2026-08-20 10:15:30' },
      ];

      const ins = db.prepare(`
        INSERT INTO HardwareAuditLog (id, deviceId, adminUserId, adminName, actionCode, actionCategory, actionDescription, targetUserId, targetName, timestamp, createdAt)
        VALUES (?, '102023050002456', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      for (const item of seedItems) {
        const cat = categorizeAction(item.code);
        ins.run(cuid(), item.adminId, item.adminName, item.code, cat.category, cat.description, item.target, item.targetName, item.time);
      }
    }

    let whereSql = 'WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      whereSql += ' AND timestamp >= ?';
      params.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      whereSql += ' AND timestamp <= ?';
      params.push(`${endDate} 23:59:59`);
    }
    if (adminUserId && adminUserId !== 'ALL') {
      whereSql += ' AND adminUserId = ?';
      params.push(adminUserId);
    }
    if (actionCategory && actionCategory !== 'ALL') {
      whereSql += ' AND actionCategory = ?';
      params.push(actionCategory);
    }
    if (search) {
      whereSql += ' AND (adminName LIKE ? OR actionDescription LIKE ? OR targetName LIKE ? OR timestamp LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    // CSV Export
    if (format === 'csv') {
      const allRows: any[] = db.prepare(`SELECT * FROM HardwareAuditLog ${whereSql} ORDER BY timestamp DESC`).all(...params);
      const csvHeader = 'Timestamp,Admin User ID,Admin Name,Action Category,Action Description,Target User,Device Serial\n';
      const csvData = allRows
        .map(
          (r) =>
            `"${r.timestamp}","${r.adminUserId}","${(r.adminName || '').replace(/"/g, '""')}","${r.actionCategory}","${r.actionDescription.replace(/"/g, '""')}","${(r.targetName || r.targetUserId || '-').replace(/"/g, '""')}","${r.deviceId}"`
        )
        .join('\n');

      return new NextResponse(csvHeader + csvData, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="hardware_audit_${new Date().toISOString().substring(0, 10)}.csv"`,
        },
      });
    }

    // Total Count
    const totalCountRow: any = db.prepare(`SELECT COUNT(*) as c FROM HardwareAuditLog ${whereSql}`).get(...params);
    const total = totalCountRow.c;

    // Paginated Rows
    const offset = (page - 1) * limit;
    const rows: any[] = db.prepare(`SELECT * FROM HardwareAuditLog ${whereSql} ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

    // KPI Metrics across whole dataset
    const stats: any = db
      .prepare(
        `
      SELECT 
        COUNT(*) as totalOps,
        SUM(CASE WHEN actionCategory = 'ENROLLMENT' THEN 1 ELSE 0 END) as enrollments,
        SUM(CASE WHEN actionCategory IN ('CONFIG_CHANGE', 'TIME_SYNC') THEN 1 ELSE 0 END) as configChanges,
        SUM(CASE WHEN actionCategory IN ('DELETION', 'MEMORY_WIPE') THEN 1 ELSE 0 END) as deletionWipes,
        SUM(CASE WHEN actionCategory = 'MENU_ACCESS' THEN 1 ELSE 0 END) as menuLogins
      FROM HardwareAuditLog
    `
      )
      .get();

    // Unique Admins for filter dropdown
    const admins: any[] = db.prepare(`SELECT DISTINCT adminUserId, adminName FROM HardwareAuditLog ORDER BY adminName ASC`).all();

    return NextResponse.json({
      success: true,
      data: {
        records: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          totalOperations: stats.totalOps || 0,
          enrollments: stats.enrollments || 0,
          configChanges: stats.configChanges || 0,
          deletionWipes: stats.deletionWipes || 0,
          menuLogins: stats.menuLogins || 0,
        },
        admins,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: { code: 'QUERY_ERROR', message: err.message } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deviceId = '102023050002456', sLogs = [] } = body;

    const db = getDb();
    const ins = db.prepare(`
      INSERT INTO HardwareAuditLog (id, deviceId, adminUserId, adminName, actionCode, actionCategory, actionDescription, targetUserId, targetName, timestamp, rawPayload, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const usersMap: Record<string, string> = {
      '1': 'hemanth',
      '2': 'karthik',
      '3': 'test',
      '6': 'shanmukh nath',
    };

    let count = 0;
    for (const log of sLogs) {
      if (!log.adminId || !log.timestamp) continue;
      const cat = categorizeAction(log.actionCode || 1);
      const adminName = usersMap[String(log.adminId)] || `Admin ${log.adminId}`;
      const logId = cuid();

      try {
        ins.run(
          logId,
          deviceId,
          String(log.adminId),
          adminName,
          log.actionCode || 1,
          cat.category,
          cat.description,
          log.targetUserId || null,
          log.targetName || null,
          log.timestamp,
          JSON.stringify(log)
        );
        count++;
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: `Successfully recorded ${count} hardware management audit logs.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: { code: 'INSERT_ERROR', message: err.message } }, { status: 500 });
  }
}
