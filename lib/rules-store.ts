import fs from 'fs';
import path from 'path';
import { DEFAULT_SHIFT_RULE, ShiftRuleConfig } from './attendance-calculator';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'attendance-rules.json');

export function getStoredShiftRule(): ShiftRuleConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SHIFT_RULE,
        ...parsed,
      };
    }
  } catch (err) {
    console.error('Error reading attendance rules file:', err);
  }
  return DEFAULT_SHIFT_RULE;
}

export function saveStoredShiftRule(rule: Partial<ShiftRuleConfig>): ShiftRuleConfig {
  try {
    const dataDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const merged: ShiftRuleConfig = {
      ...getStoredShiftRule(),
      ...rule,
    };

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  } catch (err) {
    console.error('Error saving attendance rules file:', err);
    throw err;
  }
}
