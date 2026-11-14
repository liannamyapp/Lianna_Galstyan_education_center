import type { Locale } from "./i18n";

const intl: Record<Locale, string> = { hy: "hy-AM", ru: "ru-RU", en: "en-GB" };

export function money(amount: number, locale: Locale = "hy") {
  return `${new Intl.NumberFormat(intl[locale]).format(amount).replace(/ |,/g, " ")} ֏`;
}
export function date(d: Date | string | null | undefined, locale: Locale = "hy") {
  if (!d) return "";
  return new Intl.DateTimeFormat(intl[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Yerevan" }).format(new Date(d));
}
export function dateShort(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Yerevan" }).format(new Date(d));
}
export function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}
/** "Անի Մարտիրոսյան" -> "Անի Մ." */
export function shortName(name: string) {
  const [a, b] = name.split(/\s+/);
  return b ? `${a} ${b[0]}.` : a;
}
