const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');

const db = new DatabaseSync('prisma/dev.db');

function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, s, 10000, 64, 'sha512').toString('hex');
  return `${s}:${hash}`;
}

const roles = db.prepare('SELECT id, name FROM Role').all();
const roleMap = {};
roles.forEach(r => { roleMap[r.name] = r.id; });

const accounts = [
  {
    roleName: 'SUPER_ADMIN',
    name: 'Vamshi SuperAdmin',
    mobileNumber: '9876543210',
    email: 'admin@kernn.com',
    password: 'Admin@123',
  },
  {
    roleName: 'HR_ADMIN',
    name: 'Priya HR Manager',
    mobileNumber: '9800000010',
    email: 'hr.priya@kernn.com',
    password: 'HrAdmin@123',
    department: 'Human Resources',
    designation: 'HR Lead Specialist',
  },
  {
    roleName: 'MANAGER',
    name: 'Vikram Reporting Manager',
    mobileNumber: '9800000003',
    email: 'manager.vikram@kernn.com',
    password: 'Manager@123',
    department: 'Engineering',
    designation: 'Engineering Team Lead',
  },
  {
    roleName: 'EMPLOYEE',
    name: 'Hemanth Employee',
    mobileNumber: '9800000001',
    email: 'hemanth@company.com',
    password: 'Employee@123',
    department: 'Engineering',
    designation: 'Frontend Associate',
  },
];

const now = new Date().toISOString();

for (const acc of accounts) {
  const roleId = roleMap[acc.roleName];
  const pHash = hashPassword(acc.password);

  const existingUser = db.prepare('SELECT id, employeeId FROM User WHERE mobileNumber = ?').get(acc.mobileNumber);

  if (existingUser) {
    db.prepare(`
      UPDATE User
      SET name = ?, email = ?, passwordHash = ?, roleId = ?, mustChangePassword = 0, status = 'ACTIVE', updatedAt = ?
      WHERE id = ?
    `).run(acc.name, acc.email, pHash, roleId, now, existingUser.id);
    console.log(`Updated ${acc.roleName}: ${acc.mobileNumber} / ${acc.password}`);
  } else {
    const userId = 'usr_' + Math.random().toString(36).substring(2, 12);
    const employeeId = 'emp_' + Math.random().toString(36).substring(2, 12);
    const dev = db.prepare('SELECT id FROM Device LIMIT 1').get();
    const deviceId = dev?.id || 'cmtcjzg9800000om0rhvtbgti';

    // Insert Employee
    db.prepare(`
      INSERT INTO Employee (
        id, deviceId, deviceUserId, employeeCode, name, mobileNumber, email,
        department, designation, status, baseSalary, ctcAmount, hra, allowances,
        gender, bloodGroup, dateOfJoining, workShift, expectedWorkHours,
        salaryStructureId, createdAt, updatedAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, 'ACTIVE', 50000, 720000, 20000, 10000,
        'Female', 'O+', ?, 'Day', 8.0,
        'struct_fte_standard', ?, ?
      )
    `).run(
      employeeId,
      deviceId,
      acc.mobileNumber.slice(-3),
      `EMP-${acc.mobileNumber.slice(-3)}`,
      acc.name,
      acc.mobileNumber,
      acc.email,
      acc.department || 'Management',
      acc.designation || 'Specialist',
      now,
      now,
      now
    );

    // Insert User
    db.prepare(`
      INSERT INTO User (
        id, mobileNumber, passwordHash, name, email, mustChangePassword,
        status, roleId, employeeId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, 0, 'ACTIVE', ?, ?, ?, ?)
    `).run(userId, acc.mobileNumber, pHash, acc.name, acc.email, roleId, employeeId, now, now);

    console.log(`Created ${acc.roleName}: ${acc.mobileNumber} / ${acc.password}`);
  }
}

console.log('All test credentials ready!');
