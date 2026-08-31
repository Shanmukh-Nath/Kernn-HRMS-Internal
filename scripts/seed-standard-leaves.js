const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
const db = new DatabaseSync(dbPath);

console.log('Seeding / standardizing primary leave types (CL, SL, EL, ML)...');

// 1. CL (Casual Leave)
const existingCL = db.prepare("SELECT id FROM LeaveType WHERE code = 'CL'").get();
if (!existingCL) {
  db.prepare(`
    INSERT INTO LeaveType (id, name, code, description, category, defaultDaysPerYear, daysPerYear, isPaid, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run('lt_cl', 'Casual Leave', 'CL', 'For personal affairs, urgent domestic work, family events, and marriages.', 'Casual', 12, 12, new Date().toISOString());
} else {
  db.prepare("UPDATE LeaveType SET name = 'Casual Leave', description = 'For personal affairs, urgent domestic work, family events, and marriages.', category = 'Casual' WHERE code = 'CL'").run();
}

// 2. SL (Sick Leave)
const existingSL = db.prepare("SELECT id FROM LeaveType WHERE code = 'SL'").get();
if (!existingSL) {
  db.prepare(`
    INSERT INTO LeaveType (id, name, code, description, category, defaultDaysPerYear, daysPerYear, isPaid, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run('lt_sl', 'Sick Leave', 'SL', 'For short unexpected sickness, routine viral/fever, and recovery.', 'Medical', 10, 10, new Date().toISOString());
} else {
  db.prepare("UPDATE LeaveType SET name = 'Sick Leave', description = 'For short unexpected sickness, routine viral/fever, and recovery.', category = 'Medical' WHERE code = 'SL'").run();
}

// 3. EL (Earned Leave)
const existingEL = db.prepare("SELECT id FROM LeaveType WHERE code = 'EL'").get();
if (!existingEL) {
  const existingPL = db.prepare("SELECT id FROM LeaveType WHERE code = 'PL'").get();
  if (existingPL) {
    db.prepare("UPDATE LeaveType SET name = 'Earned Leave', code = 'EL', description = 'Annual privilege accrued vacation leave.', category = 'Earned' WHERE code = 'PL'").run();
  } else {
    db.prepare(`
      INSERT INTO LeaveType (id, name, code, description, category, defaultDaysPerYear, daysPerYear, isPaid, allowCarryForward, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
    `).run('lt_el', 'Earned Leave', 'EL', 'Annual privilege accrued vacation leave.', 'Earned', 15, 15, new Date().toISOString());
  }
}

// 4. ML (Medical Leave - Mandatory Doctor Prescription / Certificate)
const existingML = db.prepare("SELECT id FROM LeaveType WHERE code = 'ML'").get();
if (!existingML) {
  db.prepare(`
    INSERT INTO LeaveType (
      id, name, code, description, category, defaultDaysPerYear, daysPerYear,
      isPaid, requireProofDocument, requiresMedicalCertificate,
      proofDocumentLabel, proofThresholdDays, medicalCertificateAfterDays,
      createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 'Doctor Prescription & Hospital Certificate', 1, 1, ?)
  `).run('lt_ml', 'Medical Leave', 'ML', 'Medical indisposition requiring doctor prescription and diagnosis certificate.', 'Medical', 15, 15, new Date().toISOString());
} else {
  db.prepare(`
    UPDATE LeaveType
    SET name = 'Medical Leave',
        description = 'Medical indisposition requiring doctor prescription and diagnosis certificate.',
        requireProofDocument = 1,
        requiresMedicalCertificate = 1,
        proofDocumentLabel = 'Doctor Prescription & Hospital Certificate',
        proofThresholdDays = 1,
        medicalCertificateAfterDays = 1
    WHERE code = 'ML'
  `).run();
}

const all = db.prepare("SELECT id, name, code, category, requireProofDocument, proofDocumentLabel FROM LeaveType").all();
console.log('Current Leave Types:', all);
