import 'dotenv/config';
import { getMongoDb } from '../lib/mongodb';

async function fixTimestamps() {
  console.log('Connecting to MongoDB...');
  const db = await getMongoDb();
  const events = await db.collection('attendance_events').find({}).toArray();
  console.log(`Found ${events.length} attendance events.`);

  let updated = 0;
  for (const evt of events) {
    const rawTs = evt.timestamp;
    if (typeof rawTs === 'string' && rawTs.endsWith('Z')) {
      // If the string was saved with double UTC offset (+5:30 ahead)
      // Check if it matches 2026-09-01
      const d = new Date(rawTs);
      // If hours are between 15:00 and 23:00 on Sept 1st when punches were in morning/afternoon (10:00 to 15:00):
      // Subtract 5 hours 30 minutes (330 minutes)
      const correctedMs = d.getTime() - (5 * 60 + 30) * 60 * 1000;
      const correctedIso = new Date(correctedMs).toISOString();

      await db.collection('attendance_events').updateOne(
        { _id: evt._id },
        { $set: { timestamp: correctedIso } }
      );
      console.log(`Shifted ${evt.deviceUserId}: ${rawTs} -> ${correctedIso}`);
      updated++;
    }
  }

  console.log(`Updated ${updated} events.`);
  process.exit(0);
}

fixTimestamps().catch((err) => {
  console.error('Error fixing timestamps:', err);
  process.exit(1);
});
