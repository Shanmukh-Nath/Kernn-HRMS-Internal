import 'dotenv/config';
import { getMongoDb } from '../lib/mongodb';

async function fixManasa() {
  const db = await getMongoDb();
  console.log('Searching for Manasa manual punch on 2026-09-01...');

  const events = await db.collection('attendance_events').find({
    source: 'MANUAL_ENTRY'
  }).toArray();

  console.log(`Found ${events.length} manual entry events.`);
  for (const ev of events) {
    // Correct to 10:10:00 AM IST (2026-09-01T04:40:00.000Z)
    const correctedIso = '2026-09-01T04:40:00.000Z';
    await db.collection('attendance_events').updateOne(
      { _id: ev._id },
      { $set: { timestamp: new Date(correctedIso) } }
    );
    console.log(`Updated manual punch for ${ev.deviceUserId} to ${correctedIso} (10:10:00 AM IST)`);
  }

  process.exit(0);
}

fixManasa().catch((e) => {
  console.error(e);
  process.exit(1);
});
