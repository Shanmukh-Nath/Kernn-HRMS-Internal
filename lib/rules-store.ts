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
  } catch (_) {}
  return DEFAULT_SHIFT_RULE;
}

export function saveStoredShiftRule(rule: Partial<ShiftRuleConfig>): ShiftRuleConfig {
  const merged: ShiftRuleConfig = {
    ...DEFAULT_SHIFT_RULE,
    ...rule,
  };

  try {
    const dataDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err: any) {
    // Gracefully ignore EROFS on read-only serverless platforms like Vercel
    if (err?.code !== 'EROFS') {
      console.warn('Filesystem write notice (using MongoDB storage):', err.message);
    }
  }

  return merged;
}

