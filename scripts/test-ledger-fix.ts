import { attendanceEventsCol, attendanceRegularizationsCol, employeesCol, leaveRequestsCol, leaveTypesCol, devicesCol } from '../lib/mongodb';
import { parseAppDate } from '../lib/timezone';

async function testLedger() {
  const empCol = await employeesCol();
  const attCol = await attendanceEventsCol();
  const regCol = await attendanceRegularizationsCol();

  const employee = await empCol.findOne({ name: /Manasa/i });
  if (!employee) return;

  const rawEvents = await attCol
    .find({
      $or: [
        { employeeId: employee.id },
        ...(employee.deviceUserId ? [{ deviceUserId: String(employee.deviceUserId) }] : []),
      ],
    })
    .sort({ timestamp: 1 })
    .toArray();

  const regularizations = await regCol
    .find({ employeeId: employee.id })
    .sort({ date: -1 })
    .toArray();

  const regByDate = new Map<string, any>();
  regularizations.forEach((r) => {
    const existing = regByDate.get(r.date);
    if (!existing || r.status === 'APPROVED' || (existing.status !== 'APPROVED' && r.status === 'PENDING')) {
      regByDate.set(r.date, r);
    }
  });

  const eventsByDate = new Map<string, any[]>();
  for (const ev of rawEvents) {
    const d = parseAppDate(ev.timestamp);
    const istDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    if (!eventsByDate.has(istDate)) {
      eventsByDate.set(istDate, []);
    }
    eventsByDate.get(istDate)!.push(ev);
  }

  console.log('Events dates found:', Array.from(eventsByDate.keys()));
  console.log('Reg dates found:', Array.from(regByDate.keys()).map(k => ({ date: k, status: regByDate.get(k).status })));

  for (const dateStr of ['2026-09-01', '2026-09-02']) {
    const dateEvents = eventsByDate.get(dateStr) || [];
    const reg = regByDate.get(dateStr);
    console.log(`\nDate: ${dateStr}`);
    console.log(`Raw events count: ${dateEvents.length}`);
    console.log(`Reg:`, reg ? { status: reg.status, in: reg.requestedCheckIn, out: reg.requestedCheckOut } : 'None');
  }

  process.exit(0);
}

testLedger().catch(console.error);
