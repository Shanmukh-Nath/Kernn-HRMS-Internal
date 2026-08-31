export interface SalaryComponentItem {
  id?: string;
  name: string;
  type: 'EARNING' | 'DEDUCTION';
  calcType: 'FLAT' | 'PERCENTAGE_BASIC' | 'PERCENTAGE_GROSS';
  value: number;
  isTaxable?: boolean;
}

export interface PayrollCalculationInput {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  month: number; // 1-12
  year: number;
  baseSalary: number;
  hra?: number;
  allowances?: number;
  components?: SalaryComponentItem[];
  presentDays: number;
  halfDays: number;
  approvedPaidLeaves: number;
  publicHolidays: number;
  weekends: number;
  unpaidLeaveDays?: number;
  customDeductions?: number;
  bonus?: number;
  auditNotes?: string;
}

export interface CalculatedPayslip {
  employeeId: string;
  month: number;
  year: number;
  monthName: string;

  // Earnings
  basicSalary: number;
  hra: number;
  allowances: number;
  grossSalary: number;
  bonus: number;

  // Dynamic Line Items Breakdown
  lineItems: {
    name: string;
    type: 'EARNING' | 'DEDUCTION';
    amount: number;
  }[];

  // Attendance Metrics
  totalDaysInMonth: number;
  presentDays: number;
  halfDays: number;
  paidLeaves: number;
  holidaysAndWeekends: number;
  payableDays: number;
  unpaidLopDays: number;

  // Deductions
  lopDeduction: number;
  pfDeduction: number;
  esiDeduction: number;
  ptDeduction: number;
  taxDeduction: number;
  customDeductions: number;
  totalDeductions: number;

  // Final Net Pay
  netPayableSalary: number;
  status: 'DRAFT_PENDING_APPROVAL' | 'APPROVED_LOCKED';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Calculates complete itemized statutory payroll for an employee
 * Supports dynamic custom salary components or baseline statutory rules
 */
export function calculateEmployeePayroll(input: PayrollCalculationInput): CalculatedPayslip {
  const totalDaysInMonth = new Date(input.year, input.month, 0).getDate();
  const monthName = MONTH_NAMES[input.month - 1] || `Month ${input.month}`;

  // Attendance-based payable days calculation
  const halfDaysCredit = (input.halfDays || 0) * 0.5;
  const holidaysAndWeekends = (input.publicHolidays || 0) + (input.weekends || 0);
  const calculatedPayable = (input.presentDays || 0) + halfDaysCredit + (input.approvedPaidLeaves || 0) + holidaysAndWeekends;
  const payableDays = Math.min(totalDaysInMonth, Math.max(0, Math.round(calculatedPayable * 10) / 10));
  const unpaidLopDays = Math.max(0, Math.round((totalDaysInMonth - payableDays) * 10) / 10);

  const lineItems: { name: string; type: 'EARNING' | 'DEDUCTION'; amount: number }[] = [];

  let basicSalary = Math.round(input.baseSalary || 30000);
  let hra = Math.round(input.hra || 0);
  let allowances = Math.round(input.allowances || 0);
  let grossSalary = 0;

  // 1. If custom dynamic components are assigned to structure
  if (input.components && input.components.length > 0) {
    // Step A: Determine Basic
    const basicComp = input.components.find((c) => c.name.toLowerCase().includes('basic') || c.name.toLowerCase().includes('stipend'));
    if (basicComp) {
      basicSalary = Math.round(basicComp.value || input.baseSalary || 30000);
    }

    // Step B: Calculate Earnings
    let earningsTotal = 0;
    for (const comp of input.components.filter((c) => c.type === 'EARNING')) {
      let amount = 0;
      if (comp.calcType === 'FLAT') {
        amount = Math.round(comp.value);
      } else if (comp.calcType === 'PERCENTAGE_BASIC') {
        amount = Math.round((basicSalary * comp.value) / 100);
      }
      earningsTotal += amount;
      lineItems.push({ name: comp.name, type: 'EARNING', amount });

      if (comp.name.toLowerCase().includes('hra') || comp.name.toLowerCase().includes('house rent')) {
        hra = amount;
      }
    }
    allowances = Math.max(0, earningsTotal - basicSalary - hra);
    grossSalary = earningsTotal;
  } else {
    // Fallback baseline components
    basicSalary = Math.round(input.baseSalary || 30000);
    hra = Math.round(input.hra || basicSalary * 0.4);
    allowances = Math.round(input.allowances || 8000);
    grossSalary = basicSalary + hra + allowances;

    lineItems.push({ name: 'Basic Salary', type: 'EARNING', amount: basicSalary });
    lineItems.push({ name: 'House Rent Allowance (HRA)', type: 'EARNING', amount: hra });
    lineItems.push({ name: 'Special Allowance', type: 'EARNING', amount: allowances });
  }

  // Add Bonus if applicable
  const bonus = Math.round(input.bonus || 0);
  if (bonus > 0) {
    lineItems.push({ name: 'Performance Bonus', type: 'EARNING', amount: bonus });
    grossSalary += bonus;
  }

  // 2. LOP Deduction based on unexcused absence
  const perDaySalary = totalDaysInMonth > 0 ? grossSalary / totalDaysInMonth : 0;
  const lopDeduction = Math.round(unpaidLopDays * perDaySalary);
  if (lopDeduction > 0) {
    lineItems.push({ name: `Loss of Pay (${unpaidLopDays} Days LOP)`, type: 'DEDUCTION', amount: lopDeduction });
  }

  // 3. Deductions calculation
  let pfDeduction = 0;
  let esiDeduction = 0;
  let ptDeduction = 0;
  let customDeductions = Math.round(input.customDeductions || 0);
  let totalDeductions = lopDeduction + customDeductions;

  if (input.components && input.components.length > 0) {
    for (const comp of input.components.filter((c) => c.type === 'DEDUCTION')) {
      let amount = 0;
      if (comp.calcType === 'FLAT') {
        amount = Math.round(comp.value);
      } else if (comp.calcType === 'PERCENTAGE_BASIC') {
        amount = Math.round((basicSalary * comp.value) / 100);
      } else if (comp.calcType === 'PERCENTAGE_GROSS') {
        amount = Math.round((grossSalary * comp.value) / 100);
      }

      totalDeductions += amount;
      lineItems.push({ name: comp.name, type: 'DEDUCTION', amount });

      if (comp.name.toLowerCase().includes('provident fund') || comp.name.toLowerCase().includes('pf')) {
        pfDeduction = amount;
      } else if (comp.name.toLowerCase().includes('esi') || comp.name.toLowerCase().includes('esic')) {
        esiDeduction = amount;
      } else if (comp.name.toLowerCase().includes('professional tax') || comp.name.toLowerCase().includes('pt')) {
        ptDeduction = amount;
      }
    }
  } else {
    // Default statutory deductions
    pfDeduction = Math.round(basicSalary * 0.12);
    esiDeduction = grossSalary <= 21000 ? Math.round(grossSalary * 0.0075) : 0;
    ptDeduction = grossSalary >= 15000 ? 200 : 0;

    totalDeductions += pfDeduction + esiDeduction + ptDeduction;

    lineItems.push({ name: 'Provident Fund (PF 12%)', type: 'DEDUCTION', amount: pfDeduction });
    if (esiDeduction > 0) lineItems.push({ name: 'ESIC Employee Contribution', type: 'DEDUCTION', amount: esiDeduction });
    if (ptDeduction > 0) lineItems.push({ name: 'Professional Tax (PT)', type: 'DEDUCTION', amount: ptDeduction });
  }

  const taxDeduction = 0;
  const netPayableSalary = Math.max(0, grossSalary - totalDeductions);

  return {
    employeeId: input.employeeId,
    month: input.month,
    year: input.year,
    monthName,
    basicSalary,
    hra,
    allowances,
    grossSalary,
    bonus,
    lineItems,
    totalDaysInMonth,
    presentDays: input.presentDays || 0,
    halfDays: input.halfDays || 0,
    paidLeaves: input.approvedPaidLeaves || 0,
    holidaysAndWeekends,
    payableDays,
    unpaidLopDays,
    lopDeduction,
    pfDeduction,
    esiDeduction,
    ptDeduction,
    taxDeduction,
    customDeductions,
    totalDeductions,
    netPayableSalary,
    status: 'DRAFT_PENDING_APPROVAL',
  };
}
