import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession, AUTH_COOKIE_NAME } from '@/lib/auth';
import { findUserById } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No active session' } },
        { status: 401 }
      );
    }

    // Refresh from DB
    const freshUser = await findUserById(session.userId);

    return NextResponse.json({
      success: true,
      data: {
        user: freshUser || session,
        mustChangePassword: session.mustChangePassword,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_CHECK_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
