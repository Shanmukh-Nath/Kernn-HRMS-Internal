const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const path = require('path');

function hashPassword(password, customSalt) {
  const salt = customSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

const db = new DatabaseSync(path.join(process.cwd(), 'prisma', 'dev.db'));

const empRole = db.prepare("SELECT id FROM Role WHERE name = 'EMPLOYEE'").get();
const mgrRole = db.prepare("SELECT id FROM Role WHERE name = 'MANAGER'").get();

if (!empRole || !mgrRole) {
  console.error('Roles not found!');
  process.exit(1);
}

const empPassHash = hashPassword('Employee@123');
const mgrPassHash = hashPassword('Manager@123');

// 1. Regular Employee 1: Rajesh Kumar (Engineering)
db.prepare(`
  INSERT INTO User (id, mobileNumber, passwordHash, name, email, mustChangePassword, status, roleId, createdAt, updatedAt)
  VALUES ('usr_emp_rajesh', '9800000001', ?, 'Rajesh Kumar', 'rajesh.kumar@kernn.com', 0, 'ACTIVE', ?, datetime('now'), datetime('now'))
  ON CONFLICT(mobileNumber) DO UPDATE SET passwordHash = excluded.passwordHash, mustChangePassword = 0, status = 'ACTIVE', roleId = excluded.roleId
`).run(empPassHash, empRole.id);

// 2. Regular Employee 2: Priya Sharma (Design & Marketing)
db.prepare(`
  INSERT INTO User (id, mobileNumber, passwordHash, name, email, mustChangePassword, status, roleId, createdAt, updatedAt)
  VALUES ('usr_emp_priya', '9800000002', ?, 'Priya Sharma', 'priya.sharma@kernn.com', 0, 'ACTIVE', ?, datetime('now'), datetime('now'))
  ON CONFLICT(mobileNumber) DO UPDATE SET passwordHash = excluded.passwordHash, mustChangePassword = 0, status = 'ACTIVE', roleId = excluded.roleId
`).run(empPassHash, empRole.id);

// 3. Department Manager: Anita Verma (Operations Manager)
db.prepare(`
  INSERT INTO User (id, mobileNumber, passwordHash, name, email, mustChangePassword, status, roleId, createdAt, updatedAt)
  VALUES ('usr_mgr_anita', '9800000003', ?, 'Anita Verma', 'anita.verma@kernn.com', 0, 'ACTIVE', ?, datetime('now'), datetime('now'))
  ON CONFLICT(mobileNumber) DO UPDATE SET passwordHash = excluded.passwordHash, mustChangePassword = 0, status = 'ACTIVE', roleId = excluded.roleId
`).run(mgrPassHash, mgrRole.id);

console.log('✅ Successfully seeded test users:');
console.log('1. Employee: 9800000001 / Employee@123 (Rajesh Kumar)');
console.log('2. Employee: 9800000002 / Employee@123 (Priya Sharma)');
console.log('3. Manager:  9800000003 / Manager@123  (Anita Verma)');
