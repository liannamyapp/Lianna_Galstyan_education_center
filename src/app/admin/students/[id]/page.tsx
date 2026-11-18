import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { money, dateShort } from "@/lib/format";
import { tr } from "@/lib/i18n";
import { billing } from "@/lib/billing";
import { getSettings } from "@/lib/settings";
import { ageOn } from "@/lib/age";
import { badge, statusHy, th, td } from "@/components/admin/fields";
import { ActionForm } from "@/components/ActionForm";
import { ValueButton } from "@/components/ValueButton";
import { CertDocs } from "@/components/CertDocs";
import { Icon } from "@/components/Icon";
import { JournalView, type JournalLabels } from "@/components/JournalView";
import { journalApps, loadJournal } from "@/lib/journal";
import { getDict } from "@/lib/i18n";
import { deleteUsers, setUserBlocked } from "../../actions";

export const dynamic = "force-dynamic";

const payHy: Record<string, string> = { PAID: "Հաստատված", PENDING: "Սպասում է", FAILED: "Մերժված", REFUNDED: "Վերադարձված" };
const methodHy: Record<string, string> = { CARD: "Քարտ", IDRAM: "Idram", CASH: "Կանխիկ", TEST: "Փորձնական" };
const reviewHy: Record<string, string> = { APPROVED: "Հրապարակված", PENDING: "Սպասում է", REJECTED: "Մերժված" };
const reviewTone: Record<string, string> = { APPROVED: badge.PAID, PENDING: badge.PENDING, REJECTED: badge.REJECTED };
const certLabels = { hy: "Վկայական՝ հայերեն", en: "Վկայական՝ անգլերեն", insert: "Ներդիր", scan: "Սկանավորված օրինակ", open: "Բացել / տպել", download: "Ներբեռնել PDF" };

/** Everything about one student on one page — what they see in their account, plus admin actions. */
export default async function StudentCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireAdmin();
  const user = await db.query.users.findFirst({ where: eq(s.users.id, id) });
  if (!user) notFound();
  const st = await getSettings();
  const apps = await db.query.applications.findMany({ where: eq(s.applications.userId, id), orderBy: [desc(s.applications.createdAt)], with: { course: true, group: true } });
  const pays = await db.select().from(s.payments).where(eq(s.payments.userId, id)).orderBy(desc(s.payments.createdAt));
  const certs = await db.query.certificates.findMany({ where: eq(s.certificates.userId, id), with: { course: true }, orderBy: [desc(s.certificates.issuedAt)] });
  const reviews = await db.select().from(s.reviews).where(eq(s.reviews.userId, id)).orderBy(desc(s.reviews.createdAt));
  const jApps = await journalApps(eq(s.applications.userId, id));
  const journal = await loadJournal(jApps);
  const JL = getDict("hy").journal as unknown as JournalLabels;
  const student = user.role === "STUDENT";
  const birth = user.birthDate ? new Date(user.birthDate) : null;
  const age = user.birthDate ? ageOn(user.birthDate) : null;
  const card = "card min-w-0 p-5 sm:p-6";
  const h2 = "mb-3 text-[18px] font-semibold text-navy-900";

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Link href="/admin/students" className="w-fit text-[14px] font-semibold no-underline">← Բոլոր ունկնդիրները</Link>

      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="m-0 font-serif text-[clamp(22px,6vw,28px)] font-bold break-words text-navy-900">{user.name}</h1>
            <p className="mt-1 mb-0 text-[14px] [overflow-wrap:anywhere]"><a href={`mailto:${user.email}`}>{user.email}</a>{user.phone ? <> · <a href={`tel:${user.phone}`}>{user.phone}</a></> : null}</p>
            <p className="mt-1 mb-0 text-[13.5px] text-muted">
              Գրանցվել է {dateShort(user.createdAt)}
              {birth ? <> · Ծնվել է {dateShort(birth)}{age !== null ? ` (${age} տ.)` : ""}</> : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`chip font-semibold ${student ? "" : "bg-[#e6eef8] text-navy-800"}`}>{student ? "Ունկնդիր" : "Ադմին"}</span>
            {student && (user.blockedAt
              ? <span className="chip bg-[#fbefeb] font-semibold text-[#8a2f1d]">Արգելափակված է {dateShort(user.blockedAt)}</span>
              : <span className="chip bg-[#e3f1e6] font-semibold text-[#1f5f33]">Ակտիվ</span>)}
          </div>
        </div>
        {student && user.id !== me.id && (
          <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-[#eee7d8] pt-4">
            <form action={setUserBlocked}>
              <input type="hidden" name="id" value={user.id} />
              {user.blockedAt
                ? <ValueButton name="block" value="0" className="btn-soft min-h-10 text-[13.5px] text-[#1f5f33]">Արգելաբացել</ValueButton>
                : <ValueButton name="block" value="1" className="btn-soft min-h-10 text-[13.5px] text-[#8a2f1d]">Արգելափակել</ValueButton>}
            </form>
            <details className="min-w-0">
              <summary className="btn-soft min-h-10 cursor-pointer list-none text-[13.5px] text-[#8a2f1d] [&::-webkit-details-marker]:hidden">Հեռացնել ունկնդրին</summary>
              <ActionForm action={deleteUsers} className="mt-2 flex max-w-[340px] flex-col gap-2.5 rounded-xl border border-[#f0cfc6] bg-[#fffaf8] p-3">
                <input type="hidden" name="ids" value={user.id} /><input type="hidden" name="confirm" value="1" /><input type="hidden" name="back" value="1" />
                <p className="m-0 text-[13px] text-[#3d4757]">Կջնջվեն հաշիվը, հայտերը, վճարումները և կարծիքները։{certs.length ? ` Տրված ${certs.length} վկայականը կմնա ռեեստրում իր համարով, համարակալումը չի խախտվի։` : ""} Գործողությունը հետ չի վերադարձվում։</p>
                <button className="btn min-h-9 bg-[#8a2f1d] text-[13px] text-white">Այո, հեռացնել</button>
              </ActionForm>
            </details>
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className={h2}>Դասընթացներ</h2>
        {apps.length === 0 ? <p className="m-0 text-muted">Հայտեր չկան։</p> : (
          <div className="flex flex-col gap-3">{apps.map((a) => {
            const b = billing(a, a.course, a.group?.startDate, pays.filter((p) => p.applicationId === a.id), st.payments);
            const total = a.course.weeks * a.course.lessonsPerWeek;
            return (
              <div key={a.id} className="rounded-xl border border-[#eee7d8] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="min-w-0 text-[15px] text-navy-900">{a.course.code} · {tr(a.course.title, "hy")}</b>
                  <span className={`chip font-semibold ${badge[a.status] ?? ""}`}>{statusHy[a.status] ?? a.status}</span>
                </div>
                <p className="mt-1.5 mb-0 text-[13.5px] text-muted">
                  {a.format === "individual" ? "Անհատական" : "Խմբային"}
                  {a.group ? ` · Խումբ՝ ${dateShort(a.group.startDate)}` : a.startDate ? ` · Սկիզբ՝ ${dateShort(a.startDate)}` : ""}
                  {a.status === "PAID" ? ` · Դասեր՝ ${a.lessonsDone}/${total}` : ""}
                </p>
                {(a.status === "PAID" || a.status === "APPROVED") && (
                  <p className="mt-1 mb-0 text-[13.5px]">
                    Վճարված՝ <b>{money(b.paidTotal, "hy")}</b>
                    {b.next ? <> · Հաջորդ վճարում՝ <b>{money(b.next.amount, "hy")}</b>{b.next.due ? ` (${dateShort(b.next.due)})` : ""}{b.locked ? <span className="chip ml-2 bg-[#fbefeb] text-[12px] text-[#8a2f1d]">ուշացած</span> : null}</> : <span className="ml-1 text-[#1f5f33]">· ամբողջությամբ վճարված</span>}
                  </p>
                )}
              </div>
            );
          })}</div>
        )}
      </section>

      {jApps.length > 0 && (
        <section className={card}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className={`${h2} m-0`}>Էլեկտրոնային մատյան</h2>
            <Link href="/admin/journal" className="text-[13.5px] font-semibold">Նշել հաճախումներ / գնահատականներ →</Link>
          </div>
          <div className="flex flex-col gap-6">{jApps.map((a) => (
            <div key={a.id} className="min-w-0">
              {jApps.length > 1 && <p className="m-0 mb-3 font-semibold text-navy-900">{a.course.code} · {tr(a.course.title, "hy")}</p>}
              <JournalView j={journal.get(a.id)!} L={JL} dateFmt={dateShort} />
            </div>
          ))}</div>
        </section>
      )}

      <section className={card}>
        <h2 className={h2}>Փաստաթղթեր</h2>
        <ul className="m-0 list-none p-0">
          {apps.filter((a) => a.contractNo || a.contractSignedAt).map((a) => {
            const g = a.contractSnapshot?.guardian;
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-3 border-b border-[#eee7d8] py-3 last:border-0">
                <span className={`flex size-10 flex-none items-center justify-center rounded-xl text-[11px] font-bold ${a.contractSignedAt ? "bg-[#e3f1e6] text-[#1f5f33]" : "bg-sand text-[#8a5a2b]"}`}>{a.contractSignedAt ? "✓" : "…"}</span>
                <span className="min-w-0 flex-1 basis-[200px]">
                  <b className="text-[14.5px] text-navy-900">Պայմանագիր № {a.contractNo ?? "—"}</b><br />
                  <span className="text-[13px] text-muted">{a.course.code} · {a.contractSignedAt ? `կնքված է ${dateShort(a.contractSignedAt)}` : "դեռ կնքված չէ"}{g ? ` · ներկայացուցիչ՝ ${g.name}` : ""}</span>
                </span>
                <a href={`/hy/account/contract/${a.id}`} target="_blank" rel="noopener" className="btn-soft min-h-10 px-3.5 text-[13.5px]">Բացել / տպել</a>
              </li>
            );
          })}
          {certs.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 border-b border-[#eee7d8] py-3 last:border-0">
              <span className={`flex size-10 flex-none items-center justify-center rounded-xl ${c.revoked ? "bg-[#fbefeb] text-[#8a2f1d]" : "bg-[#e3f1e6] text-[#1f5f33]"}`}><Icon name="shield" size={18} /></span>
              <span className="min-w-0 flex-1 basis-[200px]">
                <b className="text-[14.5px] text-navy-900">Վկայական № {c.number}</b><br />
                <span className="text-[13px] text-muted">{c.course.code} · տրվել է {dateShort(c.issuedAt)}{c.revoked ? " · չեղարկված" : ""}</span>
              </span>
              <Link href="/admin/certificates" className="text-[13.5px] font-semibold">Խմբագրել</Link>
              <CertDocs base={`/hy/account/certificate/${c.id}`} fileUrl={c.fileUrl} labels={certLabels} />
            </li>
          ))}
          {!certs.length && !apps.some((a) => a.contractNo || a.contractSignedAt) && <li className="py-2 text-muted">Փաստաթղթեր դեռ չկան։</li>}
        </ul>
      </section>

      <section className={card}>
        <h2 className={h2}>Վճարումներ</h2>
        {pays.length === 0 ? <p className="m-0 text-muted">Վճարումներ չկան։</p> : (
          <table className="rtable w-full border-collapse">
            <thead><tr><th className={th}>Ամսաթիվ</th><th className={th}>Նկարագրություն</th><th className={th}>Եղանակ</th><th className={th}>Գումար</th><th className={th}>Կարգավիճակ</th></tr></thead>
            <tbody>{pays.map((p) => (
              <tr key={p.id}>
                <td data-label="Ամսաթիվ" className={td}>{dateShort(p.paidAt ?? p.createdAt)}</td>
                <td data-label="Նկարագրություն" className={td}>{p.description}</td>
                <td data-label="Եղանակ" className={td}>{methodHy[p.method] ?? p.method}</td>
                <td data-label="Գումար" className={`${td} whitespace-nowrap`}>{money(p.amount, "hy")}</td>
                <td data-label="Կարգավիճակ" className={td}><span className={`chip font-semibold ${badge[p.status] ?? ""}`}>{payHy[p.status] ?? p.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <section className={card}>
        <h2 className={h2}>Կարծիքներ</h2>
        {reviews.length === 0 ? <p className="m-0 text-muted">Կարծիքներ չկան։</p> : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">{reviews.map((r) => (
            <li key={r.id} className="rounded-xl bg-ivory px-4 py-3 text-[14px]">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-gold-700">{"★".repeat(r.rating)}</span><span className={`chip font-semibold ${reviewTone[r.status] ?? ""}`}>{reviewHy[r.status] ?? r.status}</span></div>
              <p className="mt-1.5 mb-0 [overflow-wrap:anywhere]">{r.text}</p>
              {r.reply && <p className="mt-2 mb-0 border-l-2 border-gold-500 pl-3 text-[13.5px] text-muted [overflow-wrap:anywhere]">{r.reply}</p>}
            </li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
