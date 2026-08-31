import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { SalaryFormulaEngine } from '@/lib/salary-formula-engine';
import { salaryStructuresCol, salaryComponentsCol } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await req.json();
    let { structureId, baseSalary, ctc, components, structureConfig, employee } = body;

    const structCol = await salaryStructuresCol();
    const compCol = await salaryComponentsCol();

    if (structureId && (!structureConfig || !components)) {
      const dbStructure = await structCol.findOne({ $or: [{ id: structureId }, { _id: structureId }] });
      if (!dbStructure) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Salary structure not found' } },
          { status: 404 }
        );
      }
      structureConfig = dbStructure;
      components = await compCol.find({ structureId }).sort({ displayOrder: 1 }).toArray();
      if (!baseSalary && dbStructure.baseSalaryAmount > 0) {
        baseSalary = dbStructure.baseSalaryAmount;
      }
      if (!ctc && dbStructure.ctcMaximum > 0) {
        ctc = dbStructure.ctcMaximum;
      }
    }

    baseSalary = Number(baseSalary) || 30000;
    ctc = Number(ctc) || baseSalary * 12;
    components = components || [];
    structureConfig = structureConfig || {
      pfEnabled: 1,
      pfEmployeeRate: 12,
      pfEmployerRate: 12,
      pfWageCeiling: 15000,
      esicEnabled: 1,
      esicEmployeeRate: 0.75,
      esicEmployerRate: 3.25,
      esicWageCeiling: 21000,
      ptEnabled: 1,
    };

    const simulation = SalaryFormulaEngine.simulateStructure(
      structureConfig,
      { baseSalary, ctc },
      components,
      employee || {}
    );

    return NextResponse.json({
      success: true,
      data: simulation,
    });
  } catch (err: any) {
    console.error('Preview error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'SIMULATION_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}
