import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { announcementsCol, announcementAcksCol, employeesCol, generateId } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');

    const announcements = await announcementsCol();
    const acks = await announcementAcksCol();
    const employees = await employeesCol();

    const filter: Record<string, any> = {};
    if (category && category !== 'ALL') {
      filter.category = category;
    }

    const list = await announcements
      .find(filter)
      .sort({ isPinned: -1, publishedAt: -1 })
      .limit(30)
      .toArray();

    const enriched = await Promise.all(
      list.map(async (a) => {
        const id = a.id || a._id?.toString();
        const ackCount = await acks.countDocuments({ announcementId: id });
        let isAcknowledged = false;
        if (session?.userId) {
          const userAck = await acks.findOne({ announcementId: id, userId: session.userId });
          isAcknowledged = Boolean(userAck);
        }

        return {
          ...a,
          id,
          isPinned: Boolean(a.isPinned),
          requiresAcknowledgement: Boolean(a.requiresAcknowledgement),
          ackCount,
          isAcknowledged,
        };
      })
    );

    const totalStaff = await employees.countDocuments({ status: 'ACTIVE' });

    return NextResponse.json({
      success: true,
      data: enriched,
      meta: {
        totalStaff: totalStaff || 1,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'FETCH_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (
      !session ||
      (!hasPermission(session, 'announcements:manage') &&
        session.role !== 'SUPER_ADMIN' &&
        session.role !== 'HR_ADMIN')
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to post bulletins' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    if (!body.title || !body.content) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Title and content are required' } },
        { status: 400 }
      );
    }

    const announcements = await announcementsCol();
    const id = generateId();
    const authorName = session?.name || 'HR Management';
    const now = new Date();

    const doc = {
      id,
      title: body.title,
      content: body.content,
      priority: body.priority || 'NORMAL',
      category: body.category || 'POLICY_UPDATE',
      targetDept: body.targetDept || 'ALL',
      isPinned: Boolean(body.isPinned),
      requiresAcknowledgement: Boolean(body.requiresAcknowledgement),
      authorName,
      publishedAt: now,
      createdAt: now,
    };

    await announcements.insertOne(doc);

    return NextResponse.json({
      success: true,
      data: { id, title: body.title },
      message: 'Bulletin announcement published to corporate notice board.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'CREATE_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (
      !session ||
      (!hasPermission(session, 'announcements:manage') &&
        session.role !== 'SUPER_ADMIN' &&
        session.role !== 'HR_ADMIN')
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin privileges required' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Announcement ID required' }, { status: 400 });
    }

    const announcements = await announcementsCol();
    const acks = await announcementAcksCol();

    await acks.deleteMany({ announcementId: id });
    await announcements.deleteOne({ $or: [{ id }, { _id: id }] });

    return NextResponse.json({ success: true, message: 'Notice removed from board' });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
