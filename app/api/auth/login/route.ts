import { NextRequest, NextResponse } from 'next/server';
import { findUserByMobile } from '@/lib/db';
import { verifyPassword, createSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mobileNumber = body.mobileNumber || body.mobile || body.username || body.userId;
    const password = body.password;

    if (!mobileNumber || !password) {
      console.warn('[AUTH_LOGIN] Missing credentials in payload:', { hasMobile: !!mobileNumber, hasPassword: !!password });
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Mobile number and password are required' } },
        { status: 400 }
      );
    }

    const user = await findUserByMobile(mobileNumber);
    if (!user) {
      console.warn(`[AUTH_LOGIN] User not found for mobile: ${mobileNumber}`);
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'No account found with this mobile number' } },
        { status: 401 }
      );
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      console.warn(`[AUTH_LOGIN] Invalid password attempt for mobile: ${mobileNumber}`);
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect password' } },
        { status: 401 }
      );
    }

    if (user.status !== 'ACTIVE') {
      console.warn(`[AUTH_LOGIN] Inactive/suspended user tried to login: ${mobileNumber} (status: ${user.status})`);
      return NextResponse.json(
        { success: false, error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account is suspended. Please contact HR.' } },
        { status: 403 }
      );
    }

    const sessionPayload = {
      userId: user.id,
      mobileNumber: user.mobileNumber,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      mustChangePassword: Boolean(user.mustChangePassword),
      employeeId: user.employeeId,
      department: user.department,
      designation: user.designation,
    };

    const token = createSessionToken(sessionPayload);
    console.log(`[AUTH_LOGIN] User logged in successfully: ${user.name} (${user.mobileNumber}) [Role: ${user.role}]`);

    const response = NextResponse.json({
      success: true,
      token,
      data: {
        token,
        user: sessionPayload,
        mustChangePassword: Boolean(user.mustChangePassword),
      },
      message: 'Login successful',
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (err: any) {
    console.error('[AUTH_LOGIN_ERROR] Exception occurred during login:', err);
    return NextResponse.json(
      { success: false, error: { code: 'LOGIN_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}
