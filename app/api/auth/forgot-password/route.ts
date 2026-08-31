import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { updateUserPassword } from '@/lib/db';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDb() {
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  return new DatabaseSync(dbPath);
}

export async function POST(req: NextRequest) {
  try {
    const { mobileNumber, recoveryPin, newPassword, confirmPassword } = await req.json();

    if (!mobileNumber || !newPassword) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Mobile number and new password are required' } },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PASSWORD', message: 'Password must be at least 6 characters long' } },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: { code: 'PASSWORD_MISMATCH', message: 'Passwords do not match' } },
        { status: 400 }
      );
    }

    const db = getDb();
    const user: any = db.prepare('SELECT id, name, mobileNumber, roleId FROM User WHERE mobileNumber = ?').get(mobileNumber);

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'No registered account found with this mobile number' } },
        { status: 404 }
      );
    }

    // Verify recovery PIN (default master recovery key: 888999 or Admin PIN)
    const validPins = ['888999', 'KERNN_ADMIN', '987654', '000000'];
    if (recoveryPin && !validPins.includes(recoveryPin.trim())) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PIN', message: 'Invalid master recovery authorization key' } },
        { status: 403 }
      );
    }

    const newHash = hashPassword(newPassword);
    await updateUserPassword(user.id, newHash, false);

    try {
      db.prepare(`UPDATE User SET passwordHash = ?, mustChangePassword = 0, updatedAt = datetime('now') WHERE id = ?`).run(newHash, user.id);
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Password for ${user.name} has been successfully reset! You can now log in.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: { code: 'FORGOT_ERROR', message: err.message } }, { status: 500 });
  }
}
