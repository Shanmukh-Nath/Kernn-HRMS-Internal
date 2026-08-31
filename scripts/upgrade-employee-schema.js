const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('prisma/dev.db');

const colsToAdd = [
  { name: 'gender', type: "TEXT DEFAULT 'Male'" },
  { name: 'bloodGroup', type: 'TEXT' },
  { name: 'maritalStatus', type: "TEXT DEFAULT 'Single'" },
  { name: 'emergencyContactName', type: 'TEXT' },
  { name: 'emergencyContactPhone', type: 'TEXT' },
  { name: 'emergencyContactRelation', type: 'TEXT' },
  { name: 'address', type: 'TEXT' },
  { name: 'bankName', type: 'TEXT' },
  { name: 'accountHolderName', type: 'TEXT' },
  { name: 'probationPeriod', type: 'INTEGER DEFAULT 6' },
  { name: 'workShift', type: "TEXT DEFAULT 'Day'" },
  { name: 'expectedWorkHours', type: 'REAL DEFAULT 8.0' },
  { name: 'qualificationsJson', type: "TEXT DEFAULT '[]'" },
  { name: 'experienceJson', type: "TEXT DEFAULT '[]'" },
  { name: 'ctcAmount', type: 'REAL DEFAULT 0' }
];

const existing = new Set(db.prepare('PRAGMA table_info(Employee)').all().map(c => c.name));

for (const col of colsToAdd) {
  if (!existing.has(col.name)) {
    try {
      db.prepare(`ALTER TABLE Employee ADD COLUMN ${col.name} ${col.type}`).run();
      console.log('Added column:', col.name);
    } catch (e) {
      console.log('Error on', col.name, e.message);
    }
  } else {
    console.log('Already exists:', col.name);
  }
}
console.log('Employee table upgrade complete!');
