import { NextResponse } from 'next/server';
import { passkeysCol } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pkCol = await passkeysCol();
    const totalCount = await pkCol.countDocuments({});

    return NextResponse.json({
      success: true,
      data: {
        totalRegistered: totalCount,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'CHECK_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
