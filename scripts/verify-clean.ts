import { DatabaseSync } from 'node:sqlite';
import path from 'path';

async function main() {
  const db = new DatabaseSync(path.join(process.cwd(), 'prisma', 'dev.db'));
  const counts: any = {
    attendanceEvents: db.prepare('SELECT COUNT(*) as c FROM AttendanceEvent').get(),
    employees: db.prepare('SELECT COUNT(*) as c FROM Employee').get(),
    users: db.prepare('SELECT COUNT(*) as c FROM User').get(),
    leaveRequests: db.prepare('SELECT COUNT(*) as c FROM LeaveRequest').get(),
    payrollRecords: db.prepare('SELECT COUNT(*) as c FROM PayrollRecord').get(),
    hardwareAudit: db.prepare('SELECT COUNT(*) as c FROM HardwareAuditLog').get(),
  };

  console.log('Clean Database Counts:', JSON.stringify(counts, null, 2));

  // Check recent records
  const sampleAtt: any = db.prepare('SELECT * FROM AttendanceEvent ORDER BY timestamp DESC LIMIT 5').all();
  console.log('Sample Attendance Events remaining:', sampleAtt);
}

main();
