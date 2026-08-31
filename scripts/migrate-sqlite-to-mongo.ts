import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { getMongoDb, ensureMongoIndices } from '../lib/mongodb';

const TABLE_COLLECTION_MAP: Record<string, string> = {
  User: 'users',
  Employee: 'employees',
  Device: 'devices',
  AttendanceEvent: 'attendance_events',
  AttendanceRegularization: 'attendance_regularizations',
  LeaveType: 'leave_types',
  LeaveBalance: 'leave_balances',
  LeaveRequest: 'leave_requests',
  Holiday: 'holidays',
  PayrollRecord: 'payroll_records',
  Announcement: 'announcements',
  AttendanceRule: 'attendance_rules',
  DeviceSync: 'device_syncs',
  DeviceRequestLog: 'device_request_logs',
  SystemEvent: 'system_events',
  PasskeyCredential: 'passkey_credentials',
  Role: 'roles',
  Permission: 'permissions',
  RolePermission: 'role_permissions',
  SalaryStructure: 'salary_structures',
  SalaryComponent: 'salary_components',
  HolidayClaim: 'holiday_claims',
  AnnouncementAck: 'announcement_acks',
  AuditLog: 'audit_logs',
  LeaveAccrualLog: 'leave_accrual_logs',
  AttendanceCorrectionRequest: 'attendance_correction_requests',
  PayslipDownloadRequest: 'payslip_download_requests',
};

async function migrate() {
  const sqliteDbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  console.log(`[Migration] Reading from SQLite database at ${sqliteDbPath}...`);

  const sqlite = new DatabaseSync(sqliteDbPath);
  const mongoDb = await getMongoDb();

  console.log('[Migration] Ensuring MongoDB indices on Atlas...');
  await ensureMongoIndices();

  let totalMigrated = 0;

  for (const [tableName, colName] of Object.entries(TABLE_COLLECTION_MAP)) {
    try {
      const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all() as any[];
      if (!rows || rows.length === 0) {
        continue;
      }

      const collection = mongoDb.collection(colName);

      // Transform rows (ensure boolean / numbers / dates format properly if needed)
      const docs = rows.map((row) => {
        const doc: Record<string, any> = { ...row };
        // Ensure id is set
        if (!doc.id && doc.slug) doc.id = doc.slug;

        // Convert boolean fields stored as 0/1 in SQLite
        for (const [key, val] of Object.entries(doc)) {
          if (
            (key.startsWith('is') || key.endsWith('Enabled') || key.startsWith('has') || key === 'mustChangePassword') &&
            (val === 0 || val === 1)
          ) {
            doc[key] = Boolean(val);
          }
        }
        return doc;
      });

      // Upsert records into MongoDB
      for (const doc of docs) {
        if (doc.id) {
          await collection.updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
        } else {
          await collection.insertOne(doc);
        }
      }

      console.log(`[Migration] ${tableName} -> ${colName}: Migrated ${docs.length} documents.`);
      totalMigrated += docs.length;
    } catch (err: any) {
      console.warn(`[Migration] Skipped or errored on table ${tableName}:`, err.message);
    }
  }

  console.log(`[Migration] Successfully completed! Total migrated documents: ${totalMigrated}`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('[Migration] Failed:', err);
  process.exit(1);
});
