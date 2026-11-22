import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db, s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getDict, fmt, tr, type Locale } from "@/lib/i18n";
import { date } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { contractTemplate, contractValues, fillContract, providerParty } from "@/lib/contract";
import { esc } from "@/lib/escape";
import { ContractDocument } from "@/components/ContractDocument";
import { SignForm } from "./SignForm";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

export default async function ContractView({ params, searchParams }: {
  params: Promise<{ locale: Locale; id: string }>;
  searchParams: Promise<{ method?: string }>;
}) {
  const { locale, id } = await params;
  const { method = "" } = await searchParams;
  const d = getDict(locale);
  const t = d.contract as Record<string, string>;
  const user = await requireUser(locale);
  const admin = user.role === "ADMIN";
  const app = await db.query.applications.findFirst({
    where: admin ? eq(s.applications.id, id) : and(eq(s.applications.id, id), eq(s.applications.userId, user.id)),
    with: { course: true, group: true, user: true },
  });
  if (!app) notFound();
  const st = await getSettings();
  const snap = app.contractSnapshot;

  let markdown: string, no: string, dateText: string, client: { name: string; lines: string[] };
  if (snap) {
    markdown = snap.body[locale] || snap.body[snap.signedLocale];
    no = snap.no;
    dateText = esc(date(snap.signedAt, locale));
    const born = snap.birthDate ? fmt(t.born, { date: date(snap.birthDate, locale) }) : "";
    const g = snap.guardian;
    client = g
      ? { name: esc(snap.signedName), lines: [esc(fmt(t.clientGuardian, { relation: g.relation === "parent" ? t.relParent : t.relGuardian })), esc(`${t.learner}: ${snap.client.name}${born ? `, ${born}` : ""}`), esc([g.phone, g.email].filter(Boolean).join(" · "))] }
      : { name: esc(snap.client.name), lines: [esc([snap.client.email, snap.client.phone].filter(Boolean).join(" · ")), ...(born ? [esc(born)] : [])] };
  } else {
    const tpl = await contractTemplate();
    markdown = fillContract(tpl[locale], contractValues(app, app.course, app.group?.startDate, locale), locale);
    no = app.contractNo ?? t.noOnSign;
    dateText = esc(date(new Date(), locale));
    client = { name: esc(app.user.name), lines: [esc([app.user.email, app.user.phone].filter(Boolean).join(" · "))] };
  }
  const payNext = ["card", "idram"].includes(method);

  return (
    <article className="container-x max-w-[900px] pt-10 print:max-w-none print:pt-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={admin ? "/admin/applications" : `/${locale}/account#documents`} className="text-[14.5px] font-semibold">← {admin ? t.adminView : d.nav.account}</Link>
        {snap && <PrintButton />}
      </div>
      {snap && (
        <p className="mb-5 rounded-2xl border border-[#cfe5d4] bg-[#eef7f0] px-5 py-3.5 text-[14.5px] text-[#1f5f33] print:hidden">
          ✓ {fmt(t.signedBanner, { date: date(snap.signedAt, locale) })}
        </p>
      )}

      <ContractDocument
        locale={locale} labels={t} tagline={tr(st.site.tagline, locale)} no={no} dateText={dateText} sample={false}
        provider={providerParty(st, locale, t)} client={client}
        bodyHtml={renderMarkdown(markdown)}
        signed={snap ? { at: snap.signedAt, name: snap.signedName } : null}
      />

      {!snap && app.userId !== user.id && (
        <p className="mt-6 rounded-2xl border border-[#e3d3a8] bg-[#fbf7ec] px-5 py-4 text-[14.5px] text-[#5b4a22] print:hidden">{t.waitingLearner}</p>
      )}
      {/* the learner signs here — also when the learner's account is an admin account (e.g. the owner testing the flow) */}
      {!snap && app.userId === user.id && (
        <SignForm locale={locale} appId={app.id} method={payNext ? method : ""} learnerName={app.user.name} birthDate={app.user.birthDate ?? ""} t={t} />
      )}
    </article>
  );
}
