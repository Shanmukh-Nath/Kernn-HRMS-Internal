import { calculateEmployeePayroll } from './payroll-engine';
import { hashPassword, generateTemporaryPassword } from './auth';
import {
  usersCol,
  employeesCol,
  rolesCol,
  permissionsCol,
  rolePermissionsCol,
  devicesCol,
  attendanceEventsCol,
  leaveTypesCol,
  leaveBalancesCol,
  leaveRequestsCol,
  holidaysCol,
  payrollRecordsCol,
  announcementsCol,
  salaryComponentsCol,
  generateId,
} from './mongodb';

// ----------------------------------------------------
// 1. AUTHENTICATION & USERS
// ----------------------------------------------------

export async function findUserByMobile(mobileNumber: string) {
  try {
    const users = await usersCol();
    const roles = await rolesCol();
    const rolePerms = await rolePermissionsCol();
    const perms = await permissionsCol();

    const user = await users.findOne({ mobileNumber });
    if (!user) return null;

    const role = await roles.findOne({ $or: [{ id: user.roleId }, { name: user.roleId }] });
    const roleName = role ? role.name : user.roleId || 'EMPLOYEE';
    const roleId = role?.id || user.roleId;

    const activeRolePerms = await rolePerms.find({ roleId }).toArray();
    const permIds = activeRolePerms.map((rp) => rp.permissionId);
    const foundPerms = await perms.find({ $or: [{ id: { $in: permIds } }, { slug: { $in: permIds } }] }).toArray();

    return {
      ...user,
      id: user.id || user._id?.toString(),
      role: roleName,
      roleName,
      permissions: foundPerms.map((p) => p.slug || p.id),
    };
  } catch (mongoErr) {
    // Fallback to SQLite
    const { DatabaseSync } = require('node:sqlite');
    const path = require('path');
    const db = new DatabaseSync(path.join(process.cwd(), 'prisma', 'dev.db'));

    const user: any = db.prepare('SELECT * FROM User WHERE mobileNumber = ?').get(mobileNumber);
    if (!user) return null;

    const role: any = db.prepare('SELECT id, name FROM Role WHERE id = ? OR name = ?').get(user.roleId, user.roleId);
    const roleName = role ? role.name : user.roleId || 'EMPLOYEE';

    const perms: any[] = db.prepare(`
      SELECT p.slug FROM RolePermission rp
      JOIN Permission p ON rp.permissionId = p.id OR rp.permissionId = p.slug
      WHERE rp.roleId = ?
    `).all(role?.id || user.roleId);

    return {
      ...user,
      role: roleName,
      roleName,
      permissions: perms.map((p) => p.slug),
    };
  }
}

export async function findUserById(id: string) {
  try {
    const users = await usersCol();
    const roles = await rolesCol();
    const employees = await employeesCol();
    const rolePerms = await rolePermissionsCol();
    const perms = await permissionsCol();

    const user = await users.findOne({ $or: [{ id }, { _id: id }] });
    if (!user) return null;

    const role = await roles.findOne({ $or: [{ id: user.roleId }, { name: user.roleId }] });
    const roleName = role ? role.name : user.roleId || 'EMPLOYEE';
    const roleId = role?.id || user.roleId;

    let employee = null;
    if (user.employeeId) {
      employee = await employees.findOne({ $or: [{ id: user.employeeId }, { _id: user.employeeId }] });
    }

    const activeRolePerms = await rolePerms.find({ roleId }).toArray();
    const permIds = activeRolePerms.map((rp) => rp.permissionId);
    const foundPerms = await perms.find({ $or: [{ id: { $in: permIds } }, { slug: { $in: permIds } }] }).toArray();

    return {
      ...user,
      id: user.id || user._id?.toString(),
      role: roleName,
      roleName,
      permissions: foundPerms.map((p) => p.slug || p.id),
      department: employee?.department || 'General',
      designation: employee?.designation || roleName,
    };
  } catch (mongoErr) {
    const { DatabaseSync } = require('node:sqlite');
    const path = require('path');
    const db = new DatabaseSync(path.join(process.cwd(), 'prisma', 'dev.db'));

    const user: any = db.prepare('SELECT * FROM User WHERE id = ?').get(id);
    if (!user) return null;

    const role: any = db.prepare('SELECT id, name FROM Role WHERE id = ? OR name = ?').get(user.roleId, user.roleId);
    const roleName = role ? role.name : user.roleId || 'EMPLOYEE';

    let employee: any = null;
    if (user.employeeId) {
      employee = db.prepare('SELECT * FROM Employee WHERE id = ?').get(user.employeeId);
    }

    const perms: any[] = db.prepare(`
      SELECT p.slug FROM RolePermission rp
      JOIN Permission p ON rp.permissionId = p.id OR rp.permissionId = p.slug
      WHERE rp.roleId = ?
    `).all(role?.id || user.roleId);

    return {
      ...user,
      role: roleName,
      roleName,
      permissions: perms.map((p) => p.slug),
      department: employee?.department || 'General',
      designation: employee?.designation || roleName,
    };
  }
}


export async function updateUserPassword(userId: string, passwordHash: string) {
  const users = await usersCol();
  await users.updateOne(
    { $or: [{ id: userId }, { _id: userId }] },
    {
      $set: {
        passwordHash,
        mustChangePassword: false,
        updatedAt: new Date(),
      },
    }
  );
}

// ----------------------------------------------------
// 2. EMPLOYEES & LIFECYCLE
// ----------------------------------------------------

export async function getEmployeesList(search?: string, department?: string) {
  const employees = await employeesCol();
  const users = await usersCol();

  const filter: Record<string, any> = {};
  if (department && department !== 'ALL') {
    filter.department = department;
  }

  if (search) {
    const reg = new RegExp(search, 'i');
    filter.$or = [
      { name: reg },
      { deviceUserId: reg },
      { employeeCode: reg },
      { mobileNumber: reg },
    ];
  }

  const empList = await employees.find(filter).sort({ name: 1 }).toArray();
  const userList = await users.find({}).toArray();
  const userMapByEmpId = new Map<string, any>();
  for (const u of userList) {
    if (u.employeeId) userMapByEmpId.set(u.employeeId, u);
  }

  return empList.map((e) => {
    const u = userMapByEmpId.get(e.id);
    return {
      ...e,
      id: e.id || e._id?.toString(),
      userId: u?.id || u?._id?.toString() || null,
      userMobile: u?.mobileNumber || null,
      mustChangePassword: u?.mustChangePassword ?? false,
    };
  });
}

export async function createEmployeeWithUser(data: {
  name: string;
  mobileNumber: string;
  email?: string;
  department?: string;
  designation?: string;
  baseSalary?: number;
  hra?: number;
  allowances?: number;
  deviceUserId: string;
  deviceId?: string;
  roleId?: string;
}) {
  const employees = await employeesCol();
  const users = await usersCol();
  const devices = await devicesCol();
  const roles = await rolesCol();
  const leaveTypes = await leaveTypesCol();
  const leaveBalances = await leaveBalancesCol();

  const employeeId = generateId();
  const userId = generateId();
  const tempPassword = generateTemporaryPassword();
  const passwordHash = hashPassword(tempPassword);
  const now = new Date();

  // Find device
  let deviceId = data.deviceId;
  if (!deviceId) {
    const dev = await devices.findOne({});
    deviceId = dev?.id || dev?.deviceId || 'default_device';
  }

  // Find Employee Role
  let roleId = data.roleId;
  if (!roleId) {
    const role = await roles.findOne({ name: 'EMPLOYEE' });
    roleId = role?.id || 'role_employee';
  }

  const newEmp = {
    id: employeeId,
    deviceId,
    deviceUserId: data.deviceUserId,
    employeeCode: `EMP-${data.deviceUserId}`,
    name: data.name,
    mobileNumber: data.mobileNumber,
    email: data.email || `${data.name.replace(/\s+/g, '').toLowerCase()}@company.com`,
    department: data.department || 'Engineering',
    designation: data.designation || 'Associate',
    baseSalary: data.baseSalary || 30000,
    hra: data.hra || 12000,
    allowances: data.allowances || 8000,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  await employees.insertOne(newEmp);

  const newUser = {
    id: userId,
    mobileNumber: data.mobileNumber,
    passwordHash,
    name: data.name,
    email: data.email || null,
    mustChangePassword: true,
    status: 'ACTIVE',
    roleId,
    employeeId,
    createdAt: now,
    updatedAt: now,
  };

  await users.insertOne(newUser);

  // Initialize Leave Balances
  const allLeaveTypes = await leaveTypes.find({}).toArray();
  for (const lt of allLeaveTypes) {
    await leaveBalances.insertOne({
      id: generateId(),
      employeeId,
      leaveTypeId: lt.id || lt.code,
      year: 2026,
      allocated: lt.daysPerYear || 12,
      accrued: lt.daysPerYear || 12,
      used: 0,
      pending: 0,
      balance: lt.daysPerYear || 12,
      updatedAt: now,
    });
  }

  return {
    employeeId,
    userId,
    name: data.name,
    mobileNumber: data.mobileNumber,
    temporaryPassword: tempPassword,
  };
}

// ----------------------------------------------------
// 3. LEAVE MANAGEMENT & APPROVALS
// ----------------------------------------------------

export async function getLeaveTypesList() {
  const leaveTypes = await leaveTypesCol();
  return leaveTypes.find({}).sort({ name: 1 }).toArray();
}

export async function getEmployeeLeaveBalances(employeeId: string, year = 2026) {
  const leaveBalances = await leaveBalancesCol();
  const leaveTypes = await leaveTypesCol();

  const balances = await leaveBalances.find({ employeeId, year }).toArray();
  const types = await leaveTypes.find({}).toArray();
  const typeMap = new Map(types.map((t) => [t.id || t.code, t]));

  return balances.map((lb) => {
    const lt = typeMap.get(lb.leaveTypeId) || {};
    return {
      ...lb,
      leaveTypeName: lt.name || 'Leave',
      leaveTypeCode: lt.code || 'LV',
      colorHex: lt.colorHex || '#3B82F6',
      isPaid: lt.isPaid ?? true,
    };
  });
}

export async function applyLeaveRequest(data: {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
}) {
  const leaveRequests = await leaveRequestsCol();
  const leaveBalances = await leaveBalancesCol();

  const reqId = generateId();
  const now = new Date();

  await leaveRequests.insertOne({
    id: reqId,
    employeeId: data.employeeId,
    leaveTypeId: data.leaveTypeId,
    startDate: new Date(data.startDate),
    endDate: new Date(data.endDate),
    totalDays: data.totalDays,
    reason: data.reason,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  });

  await leaveBalances.updateOne(
    { employeeId: data.employeeId, leaveTypeId: data.leaveTypeId, year: 2026 },
    {
      $inc: { pending: data.totalDays, balance: -data.totalDays },
      $set: { updatedAt: now },
    }
  );

  return { id: reqId, status: 'PENDING' };
}

export async function getLeaveRequestsList(status?: string, employeeId?: string) {
  const leaveRequests = await leaveRequestsCol();
  const employees = await employeesCol();
  const leaveTypes = await leaveTypesCol();

  const filter: Record<string, any> = {};
  if (status && status !== 'ALL') filter.status = status;
  if (employeeId) filter.employeeId = employeeId;

  const reqs = await leaveRequests.find(filter).sort({ createdAt: -1 }).toArray();
  const emps = await employees.find({}).toArray();
  const types = await leaveTypes.find({}).toArray();

  const empMap = new Map(emps.map((e) => [e.id, e]));
  const typeMap = new Map(types.map((t) => [t.id || t.code, t]));

  return reqs.map((lr) => {
    const e = empMap.get(lr.employeeId);
    const lt = typeMap.get(lr.leaveTypeId);
    return {
      ...lr,
      employeeName: e?.name || 'Unknown Employee',
      employeeCode: e?.employeeCode || '',
      department: e?.department || '',
      leaveTypeName: lt?.name || '',
      leaveTypeCode: lt?.code || '',
      colorHex: lt?.colorHex || '#3B82F6',
    };
  });
}

export async function processLeaveApproval(
  requestId: string,
  approvedById: string,
  action: 'APPROVED' | 'REJECTED',
  rejectionReason?: string
) {
  const leaveRequests = await leaveRequestsCol();
  const leaveBalances = await leaveBalancesCol();

  const req = await leaveRequests.findOne({ id: requestId });
  if (!req || req.status !== 'PENDING') throw new Error('Request not found or already processed');

  const now = new Date();

  await leaveRequests.updateOne(
    { id: requestId },
    {
      $set: {
        status: action,
        approvedById,
        rejectionReason: rejectionReason || null,
        updatedAt: now,
      },
    }
  );

  if (action === 'APPROVED') {
    await leaveBalances.updateOne(
      { employeeId: req.employeeId, leaveTypeId: req.leaveTypeId, year: 2026 },
      {
        $inc: { pending: -req.totalDays, used: req.totalDays },
        $set: { updatedAt: now },
      }
    );
  } else {
    await leaveBalances.updateOne(
      { employeeId: req.employeeId, leaveTypeId: req.leaveTypeId, year: 2026 },
      {
        $inc: { pending: -req.totalDays, balance: req.totalDays },
        $set: { updatedAt: now },
      }
    );
  }

  return { success: true, status: action };
}

// ----------------------------------------------------
// 4. STATUTORY PAYROLL ENGINE
// ----------------------------------------------------

export async function getPayrollRecordsList(month: number, year: number) {
  const payroll = await payrollRecordsCol();
  const employees = await employeesCol();

  const records = await payroll.find({ month, year }).toArray();
  const emps = await employees.find({}).toArray();
  const empMap = new Map(emps.map((e) => [e.id, e]));

  return records
    .map((pr) => {
      const e = empMap.get(pr.employeeId);
      return {
        ...pr,
        employeeName: e?.name || '',
        employeeCode: e?.employeeCode || '',
        department: e?.department || '',
        designation: e?.designation || '',
        bankAccountNo: e?.bankAccountNo || '',
        bankIfsc: e?.bankIfsc || '',
        panNumber: e?.panNumber || '',
      };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

export async function generateMonthlyPayrollBatch(month: number, year: number) {
  const employees = await employeesCol();
  const payroll = await payrollRecordsCol();
  const attendance = await attendanceEventsCol();
  const leaveRequests = await leaveRequestsCol();
  const salaryComponents = await salaryComponentsCol();

  const activeEmployees = await employees.find({ status: 'ACTIVE' }).toArray();
  const now = new Date();
  const results = [];

  const lockedCount = await payroll.countDocuments({ month, year, status: 'APPROVED_LOCKED' });
  if (lockedCount > 0) {
    throw new Error(`Payroll for ${month}/${year} is sealed and locked by management.`);
  }

  const startIso = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`;
  const lastDay = new Date(year, month, 0).getDate();
  const endIso = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;
  const startDate = new Date(startIso);
  const endDate = new Date(endIso);

  for (const emp of activeEmployees) {
    const events = await attendance
      .find({
        deviceUserId: emp.deviceUserId,
        timestamp: { $gte: startDate, $lte: endDate },
      })
      .toArray();

    const uniquePunchDates = new Set(
      events.map((e) => (e.timestamp instanceof Date ? e.timestamp.toISOString().split('T')[0] : String(e.timestamp).split('T')[0]))
    );
    const presentDays = uniquePunchDates.size;

    const approvedLeaves = await leaveRequests
      .find({
        employeeId: emp.id,
        status: 'APPROVED',
        startDate: { $gte: startDate, $lte: endDate },
      })
      .toArray();

    const paidLeaves = approvedLeaves.reduce((sum, l) => sum + (l.totalDays || 1), 0);

    let components: any[] = [];
    if (emp.salaryStructureId) {
      components = await salaryComponents.find({ structureId: emp.salaryStructureId }).toArray();
    }

    const payslip = calculateEmployeePayroll({
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.employeeCode || `EMP-${emp.deviceUserId}`,
      month,
      year,
      baseSalary: emp.baseSalary || 30000,
      hra: emp.hra || 12000,
      allowances: emp.allowances || 8000,
      components,
      presentDays: Math.min(22, presentDays || 20),
      halfDays: 0,
      approvedPaidLeaves: paidLeaves,
      publicHolidays: 2,
      weekends: 6,
      unpaidLeaveDays: 0,
    });

    const recordId = generateId();
    await payroll.updateOne(
      { employeeId: emp.id, month, year },
      {
        $set: {
          id: recordId,
          employeeId: emp.id,
          month,
          year,
          basicSalary: payslip.basicSalary,
          hra: payslip.hra,
          allowances: payslip.allowances,
          grossSalary: payslip.grossSalary,
          totalDays: payslip.totalDaysInMonth,
          payableDays: payslip.payableDays,
          unpaidLopDays: payslip.unpaidLopDays,
          lopDeduction: payslip.lopDeduction,
          pfDeduction: payslip.pfDeduction,
          esiDeduction: payslip.esiDeduction,
          ptDeduction: payslip.ptDeduction,
          taxDeduction: payslip.taxDeduction,
          totalDeductions: payslip.totalDeductions,
          netSalary: payslip.netPayableSalary,
          status: 'DRAFT_PENDING_APPROVAL',
          lineItemsJson: JSON.stringify(payslip.lineItems),
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );

    results.push(payslip);
  }

  return results;
}

// ----------------------------------------------------
// 5. HOLIDAYS & CALENDAR
// ----------------------------------------------------

export async function getHolidaysList(year = 2026) {
  const holidays = await holidaysCol();
  return holidays.find({ year }).sort({ date: 1 }).toArray();
}

export async function addHoliday(data: { name: string; date: string; description?: string; isOptional?: boolean; year?: number }) {
  const holidays = await holidaysCol();
  const id = generateId();
  const year = data.year || new Date(data.date).getFullYear();

  const doc = {
    id,
    name: data.name,
    date: new Date(data.date),
    isOptional: Boolean(data.isOptional),
    description: data.description || null,
    year,
    createdAt: new Date(),
  };

  await holidays.insertOne(doc);
  return doc;
}

export async function deleteHoliday(id: string) {
  const holidays = await holidaysCol();
  await holidays.deleteOne({ $or: [{ id }, { _id: id }] });
  return { success: true };
}

// ----------------------------------------------------
// 6. ANNOUNCEMENTS
// ----------------------------------------------------

export async function getAnnouncementsList() {
  const announcements = await announcementsCol();
  return announcements.find({}).sort({ publishedAt: -1 }).limit(20).toArray();
}

export async function createAnnouncement(data: { title: string; content: string; priority?: string; authorName?: string }) {
  const announcements = await announcementsCol();
  const id = generateId();
  const now = new Date();

  const doc = {
    id,
    title: data.title,
    content: data.content,
    priority: data.priority || 'NORMAL',
    authorName: data.authorName || 'HR Administration',
    publishedAt: now,
    createdAt: now,
  };

  await announcements.insertOne(doc);
  return doc;
}

// ----------------------------------------------------
// 7. ROLES & PERMISSIONS MATRIX
// ----------------------------------------------------

export async function getRolesWithPermissions() {
  const roles = await rolesCol();
  const rolePerms = await rolePermissionsCol();
  const perms = await permissionsCol();

  const allRoles = await roles.find({}).sort({ isSystem: -1, name: 1 }).toArray();
  const allRolePerms = await rolePerms.find({}).toArray();
  const allPermissions = await perms.find({}).sort({ module: 1, slug: 1 }).toArray();

  const rolePermMap = new Map<string, string[]>();
  for (const rp of allRolePerms) {
    const list = rolePermMap.get(rp.roleId) || [];
    list.push(rp.permissionId);
    rolePermMap.set(rp.roleId, list);
  }

  const result = allRoles.map((r) => ({
    ...r,
    id: r.id || r._id?.toString(),
    permissions: rolePermMap.get(r.id) || [],
  }));

  return { roles: result, allPermissions };
}

export async function updateRolePermissions(roleId: string, permissionSlugs: string[]) {
  const rolePerms = await rolePermissionsCol();
  await rolePerms.deleteMany({ roleId });

  const docs = permissionSlugs.map((slug) => ({
    id: generateId(),
    roleId,
    permissionId: slug,
    createdAt: new Date(),
  }));

  if (docs.length > 0) {
    await rolePerms.insertMany(docs);
  }

  return { success: true, roleId, permissionsCount: permissionSlugs.length };
}
