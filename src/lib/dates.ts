// Shift.date (and other "calendar date, no time-of-day" fields) is stored as
// UTC midnight. Parsing that string with `new Date(str)` and then formatting
// in local time shifts the displayed day back by one in any timezone behind
// UTC (most of the US/Canada) — this reconstructs the date from its local
// calendar components instead, so it always formats as the date it names.
export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}
