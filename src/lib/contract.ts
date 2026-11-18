import "server-only";
import { sql } from "drizzle-orm";
import { db, s } from "@/db";
import type { L10n } from "@/db/schema";
import { getPage } from "@/lib/data";
import { locales, type Locale } from "@/lib/i18n";
import { date, money } from "@/lib/format";
import { CONTRACT_TEMPLATE } from "@/lib/contract-template";
import { esc } from "@/lib/escape";

export type { ContractSnapshotData as ContractSnapshot } from "@/lib/contract-types";

type AppLike = {
  format: string; plan: string; monthlyAmount: number | null; fullAmount: number | null; months: number | null;
  startDate: Date | string | null;
};
type CourseLike = { code: string; title: L10n; hours: number; months: number; priceMonthly: number; priceFull: number | null; priceIndividual: number; priceIndividualFull: number | null };

const FORMAT: Record<Locale, { group: string; individual: string }> = {
  hy: { group: "խմբակային", individual: "անհատական" },
  ru: { group: "групповом", individual: "индивидуальном" },
  en: { group: "group", individual: "individual" },
};
const NO_START: Record<Locale, string> = { hy: "կողմերի համաձայնեցրած օրը", ru: "по согласованию сторон", en: "a date agreed by the parties" };

/** Labels shown in the blanks of the public sample. */
export const SAMPLE_BLANKS: Record<Locale, Record<string, string>> = {
  hy: { course: "դասընթացի կոդ և անվանում", hours: "ժամերի քանակ", format: "խմբակային / անհատական", start: "մեկնարկի ամսաթիվ", price: "գինը և վճարման տարբերակը" },
  ru: { course: "код и название курса", hours: "кол-во", format: "групповом / индивидуальном", start: "дата старта", price: "цена и вариант оплаты" },
  en: { course: "course code and title", hours: "number of", format: "group / individual", start: "start date", price: "price and payment plan" },
};

/** The learner's own values for the template, in one language. */
export function contractValues(app: AppLike, course: CourseLike, groupStart: Date | string | null | undefined, l: Locale): Record<string, string> {
  const individual = app.format === "individual";
  const months = app.months ?? course.months;
  const monthly = app.monthlyAmount ?? (individual ? course.priceIndividual : course.priceMonthly);
  const full = app.fullAmount ?? (individual ? course.priceIndividualFull : course.priceFull);
  const start = groupStart ?? app.startDate;
  const title = course.title[l] || course.title.hy;
  const price = app.plan === "full" && full
    ? { hy: `${money(full, l)}՝ ամբողջ դասընթացի համար միանգամից`, ru: `${money(full, l)} за весь курс единовременно`, en: `${money(full, l)} for the whole course, paid at once` }[l]
    : { hy: `${money(monthly, l)} ամսական × ${months} ամիս (ընդամենը ${money(monthly * months, l)})`, ru: `${money(monthly, l)} в месяц × ${months} мес. (всего ${money(monthly * months, l)})`, en: `${money(monthly, l)} per month × ${months} months (${money(monthly * months, l)} in total)` }[l];
  return {
    course: l === "hy" ? `${course.code} «${title}»` : l === "ru" ? `${course.code} «${title}»` : `${course.code} “${title}”`,
    hours: String(course.hours),
    format: FORMAT[l][individual ? "individual" : "group"],
    start: start ? date(start, l) : NO_START[l],
    price,
  };
}

/** Fills {{key}} placeholders; without values each blank becomes a ⟦label⟧ marker the page draws as a field. */
export function fillContract(template: string, values: Record<string, string> | null, l: Locale) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (values ? values[k] ?? "" : `⟦${SAMPLE_BLANKS[l][k] ?? k}⟧`));
}

/** Turns the sample markers into styled blanks (after markdown rendering). */
export function drawBlanks(html: string) {
  return html.replace(/⟦([^⟧]{1,80})⟧/g, (_, label: string) => `<span class="contract-blank">${label.replace(/[<>&"]/g, "")}</span>`);
}

/** Current contract text: the admin-edited page when it is a template, otherwise the built-in one. */
export async function contractTemplate(): Promise<L10n> {
  const page = await getPage("contract");
  const out = { ...CONTRACT_TEMPLATE } as L10n;
  if (page) for (const l of locales) if (page.body[l]?.includes("{{")) out[l] = page.body[l];
  return out;
}

export async function nextContractNo() {
  // after the highest number ever used this year (not a count), so removing a learner never makes a number repeat
  const prefix = `ՊՄ-${new Date().getFullYear()}-`;
  const [{ n }] = await db.select({ n: sql<number>`coalesce(max(substring(${s.applications.contractNo} from '([0-9]+)$')::int), 0)::int` }).from(s.applications).where(sql`${s.applications.contractNo} like ${prefix + "%"}`);
  return `${prefix}${String(n + 1).padStart(3, "0")}`;
}

/** The Provider's block on the agreement, from site settings. */
export function providerParty(st: { legal: { entity: L10n; tin: string; address: L10n }; contacts: { email: string; phone: string } }, l: Locale, t: Record<string, string>) {
  return {
    name: esc(st.legal.entity[l] || st.legal.entity.hy),
    lines: [esc(t.trading), `${esc(t.tin)} ${esc(st.legal.tin)}`, esc(st.legal.address[l] || st.legal.address.hy), `${esc(st.contacts.email)} · ${esc(st.contacts.phone)}`],
  };
}
