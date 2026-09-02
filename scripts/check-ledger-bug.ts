import { attendanceEventsCol, attendanceRegularizationsCol, employeesCol } from '../lib/mongodb';
import { parseAppDate, formatAppDate } from '../lib/timezone';

async function main() {
  const attCol = await attendanceEventsCol();
  const regCol = await attendanceRegularizationsCol();
  const empCol = await employeesCol();

  const manasa = await empCol.findOne({ name: /Manasa/i });
  console.log('Manasa:', manasa);

  const evs = await attCol.find({}).toArray();
  console.log('All events with dates:');
  evs.forEach(e => {
    const d = parseAppDate(e.timestamp);
    console.log(`- empId: ${e.employeeId}, devUserId: ${e.deviceUserId}, raw: ${e.timestamp}, istDate: ${formatAppDate(d)}, iso: ${d.toISOString()}`);
  });

  const regs = await regCol.find({ employeeId: manasa?.id }).toArray();
  console.log('Manasa Regs:', regs);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
