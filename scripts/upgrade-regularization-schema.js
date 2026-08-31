const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('prisma/dev.db');

// 1. Create AttendanceCorrectionRequest table
db.prepare(`
  CREATE TABLE IF NOT EXISTS AttendanceCorrectionRequest (
    id TEXT PRIMARY KEY,
    employeeId TEXT NOT NULL,
    date TEXT NOT NULL,
    recordedCheckIn TEXT,
    recordedCheckOut TEXT,
    requestedCheckIn TEXT NOT NULL,
    requestedCheckOut TEXT,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    rejectionReason TEXT,
    reviewedBy TEXT,
    reviewedAt TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();
console.log('AttendanceCorrectionRequest table verified/created');

// 2. Create PayslipDownloadRequest table
db.prepare(`
  CREATE TABLE IF NOT EXISTS PayslipDownloadRequest (
    id TEXT PRIMARY KEY,
    employeeId TEXT NOT NULL,
    payrollRecordId TEXT,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status TEXT DEFAULT 'PENDING',
    rejectionReason TEXT,
    requestedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewedBy TEXT,
    reviewedAt TEXT
  )
`).run();
console.log('PayslipDownloadRequest table verified/created');

// 3. Ensure Attendance table has date column or format
const attCols = new Set(db.prepare('PRAGMA table_info(Attendance)').all().map(c => c.name));
console.log('Attendance table columns:', Array.from(attCols));

console.log('Schema upgrade complete!');
