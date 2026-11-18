import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db, s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getDict, tr, type Locale } from "@/lib/i18n";
import { dateShort } from "@/lib/format";
import { journalApps, loadJournal } from "@/lib/journal";
import { JournalView, type JournalLabels } from "@/components/JournalView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/** The learner's own journal: only their enrolments, attendance and grades. */
export default async function MyJournal({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const t = getDict(locale);
  const apps = await journalApps(eq(s.applications.userId, user.id)); // never another learner's data
  const data = await loadJournal(apps);
  // applications still waiting for the intro talk / approval: the journal opens once the enrolment is approved
  const pending = await db.query.applications.findMany({
    where: and(eq(s.applications.userId, user.id), inArray(s.applications.status, ["NEW", "INTERVIEW"])),
    with: { course: true },
  });
  const L = t.journal as unknown as JournalLabels;
  return (
    <div className="container-x max-w-[980px] py-10">
      <Link href={`/${locale}/account`} className="text-[14px] font-semibold no-underline">← {t.nav.account}</Link>
      <h1 className="mt-3 mb-1 font-serif text-[clamp(26px,6vw,38px)] font-bold text-navy-900">{t.journal.title}</h1>
      <p className="mt-0 mb-6 text-muted">{t.journal.intro}</p>
      {pending.map((a) => (
        <section key={a.id} className="card mb-6 min-w-0 p-5 sm:p-7">
          <h2 className="m-0 mb-2 text-[19px] font-semibold text-navy-900 [overflow-wrap:anywhere]">{a.course.code} · {tr(a.course.title, locale)}</h2>
          <p className="m-0 text-[14.5px] text-muted">{t.journal.pending}</p>
        </section>
      ))}
      {apps.length === 0 ? (pending.length ? null : <div className="card p-6 text-muted">{t.journal.empty}</div>) : (
        <div className="flex flex-col gap-6">
          {apps.map((a) => (
            <section key={a.id} className="card min-w-0 p-5 sm:p-7">
              <h2 className="m-0 mb-4 text-[19px] font-semibold text-navy-900 [overflow-wrap:anywhere]">{a.course.code} · {tr(a.course.title, locale)}</h2>
              <JournalView j={data.get(a.id)!} L={L} dateFmt={dateShort} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
