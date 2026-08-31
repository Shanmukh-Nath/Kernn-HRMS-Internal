import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { holidaysCol, holidayClaimsCol, generateId } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || '2026', 10);
    const category = searchParams.get('category');

    const holidays = await holidaysCol();
    const claims = await holidayClaimsCol();

    const filter: Record<string, any> = { year };
    if (category && category !== 'ALL') {
      filter.type = category;
    }

    const holidayList = await holidays.find(filter).sort({ date: 1 }).toArray();

    let userClaims: string[] = [];
    if (session?.userId) {
      const userClaimDocs = await claims.find({ userId: session.userId }).toArray();
      userClaims = userClaimDocs.map((c) => c.holidayId);
    }

    const enriched = holidayList.map((h) => ({
      ...h,
      id: h.id || h._id?.toString(),
      isOptional: Boolean(h.isOptional || h.type === 'RESTRICTED_OPTIONAL'),
      isClaimed: userClaims.includes(h.id || h._id?.toString()),
      type: h.type || (h.isOptional ? 'RESTRICTED_OPTIONAL' : 'GAZETTED'),
      applicableDept: h.applicableDept || 'ALL',
    }));

    return NextResponse.json({
      success: true,
      data: enriched,
      meta: {
        total: holidayList.length,
        gazettedCount: holidayList.filter((h) => h.type === 'GAZETTED' || !h.isOptional).length,
        optionalCount: holidayList.filter((h) => h.type === 'RESTRICTED_OPTIONAL' || h.isOptional).length,
        claimedCount: userClaims.length,
        floatingQuota: 2,
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
      (!hasPermission(session, 'holidays:manage') &&
        session.role !== 'SUPER_ADMIN' &&
        session.role !== 'HR_ADMIN')
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin privileges required' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    if (!body.name || !body.date) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Holiday name and date are required' } },
        { status: 400 }
      );
    }

    const holidays = await holidaysCol();
    const id = generateId();
    const year = new Date(body.date).getFullYear();
    const type = body.type || (body.isOptional ? 'RESTRICTED_OPTIONAL' : 'GAZETTED');
    const isOptional = type === 'RESTRICTED_OPTIONAL';

    const doc = {
      id,
      name: body.name,
      date: new Date(body.date),
      type,
      isOptional,
      applicableDept: body.applicableDept || 'ALL',
      description: body.description || '',
      year,
      createdAt: new Date(),
    };

    await holidays.insertOne(doc);

    return NextResponse.json({
      success: true,
      data: { id, name: body.name, date: body.date, type },
      message: 'Holiday added to corporate calendar successfully',
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
      (!hasPermission(session, 'holidays:manage') &&
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
      return NextResponse.json({ success: false, error: 'Holiday ID required' }, { status: 400 });
    }

    const holidays = await holidaysCol();
    const claims = await holidayClaimsCol();

    await claims.deleteMany({ holidayId: id });
    await holidays.deleteOne({ $or: [{ id }, { _id: id }] });

    return NextResponse.json({ success: true, message: 'Holiday removed from calendar' });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
