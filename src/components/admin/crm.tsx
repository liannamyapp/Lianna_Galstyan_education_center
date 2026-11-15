import Link from "next/link";
import type { LeadStage } from "@/db/schema";
import { stageCls, stageHy, tempCls, tempHy, sourceHy } from "@/lib/crm/constants";
import { temperature } from "@/lib/crm/score";

export function StageBadge({ stage }: { stage: LeadStage }) {
  return <span className={`chip font-semibold ${stageCls[stage]}`}>{stageHy[stage]}</span>;
}

export function ScoreBadge({ score }: { score: number }) {
  const t = temperature(score);
  return <span className={`chip font-semibold ${tempCls[t]}`} title="Լիդի գնահատական (0–100)">{tempHy[t]} · {score}</span>;
}

export const sourceLabel = (source: string, utm?: { source?: string; campaign?: string } | null) =>
  `${sourceHy[source] ?? source}${utm?.source ? ` · ${utm.source}${utm.campaign ? `/${utm.campaign}` : ""}` : ""}`;

export function LeadLink({ id, name }: { id: string; name: string }) {
  return <Link href={`/admin/crm/leads/${id}`} className="font-semibold text-navy-900 no-underline hover:underline">{name}</Link>;
}

/** Horizontal bar used by the funnel and source charts (CSS only). */
export function Bar({ label, value, max, extra, tone = "bg-navy-800" }: { label: string; value: number; max: number; extra?: string; tone?: string }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="grid grid-cols-[150px_1fr_auto] items-center gap-3 text-[14px] sm:grid-cols-[190px_1fr_auto]">
      <span className="truncate text-[#3d4757]">{label}</span>
      <span className="h-3 overflow-hidden rounded-full bg-[#eee7d8]" role="img" aria-label={`${label}: ${value}`}><span className={`block h-full rounded-full ${tone}`} style={{ width: `${w}%` }} /></span>
      <span className="min-w-[70px] text-right font-semibold text-navy-900">{value}{extra ? <span className="ml-1.5 font-normal text-muted">{extra}</span> : null}</span>
    </div>
  );
}

export const relTime = (d?: Date | string | null) => {
  if (!d) return "—";
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  const abs = Math.abs(m), fut = m < 0;
  const v = abs < 60 ? `${abs} րոպե` : abs < 1440 ? `${Math.round(abs / 60)} ժամ` : `${Math.round(abs / 1440)} օր`;
  return fut ? `${v} հետո` : `${v} առաջ`;
};

export const isoLocal = (d?: Date | string | null) => {
  if (!d) return "";
  const x = new Date(new Date(d).getTime() + 4 * 3_600_000); // Asia/Yerevan
  return x.toISOString().slice(0, 16);
};
