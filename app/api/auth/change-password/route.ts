import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession, hashPassword, verifyPassword, createSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth';
import { updateUserPassword, findUserById } from '@/lib/db';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDb() {
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  return new DatabaseSync(dbPath);
}

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

    const db = getDb();
    const userRow: any = db.prepare('SELECT id, passwordHash, mustChangePassword FROM User WHERE id = ?').get(session.userId);

    // If user is not under forced password change, require current password
    if (userRow && !userRow.mustChangePassword && currentPassword) {
      const isValid = verifyPassword(currentPassword, userRow.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_CURRENT_PASSWORD', message: 'Current password is incorrect' } },
          { status: 401 }
        );
      }
    }

    const newHash = hashPassword(newPassword);
    await updateUserPassword(session.userId, newHash, false);

    // Update in SQLite
    try {
      db.prepare(`UPDATE User SET passwordHash = ?, mustChangePassword = 0, updatedAt = datetime('now') WHERE id = ?`).run(newHash, session.userId);
    } catch {}

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
