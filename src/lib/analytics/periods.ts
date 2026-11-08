const DAY_MS = 24 * 60 * 60 * 1000;

export type DayRange = {
  from: string;
  to: string;
};

export function isDay(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function dayKey(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

export function addDays(day: string, days: number) {
  const time = Date.parse(`${day}T00:00:00.000Z`) + days * DAY_MS;
  return new Date(time).toISOString().slice(0, 10);
}

export function inclusiveDayCount(range: DayRange) {
  const start = Date.parse(`${range.from}T00:00:00.000Z`);
  const end = Date.parse(`${range.to}T00:00:00.000Z`);
  return Math.round((end - start) / DAY_MS) + 1;
}

export function previousPeriod(range: DayRange): DayRange {
  const length = inclusiveDayCount(range);
  const to = addDays(range.from, -1);
  const from = addDays(to, -(length - 1));
  return { from, to };
}

export function normalizeRange(from: string, to: string): DayRange {
  return from <= to ? { from, to } : { from: to, to: from };
}

export function defaultRange(latestDay: string | null): DayRange | null {
  if (!latestDay) return null;
  return { from: addDays(latestDay, -29), to: latestDay };
}

export function inDayRange(day: string, range: DayRange) {
  return day >= range.from && day <= range.to;
}

export function rangeStart(range: DayRange) {
  return new Date(`${range.from}T00:00:00.000Z`);
}

export function rangeEndExclusive(range: DayRange) {
  return new Date(`${addDays(range.to, 1)}T00:00:00.000Z`);
}
