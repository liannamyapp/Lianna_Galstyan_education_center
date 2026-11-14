import type { L10n, L10nList } from "@/db/schema";
import hy from "@/dictionaries/hy.json";
import ru from "@/dictionaries/ru.json";
import en from "@/dictionaries/en.json";

export const locales = ["hy", "ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "hy";
export const localeNames: Record<Locale, string> = { hy: "ՀԱՅ", ru: "РУС", en: "ENG" };
export const htmlLang: Record<Locale, string> = { hy: "hy", ru: "ru", en: "en" };
export const ogLocale: Record<Locale, string> = { hy: "hy_AM", ru: "ru_RU", en: "en_US" };

export type Dict = typeof hy;
const dicts: Record<Locale, Dict> = { hy, ru: ru as Dict, en: en as Dict };

export function isLocale(x: string | undefined | null): x is Locale {
  return !!x && (locales as readonly string[]).includes(x);
}
export function getDict(locale: string): Dict {
  return dicts[isLocale(locale) ? locale : defaultLocale];
}

/** Pick a localized value with fallback to Armenian, then any non-empty value. */
export function tr(v: Partial<L10n> | null | undefined, locale: string): string {
  if (!v) return "";
  const l = (isLocale(locale) ? locale : defaultLocale) as Locale;
  return v[l] || v.hy || v.ru || v.en || "";
}
export function trList(v: Partial<L10nList> | null | undefined, locale: string): string[] {
  if (!v) return [];
  const l = (isLocale(locale) ? locale : defaultLocale) as Locale;
  const pick = v[l];
  return pick && pick.length ? pick : v.hy || [];
}

/** Simple {name} interpolation. */
export function fmt(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
