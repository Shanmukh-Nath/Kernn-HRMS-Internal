/**
 * Master Enterprise Attendance Punch & Shift Rules Processor
 * Evaluates physical biometrics, mobile GPS punches, or manual timestamps
 * dynamically against database-driven AttendanceSetting records.
 */

export interface ShiftRuleConfig {
  shiftStart: string; // "09:00:00"
  shiftEnd: string;   // "18:00:00"
  gracePeriodMinutes: number;   // e.g. 15
  earlyCheckInBuffer: number;   // e.g. 60
  lateCheckInBuffer: number;    // e.g. 120
  halfDayAfterMinutes: number;  // e.g. 180
  halfDayMinimumHours: number;  // e.g. 4.0
  workingDays?: string[];       // ["Monday", "Tuesday", ...]
  weeklyOffDays?: string[];     // ["Saturday", "Sunday"]
  autoCalculateOvertime?: boolean;
  overtimeAfterHours?: number;  // e.g. 8.0
  overtimeRate?: number;        // e.g. 1.5
  breakDurationMinutes?: number;
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}

export class AttendancePunchEngine {
  /**
   * Evaluates check-in punch timestamp against shift grace buffers and triggers.
   */
  static evaluateCheckIn(punchTimeStr: string, shiftSetting: ShiftRuleConfig): {
    status: 'Present' | 'Late' | 'HalfDay' | 'Absent';
    lateByMinutes: number;
    withinEarlyBuffer: boolean;
    remarks?: string;
  } {
    const punchMinutes = timeToMinutes(punchTimeStr);
    const shiftStartMinutes = timeToMinutes(shiftSetting.shiftStart);

    const earlyBufferLimit = shiftStartMinutes - (shiftSetting.earlyCheckInBuffer || 60);
    const graceLimit = shiftStartMinutes + (shiftSetting.gracePeriodMinutes || 15);
    const halfDayLimit = shiftStartMinutes + (shiftSetting.halfDayAfterMinutes || 180);
    const cutoffLimit = shiftStartMinutes + (shiftSetting.lateCheckInBuffer || 240);

    const withinEarlyBuffer = punchMinutes >= earlyBufferLimit;

    if (punchMinutes <= shiftStartMinutes) {
      return { status: 'Present', lateByMinutes: 0, withinEarlyBuffer, remarks: 'On Time' };
    }

    if (punchMinutes <= graceLimit) {
      const late = punchMinutes - shiftStartMinutes;
      return { status: 'Present', lateByMinutes: late, withinEarlyBuffer, remarks: `Covered by ${shiftSetting.gracePeriodMinutes}m grace buffer` };
    }

    if (punchMinutes <= halfDayLimit) {
      const late = punchMinutes - shiftStartMinutes;
      return { status: 'Late', lateByMinutes: late, withinEarlyBuffer, remarks: `Late by ${late} mins` };
    }

    if (punchMinutes <= cutoffLimit) {
      const late = punchMinutes - shiftStartMinutes;
      return { status: 'HalfDay', lateByMinutes: late, withinEarlyBuffer, remarks: 'Marked Half-Day (exceeded late threshold)' };
    }

    return { status: 'Absent', lateByMinutes: punchMinutes - shiftStartMinutes, withinEarlyBuffer, remarks: 'Marked Absent (punch beyond cutoff window)' };
  }

  /**
   * Evaluates total work hours and overtime credit upon check-out.
   */
  static evaluateDailySettlement(
    checkInTimeStr: string,
    checkOutTimeStr: string,
    shiftSetting: ShiftRuleConfig,
    currentStatus: string = 'Present'
  ): {
    actualWorkHours: number;
    overtimeHours: number;
    finalStatus: string;
    earlyDepartureMinutes: number;
  } {
    const inMin = timeToMinutes(checkInTimeStr);
    const outMin = timeToMinutes(checkOutTimeStr);
    const shiftEndMin = timeToMinutes(shiftSetting.shiftEnd);

    const rawMinutes = Math.max(0, outMin - inMin);
    const breakMin = shiftSetting.breakDurationMinutes || 0;
    const netWorkedMinutes = Math.max(0, rawMinutes - breakMin);
    const actualWorkHours = Math.round((netWorkedMinutes / 60) * 100) / 100;

    let earlyDepartureMinutes = 0;
    if (outMin < shiftEndMin) {
      earlyDepartureMinutes = shiftEndMin - outMin;
    }

    // Minimum physical hours check for Half-Day
    const halfDayMin = shiftSetting.halfDayMinimumHours || 4.0;
    let finalStatus = currentStatus;
    if (actualWorkHours < halfDayMin) {
      finalStatus = 'Absent';
    } else if (actualWorkHours < 7.0 && finalStatus === 'Present') {
      finalStatus = 'HalfDay';
    }

    // Overtime Calculation
    let overtimeHours = 0;
    const otEnabled = Boolean(shiftSetting.autoCalculateOvertime);
    const otThreshold = shiftSetting.overtimeAfterHours || 8.0;

    if (otEnabled && actualWorkHours > otThreshold) {
      overtimeHours = Math.round((actualWorkHours - otThreshold) * 100) / 100;
    }

    return {
      actualWorkHours,
      overtimeHours,
      finalStatus,
      earlyDepartureMinutes,
    };
  }
}
