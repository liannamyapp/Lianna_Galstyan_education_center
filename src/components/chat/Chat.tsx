import { getCourses, getFaqs } from "@/lib/data";
import { getDict, tr, type Locale } from "@/lib/i18n";
import { money } from "@/lib/format";
import { ChatWidget, type QuickAnswer } from "./ChatWidget";

const plain = (md: string) => md.replace(/\*\*|__|`|#+\s/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();

/** The site chat: quick answers come from the live course list and the admin's FAQ. */
export async function Chat({ locale }: { locale: Locale }) {
  const t = getDict(locale).chat;
  const [courses, faqs] = await Promise.all([getCourses(), getFaqs()]);
  const quick: QuickAnswer[] = [];
  if (courses.length) {
    quick.push({
      q: t.courses,
      a: courses.map((c) => `${c.code} · ${tr(c.title, locale)} — ${money(c.priceMonthly, locale)} / ${t.perMonth} × ${c.months} ${t.months}; ${t.individual}${locale === "hy" ? "՝" : ":"} ${money(c.priceIndividual, locale)} / ${t.perMonth}`).join("\n\n"),
      link: { href: `/${locale}/courses`, label: t.allCourses },
    });
  }
  quick.push({ q: t.howTo, a: t.howToAnswer, link: { href: `/${locale}/courses`, label: t.allCourses } });
  for (const f of faqs.slice(0, 4)) {
    const q = tr(f.question, locale), a = plain(tr(f.answer, locale));
    if (q && a) quick.push({ q, a: a.length > 700 ? a.slice(0, 700) + "…" : a });
  }
  return <ChatWidget locale={locale} t={t} quick={quick} />;
}
