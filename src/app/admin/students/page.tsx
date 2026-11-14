import { desc, ilike, or, sql, eq } from "drizzle-orm";
import { db, s } from "@/db";
import { dateShort } from "@/lib/format";
import { PageHead, th, td } from "@/components/admin/fields";
import { setUserRole } from "../actions";

export default async function Students({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const where = q ? or(ilike(s.users.name, `%${q}%`), ilike(s.users.email, `%${q}%`), ilike(s.users.phone, `%${q}%`)) : undefined;
  const users = await db.select({
    id: s.users.id, name: s.users.name, email: s.users.email, phone: s.users.phone, role: s.users.role, createdAt: s.users.createdAt,
    apps: sql<number>`(select count(*)::int from ${s.applications} where ${s.applications.userId} = ${s.users.id})`,
  }).from(s.users).where(where).orderBy(desc(s.users.createdAt)).limit(300);
  void eq;
  return (
    <>
      <PageHead title={`Ունկնդիրներ (${users.length})`}>
        <form className="flex gap-2"><label htmlFor="q" className="sr-only">Որոնում</label><input id="q" name="q" defaultValue={q} placeholder="Անուն, էլ. փոստ, հեռախոս" className="input min-h-11 w-[260px]" /><button className="btn-navy min-h-11">Որոնել</button></form>
      </PageHead>
      <div className="card overflow-x-auto p-2">
        <table className="w-full min-w-[720px] border-collapse">
          <thead><tr><th className={th}>Անուն</th><th className={th}>Կոնտակտ</th><th className={th}>Հայտեր</th><th className={th}>Գրանցվել է</th><th className={th}>Դեր</th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}>
              <td className={td}><b>{u.name}</b></td>
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
    </>
  );
}
