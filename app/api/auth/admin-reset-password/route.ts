import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession, hashPassword, generateTemporaryPassword } from '@/lib/auth';
import { usersCol } from '@/lib/mongodb';

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

    const users = await usersCol();
    let targetUser: any = null;

    if (userId) {
      targetUser = await users.findOne({ $or: [{ id: userId }, { _id: userId }] });
    } else if (employeeId) {
      targetUser = await users.findOne({ employeeId });
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
    const now = new Date();

    // Update in MongoDB Atlas
    await users.updateOne(
      { _id: targetUser._id },
      {
        $set: {
          passwordHash,
          mustChangePassword: Boolean(forceChangeOnLogin),
          updatedAt: now,
        },
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        userId: targetUser.id || targetUser._id?.toString(),
        userName: targetUser.name,
        mobileNumber: targetUser.mobileNumber,
        temporaryPassword: plainPassword,
        mustChangePassword: Boolean(forceChangeOnLogin),
      },
      message: `Password for ${targetUser.name} has been successfully reset.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: { code: 'RESET_ERROR', message: err.message } }, { status: 500 });
  }
}
