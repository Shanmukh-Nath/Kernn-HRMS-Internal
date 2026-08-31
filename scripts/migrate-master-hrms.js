const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
const db = new DatabaseSync(dbPath);

function addColumnIfNotExists(table, column, def) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!info.some(c => c.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`).run();
    console.log(`Added ${column} to ${table}`);
  }
}

// 1. LeaveType expansion
addColumnIfNotExists('LeaveType', 'category', "TEXT DEFAULT 'Casual'");
addColumnIfNotExists('LeaveType', 'accrualEnabled', "INTEGER DEFAULT 0");
addColumnIfNotExists('LeaveType', 'accrualFrequency', "TEXT DEFAULT 'Yearly'");
addColumnIfNotExists('LeaveType', 'accrualAmount', "REAL DEFAULT 0.0");
addColumnIfNotExists('LeaveType', 'allowCarryForward', "INTEGER DEFAULT 1");
addColumnIfNotExists('LeaveType', 'carryForwardExpiryDays', "INTEGER DEFAULT 365");
addColumnIfNotExists('LeaveType', 'maxAccumulation', "REAL DEFAULT 30.0");
addColumnIfNotExists('LeaveType', 'allowEncashment', "INTEGER DEFAULT 0");
addColumnIfNotExists('LeaveType', 'encashmentMaxDays', "REAL DEFAULT 0.0");
addColumnIfNotExists('LeaveType', 'genderEligibility', "TEXT DEFAULT 'All'");
addColumnIfNotExists('LeaveType', 'eligibleEmployeeTypes', "TEXT DEFAULT '[\"Teaching\",\"Non-Teaching\",\"Admin\",\"Support\",\"Contractual\",\"PartTime\"]'");
addColumnIfNotExists('LeaveType', 'minServiceYears', "REAL DEFAULT 0.0");
addColumnIfNotExists('LeaveType', 'maxServiceYears', "REAL DEFAULT 99.0");
addColumnIfNotExists('LeaveType', 'minAge', "INTEGER DEFAULT 18");
addColumnIfNotExists('LeaveType', 'maxAge', "INTEGER DEFAULT 70");
addColumnIfNotExists('LeaveType', 'allowedDuringProbation', "INTEGER DEFAULT 1");
addColumnIfNotExists('LeaveType', 'allowedDuringNoticePeriod', "INTEGER DEFAULT 0");
addColumnIfNotExists('LeaveType', 'minDaysAllowed', "INTEGER DEFAULT 1");
addColumnIfNotExists('LeaveType', 'maxDaysAllowed', "INTEGER DEFAULT 30");
addColumnIfNotExists('LeaveType', 'minConsecutiveDays', "INTEGER DEFAULT 1");
addColumnIfNotExists('LeaveType', 'maxTimesPerYear', "INTEGER DEFAULT 12");
addColumnIfNotExists('LeaveType', 'maxTimesPerMonth', "INTEGER DEFAULT 3");
addColumnIfNotExists('LeaveType', 'minGapDays', "INTEGER DEFAULT 0");
addColumnIfNotExists('LeaveType', 'requiresMedicalCertificate', "INTEGER DEFAULT 0");
addColumnIfNotExists('LeaveType', 'medicalCertificateAfterDays', "INTEGER DEFAULT 3");
addColumnIfNotExists('LeaveType', 'priorApprovalRequiredDays', "INTEGER DEFAULT 0");
addColumnIfNotExists('LeaveType', 'affectsPayroll', "INTEGER DEFAULT 1");
addColumnIfNotExists('LeaveType', 'applySandwichRule', "INTEGER DEFAULT 0");
addColumnIfNotExists('LeaveType', 'negativeBalanceLimit', "REAL DEFAULT -5.0");

// 2. SalaryStructure expansion
addColumnIfNotExists('SalaryStructure', 'baseSalaryType', "TEXT DEFAULT 'Fixed'");
addColumnIfNotExists('SalaryStructure', 'baseSalaryAmount', "REAL DEFAULT 0.00");
addColumnIfNotExists('SalaryStructure', 'isCTCStructure', "INTEGER DEFAULT 1");
addColumnIfNotExists('SalaryStructure', 'ctcMinimum', "REAL DEFAULT 0.00");
addColumnIfNotExists('SalaryStructure', 'ctcMaximum', "REAL DEFAULT 0.00");
addColumnIfNotExists('SalaryStructure', 'pfEnabled', "INTEGER DEFAULT 1");
addColumnIfNotExists('SalaryStructure', 'pfEmployeeRate', "REAL DEFAULT 12.00");
addColumnIfNotExists('SalaryStructure', 'pfEmployerRate', "REAL DEFAULT 12.00");
addColumnIfNotExists('SalaryStructure', 'pfWageCeiling', "REAL DEFAULT 15000.00");
addColumnIfNotExists('SalaryStructure', 'esicEnabled', "INTEGER DEFAULT 1");
addColumnIfNotExists('SalaryStructure', 'esicEmployeeRate', "REAL DEFAULT 0.75");
addColumnIfNotExists('SalaryStructure', 'esicEmployerRate', "REAL DEFAULT 3.25");
addColumnIfNotExists('SalaryStructure', 'esicWageCeiling', "REAL DEFAULT 21000.00");
addColumnIfNotExists('SalaryStructure', 'ptEnabled', "INTEGER DEFAULT 1");
addColumnIfNotExists('SalaryStructure', 'ptConfiguration', "TEXT DEFAULT '{\"slabs\":[{\"limit\":15000,\"amount\":0},{\"limit\":20000,\"amount\":150},{\"limit\":999999999,\"amount\":200}]}'");
addColumnIfNotExists('SalaryStructure', 'tdsEnabled', "INTEGER DEFAULT 1");

// 3. SalaryComponent expansion
addColumnIfNotExists('SalaryComponent', 'calculationType', "TEXT DEFAULT 'Fixed'");
addColumnIfNotExists('SalaryComponent', 'percentageOf', "TEXT DEFAULT 'BaseSalary'");
addColumnIfNotExists('SalaryComponent', 'percentageValue', "REAL DEFAULT 0.0");
addColumnIfNotExists('SalaryComponent', 'formula', "TEXT DEFAULT ''");
addColumnIfNotExists('SalaryComponent', 'condition', "TEXT DEFAULT ''");
addColumnIfNotExists('SalaryComponent', 'isStatutory', "INTEGER DEFAULT 0");
addColumnIfNotExists('SalaryComponent', 'displayOrder', "INTEGER DEFAULT 0");

// 4. AttendanceRule expansion
addColumnIfNotExists('AttendanceRule', 'earlyCheckInBuffer', "INTEGER DEFAULT 60");
addColumnIfNotExists('AttendanceRule', 'lateCheckInBuffer', "INTEGER DEFAULT 120");
addColumnIfNotExists('AttendanceRule', 'halfDayAfterMinutes', "INTEGER DEFAULT 180");
addColumnIfNotExists('AttendanceRule', 'halfDayMinimumHours', "REAL DEFAULT 4.0");
addColumnIfNotExists('AttendanceRule', 'weeklyOffDays', "TEXT DEFAULT '[\"Saturday\",\"Sunday\"]'");
addColumnIfNotExists('AttendanceRule', 'autoCalculatePresent', "INTEGER DEFAULT 1");
addColumnIfNotExists('AttendanceRule', 'autoCalculateHalfDay', "INTEGER DEFAULT 1");
addColumnIfNotExists('AttendanceRule', 'autoCalculateOvertime', "INTEGER DEFAULT 0");
addColumnIfNotExists('AttendanceRule', 'overtimeAfterHours', "REAL DEFAULT 8.0");
addColumnIfNotExists('AttendanceRule', 'overtimeRate', "REAL DEFAULT 1.5");
addColumnIfNotExists('AttendanceRule', 'breakDurationMinutes', "INTEGER DEFAULT 60");
addColumnIfNotExists('AttendanceRule', 'breakStartTime', "TEXT DEFAULT '13:00:00'");
addColumnIfNotExists('AttendanceRule', 'breakEndTime', "TEXT DEFAULT '14:00:00'");

// 5. Create AuditLog table
db.prepare(`
  CREATE TABLE IF NOT EXISTS AuditLog (
    id TEXT PRIMARY KEY,
    employeeId TEXT,
    actionType TEXT NOT NULL,
    moduleKey TEXT NOT NULL,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    beforeState TEXT,
    afterState TEXT,
    changes TEXT,
    description TEXT NOT NULL,
    ipAddress TEXT,
    retentionUntil TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )
`).run();

console.log('Master Enterprise HRMS schema migration completed successfully!');
