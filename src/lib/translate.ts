import "server-only";
import { locales, type Locale } from "@/lib/i18n";
import type { L10n } from "@/db/schema";

export const autoTranslateEnabled = () => !!process.env.GOOGLE_TRANSLATE_API_KEY;

/** Detects the language of a text (hy/ru/en) without any service, by script. */
export function guessLocale(text: string, fallback: Locale): Locale {
  const hy = (text.match(/[Ա-֏]/g) ?? []).length;
  const ru = (text.match(/[Ѐ-ӿ]/g) ?? []).length;
  const en = (text.match(/[A-Za-z]/g) ?? []).length;
  const max = Math.max(hy, ru, en);
  if (!max) return fallback;
  return max === hy ? "hy" : max === ru ? "ru" : "en";
}

/**
 * Returns the text in all three site languages. The original stays as written;
 * the other two are machine-translated when GOOGLE_TRANSLATE_API_KEY is set.
 * Without a key (or on any error) only the original is filled — the admin can add translations by hand.
 */
export async function translateAll(text: string, fallback: Locale): Promise<Partial<L10n>> {
  const src = guessLocale(text, fallback);
  const out: Partial<L10n> = { [src]: text };
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!key || !text.trim()) return out;
  await Promise.all(locales.filter((l) => l !== src).map(async (target) => {
    try {
      const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, source: src, target, format: "text" }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return;
      const j = (await res.json()) as { data?: { translations?: { translatedText?: string }[] } };
      const v = j.data?.translations?.[0]?.translatedText;
      if (v) out[target] = v;
    } catch { /* keep the original only */ }
  }));
  return out;
}
