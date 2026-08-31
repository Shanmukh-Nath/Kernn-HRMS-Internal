import crypto from 'crypto';
import {
  ensureMongoIndices,
  rolesCol,
  permissionsCol,
  rolePermissionsCol,
  usersCol,
  devicesCol,
  employeesCol,
  attendanceEventsCol,
  leaveTypesCol,
  leaveBalancesCol,
  attendanceRulesCol,
  salaryStructuresCol,
  salaryComponentsCol,
  generateId,
} from '../lib/mongodb';

function hashPassword(password: string, customSalt?: string): string {
  const salt = customSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function seed() {
  console.log('[Seed] Starting MongoDB Atlas seed...');
  await ensureMongoIndices();

  // 1. Roles
  const roles = await rolesCol();
  const defaultRoles = [
    { id: 'role_super_admin', name: 'SUPER_ADMIN', description: 'Full system control', isSystem: true },
    { id: 'role_hr_admin', name: 'HR_ADMIN', description: 'HR Administration & Payroll management', isSystem: true },
    { id: 'role_manager', name: 'MANAGER', description: 'Department line manager', isSystem: true },
    { id: 'role_employee', name: 'EMPLOYEE', description: 'Standard employee portal access', isSystem: true },
  ];

  for (const r of defaultRoles) {
    await roles.updateOne({ name: r.name }, { $set: { ...r, updatedAt: new Date() } }, { upsert: true });
  }
  console.log('[Seed] Roles created/updated.');

  // 2. Permissions
  const permissions = await permissionsCol();
  const defaultPermissions = [
    { slug: 'employees:read', module: 'EMPLOYEES', description: 'View employee directory' },
    { slug: 'employees:create', module: 'EMPLOYEES', description: 'Create employee records' },
    { slug: 'employees:update', module: 'EMPLOYEES', description: 'Edit employee details' },
    { slug: 'employees:delete', module: 'EMPLOYEES', description: 'Delete employee records' },
    { slug: 'attendance:read', module: 'ATTENDANCE', description: 'View attendance logs' },
    { slug: 'attendance:punch', module: 'ATTENDANCE', description: 'Record attendance punch' },
    { slug: 'attendance:regularize', module: 'ATTENDANCE', description: 'Submit attendance regularization' },
    { slug: 'attendance:approve', module: 'ATTENDANCE', description: 'Approve attendance regularization' },
    { slug: 'leaves:read', module: 'LEAVES', description: 'View leave requests & balances' },
    { slug: 'leaves:apply', module: 'LEAVES', description: 'Apply for leave' },
    { slug: 'leaves:approve', module: 'LEAVES', description: 'Approve or reject leave applications' },
    { slug: 'payroll:read', module: 'PAYROLL', description: 'View payroll runs and records' },
    { slug: 'payroll:process', module: 'PAYROLL', description: 'Calculate and process payroll runs' },
    { slug: 'payroll:lock', module: 'PAYROLL', description: 'Approve and lock payroll batches' },
    { slug: 'holidays:read', module: 'HOLIDAYS', description: 'View holiday calendar' },
    { slug: 'holidays:manage', module: 'HOLIDAYS', description: 'Create and manage holidays' },
    { slug: 'announcements:read', module: 'ANNOUNCEMENTS', description: 'View announcements' },
    { slug: 'announcements:manage', module: 'ANNOUNCEMENTS', description: 'Post announcements' },
    { slug: 'devices:read', module: 'SETTINGS', description: 'View biometric devices' },
    { slug: 'devices:manage', module: 'SETTINGS', description: 'Configure & sync biometric devices' },
    { slug: 'roles:read', module: 'ROLES', description: 'View roles and matrix' },
    { slug: 'roles:manage', module: 'ROLES', description: 'Modify roles and permissions' },
    { slug: 'settings:manage', module: 'SETTINGS', description: 'Configure attendance rules and shifts' },
  ];

  for (const p of defaultPermissions) {
    await permissions.updateOne({ slug: p.slug }, { $set: { id: p.slug, ...p, createdAt: new Date() } }, { upsert: true });
  }

  // Assign permissions to Super Admin role
  const rolePerms = await rolePermissionsCol();
  for (const p of defaultPermissions) {
    await rolePerms.updateOne(
      { roleId: 'role_super_admin', permissionId: p.slug },
      { $set: { id: `rp_${p.slug}`, roleId: 'role_super_admin', permissionId: p.slug } },
      { upsert: true }
    );
  }

  // 3. Super Admin User
  const users = await usersCol();
  const superAdminMobile = '9876543210';
  const superAdminPasswordHash = hashPassword('admin123');

  await users.updateOne(
    { mobileNumber: superAdminMobile },
    {
      $set: {
        id: 'usr_superadmin',
        mobileNumber: superAdminMobile,
        name: 'Super Admin',
        email: 'admin@secureye.local',
        passwordHash: superAdminPasswordHash,
        roleId: 'role_super_admin',
        status: 'ACTIVE',
        mustChangePassword: false,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
  console.log('[Seed] Super Admin user created (9876543210 / admin123).');

  // 4. Leave Types
  const leaveTypes = await leaveTypesCol();
  const defaultLeaveTypes = [
    { id: 'lt_cl', name: 'Casual Leave', code: 'CL', daysPerYear: 12, accrualFrequency: 'MONTHLY', isPaid: true, colorHex: '#3B82F6' },
    { id: 'lt_sl', name: 'Sick Leave', code: 'SL', daysPerYear: 12, accrualFrequency: 'YEARLY', isPaid: true, colorHex: '#10B981' },
    { id: 'lt_pl', name: 'Paid Privilege Leave', code: 'PL', daysPerYear: 15, accrualFrequency: 'MONTHLY', isPaid: true, colorHex: '#8B5CF6' },
    { id: 'lt_lop', name: 'Loss of Pay', code: 'LOP', daysPerYear: 0, accrualFrequency: 'YEARLY', isPaid: false, colorHex: '#EF4444' },
  ];

  for (const lt of defaultLeaveTypes) {
    await leaveTypes.updateOne({ code: lt.code }, { $set: { ...lt, updatedAt: new Date() } }, { upsert: true });
  }

  // 5. Default Biometric Device
  const devices = await devicesCol();
  const defaultDevice = {
    id: 'dev_sfb3k_01',
    deviceId: 'SFB3K_MAIN_01',
    name: 'Main Office Biometric (S-FB3K)',
    ipAddress: '192.168.1.100',
    port: 80,
    protocol: 'Secureye/FKWeb',
    enabled: true,
    pollingEnabled: true,
    pollingInterval: 3000,
    status: 'ONLINE',
    firmware: 'M60 v3.16.1286s',
    userCount: 9,
    logCount: 91,
    lastSeenAt: new Date(),
    lastSyncAt: new Date(),
    updatedAt: new Date(),
  };
  await devices.updateOne({ deviceId: defaultDevice.deviceId }, { $set: defaultDevice }, { upsert: true });

  // 6. Attendance Shift Rule
  const attendanceRules = await attendanceRulesCol();
  await attendanceRules.updateOne(
    { isDefault: true },
    {
      $set: {
        id: 'rule_general_shift',
        name: 'General Office Shift',
        shiftStartTime: '10:00',
        shiftEndTime: '18:00',
        gracePeriodMinutes: 15,
        lateMarkThresholdMinutes: 45,
        earlyExitThresholdMinutes: 30,
        halfDayMinHours: 4.0,
        fullDayMinHours: 7.5,
        debounceMinutes: 3,
        overtimeMinMinutes: 30,
        workingDays: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday',
        isDefault: true,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  console.log('[Seed] Completed successfully! All collections provisioned on MongoDB Atlas.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
