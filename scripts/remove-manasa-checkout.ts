import { attendanceRegularizationsCol, attendanceEventsCol } from '../lib/mongodb';

async function removeCheckout() {
  const regCol = await attendanceRegularizationsCol();
  const attCol = await attendanceEventsCol();

  const res1 = await regCol.updateMany(
    { date: '2026-09-02', employeeId: 'cl487sxp2drmtiivbgv' },
    { $set: { requestedCheckOut: null, adjustmentType: 'CHECK_IN' } }
  );

  const res2 = await attCol.deleteMany({
    employeeId: 'cl487sxp2drmtiivbgv',
    eventType: 'CHECK_OUT',
  });

  console.log('✓ Manasa 2nd Sept regularization updated, checkout removed:', res1.modifiedCount);
  console.log('✓ Manasa check_out events deleted:', res2.deletedCount);
  process.exit(0);
}

removeCheckout().catch((err) => {
  console.error(err);
  process.exit(1);
});
