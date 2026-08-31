import { NextRequest, NextResponse } from 'next/server';
import { getStoredShiftRule, saveStoredShiftRule } from '@/lib/rules-store';
import { attendanceRulesCol, generateId } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const fileRule: any = getStoredShiftRule();
    const rulesCol = await attendanceRulesCol();
    const dbRule = await rulesCol.findOne({ isDefault: true });

    const merged = {
      ...fileRule,
      ...(dbRule || {}),
      weeklyOffDays:
        typeof dbRule?.weeklyOffDays === 'string'
          ? (() => {
              try {
                return JSON.parse(dbRule.weeklyOffDays);
              } catch {
                return ['Saturday', 'Sunday'];
              }
            })()
          : dbRule?.weeklyOffDays || fileRule.weeklyOffDays || ['Saturday', 'Sunday'],
      workingDays:
        typeof dbRule?.workingDays === 'string'
          ? (() => {
              try {
                return JSON.parse(dbRule.workingDays);
              } catch {
                return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
              }
            })()
          : dbRule?.workingDays || fileRule.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      earlyCheckInBuffer: dbRule?.earlyCheckInBuffer ?? fileRule.earlyCheckInBuffer ?? 60,
      lateCheckInBuffer: dbRule?.lateCheckInBuffer ?? fileRule.lateCheckInBuffer ?? 120,
      halfDayAfterMinutes: dbRule?.halfDayAfterMinutes ?? fileRule.halfDayAfterMinutes ?? 180,
      halfDayMinimumHours: dbRule?.halfDayMinimumHours ?? fileRule.halfDayMinimumHours ?? 4.0,
      autoCalculatePresent: Boolean(dbRule?.autoCalculatePresent ?? 1),
      autoCalculateHalfDay: Boolean(dbRule?.autoCalculateHalfDay ?? 1),
      autoCalculateOvertime: Boolean(dbRule?.autoCalculateOvertime ?? 0),
      overtimeAfterHours: dbRule?.overtimeAfterHours ?? 8.0,
      overtimeRate: dbRule?.overtimeRate ?? 1.5,
      breakDurationMinutes: dbRule?.breakDurationMinutes ?? 60,
      breakStartTime: dbRule?.breakStartTime ?? '13:00',
      breakEndTime: dbRule?.breakEndTime ?? '14:00',
    };

    return NextResponse.json({
      success: true,
      data: merged,
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
    const body = await req.json();

    const dataToSave = {
      name: body.name || 'General Office Shift',
      shiftStartTime: body.shiftStartTime || '09:00',
      shiftEndTime: body.shiftEndTime || '18:00',
      gracePeriodMinutes: Number(body.gracePeriodMinutes) || 15,
      earlyCheckInBuffer: Number(body.earlyCheckInBuffer) || 60,
      lateCheckInBuffer: Number(body.lateCheckInBuffer) || 120,
      halfDayAfterMinutes: Number(body.halfDayAfterMinutes) || 180,
      halfDayMinimumHours: Number(body.halfDayMinimumHours) || 4.0,
      lateMarkThresholdMinutes: Number(body.lateMarkThresholdMinutes) || 45,
      earlyExitThresholdMinutes: Number(body.earlyExitThresholdMinutes) || 30,
      debounceMinutes: Number(body.debounceMinutes) || 3,
      workingDays: Array.isArray(body.workingDays)
        ? body.workingDays
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      weeklyOffDays: Array.isArray(body.weeklyOffDays)
        ? body.weeklyOffDays
        : ['Saturday', 'Sunday'],
      autoCalculatePresent: body.autoCalculatePresent ? 1 : 0,
      autoCalculateHalfDay: body.autoCalculateHalfDay ? 1 : 0,
      autoCalculateOvertime: body.autoCalculateOvertime ? 1 : 0,
      overtimeAfterHours: Number(body.overtimeAfterHours) || 8.0,
      overtimeRate: Number(body.overtimeRate) || 1.5,
      breakDurationMinutes: Number(body.breakDurationMinutes) || 60,
      breakStartTime: body.breakStartTime || '13:00:00',
      breakEndTime: body.breakEndTime || '14:00:00',
      isDefault: true,
      updatedAt: new Date(),
    };

    saveStoredShiftRule(dataToSave as any);

    const rulesCol = await attendanceRulesCol();
    await rulesCol.updateOne(
      { isDefault: true },
      {
        $set: dataToSave,
        $setOnInsert: {
          id: generateId(),
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      data: dataToSave,
      message: 'Shift timing buffers and overtime parameters successfully saved to database.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SAVE_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
