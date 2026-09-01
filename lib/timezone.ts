import { format, toDate } from 'date-fns';

export const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

/**
 * Robust date parser for IST (Indian Standard Time, UTC+05:30) biometric records
 */
export function parseAppDate(date: Date | string | number | null | undefined): Date {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (typeof date === 'number') return new Date(date);

  const str = String(date).trim();
  // If string is already in ISO format with explicit offset or UTC 'Z'
  if (str.includes('+') || (str.includes('T') && str.endsWith('Z'))) {
    return new Date(str);
  }

  // If string is raw biometric wall-clock time (e.g. "2026-09-01 10:54:07" or "2026-09-01T10:54:07")
  // it is in Indian Standard Time (IST, UTC+05:30)
  const normalized = str.replace(' ', 'T');
  const fullTime = normalized.length === 16 ? `${normalized}:00` : normalized;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(fullTime)) {
    return new Date(`${fullTime.slice(0, 19)}+05:30`);
  }

  return new Date(str);
}

/**
 * Formats a Date object into a readable string in the application's configured timezone.
 */
export function formatAppDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return '-';
  const d = parseAppDate(date);
  if (isNaN(d.getTime())) return '-';

  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: DEFAULT_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export function formatAppTime(date: Date | string | number | null | undefined): string {
  if (!date) return '-';
  const d = parseAppDate(date);
  if (isNaN(d.getTime())) return '-';

  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: DEFAULT_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return d.toLocaleTimeString();
  }
}

export function formatAppDate(date: Date | string | number | null | undefined): string {
  if (!date) return '-';
  const d = parseAppDate(date);
  if (isNaN(d.getTime())) return '-';

  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: DEFAULT_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

