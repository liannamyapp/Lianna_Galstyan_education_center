import { desc, ilike, or, sql, eq } from "drizzle-orm";
import { db, s } from "@/db";
import { dateShort } from "@/lib/format";
import { PageHead, th, td } from "@/components/admin/fields";
import { clearMyTestData, deleteUsers, setUserBlocked, setUserRole } from "../actions";
import { ValueButton } from "@/components/ValueButton";
import { SelectAll } from "@/components/admin/SelectAll";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/auth";

export default async function Students({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const me = await requireAdmin();
  const where = q ? or(ilike(s.users.name, `%${q}%`), ilike(s.users.email, `%${q}%`), ilike(s.users.phone, `%${q}%`)) : undefined;
  const users = await db.select({
    id: s.users.id, name: s.users.name, email: s.users.email, phone: s.users.phone, role: s.users.role, createdAt: s.users.createdAt, blockedAt: s.users.blockedAt,
    apps: sql<number>`(select count(*)::int from ${s.applications} where ${s.applications.userId} = ${s.users.id})`,
  }).from(s.users).where(where).orderBy(desc(s.users.createdAt)).limit(300);
  void eq;
  return (
    <>
      <PageHead title={`Ունկնդիրներ (${users.length})`}>
        <form className="flex w-full flex-wrap gap-2 sm:w-auto"><label htmlFor="q" className="sr-only">Որոնում</label><input id="q" name="q" defaultValue={q} placeholder="Անուն, էլ. փոստ, հեռախոս" className="input min-h-11 min-w-0 flex-1 sm:w-[260px] sm:flex-none" /><button className="btn-navy min-h-11">Որոնել</button></form>
      </PageHead>
      <ActionForm id="bulk" action={deleteUsers} className="card mb-4 flex flex-col gap-3 border-[#f0cfc6] p-4">
        <p className="m-0 text-[14px] text-muted">Ջնջելու համար նշեք ունկնդիրներին նրանց անվան կողքի վանդակով։ Կջնջվեն նաև նրանց հայտերը, վճարումները, կարծիքները և CRM-ի քարտերը։ Գործողությունը հետ չի վերադարձվում։ Ադմինի հաշիվները չեն ջնջվում։</p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex min-h-10 items-center gap-2 text-[14px]"><SelectAll form="bulk" label="Նշել բոլորին" /> Նշել բոլորին</label>
          <label className="flex min-h-10 items-center gap-2 text-[14px]"><input type="checkbox" name="confirm" value="1" className="size-4" /> Հաստատում եմ</label>
          <button className="btn min-h-10 bg-[#8a2f1d] text-white">Ջնջել նշվածներին</button>
        </div>
      </ActionForm>
      <div className="card overflow-x-auto p-2">
        <table className="rtable w-full min-w-[880px] border-collapse">
          <thead><tr><th className={th}>Անուն</th><th className={th}>Կոնտակտ</th><th className={th}>Հայտեր</th><th className={th}>Գրանցվել է</th><th className={th}>Մուտք</th><th className={th}>Դեր</th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}>
              <td data-label="" className={td}><span className="flex items-center gap-2.5">{u.role === "STUDENT" ? <input type="checkbox" name="ids" value={u.id} form="bulk" aria-label={`Ընտրել ${u.name}`} className="size-4 flex-none" /> : null}<b>{u.name}</b></span>{u.id === me.id && <span className="ml-1 text-[12px] text-muted">(դուք)</span>}
                {u.role === "STUDENT" ? (
                  <details className="group relative">
                    <summary className="flex mt-1 min-h-8 w-fit cursor-pointer list-none items-center rounded-lg px-0 text-[13px] font-semibold text-[#8a2f1d] hover:bg-[#fbefeb] [&::-webkit-details-marker]:hidden">Հեռացնել</summary>
                    <ActionForm action={deleteUsers} className="mt-1.5 flex w-[230px] flex-col gap-2.5 rounded-xl border border-[#f0cfc6] bg-[#fffaf8] p-3">
                      <input type="hidden" name="ids" value={u.id} />
                      <input type="hidden" name="confirm" value="1" />
                      <p className="m-0 text-[13px] whitespace-normal text-[#3d4757]">Հեռացնե՞լ <b>{u.name}</b>-ին բոլոր հայտերով, վճարումներով և կարծիքներով։ Գործողությունը հետ չի վերադարձվում։</p>
                      <button className="btn min-h-9 bg-[#8a2f1d] text-[13px] text-white">Այո, հեռացնել</button>
                    </ActionForm>
                  </details>
                ) : null}
              </td>
              <td data-label="Կոնտակտ" className={td}><a href={`mailto:${u.email}`}>{u.email}</a><br /><span className="text-muted">{u.phone ?? "—"}</span></td>
              <td data-label="Հայտեր" className={td}>{u.apps}</td>
              <td data-label="Գրանցվել է" className={td}>{dateShort(u.createdAt)}</td>
              <td data-label="Մուտք" className={td}>
                {u.role === "STUDENT" ? (
                  <form action={setUserBlocked} className="flex flex-col items-start gap-1.5">
                    <input type="hidden" name="id" value={u.id} />
                    {u.blockedAt
                      ? <><span className="chip bg-[#fbefeb] font-semibold text-[#8a2f1d]">Արգելափակված է {dateShort(u.blockedAt)}</span><ValueButton name="block" value="0" className="text-[13px] font-semibold text-[#1f5f33]">Արգելաբացել</ValueButton></>
                      : <><span className="chip bg-[#e3f1e6] font-semibold text-[#1f5f33]">Ակտիվ</span><ValueButton name="block" value="1" className="text-[13px] font-semibold text-[#8a2f1d]">Արգելափակել</ValueButton></>}
                  </form>
                ) : <span className="text-[13px] text-muted">—</span>}
              </td>
              <td data-label="Դեր" className={td}>
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
