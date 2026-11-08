/* Academia · exact age maths + real calendar-date validation.
   The previous check compared getMonth() against birth.getMonth() - 1,
   which was off by one month and accepted impossible dates like 31 Feb. */

export interface DobParts { d: number; m: number; y: number }

/** True only for real calendar dates (rejects 31 Feb, 30 Feb, year 0, etc.). */
export function isValidDob({ d, m, y }: DobParts): boolean {
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return false;
  if (m < 1 || m > 12 || d < 1 || y < 1900 || y > 2100) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Completed years on `now` — a birthday later this year doesn't count yet. */
export function ageOn(dob: DobParts, now = new Date()): number | null {
  if (!isValidDob(dob)) return null;
  const birth = new Date(dob.y, dob.m - 1, dob.d);
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}
