/**
 * Master Enterprise Leave Rules Engine
 * Implements Sandwich Rule evaluation, Demographic & Service Eligibility checks,
 * and Application Constraints validation based on dynamic database policies.
 */

import { differenceInCalendarDays, eachDayOfInterval, format, parseISO } from 'date-fns';

export interface EmployeeLeaveProfile {
  id: string;
  name?: string;
  gender?: string;
  employeeType?: string;
  department?: string;
  designation?: string;
  joiningDate?: string | null;
  dateOfBirth?: string | null;
  isProbation?: boolean;
  isNoticePeriod?: boolean;
}

export interface LeavePolicyConfig {
  id: string;
  name: string;
  code: string;
  category?: string;
  defaultDaysPerYear?: number;
  accrualEnabled?: boolean;
  accrualFrequency?: string;
  accrualAmount?: number;
  allowCarryForward?: boolean;
  carryForwardLimit?: number;
  carryForwardExpiryDays?: number;
  maxAccumulation?: number;
  allowEncashment?: boolean;
  encashmentMaxDays?: number;

  // Demographics
  genderEligibility?: string; // 'All' | 'Male' | 'Female' | 'Other'
  eligibleEmployeeTypes?: string | string[]; // JSON array or string
  minServiceYears?: number;
  maxServiceYears?: number;
  minAge?: number;
  maxAge?: number;
  allowedDuringProbation?: boolean;
  allowedDuringNoticePeriod?: boolean;

  // Application Limits
  minDaysAllowed?: number;
  maxDaysAllowed?: number;
  minConsecutiveDays?: number;
  maxConsecutiveDays?: number;
  maxTimesPerYear?: number;
  maxTimesPerMonth?: number;
  minGapDays?: number;
  priorNoticeDays?: number;
  priorApprovalRequiredDays?: number;

  // Proof & Documentation
  requireProofDocument?: boolean;
  requiresMedicalCertificate?: boolean;
  proofDocumentLabel?: string;
  proofThresholdDays?: number;
  medicalCertificateAfterDays?: number;

  // Financials & Sandwich Rule
  isPaid?: boolean;
  affectsPayroll?: boolean;
  applySandwichRule?: boolean;
  allowNegativeBalance?: boolean;
  negativeBalanceLimit?: number;
}

export class LeaveRulesEngine {
  /**
   * Evaluates if employee is eligible based on demographic & employment parameters.
   */
  static validateDemographics(employee: EmployeeLeaveProfile, policy: LeavePolicyConfig): { eligible: boolean; reason?: string } {
    // 1. Gender Eligibility
    const policyGender = policy.genderEligibility || 'All';
    if (policyGender !== 'All' && employee.gender) {
      if (policyGender.toLowerCase() !== employee.gender.toLowerCase()) {
        return {
          eligible: false,
          reason: `Demographic Restriction: '${policy.name}' is only applicable for ${policyGender} employees.`,
        };
      }
    }

    // 2. Eligible Employee Types
    if (policy.eligibleEmployeeTypes) {
      let allowedTypes: string[] = [];
      try {
        allowedTypes = typeof policy.eligibleEmployeeTypes === 'string'
          ? JSON.parse(policy.eligibleEmployeeTypes)
          : policy.eligibleEmployeeTypes;
      } catch {}

      if (Array.isArray(allowedTypes) && allowedTypes.length > 0 && employee.employeeType) {
        const matches = allowedTypes.some((t) => t.toLowerCase() === (employee.employeeType || '').toLowerCase());
        if (!matches) {
          return {
            eligible: false,
            reason: `Role Restriction: '${policy.name}' is only applicable for [${allowedTypes.join(', ')}] staff categories.`,
          };
        }
      }
    }

    // 3. Service Years Eligibility
    if (employee.joiningDate && (policy.minServiceYears || policy.maxServiceYears)) {
      const joinDate = new Date(employee.joiningDate);
      const serviceYears = differenceInCalendarDays(new Date(), joinDate) / 365.25;

      if (policy.minServiceYears && serviceYears < policy.minServiceYears) {
        return {
          eligible: false,
          reason: `Service Tenure: Requires minimum ${policy.minServiceYears} year(s) of company tenure (Current: ${serviceYears.toFixed(1)} yrs).`,
        };
      }
      if (policy.maxServiceYears && serviceYears > policy.maxServiceYears) {
        return {
          eligible: false,
          reason: `Tenure Cap: Exceeds maximum tenure ceiling of ${policy.maxServiceYears} years.`,
        };
      }
    }

    // 4. Probation Restriction
    if (employee.isProbation && policy.allowedDuringProbation === false) {
      return {
        eligible: false,
        reason: `Policy Restriction: '${policy.name}' is not granted during the probationary period.`,
      };
    }

    // 5. Notice Period Restriction
    if (employee.isNoticePeriod && policy.allowedDuringNoticePeriod === false) {
      return {
        eligible: false,
        reason: `Policy Restriction: '${policy.name}' cannot be availed during notice period.`,
      };
    }

    return { eligible: true };
  }

  /**
   * Sandwich Rule Evaluator:
   * Detects if weekends or public holidays fall between the requested start and end dates.
   * If applySandwichRule is active, converts those off-days into chargeable leave days.
   */
  static evaluateSandwichRule(
    startDateStr: string,
    endDateStr: string,
    applySandwichRule: boolean,
    weeklyOffDays: string[] = ['Saturday', 'Sunday'],
    holidayDates: string[] = []
  ): {
    totalCalendarDays: number;
    sandwichOffDaysCount: number;
    effectiveChargeableDays: number;
    sandwichedDates: string[];
  } {
    const s = new Date(startDateStr);
    const e = new Date(endDateStr);
    const dayInterval = eachDayOfInterval({ start: s, end: e });
    const totalCalendarDays = dayInterval.length;

    if (!applySandwichRule) {
      // Standard: off-days and holidays are not charged as leave
      let workDaysCount = 0;
      for (const d of dayInterval) {
        const dayName = format(d, 'EEEE');
        const dStr = format(d, 'yyyy-MM-dd');
        const isWeeklyOff = weeklyOffDays.includes(dayName);
        const isHoliday = holidayDates.includes(dStr);
        if (!isWeeklyOff && !isHoliday) {
          workDaysCount++;
        }
      }
      return {
        totalCalendarDays,
        sandwichOffDaysCount: totalCalendarDays - workDaysCount,
        effectiveChargeableDays: Math.max(1, workDaysCount),
        sandwichedDates: [],
      };
    }

    // Sandwich Rule Active: all weekend/holiday days enclosed in the leave stretch are charged!
    const sandwichedDates: string[] = [];
    for (const d of dayInterval) {
      const dayName = format(d, 'EEEE');
      const dStr = format(d, 'yyyy-MM-dd');
      const isWeeklyOff = weeklyOffDays.includes(dayName);
      const isHoliday = holidayDates.includes(dStr);
      if (isWeeklyOff || isHoliday) {
        sandwichedDates.push(`${dStr} (${isWeeklyOff ? dayName : 'Holiday'})`);
      }
    }

    return {
      totalCalendarDays,
      sandwichOffDaysCount: sandwichedDates.length,
      effectiveChargeableDays: totalCalendarDays, // Charged fully under sandwich policy!
      sandwichedDates,
    };
  }

  /**
   * Application Limits Validator (Consecutive stretch, notice days, proofs, spacing gaps).
   */
  static validateApplication(
    totalDays: number,
    advanceNoticeDays: number,
    proofProvided: boolean,
    policy: LeavePolicyConfig,
    recentLeavesCountMonth: number = 0,
    recentLeavesCountYear: number = 0
  ): { valid: boolean; error?: string } {
    // 1. Min / Max days per request
    const minDays = Number(policy.minDaysAllowed || (policy as any).minDaysPerRequest) || 1;
    if (totalDays < minDays) {
      return { valid: false, error: `Policy Violation: Minimum request duration for '${policy.name}' is ${minDays} day(s).` };
    }

    const maxDays = Number(policy.maxDaysAllowed || (policy as any).maxConsecutiveDays) || 30;
    if (totalDays > maxDays) {
      return { valid: false, error: `Policy Violation: Exceeds maximum duration limit of ${maxDays} consecutive day(s).` };
    }

    // 2. Advance Notice Requirement
    const noticeRequired = Number(policy.priorApprovalRequiredDays ?? policy.priorNoticeDays) || 0;
    if (noticeRequired > 0 && advanceNoticeDays < noticeRequired) {
      return {
        valid: false,
        error: `Policy Violation: '${policy.name}' requires at least ${noticeRequired} day(s) advance notice. (Current: ${advanceNoticeDays} day(s)).`,
      };
    }

    // 3. Frequency Caps per Month / Year
    if (policy.maxTimesPerMonth && recentLeavesCountMonth >= policy.maxTimesPerMonth) {
      return {
        valid: false,
        error: `Frequency Limit: You have already applied ${recentLeavesCountMonth} time(s) this month. Limit is ${policy.maxTimesPerMonth}.`,
      };
    }
    if (policy.maxTimesPerYear && recentLeavesCountYear >= policy.maxTimesPerYear) {
      return {
        valid: false,
        error: `Frequency Limit: Annual application quota reached (${policy.maxTimesPerYear} applications/year).`,
      };
    }

    // 4. Proof / Medical Certificate Requirement
    const reqProof = Boolean(policy.requireProofDocument || policy.requiresMedicalCertificate);
    const proofThreshold = Number(policy.proofThresholdDays ?? policy.medicalCertificateAfterDays) || 1;
    if (reqProof && totalDays >= proofThreshold && !proofProvided) {
      const label = policy.proofDocumentLabel || 'Supporting Certificate / Doctor Prescription';
      return {
        valid: false,
        error: `Policy Violation: '${policy.name}' mandates '${label}' for requests of ${proofThreshold} day(s) or longer.`,
      };
    }

    return { valid: true };
  }
}
