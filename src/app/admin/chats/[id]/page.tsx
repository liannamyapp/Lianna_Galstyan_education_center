import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, s } from "@/db";
import { PageHead } from "@/components/admin/fields";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { LiveRefresh } from "@/components/LiveRefresh";
import { deleteChat, replyChat, setChatStatus } from "../actions";

export const dynamic = "force-dynamic";

const when = (d: Date) => new Intl.DateTimeFormat("hy-AM", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Yerevan" }).format(d);

export default async function ChatThread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t] = await db.select().from(s.chatThreads).where(eq(s.chatThreads.id, id)).limit(1);
  if (!t) notFound();
  const msgs = await db.select().from(s.chatMessages).where(eq(s.chatMessages.threadId, id)).orderBy(asc(s.chatMessages.createdAt));
  if (t.adminUnread) await db.update(s.chatThreads).set({ adminUnread: 0 }).where(eq(s.chatThreads.id, id));
  const online = Date.now() - t.visitorSeenAt.getTime() < 90_000;
  return (
    <>
      <LiveRefresh poll every={5000} />
      <Link href="/admin/chats" className="mb-3 inline-block text-[14px] text-navy-800">← Բոլոր չատերը</Link>
      <PageHead title={t.name || t.email || "Անանուն այցելու"} />
      <div className="-mt-3 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted">
        <span className={online ? "font-semibold text-[#1f7a3d]" : ""}>{online ? "● Կայքում է" : `Վերջին անգամ կայքում՝ ${when(t.visitorSeenAt)}`}</span>
        {t.email && <a href={`mailto:${t.email}`}>{t.email}</a>}
        <span>{t.locale.toUpperCase()}</span>
        {t.page && <span>Էջ՝ {t.page}</span>}
        {t.leadId && <Link href={`/admin/crm/leads/${t.leadId}`}>CRM քարտ →</Link>}
      </div>

      <section className="card mb-4 flex flex-col gap-2.5 p-4 sm:p-5">
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-relaxed whitespace-pre-line ${m.sender === "admin" ? "rounded-br-md bg-navy-800 text-white" : "rounded-bl-md border border-line bg-[#faf8f3]"}`}>
              {m.body}
              <span className={`mt-1 block text-[11.5px] ${m.sender === "admin" ? "text-[#c9d2e3]" : "text-muted"}`}>{m.sender === "admin" ? "Դուք · " : ""}{when(m.createdAt)}</span>
            </div>
          </div>
        ))}
        {msgs.length === 0 && <p className="m-0 text-muted">Հաղորդագրություններ չկան։</p>}
      </section>

      <ActionForm action={replyChat} resetOnSuccess className="card mb-4 flex flex-col gap-3 p-4 sm:p-5">
        <input type="hidden" name="id" value={t.id} />
        <label className="label">Պատասխան
          <textarea name="body" required rows={3} maxLength={2000} className="input py-2.5 font-normal" />
        </label>
        <p className="m-0 text-[12.5px] text-muted">{t.email ? `Եթե այցելուն կայքում չլինի, պատասխանը կուղարկվի նաև ${t.email} հասցեին։` : "Այցելուն էլ. փոստ չի թողել․ պատասխանը կտեսնի, երբ նորից բացի կայքի չատը։"}</p>
        <SubmitButton className="btn-navy self-start" pendingText="Ուղարկվում է…">Ուղարկել</SubmitButton>
      </ActionForm>

      <div className="flex flex-wrap items-center gap-3">
        <form action={setChatStatus}>
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="status" value={t.status === "open" ? "closed" : "open"} />
          <button className="btn-soft min-h-10 px-4 text-[14px]">{t.status === "open" ? "Փակել զրույցը" : "Նորից բացել"}</button>
        </form>
        <form action={deleteChat} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={t.id} />
          <label className="flex items-center gap-2 text-[13px] text-muted"><input type="checkbox" required className="size-4 accent-[#8a2f1d]" />Հաստատում եմ ջնջումը</label>
          <button className="btn min-h-10 px-4 text-[14px] text-[#8a2f1d] ring-1 ring-[#f0cfc6]">Ջնջել զրույցը</button>
        </form>
      </div>
    </>
  );
}
