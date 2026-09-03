import {
  leaveRequestsCol,
  leaveBalancesCol,
  attendanceEventsCol,
  attendanceRegularizationsCol,
  employeesCol,
} from './mongodb';
import { parseAppDate } from './timezone';

/**
 * Evaluates attendance on a given date for all approved leave requests.
 * Per workforce policy:
 * - If the employee punched in / attended work on the leave date: leave is NOT deducted.
 * - If the employee has NO attendance punches / regularizations: 1 day is deducted from their leave balance and recorded.
 */
export async function syncLeaveAttendanceForDate(dateStr: string) {
  try {
    const startOfDate = new Date(`${dateStr}T00:00:00+05:30`);
    const endOfDate = new Date(`${dateStr}T23:59:59.999+05:30`);

    const lrCol = await leaveRequestsCol();
    const lbCol = await leaveBalancesCol();
    const attCol = await attendanceEventsCol();
    const regCol = await attendanceRegularizationsCol();
    const empCol = await employeesCol();

    // 1. Fetch all approved leaves active on this date
    const approvedLeaves = await lrCol
      .find({
        status: 'APPROVED',
        startDate: { $lte: endOfDate },
        endDate: { $gte: startOfDate },
      })
      .toArray();

    if (approvedLeaves.length === 0) {
      return { date: dateStr, processed: 0, deductedCount: 0, presentAtWorkCount: 0 };
    }

    // 2. Fetch raw attendance events on this date
    const allEvents = await attCol.find({}).toArray();
    const dayEvents = allEvents.filter((ev) => {
      const d = parseAppDate(ev.timestamp);
      return d >= startOfDate && d <= endOfDate;
    });

    const employees = await empCol.find({}).toArray();
    const empById = new Map(employees.map((e) => [String(e.id || e._id), e]));
    const empByDevId = new Map(employees.map((e) => [String(e.deviceUserId), e]));

    const presentEmpIds = new Set<string>();

    for (const ev of dayEvents) {
      const emp = (ev.employeeId && empById.get(String(ev.employeeId))) || (ev.deviceUserId && empByDevId.get(String(ev.deviceUserId)));
      if (emp) {
        presentEmpIds.add(String(emp.id || emp._id));
      }
    }

    // Also include approved attendance regularizations for this date
    const regularizations = await regCol.find({ date: dateStr, status: 'APPROVED' }).toArray();
    for (const reg of regularizations) {
      if (reg.employeeId) {
        presentEmpIds.add(String(reg.employeeId));
      }
    }

    let deductedCount = 0;
    let presentAtWorkCount = 0;
    const now = new Date();

    for (const req of approvedLeaves) {
      const empId = String(req.employeeId);
      const isPresentAtWork = presentEmpIds.has(empId);
      const alreadyDeductedForDate = Array.isArray(req.deductedDates) && req.deductedDates.includes(dateStr);

      if (isPresentAtWork) {
        presentAtWorkCount++;
        // Employee worked despite approved leave! If this date was previously deducted, reverse it.
        if (alreadyDeductedForDate) {
          await lbCol.updateOne(
            { employeeId: req.employeeId, leaveTypeId: req.leaveTypeId },
            {
              $inc: { balance: 1, used: -1 },
              $set: { updatedAt: now },
            }
          );
          await lrCol.updateOne(
            { id: req.id },
            {
              $pull: { deductedDates: dateStr } as any,
              $set: { updatedAt: now },
            }
          );
        }
      } else {
        // Employee has NO attendance and has an approved leave request on this date -> Deduct leave
        if (!alreadyDeductedForDate) {
          await lbCol.updateOne(
            { employeeId: req.employeeId, leaveTypeId: req.leaveTypeId },
            {
              $inc: { balance: -1, used: 1 },
              $set: { updatedAt: now },
            }
          );
          await lrCol.updateOne(
            { id: req.id },
            {
              $addToSet: { deductedDates: dateStr },
              $set: { deducted: true, updatedAt: now },
            }
          );
          deductedCount++;
        }
      }
    }

    return {
      date: dateStr,
      processed: approvedLeaves.length,
      deductedCount,
      presentAtWorkCount,
    };
  } catch (err) {
    console.error(`[LeaveAttendanceSync] Error syncing for date ${dateStr}:`, err);
    return { date: dateStr, error: (err as any).message };
  }
}
