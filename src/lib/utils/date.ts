import { DEFAULT_TIMEZONE } from './constants';

export function getLocalDateString(
  date: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function getLocalHour(
  date: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(date);
    const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '12';
    const hour = Number.parseInt(hourPart, 10);
    return Number.isNaN(hour) ? 12 : hour % 24;
  } catch {
    return date.getHours();
  }
}

export function getLocalDayOfWeek(dateString: string): number {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return 0;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function getGreetingForTimezone(
  name: string,
  date: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const hour = getLocalHour(date, timeZone);
  const firstName = name.trim().split(/\s+/)[0] || 'Anda';
  if (hour >= 4 && hour < 11) return `Selamat pagi, ${firstName}`;
  if (hour >= 11 && hour < 15) return `Selamat siang, ${firstName}`;
  if (hour >= 15 && hour < 18) return `Selamat sore, ${firstName}`;
  return `Selamat malam, ${firstName}`;
}

export function formatLongLocalDate(
  date: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

export function formatShortDate(dateString: string): string {
  if (!dateString) return '—';
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(utc);
}

export function calculateUsageDays(
  startDate: string,
  endDate: string | null,
  referenceDate: string = getLocalDateString(),
): number {
  const start = parseDateUtcMs(startDate);
  const effectiveEnd = parseDateUtcMs(endDate ?? referenceDate);
  if (start === null || effectiveEnd === null) return 0;
  const diffDays = Math.floor((effectiveEnd - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, diffDays);
}

export function formatUsageDuration(days: number): string {
  if (days <= 0) return 'Belum dimulai';
  if (days === 1) return '1 hari';
  if (days < 30) return `${days} hari`;
  const months = Math.floor(days / 30);
  const rem = days % 30;
  if (months === 1 && rem === 0) return '1 bulan';
  if (rem === 0) return `${months} bulan`;
  return `${months} bln ${rem} hr (${days} hr)`;
}

export function addDaysToDateString(dateString: string, deltaDays: number): string {
  const ms = parseDateUtcMs(dateString);
  if (ms === null) return dateString;
  const next = new Date(ms + deltaDays * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

export function getDateRangeBounds(
  preset: '7d' | '30d' | '90d' | 'custom',
  referenceDate: string,
  customStart?: string,
  customEnd?: string,
): { startDate: string; endDate: string } {
  if (preset === 'custom' && customStart && customEnd) {
    return customStart <= customEnd
      ? { startDate: customStart, endDate: customEnd }
      : { startDate: customEnd, endDate: customStart };
  }
  const days = preset === '7d' ? 6 : preset === '30d' ? 29 : 89;
  return {
    startDate: addDaysToDateString(referenceDate, -days),
    endDate: referenceDate,
  };
}

export function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = Number.parseInt(hStr ?? '0', 10);
  const m = Number.parseInt(mStr ?? '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return time24;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getLocalTimeHHMM(
  date: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  } catch {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}

function parseDateUtcMs(dateString: string): number | null {
  const parts = dateString.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  return Date.UTC(year, month - 1, day);
}
