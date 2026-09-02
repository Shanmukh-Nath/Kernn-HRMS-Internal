import { attendanceEventsCol, employeesCol } from '../lib/mongodb';
import { parseAppDate, formatAppTime12 } from '../lib/timezone';

async function main() {
  const empCol = await employeesCol();
  const attCol = await attendanceEventsCol();

  const employee = await empCol.findOne({ name: /Manasa/i });
  if (!employee) return;

  const rawEvents = await attCol
    .find({
      $or: [
        { employeeId: employee.id },
        ...(employee.deviceUserId ? [{ deviceUserId: String(employee.deviceUserId) }] : []),
      ],
    })
    .toArray();

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

  for (const [dateKey, evList] of eventsByDate.entries()) {
    evList.sort((a, b) => parseAppDate(a.timestamp).getTime() - parseAppDate(b.timestamp).getTime());
    console.log(`\nDate: ${dateKey}`);
    evList.forEach((e, idx) => {
      const d = parseAppDate(e.timestamp);
      console.log(`  [${idx}] Raw: "${e.timestamp}" -> Parsed IST: ${formatAppTime12(d)} (${d.toISOString()})`);
    });
    const firstIn = evList.length > 0 ? parseAppDate(evList[0].timestamp) : null;
    const lastOut = evList.length > 1 ? parseAppDate(evList[evList.length - 1].timestamp) : null;
    console.log(`  => In: ${firstIn ? formatAppTime12(firstIn) : '--'}, Out: ${lastOut ? formatAppTime12(lastOut) : '--'}`);
  }

  process.exit(0);
}

main().catch(console.error);
