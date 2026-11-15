import { autoTranslateEnabled } from "@/lib/translate";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ValueButton } from "@/components/ValueButton";
import { db, s } from "@/db";
import { dateShort } from "@/lib/format";
import { Stars } from "@/components/Stars";
import { PageHead } from "@/components/admin/fields";
import { moderateReview } from "../actions";

const LANG: Record<string, string> = { hy: "հայերեն", ru: "ռուսերեն", en: "անգլերեն" };
const TABS = [["PENDING", "Սպասող"], ["APPROVED", "Հաստատված"], ["REJECTED", "Մերժված"]] as const;

export default async function Reviews({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "PENDING" } = await searchParams;
  const st = (TABS.find(([k]) => k === tab)?.[0] ?? "PENDING") as "PENDING" | "APPROVED" | "REJECTED";
  const list = await db.query.reviews.findMany({ where: eq(s.reviews.status, st), orderBy: [desc(s.reviews.createdAt)], with: { user: true, course: true } });
  const auto = autoTranslateEnabled();
  return (
    <>
      <PageHead title="Կարծիքներ" />
      <nav className="mb-5 flex flex-wrap gap-2">{TABS.map(([k, l]) => <Link key={k} href={`/admin/reviews?tab=${k}`} className={`chip min-h-10 px-4 no-underline ${st === k ? "bg-navy-800 text-white" : "bg-white text-navy-800"}`}>{l}</Link>)}</nav>
      <div className="flex flex-col gap-3">
        {list.map((r) => (
          <form key={r.id} action={moderateReview} className="card flex flex-col gap-3 p-5">
            <input type="hidden" name="id" value={r.id} />
            <div className="flex flex-wrap items-center gap-3"><b>{r.user.name}</b><span className="text-[13px] text-muted">{r.user.email} · {r.course?.code ?? "—"} · {dateShort(r.createdAt)} · {r.locale.toUpperCase()}</span><Stars value={r.rating} label={`${r.rating}/5`} /></div>
            <label className="label">Տեքստ (կարող եք խմբագրել)<textarea name="text" defaultValue={r.text} rows={3} className="input py-2.5 font-normal" /></label>
            <label className="label">Պատասխան կայքում (ոչ պարտադիր)<textarea name="reply" defaultValue={r.reply ?? ""} rows={3} className="input py-2.5 font-normal" /></label>
            <details className="rounded-xl border border-[#eee7d8] bg-ivory/60 p-4">
              <summary className="cursor-pointer text-[14px] font-semibold text-navy-900">Թարգմանություններ ({(["hy", "ru", "en"] as const).filter((l) => r.textI18n?.[l]).length}/3) · գրված է {LANG[r.locale] ?? r.locale}</summary>
              <p className="mt-2 mb-3 text-[13px] text-muted">{auto ? "Թարգմանվում է ավտոմատ։ Կարող եք ուղղել ցանկացած տարբերակ։" : "Լրացրեք այն լեզուները, որոնցով ցանկանում եք ցույց տալ կարծիքը։ Դատարկ լեզվով կերևա բնօրինակը։"}</p>
              <div className="grid gap-3 md:grid-cols-3">
                {(["hy", "ru", "en"] as const).filter((l) => l !== r.locale).map((l) => (
                  <label key={l} className="label">Կարծիք · {LANG[l]}<textarea name={`text_${l}`} defaultValue={r.textI18n?.[l] ?? ""} rows={3} className="input py-2.5 font-normal" /></label>
                ))}
                {(["hy", "ru", "en"] as const).map((l) => (
                  <label key={`r${l}`} className="label">Պատասխան · {LANG[l]}<textarea name={`reply_${l}`} defaultValue={r.replyI18n?.[l] ?? ""} rows={2} className="input py-2.5 font-normal" /></label>
                ))}
              </div>
              {auto && <ValueButton name="op" value="translate" className="btn-soft mt-3 min-h-10">Թարգմանել ավտոմատ</ValueButton>}
            </details>
            <div className="flex flex-wrap gap-2">
              {st !== "APPROVED" && <ValueButton name="status" value="APPROVED" className="btn-navy min-h-10">Հաստատել և հրապարակել</ValueButton>}
              {st !== "REJECTED" && <ValueButton name="status" value="REJECTED" className="btn-soft min-h-10 text-[#8a2f1d]">Մերժել</ValueButton>}
              {st === "APPROVED" && <ValueButton name="status" value="APPROVED" className="btn-soft min-h-10">Պահպանել փոփոխությունները</ValueButton>}
              <ValueButton name="op" value="delete" className="btn min-h-10 text-[#8a2f1d] ring-1 ring-[#f0cfc6]">Ջնջել</ValueButton>
            </div>
          </form>
        ))}
        {list.length === 0 && <p className="card p-6 text-muted">Այստեղ կարծիքներ չկան։</p>}
      </div>
    </>
  );
}
