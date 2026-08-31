import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data...');

  // Create demo biometric terminal
  const device = await prisma.device.upsert({
    where: { deviceId: 'SFB3K_MAIN_01' },
    update: {},
    create: {
      name: 'Main Office Biometric (S-FB3K)',
      ipAddress: '192.168.1.100',
      port: 80,
      deviceId: 'SFB3K_MAIN_01',
      protocol: 'Secureye/FKWeb',
      enabled: true,
      pollingEnabled: true,
      pollingInterval: 3000,
      status: 'ONLINE',
      firmware: 'M60 v3.16.1286s',
      userCount: 5,
      logCount: 142,
      lastSeenAt: new Date(),
      lastSyncAt: new Date(),
    },
  });

  // Seed sample employees
  const employeesData = [
    { deviceUserId: '1001', name: 'John Smith', employeeCode: 'EMP-1001', cardNumber: '9847281', privilege: 0, fingerprintEnabled: true, faceEnabled: true },
    { deviceUserId: '1002', name: 'Priya Sharma', employeeCode: 'EMP-1002', cardNumber: '9847282', privilege: 0, fingerprintEnabled: true, faceEnabled: false },
    { deviceUserId: '1003', name: 'Rahul Kumar', employeeCode: 'EMP-1003', cardNumber: '9847283', privilege: 0, fingerprintEnabled: true, faceEnabled: true },
    { deviceUserId: '1004', name: 'Anil Kumar', employeeCode: 'EMP-1004', cardNumber: '9847284', privilege: 14, fingerprintEnabled: true, faceEnabled: false },
    { deviceUserId: '1005', name: 'Sneha Patel', employeeCode: 'EMP-1005', cardNumber: '9847285', privilege: 0, fingerprintEnabled: true, faceEnabled: true },
  ];

  for (const emp of employeesData) {
    const createdEmp = await prisma.employee.upsert({
      where: {
        deviceId_deviceUserId: {
          deviceId: device.id,
          deviceUserId: emp.deviceUserId,
        },
      },
      update: emp,
      create: {
        ...emp,
        deviceId: device.id,
      },
    });

    // Seed recent attendance punch
    const today = new Date();
    today.setHours(9, Math.floor(Math.random() * 30), Math.floor(Math.random() * 60));

    await prisma.attendanceEvent.upsert({
      where: {
        deviceId_deviceUserId_timestamp_eventType: {
          deviceId: device.id,
          deviceUserId: emp.deviceUserId,
          timestamp: today,
          eventType: 'CHECK_IN',
        },
      },
      update: {},
      create: {
        deviceId: device.id,
        employeeId: createdEmp.id,
        deviceUserId: emp.deviceUserId,
        timestamp: today,
        eventType: 'CHECK_IN',
        verificationType: emp.faceEnabled ? 'FACE' : 'FINGERPRINT',
        source: 'REALTIME',
      },
    });
  }

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
