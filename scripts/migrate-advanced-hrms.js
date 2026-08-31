const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(process.cwd(), 'prisma', 'dev.db'));

// Helper to safely add column if not exists
function addColumnIfNotExists(table, columnDef, colName) {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`).run();
    console.log(`Added column ${colName} to ${table}`);
  } catch (err) {
    if (!err.message.includes('duplicate column name')) {
      console.log(`Column ${colName} might already exist in ${table}`);
    }
  }
}

// 1. Create SalaryStructure & SalaryComponent tables
db.prepare(`
  CREATE TABLE IF NOT EXISTS SalaryStructure (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    isDefault INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS SalaryComponent (
    id TEXT PRIMARY KEY,
    structureId TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'EARNING' or 'DEDUCTION'
    calcType TEXT NOT NULL, -- 'FLAT', 'PERCENTAGE_BASIC', 'PERCENTAGE_GROSS'
    value REAL NOT NULL,
    isTaxable INTEGER DEFAULT 1,
    isMandatory INTEGER DEFAULT 0,
    FOREIGN KEY (structureId) REFERENCES SalaryStructure(id) ON DELETE CASCADE
  );
`).run();

// 2. Expand Employee table with salaryStructureId
addColumnIfNotExists('Employee', 'salaryStructureId TEXT', 'salaryStructureId');

// 3. Expand LeaveType with granular rules
addColumnIfNotExists('LeaveType', 'minDaysPerRequest REAL DEFAULT 1', 'minDaysPerRequest');
addColumnIfNotExists('LeaveType', 'maxConsecutiveDays REAL DEFAULT 5', 'maxConsecutiveDays');
addColumnIfNotExists('LeaveType', 'priorNoticeDays INTEGER DEFAULT 0', 'priorNoticeDays');
addColumnIfNotExists('LeaveType', 'requireProofDocument INTEGER DEFAULT 0', 'requireProofDocument');
addColumnIfNotExists('LeaveType', 'allowHalfDay INTEGER DEFAULT 1', 'allowHalfDay');
addColumnIfNotExists('LeaveType', 'carryForwardLimit REAL DEFAULT 0', 'carryForwardLimit');
addColumnIfNotExists('LeaveType', 'encashable INTEGER DEFAULT 0', 'encashable');
addColumnIfNotExists('LeaveType', 'applicableGender TEXT DEFAULT "ALL"', 'applicableGender');

// 4. Expand PayrollRecord with review and lock workflow
addColumnIfNotExists('PayrollRecord', 'status TEXT DEFAULT "DRAFT_PENDING_APPROVAL"', 'status');
addColumnIfNotExists('PayrollRecord', 'approvedBy TEXT', 'approvedBy');
addColumnIfNotExists('PayrollRecord', 'approvedAt TEXT', 'approvedAt');
addColumnIfNotExists('PayrollRecord', 'auditNotes TEXT', 'auditNotes');
addColumnIfNotExists('PayrollRecord', 'lineItemsJson TEXT', 'lineItemsJson');

// 5. Expand Holiday with categories and floating policy
addColumnIfNotExists('Holiday', 'type TEXT DEFAULT "GAZETTED"', 'type');
addColumnIfNotExists('Holiday', 'applicableDept TEXT DEFAULT "ALL"', 'applicableDept');
addColumnIfNotExists('Holiday', 'isOptional INTEGER DEFAULT 0', 'isOptional');

db.prepare(`
  CREATE TABLE IF NOT EXISTS HolidayClaim (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    holidayId TEXT NOT NULL,
    status TEXT DEFAULT 'APPROVED',
    claimedAt TEXT NOT NULL,
    UNIQUE(userId, holidayId)
  );
`).run();

// 6. Expand Announcement with targeting and acknowledgements
addColumnIfNotExists('Announcement', 'category TEXT DEFAULT "NOTICE"', 'category');
addColumnIfNotExists('Announcement', 'targetDept TEXT DEFAULT "ALL"', 'targetDept');
addColumnIfNotExists('Announcement', 'isPinned INTEGER DEFAULT 0', 'isPinned');
addColumnIfNotExists('Announcement', 'requiresAcknowledgement INTEGER DEFAULT 0', 'requiresAcknowledgement');

db.prepare(`
  CREATE TABLE IF NOT EXISTS AnnouncementAck (
    id TEXT PRIMARY KEY,
    announcementId TEXT NOT NULL,
    userId TEXT NOT NULL,
    acknowledgedAt TEXT NOT NULL,
    UNIQUE(announcementId, userId)
  );
`).run();

// 7. Seed Initial Salary Structures:
// - Standard Full-Time Software Engineer
// - Management Executive
// - Internship / Stipend
const existingStruct = db.prepare(`SELECT count(*) as c FROM SalaryStructure`).get();
if (!existingStruct || existingStruct.c === 0) {
  const now = new Date().toISOString();

  // Structure A: Standard Full-Time
  const fteId = 'struct_fte_standard';
  db.prepare(`
    INSERT INTO SalaryStructure (id, name, description, isDefault, createdAt, updatedAt)
    VALUES (?, 'Standard Full-Time Employee (FTE)', 'Default comprehensive structure with statutory PF, ESI, HRA, and allowances', 1, ?, ?)
  `).run(fteId, now, now);

  const fteComponents = [
    { name: 'Basic Salary', type: 'EARNING', calcType: 'FLAT', value: 35000, isTaxable: 1, isMandatory: 1 },
    { name: 'House Rent Allowance (HRA)', type: 'EARNING', calcType: 'PERCENTAGE_BASIC', value: 40, isTaxable: 0, isMandatory: 1 },
    { name: 'Special Allowance', type: 'EARNING', calcType: 'FLAT', value: 10000, isTaxable: 1, isMandatory: 0 },
    { name: 'Provident Fund (Employee)', type: 'DEDUCTION', calcType: 'PERCENTAGE_BASIC', value: 12, isTaxable: 0, isMandatory: 1 },
    { name: 'ESIC Employee Contribution', type: 'DEDUCTION', calcType: 'PERCENTAGE_GROSS', value: 0.75, isTaxable: 0, isMandatory: 1 },
    { name: 'Professional Tax (PT)', type: 'DEDUCTION', calcType: 'FLAT', value: 200, isTaxable: 0, isMandatory: 1 },
  ];

  for (const c of fteComponents) {
    db.prepare(`
      INSERT INTO SalaryComponent (id, structureId, name, type, calcType, value, isTaxable, isMandatory)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('comp_' + Math.random().toString(36).substring(2, 10), fteId, c.name, c.type, c.calcType, c.value, c.isTaxable, c.isMandatory);
  }

  // Structure B: Internship / Stipend (No statutory PF/ESI, pure fixed stipend + transport allowance)
  const internId = 'struct_intern';
  db.prepare(`
    INSERT INTO SalaryStructure (id, name, description, isDefault, createdAt, updatedAt)
    VALUES (?, 'Internship & Research Trainee', 'Stipend-based payroll exempt from PF/ESI statutory contributions with fixed allowances', 0, ?, ?)
  `).run(internId, now, now);

  const internComponents = [
    { name: 'Monthly Learning Stipend', type: 'EARNING', calcType: 'FLAT', value: 18000, isTaxable: 1, isMandatory: 1 },
    { name: 'Commute & Internet Allowance', type: 'EARNING', calcType: 'FLAT', value: 3000, isTaxable: 0, isMandatory: 0 },
    { name: 'TDS (Intern Withholding Tax)', type: 'DEDUCTION', calcType: 'PERCENTAGE_GROSS', value: 1.0, isTaxable: 0, isMandatory: 0 },
  ];

  for (const c of internComponents) {
    db.prepare(`
      INSERT INTO SalaryComponent (id, structureId, name, type, calcType, value, isTaxable, isMandatory)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('comp_' + Math.random().toString(36).substring(2, 10), internId, c.name, c.type, c.calcType, c.value, c.isTaxable, c.isMandatory);
  }

  // Assign default structure to all existing employees
  db.prepare(`UPDATE Employee SET salaryStructureId = ? WHERE salaryStructureId IS NULL`).run(fteId);
  console.log('Seeded initial salary structures and assigned to existing employees.');
}

// 8. Update LeaveTypes with minute realistic policies
// Medical Leave: minimum 2 days, 0 prior notice (immediate), requires document proof
db.prepare(`
  UPDATE LeaveType 
  SET minDaysPerRequest = 2, maxConsecutiveDays = 14, priorNoticeDays = 0, requireProofDocument = 1, carryForwardLimit = 0
  WHERE code = 'SL' OR name LIKE '%Sick%' OR name LIKE '%Medical%'
`).run();

// Casual Leave: at least 7 days advance notice, max 3 consecutive days, cannot carry forward
db.prepare(`
  UPDATE LeaveType 
  SET minDaysPerRequest = 1, maxConsecutiveDays = 3, priorNoticeDays = 7, requireProofDocument = 0, carryForwardLimit = 0
  WHERE code = 'CL' OR name LIKE '%Casual%'
`).run();

// Paid / Earned Leave: at least 14 days advance notice, can carry forward up to 15 days
db.prepare(`
  UPDATE LeaveType 
  SET minDaysPerRequest = 1, maxConsecutiveDays = 10, priorNoticeDays = 14, requireProofDocument = 0, carryForwardLimit = 15, encashable = 1
  WHERE code = 'PL' OR name LIKE '%Paid%'
`).run();

// 9. Update sample holidays to include Optional / Restricted category
db.prepare(`
  UPDATE Holiday SET type = 'RESTRICTED_OPTIONAL', isOptional = 1 WHERE name LIKE '%Maha Shivratri%' OR name LIKE '%Eid%' OR name LIKE '%Raksha%'
`).run();

console.log('✅ Advanced HRMS migration completed successfully!');
