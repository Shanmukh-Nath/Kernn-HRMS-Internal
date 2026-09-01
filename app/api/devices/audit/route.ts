import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession, hasPermission } from '@/lib/auth';
import { hardwareAuditLogsCol, generateId } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

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
      return { category: 'DELETION', description: 'Deleted RFID Smart Card' };
    case 11:
      return { category: 'DELETION', description: 'Deleted Face Recognition Profile' };
    case 12:
      return { category: 'MEMORY_WIPE', description: 'Cleared All Attendance Records from EEPROM' };
    case 13:
      return { category: 'MEMORY_WIPE', description: 'Cleared All User Profiles from EEPROM' };
    case 14:
      return { category: 'CONFIG_CHANGE', description: 'Restored Device to Factory Defaults' };
    case 15:
      return { category: 'TIME_SYNC', description: 'Updated Real-Time Clock (RTC) / NTP Time' };
    default:
      return { category: 'SYSTEM_OP', description: `Terminal Hardware Operation (Code 0x${code.toString(16).toUpperCase()})` };
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const adminUserId = searchParams.get('adminUserId');
    const actionCategory = searchParams.get('actionCategory');
    const search = searchParams.get('search');
    const format = searchParams.get('format');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '25', 10)));

    const auditCol = await hardwareAuditLogsCol();
    const filter: Record<string, any> = {};

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = `${startDate} 00:00:00`;
      if (endDate) filter.timestamp.$lte = `${endDate} 23:59:59`;
    }

    if (adminUserId && adminUserId !== 'ALL') {
      filter.adminUserId = adminUserId;
    }

    if (actionCategory && actionCategory !== 'ALL') {
      filter.actionCategory = actionCategory;
    }

    if (search) {
      const reg = new RegExp(search, 'i');
      filter.$or = [
        { adminName: reg },
        { actionDescription: reg },
        { targetName: reg },
        { timestamp: reg },
      ];
    }

    // CSV Export
    if (format === 'csv') {
      const allRows = await auditCol.find(filter).sort({ timestamp: -1 }).toArray();
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

    const total = await auditCol.countDocuments(filter);
    const offset = (page - 1) * limit;
    const rows = await auditCol.find(filter).sort({ timestamp: -1 }).skip(offset).limit(limit).toArray();

    // KPI Metrics across whole collection
    const [allLogs, distinctAdmins] = await Promise.all([
      auditCol.find({}, { projection: { actionCategory: 1 } }).toArray(),
      auditCol.distinct('adminUserId'),
    ]);

    let enrollments = 0, configChanges = 0, deletionWipes = 0, menuLogins = 0;
    for (const l of allLogs) {
      if (l.actionCategory === 'ENROLLMENT') enrollments++;
      else if (['CONFIG_CHANGE', 'TIME_SYNC'].includes(l.actionCategory)) configChanges++;
      else if (['DELETION', 'MEMORY_WIPE'].includes(l.actionCategory)) deletionWipes++;
      else if (l.actionCategory === 'MENU_ACCESS') menuLogins++;
    }

    const adminDocs = await auditCol.aggregate([
      { $group: { _id: '$adminUserId', adminName: { $first: '$adminName' } } },
      { $project: { adminUserId: '$_id', adminName: 1, _id: 0 } },
      { $sort: { adminName: 1 } },
    ]).toArray();

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
          totalOperations: allLogs.length,
          enrollments,
          configChanges,
          deletionWipes,
          menuLogins,
        },
        admins: adminDocs,
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

    const auditCol = await hardwareAuditLogsCol();
    const empCol = await employeesCol();
    const allEmps = await empCol.find({}).toArray();
    const usersMap: Record<string, string> = {};
    for (const emp of allEmps) {
      if (emp.deviceUserId && emp.name) {
        usersMap[String(emp.deviceUserId)] = emp.name;
      }
    }

    let count = 0;
    const now = new Date();

    for (const log of sLogs) {
      if (!log.adminId || !log.timestamp) continue;
      const cat = categorizeAction(log.actionCode || 1);
      const adminName = usersMap[String(log.adminId)] || `Admin ${log.adminId}`;
      const logId = generateId();

      try {
        await auditCol.insertOne({
          id: logId,
          deviceId,
          adminUserId: String(log.adminId),
          adminName,
          actionCode: log.actionCode || 1,
          actionCategory: cat.category,
          actionDescription: cat.description,
          targetUserId: log.targetUserId || null,
          targetName: log.targetName || null,
          timestamp: log.timestamp,
          rawPayload: JSON.stringify(log),
          createdAt: now,
        });
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
