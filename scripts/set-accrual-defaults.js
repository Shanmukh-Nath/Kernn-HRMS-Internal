const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('prisma/dev.db');

// Update EL to monthly 1.25 days accrual (15 days/year standard)
db.prepare(`
  UPDATE LeaveType
  SET accrualEnabled = 1, accrualFrequency = 'Monthly', accrualAmount = 1.25, maxAccumulation = 45, allowCarryForward = 1, carryForwardLimit = 30, allowEncashment = 1
  WHERE code = 'EL'
`).run();

// Update CL to monthly 1.0 day accrual (12 days/year)
db.prepare(`
  UPDATE LeaveType
  SET accrualEnabled = 1, accrualFrequency = 'Monthly', accrualAmount = 1.0, maxAccumulation = 18, allowCarryForward = 1, carryForwardLimit = 6
  WHERE code = 'CL'
`).run();

console.log('Updated leave accrual policies:');
console.log(db.prepare('SELECT name, code, accrualEnabled, accrualFrequency, accrualAmount, maxAccumulation FROM LeaveType').all());
