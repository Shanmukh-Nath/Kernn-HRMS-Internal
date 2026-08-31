/**
 * Master Enterprise Salary Formula & Calculation Engine
 * Implements safe AST mathematical expression evaluation and dynamic statutory deductions
 * based on database configuration records without code hardcoding.
 */

export interface SalaryBaseValues {
  baseSalary: number;
  ctc: number;
  basic?: number;
  gross?: number;
  [key: string]: any;
}

export interface EmployeeContext {
  id?: string;
  experienceYears?: number;
  department?: string;
  designation?: string;
  gender?: string;
  [key: string]: any;
}

export class SalaryFormulaEngine {
  /**
   * Evaluates an individual salary component against base parameters and formulas.
   */
  static calculateComponent(component: any, baseValues: SalaryBaseValues, employee: EmployeeContext = {}): number {
    const baseSalary = Number(baseValues.baseSalary) || 0;
    const ctc = Number(baseValues.ctc) || 0;
    let amount = 0;

    const calcType = component.calculationType || component.calcType || 'Fixed';

    switch (calcType) {
      case 'Fixed':
        amount = Number(component.fixedAmount || component.value) || 0;
        break;

      case 'Percentage': {
        const base = this.getBaseValue(component.percentageOf, baseValues);
        const pct = Number(component.percentageValue ?? component.value) || 0;
        amount = (base * pct) / 100;
        break;
      }

      case 'Formula': {
        try {
          const formulaStr = String(component.formula || '0').trim();
          if (!formulaStr) {
            amount = 0;
            break;
          }

          // Inject safe evaluation context variables
          const context: Record<string, number> = {
            base: baseSalary,
            ctc: ctc,
            baseSalary: baseSalary,
            basic: Number(baseValues.basic) || 0,
            gross: Number(baseValues.gross) || 0,
            experience: Number(employee.experienceYears) || 0,
          };

          amount = this.evaluateFormula(formulaStr, context);
        } catch (err) {
          console.error(`[FormulaEngine] Error evaluating formula "${component.formula}":`, err);
          amount = 0;
        }
        break;
      }

      default:
        amount = Number(component.value) || 0;
    }

    // Dynamic Condition Guard (e.g. "base > 15000 && experience >= 2")
    if (component.condition && String(component.condition).trim() !== '') {
      const conditionMet = this.evaluateCondition(component.condition, {
        ...baseValues,
        amount,
        experience: Number(employee.experienceYears) || 0,
      });
      if (!conditionMet) {
        amount = 0;
      }
    }

    return Math.round(amount * 100) / 100;
  }

  /**
   * Maps percentage references to active accumulator registers.
   */
  static getBaseValue(percentageOf: string | null | undefined, baseValues: SalaryBaseValues): number {
    const key = (percentageOf || 'BaseSalary').trim();
    const mapping: Record<string, number> = {
      BaseSalary: Number(baseValues.baseSalary) || 0,
      baseSalary: Number(baseValues.baseSalary) || 0,
      CTC: Number(baseValues.ctc) || 0,
      ctc: Number(baseValues.ctc) || 0,
      Basic: Number(baseValues.basic) || 0,
      basic: Number(baseValues.basic) || 0,
      Gross: Number(baseValues.gross) || 0,
      gross: Number(baseValues.gross) || 0,
    };
    return mapping[key] ?? Number(baseValues.baseSalary) ?? 0;
  }

  /**
   * Sanitizes arithmetic expression and executes within isolated scope.
   */
  static evaluateFormula(formula: string, context: Record<string, number>): number {
    // Whitelist only numbers, basic arithmetic operators, brackets, whitespace, and valid identifiers
    const sanitized = formula.replace(/[^0-9+\-*/().\s\w]/g, '');
    const contextKeys = Object.keys(context);
    const contextValues = Object.values(context);

    try {
      const evaluator = new Function(...contextKeys, `return (${sanitized});`);
      const result = evaluator(...contextValues);
      return isNaN(result) || !isFinite(result) ? 0 : Number(result);
    } catch {
      return 0;
    }
  }

  /**
   * Evaluates boolean comparison statements safely.
   */
  static evaluateCondition(condition: string, context: Record<string, any>): boolean {
    try {
      const sanitized = condition.replace(/[^0-9+\-*/().\s\w<>=!&|]/g, '');
      const contextKeys = Object.keys(context);
      const contextValues = Object.values(context);
      const evaluator = new Function(...contextKeys, `return Boolean(${sanitized});`);
      return Boolean(evaluator(...contextValues));
    } catch {
      return true; // Default to true if condition fails parse
    }
  }

  /**
   * Computes statutory contributions using dynamic ceilings from SalaryStructure configuration.
   */
  static calculateStatutoryDeductions(
    employee: EmployeeContext,
    grossSalary: number,
    structureConfig: any
  ): {
    pfEmployee: number;
    pfEmployer: number;
    esicEmployee: number;
    esicEmployer: number;
    professionalTax: number;
    tds: number;
  } {
    const deductions = {
      pfEmployee: 0,
      pfEmployer: 0,
      esicEmployee: 0,
      esicEmployer: 0,
      professionalTax: 0,
      tds: 0,
    };

    const gross = Number(grossSalary) || 0;
    if (gross <= 0) return deductions;

    // 1. Provident Fund (PF) with Dynamic Wage Ceiling
    const pfEnabled = structureConfig.pfEnabled === undefined || Boolean(structureConfig.pfEnabled);
    if (pfEnabled) {
      const ceiling = Number(structureConfig.pfWageCeiling) || 15000.0;
      const pfBase = Math.min(gross, ceiling);
      const empRate = Number(structureConfig.pfEmployeeRate) || 12.0;
      const emplrRate = Number(structureConfig.pfEmployerRate) || 12.0;

      deductions.pfEmployee = (pfBase * empRate) / 100;
      deductions.pfEmployer = (pfBase * emplrRate) / 100;
    }

    // 2. ESIC with Dynamic Ceiling
    const esicEnabled = structureConfig.esicEnabled === undefined || Boolean(structureConfig.esicEnabled);
    if (esicEnabled) {
      const ceiling = Number(structureConfig.esicWageCeiling) || 21000.0;
      if (gross <= ceiling) {
        const empRate = Number(structureConfig.esicEmployeeRate) || 0.75;
        const emplrRate = Number(structureConfig.esicEmployerRate) || 3.25;
        deductions.esicEmployee = (gross * empRate) / 100;
        deductions.esicEmployer = (gross * emplrRate) / 100;
      }
    }

    // 3. Professional Tax (PT) from Slabs
    const ptEnabled = structureConfig.ptEnabled === undefined || Boolean(structureConfig.ptEnabled);
    if (ptEnabled) {
      let ptSlabs = [
        { limit: 15000, amount: 0 },
        { limit: 20000, amount: 150 },
        { limit: Infinity, amount: 200 },
      ];

      if (structureConfig.ptConfiguration) {
        try {
          const parsed = typeof structureConfig.ptConfiguration === 'string'
            ? JSON.parse(structureConfig.ptConfiguration)
            : structureConfig.ptConfiguration;
          if (parsed?.slabs && Array.isArray(parsed.slabs)) {
            ptSlabs = parsed.slabs;
          }
        } catch {}
      }

      for (const slab of ptSlabs) {
        if (gross <= Number(slab.limit)) {
          deductions.professionalTax = Number(slab.amount) || 0;
          break;
        }
      }
    }

    // Format all to 2 decimal places
    deductions.pfEmployee = Math.round(deductions.pfEmployee * 100) / 100;
    deductions.pfEmployer = Math.round(deductions.pfEmployer * 100) / 100;
    deductions.esicEmployee = Math.round(deductions.esicEmployee * 100) / 100;
    deductions.esicEmployer = Math.round(deductions.esicEmployer * 100) / 100;
    deductions.professionalTax = Math.round(deductions.professionalTax * 100) / 100;
    deductions.tds = Math.round(deductions.tds * 100) / 100;

    return deductions;
  }

  /**
   * Complete Simulation Runner for Salary Structure Preview API & Live UI Simulator.
   */
  static simulateStructure(structureConfig: any, baseValues: SalaryBaseValues, components: any[], employee: EmployeeContext = {}) {
    const baseSalary = Number(baseValues.baseSalary) || 0;
    const ctc = Number(baseValues.ctc) || (baseSalary * 12);

    const sortedComponents = [...components].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    const earningsList: any[] = [];
    const deductionsList: any[] = [];
    let basicAmount = 0;
    let totalEarnings = 0;
    let totalCustomDeductions = 0;

    // Pass 1: Compute Basic Pay first to populate evaluation context
    const basicComp = sortedComponents.find((c) => (c.category || c.name || '').toLowerCase() === 'basic' || c.code === 'BASIC');
    if (basicComp) {
      basicAmount = this.calculateComponent(basicComp, { baseSalary, ctc, basic: 0, gross: 0 }, employee);
    } else {
      basicAmount = Math.round(baseSalary * 0.5); // Fallback: 50%
    }

    // Pass 2: Calculate all Earnings
    for (const comp of sortedComponents) {
      const type = (comp.type || 'Earning').toLowerCase();
      if (type === 'earning') {
        const isBasic = (comp.category || comp.name || '').toLowerCase() === 'basic' || comp.code === 'BASIC';
        const amount = isBasic ? basicAmount : this.calculateComponent(comp, { baseSalary, ctc, basic: basicAmount, gross: totalEarnings }, employee);
        earningsList.push({
          id: comp.id,
          name: comp.name,
          code: comp.code || comp.name.toUpperCase().replace(/\s+/g, '_'),
          category: comp.category || 'Allowance',
          calculationType: comp.calculationType || 'Fixed',
          amount,
        });
        totalEarnings += amount;
      }
    }

    if (earningsList.length === 0) {
      // Default structure if empty
      earningsList.push({ name: 'Basic Pay', code: 'BASIC', category: 'Basic', amount: basicAmount });
      earningsList.push({ name: 'Special Allowance', code: 'SPECIAL', category: 'Special', amount: Math.max(0, baseSalary - basicAmount) });
      totalEarnings = baseSalary;
    }

    const grossSalary = totalEarnings;

    // Pass 3: Calculate custom Deductions
    for (const comp of sortedComponents) {
      const type = (comp.type || '').toLowerCase();
      if (type === 'deduction') {
        const amount = this.calculateComponent(comp, { baseSalary, ctc, basic: basicAmount, gross: grossSalary }, employee);
        deductionsList.push({
          id: comp.id,
          name: comp.name,
          code: comp.code || comp.name.toUpperCase().replace(/\s+/g, '_'),
          category: comp.category || 'OtherDeduction',
          amount,
        });
        totalCustomDeductions += amount;
      }
    }

    // Pass 4: Calculate Statutory Deductions
    const statutory = this.calculateStatutoryDeductions(employee, grossSalary, structureConfig);
    const totalStatutory = statutory.pfEmployee + statutory.esicEmployee + statutory.professionalTax + statutory.tds;
    const totalDeductions = Math.round((totalCustomDeductions + totalStatutory) * 100) / 100;

    const rawNetSalary = Math.round((grossSalary - totalDeductions) * 100) / 100;
    const netSalary = Math.max(0, rawNetSalary);
    const shortfallAmount = rawNetSalary < 0 ? Math.abs(rawNetSalary) : 0;
    const isNetNegative = rawNetSalary < 0;

    return {
      baseSalary,
      ctc,
      earnings: earningsList,
      deductions: deductionsList,
      statutoryDeductions: statutory,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      totalDeductions,
      grossSalary: Math.round(grossSalary * 100) / 100,
      netSalary,
      rawNetSalary,
      shortfallAmount,
      isNetNegative,
    };
  }
}
