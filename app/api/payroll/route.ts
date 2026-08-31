import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { SalaryFormulaEngine } from '@/lib/salary-formula-engine';
import {
  payrollRecordsCol,
  employeesCol,
  salaryStructuresCol,
  salaryComponentsCol,
  attendanceEventsCol,
  leaveRequestsCol,
  leaveTypesCol,
  auditLogsCol,
  generateId,
} from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);

    const prCol = await payrollRecordsCol();
    const empCol = await employeesCol();
    const structCol = await salaryStructuresCol();

    const rawRecords = await prCol.find({ month, year }).toArray();
    const employees = await empCol.find({}).toArray();
    const structures = await structCol.find({}).toArray();

    const empMap = new Map(employees.map((e) => [e.id, e]));
    const structMap = new Map(structures.map((s) => [s.id, s]));

    let records = rawRecords
      .map((p) => {
        const emp = empMap.get(p.employeeId);
        const struct = emp?.salaryStructureId ? structMap.get(emp.salaryStructureId) : null;
        let lineItems = [];
        try {
          if (p.lineItemsJson) {
            lineItems = typeof p.lineItemsJson === 'string' ? JSON.parse(p.lineItemsJson) : p.lineItemsJson;
          }
        } catch {}

        return {
          ...p,
          id: p.id || p._id?.toString(),
          employeeName: emp?.name || '',
          employeeCode: emp?.employeeCode || '',
          employeeDept: emp?.department || '',
          employeeDesig: emp?.designation || '',
          structureName: struct?.name || null,
          lineItems,
          status: p.status || 'ReadyForReview',
        };
      })
      .sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));

    // If employee only has payroll:read_self, filter to only their own record
    if (session && !hasPermission(session, 'payroll:read_all')) {
      if (session.employeeId) {
        records = records.filter((r) => r.employeeId === session.employeeId);
      }
      records = records.map((r) => {
        if (r.status !== 'APPROVED_LOCKED') {
          return {
            id: r.id,
            employeeId: r.employeeId,
            employeeName: r.employeeName,
            employeeCode: r.employeeCode,
            employeeDept: r.employeeDept,
            structureName: r.structureName,
            month: r.month,
            year: r.year,
            status: 'DRAFT_REVIEW',
            isDraft: true,
            payslipAvailable: false,
            grossSalary: 0,
            netSalary: 0,
            lopDeduction: 0,
            pfDeduction: 0,
            esiDeduction: 0,
            ptDeduction: 0,
            lineItems: [],
          };
        }
        return { ...r, payslipAvailable: true, isDraft: false };
      });
    }

    const isLocked = records.length > 0 && records.every((r) => r.status === 'APPROVED_LOCKED');

    return NextResponse.json({
      success: true,
      data: records,
      meta: {
        totalRecords: records.length,
        isLocked,
        status: isLocked ? 'APPROVED_LOCKED' : 'ReadyForReview',
        approvedBy: records[0]?.approvedBy || null,
        approvedAt: records[0]?.approvedAt || null,
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
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'HR_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'HR Admin or Manager privileges required to run batch payroll' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const month = parseInt(body.month || String(new Date().getMonth() + 1), 10);
    const year = parseInt(body.year || String(new Date().getFullYear()), 10);

    const prCol = await payrollRecordsCol();
    const empCol = await employeesCol();
    const structCol = await salaryStructuresCol();
    const compCol = await salaryComponentsCol();
    const attCol = await attendanceEventsCol();
    const lrCol = await leaveRequestsCol();
    const ltCol = await leaveTypesCol();
    const auditCol = await auditLogsCol();

    const daysInMonth = new Date(year, month, 0).getDate();
    const employees = await empCol.find({ $or: [{ status: 'ACTIVE' }, { status: { $exists: false } }, { status: null }] }).toArray();
    const structures = await structCol.find({}).toArray();
    const structMap = new Map(structures.map((s) => [s.id, s]));

    const leaveTypes = await ltCol.find({}).toArray();
    const ltMap = new Map(leaveTypes.map((t) => [t.id, t]));

    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999));

    let processedCount = 0;
    const now = new Date();

    for (const emp of employees) {
      // 1. Resolve punches in month
      const punches = await attCol
        .find({
          employeeId: emp.id,
          timestamp: { $gte: startOfMonth, $lte: endOfMonth },
        })
        .toArray();

      const uniquePunchDates = new Set(
        punches.map((p) =>
          p.timestamp instanceof Date ? p.timestamp.toISOString().split('T')[0] : String(p.timestamp).split('T')[0]
        )
      );

      // 2. Approved Paid Leaves
      const approvedLeaves = await lrCol
        .find({
          employeeId: emp.id,
          status: 'APPROVED',
          startDate: { $gte: startOfMonth, $lte: endOfMonth },
        })
        .toArray();

      const approvedPaidDays = approvedLeaves.reduce((sum, l) => {
        const lt = ltMap.get(l.leaveTypeId);
        return lt?.isPaid !== false ? sum + (Number(l.totalDays) || 0) : sum;
      }, 0);

      const unapprovedPending = await lrCol.countDocuments({
        employeeId: emp.id,
        status: 'PENDING',
        startDate: { $gte: startOfMonth, $lte: endOfMonth },
      });

      const punchDays = uniquePunchDates.size > 0 ? uniquePunchDates.size : Math.max(1, daysInMonth - 4);
      const presentAndCoveredDays = Math.min(daysInMonth, punchDays + approvedPaidDays);
      const unpaidLopDays = Math.max(0, daysInMonth - presentAndCoveredDays);
      const payableDays = Math.max(0, daysInMonth - unpaidLopDays);

      let lopAuditNote = '';
      if (unapprovedPending > 0) {
        lopAuditNote = `${unapprovedPending} time-off request(s) pending supervisor approval - treated as LOP until confirmed.`;
      }

      // 3. Components
      let components: any[] = [];
      if (emp.salaryStructureId) {
        components = await compCol.find({ structureId: emp.salaryStructureId }).sort({ displayOrder: 1 }).toArray();
      }

      const struct = emp.salaryStructureId ? structMap.get(emp.salaryStructureId) : null;
      const baseSalary = Number(emp.baseSalary || struct?.baseSalaryAmount) || 35000;
      const ctc = Number(emp.ctc || struct?.ctcMaximum) || baseSalary * 12;

      const simResult = SalaryFormulaEngine.simulateStructure(
        emp,
        { baseSalary, ctc, lopDays: unpaidLopDays, workingDays: daysInMonth },
        components,
        { experienceYears: 2 }
      );

      const lopDailyRate = baseSalary / daysInMonth;
      const lopDeduction = Math.round(lopDailyRate * unpaidLopDays * 100) / 100;
      const grossSalary = simResult.grossSalary;
      const statutory = simResult.statutoryDeductions;
      const totalStatutory = statutory.pfEmployee + statutory.esicEmployee + statutory.professionalTax;
      const totalDeductions = Math.round((totalStatutory + lopDeduction) * 100) / 100;
      const rawNet = Math.round((grossSalary - totalDeductions) * 100) / 100;
      const netSalary = Math.max(0, rawNet);

      // Check existing record
      const existing = await prCol.findOne({ employeeId: emp.id, month, year });
      if (existing && existing.status === 'APPROVED_LOCKED' && session.role !== 'SUPER_ADMIN') {
        continue;
      }

      const recordId = existing?.id || generateId();
      const lineItemsJson = JSON.stringify(simResult.earnings);

      await prCol.updateOne(
        { employeeId: emp.id, month, year },
        {
          $set: {
            id: recordId,
            employeeId: emp.id,
            month,
            year,
            basicSalary: simResult.earnings[0]?.amount || Math.round(baseSalary * 0.5),
            hra: simResult.earnings[1]?.amount || 0,
            allowances: grossSalary - (simResult.earnings[0]?.amount || 0),
            grossSalary,
            totalDays: daysInMonth,
            payableDays,
            unpaidLopDays,
            lopDeduction,
            pfDeduction: statutory.pfEmployee,
            esiDeduction: statutory.esicEmployee,
            ptDeduction: statutory.professionalTax,
            taxDeduction: statutory.tds,
            totalDeductions,
            netSalary,
            lineItemsJson,
            status: 'ReadyForReview',
            auditNotes: lopAuditNote || existing?.auditNotes || null,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true }
      );

      processedCount++;
    }

    // 4. Audit Log
    const auditId = generateId();
    const retention = new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000);
    await auditCol.insertOne({
      id: auditId,
      employeeId: session.userId,
      actionType: 'Process',
      moduleKey: 'hrm_payroll',
      entityType: 'PayrollBatch',
      entityId: `${year}-${month}`,
      description: `Batch payroll generated for ${processedCount} employees for period ${String(month).padStart(2, '0')}/${year} by ${session.name}`,
      ipAddress: '127.0.0.1',
      retentionUntil: retention,
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      message: `Batch payroll processed for ${processedCount} employees. Records are queued in 'ReadyForReview' status.`,
      data: { processedCount, month, year },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'BATCH_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'HR_ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Manager or Admin permissions required' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, grossSalary, lopDeduction, pfDeduction, esiDeduction, ptDeduction, customDeductions, netSalary, auditNotes } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Payroll record ID required' }, { status: 400 });
    }

    const prCol = await payrollRecordsCol();
    const auditCol = await auditLogsCol();

    const beforeState = await prCol.findOne({ $or: [{ id }, { _id: id }] });
    if (!beforeState) {
      return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
    }

    if (beforeState.status === 'APPROVED_LOCKED' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'LOCKED', message: 'This payroll record is approved and locked. Unlocking is restricted to Super Admin.' } },
        { status: 400 }
      );
    }

    const now = new Date();
    const updateData = {
      grossSalary: Number(grossSalary),
      lopDeduction: Number(lopDeduction),
      pfDeduction: Number(pfDeduction),
      esiDeduction: Number(esiDeduction),
      ptDeduction: Number(ptDeduction),
      customDeductions: Number(customDeductions || 0),
      netSalary: Number(netSalary),
      auditNotes: auditNotes || `Adjusted by ${session.name}`,
      updatedAt: now,
    };

    await prCol.updateOne({ $or: [{ id }, { _id: id }] }, { $set: updateData });
    const afterState = await prCol.findOne({ $or: [{ id }, { _id: id }] });

    const auditId = generateId();
    const retentionUntil = new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000);
    const diff = {
      grossSalary: { before: beforeState.grossSalary, after: afterState?.grossSalary },
      netSalary: { before: beforeState.netSalary, after: afterState?.netSalary },
      lopDeduction: { before: beforeState.lopDeduction, after: afterState?.lopDeduction },
      pfDeduction: { before: beforeState.pfDeduction, after: afterState?.pfDeduction },
      customDeductions: { before: beforeState.customDeductions, after: afterState?.customDeductions },
    };

    await auditCol.insertOne({
      id: auditId,
      employeeId: session.userId,
      actionType: 'Override',
      moduleKey: 'hrm_payroll',
      entityType: 'PayrollRecord',
      entityId: id,
      beforeState: JSON.stringify(beforeState),
      afterState: JSON.stringify(afterState),
      changes: JSON.stringify(diff),
      description: `Manual payroll adjustment for record ${id} by ${session.name}: ${auditNotes || 'Line-item adjustments applied'}`,
      ipAddress: '127.0.0.1',
      retentionUntil,
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      message: 'Payroll record adjusted successfully with immutable statutory compliance audit trail logged.',
      data: afterState,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
