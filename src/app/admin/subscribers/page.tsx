import { desc } from "drizzle-orm";
import { db, s } from "@/db";
import { dateShort } from "@/lib/format";
import { PageHead, th, td } from "@/components/admin/fields";
import { deleteSubscriber } from "../actions";

export default async function Subscribers() {
  const list = await db.select().from(s.subscribers).orderBy(desc(s.subscribers.createdAt));
  return (
    <>
      <PageHead title={`Բաժանորդներ (${list.length})`}><a href="/admin/subscribers/csv" className="btn-soft min-h-11">Ներբեռնել CSV</a></PageHead>
      <div className="card overflow-x-auto p-2">
        <table className="rtable w-full min-w-[480px] border-collapse">
          <thead><tr><th className={th}>Էլ. փոստ</th><th className={th}>Լեզու</th><th className={th}>Ամսաթիվ</th><th className={th}></th></tr></thead>
          <tbody>{list.map((x) => (
            <tr key={x.id}><td data-label="Էլ. փոստ" className={td}>{x.email}</td><td data-label="Լեզու" className={td}>{x.locale.toUpperCase()}</td><td data-label="Ամսաթիվ" className={td}>{dateShort(x.createdAt)}</td>
              <td data-label="" className={td}><form action={deleteSubscriber}><input type="hidden" name="id" value={x.id} /><button className="text-[13px] text-[#8a2f1d]">Ջնջել</button></form></td></tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
