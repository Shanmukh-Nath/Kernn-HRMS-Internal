import dns from 'node:dns';
import { MongoClient, Db, Collection } from 'mongodb';

// Ensure DNS resolution handles SRV records properly on Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore in environments where custom DNS cannot be set
}

const DIRECT_URI = 'mongodb://shanmukh733_db_user:AnI6iW5d3bdIsaSV@ac-grloq8u-shard-00-00.baj7suy.mongodb.net:27017,ac-grloq8u-shard-00-01.baj7suy.mongodb.net:27017,ac-grloq8u-shard-00-02.baj7suy.mongodb.net:27017/secureye_hrms?ssl=true&authSource=admin&retryWrites=true&w=majority&appName=HRMSProd';

const uri = process.env.MONGODB_URI || process.env.DATABASE_URL || DIRECT_URI;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _mongoClientInstance: MongoClient | undefined;
}

function createClient(): MongoClient {
  return new MongoClient(uri, {
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 15000,
  });
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    const client = createClient();
    global._mongoClientInstance = client;
    global._mongoClientPromise = client.connect().catch((err) => {
      // Clear cached promise on failure so next call retries fresh
      global._mongoClientPromise = undefined;
      throw err;
    });
  }
  return global._mongoClientPromise;
}

export async function getMongoDb(dbName = 'secureye_hrms'): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}

// Generate unique string ID compatible with existing cuid/id schema
export function generateId(): string {
  return 'c' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
}

// Typed Collection Accessors
export async function usersCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('users');
}

export async function employeesCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('employees');
}

export async function devicesCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('devices');
}

export async function attendanceEventsCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('attendance_events');
}

export async function attendanceRegularizationsCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('attendance_regularizations');
}

export async function leaveTypesCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('leave_types');
}

export async function leaveBalancesCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('leave_balances');
}

export async function leaveRequestsCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('leave_requests');
}

export async function holidaysCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('holidays');
}

export async function holidayClaimsCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('holiday_claims');
}

export async function payrollRecordsCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('payroll_records');
}

export async function announcementsCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('announcements');
}

export async function announcementAcksCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('announcement_acks');
}

export async function rolesCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('roles');
}

export async function permissionsCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('permissions');
}

export async function rolePermissionsCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('role_permissions');
}

export async function attendanceRulesCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('attendance_rules');
}

export async function deviceSyncsCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('device_syncs');
}

export async function deviceRequestLogsCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('device_request_logs');
}

export async function systemEventsCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('system_events');
}

export async function passkeysCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('passkey_credentials');
}

export async function salaryStructuresCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('salary_structures');
}

export async function salaryComponentsCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('salary_components');
}

export async function auditLogsCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('audit_logs');
}

export async function leaveAccrualLogsCol(): Promise<Collection<any>> {
  const db = await getMongoDb();
  return db.collection('leave_accrual_logs');
}

// Index Management
export async function ensureMongoIndices(): Promise<void> {
  try {
    const users = await usersCol();
    await users.createIndex({ id: 1 }, { unique: true });
    await users.createIndex({ mobileNumber: 1 }, { unique: true });
    await users.createIndex({ roleId: 1 });

    const employees = await employeesCol();
    await employees.createIndex({ id: 1 }, { unique: true });
    await employees.createIndex({ deviceId: 1, deviceUserId: 1 }, { unique: true });
    await employees.createIndex({ employeeCode: 1 });
    await employees.createIndex({ department: 1 });

    const devices = await devicesCol();
    await devices.createIndex({ id: 1 }, { unique: true });
    await devices.createIndex({ deviceId: 1 }, { unique: true });

    const attendance = await attendanceEventsCol();
    await attendance.createIndex({ id: 1 }, { unique: true });
    await attendance.createIndex(
      { deviceId: 1, deviceUserId: 1, timestamp: 1, eventType: 1 },
      { unique: true, sparse: true }
    );
    await attendance.createIndex({ timestamp: -1 });

    const roles = await rolesCol();
    await roles.createIndex({ id: 1 }, { unique: true });
    await roles.createIndex({ name: 1 }, { unique: true });

    const permissions = await permissionsCol();
    await permissions.createIndex({ id: 1 }, { unique: true });
    await permissions.createIndex({ slug: 1 }, { unique: true });

    const leaveBalances = await leaveBalancesCol();
    await leaveBalances.createIndex({ id: 1 }, { unique: true });
    await leaveBalances.createIndex({ employeeId: 1, leaveTypeId: 1, year: 1 }, { unique: true });

    const leaveTypes = await leaveTypesCol();
    await leaveTypes.createIndex({ id: 1 }, { unique: true });
    await leaveTypes.createIndex({ code: 1 }, { unique: true });

    const payroll = await payrollRecordsCol();
    await payroll.createIndex({ id: 1 }, { unique: true });
    await payroll.createIndex({ employeeId: 1, month: 1, year: 1 }, { unique: true });

    console.log('[MongoDB] Indices successfully ensured on Atlas cluster.');
  } catch (error) {
    console.error('[MongoDB] Index creation warning:', error);
  }
}
