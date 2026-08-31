import { getMongoDb } from '../lib/mongodb';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

async function main() {
  console.log('====================================================');
  console.log('1. INSPECTING SQLITE (prisma/dev.db)');
  console.log('====================================================');
  const sqlite = new DatabaseSync(path.join(process.cwd(), 'prisma', 'dev.db'));
  const tables: any = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  
  for (const t of tables) {
    try {
      const count: any = sqlite.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get();
      const samples: any = sqlite.prepare(`SELECT * FROM "${t.name}" LIMIT 3`).all();
      console.log(`\nTable: [${t.name}] -> Count: ${count.c}`);
      console.log('Sample rows:', JSON.stringify(samples, null, 2));
    } catch (err: any) {
      console.log(`Table ${t.name} error:`, err.message);
    }
  }

  console.log('\n====================================================');
  console.log('2. INSPECTING MONGODB ATLAS');
  console.log('====================================================');
  try {
    const mongo = await getMongoDb();
    const cols = await mongo.listCollections().toArray();
    for (const c of cols) {
      const count = await mongo.collection(c.name).countDocuments();
      const samples = await mongo.collection(c.name).find({}).limit(3).toArray();
      console.log(`\nCollection: [${c.name}] -> Count: ${count}`);
      console.log('Sample docs:', JSON.stringify(samples, null, 2));
    }
  } catch (err: any) {
    console.error('Mongo Atlas connection error:', err.message);
  }
}

main();
