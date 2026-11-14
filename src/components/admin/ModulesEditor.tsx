"use client";
import { useState } from "react";

type Row = { code: string; hours: number; hy: string; ru: string; en: string };

export function ModulesEditor({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial.length ? initial : [{ code: "Մ1", hours: 0, hy: "", ru: "", en: "" }]);
  const total = rows.reduce((n, r) => n + (Number(r.hours) || 0), 0);
  const upd = (i: number, k: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: k === "hours" ? Number(v) : v } : r)));
  const move = (i: number, d: number) => setRows((rs) => { const c = [...rs]; const j = i + d; if (j < 0 || j >= c.length) return rs; [c[i], c[j]] = [c[j], c[i]]; return c; });
  return (
    <fieldset className="m-0 rounded-2xl border border-line p-4">
      <legend className="px-1.5 text-[13.5px] font-semibold text-[#3d4757]">Մոդուլներ · ընդամենը {total} ժամ</legend>
      <div className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 rounded-xl bg-ivory p-3 md:grid-cols-[70px_80px_1fr_1fr_1fr_auto] md:items-center">
            <input name="m_code" aria-label="Կոդ" value={r.code} onChange={(e) => upd(i, "code", e.target.value)} className="input min-h-10 text-[14px]" />
            <input name="m_hours" aria-label="Ժամ" type="number" min={0} value={r.hours} onChange={(e) => upd(i, "hours", e.target.value)} className="input min-h-10 text-[14px]" />
            <input name="m_title_hy" aria-label="Անվանում ՀԱՅ" placeholder="ՀԱՅ" value={r.hy} onChange={(e) => upd(i, "hy", e.target.value)} className="input min-h-10 text-[14px]" />
            <input name="m_title_ru" aria-label="Անվանում РУС" placeholder="РУС" value={r.ru} onChange={(e) => upd(i, "ru", e.target.value)} className="input min-h-10 text-[14px]" />
            <input name="m_title_en" aria-label="Անվանում ENG" placeholder="ENG" value={r.en} onChange={(e) => upd(i, "en", e.target.value)} className="input min-h-10 text-[14px]" />
            <div className="flex gap-1">
              <button type="button" onClick={() => move(i, -1)} aria-label="Վեր" className="size-9 rounded-lg bg-white">↑</button>
              <button type="button" onClick={() => move(i, 1)} aria-label="Վար" className="size-9 rounded-lg bg-white">↓</button>
              <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label="Ջնջել" className="size-9 rounded-lg bg-white text-[#8a2f1d]">×</button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setRows((rs) => [...rs, { code: `Մ${rs.length + 1}`, hours: 0, hy: "", ru: "", en: "" }])} className="btn-soft mt-3 min-h-10">+ Մոդուլ</button>
    </fieldset>
  );
}
