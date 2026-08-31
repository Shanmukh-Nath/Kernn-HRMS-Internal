async function verifyPages() {
  const authRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileNumber: '9876543210', password: 'Admin@123' }),
  });
  const cookie = authRes.headers.get('set-cookie');

  const pages = ['/', '/daily-attendance', '/approvals', '/leaves', '/payroll', '/announcements'];
  for (const p of pages) {
    const res = await fetch('http://localhost:3000' + p, { headers: { Cookie: cookie } });
    console.log('Page [' + p + '] Status: ' + res.status);
  }
}
verifyPages();
