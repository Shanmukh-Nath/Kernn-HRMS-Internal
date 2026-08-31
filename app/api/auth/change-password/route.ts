import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession, hashPassword, createSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth';
import { findUserById, updateUserPassword } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { newPassword, confirmPassword } = await req.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PASSWORD', message: 'New password must be at least 6 characters long' } },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: { code: 'PASSWORD_MISMATCH', message: 'Passwords do not match' } },
        { status: 400 }
      );
    }

    const newHash = hashPassword(newPassword);
    await updateUserPassword(session.userId, newHash);

    // Issue updated session with mustChangePassword = false
    const updatedSession = {
      ...session,
      mustChangePassword: false,
    };
    const newToken = createSessionToken(updatedSession);

    const response = NextResponse.json({
      success: true,
      data: { user: updatedSession },
      message: 'Password successfully changed',
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: newToken,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'CHANGE_PASSWORD_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
