// All calendar dates are plain YYYY-MM-DD strings (no time-of-day, no tz drift).
export const EXPIRING_DAYS = 3;
const RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateStr(s) {
  if (typeof s !== 'string' || !RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
/** Today's calendar date in the given IANA timezone. */
export function todayStr(now = new Date(), tz = 'UTC') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
export function addDays(s, n) {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function expiryStatus(expiry, today, window = EXPIRING_DAYS) {
  const d = daysBetween(today, expiry);
  if (d < 0) return 'expired';
  if (d <= window) return 'expiring-soon';
  return 'fresh';
}
