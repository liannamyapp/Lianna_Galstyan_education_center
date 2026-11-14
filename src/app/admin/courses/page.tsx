import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, s } from "@/db";
import { tr } from "@/lib/i18n";
import { money } from "@/lib/format";
import { PageHead, th, td } from "@/components/admin/fields";

export default async function Courses() {
  const list = await db.query.courses.findMany({ orderBy: [asc(s.courses.order)], with: { direction: true, modules: true } });
  return (
    <>
      <PageHead title="Դասընթացներ"><Link href="/admin/courses/new" className="btn-navy min-h-11">+ Նոր դասընթաց</Link></PageHead>
      <div className="card overflow-x-auto p-2">
        <table className="w-full min-w-[760px] border-collapse">
          <thead><tr><th className={th}>Կոդ</th><th className={th}>Անվանում</th><th className={th}>Ուղղություն</th><th className={th}>Ժամ / մոդուլ</th><th className={th}>Գին</th><th className={th}>Կարգավիճակ</th></tr></thead>
          <tbody>{list.map((c) => (
            <tr key={c.id}>
              <td className={`${td} font-mono`}>{c.code}</td>
              <td className={td}><Link href={`/admin/courses/${c.id}`} className="font-semibold">{tr(c.title, "hy")}</Link></td>
              <td className={td}>{tr(c.direction.title, "hy")}</td>
              <td className={td}>{c.hours} ժ · {c.modules.length}</td>
              <td className={td}>{money(c.priceMonthly)} / ամիս</td>
              <td className={td}><span className={`chip font-semibold ${c.published ? "bg-[#e3f1e6] text-[#1f5f33]" : "bg-[#eef0f3] text-[#4b5563]"}`}>{c.published ? "Հրապարակված" : "Թաքցված"}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
