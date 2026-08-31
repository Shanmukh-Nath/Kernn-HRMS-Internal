import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession, hashPassword, verifyPassword, createSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth';
import { usersCol } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required to change password' } },
        { status: 401 }
      );
    }

    const { currentPassword, newPassword, confirmPassword } = await req.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PASSWORD', message: 'New password must be at least 6 characters long' } },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: { code: 'PASSWORD_MISMATCH', message: 'New password and confirmation do not match' } },
        { status: 400 }
      );
    }

    const users = await usersCol();
    const user = await users.findOne({ $or: [{ id: session.userId }, { _id: session.userId }] });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User account not found' } },
        { status: 404 }
      );
    }

    // If user is not under forced password change, require current password
    if (!user.mustChangePassword && currentPassword) {
      const isValid = verifyPassword(currentPassword, user.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_CURRENT_PASSWORD', message: 'Current password is incorrect' } },
          { status: 401 }
        );
      }
    }

    const newHash = hashPassword(newPassword);
    const now = new Date();

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: newHash,
          mustChangePassword: false,
          updatedAt: now,
        },
      }
    );

    // Issue refreshed session
    const updatedSession = {
      ...session,
      mustChangePassword: false,
    };
    const newToken = createSessionToken(updatedSession);

    const response = NextResponse.json({
      success: true,
      data: { user: updatedSession },
      message: 'Your password has been successfully updated!',
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
    return NextResponse.json({ success: false, error: { code: 'CHANGE_ERROR', message: err.message } }, { status: 500 });
  }
}
