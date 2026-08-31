async function verifyAllRoles() {
  const roles = [
    { name: 'SUPER_ADMIN', mobile: '9876543210', pass: 'Admin@123' },
    { name: 'HR_ADMIN', mobile: '9800000010', pass: 'HrAdmin@123' },
    { name: 'MANAGER', mobile: '9800000003', pass: 'Manager@123' },
    { name: 'EMPLOYEE', mobile: '9800000001', pass: 'Employee@123' },
  ];

  for (const r of roles) {
    const authRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: r.mobile, password: r.pass }),
    });
    const cookie = authRes.headers.get('set-cookie');

    const [todayRes, appRes, dashRes] = await Promise.all([
      fetch('http://localhost:3000/api/attendance/today', { headers: { Cookie: cookie } }),
      fetch('http://localhost:3000/api/attendance/regularize', { headers: { Cookie: cookie } }),
      fetch('http://localhost:3000/api/payroll/download-approval', { headers: { Cookie: cookie } }),
    ]);

    console.log(`[${r.name}] Today's Attendance API: ${todayRes.status} | Regularize API: ${appRes.status} | Download-Approval API: ${dashRes.status}`);
  }
}
verifyAllRoles();
