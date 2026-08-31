import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { holidaysCol, holidayClaimsCol, generateId } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { holidayId } = await req.json();
    if (!holidayId) {
      return NextResponse.json({ success: false, error: 'Holiday ID required' }, { status: 400 });
    }

    const holidays = await holidaysCol();
    const claims = await holidayClaimsCol();

    const holiday = await holidays.findOne({ $or: [{ id: holidayId }, { _id: holidayId }] });
    if (!holiday) {
      return NextResponse.json({ success: false, error: 'Holiday not found' }, { status: 404 });
    }

    if (holiday.type !== 'RESTRICTED_OPTIONAL' && !holiday.isOptional) {
      return NextResponse.json(
        { success: false, error: 'This is a mandatory gazetted holiday already granted to all employees.' },
        { status: 400 }
      );
    }

    const existingClaim = await claims.findOne({
      userId: session.userId,
      holidayId: holiday.id || holidayId,
    });

    if (existingClaim) {
      await claims.deleteOne({ _id: existingClaim._id });
      return NextResponse.json({
        success: true,
        claimed: false,
        message: `Unclaimed floating holiday '${holiday.name}'.`,
      });
    }

    const userClaims = await claims.find({ userId: session.userId }).toArray();
    const holidayIds = userClaims.map((c) => c.holidayId);
    const sameYearHolidays = await holidays
      .find({
        $or: [{ id: { $in: holidayIds } }, { _id: { $in: holidayIds } }],
        year: holiday.year,
      })
      .toArray();

    if (sameYearHolidays.length >= 2) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Annual Floating Quota Exhausted: You have already selected your 2 allotted floating holidays for this year.',
        },
        { status: 400 }
      );
    }

    const claimId = generateId();
    await claims.insertOne({
      id: claimId,
      userId: session.userId,
      holidayId: holiday.id || holidayId,
      status: 'APPROVED',
      claimedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      claimed: true,
      message: `Floating holiday '${holiday.name}' successfully claimed (${sameYearHolidays.length + 1}/2 used).`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'CLAIM_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
