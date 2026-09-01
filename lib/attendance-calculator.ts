import { differenceInMinutes, isValid, addMinutes } from 'date-fns';
import { parseAppDate, formatAppTime12, formatAppDate } from '@/lib/timezone';

export interface ShiftRuleConfig {
  id?: string;
  name: string;
  shiftStartTime: string; // "10:00"
  shiftEndTime: string;   // "18:00"
  gracePeriodMinutes: number; // 15
  lateMarkThresholdMinutes: number; // 45
  earlyExitThresholdMinutes: number; // 30
  halfDayMinHours: number; // 4.0
  fullDayMinHours: number; // 7.5
  debounceMinutes: number; // 3
  overtimeMinMinutes: number; // 30
  workingDays: string[];
}

export const DEFAULT_SHIFT_RULE: ShiftRuleConfig = {
  name: 'General Office Shift',
  shiftStartTime: '10:00',
  shiftEndTime: '18:00',
  gracePeriodMinutes: 15,
  lateMarkThresholdMinutes: 45,
  earlyExitThresholdMinutes: 30,
  halfDayMinHours: 4.0,
  fullDayMinHours: 7.5,
  debounceMinutes: 3,
  overtimeMinMinutes: 30,
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

export interface RawPunch {
  id: string;
  timestamp: Date | string;
  verificationType: string;
  eventType?: string;
  deviceUserId: string;
  employeeName?: string;
  employeeCode?: string;
}

export interface BreakInterval {
  goOutTime: string; // "01:15 PM"
  returnTime: string; // "02:00 PM"
  durationMinutes: number;
  outVerification?: string;
  returnVerification?: string;
}

export interface DailyAttendanceRecord {
  date: string; // "YYYY-MM-DD"
  formattedDate: string; // "01 Sep 2026"
  employeeId?: string;
  deviceUserId: string;
  employeeName: string;
  employeeCode: string;
  shiftName: string;
  scheduledShift: string; // "10:00 AM - 06:00 PM"

  // Processed Punches
  checkInTime: string | null; // "10:05 AM"
  checkInIso: string | null;
  checkInVerification: string | null;
  checkInStatus: 'ON_TIME' | 'LATE' | 'VERY_LATE' | 'NOT_RECORDED';
  minutesLate: number;

  checkOutTime: string | null; // "06:15 PM"
  checkOutIso: string | null;
  checkOutVerification: string | null;
  checkOutStatus: 'NORMAL' | 'EARLY_EXIT' | 'OVERTIME' | 'NOT_RECORDED';
  minutesEarlyExit: number;
  minutesOvertime: number;

  // Intermediary Breaks
  breaks: BreakInterval[];
  totalBreakMinutes: number;

  // Working Durations
  grossDurationMinutes: number;
  netWorkDurationMinutes: number;
  netWorkHours: number;

  // Consolidated Daily Status
  status: 'PRESENT' | 'LATE' | 'EARLY_EXIT' | 'HALF_DAY' | 'OVERTIME' | 'SINGLE_PUNCH' | 'ABSENT';
  statusColor: string;
  rawPunchesCount: number;
  cleanPunchesCount: number;
}

/**
 * Parses "HH:mm" time string into a Date object on a given reference date in IST
 */
function createDateWithTime(dateStr: string, timeStr: string): Date {
  const [hours, minutes] = (timeStr || '09:00').split(':').map(Number);
  const normalizedDate = dateStr.slice(0, 10);
  const isoStr = `${normalizedDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+05:30`;
  return new Date(isoStr);
}

/**
 * Intelligent Algorithm to resolve raw punches into a structured Daily Attendance Record
 */
export function calculateDailyAttendance(
  dateStr: string, // "YYYY-MM-DD"
  rawPunches: RawPunch[],
  rule: ShiftRuleConfig = DEFAULT_SHIFT_RULE,
  employeeInfo: { name: string; code?: string; id?: string }
): DailyAttendanceRecord {
  const sortedPunches = [...rawPunches].sort(
    (a, b) => parseAppDate(a.timestamp).getTime() - parseAppDate(b.timestamp).getTime()
  );

  const formattedDate = formatAppDate(dateStr);
  const shiftStart = createDateWithTime(dateStr, rule.shiftStartTime);
  const shiftEnd = createDateWithTime(dateStr, rule.shiftEndTime);
  const graceEnd = addMinutes(shiftStart, rule.gracePeriodMinutes || 15);
  const lateEnd = addMinutes(shiftStart, rule.lateMarkThresholdMinutes || 45);
  const earlyExitCutoff = addMinutes(shiftEnd, -(rule.earlyExitThresholdMinutes || 30));
  const overtimeCutoff = addMinutes(shiftEnd, rule.overtimeMinMinutes || 30);
  const scheduledShift = `${formatAppTime12(shiftStart)} - ${formatAppTime12(shiftEnd)}`;

  // If no punches recorded
  if (sortedPunches.length === 0) {
    return {
      date: dateStr,
      formattedDate,
      employeeId: employeeInfo.id,
      deviceUserId: rawPunches[0]?.deviceUserId || '',
      employeeName: employeeInfo.name || 'Unknown',
      employeeCode: employeeInfo.code || `EMP-${rawPunches[0]?.deviceUserId || '0'}`,
      shiftName: rule.name,
      scheduledShift,
      checkInTime: null,
      checkInIso: null,
      checkInVerification: null,
      checkInStatus: 'NOT_RECORDED',
      minutesLate: 0,
      checkOutTime: null,
      checkOutIso: null,
      checkOutVerification: null,
      checkOutStatus: 'NOT_RECORDED',
      minutesEarlyExit: 0,
      minutesOvertime: 0,
      breaks: [],
      totalBreakMinutes: 0,
      grossDurationMinutes: 0,
      netWorkDurationMinutes: 0,
      netWorkHours: 0,
      status: 'ABSENT',
      statusColor: 'bg-rose-50 text-rose-700 border-rose-200',
      rawPunchesCount: 0,
      cleanPunchesCount: 0,
    };
  }

  // First punch = Check In
  const firstPunch = sortedPunches[0];
  const firstPunchDate = parseAppDate(firstPunch.timestamp);
  const checkInTime = formatAppTime12(firstPunchDate);
  const checkInIso = firstPunchDate.toISOString();
  const checkInVerification = firstPunch.verificationType;

  // Check In Status
  let checkInStatus: 'ON_TIME' | 'LATE' | 'VERY_LATE' | 'NOT_RECORDED' = 'ON_TIME';
  let minutesLate = 0;

  if (firstPunchDate > graceEnd) {
    minutesLate = Math.max(0, Math.round((firstPunchDate.getTime() - shiftStart.getTime()) / (1000 * 60)));
    if (firstPunchDate <= lateEnd) {
      checkInStatus = 'LATE';
    } else {
      checkInStatus = 'VERY_LATE';
    }
  }

  // Handle single punch of the day
  if (sortedPunches.length === 1) {
    return {
      date: dateStr,
      formattedDate,
      employeeId: employeeInfo.id,
      deviceUserId: firstPunch.deviceUserId,
      employeeName: employeeInfo.name || `Employee ${firstPunch.deviceUserId}`,
      employeeCode: employeeInfo.code || `EMP-${firstPunch.deviceUserId}`,
      shiftName: rule.name,
      scheduledShift,
      checkInTime,
      checkInIso,
      checkInVerification,
      checkInStatus,
      minutesLate,
      checkOutTime: null,
      checkOutIso: null,
      checkOutVerification: null,
      checkOutStatus: 'NOT_RECORDED',
      minutesEarlyExit: 0,
      minutesOvertime: 0,
      breaks: [],
      totalBreakMinutes: 0,
      grossDurationMinutes: 0,
      netWorkDurationMinutes: 0,
      netWorkHours: 0,
      status: 'SINGLE_PUNCH',
      statusColor: 'bg-amber-50 text-amber-700 border-amber-200',
      rawPunchesCount: 1,
      cleanPunchesCount: 1,
    };
  }

  // Last punch = Check Out (when 2 or more punches exist)
  const lastPunch = sortedPunches[sortedPunches.length - 1];
  const lastPunchDate = parseAppDate(lastPunch.timestamp);
  const checkOutTime = formatAppTime12(lastPunchDate);
  const checkOutIso = lastPunchDate.toISOString();
  const checkOutVerification = lastPunch.verificationType;

  // Check Out Status
  let checkOutStatus: 'NORMAL' | 'EARLY_EXIT' | 'OVERTIME' | 'NOT_RECORDED' = 'NORMAL';
  let minutesEarlyExit = 0;
  let minutesOvertime = 0;

  if (lastPunchDate < earlyExitCutoff) {
    checkOutStatus = 'EARLY_EXIT';
    minutesEarlyExit = Math.max(0, Math.round((shiftEnd.getTime() - lastPunchDate.getTime()) / (1000 * 60)));
  } else if (lastPunchDate >= overtimeCutoff) {
    checkOutStatus = 'OVERTIME';
    minutesOvertime = Math.max(0, Math.round((lastPunchDate.getTime() - shiftEnd.getTime()) / (1000 * 60)));
  }

  // Intermediary Breaks (Go Out & Return Pairing)
  const breaks: BreakInterval[] = [];
  const midPunches = sortedPunches.slice(1, sortedPunches.length - 1);

  for (let i = 0; i < midPunches.length; i += 2) {
    const outP = midPunches[i];
    const retP = midPunches[i + 1];

    if (outP && retP) {
      const outDate = parseAppDate(outP.timestamp);
      const retDate = parseAppDate(retP.timestamp);
      const dur = Math.max(0, Math.round((retDate.getTime() - outDate.getTime()) / (1000 * 60)));
      breaks.push({
        goOutTime: formatAppTime12(outDate),
        returnTime: formatAppTime12(retDate),
        durationMinutes: dur,
        outVerification: outP.verificationType,
        returnVerification: retP.verificationType,
      });
    }
  }

  const totalBreakMinutes = breaks.reduce((acc, b) => acc + b.durationMinutes, 0);
  const grossDurationMinutes = Math.max(0, Math.round((lastPunchDate.getTime() - firstPunchDate.getTime()) / (1000 * 60)));
  const netWorkDurationMinutes = Math.max(0, grossDurationMinutes - totalBreakMinutes);
  const netWorkHours = Number((netWorkDurationMinutes / 60).toFixed(2));

  // Determine Daily Status
  let status: 'PRESENT' | 'LATE' | 'EARLY_EXIT' | 'HALF_DAY' | 'OVERTIME' | 'SINGLE_PUNCH' | 'ABSENT' = 'PRESENT';
  let statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';

  if (netWorkHours < (rule.halfDayMinHours || 4.0)) {
    status = 'HALF_DAY';
    statusColor = 'bg-orange-50 text-orange-700 border-orange-200';
  } else if (minutesEarlyExit > 0) {
    status = 'EARLY_EXIT';
    statusColor = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (minutesLate > 0) {
    status = 'LATE';
    statusColor = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (minutesOvertime >= (rule.overtimeMinMinutes || 30)) {
    status = 'OVERTIME';
    statusColor = 'bg-blue-50 text-blue-700 border-blue-200';
  }

  return {
    date: dateStr,
    formattedDate,
    employeeId: employeeInfo.id,
    deviceUserId: firstPunch.deviceUserId,
    employeeName: employeeInfo.name || `Employee ${firstPunch.deviceUserId}`,
    employeeCode: employeeInfo.code || `EMP-${firstPunch.deviceUserId}`,
    shiftName: rule.name,
    scheduledShift,
    checkInTime,
    checkInIso,
    checkInVerification,
    checkInStatus,
    minutesLate,
    checkOutTime,
    checkOutIso,
    checkOutVerification,
    checkOutStatus,
    minutesEarlyExit,
    minutesOvertime,
    breaks,
    totalBreakMinutes,
    grossDurationMinutes,
    netWorkDurationMinutes,
    netWorkHours,
    status,
    statusColor,
    rawPunchesCount: rawPunches.length,
    cleanPunchesCount: sortedPunches.length,
  };
}

