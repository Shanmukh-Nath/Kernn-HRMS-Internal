import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import {
  payrollRecordsCol,
  employeesCol,
  auditLogsCol,
  getMongoDb,
  generateId,
} from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Direct payslip generation is restricted to Super Administrators' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      employeeId,
      employeeName,
      employeeCode,
      department,
      designation,
      month,
      year,
      structureName,
      basicSalary,
      hra,
      allowances,
      grossSalary,
      pfDeduction,
      esiDeduction,
      ptDeduction,
      lopDeduction,
      customDeductions,
      totalDeductions,
      netSalary,
      auditNotes,
    } = body;

    const m = Number(month) || new Date().getMonth() + 1;
    const y = Number(year) || new Date().getFullYear();

    const empId = employeeId || session.employeeId || session.userId;
    const empName = employeeName || session.name || 'Super Administrator';
    const empCode = employeeCode || 'KRN-ADM-001';
    const empDept = department || 'Executive Directorate';
    const empDesig = designation || 'Super Administrator';

    const calcBasic = Number(basicSalary) || 0;
    const calcHra = Number(hra) || 0;
    const calcAllowances = Number(allowances) || 0;
    const calcGross = Number(grossSalary) || (calcBasic + calcHra + calcAllowances);

    const calcPf = Number(pfDeduction) || 0;
    const calcEsi = Number(esiDeduction) || 0;
    const calcPt = Number(ptDeduction) || 0;
    const calcLop = Number(lopDeduction) || 0;
    const calcCustom = Number(customDeductions) || 0;
    const calcTotalDed = Number(totalDeductions) || (calcPf + calcEsi + calcPt + calcLop + calcCustom);

    const calcNet = Number(netSalary) || Math.max(0, calcGross - calcTotalDed);

    const prCol = await payrollRecordsCol();
    const db = await getMongoDb();
    const pdrCol = db.collection('payslip_download_requests');
    const auditCol = await auditLogsCol();
    const now = new Date();

    const recordId = `PR_${empId}_${y}_${m}`;

    const lineItemsJson = JSON.stringify([
      { name: 'Basic Salary', type: 'EARNING', amount: calcBasic, isTaxable: true },
      { name: 'House Rent Allowance (HRA)', type: 'EARNING', amount: calcHra, isTaxable: false },
      { name: 'Special Executive Allowance', type: 'EARNING', amount: calcAllowances, isTaxable: true },
      { name: 'Provident Fund (PF)', type: 'DEDUCTION', amount: calcPf },
      { name: 'ESIC Medical Fund', type: 'DEDUCTION', amount: calcEsi },
      { name: 'Professional Tax (PT)', type: 'DEDUCTION', amount: calcPt },
      { name: 'Loss of Pay (LOP)', type: 'DEDUCTION', amount: calcLop },
      ...(calcCustom > 0 ? [{ name: 'Custom Adjustments', type: 'DEDUCTION', amount: calcCustom }] : []),
    ]);

    // 1. Upsert payroll record as APPROVED_LOCKED
    await prCol.updateOne(
      { employeeId: empId, month: m, year: y },
      {
        $set: {
          id: recordId,
          employeeId: empId,
          employeeName: empName,
          employeeCode: empCode,
          employeeDept: empDept,
          employeeDesig: empDesig,
          month: m,
          year: y,
          basicSalary: calcBasic,
          hra: calcHra,
          allowances: calcAllowances,
          grossSalary: calcGross,
          pfDeduction: calcPf,
          esiDeduction: calcEsi,
          ptDeduction: calcPt,
          lopDeduction: calcLop,
          customDeductions: calcCustom,
          totalDeductions: calcTotalDed,
          netSalary: calcNet,
          structureName: structureName || 'Executive Direct FTE',
          lineItemsJson,
          status: 'APPROVED_LOCKED',
          isDraft: false,
          approvedBy: session.name,
          approvedAt: now,
          auditNotes: auditNotes || 'Directly generated and certified by Super Administrator (No approval required)',
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );

    // 2. Automatically create APPROVED download clearance
    const pdrId = generateId();
    await pdrCol.updateOne(
      { employeeId: empId, month: m, year: y },
      {
        $set: {
          id: pdrId,
          employeeId: empId,
          month: m,
          year: y,
          status: 'APPROVED',
          reviewedBy: session.name,
          reviewedByName: session.name,
          reviewedByRole: 'SUPER_ADMIN',
          reviewedAt: now,
          decisionRemarks: 'Direct Super Admin clearance — immediate download permitted',
          updatedAt: now,
        },
        $setOnInsert: {
          requestedAt: now,
          createdAt: now,
        },
      },
      { upsert: true }
    );

    // 3. Security Audit Log
    const auditId = generateId();
    await auditCol.insertOne({
      id: auditId,
      employeeId: session.userId,
      actionType: 'SUPER_ADMIN_DIRECT_PAYSLIP_GENERATION',
      moduleKey: 'hrm_payroll',
      entityType: 'PayrollRecord',
      entityId: recordId,
      description: `Super Admin ${session.name} directly applied and generated official payslip for ${empName} (${empCode}) for ${m}/${y} with net payout ₹${calcNet.toLocaleString('en-IN')}`,
      ipAddress: '127.0.0.1',
      retentionUntil: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
      createdAt: now,
    });

    const generatedRecord = {
      id: recordId,
      employeeId: empId,
      employeeName: empName,
      employeeCode: empCode,
      employeeDept: empDept,
      employeeDesig: empDesig,
      month: m,
      year: y,
      structureName: structureName || 'Executive Direct FTE',
      basicSalary: calcBasic,
      hra: calcHra,
      allowances: calcAllowances,
      grossSalary: calcGross,
      pfDeduction: calcPf,
      esiDeduction: calcEsi,
      ptDeduction: calcPt,
      lopDeduction: calcLop,
      customDeductions: calcCustom,
      totalDeductions: calcTotalDed,
      netSalary: calcNet,
      status: 'APPROVED_LOCKED',
      isDraft: false,
      auditNotes: auditNotes || 'Directly generated and certified by Super Administrator (No approval required)',
    };

    return NextResponse.json({
      success: true,
      message: 'Payslip directly generated and approved! Ready for instant download.',
      data: generatedRecord,
    });
  } catch (err: any) {
    console.error('[Direct Payslip Generate Error]:', err);
    return NextResponse.json(
      { success: false, error: { code: 'GENERATION_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
