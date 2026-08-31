import { prisma } from '../lib/prisma';
import { syncDeviceViaNativeDriver } from '../server/secureye/native-bridge';

async function syncAll() {
  console.log('================================================================');
  console.log('🚀 Running Full S-FB3K Database Ingestion & Sync');
  console.log('================================================================\n');

  const device = await prisma.device.findFirst({
    where: { ipAddress: '192.168.29.83' },
  });

  if (!device) {
    console.error('Device 192.168.29.83 not found in database.');
    process.exit(1);
  }

  console.log(`Connecting to device ${device.name} at ${device.ipAddress}:${device.port}...`);
  const data = await syncDeviceViaNativeDriver(device.ipAddress, device.port, parseInt(device.deviceId, 10) || 1);

  console.log(`\n✅ Connected! Device Serial Number: ${data.serialNumber}`);
  console.log(`Found ${data.users.length} enrolled users and ${data.logs.length} attendance punch logs.\n`);

  // 1. Update device metadata
  await prisma.device.update({
    where: { id: device.id },
    data: {
      firmware: `S-FB3K (SN: ${data.serialNumber})`,
      status: 'ONLINE',
      lastSeenAt: new Date(),
      lastSyncAt: new Date(),
      userCount: data.users.length,
      logCount: data.logs.length,
    },
  });

  // 2. Ingest Users
  console.log('--- Ingesting Enrolled Users ---');
  for (const u of data.users) {
    const hasFp = u.backupNumbers.some((b) => b >= 0 && b <= 9);
    const hasPwd = u.backupNumbers.includes(17);
    const hasFace = u.backupNumbers.includes(50) || u.backupNumbers.some((b) => b >= 20 && b <= 30);

    const emp = await prisma.employee.upsert({
      where: {
        deviceId_deviceUserId: {
          deviceId: device.id,
          deviceUserId: u.userId,
        },
      },
      update: {
        name: u.name,
        privilege: u.privilege,
        fingerprintEnabled: hasFp,
        passwordEnabled: hasPwd,
        faceEnabled: hasFace,
        status: u.enabled ? 'ACTIVE' : 'INACTIVE',
        updatedAt: new Date(),
      },
      create: {
        deviceId: device.id,
        deviceUserId: u.userId,
        name: u.name,
        employeeCode: `EMP-${u.userId}`,
        privilege: u.privilege,
        fingerprintEnabled: hasFp,
        passwordEnabled: hasPwd,
        faceEnabled: hasFace,
        status: u.enabled ? 'ACTIVE' : 'INACTIVE',
      },
    });

    console.log(`   👤 User #${emp.deviceUserId}: ${emp.name} | Role: ${emp.privilege === 14 ? 'Admin' : 'User'} | FP: ${hasFp ? 'Yes' : 'No'} | Face: ${hasFace ? 'Yes' : 'No'}`);
  }

  // 3. Ingest Logs
  console.log('\n--- Ingesting Attendance Logs ---');
  let newLogs = 0;
  for (const log of data.logs) {
    const timestamp = new Date(log.timestamp);
    const emp = await prisma.employee.findUnique({
      where: {
        deviceId_deviceUserId: {
          deviceId: device.id,
          deviceUserId: log.userId,
        },
      },
    });

    const eventType = log.verifyMode === 1 ? 'CHECK_IN' : log.verifyMode === 2 ? 'CHECK_OUT' : 'GENERAL_PUNCH';
    const verificationType = log.verifyMode === 1 ? 'FINGERPRINT' : log.verifyMode === 407 ? 'FACE' : log.verifyMode === 1175 ? 'PASSWORD' : 'CARD';

    const existing = await prisma.attendanceEvent.findFirst({
      where: {
        deviceId: device.id,
        deviceUserId: log.userId,
        timestamp,
      },
    });

    if (!existing) {
      await prisma.attendanceEvent.create({
        data: {
          deviceId: device.id,
          deviceUserId: log.userId,
          employeeId: emp?.id,
          timestamp,
          eventType,
          verificationType,
          source: 'SYNC',
          rawPayload: JSON.stringify(log),
        },
      });
      newLogs++;
    }
  }

  console.log(`✅ Ingested ${newLogs} new attendance events (Total: ${data.logs.length}).`);
  console.log('\n🎉 Full hardware sync complete! Check http://localhost:3000/employees and http://localhost:3000/attendance');
  process.exit(0);
}

syncAll();
