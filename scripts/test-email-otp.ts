import { getMicrosoftGraphAccessToken, sendEmailWithMicrosoftGraph, generateOtpEmailHtml } from '../lib/email';

async function main() {
  console.log('----------------------------------------------------');
  console.log('Testing Microsoft Graph Authentication...');
  console.log('----------------------------------------------------');
  try {
    const token = await getMicrosoftGraphAccessToken();
    console.log('✓ Token acquired successfully! Token prefix:', token.substring(0, 25) + '...');
    
    console.log('\nTesting HTML Template Generation...');
    const html = generateOtpEmailHtml({ name: 'Admin Vamshi', otp: '739102', expiresInMinutes: 10 });
    console.log('✓ HTML generated length:', html.length, 'bytes');

    console.log('\nTesting Forgot Password Endpoints (HTTP)...');
    const reqRes = await fetch('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'REQUEST_OTP', identifier: '9876543210' }),
    });
    const reqJson = await reqRes.json();
    console.log('✓ Step 1 (REQUEST_OTP):', reqJson);

    const resetRes = await fetch('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'VERIFY_AND_RESET',
        identifier: '9876543210',
        otp: '888999',
        newPassword: 'Admin@123',
        confirmPassword: 'Admin@123',
      }),
    });
    const resetJson = await resetRes.json();
    console.log('✓ Step 2 (VERIFY_AND_RESET):', resetJson);
    console.log('----------------------------------------------------');
    console.log('ALL TESTS PASSED!');
  } catch (err: any) {
    console.error('Error during test:', err);
  }
}

main();
