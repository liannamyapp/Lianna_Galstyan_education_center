import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, s } from "@/db";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AdminCard, Check, Field, L10nInput, PageHead } from "@/components/admin/fields";
import { deletePost, savePost } from "../../actions";

export default async function EditPost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const p = id === "new" ? null : (await db.select().from(s.posts).where(eq(s.posts.id, id)).limit(1))[0];
  if (id !== "new" && !p) notFound();
  return (
    <>
      <PageHead title={p ? "Խմբագրել հոդվածը" : "Նոր հոդված"}>
        {p?.published && <Link href={`/hy/blog/${p.slug}`} target="_blank" className="btn-soft min-h-11">Դիտել</Link>}
        <Link href="/admin/posts" className="btn-soft min-h-11">← Ցանկ</Link>
      </PageHead>
      {saved && <p role="status" className="mb-4 rounded-xl bg-[#eef7f0] px-4 py-3 text-[14px] text-[#1f5f33]">Պահպանված է։</p>}
      <ActionForm action={savePost} className="flex flex-col gap-5">
        {p && <input type="hidden" name="id" value={p.id} />}
        <AdminCard>
          <div className="flex flex-col gap-4">
            <L10nInput name="title" label="Վերնագիր" value={p?.title} required />
            <L10nInput name="excerpt" label="Կարճ նկարագրություն" value={p?.excerpt} textarea rows={2} />
            <L10nInput name="body" label="Տեքստ (Markdown՝ ## վերնագիր, **թավ**, - ցուցակ, [հղում](https://…))" value={p?.body} textarea rows={14} />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="URL (slug)"><input name="slug" defaultValue={p?.slug} className="input" /></Field>
              <Field label="Շապիկի նկար"><input type="file" name="cover" accept="image/*" className="text-[14px]" />{p?.coverUrl && <Image src={p.coverUrl} alt="" width={200} height={110} className="mt-2 rounded-lg" />}</Field>
            </div>
          </div>
        </AdminCard>
        <div className="flex items-center gap-5"><Check name="published" label="Հրապարակել" defaultChecked={p?.published} /><SubmitButton className="btn-navy px-8" pendingText="…">Պահպանել</SubmitButton></div>
      </ActionForm>
      {p && <form action={deletePost} className="mt-8"><input type="hidden" name="id" value={p.id} /><button className="text-[13.5px] text-[#8a2f1d]">Ջնջել հոդվածը</button></form>}
    </>
  );
}
