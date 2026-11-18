"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { and, eq, lte, or, sql } from "drizzle-orm";
import { db, s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { str, num } from "@/lib/validate";
import type { ActionResult } from "@/components/ActionForm";
import { ATT_STATUSES, KINDS } from "@/lib/journal";

const ok = (message = "Պահպանված է"): ActionResult => ({ ok: true, message });
const fail = (e: unknown): ActionResult => ({ error: e instanceof Error ? e.message : "Սխալ" });
const refresh = () => { revalidatePath("/admin/journal"); revalidatePath("/[locale]/account", "layout"); revalidatePath("/admin/students", "layout"); };

/** "g:<groupId>" = a group, "a:<applicationId>" = one individual learner */
function parseScope(v: string) {
  if (v.startsWith("g:")) return { groupId: v.slice(2), applicationId: null };
  if (v.startsWith("a:")) return { groupId: null, applicationId: v.slice(2) };
  throw new Error("Ընտրեք խումբը կամ ունկնդրին");
}

/** Yerevan calendar date (YYYY-MM-DD) → noon in Yerevan, so the date never shifts across time zones. */
function dateAt(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error("Նշեք ամսաթիվը");
  return new Date(`${v}T12:00:00+04:00`);
}

/** Keeps the "lessons done" progress bar in step with the journal: sessions held so far for each learner. */
async function syncLessonsDone(scope: { groupId: string | null; applicationId: string | null }) {
  const apps = scope.groupId
    ? await db.select({ id: s.applications.id }).from(s.applications).where(eq(s.applications.groupId, scope.groupId))
    : [{ id: scope.applicationId! }];
  for (const a of apps) {
    const [app] = await db.select({ groupId: s.applications.groupId }).from(s.applications).where(eq(s.applications.id, a.id)).limit(1);
    if (!app) continue;
    const mine = app.groupId ? or(eq(s.journalSessions.applicationId, a.id), eq(s.journalSessions.groupId, app.groupId)) : eq(s.journalSessions.applicationId, a.id);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.journalSessions).where(and(mine, lte(s.journalSessions.date, new Date())));
    await db.update(s.applications).set({ lessonsDone: n }).where(eq(s.applications.id, a.id));
  }
}

export async function saveSession(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const id = str(fd, "id");
    const courseId = str(fd, "courseId");
    const scope = parseScope(str(fd, "scope"));
    const values = { courseId, ...scope, date: dateAt(str(fd, "date")), topic: str(fd, "topic").slice(0, 300) };
    if (id) await db.update(s.journalSessions).set({ date: values.date, topic: values.topic }).where(eq(s.journalSessions.id, id));
    else await db.insert(s.journalSessions).values(values);
    await syncLessonsDone(scope);
    refresh();
    return ok(id ? "Պահպանված է" : "Դասը ավելացվեց։ Բացեք այն և նշեք հաճախումները։");
  } catch (e) { return fail(e); }
}

export async function deleteSession(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const [x] = await db.select().from(s.journalSessions).where(eq(s.journalSessions.id, id)).limit(1);
  if (!x) return;
  await db.delete(s.journalSessions).where(eq(s.journalSessions.id, id)); // attendance rows cascade
  await syncLessonsDone({ groupId: x.groupId, applicationId: x.applicationId });
  refresh();
}

export async function saveAttendance(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const sessionId = str(fd, "sessionId");
    const appIds = fd.getAll("app").map(String);
    let n = 0;
    for (const appId of appIds) {
      const status = str(fd, `st_${appId}`);
      const note = str(fd, `note_${appId}`).slice(0, 300) || null;
      if (!status) { await db.delete(s.attendance).where(and(eq(s.attendance.sessionId, sessionId), eq(s.attendance.applicationId, appId))); continue; }
      if (!ATT_STATUSES.includes(status as never)) continue;
      await db.insert(s.attendance).values({ sessionId, applicationId: appId, status, note })
        .onConflictDoUpdate({ target: [s.attendance.sessionId, s.attendance.applicationId], set: { status, note } });
      n++;
    }
    refresh();
    return ok(`Հաճախումները պահպանված են (${n})`);
  } catch (e) { return fail(e); }
}

export async function saveAssessment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const id = str(fd, "id");
    const title = str(fd, "title").slice(0, 200);
    if (!title) throw new Error("Նշեք աշխատանքի անվանումը");
    const kind = KINDS.includes(str(fd, "kind") as never) ? str(fd, "kind") : "homework";
    const maxScore = Math.max(1, Math.min(1000, num(fd, "maxScore", 10)));
    const weight = Math.max(0, Math.min(100, num(fd, "weight", 1)));
    const d = str(fd, "date");
    const date = d ? dateAt(d) : null;
    if (id) await db.update(s.assessments).set({ title, kind, maxScore, weight, date }).where(eq(s.assessments.id, id));
    else await db.insert(s.assessments).values({ courseId: str(fd, "courseId"), ...parseScope(str(fd, "scope")), title, kind, maxScore, weight, date });
    refresh();
    return ok(id ? "Պահպանված է" : "Աշխատանքը ավելացվեց։ Բացեք այն և նշեք գնահատականները։");
  } catch (e) { return fail(e); }
}

export async function deleteAssessment(fd: FormData) {
  await requireAdmin();
  await db.delete(s.assessments).where(eq(s.assessments.id, str(fd, "id"))); // grades cascade
  refresh();
}

export async function saveGrades(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const assessmentId = str(fd, "assessmentId");
    const [w] = await db.select().from(s.assessments).where(eq(s.assessments.id, assessmentId)).limit(1);
    if (!w) throw new Error("Աշխատանքը չի գտնվել");
    const appIds = fd.getAll("app").map(String);
    let n = 0;
    for (const appId of appIds) {
      const raw = str(fd, `sc_${appId}`).replace(",", ".");
      const comment = str(fd, `cm_${appId}`).slice(0, 500) || null;
      if (raw === "") { await db.delete(s.grades).where(and(eq(s.grades.assessmentId, assessmentId), eq(s.grades.applicationId, appId))); continue; }
      const score = Number(raw);
      if (!Number.isFinite(score) || score < 0 || score > w.maxScore) throw new Error(`Գնահատականը պետք է լինի 0-ից ${w.maxScore}`);
      await db.insert(s.grades).values({ assessmentId, applicationId: appId, score, comment })
        .onConflictDoUpdate({ target: [s.grades.assessmentId, s.grades.applicationId], set: { score, comment } });
      n++;
    }
    refresh();
    return ok(`Գնահատականները պահպանված են (${n})`);
  } catch (e) { return fail(e); }
}

export async function saveThresholds(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const value = {
      attendanceMin: Math.max(0, Math.min(100, num(fd, "attendanceMin", 80))),
      resultMin: Math.max(0, Math.min(100, num(fd, "resultMin", 60))),
    };
    await db.insert(s.settings).values({ key: "journal", value }).onConflictDoUpdate({ target: s.settings.key, set: { value } });
    revalidateTag("settings");
    refresh();
    return ok();
  } catch (e) { return fail(e); }
}
