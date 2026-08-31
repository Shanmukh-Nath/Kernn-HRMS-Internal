import {
  leaveTypesCol,
  employeesCol,
  leaveBalancesCol,
  leaveAccrualLogsCol,
  generateId,
} from './mongodb';

export interface AccrualRunOptions {
  leaveTypeId?: string;
  frequency?: string; // 'Monthly' | 'Quarterly' | 'HalfYearly' | 'Yearly' | 'ALL'
  cycle?: string; // e.g. '2026-08'
  executedBy?: string;
  forceRerun?: boolean;
}

export class LeaveAccrualEngine {
  /**
   * Evaluates whether an employee meets the dynamic policy criteria for leave accrual.
   */
  static isEmployeeEligible(leaveType: any, employee: any): { eligible: boolean; reason?: string } {
    // 1. Gender Eligibility
    if (leaveType.genderEligibility && leaveType.genderEligibility !== 'All') {
      if (employee.gender && employee.gender.toLowerCase() !== leaveType.genderEligibility.toLowerCase()) {
        return { eligible: false, reason: `Gender mismatch (${employee.gender} vs required ${leaveType.genderEligibility})` };
      }
    }

    // 2. Probation Restriction
    if (leaveType.allowedDuringProbation === 0 || leaveType.allowedDuringProbation === false) {
      if (employee.status === 'PROBATION') {
        return { eligible: false, reason: 'Leave accrual disabled during probation period' };
      }
    }

    // 3. Minimum Service Tenure (Years)
    if (leaveType.minServiceYears && leaveType.minServiceYears > 0) {
      const joining = employee.dateOfJoining ? new Date(employee.dateOfJoining) : new Date();
      const now = new Date();
      const yearsOfService = (now.getTime() - joining.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (yearsOfService < leaveType.minServiceYears) {
        return { eligible: false, reason: `Requires min ${leaveType.minServiceYears} years of service (Current: ${yearsOfService.toFixed(1)}y)` };
      }
    }

    return { eligible: true };
  }

  /**
   * Executes the automated/manual periodic accrual run across active employees.
   */
  static async runAccrualCycle(options: AccrualRunOptions = {}) {
    const leaveTypesColHandle = await leaveTypesCol();
    const employeesColHandle = await employeesCol();
    const leaveBalancesColHandle = await leaveBalancesCol();
    const leaveAccrualLogsColHandle = await leaveAccrualLogsCol();

    const now = new Date();
    const cycle = options.cycle || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const year = Number(cycle.split('-')[0]) || now.getFullYear();
    const executedBy = options.executedBy || 'SYSTEM_CRON';

    // 1. Fetch eligible LeaveTypes configured for accrual
    const filter: Record<string, any> = { accrualEnabled: { $in: [true, 1] } };
    if (options.leaveTypeId) {
      filter.$or = [{ id: options.leaveTypeId }, { code: options.leaveTypeId }];
    } else if (options.frequency && options.frequency !== 'ALL') {
      filter.accrualFrequency = new RegExp(`^${options.frequency}$`, 'i');
    }

    const leaveTypes = await leaveTypesColHandle.find(filter).toArray();

    if (leaveTypes.length === 0) {
      return {
        success: true,
        message: 'No leave policies matching accrual criteria found.',
        cycle,
        totalCredited: 0,
        processedEmployees: 0,
        itemizedLogs: [],
      };
    }

    // 2. Fetch all active employees
    const employees = await employeesColHandle.find({ status: { $in: ['ACTIVE', 'PROBATION'] } }).toArray();

    let totalCreditedDays = 0;
    let totalEmployeesCredited = 0;
    let totalCappedCount = 0;
    const itemizedLogs: any[] = [];

    for (const lt of leaveTypes) {
      const accrualAmount = Number(lt.accrualAmount) || 0;
      if (accrualAmount <= 0) continue;

      const maxAccumulation = lt.maxAccumulation ? Number(lt.maxAccumulation) : null;
      const frequency = lt.accrualFrequency || 'Monthly';

      for (const emp of employees) {
        // Demographic & Probation Guard
        const eligibility = this.isEmployeeEligible(lt, emp);
        if (!eligibility.eligible) continue;

        // Check if already credited for this cycle
        if (!options.forceRerun) {
          const alreadyLogged = await leaveAccrualLogsColHandle.findOne({
            leaveTypeId: lt.id,
            employeeId: emp.id,
            cycle,
          });
          if (alreadyLogged) continue;
        }

        // Get or initialize LeaveBalance record
        let balanceRecord = await leaveBalancesColHandle.findOne({
          employeeId: emp.id,
          leaveTypeId: lt.id,
          year,
        });

        if (!balanceRecord) {
          const newId = generateId();
          const newRec = {
            id: newId,
            employeeId: emp.id,
            leaveTypeId: lt.id,
            year,
            allocated: 0,
            accrued: 0,
            used: 0,
            pending: 0,
            balance: 0,
            carriedForward: 0,
            updatedAt: now,
          };
          await leaveBalancesColHandle.insertOne(newRec);
          balanceRecord = newRec;
        }

        const currentBalance = Number(balanceRecord.balance) || 0;
        let creditToApply = accrualAmount;
        let wasCapped = 0;

        if (maxAccumulation !== null && maxAccumulation > 0) {
          if (currentBalance + accrualAmount > maxAccumulation) {
            creditToApply = Math.max(0, maxAccumulation - currentBalance);
            wasCapped = 1;
            totalCappedCount++;
          }
        }

        if (creditToApply > 0 || wasCapped) {
          const newBalance = Math.round((currentBalance + creditToApply) * 100) / 100;
          const newAccrued = Math.round(((Number(balanceRecord.accrued) || 0) + creditToApply) * 100) / 100;
          const newAllocated = Math.round(((Number(balanceRecord.allocated) || 0) + creditToApply) * 100) / 100;

          await leaveBalancesColHandle.updateOne(
            { _id: balanceRecord._id || undefined, id: balanceRecord.id },
            {
              $set: {
                accrued: newAccrued,
                allocated: newAllocated,
                balance: newBalance,
                lastAccrualDate: now,
                lastAccrualCycle: cycle,
                updatedAt: now,
              },
            }
          );

          const logId = generateId();
          await leaveAccrualLogsColHandle.insertOne({
            id: logId,
            leaveTypeId: lt.id,
            employeeId: emp.id,
            cycle,
            frequency,
            creditedAmount: creditToApply,
            previousBalance: currentBalance,
            newBalance,
            cappedAtMaximum: wasCapped,
            executedBy,
            createdAt: now,
          });

          totalCreditedDays += creditToApply;
          totalEmployeesCredited++;

          itemizedLogs.push({
            employeeId: emp.id,
            employeeName: emp.name,
            employeeCode: emp.employeeCode,
            leaveTypeId: lt.id,
            leaveTypeName: lt.name,
            leaveTypeCode: lt.code,
            creditApplied: creditToApply,
            previousBalance: currentBalance,
            newBalance,
            capped: Boolean(wasCapped),
            maxAccumulation,
          });
        }
      }
    }

    return {
      success: true,
      cycle,
      totalCreditedDays: Math.round(totalCreditedDays * 100) / 100,
      totalEmployeesCredited,
      totalCappedCount,
      leaveTypesProcessed: leaveTypes.length,
      itemizedLogs,
      message: `Accrual cycle ${cycle} executed: ${totalCreditedDays.toFixed(1)} days credited across ${totalEmployeesCredited} employee balances.`,
    };
  }

  /**
   * Year-End Carry Forward & Expiration Engine
   */
  static async runYearEndCarryForward(fromYear: number, toYear: number, executedBy = 'SYSTEM_CRON') {
    const leaveTypesColHandle = await leaveTypesCol();
    const employeesColHandle = await employeesCol();
    const leaveBalancesColHandle = await leaveBalancesCol();

    const now = new Date();
    const leaveTypes = await leaveTypesColHandle.find({ allowCarryForward: { $in: [true, 1] } }).toArray();
    const employees = await employeesColHandle.find({ status: 'ACTIVE' }).toArray();

    let totalRolledOverDays = 0;
    let totalEmployeesRolledOver = 0;

    for (const lt of leaveTypes) {
      const limit = Number(lt.carryForwardLimit) || 30.0;

      for (const emp of employees) {
        const prevBalance = await leaveBalancesColHandle.findOne({
          employeeId: emp.id,
          leaveTypeId: lt.id,
          year: fromYear,
        });

        if (!prevBalance) continue;

        const remaining = Math.max(0, Number(prevBalance.balance) || 0);
        if (remaining <= 0) continue;

        const carriedOver = Math.min(remaining, limit);

        const nextBalance = await leaveBalancesColHandle.findOne({
          employeeId: emp.id,
          leaveTypeId: lt.id,
          year: toYear,
        });

        const defaultQuota = Number(lt.defaultDaysPerYear ?? lt.daysPerYear) || 0;

        if (nextBalance) {
          const updatedBal = (Number(nextBalance.balance) || 0) + carriedOver;
          await leaveBalancesColHandle.updateOne(
            { id: nextBalance.id },
            {
              $set: {
                carriedForward: carriedOver,
                balance: updatedBal,
                updatedAt: now,
              },
            }
          );
        } else {
          await leaveBalancesColHandle.insertOne({
            id: generateId(),
            employeeId: emp.id,
            leaveTypeId: lt.id,
            year: toYear,
            allocated: defaultQuota + carriedOver,
            accrued: defaultQuota,
            used: 0,
            pending: 0,
            balance: defaultQuota + carriedOver,
            carriedForward: carriedOver,
            updatedAt: now,
          });
        }

        totalRolledOverDays += carriedOver;
        totalEmployeesRolledOver++;
      }
    }

    return {
      success: true,
      fromYear,
      toYear,
      totalRolledOverDays,
      totalEmployeesRolledOver,
      message: `Year-end rollover complete: ${totalRolledOverDays.toFixed(1)} days carried forward into ${toYear}.`,
    };
  }
}
