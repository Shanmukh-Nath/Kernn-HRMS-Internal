async function testAllLogins() {
  const accounts = [
    { role: 'SUPER_ADMIN', mobile: '9876543210', pass: 'Admin@123' },
    { role: 'HR_ADMIN', mobile: '9800000010', pass: 'HrAdmin@123' },
    { role: 'MANAGER', mobile: '9800000003', pass: 'Manager@123' },
    { role: 'EMPLOYEE', mobile: '9800000001', pass: 'Employee@123' },
  ];

  console.log('--- TESTING ROLE AUTHENTICATION & SESSIONS ---');
  for (const acc of accounts) {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: acc.mobile, password: acc.pass })
    });
    const json = await res.json();
    console.log(`[${acc.role}] Status: ${res.status} | User: ${json.data?.user?.name} | Role: ${json.data?.user?.role} | Perms: ${json.data?.user?.permissions?.length || 0}`);
  }
}
testAllLogins();
