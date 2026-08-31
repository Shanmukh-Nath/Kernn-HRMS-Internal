import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get('deviceId');

  try {
    const history = await prisma.deviceSync.findMany({
      where: deviceId ? { deviceId } : {},
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: {
        device: {
          select: {
            name: true,
            deviceId: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Query failed' } },
      { status: 500 }
    );
  }
}
