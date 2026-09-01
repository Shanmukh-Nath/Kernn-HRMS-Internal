import 'dotenv/config';
import { getMongoDb } from '../lib/mongodb';

async function checkEmployees() {
  const db = await getMongoDb();
  const employees = await db.collection('employees').find({}).toArray();
  console.log('--- EMPLOYEES ---');
  for (const emp of employees) {
    console.log(`ID: ${emp.id || emp._id} | Code: ${emp.employeeCode} | DeviceUserID: ${emp.deviceUserId} | Name: ${emp.name}`);
  }

  const punches = await db.collection('attendance_events').find({ deviceUserId: '1' }).toArray();
  console.log(`--- ATTENDANCE EVENTS FOR USER 1 (${punches.length} records) ---`);
  for (const p of punches) {
    console.log(`Event ID: ${p.id || p._id} | EmployeeId: ${p.employeeId} | Timestamp: ${p.timestamp}`);
  }

  process.exit(0);
}

checkEmployees().catch(console.error);
