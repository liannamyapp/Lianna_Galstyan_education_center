import "server-only";
import { and, asc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { db, s } from "@/db";
import { billing } from "@/lib/billing";
import { getSettings } from "@/lib/settings";

export type AttStatus = "P" | "L" | "R" | "A";
export const ATT_STATUSES: AttStatus[] = ["P", "L", "R", "A"];
export const ATTENDED: AttStatus[] = ["P", "L", "R"]; // contract 7.1: live or by recording
export const KINDS = ["homework", "test", "project", "final"] as const;
export type Kind = (typeof KINDS)[number];

type AppRow = typeof s.applications.$inferSelect & {
  course: typeof s.courses.$inferSelect;
  group?: typeof s.groups.$inferSelect | null;
};

export type JournalData = {
  appId: string;
  planned: number;
  sessions: { id: string; date: Date; topic: string; status: AttStatus | null; note: string | null }[];
  marked: number;
  attended: number;
  attendancePct: number | null;
  assessments: { id: string; title: string; kind: Kind; maxScore: number; weight: number; date: Date | null; score: number | null; comment: string | null; pct: number | null }[];
  graded: number;
  resultPct: number | null;
  finalDone: boolean;
  paid: boolean;
  thresholds: { attendanceMin: number; resultMin: number };
  /** how far the learner is towards the certificate requirements, 0–100 */
  readiness: number;
  eligible: boolean;
  checks: { attendance: boolean; result: boolean; final: boolean; paid: boolean };
};

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

/** Journal of every given enrolment (sessions, attendance, grades) plus the percentages and certificate readiness. */
export async function loadJournal(apps: AppRow[]): Promise<Map<string, JournalData>> {
  const out = new Map<string, JournalData>();
  if (!apps.length) return out;
  const st = await getSettings();
  const th = { attendanceMin: st.journal.attendanceMin, resultMin: st.journal.resultMin };
  const appIds = apps.map((a) => a.id);
  const groupIds = [...new Set(apps.map((a) => a.groupId).filter(Boolean) as string[])];
  const sessScope = groupIds.length ? or(inArray(s.journalSessions.applicationId, appIds), inArray(s.journalSessions.groupId, groupIds)) : inArray(s.journalSessions.applicationId, appIds);
  const workScope = groupIds.length ? or(inArray(s.assessments.applicationId, appIds), inArray(s.assessments.groupId, groupIds)) : inArray(s.assessments.applicationId, appIds);

  const [sessions, marks, works, scores, pays] = await Promise.all([
    db.select().from(s.journalSessions).where(sessScope).orderBy(asc(s.journalSessions.date)),
    db.select().from(s.attendance).where(inArray(s.attendance.applicationId, appIds)),
    db.select().from(s.assessments).where(workScope).orderBy(asc(s.assessments.date), asc(s.assessments.createdAt)),
    db.select().from(s.grades).where(inArray(s.grades.applicationId, appIds)),
    db.select().from(s.payments).where(and(inArray(s.payments.applicationId, appIds), isNotNull(s.payments.applicationId))),
  ]);

  for (const a of apps) {
    const mine = (x: { groupId: string | null; applicationId: string | null }) => x.applicationId === a.id || (!!a.groupId && x.groupId === a.groupId);
    const ss = sessions.filter(mine).map((x) => {
      const m = marks.find((r) => r.sessionId === x.id && r.applicationId === a.id);
      return { id: x.id, date: x.date, topic: x.topic, status: (m?.status as AttStatus) ?? null, note: m?.note ?? null };
    });
    const marked = ss.filter((x) => x.status).length;
    const attended = ss.filter((x) => x.status && ATTENDED.includes(x.status)).length;

    const ws = works.filter(mine).map((w) => {
      const g = scores.find((r) => r.assessmentId === w.id && r.applicationId === a.id);
      return { id: w.id, title: w.title, kind: w.kind as Kind, maxScore: w.maxScore, weight: w.weight, date: w.date, score: g?.score ?? null, comment: g?.comment ?? null, pct: g ? pct(g.score, w.maxScore) : null };
    });
    const graded = ws.filter((w) => w.score !== null);
    const wsum = graded.reduce((n, w) => n + Math.max(0, w.weight), 0);
    const resultPct = graded.length
      ? Math.round((wsum > 0
        ? graded.reduce((n, w) => n + (w.score! / w.maxScore) * Math.max(0, w.weight), 0) / wsum
        : graded.reduce((n, w) => n + w.score! / w.maxScore, 0) / graded.length) * 1000) / 10
      : null;
    const finalDone = graded.some((w) => w.kind === "final" && (w.score ?? 0) > 0);

    const b = billing(a, a.course, a.group?.startDate, pays.filter((p) => p.applicationId === a.id), st.payments);
    const paid = a.status === "PAID" && !b.next;

    const attendancePct = pct(attended, marked);
    const checks = {
      attendance: attendancePct !== null && attendancePct >= th.attendanceMin,
      result: resultPct !== null && resultPct >= th.resultMin,
      final: finalDone,
      paid,
    };
    const part = (v: number | null, min: number) => (v === null ? 0 : min > 0 ? Math.min(1, v / min) : 1);
    const readiness = Math.round(((part(attendancePct, th.attendanceMin) + part(resultPct, th.resultMin) + (finalDone ? 1 : 0) + (paid ? 1 : 0)) / 4) * 100);

    out.set(a.id, {
      appId: a.id, planned: a.course.weeks * a.course.lessonsPerWeek, sessions: ss, marked, attended, attendancePct,
      assessments: ws, graded: graded.length, resultPct, finalDone, paid, thresholds: th, readiness,
      eligible: checks.attendance && checks.result && checks.final && checks.paid, checks,
    });
  }
  return out;
}

/** Enrolments that belong in the journal (approved or paid). */
export async function journalApps(where: ReturnType<typeof eq> | ReturnType<typeof and>) {
  return db.query.applications.findMany({
    where: and(where, inArray(s.applications.status, ["APPROVED", "PAID"])),
    with: { course: true, group: true, user: true },
  });
}
