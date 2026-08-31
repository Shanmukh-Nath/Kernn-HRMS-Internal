import { NextRequest, NextResponse } from 'next/server';
import { getRolesWithPermissions, updateRolePermissions } from '@/lib/db';
import { getAuthSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getRolesWithPermissions();
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (session && !hasPermission(session, 'roles:manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to modify roles' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { roleId, permissions } = body;

    if (!roleId || !Array.isArray(permissions)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Role ID and permissions array are required' } },
        { status: 400 }
      );
    }

    const result = await updateRolePermissions(roleId, permissions);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Role permissions updated successfully',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
