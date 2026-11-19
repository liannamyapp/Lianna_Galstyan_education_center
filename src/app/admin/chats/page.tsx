import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db, s } from "@/db";
import { PageHead } from "@/components/admin/fields";
import { LiveRefresh } from "@/components/LiveRefresh";

export const dynamic = "force-dynamic";

const when = (d: Date) => new Intl.DateTimeFormat("hy-AM", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Yerevan" }).format(d);

export default async function Chats({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const closed = show === "closed";
  const last = db.select({ threadId: s.chatMessages.threadId, body: s.chatMessages.body, sender: s.chatMessages.sender,
    rn: sql<number>`row_number() over (partition by ${s.chatMessages.threadId} order by ${s.chatMessages.createdAt} desc)`.as("rn") }).from(s.chatMessages).as("last");
  const rows = await db.select({ t: s.chatThreads, body: last.body, sender: last.sender })
    .from(s.chatThreads)
    .leftJoin(last, sql`${last.threadId} = ${s.chatThreads.id} and ${last.rn} = 1`)
    .where(sql`${s.chatThreads.status} = ${closed ? "closed" : "open"}`)
    .orderBy(desc(s.chatThreads.adminUnread), desc(s.chatThreads.lastMessageAt)).limit(200);
  return (
    <>
      <LiveRefresh poll every={15000} />
      <PageHead title="Չատեր" />
      <p className="-mt-3 mb-4 text-[14px] text-muted">Կայքի «Գրեք մեզ» չատի զրույցները։ Նոր հաղորդագրության մասին նամակ է գալիս կարգավորումներում նշված էլ. փոստին։ Եթե այցելուն արդեն լքել է կայքը և թողել է էլ. փոստ, Ձեր պատասխանը կուղարկվի նաև նամակով։</p>
      <div className="mb-4 flex gap-2">
        <Link href="/admin/chats" className={`btn min-h-10 px-4 text-[14px] no-underline ${closed ? "btn-soft" : "btn-navy"}`}>Բաց</Link>
        <Link href="/admin/chats?show=closed" className={`btn min-h-10 px-4 text-[14px] no-underline ${closed ? "btn-navy" : "btn-soft"}`}>Փակված</Link>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map(({ t, body, sender }) => (
          <Link key={t.id} href={`/admin/chats/${t.id}`} className={`card flex items-start gap-4 p-4 no-underline hover:border-navy-800 ${t.adminUnread ? "border-gold-500" : ""}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <b className="text-navy-900">{t.name || t.email || "Անանուն այցելու"}</b>
                {t.email && t.name && <span className="text-[13px] text-muted">{t.email}</span>}
                <span className="text-[12.5px] text-muted">· {t.locale.toUpperCase()} · {when(t.lastMessageAt)}</span>
              </div>
              <p className="m-0 mt-1 truncate text-[14px] text-[#3d4757]">{sender === "admin" ? "Դուք՝ " : ""}{body ?? ""}</p>
            </div>
            {t.adminUnread > 0 && <span className="flex min-w-7 items-center justify-center rounded-full bg-[#c2412d] px-2 py-0.5 text-[12.5px] font-bold text-white">{t.adminUnread}</span>}
          </Link>
        ))}
        {rows.length === 0 && <p className="card p-6 text-muted">{closed ? "Փակված զրույցներ չկան։" : "Բաց զրույցներ դեռ չկան։"}</p>}
      </div>
    </>
  );
}
