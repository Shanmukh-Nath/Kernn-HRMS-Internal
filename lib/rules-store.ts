import { DEFAULT_SHIFT_RULE, ShiftRuleConfig } from './attendance-calculator';
import { attendanceRulesCol, generateId } from './mongodb';

let cachedShiftRule: ShiftRuleConfig | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache in memory

/**
 * 100% MongoDB-backed Shift Rule Resolver (Zero Filesystem Operations for Serverless)
 */
export async function getStoredShiftRuleAsync(): Promise<ShiftRuleConfig> {
  const now = Date.now();
  if (cachedShiftRule && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedShiftRule;
  }

  try {
    const rulesCol = await attendanceRulesCol();
    const dbRule = await rulesCol.findOne({ isDefault: true });

    if (dbRule) {
      const merged: ShiftRuleConfig = {
        ...DEFAULT_SHIFT_RULE,
        ...dbRule,
        workingDays: Array.isArray(dbRule.workingDays)
          ? dbRule.workingDays
          : DEFAULT_SHIFT_RULE.workingDays,
        gracePeriodMinutes: Number(dbRule.gracePeriodMinutes ?? DEFAULT_SHIFT_RULE.gracePeriodMinutes),
        lateMarkThresholdMinutes: Number(dbRule.lateMarkThresholdMinutes ?? DEFAULT_SHIFT_RULE.lateMarkThresholdMinutes),
        earlyExitThresholdMinutes: Number(dbRule.earlyExitThresholdMinutes ?? DEFAULT_SHIFT_RULE.earlyExitThresholdMinutes),
        halfDayMinHours: Number(dbRule.halfDayMinHours ?? dbRule.halfDayMinimumHours ?? DEFAULT_SHIFT_RULE.halfDayMinHours),
        fullDayMinHours: Number(dbRule.fullDayMinHours ?? DEFAULT_SHIFT_RULE.fullDayMinHours),
        debounceMinutes: Number(dbRule.debounceMinutes ?? DEFAULT_SHIFT_RULE.debounceMinutes),
        overtimeMinMinutes: Number(dbRule.overtimeMinMinutes ?? DEFAULT_SHIFT_RULE.overtimeMinMinutes),
      };
      cachedShiftRule = merged;
      lastCacheTime = now;
      return merged;
    }
  } catch (err: any) {
    console.warn('[RULES_STORE] Database fetch notice:', err.message);
  }

  return cachedShiftRule || DEFAULT_SHIFT_RULE;
}

/**
 * Synchronous accessor returning memory cached rule or DEFAULT_SHIFT_RULE
 */
export function getStoredShiftRule(): ShiftRuleConfig {
  return cachedShiftRule || DEFAULT_SHIFT_RULE;
}

/**
 * 100% MongoDB-backed Shift Rule Saver (Zero Filesystem Operations)
 */
export async function saveStoredShiftRuleAsync(rule: Partial<ShiftRuleConfig>): Promise<ShiftRuleConfig> {
  const merged: ShiftRuleConfig = {
    ...DEFAULT_SHIFT_RULE,
    ...(cachedShiftRule || {}),
    ...rule,
  };

  try {
    const rulesCol = await attendanceRulesCol();
    await rulesCol.updateOne(
      { isDefault: true },
      {
        $set: {
          ...merged,
          isDefault: true,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          id: generateId(),
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    cachedShiftRule = merged;
    lastCacheTime = Date.now();
  } catch (err: any) {
    console.error('[RULES_STORE_SAVE_ERROR]', err.message);
    throw err;
  }

  return merged;
}

export function saveStoredShiftRule(rule: Partial<ShiftRuleConfig>): ShiftRuleConfig {
  cachedShiftRule = {
    ...DEFAULT_SHIFT_RULE,
    ...(cachedShiftRule || {}),
    ...rule,
  };
  lastCacheTime = Date.now();
  return cachedShiftRule;
}


