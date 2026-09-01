import { leaveTypesCol } from '../lib/mongodb';

async function seedCompOff() {
  console.log('[Seed] Seeding COMP_OFF leave type to MongoDB Atlas...');
  const ltCol = await leaveTypesCol();

  const compOffData = {
    id: 'lt_compoff',
    name: 'Compensatory Off',
    code: 'COMP_OFF',
    category: 'Compensatory',
    daysPerYear: 0, // Starts at 0, earned only by working on weekends/holidays
    defaultDaysPerYear: 0,
    accrualFrequency: 'ON_DEMAND',
    accrualEnabled: false,
    isPaid: true,
    allowNegativeBalance: false,
    negativeBalanceLimit: 0,
    maxAccumulation: 10,
    allowCarryForward: false,
    carryForwardLimit: 0,
    allowEncashment: false,
    colorHex: '#F59E0B', // Amber
    description: 'Earned by working on declared weekends (Saturday/Sunday) or public holidays. Balance increases only upon approved weekend work claims.',
    updatedAt: new Date(),
  };

  await ltCol.updateOne(
    { code: 'COMP_OFF' },
    {
      $set: compOffData,
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  console.log('[Seed] COMP_OFF leave type successfully registered in MongoDB Atlas!');
  process.exit(0);
}

seedCompOff().catch((err) => {
  console.error('[Seed] Error seeding COMP_OFF:', err);
  process.exit(1);
});
