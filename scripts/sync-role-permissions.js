const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('prisma/dev.db');

const PERMISSION_CATALOG = [
  { slug: 'employees:read', module: 'EMPLOYEES' },
  { slug: 'employees:create', module: 'EMPLOYEES' },
  { slug: 'employees:update', module: 'EMPLOYEES' },
  { slug: 'employees:delete', module: 'EMPLOYEES' },
  { slug: 'biometrics:live', module: 'ATTENDANCE' },
  { slug: 'attendance:raw', module: 'ATTENDANCE' },
  { slug: 'attendance:read', module: 'ATTENDANCE' },
  { slug: 'attendance:export', module: 'ATTENDANCE' },
  { slug: 'attendance:regularize', module: 'ATTENDANCE' },
  { slug: 'attendance:approve_regularization', module: 'ATTENDANCE' },
  { slug: 'leaves:read', module: 'LEAVES' },
  { slug: 'leaves:apply', module: 'LEAVES' },
  { slug: 'leaves:approve', module: 'LEAVES' },
  { slug: 'leaves:manage_policies', module: 'LEAVES' },
  { slug: 'holidays:read', module: 'HOLIDAYS' },
  { slug: 'holidays:manage', module: 'HOLIDAYS' },
  { slug: 'payroll:read_self', module: 'PAYROLL' },
  { slug: 'payroll:read_all', module: 'PAYROLL' },
  { slug: 'payroll:process', module: 'PAYROLL' },
  { slug: 'payroll:export', module: 'PAYROLL' },
  { slug: 'payslip:approve_download', module: 'PAYROLL' },
  { slug: 'devices:read', module: 'DEVICES' },
  { slug: 'devices:sync', module: 'DEVICES' },
  { slug: 'devices:manage', module: 'DEVICES' },
  { slug: 'roles:read', module: 'ROLES' },
  { slug: 'roles:manage', module: 'ROLES' },
  { slug: 'announcements:read', module: 'ANNOUNCEMENTS' },
  { slug: 'announcements:manage', module: 'ANNOUNCEMENTS' },
  { slug: 'rules:read', module: 'SETTINGS' },
  { slug: 'rules:manage', module: 'SETTINGS' },
];

const DEFAULT_ROLE_PERMISSIONS = {
  SUPER_ADMIN: PERMISSION_CATALOG.map((p) => p.slug),
  HR_ADMIN: [
    'employees:read', 'employees:create', 'employees:update', 'employees:delete',
    'attendance:read', 'attendance:export', 'attendance:regularize', 'attendance:approve_regularization',
    'leaves:read', 'leaves:apply', 'leaves:approve', 'leaves:manage_policies',
    'holidays:read', 'holidays:manage',
    'payroll:read_self', 'payroll:read_all', 'payroll:process', 'payroll:export',
    'payslip:approve_download',
    'announcements:read', 'announcements:manage',
    'rules:read', 'rules:manage',
  ],
  MANAGER: [
    'attendance:regularize',
    'attendance:approve_regularization',
    'leaves:read',
    'leaves:apply',
    'leaves:approve',
    'holidays:read',
    'payroll:read_self',
    'payslip:approve_download',
    'announcements:read',
    'announcements:manage',
  ],
  EMPLOYEE: [
    'attendance:regularize',
    'leaves:read',
    'leaves:apply',
    'holidays:read',
    'payroll:read_self',
    'announcements:read',
  ],
};

// 1. Ensure all permissions exist in Permission table
for (const p of PERMISSION_CATALOG) {
  const existing = db.prepare('SELECT id FROM Permission WHERE slug = ?').get(p.slug);
  if (!existing) {
    const id = 'perm_' + Math.random().toString(36).substring(2, 12);
    db.prepare('INSERT INTO Permission (id, slug, module, description) VALUES (?, ?, ?, ?)').run(id, p.slug, p.module, p.slug);
  }
}

const allPerms = db.prepare('SELECT id, slug FROM Permission').all();
const permMap = {};
allPerms.forEach(p => { permMap[p.slug] = p.id; });

const roles = db.prepare('SELECT id, name FROM Role').all();

for (const r of roles) {
  const allowedSlugs = DEFAULT_ROLE_PERMISSIONS[r.name] || [];
  // Clear old RolePermissions for this role
  db.prepare('DELETE FROM RolePermission WHERE roleId = ?').run(r.id);

  // Insert assigned permissions
  for (const slug of allowedSlugs) {
    const permId = permMap[slug];
    if (permId) {
      const rpId = 'rp_' + Math.random().toString(36).substring(2, 12);
      db.prepare('INSERT INTO RolePermission (id, roleId, permissionId) VALUES (?, ?, ?)').run(rpId, r.id, permId);
    }
  }
  console.log(`Synced ${r.name}: ${allowedSlugs.length} permissions`);
}

console.log('Role permissions sync complete!');
