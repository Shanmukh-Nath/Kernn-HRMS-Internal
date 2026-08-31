import { AuthSession } from './auth';

export interface PermissionDefinition {
  slug: string;
  module: string;
  description: string;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // Employees Module
  { slug: 'employees:read', module: 'EMPLOYEES', description: 'View employee profiles and directory' },
  { slug: 'employees:create', module: 'EMPLOYEES', description: 'Add new employees and generate login credentials' },
  { slug: 'employees:update', module: 'EMPLOYEES', description: 'Edit employee details, salary, and department' },
  { slug: 'employees:delete', module: 'EMPLOYEES', description: 'Deactivate or terminate employee records' },

  // Attendance Module
  { slug: 'biometrics:live', module: 'ATTENDANCE', description: 'View live streaming biometric punches (Super Admin only)' },
  { slug: 'attendance:raw', module: 'ATTENDANCE', description: 'View raw unfiltered device punch logs (Super Admin only)' },
  { slug: 'attendance:read', module: 'ATTENDANCE', description: 'View processed company attendance registers' },
  { slug: 'attendance:export', module: 'ATTENDANCE', description: 'Download consolidated timesheet CSV reports' },
  { slug: 'attendance:regularize', module: 'ATTENDANCE', description: 'Apply for attendance punch correction / regularization' },
  { slug: 'attendance:approve_regularization', module: 'ATTENDANCE', description: 'Approve or reject employee time regularization requests' },

  // Leave Management Module
  { slug: 'leaves:read', module: 'LEAVES', description: 'View leave requests and balance quotas' },
  { slug: 'leaves:apply', module: 'LEAVES', description: 'Submit leave applications' },
  { slug: 'leaves:approve', module: 'LEAVES', description: 'Authorize, reject, or cancel employee leave requests' },
  { slug: 'leaves:manage_policies', module: 'LEAVES', description: 'Configure leave types, annual quotas, and accruals' },

  // Holidays Module
  { slug: 'holidays:read', module: 'HOLIDAYS', description: 'View company public and optional holiday calendar' },
  { slug: 'holidays:manage', module: 'HOLIDAYS', description: 'Add, update, or remove company holidays' },

  // Payroll Module
  { slug: 'payroll:read_self', module: 'PAYROLL', description: 'View personal salary slips and earnings summary' },
  { slug: 'payroll:read_all', module: 'PAYROLL', description: 'View company-wide payroll registers and salary data' },
  { slug: 'payroll:process', module: 'PAYROLL', description: 'Run 1-click monthly attendance-integrated payroll batch' },
  { slug: 'payroll:export', module: 'PAYROLL', description: 'Export bank disbursement sheets and payroll registers' },
  { slug: 'payslip:approve_download', module: 'PAYROLL', description: 'Approve official payslip download requests' },

  // Devices & Biometrics Hardware (Super Admin exclusive)
  { slug: 'devices:read', module: 'DEVICES', description: 'Monitor terminal health, serial numbers, and logs' },
  { slug: 'devices:sync', module: 'DEVICES', description: 'Trigger hardware sync and user enrollment pull' },
  { slug: 'devices:manage', module: 'DEVICES', description: 'Configure IP address, port, and driver settings' },

  // Roles & Security Module
  { slug: 'roles:read', module: 'ROLES', description: 'View access roles and assigned permission matrices' },
  { slug: 'roles:manage', module: 'ROLES', description: 'Create and modify fine-grained RBAC permissions' },

  // Announcements & Notices
  { slug: 'announcements:read', module: 'ANNOUNCEMENTS', description: 'View company announcements and bulletins' },
  { slug: 'announcements:manage', module: 'ANNOUNCEMENTS', description: 'Publish company-wide announcements' },

  // Shift & Attendance Policy Rules
  { slug: 'rules:read', module: 'SETTINGS', description: 'View active shift timings, grace periods, and late rules' },
  { slug: 'rules:manage', module: 'SETTINGS', description: 'Update work hours, late mark thresholds, and debouncing' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSION_CATALOG.map((p) => p.slug),

  HR_ADMIN: [
    'employees:read',
    'employees:create',
    'employees:update',
    'employees:delete',
    'attendance:read',
    'attendance:export',
    'attendance:regularize',
    'attendance:approve_regularization',
    'leaves:read',
    'leaves:apply',
    'leaves:approve',
    'leaves:manage_policies',
    'holidays:read',
    'holidays:manage',
    'payroll:read_self',
    'payroll:read_all',
    'payroll:process',
    'payroll:export',
    'payslip:approve_download',
    'announcements:read',
    'announcements:manage',
    'rules:read',
    'rules:manage',
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

/**
 * Checks if a session has a specific permission
 */
export function hasPermission(session: AuthSession | null, requiredPermission: string): boolean {
  if (!session) return false;
  if (session.role === 'SUPER_ADMIN') return true;
  if (!session.permissions || !Array.isArray(session.permissions)) return false;
  return session.permissions.includes(requiredPermission) || session.permissions.includes('*');
}

/**
 * Checks if a session has ANY of the required permissions
 */
export function hasAnyPermission(session: AuthSession | null, permissions: string[]): boolean {
  if (!session) return false;
  if (session.role === 'SUPER_ADMIN') return true;
  return permissions.some((p) => hasPermission(session, p));
}

/**
 * Checks if a session has ALL of the required permissions
 */
export function hasAllPermissions(session: AuthSession | null, permissions: string[]): boolean {
  if (!session) return false;
  if (session.role === 'SUPER_ADMIN') return true;
  return permissions.every((p) => hasPermission(session, p));
}
