export interface LeaveTypeDefinition {
  id?: string;
  name: string;
  code: string;
  daysPerYear: number;
  accrualFrequency: 'MONTHLY' | 'YEARLY';
  carryForwardLimit: number;
  isPaid: boolean;
  colorHex: string;
  description?: string;
}

export const DEFAULT_LEAVE_TYPES: LeaveTypeDefinition[] = [
  {
    name: 'Casual Leave',
    code: 'CL',
    daysPerYear: 12,
    accrualFrequency: 'MONTHLY',
    carryForwardLimit: 0,
    isPaid: true,
    colorHex: '#3B82F6',
    description: 'For short personal engagements and unexpected events',
  },
  {
    name: 'Sick Leave',
    code: 'SL',
    daysPerYear: 10,
    accrualFrequency: 'YEARLY',
    carryForwardLimit: 5,
    isPaid: true,
    colorHex: '#EF4444',
    description: 'Medical and health related recovery leaves',
  },
  {
    name: 'Paid / Earned Leave',
    code: 'PL',
    daysPerYear: 18,
    accrualFrequency: 'MONTHLY',
    carryForwardLimit: 30,
    isPaid: true,
    colorHex: '#10B981',
    description: 'Accrued annual vacation and planned time off',
  },
  {
    name: 'Loss of Pay (Unpaid)',
    code: 'LOP',
    daysPerYear: 0,
    accrualFrequency: 'YEARLY',
    carryForwardLimit: 0,
    isPaid: false,
    colorHex: '#6B7280',
    description: 'Unpaid absence once all paid quotas are exhausted',
  },
];

/**
 * Calculates prorated accrued days up to current month
 */
export function calculateAccruedDays(
  daysPerYear: number,
  accrualFrequency: 'MONTHLY' | 'YEARLY',
  currentMonth: number // 1-12
): number {
  if (accrualFrequency === 'YEARLY') {
    return daysPerYear;
  }
  const perMonth = daysPerYear / 12;
  return Math.round(perMonth * currentMonth * 10) / 10;
}
