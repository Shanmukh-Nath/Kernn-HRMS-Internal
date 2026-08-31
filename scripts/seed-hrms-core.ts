import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth';
import { PERMISSION_CATALOG, DEFAULT_ROLE_PERMISSIONS } from '../lib/rbac';
import { DEFAULT_LEAVE_TYPES } from '../lib/leave-engine';

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('🚀 Seeding Enterprise HRMS Core (RBAC, Permissions, Super Admin)');
  console.log('================================================================');

  // 1. Seed All Permissions
  console.log('\n--- 1. Seeding Permissions Catalog ---');
  for (const p of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { slug: p.slug },
      update: { module: p.module, description: p.description },
      create: { slug: p.slug, module: p.module, description: p.description },
    });
  }
  console.log(`✅ Seeded ${PERMISSION_CATALOG.length} granular permissions.`);

  // 2. Seed Pre-configured Roles & RolePermissions
  console.log('\n--- 2. Seeding Pre-configured Roles ---');
  for (const [roleName, permissionSlugs] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { description: `${roleName.replace('_', ' ')} System Role`, isSystem: true },
      create: { name: roleName, description: `${roleName.replace('_', ' ')} System Role`, isSystem: true },
    });

    // Attach permissions
    for (const slug of permissionSlugs) {
      const perm = await prisma.permission.findUnique({ where: { slug } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: perm.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      }
    }
    console.log(`✅ Role: ${roleName} configured with ${permissionSlugs.length} permissions.`);
  }

  // 3. Seed Default Super Admin User
  console.log('\n--- 3. Seeding Super Admin Account ---');
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  if (superAdminRole) {
    const adminMobile = '9876543210';
    const adminPassHash = hashPassword('Admin@123');

    await prisma.user.upsert({
      where: { mobileNumber: adminMobile },
      update: {
        name: 'System Administrator',
        email: 'admin@secureye.com',
        roleId: superAdminRole.id,
        passwordHash: adminPassHash,
        mustChangePassword: false,
        status: 'ACTIVE',
      },
      create: {
        mobileNumber: adminMobile,
        passwordHash: adminPassHash,
        name: 'System Administrator',
        email: 'admin@secureye.com',
        roleId: superAdminRole.id,
        mustChangePassword: false,
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Super Admin created: Mobile: ${adminMobile} | Password: Admin@123`);
  }

  // 4. Seed Default Leave Types
  console.log('\n--- 4. Seeding Default Leave Types ---');
  for (const lt of DEFAULT_LEAVE_TYPES) {
    await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: {
        name: lt.name,
        daysPerYear: lt.daysPerYear,
        accrualFrequency: lt.accrualFrequency,
        carryForwardLimit: lt.carryForwardLimit,
        isPaid: lt.isPaid,
        colorHex: lt.colorHex,
        description: lt.description,
      },
      create: {
        name: lt.name,
        code: lt.code,
        daysPerYear: lt.daysPerYear,
        accrualFrequency: lt.accrualFrequency,
        carryForwardLimit: lt.carryForwardLimit,
        isPaid: lt.isPaid,
        colorHex: lt.colorHex,
        description: lt.description,
      },
    });
    console.log(`✅ Leave Type: [${lt.code}] ${lt.name} (${lt.daysPerYear} days/yr)`);
  }

  // 5. Seed 2026 Company Public Holidays
  console.log('\n--- 5. Seeding 2026 Company Holidays ---');
  const holidays = [
    { name: 'New Year Day', date: new Date('2026-01-01'), description: 'International New Year' },
    { name: 'Republic Day', date: new Date('2026-01-26'), description: 'National Holiday' },
    { name: 'Holi', date: new Date('2026-03-04'), description: 'Festival of Colors' },
    { name: 'May Day / Labor Day', date: new Date('2026-05-01'), description: 'International Workers Day' },
    { name: 'Independence Day', date: new Date('2026-08-15'), description: 'National Holiday' },
    { name: 'Gandhi Jayanti', date: new Date('2026-10-02'), description: 'National Holiday' },
    { name: 'Dussehra / Vijayadashami', date: new Date('2026-10-20'), description: 'Festival Holiday' },
    { name: 'Diwali', date: new Date('2026-11-08'), description: 'Festival of Lights' },
    { name: 'Christmas', date: new Date('2026-12-25'), description: 'Public Holiday' },
  ];

  for (const h of holidays) {
    const existing = await prisma.holiday.findFirst({
      where: { name: h.name, year: 2026 },
    });
    if (!existing) {
      await prisma.holiday.create({
        data: {
          name: h.name,
          date: h.date,
          description: h.description,
          year: 2026,
          isOptional: false,
        },
      });
    }
  }
  console.log(`✅ Seeded ${holidays.length} Company Holidays for 2026.`);

  // 6. Seed Sample Announcements
  console.log('\n--- 6. Seeding Announcements ---');
  const annCount = await prisma.announcement.count();
  if (annCount === 0) {
    await prisma.announcement.createMany({
      data: [
        {
          title: 'Welcome to Secureye Enterprise HRMS Suite',
          content: 'The new HRMS portal is live with real-time biometric attendance, leave approvals, and payroll management.',
          priority: 'URGENT',
          authorName: 'HR Administration',
        },
        {
          title: 'Upcoming Public Holiday: Independence Day',
          content: 'Please note that the office will remain closed on August 15th in observance of Independence Day.',
          priority: 'NOTICE',
          authorName: 'Management',
        },
      ],
    });
    console.log('✅ Seeded initial company bulletins.');
  }

  // 7. Initialize Leave Balances for all Enrolled Employees
  console.log('\n--- 7. Initializing Employee Leave Balances ---');
  const employees = await prisma.employee.findMany();
  const allLeaveTypes = await prisma.leaveType.findMany();

  for (const emp of employees) {
    for (const lt of allLeaveTypes) {
      await prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: emp.id,
            leaveTypeId: lt.id,
            year: 2026,
          },
        },
        update: {},
        create: {
          employeeId: emp.id,
          leaveTypeId: lt.id,
          year: 2026,
          allocated: lt.daysPerYear,
          accrued: lt.daysPerYear,
          used: 0,
          pending: 0,
          balance: lt.daysPerYear,
        },
      });
    }
  }
  console.log(`✅ Initialized leave balances for ${employees.length} employees.`);

  console.log('\n================================================================');
  console.log('🎉 Enterprise HRMS Master Seed Completed Successfully!');
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
