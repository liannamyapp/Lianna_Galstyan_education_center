import { desc } from "drizzle-orm";
import { db, s } from "@/db";
import { dateShort } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHead } from "@/components/admin/fields";
import { replyMessage, toggleMessage } from "../actions";

export default async function Messages() {
  const list = await db.select().from(s.messages).orderBy(desc(s.messages.createdAt)).limit(200);
  return (
    <>
      <PageHead title="Հաղորդագրություններ" />
      <p className="-mt-3 mb-5 text-[14px] text-muted">Կայքի «Կապ» բաժնից ստացված նամակներ։ Գրողը ավտոմատ ստանում է հաստատման նամակ, իսկ ձեր պատասխանը ուղարկվում է նրա էլ. փոստին։</p>
      <div className="flex flex-col gap-3">
        {list.map((m) => (
          <article key={m.id} className={`card p-5 ${m.handled ? "opacity-75" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><b>{m.name}</b> <span className="text-[13px] text-muted">· <a href={`mailto:${m.email}`}>{m.email}</a>{m.phone ? ` · ${m.phone}` : ""} · {dateShort(m.createdAt)} · {m.locale.toUpperCase()}</span></div>
              <form action={toggleMessage}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="handled" value={m.handled ? "0" : "1"} /><button className="text-[13px] font-semibold text-navy-800">{m.handled ? "Նշել չմշակված" : "Նշել մշակված"}</button></form>
            </div>
            <p className="mt-3 mb-0 whitespace-pre-line">{m.message}</p>
            {m.reply ? (
              <div className="mt-4 rounded-xl bg-[#eef7f0] p-4 text-[14px]"><b className="text-[#1f5f33]">Ձեր պատասխանը · {dateShort(m.repliedAt)}</b><p className="mt-1.5 mb-0 whitespace-pre-line">{m.reply}</p></div>
            ) : (
              <ActionForm action={replyMessage} className="mt-4 flex flex-col gap-3">
                <input type="hidden" name="id" value={m.id} />
                <label className="label">Պատասխան (կուղարկվի {m.email} հասցեին)<textarea name="reply" required rows={4} className="input py-2.5 font-normal" /></label>
                <SubmitButton className="btn-navy self-start" pendingText="Ուղարկվում է…">Ուղարկել պատասխանը</SubmitButton>
              </ActionForm>
            )}
          </article>
        ))}
        {list.length === 0 && <p className="card p-6 text-muted">Հաղորդագրություններ դեռ չկան։</p>}
      </div>
    </>
  );
}
