import type { AttStatus, JournalData, Kind } from "@/lib/journal";

export type JournalLabels = {
  attendance: string; result: string; readiness: string; eligible: string; notEligible: string; required: string;
  sessions: string; grades: string; date: string; topic: string; status: string; score: string; comment: string;
  noSessions: string; noGrades: string; notMarked: string; notGraded: string; held: string; gradedOf: string;
  checks: string; checkAttendance: string; checkResult: string; checkFinal: string; checkPaid: string; how: string;
  st: Record<AttStatus, string>; kind: Record<Kind, string>;
};

const tone: Record<AttStatus, string> = {
  P: "bg-[#e3f1e6] text-[#1f5f33]", L: "bg-[#fdf3dc] text-[#7a5410]", R: "bg-[#e6eef8] text-navy-800", A: "bg-[#fbefeb] text-[#8a2f1d]",
};
const fmtPct = (v: number | null) => (v === null ? "—" : `${String(v).replace(/\.0$/, "")}%`);
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

function Meter({ label, value, min, sub, good }: { label: string; value: number | null; min?: number; sub?: string; good?: boolean }) {
  const okv = good ?? (value !== null && (min === undefined || value >= min));
  return (
    <div className="min-w-0 rounded-2xl border border-[#eee7d8] bg-white p-4">
      <p className="m-0 text-[13px] text-muted">{label}</p>
      <p className={`m-0 mt-1 font-serif text-[28px] leading-none font-bold ${value === null ? "text-muted" : okv ? "text-[#1f5f33]" : "text-[#8a5a2b]"}`}>{fmtPct(value)}</p>
      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-[#efe9dc]" aria-hidden="true">
        <div className={`h-full rounded-full ${okv ? "bg-[#3f8a55]" : "bg-gold-500"}`} style={{ width: `${Math.min(100, value ?? 0)}%` }} />
        {min !== undefined && <div className="absolute top-0 h-full w-0.5 bg-navy-900" style={{ left: `${min}%` }} />}
      </div>
      {sub && <p className="m-0 mt-2 text-[12.5px] text-muted">{sub}</p>}
    </div>
  );
}

/** One enrolment's journal: percentages, certificate checklist, attendance by date and grades. */
export function JournalView({ j, L, dateFmt }: { j: JournalData; L: JournalLabels; dateFmt: (d: Date) => string }) {
  const th = j.thresholds;
  const check = (okv: boolean, text: string) => (
    <li className="flex items-start gap-2"><span aria-hidden="true" className={`mt-0.5 flex size-5 flex-none items-center justify-center rounded-full text-[12px] font-bold ${okv ? "bg-[#3f8a55] text-white" : "bg-[#efe9dc] text-muted"}`}>{okv ? "✓" : "·"}</span><span className={okv ? "" : "text-muted"}>{text}</span></li>
  );
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr))]">
        <Meter label={L.attendance} value={j.attendancePct} min={th.attendanceMin} sub={`${fill(L.held, { n: j.attended, m: j.marked })} · ${fill(L.required, { min: th.attendanceMin })}`} />
        <Meter label={L.result} value={j.resultPct} min={th.resultMin} sub={`${fill(L.gradedOf, { n: j.graded, m: j.assessments.length })} · ${fill(L.required, { min: th.resultMin })}`} />
        <Meter label={L.readiness} value={j.readiness} good={j.eligible} sub={j.eligible ? L.eligible : L.notEligible} />
      </div>

      <div className={`rounded-2xl p-4 ${j.eligible ? "bg-[#e3f1e6]" : "bg-ivory"}`}>
        <p className="m-0 mb-2 text-[14px] font-semibold text-navy-900">{L.checks}</p>
        <ul className="m-0 grid list-none gap-1.5 p-0 text-[14px] sm:grid-cols-2">
          {check(j.checks.attendance, fill(L.checkAttendance, { min: th.attendanceMin }))}
          {check(j.checks.result, fill(L.checkResult, { min: th.resultMin }))}
          {check(j.checks.final, L.checkFinal)}
          {check(j.checks.paid, L.checkPaid)}
        </ul>
        <p className="m-0 mt-3 text-[12.5px] text-muted">{L.how}</p>
      </div>

      <section className="min-w-0">
        <h3 className="m-0 mb-2 text-[16px] font-semibold text-navy-900">{L.sessions}</h3>
        {j.sessions.length === 0 ? <p className="m-0 text-[14px] text-muted">{L.noSessions}</p> : (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {[...j.sessions].reverse().map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[#eee7d8] bg-white px-3.5 py-2.5 text-[14px]">
                <span className="w-[92px] flex-none font-semibold text-navy-900">{dateFmt(x.date)}</span>
                <span className="min-w-0 flex-1 basis-[140px] [overflow-wrap:anywhere] text-[#3d4757]">{x.topic || "—"}</span>
                <span className={`chip text-[12.5px] font-semibold ${x.status ? tone[x.status] : "bg-[#f1ede4] text-muted"}`}>{x.status ? L.st[x.status] : L.notMarked}</span>
                {x.note && <span className="basis-full text-[12.5px] text-muted [overflow-wrap:anywhere]">{x.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="min-w-0">
        <h3 className="m-0 mb-2 text-[16px] font-semibold text-navy-900">{L.grades}</h3>
        {j.assessments.length === 0 ? <p className="m-0 text-[14px] text-muted">{L.noGrades}</p> : (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {[...j.assessments].reverse().map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[#eee7d8] bg-white px-3.5 py-2.5 text-[14px]">
                <span className="min-w-0 flex-1 basis-[180px]">
                  <b className="[overflow-wrap:anywhere] text-navy-900">{w.title}</b><br />
                  <span className="text-[12.5px] text-muted">{L.kind[w.kind] ?? w.kind}{w.date ? ` · ${dateFmt(w.date)}` : ""}</span>
                </span>
                {w.score === null
                  ? <span className="chip bg-[#f1ede4] text-[12.5px] text-muted">{L.notGraded}</span>
                  : <span className="text-right"><b className="text-[16px] text-navy-900">{String(w.score).replace(/\.0$/, "")}</b><span className="text-muted"> / {w.maxScore}</span><span className={`chip ml-2 text-[12.5px] font-semibold ${(w.pct ?? 0) >= th.resultMin ? "bg-[#e3f1e6] text-[#1f5f33]" : "bg-[#fdf3dc] text-[#7a5410]"}`}>{fmtPct(w.pct)}</span></span>}
                {w.comment && <span className="basis-full text-[13px] text-[#3d4757] [overflow-wrap:anywhere]">💬 {w.comment}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
