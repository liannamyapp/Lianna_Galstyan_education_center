import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, s } from "@/db";
import { tr } from "@/lib/i18n";
import { dateShort } from "@/lib/format";
import { PageHead, th, td } from "@/components/admin/fields";

export default async function Posts() {
  const list = await db.select().from(s.posts).orderBy(desc(s.posts.createdAt));
  return (
    <>
      <PageHead title="Բլոգ"><Link href="/admin/posts/new" className="btn-navy min-h-11">+ Նոր հոդված</Link></PageHead>
      <div className="card overflow-x-auto p-2">
        <table className="w-full min-w-[600px] border-collapse">
          <thead><tr><th className={th}>Վերնագիր</th><th className={th}>Ամսաթիվ</th><th className={th}>Կարգավիճակ</th></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id}><td className={td}><Link href={`/admin/posts/${p.id}`} className="font-semibold">{tr(p.title, "hy")}</Link></td><td className={td}>{dateShort(p.publishedAt ?? p.createdAt)}</td>
              <td className={td}><span className={`chip font-semibold ${p.published ? "bg-[#e3f1e6] text-[#1f5f33]" : "bg-[#eef0f3] text-[#4b5563]"}`}>{p.published ? "Հրապարակված" : "Սևագիր"}</span></td></tr>
          ))}</tbody>
        </table>
        {list.length === 0 && <p className="p-4 text-muted">Հոդվածներ դեռ չկան։</p>}
      </div>
    </>
  );
}
