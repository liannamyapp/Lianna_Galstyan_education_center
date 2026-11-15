import { desc, ilike, or, sql, eq } from "drizzle-orm";
import { db, s } from "@/db";
import { dateShort } from "@/lib/format";
import { PageHead, th, td } from "@/components/admin/fields";
import { clearMyTestData, deleteUsers, setUserRole } from "../actions";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/auth";

export default async function Students({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const me = await requireAdmin();
  const where = q ? or(ilike(s.users.name, `%${q}%`), ilike(s.users.email, `%${q}%`), ilike(s.users.phone, `%${q}%`)) : undefined;
  const users = await db.select({
    id: s.users.id, name: s.users.name, email: s.users.email, phone: s.users.phone, role: s.users.role, createdAt: s.users.createdAt,
    apps: sql<number>`(select count(*)::int from ${s.applications} where ${s.applications.userId} = ${s.users.id})`,
  }).from(s.users).where(where).orderBy(desc(s.users.createdAt)).limit(300);
  void eq;
  return (
    <>
      <PageHead title={`Ունկնդիրներ (${users.length})`}>
        <form className="flex w-full flex-wrap gap-2 sm:w-auto"><label htmlFor="q" className="sr-only">Որոնում</label><input id="q" name="q" defaultValue={q} placeholder="Անուն, էլ. փոստ, հեռախոս" className="input min-h-11 min-w-0 flex-1 sm:w-[260px] sm:flex-none" /><button className="btn-navy min-h-11">Որոնել</button></form>
      </PageHead>
      <ActionForm id="bulk" action={deleteUsers} className="card mb-4 flex flex-col gap-3 border-[#f0cfc6] p-4">
        <p className="m-0 text-[14px] text-muted">Ջնջելու համար նշեք ունկնդիրներին աղյուսակի ձախ սյունակում։ Կջնջվեն նաև նրանց հայտերը, վճարումները, կարծիքները և CRM-ի քարտերը։ Գործողությունը հետ չի վերադարձվում։ Ադմինի հաշիվները չեն ջնջվում։</p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex min-h-10 items-center gap-2 text-[14px]"><input type="checkbox" name="confirm" value="1" className="size-4" /> Հաստատում եմ</label>
          <button className="btn min-h-10 bg-[#8a2f1d] text-white">Ջնջել նշվածներին</button>
        </div>
      </ActionForm>
      <div className="card overflow-x-auto p-2">
        <table className="w-full min-w-[720px] border-collapse">
          <thead><tr><th className={th}><span className="sr-only">Ընտրել</span></th><th className={th}>Անուն</th><th className={th}>Կոնտակտ</th><th className={th}>Հայտեր</th><th className={th}>Գրանցվել է</th><th className={th}>Դեր</th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}>
              <td className={td}>{u.role === "STUDENT" ? <input type="checkbox" name="ids" value={u.id} form="bulk" aria-label={`Ընտրել ${u.name}`} className="size-4" /> : null}</td>
              <td className={td}><b>{u.name}</b>{u.id === me.id && <span className="ml-1 text-[12px] text-muted">(դուք)</span>}</td>
              <td className={td}><a href={`mailto:${u.email}`}>{u.email}</a><br /><span className="text-muted">{u.phone ?? "—"}</span></td>
              <td className={td}>{u.apps}</td>
              <td className={td}>{dateShort(u.createdAt)}</td>
              <td className={td}>
                <form action={setUserRole} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <select name="role" defaultValue={u.role} className="input min-h-9 w-auto py-0 text-[13px]"><option value="STUDENT">Ունկնդիր</option><option value="ADMIN">Ադմին</option></select>
                  <button className="text-[13px] font-semibold text-navy-800">OK</button>
                </form>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <ActionForm action={clearMyTestData} className="card mt-4 flex flex-col gap-3 p-4">
        <p className="m-0 text-[14px]"><b>Ձեր (ադմինի) փորձնական տվյալները.</b> <span className="text-muted">Եթե ադմինի հաշվով գրանցվել եք դասընթացի, վճարել կամ կարծիք թողել, այստեղից կարող եք դրանք ջնջել։ Ձեր հաշիվը կմնա։</span></p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex min-h-10 items-center gap-2 text-[14px]"><input type="checkbox" name="confirm" value="1" className="size-4" /> Հաստատում եմ</label>
          <button className="btn-soft min-h-10 text-[#8a2f1d]">Ջնջել իմ փորձնական տվյալները</button>
        </div>
      </ActionForm>
    </>
  );
}
