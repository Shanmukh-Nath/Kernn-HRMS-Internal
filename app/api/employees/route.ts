import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession, generateTemporaryPassword, hashPassword } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import {
  employeesCol,
  usersCol,
  rolesCol,
  devicesCol,
  salaryStructuresCol,
  leaveTypesCol,
  leaveBalancesCol,
  leaveRequestsCol,
  attendanceEventsCol,
  payrollRecordsCol,
  passkeysCol,
  generateId,
} from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const department = searchParams.get('department') || undefined;
    const role = searchParams.get('role') || undefined;
    const status = searchParams.get('status') || undefined;

    const employees = await employeesCol();
    const users = await usersCol();
    const roles = await rolesCol();
    const salaryStructures = await salaryStructuresCol();

    const filter: Record<string, any> = {};

    if (department && department !== 'ALL') {
      filter.department = department;
    }

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (search) {
      const reg = new RegExp(search, 'i');
      filter.$or = [
        { name: reg },
        { deviceUserId: reg },
        { employeeCode: reg },
        { mobileNumber: reg },
        { email: reg },
      ];
    }

    const empList = await employees.find(filter).sort({ name: 1 }).toArray();
    const userList = await users.find({}).toArray();
    const roleList = await roles.find({}).toArray();
    const structList = await salaryStructures.find({}).toArray();

    const userByEmpId = new Map<string, any>();
    for (const u of userList) {
      if (u.employeeId) userByEmpId.set(u.employeeId, u);
    }

    const roleById = new Map<string, any>();
    for (const r of roleList) {
      roleById.set(r.id, r);
      roleById.set(r.name, r);
    }

    const structById = new Map<string, any>();
    for (const s of structList) {
      structById.set(s.id, s);
    }

    const empById = new Map<string, any>();
    for (const e of empList) {
      empById.set(e.id, e);
    }

    let mappedEmployees = empList.map((emp: any) => {
      const user = userByEmpId.get(emp.id);
      const userRole = user?.roleId ? roleById.get(user.roleId) : null;
      const struct = emp.salaryStructureId ? structById.get(emp.salaryStructureId) : null;
      const manager = emp.managerId ? empById.get(emp.managerId) : null;

      let qualifications = [];
      let experience = [];
      try {
        qualifications = emp.qualificationsJson
          ? typeof emp.qualificationsJson === 'string'
            ? JSON.parse(emp.qualificationsJson)
            : emp.qualificationsJson
          : [];
      } catch {}
      try {
        experience = emp.experienceJson
          ? typeof emp.experienceJson === 'string'
            ? JSON.parse(emp.experienceJson)
            : emp.experienceJson
          : [];
      } catch {}

      return {
        ...emp,
        id: emp.id || emp._id?.toString(),
        userId: user?.id || user?._id?.toString() || null,
        userMobile: user?.mobileNumber || null,
        roleId: user?.roleId || null,
        roleName: userRole?.name || 'EMPLOYEE',
        salaryStructureName: struct?.name || null,
        managerName: manager?.name || null,
        qualifications,
        experience,
      };
    });

    if (role && role !== 'ALL') {
      mappedEmployees = mappedEmployees.filter((e) => e.roleName === role);
    }

    const activeManagers = empList
      .filter((e) => e.status === 'ACTIVE')
      .map((e) => ({
        id: e.id,
        name: e.name,
        employeeCode: e.employeeCode,
        department: e.department,
        designation: e.designation,
      }));

    return NextResponse.json({
      success: true,
      data: mappedEmployees,
      lookups: {
        roles: roleList.map((r) => ({ id: r.id, name: r.name, description: r.description })),
        salaryStructures: structList.map((s) => ({
          id: s.id,
          name: s.name,
          baseSalaryAmount: s.baseSalaryAmount,
          ctcMinimum: s.ctcMinimum,
          ctcMaximum: s.ctcMaximum,
        })),
        managers: activeManagers,
      },
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
    if (session && !hasPermission(session, 'employees:create')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to create employees' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    if (!body.name || !body.mobileNumber) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Employee Name and Mobile Number are required' } },
        { status: 400 }
      );
    }

    const employees = await employeesCol();
    const users = await usersCol();
    const roles = await rolesCol();
    const devices = await devicesCol();
    const leaveTypes = await leaveTypesCol();
    const leaveBalances = await leaveBalancesCol();

    const employeeId = generateId();
    const userId = generateId();
    const tempPassword = generateTemporaryPassword();
    const passwordHash = hashPassword(tempPassword);
    const now = new Date();

    const dev = await devices.findOne({});
    const deviceId = body.deviceId || dev?.id || dev?.deviceId || 'default_device';

    let roleId = body.roleId;
    if (!roleId) {
      const defaultRole = await roles.findOne({ name: 'EMPLOYEE' });
      roleId = defaultRole?.id || 'role_employee';
    }

    let deviceUserId = body.deviceUserId ? String(body.deviceUserId) : '';
    if (!deviceUserId) {
      const allEmps = await employees.find({}).toArray();
      const maxId = allEmps.reduce((max, e) => Math.max(max, parseInt(e.deviceUserId, 10) || 0), 100);
      deviceUserId = String(maxId + 1);
    }

    const employeeCode = body.employeeCode || `EMP-${deviceUserId}`;
    const baseSalary = Number(body.baseSalary) || 30000;
    const ctcAmount = Number(body.ctcAmount) || baseSalary * 12;
    const hra = Number(body.hra) || Math.round(baseSalary * 0.4);
    const allowances = Number(body.allowances) || Math.round(baseSalary * 0.2);

    const qualificationsJson = JSON.stringify(body.qualifications || []);
    const experienceJson = JSON.stringify(body.experience || []);

    const employeeDoc = {
      id: employeeId,
      deviceId,
      deviceUserId,
      employeeCode,
      name: body.name,
      mobileNumber: body.mobileNumber,
      email: body.email || `${body.name.replace(/\s+/g, '').toLowerCase()}@company.com`,
      department: body.department || 'Engineering',
      designation: body.designation || 'Associate',
      status: body.status || 'ACTIVE',
      dateOfJoining: body.dateOfJoining ? new Date(body.dateOfJoining) : now,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      gender: body.gender || 'Male',
      bloodGroup: body.bloodGroup || null,
      maritalStatus: body.maritalStatus || 'Single',
      aadhaarNumber: body.aadhaarNumber || null,
      panNumber: body.panNumber || null,
      emergencyContactName: body.emergencyContactName || null,
      emergencyContactPhone: body.emergencyContactPhone || null,
      emergencyContactRelation: body.emergencyContactRelation || null,
      address: body.address || null,
      bankName: body.bankName || null,
      bankAccountNo: body.bankAccountNo || null,
      bankIfsc: body.bankIfsc || null,
      accountHolderName: body.accountHolderName || body.name,
      probationPeriod: Number(body.probationPeriod) || 6,
      workShift: body.workShift || 'Day',
      expectedWorkHours: Number(body.expectedWorkHours) || 8.0,
      managerId: body.managerId || null,
      salaryStructureId: body.salaryStructureId || 'struct_fte_standard',
      baseSalary,
      ctcAmount,
      hra,
      allowances,
      cardNumber: body.cardNumber || null,
      privilege: Number(body.privilege) || 0,
      qualificationsJson,
      experienceJson,
      createdAt: now,
      updatedAt: now,
    };

    await employees.insertOne(employeeDoc);

    const userDoc = {
      id: userId,
      mobileNumber: body.mobileNumber,
      passwordHash,
      name: body.name,
      email: body.email || null,
      mustChangePassword: true,
      status: 'ACTIVE',
      roleId,
      employeeId,
      createdAt: now,
      updatedAt: now,
    };

    await users.insertOne(userDoc);

    const allLeaveTypes = await leaveTypes.find({}).toArray();
    for (const lt of allLeaveTypes) {
      const quota = Number(lt.defaultDaysPerYear ?? lt.daysPerYear) || 12;
      await leaveBalances.insertOne({
        id: generateId(),
        employeeId,
        leaveTypeId: lt.id || lt.code,
        year: 2026,
        allocated: quota,
        accrued: quota,
        used: 0,
        pending: 0,
        balance: quota,
        updatedAt: now,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        employeeId,
        userId,
        name: body.name,
        mobileNumber: body.mobileNumber,
        employeeCode,
        temporaryPassword: tempPassword,
      },
      message: 'Employee and user login created successfully',
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
    if (session && !hasPermission(session, 'employees:update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to update employee profiles' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Employee ID is required for update' } },
        { status: 400 }
      );
    }

    const employees = await employeesCol();
    const users = await usersCol();
    const now = new Date();

    const baseSalary = Number(body.baseSalary) || 30000;
    const ctcAmount = Number(body.ctcAmount) || baseSalary * 12;
    const hra = Number(body.hra) || Math.round(baseSalary * 0.4);
    const allowances = Number(body.allowances) || Math.round(baseSalary * 0.2);
    const qualificationsJson = JSON.stringify(body.qualifications || []);
    const experienceJson = JSON.stringify(body.experience || []);

    const updateFields: Record<string, any> = {
      name: body.name,
      mobileNumber: body.mobileNumber,
      email: body.email || null,
      employeeCode: body.employeeCode,
      department: body.department,
      designation: body.designation,
      status: body.status || 'ACTIVE',
      gender: body.gender || 'Male',
      bloodGroup: body.bloodGroup || null,
      maritalStatus: body.maritalStatus || 'Single',
      aadhaarNumber: body.aadhaarNumber || null,
      panNumber: body.panNumber || null,
      emergencyContactName: body.emergencyContactName || null,
      emergencyContactPhone: body.emergencyContactPhone || null,
      emergencyContactRelation: body.emergencyContactRelation || null,
      address: body.address || null,
      bankName: body.bankName || null,
      bankAccountNo: body.bankAccountNo || null,
      bankIfsc: body.bankIfsc || null,
      accountHolderName: body.accountHolderName || body.name,
      probationPeriod: Number(body.probationPeriod) || 6,
      workShift: body.workShift || 'Day',
      expectedWorkHours: Number(body.expectedWorkHours) || 8.0,
      managerId: body.managerId || null,
      salaryStructureId: body.salaryStructureId || null,
      baseSalary,
      ctcAmount,
      hra,
      allowances,
      qualificationsJson,
      experienceJson,
      updatedAt: now,
    };

    if (body.dateOfJoining) updateFields.dateOfJoining = new Date(body.dateOfJoining);
    if (body.dateOfBirth) updateFields.dateOfBirth = new Date(body.dateOfBirth);

    await employees.updateOne(
      { $or: [{ id: body.id }, { _id: body.id }] },
      { $set: updateFields }
    );

    const userUpdates: Record<string, any> = {
      name: body.name,
      email: body.email || null,
      mobileNumber: body.mobileNumber,
      updatedAt: now,
    };
    if (body.roleId) userUpdates.roleId = body.roleId;

    await users.updateOne({ employeeId: body.id }, { $set: userUpdates });

    return NextResponse.json({
      success: true,
      message: 'Employee profile updated successfully',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (session && !hasPermission(session, 'employees:delete')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to delete employees' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_ID', message: 'Employee ID is required' } },
        { status: 400 }
      );
    }

    const employees = await employeesCol();
    const users = await usersCol();
    const attendance = await attendanceEventsCol();
    const leaveBalances = await leaveBalancesCol();
    const leaveRequests = await leaveRequestsCol();
    const payroll = await payrollRecordsCol();
    const passkeys = await passkeysCol();

    const user = await users.findOne({ employeeId: id });
    if (user?.id) {
      await passkeys.deleteMany({ userId: user.id });
    }

    await attendance.deleteMany({ employeeId: id });
    await leaveBalances.deleteMany({ employeeId: id });
    await leaveRequests.deleteMany({ employeeId: id });
    await payroll.deleteMany({ employeeId: id });
    await users.deleteMany({ employeeId: id });
    await employees.deleteOne({ $or: [{ id }, { _id: id }] });

    return NextResponse.json({
      success: true,
      message: 'Employee and associated user records deleted successfully',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
