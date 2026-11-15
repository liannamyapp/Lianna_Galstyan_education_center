import { desc, inArray } from "drizzle-orm";
import { db, s } from "@/db";
import { ValueButton } from "@/components/ValueButton";
import { money, dateShort } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AdminCard, PageHead, badge, th, td } from "@/components/admin/fields";
import { LiveRefresh } from "@/components/LiveRefresh";

const payStatusHy: Record<string, string> = { PENDING: "Սպասում է հաստատման", PAID: "Հաստատված", FAILED: "Մերժված", REFUNDED: "Վերադարձված" };
import { addManualPayment, setPaymentStatus } from "../actions";

export default async function Payments() {
  const list = await db.query.payments.findMany({ orderBy: [desc(s.payments.createdAt)], limit: 300, with: { user: true } });
  const apps = await db.query.applications.findMany({ where: inArray(s.applications.status, ["NEW", "INTERVIEW", "APPROVED", "PAID"]), with: { user: true, course: true } });
  const total = list.filter((p) => p.status === "PAID").reduce((n, p) => n + p.amount, 0);
  return (
    <>
      <LiveRefresh poll={list.some((p) => p.status === "PENDING")} every={30000} />
      <PageHead title="Վճարումներ"><span className="chip bg-white font-semibold">Ընդամենը վճարված՝ {money(total)}</span></PageHead>
      <AdminCard title="Ավելացնել կանխիկ / բանկային փոխանցում">
        <ActionForm action={addManualPayment} resetOnSuccess className="grid gap-3 md:grid-cols-[2fr_1fr_2fr_auto] md:items-end">
          <label className="label">Հայտ<select name="applicationId" required className="input">{apps.map((a) => <option key={a.id} value={a.id}>{a.user.name} · {a.course.code}</option>)}</select></label>
          <label className="label">Գումար (֏)<input name="amount" type="number" min={1} required className="input" /></label>
          <label className="label">Նկարագրություն<input name="description" placeholder="Օր.՝ 2-րդ ամիս, կանխիկ" className="input" /></label>
          <SubmitButton pendingText="…">Ավելացնել</SubmitButton>
        </ActionForm>
      </AdminCard>
      <div className="card mt-6 overflow-x-auto p-2">
        <table className="w-full min-w-[820px] border-collapse">
          <thead><tr><th className={th}>№</th><th className={th}>Ամսաթիվ</th><th className={th}>Ունկնդիր</th><th className={th}>Նկարագրություն</th><th className={th}>Գումար</th><th className={th}>Եղանակ</th><th className={th}>Կարգավիճակ</th><th className={th}></th></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id}>
              <td className={td}>{p.orderNo}</td><td className={td}>{dateShort(p.paidAt ?? p.createdAt)}</td>
              <td className={td}>{p.user.name}<br /><span className="text-muted">{p.user.email}</span></td>
              <td className={td}>{p.description}</td><td className={`${td} whitespace-nowrap font-semibold`}>{money(p.amount)}</td><td className={td}>{p.method}</td>
              <td className={td}><span className={`chip font-semibold ${badge[p.status]}`}>{payStatusHy[p.status]}</span></td>
              <td className={td}>
                <form action={setPaymentStatus} className="flex flex-wrap gap-x-3 gap-y-1.5">
                  <input type="hidden" name="id" value={p.id} />
                  {p.status !== "PAID" && p.status !== "REFUNDED" && <ValueButton name="status" value="PAID" className="text-[13px] font-semibold text-[#1f5f33]">Հաստատել</ValueButton>}
                  {p.status === "PENDING" && <ValueButton name="status" value="FAILED" className="text-[13px] font-semibold text-[#8a2f1d]">Մերժել</ValueButton>}
                  {p.status === "PAID" && <ValueButton name="status" value="REFUNDED" className="text-[13px] font-semibold text-[#8a2f1d]">Վերադարձ</ValueButton>}
                </form>
              </td>
            </tr>
          ))}</tbody>
        </table>
        {list.length === 0 && <p className="p-4 text-muted">Վճարումներ դեռ չկան։</p>}
      </div>
    </>
  );
}
