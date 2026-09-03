import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { leaveTypesCol, leaveBalancesCol, leaveRequestsCol, employeesCol, generateId } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

function canManagePolicy(session: any): boolean {
  if (!session) return false;
  if (session.role === 'SUPER_ADMIN' || session.role === 'HR_ADMIN' || session.role === 'MANAGER') return true;
  if (Array.isArray(session.permissions)) {
    return (
      session.permissions.includes('rules:write') ||
      session.permissions.includes('leaves:manage') ||
      session.permissions.includes('leaves:approve')
    );
  }
  return false;
}

export async function GET() {
  try {
    const ltCol = await leaveTypesCol();
    const types = await ltCol.find({}).sort({ code: 1 }).toArray();

    return NextResponse.json({
      success: true,
      data: types.map((t: any) => ({
        ...t,
        id: t.id || t._id?.toString(),
        category: t.category || 'Casual',
        defaultDaysPerYear: Number(t.defaultDaysPerYear ?? t.daysPerYear) || 12,
        daysPerYear: Number(t.defaultDaysPerYear ?? t.daysPerYear) || 12,
        accrualEnabled: Boolean(t.accrualEnabled),
        accrualFrequency: t.accrualFrequency || 'Monthly',
        accrualAmount: Number(t.accrualAmount) || 1.0,
        allowCarryForward: Boolean(t.allowCarryForward),
        carryForwardLimit: Number(t.carryForwardLimit) || 0,
        carryForwardExpiryDays: Number(t.carryForwardExpiryDays) || 365,
        maxAccumulation: Number(t.maxAccumulation) || 30,
        allowEncashment: Boolean(t.allowEncashment),
        encashmentMaxDays: Number(t.encashmentMaxDays) || 0,
        genderEligibility: t.genderEligibility || 'All',
        eligibleEmployeeTypes:
          typeof t.eligibleEmployeeTypes === 'string'
            ? (() => {
                try {
                  return JSON.parse(t.eligibleEmployeeTypes);
                } catch {
                  return ['Teaching', 'Non-Teaching', 'Admin', 'Support', 'Contractual', 'PartTime'];
                }
              })()
            : t.eligibleEmployeeTypes || ['Teaching', 'Non-Teaching', 'Admin', 'Support', 'Contractual', 'PartTime'],
        minServiceYears: Number(t.minServiceYears) || 0,
        maxServiceYears: Number(t.maxServiceYears) || 99,
        minAge: Number(t.minAge) || 18,
        maxAge: Number(t.maxAge) || 70,
        allowedDuringProbation: Boolean(t.allowedDuringProbation !== 0 && t.allowedDuringProbation !== false),
        allowedDuringNoticePeriod: Boolean(t.allowedDuringNoticePeriod),
        minDaysAllowed: Number(t.minDaysAllowed ?? t.minDaysPerRequest) || 1,
        maxDaysAllowed: Number(t.maxDaysAllowed ?? t.maxConsecutiveDays) || 30,
        minConsecutiveDays: Number(t.minConsecutiveDays ?? t.minDaysPerRequest) || 1,
        maxConsecutiveDays: Number(t.maxConsecutiveDays) || 5,
        maxTimesPerYear: Number(t.maxTimesPerYear) || 12,
        maxTimesPerMonth: Number(t.maxTimesPerMonth) || 3,
        minGapDays: Number(t.minGapDays) || 0,
        priorNoticeDays: Number(t.priorNoticeDays ?? t.priorApprovalRequiredDays) || 0,
        priorApprovalRequiredDays: Number(t.priorApprovalRequiredDays ?? t.priorNoticeDays) || 0,
        requireProofDocument: Boolean(t.requireProofDocument || t.requiresMedicalCertificate),
        requiresMedicalCertificate: Boolean(t.requiresMedicalCertificate || t.requireProofDocument),
        proofDocumentLabel: t.proofDocumentLabel || 'Supporting Certificate / Doctor Prescription',
        proofThresholdDays: Number(t.proofThresholdDays ?? t.medicalCertificateAfterDays) || 1,
        medicalCertificateAfterDays: Number(t.medicalCertificateAfterDays ?? t.proofThresholdDays) || 1,
        isPaid: Boolean(t.isPaid),
        affectsPayroll: Boolean(t.affectsPayroll !== 0 && t.affectsPayroll !== false),
        applySandwichRule: Boolean(t.applySandwichRule),
        allowNegativeBalance: Boolean(t.allowNegativeBalance),
        negativeBalanceLimit: Number(t.negativeBalanceLimit) || -5.0,
      })),
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
    if (!canManagePolicy(session)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Privileges required to manage policies' } },
        { status: 403 }
      );
    }

    const b = await req.json();
    const name = b.name?.trim();
    const code = b.code?.trim().toUpperCase();

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Category Name and Code are required' } },
        { status: 400 }
      );
    }

    const ltCol = await leaveTypesCol();
    const existing = await ltCol.findOne({ code });
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'DUPLICATE_CODE', message: `A leave policy with code '${code}' already exists` },
        },
        { status: 400 }
      );
    }

    const id = generateId();
    const now = new Date();

    const doc = {
      id,
      name,
      code,
      description: b.description || '',
      category: b.category || 'Casual',
      defaultDaysPerYear: Number(b.defaultDaysPerYear ?? b.daysPerYear) || 12,
      daysPerYear: Number(b.defaultDaysPerYear ?? b.daysPerYear) || 12,
      accrualEnabled: Boolean(b.accrualEnabled),
      accrualFrequency: b.accrualFrequency || 'Monthly',
      accrualAmount: Number(b.accrualAmount) || 1.0,
      allowCarryForward: Boolean(b.allowCarryForward),
      carryForwardLimit: Number(b.carryForwardLimit) || 0,
      carryForwardExpiryDays: Number(b.carryForwardExpiryDays) || 365,
      maxAccumulation: Number(b.maxAccumulation) || 30,
      allowEncashment: Boolean(b.allowEncashment),
      encashmentMaxDays: Number(b.encashmentMaxDays) || 0,
      genderEligibility: b.genderEligibility || 'All',
      eligibleEmployeeTypes:
        typeof b.eligibleEmployeeTypes === 'object'
          ? b.eligibleEmployeeTypes
          : b.eligibleEmployeeTypes || ['Teaching', 'Non-Teaching', 'Admin', 'Support'],
      minServiceYears: Number(b.minServiceYears) || 0,
      maxServiceYears: Number(b.maxServiceYears) || 99,
      minAge: Number(b.minAge) || 18,
      maxAge: Number(b.maxAge) || 70,
      allowedDuringProbation: b.allowedDuringProbation !== false,
      allowedDuringNoticePeriod: Boolean(b.allowedDuringNoticePeriod),
      minDaysAllowed: Number(b.minDaysAllowed ?? b.minDaysPerRequest) || 1,
      maxDaysAllowed: Number(b.maxDaysAllowed ?? b.maxConsecutiveDays) || 30,
      minConsecutiveDays: Number(b.minConsecutiveDays ?? b.minDaysPerRequest) || 1,
      maxConsecutiveDays: Number(b.maxConsecutiveDays) || 5,
      maxTimesPerYear: Number(b.maxTimesPerYear) || 12,
      maxTimesPerMonth: Number(b.maxTimesPerMonth) || 3,
      minGapDays: Number(b.minGapDays) || 0,
      priorNoticeDays: Number(b.priorNoticeDays ?? b.priorApprovalRequiredDays) || 0,
      priorApprovalRequiredDays: Number(b.priorApprovalRequiredDays ?? b.priorNoticeDays) || 0,
      requireProofDocument: Boolean(b.requireProofDocument || b.requiresMedicalCertificate),
      requiresMedicalCertificate: Boolean(b.requiresMedicalCertificate || b.requireProofDocument),
      proofDocumentLabel: b.proofDocumentLabel || 'Supporting Certificate / Doctor Prescription',
      proofThresholdDays: Number(b.proofThresholdDays ?? b.medicalCertificateAfterDays) || 1,
      medicalCertificateAfterDays: Number(b.medicalCertificateAfterDays ?? b.proofThresholdDays) || 1,
      isPaid: b.isPaid !== false,
      affectsPayroll: b.affectsPayroll !== false,
      applySandwichRule: Boolean(b.applySandwichRule),
      allowNegativeBalance: Boolean(b.allowNegativeBalance),
      negativeBalanceLimit: Number(b.negativeBalanceLimit) || -5.0,
      createdAt: now,
      updatedAt: now,
    };

    await ltCol.insertOne(doc);

    // Auto-initialize balance records for all active employees for this newly created policy
    let initializedCount = 0;
    try {
      const empCol = await employeesCol();
      const lbCol = await leaveBalancesCol();
      const activeEmployees = await empCol.find({ status: { $ne: 'TERMINATED' } }).toArray();
      const currentYear = new Date().getFullYear();

      const initialAllocated = doc.defaultDaysPerYear;
      const initialBalance = doc.accrualEnabled ? 0 : doc.defaultDaysPerYear;

      const initialBalances = activeEmployees.map((emp: any) => ({
        id: generateId(),
        employeeId: emp.id,
        leaveTypeId: id,
        year: currentYear,
        allocated: initialAllocated,
        accrued: doc.accrualEnabled ? 0 : initialAllocated,
        used: 0,
        pending: 0,
        balance: initialBalance,
        updatedAt: now,
      }));

      if (initialBalances.length > 0) {
        await lbCol.insertMany(initialBalances, { ordered: false }).catch(() => {});
        initializedCount = initialBalances.length;
      }
    } catch {
      // Non-blocking balance initialization
    }

    return NextResponse.json({
      success: true,
      data: { id, name, code, initializedCount },
      message: `Policy '${name}' created and configured successfully across all 6 modules. Initialized for ${initializedCount} active employee(s).`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'CREATE_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!canManagePolicy(session)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Privileges required to update policies' } },
        { status: 403 }
      );
    }

    const b = await req.json();
    if (!b.id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Policy ID is required for update' } },
        { status: 400 }
      );
    }

    const ltCol = await leaveTypesCol();
    const existing = await ltCol.findOne({ $or: [{ id: b.id }, { _id: b.id }] });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Leave policy not found' } },
        { status: 404 }
      );
    }

    const defaultDays = Number(b.defaultDaysPerYear ?? b.daysPerYear ?? existing.daysPerYear);

    const updateDoc: Record<string, any> = {
      name: b.name || existing.name,
      description: b.description ?? existing.description,
      category: b.category || existing.category || 'Casual',
      defaultDaysPerYear: defaultDays,
      daysPerYear: defaultDays,
      accrualEnabled: b.accrualEnabled !== undefined ? Boolean(b.accrualEnabled) : Boolean(existing.accrualEnabled),
      accrualFrequency: b.accrualFrequency || existing.accrualFrequency || 'Monthly',
      accrualAmount: Number(b.accrualAmount ?? existing.accrualAmount ?? 1.0),
      allowCarryForward: b.allowCarryForward !== undefined ? Boolean(b.allowCarryForward) : Boolean(existing.allowCarryForward),
      carryForwardLimit: Number(b.carryForwardLimit ?? existing.carryForwardLimit ?? 0),
      carryForwardExpiryDays: Number(b.carryForwardExpiryDays ?? existing.carryForwardExpiryDays ?? 365),
      maxAccumulation: Number(b.maxAccumulation ?? existing.maxAccumulation ?? 30),
      allowEncashment: b.allowEncashment !== undefined ? Boolean(b.allowEncashment) : Boolean(existing.allowEncashment),
      encashmentMaxDays: Number(b.encashmentMaxDays ?? existing.encashmentMaxDays ?? 0),
      genderEligibility: b.genderEligibility || existing.genderEligibility || 'All',
      eligibleEmployeeTypes: b.eligibleEmployeeTypes ?? existing.eligibleEmployeeTypes,
      minServiceYears: Number(b.minServiceYears ?? existing.minServiceYears ?? 0),
      maxServiceYears: Number(b.maxServiceYears ?? existing.maxServiceYears ?? 99),
      minAge: Number(b.minAge ?? existing.minAge ?? 18),
      maxAge: Number(b.maxAge ?? existing.maxAge ?? 70),
      allowedDuringProbation: b.allowedDuringProbation !== undefined ? Boolean(b.allowedDuringProbation) : Boolean(existing.allowedDuringProbation),
      allowedDuringNoticePeriod: b.allowedDuringNoticePeriod !== undefined ? Boolean(b.allowedDuringNoticePeriod) : Boolean(existing.allowedDuringNoticePeriod),
      minDaysAllowed: Number(b.minDaysAllowed ?? b.minDaysPerRequest ?? existing.minDaysAllowed ?? 1),
      maxDaysAllowed: Number(b.maxDaysAllowed ?? b.maxConsecutiveDays ?? existing.maxDaysAllowed ?? 30),
      minConsecutiveDays: Number(b.minConsecutiveDays ?? b.minDaysPerRequest ?? existing.minConsecutiveDays ?? 1),
      maxConsecutiveDays: Number(b.maxConsecutiveDays ?? existing.maxConsecutiveDays ?? 5),
      maxTimesPerYear: Number(b.maxTimesPerYear ?? existing.maxTimesPerYear ?? 12),
      maxTimesPerMonth: Number(b.maxTimesPerMonth ?? existing.maxTimesPerMonth ?? 3),
      minGapDays: Number(b.minGapDays ?? existing.minGapDays ?? 0),
      priorNoticeDays: Number(b.priorNoticeDays ?? b.priorApprovalRequiredDays ?? existing.priorNoticeDays ?? 0),
      priorApprovalRequiredDays: Number(b.priorApprovalRequiredDays ?? b.priorNoticeDays ?? existing.priorApprovalRequiredDays ?? 0),
      requireProofDocument: b.requireProofDocument !== undefined ? Boolean(b.requireProofDocument) : Boolean(existing.requireProofDocument),
      requiresMedicalCertificate: b.requiresMedicalCertificate !== undefined ? Boolean(b.requiresMedicalCertificate) : Boolean(existing.requiresMedicalCertificate),
      proofDocumentLabel: b.proofDocumentLabel || existing.proofDocumentLabel || 'Supporting Certificate / Doctor Prescription',
      proofThresholdDays: Number(b.proofThresholdDays ?? b.medicalCertificateAfterDays ?? existing.proofThresholdDays ?? 1),
      medicalCertificateAfterDays: Number(b.medicalCertificateAfterDays ?? b.proofThresholdDays ?? existing.medicalCertificateAfterDays ?? 1),
      isPaid: b.isPaid !== undefined ? Boolean(b.isPaid) : Boolean(existing.isPaid),
      affectsPayroll: b.affectsPayroll !== undefined ? Boolean(b.affectsPayroll) : Boolean(existing.affectsPayroll),
      applySandwichRule: b.applySandwichRule !== undefined ? Boolean(b.applySandwichRule) : Boolean(existing.applySandwichRule),
      allowNegativeBalance: b.allowNegativeBalance !== undefined ? Boolean(b.allowNegativeBalance) : Boolean(existing.allowNegativeBalance),
      negativeBalanceLimit: Number(b.negativeBalanceLimit ?? existing.negativeBalanceLimit ?? -5.0),
      updatedAt: new Date(),
    };

    await ltCol.updateOne({ $or: [{ id: b.id }, { _id: b.id }] }, { $set: updateDoc });

    return NextResponse.json({
      success: true,
      message: `Policy '${updateDoc.name}' updated successfully across all operational parameters.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!canManagePolicy(session)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Privileges required' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Policy ID is required' } },
        { status: 400 }
      );
    }

    const ltCol = await leaveTypesCol();
    const lbCol = await leaveBalancesCol();
    const lrCol = await leaveRequestsCol();

    const existing = await ltCol.findOne({ $or: [{ id }, { _id: id }, { code: id }] });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Leave policy not found' } },
        { status: 404 }
      );
    }

    const deleteIds = Array.from(new Set([id, existing.id, existing.code, existing._id?.toString()].filter(Boolean)));
    const delBalResult = await lbCol.deleteMany({ leaveTypeId: { $in: deleteIds } });
    const delReqResult = await lrCol.deleteMany({ leaveTypeId: { $in: deleteIds } });
    await ltCol.deleteOne({ $or: [{ id: existing.id }, { code: existing.code }] });

    return NextResponse.json({
      success: true,
      message: `Policy '${existing.name}' (${existing.code}) deleted successfully along with ${delBalResult.deletedCount} balance record(s) and ${delReqResult.deletedCount} request(s).`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
