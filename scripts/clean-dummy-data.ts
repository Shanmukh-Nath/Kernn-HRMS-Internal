import { getMongoDb } from '../lib/mongodb';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

async function cleanData() {
  console.log('====================================================');
  console.log('1. CLEANING SQLITE (prisma/dev.db)');
  console.log('====================================================');
  const sqlite = new DatabaseSync(path.join(process.cwd(), 'prisma', 'dev.db'));

  // Clean dummy attendance records (December 2024 seed data and test logs)
  try {
    const delAtt = sqlite.prepare("DELETE FROM AttendanceEvent WHERE timestamp LIKE '2024-12%' OR employeeId LIKE 'emp_dummy%'").run();
    console.log('✓ SQLite: Deleted dummy AttendanceEvents:', delAtt.changes);
  } catch (e: any) {
    console.log('AttendanceEvent clean:', e.message);
  }

  // Also clean old/dummy Punch records or Attendance table if present
  const tables: any = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  for (const t of tables) {
    if (['Attendance', 'AttendanceRecord', 'Punch'].includes(t.name)) {
      try {
        const res = sqlite.prepare(`DELETE FROM "${t.name}" WHERE timestamp LIKE '2024-12%'`).run();
        console.log(`✓ SQLite [${t.name}]: Deleted dummy records:`, res.changes);
      } catch (e: any) {
        console.log(`SQLite ${t.name} delete error:`, e.message);
      }
    }
  }

  // Clean dummy Payroll records
  try {
    const delPay = sqlite.prepare("DELETE FROM PayrollRecord WHERE month LIKE '2024%'").run();
    console.log('✓ SQLite: Deleted dummy PayrollRecords:', delPay.changes);
  } catch (e: any) {
    console.log('PayrollRecord clean:', e.message);
  }

  // Clean dummy Leaves
  try {
    const delLeave = sqlite.prepare("DELETE FROM LeaveRequest WHERE reason LIKE '%dummy%' OR reason LIKE '%test seed%'").run();
    console.log('✓ SQLite: Deleted dummy LeaveRequests:', delLeave.changes);
  } catch (e: any) {
    console.log('LeaveRequest clean:', e.message);
  }

  console.log('\n====================================================');
  console.log('2. CLEANING MONGODB ATLAS (secureye_hrms)');
  console.log('====================================================');
  try {
    const mongo = await getMongoDb();
    
    // Delete dummy attendance events in MongoDB
    const mongoAtt = await mongo.collection('attendance_events').deleteMany({
      $or: [
        { timestamp: { $regex: '^2024-12' } },
        { timestamp: { $regex: '^2024' } },
        { userId: { $in: ['dummy_1', 'dummy_2', 'dummy_3'] } }
      ]
    });
    console.log('✓ MongoDB: Deleted dummy attendance_events:', mongoAtt.deletedCount);

    // Delete dummy payroll records in MongoDB
    const mongoPay = await mongo.collection('payroll_records').deleteMany({
      $or: [
        { month: { $regex: '^2024' } },
        { status: 'DUMMY' }
      ]
    });
    console.log('✓ MongoDB: Deleted dummy payroll_records:', mongoPay.deletedCount);

    // Delete dummy leaves in MongoDB
    const mongoLeaves = await mongo.collection('leave_requests').deleteMany({
      $or: [
        { reason: { $regex: 'dummy|test seed|sample', $options: 'i' } }
      ]
    });
    console.log('✓ MongoDB: Deleted dummy leave_requests:', mongoLeaves.deletedCount);

    // Also check collection 'attendance' or 'punches' if any
    const cols = await mongo.listCollections().toArray();
    for (const c of cols) {
      if (['attendance', 'punches', 'attendance_logs'].includes(c.name)) {
        const d = await mongo.collection(c.name).deleteMany({
          timestamp: { $regex: '^2024' }
        });
        console.log(`✓ MongoDB [${c.name}]: Deleted dummy records:`, d.deletedCount);
      }
    }

  } catch (err: any) {
    console.error('MongoDB Atlas Clean Error:', err.message);
  }

  console.log('\n====================================================');
  console.log('DATABASE PURGE COMPLETE!');
  console.log('====================================================');
}

cleanData();
