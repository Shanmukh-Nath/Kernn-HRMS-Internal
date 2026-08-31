import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession, hashPassword, generateTemporaryPassword } from '@/lib/auth';
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
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Only SUPER_ADMIN, HR_ADMIN, or MANAGER can reset other users' passwords
    if (session.role !== 'SUPER_ADMIN' && session.role !== 'HR_ADMIN' && session.role !== 'MANAGER') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only Administrators and Managers can reset user credentials.' } },
        { status: 403 }
      );
    }

    const { userId, employeeId, customPassword, forceChangeOnLogin = true } = await req.json();

    if (!userId && !employeeId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'User ID or Employee ID is required' } },
        { status: 400 }
      );
    }

    const db = getDb();
    let targetUser: any = null;

    if (userId) {
      targetUser = db.prepare('SELECT id, name, mobileNumber, roleId FROM User WHERE id = ?').get(userId);
    } else if (employeeId) {
      targetUser = db.prepare('SELECT id, name, mobileNumber, roleId FROM User WHERE employeeId = ?').get(employeeId);
    }

    if (!targetUser && userId) {
      targetUser = await findUserById(userId);
    }

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'Target user account not found' } },
        { status: 404 }
      );
    }

    // Determine password
    const plainPassword = customPassword && customPassword.trim().length >= 6
      ? customPassword.trim()
      : generateTemporaryPassword();

    const passwordHash = hashPassword(plainPassword);

    // Update in DB
    await updateUserPassword(targetUser.id, passwordHash, forceChangeOnLogin);

    // Also ensure SQLite is updated
    try {
      db.prepare(`
        UPDATE User 
        SET passwordHash = ?, mustChangePassword = ?, updatedAt = datetime('now') 
        WHERE id = ?
      `).run(passwordHash, forceChangeOnLogin ? 1 : 0, targetUser.id);
    } catch {}

    return NextResponse.json({
      success: true,
      data: {
        userId: targetUser.id,
        userName: targetUser.name,
        mobileNumber: targetUser.mobileNumber,
        temporaryPassword: plainPassword,
        mustChangePassword: forceChangeOnLogin,
      },
      message: `Password for ${targetUser.name} has been successfully reset.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: { code: 'RESET_ERROR', message: err.message } }, { status: 500 });
  }
}
