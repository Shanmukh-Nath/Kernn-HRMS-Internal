import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth';
import { findUserById } from '@/lib/db';
import { passkeysCol, usersCol } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { credentialId } = await req.json();

    if (!credentialId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Credential ID is required' } },
        { status: 400 }
      );
    }

    const pkCol = await passkeysCol();
    const userCol = await usersCol();

    const cred = await pkCol.findOne({ credentialId });
    if (!cred) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CREDENTIAL_NOT_FOUND',
            message: 'Passkey not recognized or not registered to this organization',
          },
        },
        { status: 404 }
      );
    }

    const user = await userCol.findOne({ $or: [{ id: cred.userId }, { _id: cred.userId }] });
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User account missing' } },
        { status: 404 }
      );
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACCOUNT_SUSPENDED',
            message: 'User account is inactive. Please contact administrator.',
          },
        },
        { status: 403 }
      );
    }

    // Update lastUsedAt and counter
    const now = new Date();
    await pkCol.updateOne(
      { _id: cred._id },
      { $set: { lastUsedAt: now }, $inc: { counter: 1 } }
    );

    const fullUser = await findUserById(user.id || user._id.toString());
    if (!fullUser) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User account missing' } },
        { status: 404 }
      );
    }

    const sessionPayload = {
      userId: fullUser.id,
      mobileNumber: fullUser.mobileNumber,
      name: fullUser.name,
      email: fullUser.email,
      role: fullUser.role,
      permissions: fullUser.permissions || [],
      mustChangePassword: Boolean(fullUser.mustChangePassword),
      employeeId: fullUser.employeeId,
      department: fullUser.department,
      designation: fullUser.designation,
    };

    const token = createSessionToken(sessionPayload);

    const response = NextResponse.json({
      success: true,
      data: {
        user: sessionPayload,
        mustChangePassword: Boolean(fullUser.mustChangePassword),
      },
      message: 'Passkey verified successfully',
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'PASSKEY_LOGIN_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
