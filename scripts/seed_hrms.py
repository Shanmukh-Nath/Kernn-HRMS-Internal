import sqlite3
import hashlib
import os
import uuid
import datetime

DB_PATH = os.path.join(os.getcwd(), 'prisma', 'dev.db')

def hash_password(password, salt=None):
    if not salt:
        salt = os.urandom(16).hex()
    dk = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'), salt.encode('utf-8'), 10000, 64)
    return f"{salt}:{dk.hex()}"

def cuid():
    return 'c' + uuid.uuid4().hex[:24]

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("================================================================")
    print("[INIT] Seeding HRMS Core Data via SQLite Engine")
    print("================================================================")

    # 1. Seed Permissions
    permissions = [
        ('employees:read', 'EMPLOYEES', 'View employee profiles and directory'),
        ('employees:create', 'EMPLOYEES', 'Add new employees and generate login credentials'),
        ('employees:update', 'EMPLOYEES', 'Edit employee details, salary, and department'),
        ('employees:delete', 'EMPLOYEES', 'Deactivate or terminate employee records'),
        ('attendance:read', 'ATTENDANCE', 'View attendance logs and live terminal feeds'),
        ('attendance:export', 'ATTENDANCE', 'Download consolidated timesheet CSV reports'),
        ('attendance:regularize', 'ATTENDANCE', 'Apply for attendance punch regularization'),
        ('attendance:approve_regularization', 'ATTENDANCE', 'Approve or reject regularization requests'),
        ('leaves:read', 'LEAVES', 'View leave requests and balance quotas'),
        ('leaves:apply', 'LEAVES', 'Submit leave applications'),
        ('leaves:approve', 'LEAVES', 'Authorize, reject, or cancel employee leave requests'),
        ('leaves:manage_policies', 'LEAVES', 'Configure leave types, annual quotas, and accruals'),
        ('holidays:read', 'HOLIDAYS', 'View company public and optional holiday calendar'),
        ('holidays:manage', 'HOLIDAYS', 'Add, update, or remove company holidays'),
        ('payroll:read_self', 'PAYROLL', 'View personal salary slips and earnings summary'),
        ('payroll:read_all', 'PAYROLL', 'View company-wide payroll registers and salary data'),
        ('payroll:process', 'PAYROLL', 'Run 1-click monthly attendance-integrated payroll batch'),
        ('payroll:export', 'PAYROLL', 'Export bank disbursement sheets and payroll registers'),
        ('devices:read', 'DEVICES', 'Monitor terminal health, serial numbers, and logs'),
        ('devices:sync', 'DEVICES', 'Trigger hardware sync and user enrollment pull'),
        ('devices:manage', 'DEVICES', 'Configure IP address, port, and driver settings'),
        ('roles:read', 'ROLES', 'View access roles and assigned permission matrices'),
        ('roles:manage', 'ROLES', 'Create and modify fine-grained RBAC permissions'),
        ('announcements:read', 'ANNOUNCEMENTS', 'View company announcements and bulletins'),
        ('announcements:manage', 'ANNOUNCEMENTS', 'Publish company-wide announcements'),
        ('rules:read', 'SETTINGS', 'View active shift timings, grace periods, and late rules'),
        ('rules:manage', 'SETTINGS', 'Update work hours, late mark thresholds, and debouncing'),
    ]

    perm_id_map = {}
    now = datetime.datetime.now().isoformat()

    for slug, module, desc in permissions:
        cursor.execute("SELECT id FROM Permission WHERE slug=?", (slug,))
        row = cursor.fetchone()
        if row:
            perm_id = row[0]
        else:
            perm_id = cuid()
            cursor.execute("INSERT INTO Permission (id, slug, module, description, createdAt) VALUES (?, ?, ?, ?, ?)",
                           (perm_id, slug, module, desc, now))
        perm_id_map[slug] = perm_id
    print(f"[PERMS] Seeded {len(permissions)} Granular Permissions.")

    # 2. Seed Roles
    roles = {
        'SUPER_ADMIN': list(perm_id_map.keys()),
        'HR_ADMIN': [
            'employees:read', 'employees:create', 'employees:update',
            'attendance:read', 'attendance:export', 'attendance:regularize', 'attendance:approve_regularization',
            'leaves:read', 'leaves:apply', 'leaves:approve', 'leaves:manage_policies',
            'holidays:read', 'holidays:manage',
            'payroll:read_self', 'payroll:read_all', 'payroll:process', 'payroll:export',
            'devices:read', 'devices:sync',
            'announcements:read', 'announcements:manage',
            'rules:read', 'rules:manage',
        ],
        'MANAGER': [
            'employees:read',
            'attendance:read', 'attendance:export', 'attendance:regularize', 'attendance:approve_regularization',
            'leaves:read', 'leaves:apply', 'leaves:approve',
            'holidays:read',
            'payroll:read_self',
            'devices:read',
            'announcements:read',
            'rules:read',
        ],
        'EMPLOYEE': [
            'attendance:read', 'attendance:regularize',
            'leaves:read', 'leaves:apply',
            'holidays:read',
            'payroll:read_self',
            'announcements:read',
            'rules:read',
        ]
    }

    role_id_map = {}
    for role_name, slugs in roles.items():
        cursor.execute("SELECT id FROM Role WHERE name=?", (role_name,))
        row = cursor.fetchone()
        if row:
            role_id = row[0]
        else:
            role_id = cuid()
            cursor.execute("INSERT INTO Role (id, name, description, isSystem, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
                           (role_id, role_name, f"{role_name} System Role", 1, now, now))
        role_id_map[role_name] = role_id

        # Insert RolePermissions
        for slug in slugs:
            p_id = perm_id_map.get(slug)
            if p_id:
                cursor.execute("SELECT id FROM RolePermission WHERE roleId=? AND permissionId=?", (role_id, p_id))
                if not cursor.fetchone():
                    cursor.execute("INSERT INTO RolePermission (id, roleId, permissionId) VALUES (?, ?, ?)",
                                   (cuid(), role_id, p_id))
        print(f"[ROLE] Role: {role_name} with {len(slugs)} permissions.")

    # 3. Seed Super Admin User
    admin_mobile = '9876543210'
    admin_hash = hash_password('Admin@123')
    super_admin_role_id = role_id_map['SUPER_ADMIN']

    cursor.execute("SELECT id FROM User WHERE mobileNumber=?", (admin_mobile,))
    admin_row = cursor.fetchone()
    if not admin_row:
        cursor.execute("""
            INSERT INTO User (id, mobileNumber, passwordHash, name, email, mustChangePassword, status, roleId, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (cuid(), admin_mobile, admin_hash, 'System Administrator', 'admin@secureye.com', 0, 'ACTIVE', super_admin_role_id, now, now))
        print(f"[ADMIN] Super Admin created: Mobile: {admin_mobile} | Password: Admin@123")
    else:
        cursor.execute("UPDATE User SET passwordHash=?, mustChangePassword=0, roleId=? WHERE mobileNumber=?", (admin_hash, super_admin_role_id, admin_mobile))
        print(f"[ADMIN] Super Admin password reset: Mobile: {admin_mobile} | Password: Admin@123")

    # 4. Seed Leave Types
    leave_types = [
        ('Casual Leave', 'CL', 'Short personal engagements and urgent personal tasks', 12.0, 'MONTHLY', 0.0, 1, '#3B82F6'),
        ('Sick Leave', 'SL', 'Medical and illness recovery time off', 10.0, 'YEARLY', 5.0, 1, '#EF4444'),
        ('Paid / Earned Leave', 'PL', 'Accrued annual vacation and planned time off', 18.0, 'MONTHLY', 30.0, 1, '#10B981'),
        ('Loss of Pay (Unpaid)', 'LOP', 'Unpaid absence after exhaust of paid leave quotas', 0.0, 'YEARLY', 0.0, 0, '#6B7280'),
    ]

    lt_id_map = {}
    for name, code, desc, days, freq, carry, is_paid, color in leave_types:
        cursor.execute("SELECT id FROM LeaveType WHERE code=?", (code,))
        row = cursor.fetchone()
        if row:
            lt_id = row[0]
        else:
            lt_id = cuid()
            cursor.execute("""
                INSERT INTO LeaveType (id, name, code, description, daysPerYear, accrualFrequency, carryForwardLimit, isPaid, colorHex, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (lt_id, name, code, desc, days, freq, carry, is_paid, color, now))
        lt_id_map[code] = (lt_id, days)
    print(f"[LEAVES] Seeded {len(leave_types)} Leave Types.")

    # 5. Seed 2026 Holidays
    holidays = [
        ('New Year Day', '2026-01-01', 'International New Year Day', 0),
        ('Republic Day', '2026-01-26', 'National Holiday', 0),
        ('Holi', '2026-03-04', 'Festival of Colors', 0),
        ('May Day / Labor Day', '2026-05-01', 'International Workers Day', 0),
        ('Independence Day', '2026-08-15', 'National Holiday', 0),
        ('Gandhi Jayanti', '2026-10-02', 'National Holiday', 0),
        ('Dussehra', '2026-10-20', 'Festival Holiday', 0),
        ('Diwali', '2026-11-08', 'Festival of Lights', 0),
        ('Christmas', '2026-12-25', 'Public Holiday', 0),
    ]

    for name, dt, desc, opt in holidays:
        cursor.execute("SELECT id FROM Holiday WHERE name=? AND year=2026", (name,))
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO Holiday (id, name, date, isOptional, description, year, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (cuid(), name, dt, opt, desc, 2026, now))
    print(f"[HOLIDAYS] Seeded {len(holidays)} Public Holidays for 2026.")

    # 6. Seed Announcements
    cursor.execute("SELECT count(*) FROM Announcement")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO Announcement (id, title, content, priority, publishedAt, authorName, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (cuid(), 'Welcome to Secureye Enterprise HRMS', 'The system is now live with real-time biometric attendance, leave approvals, and payroll processing.', 'URGENT', now, 'HR Administration', now))
        cursor.execute("""
            INSERT INTO Announcement (id, title, content, priority, publishedAt, authorName, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (cuid(), 'Quarterly Townhall & Recognition', 'Please join us this Friday at 4:00 PM for company updates and peer recognitions.', 'NOTICE', now, 'Executive Management', now))
        print("[BULLETIN] Seeded Company Announcements.")

    # 7. Initialize Leave Balances and Users for existing Employees
    cursor.execute("SELECT id, name, deviceUserId FROM Employee")
    emps = cursor.fetchall()
    emp_role_id = role_id_map['EMPLOYEE']

    for emp_id, emp_name, dev_uid in emps:
        # Create Leave Balances
        for code, (lt_id, days) in lt_id_map.items():
            cursor.execute("SELECT id FROM LeaveBalance WHERE employeeId=? AND leaveTypeId=? AND year=2026", (emp_id, lt_id))
            if not cursor.fetchone():
                cursor.execute("""
                    INSERT INTO LeaveBalance (id, employeeId, leaveTypeId, year, allocated, accrued, used, pending, balance, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (cuid(), emp_id, lt_id, 2026, days, days, 0.0, 0.0, days, now))

        # Check if Employee has a User login
        cursor.execute("SELECT id FROM User WHERE employeeId=?", (emp_id,))
        if not cursor.fetchone():
            emp_mobile = f"980000000{dev_uid}" if len(dev_uid) <= 2 else f"980000{dev_uid}"
            emp_pass = hash_password('Welcome@123')
            cursor.execute("""
                INSERT INTO User (id, mobileNumber, passwordHash, name, email, mustChangePassword, status, roleId, employeeId, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (cuid(), emp_mobile, emp_pass, emp_name, f"{emp_name.replace(' ', '').lower()}@company.com", 1, 'ACTIVE', emp_role_id, emp_id, now, now))
            print(f"[USER] Enrolled User: {emp_name} | Mobile: {emp_mobile} | Temp Pass: Welcome@123 (Must Change: True)")

    conn.commit()
    conn.close()
    print("\n[SUCCESS] Master HRMS Database Seed Complete!")

if __name__ == '__main__':
    main()
