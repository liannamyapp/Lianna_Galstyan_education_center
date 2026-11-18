/** Payment schedule logic: pure functions, usable on the server anywhere. */
export type BillingConfig = { reminderDays: number; graceDays: number };
export type PayLike = { status: string; paidAt: Date | string | null; amount: number };
export type AppLike = {
  plan: string; format: string; status: string;
  monthlyAmount: number | null; fullAmount: number | null; months: number | null; startDate: Date | string | null;
};
export type CourseLike = { priceMonthly: number; priceFull: number | null; priceIndividual: number; priceIndividualFull: number | null; months: number };
export type Instalment = { index: number; due: Date | null; amount: number; paid: boolean; paidAt: Date | null };
export type BillingState = "unpaid" | "upcoming" | "soon" | "due" | "overdue" | "done";
export type Billing = {
  plan: "monthly" | "full"; months: number; instalments: Instalment[]; next: Instalment | null;
  paidCount: number; paidTotal: number; state: BillingState; daysLeft: number | null; locked: boolean;
};

const DAY = 86_400_000;
const YEREVAN = 4 * 3_600_000;
/** Calendar day number in Yerevan time — used to compare dates without hour noise. */
export const dayNo = (d: Date | string) => Math.floor((new Date(d).getTime() + YEREVAN) / DAY);

export function addMonths(d: Date | string, n: number) {
  const x = new Date(d);
  const day = x.getUTCDate();
  const r = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + n, 1, x.getUTCHours(), x.getUTCMinutes()));
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}

/** Prices for a format, as offered today (used at enrollment, then locked on the application). */
export function priceFor(course: CourseLike, format: string) {
  return format === "individual"
    ? { monthly: course.priceIndividual, full: course.priceIndividualFull }
    : { monthly: course.priceMonthly, full: course.priceFull };
}

export function billing(app: AppLike, course: CourseLike, groupStart: Date | string | null | undefined, pays: PayLike[], cfg: BillingConfig, now = new Date()): Billing {
  const price = priceFor(course, app.format);
  const months = Math.max(1, app.months ?? course.months);
  const monthly = app.monthlyAmount ?? price.monthly;
  const paid = pays.filter((p) => p.status === "PAID").sort((a, b) => +new Date(a.paidAt ?? 0) - +new Date(b.paidAt ?? 0));
  const paidTotal = paid.reduce((s, p) => s + p.amount, 0);
  const plan = app.plan === "full" ? "full" : "monthly";
  const start = app.startDate ?? groupStart ?? paid[0]?.paidAt ?? null;

  if (plan === "full") {
    const done = paid.length > 0;
    const inst: Instalment = { index: 0, due: start ? new Date(start) : null, amount: app.fullAmount ?? price.full ?? monthly * months, paid: done, paidAt: paid[0]?.paidAt ? new Date(paid[0].paidAt) : null };
    return { plan, months, instalments: [inst], next: done ? null : inst, paidCount: paid.length, paidTotal, state: done ? "done" : "unpaid", daysLeft: null, locked: false };
  }

  // Instalments are covered by the AMOUNT paid, not by the number of payments: one cash payment for three months
  // covers three instalments; two half payments cover one. Each instalment's date is when its amount was reached.
  const coveredAt: (Date | null)[] = [];
  let sum = 0;
  for (const p of paid) {
    sum += p.amount;
    while (coveredAt.length < months && monthly > 0 && sum + 1 >= monthly * (coveredAt.length + 1)) coveredAt.push(p.paidAt ? new Date(p.paidAt) : null);
  }
  if (monthly <= 0) paid.forEach((p, i) => { if (i < months) coveredAt.push(p.paidAt ? new Date(p.paidAt) : null); });
  const covered = coveredAt.length;
  const instalments: Instalment[] = Array.from({ length: months }, (_, i) => ({
    index: i,
    due: start ? addMonths(start, i) : null,
    amount: i === covered ? Math.max(1, monthly * (i + 1) - paidTotal) : monthly, // the next one asks only for what is missing
    paid: i < covered,
    paidAt: coveredAt[i] ?? null,
  }));
  const next = instalments.find((x) => !x.paid) ?? null;
  if (!next) return { plan, months, instalments, next, paidCount: covered, paidTotal, state: "done", daysLeft: null, locked: false };
  if (covered === 0 && paid.length === 0 || !next.due) return { plan, months, instalments, next, paidCount: covered, paidTotal, state: "unpaid", daysLeft: null, locked: false };

  const daysLeft = dayNo(next.due) - dayNo(now);
  const state: BillingState = daysLeft > cfg.reminderDays ? "upcoming" : daysLeft > 0 ? "soon" : daysLeft >= -cfg.graceDays ? "due" : "overdue";
  return { plan, months, instalments, next, paidCount: covered, paidTotal, state, daysLeft, locked: state === "overdue" };
}
