import { employeesCol, usersCol, rolesCol, attendanceEventsCol } from '../lib/mongodb';

async function mergeUsers() {
  console.log('--- MERGING DUPLICATE EMPLOYEE ACCOUNTS ---');
  const employees = await employeesCol();
  const users = await usersCol();
  const roles = await rolesCol();
  const attendance = await attendanceEventsCol();

  const allEmps = await employees.find({}).toArray();
  console.log('Current employees in DB:');
  allEmps.forEach(e => console.log(`- ID: ${e.id}, Name: ${e.name}, Code: ${e.employeeCode}, DeviceUserId: ${e.deviceUserId}, Mobile: ${e.mobileNumber}`));

  const allUsers = await users.find({}).toArray();
  console.log('\nCurrent users in DB:');
  allUsers.forEach(u => console.log(`- ID: ${u.id}, Name: ${u.name}, Role: ${u.role}, Mobile: ${u.mobileNumber}, EmployeeId: ${u.employeeId}`));

  const superAdminRole = await roles.findOne({ name: 'SUPER_ADMIN' });
  const superAdminRoleId = superAdminRole?.id || 'role_super_admin';

  // Find Vamshi's employee account
  const vamshi = allEmps.find(e => 
    (e.name && e.name.toLowerCase().includes('vamshi')) ||
    (e.mobileNumber && e.mobileNumber.includes('8919988709'))
  );

  // Find duplicate "shanmukh nath"
  const duplicateShanmukh = allEmps.find(e =>
    e.id !== vamshi?.id &&
    e.name && e.name.toLowerCase() === 'shanmukh nath'
  );

  if (duplicateShanmukh) {
    console.log(`\nRemoving duplicate employee: ${duplicateShanmukh.name} (${duplicateShanmukh.id})`);
    await employees.deleteOne({ id: duplicateShanmukh.id });
  }

  if (vamshi) {
    console.log(`\nUpdating Vamshi's profile: deviceUserId = "6", role = SUPER_ADMIN`);
    await employees.updateOne(
      { id: vamshi.id },
      {
        $set: {
          deviceUserId: '6',
          employeeCode: 'EMP-001',
          name: 'Vamshi Shanmukh Nath Seleswaram',
          department: 'Management',
          designation: 'Managing Director / Super Admin',
          roleId: superAdminRoleId,
          roleName: 'SUPER_ADMIN',
          status: 'ACTIVE',
        }
      }
    );

    // Update attendance events with employeeId if deviceUserId is 6
    await attendance.updateMany(
      { deviceUserId: '6' },
      { $set: { employeeId: vamshi.id } }
    );

    // Update Vamshi's user account
    await users.updateOne(
      { $or: [{ employeeId: vamshi.id }, { mobileNumber: '8919988709' }, { mobileNumber: vamshi.mobileNumber }] },
      {
        $set: {
          employeeId: vamshi.id,
          name: 'Vamshi Shanmukh Nath Seleswaram',
          role: 'SUPER_ADMIN',
          roleId: superAdminRoleId,
          status: 'ACTIVE',
        }
      }
    );
    console.log('✓ Vamshi user account updated to SUPER_ADMIN linked to employeeId', vamshi.id);
  }

  console.log('\n--- MERGE COMPLETE ---');
  process.exit(0);
}

mergeUsers().catch(err => {
  console.error('Error during merge:', err);
  process.exit(1);
});
