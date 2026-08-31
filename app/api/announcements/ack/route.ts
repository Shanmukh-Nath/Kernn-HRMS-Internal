import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { announcementAcksCol, generateId } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { announcementId } = await req.json();
    if (!announcementId) {
      return NextResponse.json({ success: false, error: 'Announcement ID required' }, { status: 400 });
    }

    const acks = await announcementAcksCol();
    const ackId = generateId();
    const now = new Date();

    await acks.updateOne(
      { announcementId, userId: session.userId },
      {
        $setOnInsert: {
          id: ackId,
          announcementId,
          userId: session.userId,
          acknowledgedAt: now,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Acknowledgement recorded successfully',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ACK_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
