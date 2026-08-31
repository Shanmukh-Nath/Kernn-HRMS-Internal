import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { salaryStructuresCol, salaryComponentsCol, employeesCol, generateId } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const structCol = await salaryStructuresCol();
    const compCol = await salaryComponentsCol();
    const empCol = await employeesCol();

    const structures = await structCol.find({}).sort({ isDefault: -1, name: 1 }).toArray();
    const allComponents = await compCol.find({}).sort({ displayOrder: 1, name: 1 }).toArray();
    const allEmployees = await empCol.find({}).toArray();

    const compByStruct = new Map<string, any[]>();
    for (const c of allComponents) {
      const list = compByStruct.get(c.structureId) || [];
      list.push({
        ...c,
        id: c.id || c._id?.toString(),
        isTaxable: Boolean(c.isTaxable),
        isMandatory: Boolean(c.isMandatory),
        isStatutory: Boolean(c.isStatutory),
      });
      compByStruct.set(c.structureId, list);
    }

    const empCountByStruct = new Map<string, number>();
    for (const e of allEmployees) {
      if (e.salaryStructureId) {
        empCountByStruct.set(e.salaryStructureId, (empCountByStruct.get(e.salaryStructureId) || 0) + 1);
      }
    }

    const structuresWithComponents = structures.map((s) => ({
      ...s,
      id: s.id || s._id?.toString(),
      isDefault: Boolean(s.isDefault),
      pfEnabled: Boolean(s.pfEnabled ?? true),
      esicEnabled: Boolean(s.esicEnabled ?? true),
      ptEnabled: Boolean(s.ptEnabled ?? true),
      components: compByStruct.get(s.id) || [],
      employeeCount: empCountByStruct.get(s.id) || 0,
    }));

    return NextResponse.json({
      success: true,
      data: structuresWithComponents,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'STRUCTURES_FETCH_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'HR_ADMIN')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin privileges required' } },
        { status: 403 }
      );
    }

    const b = await req.json();
    const name = b.name?.trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Structure package name is required' } },
        { status: 400 }
      );
    }

    const structCol = await salaryStructuresCol();
    const compCol = await salaryComponentsCol();
    const id = generateId();
    const now = new Date();

    const structDoc = {
      id,
      name,
      description: b.description || '',
      isDefault: false,
      baseSalaryType: b.baseSalaryType || 'Fixed',
      baseSalaryAmount: Number(b.baseSalaryAmount) || 30000,
      isCTCStructure: true,
      ctcMinimum: Number(b.ctcMinimum) || 300000,
      ctcMaximum: Number(b.ctcMaximum) || 600000,
      pfEnabled: b.pfEnabled !== false,
      pfEmployeeRate: Number(b.pfEmployeeRate) || 12.0,
      pfEmployerRate: Number(b.pfEmployerRate) || 12.0,
      pfWageCeiling: Number(b.pfWageCeiling) || 15000.0,
      esicEnabled: b.esicEnabled !== false,
      esicEmployeeRate: Number(b.esicEmployeeRate) || 0.75,
      esicEmployerRate: Number(b.esicEmployerRate) || 3.25,
      esicWageCeiling: Number(b.esicWageCeiling) || 21000.0,
      ptEnabled: b.ptEnabled !== false,
      createdAt: now,
      updatedAt: now,
    };

    await structCol.insertOne(structDoc);

    if (Array.isArray(b.components) && b.components.length > 0) {
      const compDocs = b.components.map((c: any, idx: number) => ({
        id: generateId(),
        structureId: id,
        name: c.name,
        type: c.type || 'EARNING',
        calcType: c.calcType || 'FLAT',
        value: Number(c.value || c.fixedAmount) || 0,
        calculationType: c.calculationType || 'Fixed',
        percentageOf: c.percentageOf || 'BaseSalary',
        percentageValue: Number(c.percentageValue) || 0,
        formula: c.formula || '',
        condition: c.condition || '',
        isTaxable: c.isTaxable !== false,
        isMandatory: Boolean(c.isMandatory),
        isStatutory: Boolean(c.isStatutory),
        displayOrder: idx,
      }));
      await compCol.insertMany(compDocs);
    }

    return NextResponse.json({
      success: true,
      data: { id, name },
      message: `Salary structure '${name}' created successfully with ${b.components?.length || 0} component(s).`,
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
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'HR_ADMIN')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin privileges required' } },
        { status: 403 }
      );
    }

    const b = await req.json();
    const id = b.id;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Structure ID is required' }, { status: 400 });
    }

    const structCol = await salaryStructuresCol();
    const compCol = await salaryComponentsCol();
    const now = new Date();

    await structCol.updateOne(
      { $or: [{ id }, { _id: id }] },
      {
        $set: {
          name: b.name,
          description: b.description || '',
          baseSalaryType: b.baseSalaryType || 'Fixed',
          baseSalaryAmount: Number(b.baseSalaryAmount) || 30000,
          ctcMinimum: Number(b.ctcMinimum) || 300000,
          ctcMaximum: Number(b.ctcMaximum) || 600000,
          pfEnabled: b.pfEnabled !== false,
          pfEmployeeRate: Number(b.pfEmployeeRate) || 12.0,
          pfWageCeiling: Number(b.pfWageCeiling) || 15000.0,
          esicEnabled: b.esicEnabled !== false,
          esicEmployeeRate: Number(b.esicEmployeeRate) || 0.75,
          esicWageCeiling: Number(b.esicWageCeiling) || 21000.0,
          ptEnabled: b.ptEnabled !== false,
          updatedAt: now,
        },
      }
    );

    // Sync components: remove existing and re-insert
    if (Array.isArray(b.components)) {
      await compCol.deleteMany({ structureId: id });
      if (b.components.length > 0) {
        const compDocs = b.components.map((c: any, idx: number) => ({
          id: generateId(),
          structureId: id,
          name: c.name,
          type: c.type || 'EARNING',
          calcType: c.calcType || 'FLAT',
          value: Number(c.value || c.fixedAmount) || 0,
          calculationType: c.calculationType || 'Fixed',
          percentageOf: c.percentageOf || 'BaseSalary',
          percentageValue: Number(c.percentageValue) || 0,
          formula: c.formula || '',
          condition: c.condition || '',
          isTaxable: c.isTaxable !== false,
          isMandatory: Boolean(c.isMandatory),
          isStatutory: Boolean(c.isStatutory),
          displayOrder: idx,
        }));
        await compCol.insertMany(compDocs);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Salary structure '${b.name}' updated successfully.`,
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
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'HR_ADMIN')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin privileges required' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Structure ID required' }, { status: 400 });
    }

    const structCol = await salaryStructuresCol();
    const compCol = await salaryComponentsCol();
    const empCol = await employeesCol();

    await empCol.updateMany({ salaryStructureId: id }, { $set: { salaryStructureId: null } });
    await compCol.deleteMany({ structureId: id });
    await structCol.deleteOne({ $or: [{ id }, { _id: id }] });

    return NextResponse.json({ success: true, message: 'Salary structure deleted successfully' });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'DELETE_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
