/** Full years between a YYYY-MM-DD birth date and today in Yerevan; null if the date is invalid. */
export function ageOn(birth: string, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const b = new Date(Date.UTC(y, mo - 1, d));
  if (b.getUTCFullYear() !== y || b.getUTCMonth() !== mo - 1 || b.getUTCDate() !== d) return null;
  const t = new Date(now.getTime() + 4 * 3_600_000); // Yerevan calendar day
  let age = t.getUTCFullYear() - y;
  if (t.getUTCMonth() + 1 < mo || (t.getUTCMonth() + 1 === mo && t.getUTCDate() < d)) age--;
  return age;
}
