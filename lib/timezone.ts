import { format, toDate } from 'date-fns';

export const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

/**
 * Formats a Date object into a readable string in the application's configured timezone.
 */
export function formatAppDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
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
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
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
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
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
