const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('prisma/dev.db');

// 1. Add columns to LeaveBalance if not existing
const lbCols = new Set(db.prepare('PRAGMA table_info(LeaveBalance)').all().map(c => c.name));
if (!lbCols.has('carriedForward')) {
  db.prepare('ALTER TABLE LeaveBalance ADD COLUMN carriedForward REAL DEFAULT 0').run();
  console.log('Added carriedForward to LeaveBalance');
}
if (!lbCols.has('lastAccrualDate')) {
  db.prepare('ALTER TABLE LeaveBalance ADD COLUMN lastAccrualDate TEXT').run();
  console.log('Added lastAccrualDate to LeaveBalance');
}
if (!lbCols.has('lastAccrualCycle')) {
  db.prepare('ALTER TABLE LeaveBalance ADD COLUMN lastAccrualCycle TEXT').run();
  console.log('Added lastAccrualCycle to LeaveBalance');
}

// 2. Create LeaveAccrualLog table for complete auditability
db.prepare(`
  CREATE TABLE IF NOT EXISTS LeaveAccrualLog (
    id TEXT PRIMARY KEY,
    leaveTypeId TEXT NOT NULL,
    employeeId TEXT NOT NULL,
    cycle TEXT NOT NULL,
    frequency TEXT NOT NULL,
    creditedAmount REAL NOT NULL,
    previousBalance REAL NOT NULL,
    newBalance REAL NOT NULL,
    cappedAtMaximum INTEGER DEFAULT 0,
    executedBy TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

console.log('Leave Accrual schema upgrade successful!');
