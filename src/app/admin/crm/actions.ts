"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db, s } from "@/db";
import type { LeadStage } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { l10n } from "@/lib/admin";
import { str, num, bool } from "@/lib/validate";
import type { ActionResult } from "@/components/ActionForm";
import { CHANNELS, STAGES, type Channel } from "@/lib/crm/constants";
import { addTask, logActivity, normEmail, normPhone, recalcScore, render, setStage, upsertLead, getTemplate } from "@/lib/crm/leads";
import { sendToLead } from "@/lib/crm/channels";
import { onNewLead, runCrmDaily, sendTemplate, syncFromSite, templateVars } from "@/lib/crm/automations";
import { getCrmSettings, saveCrmSettings } from "@/lib/crm/config";
import { ensureWebhooks } from "@/lib/crm/setup";

const ok = (message = "Պահպանված է"): ActionResult => ({ ok: true, message });
const fail = (e: unknown): ActionResult => ({ error: e instanceof Error ? e.message : "Սխալ" });
const stageOf = (v: string) => (STAGES as string[]).includes(v) ? (v as LeadStage) : null;
/** <input type="datetime-local"> has no zone: the admin works in Yerevan time (UTC+4). */
const dt = (v: string) => {
  if (!v) return null;
  const d = new Date(/T\d\d:\d\d$/.test(v) ? `${v}:00+04:00` : v);
  return isNaN(+d) ? null : d;
};
const refresh = (id?: string) => { revalidatePath("/admin/crm", "layout"); if (id) revalidatePath(`/admin/crm/leads/${id}`); };

/* ---------------- leads ---------------- */
export async function createLead(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  let id = "";
  try {
    const phone = str(fd, "phone"), email = str(fd, "email");
    if (str(fd, "name").length < 2 || (!normPhone(phone) && !normEmail(email))) return { error: "Լրացրեք անունը և հեռախոսահամար կամ էլ. փոստ" };
    const { lead, created } = await upsertLead({
      name: str(fd, "name"), phone, email, source: str(fd, "source") || "other", locale: str(fd, "locale") || "hy",
      courseId: str(fd, "courseId") || null, format: str(fd, "format") || null,
      tags: str(fd, "tags").split(",").map((t) => t.trim()).filter(Boolean),
    });
    id = lead.id;
    if (str(fd, "note")) await logActivity(lead.id, "note", str(fd, "note"));
    if (created) await onNewLead(lead, { notify: false, autoReply: false });
    else await logActivity(lead.id, "note", "Փորձ կար ավելացնելու կրկնակի լիդ (նույն հեռախոս/էլ. փոստ)");
  } catch (e) { return fail(e); }
  refresh();
  redirect(`/admin/crm/leads/${id}`);
}

export async function updateLead(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const id = str(fd, "id");
    const [cur] = await db.select().from(s.leads).where(eq(s.leads.id, id)).limit(1);
    if (!cur) return { error: "Չի գտնվել" };
    await db.update(s.leads).set({
      name: str(fd, "name") || cur.name,
      phone: normPhone(str(fd, "phone")), email: normEmail(str(fd, "email")),
      telegramUsername: str(fd, "telegramUsername").replace(/^@/, "") || null,
      locale: str(fd, "locale") || cur.locale, source: str(fd, "source") || cur.source,
      courseId: str(fd, "courseId") || null, format: str(fd, "format") || null,
      tags: str(fd, "tags").split(",").map((t) => t.trim()).filter(Boolean),
      note: str(fd, "note") || null,
      nextAction: str(fd, "nextAction") || null, nextActionAt: dt(str(fd, "nextActionAt")),
      marketingOptIn: bool(fd, "marketingOptIn"), unsubscribed: !bool(fd, "marketingOptIn") && cur.unsubscribed,
    }).where(eq(s.leads.id, id));
    const stage = stageOf(str(fd, "stage"));
    if (stage && stage !== cur.stage) await setStage(id, stage, str(fd, "lostReason") || undefined);
    else await recalcScore(id);
    refresh(id);
    return ok();
  } catch (e) { return fail(e); }
}

/** Quick stage change from the pipeline board. */
export async function moveLead(fd: FormData) {
  await requireAdmin();
  const stage = stageOf(str(fd, "stage"));
  if (stage) await setStage(str(fd, "id"), stage, str(fd, "reason") || undefined);
  refresh(str(fd, "id"));
}

export async function deleteLead(fd: FormData) {
  await requireAdmin();
  await db.delete(s.leads).where(eq(s.leads.id, str(fd, "id")));
  refresh();
  redirect("/admin/crm/leads");
}

export async function addNote(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const id = str(fd, "id"), body = str(fd, "body"), type = str(fd, "type") === "call" ? "call" : "note";
    if (!body) return { error: "Գրեք տեքստը" };
    await logActivity(id, type, body, type === "call" ? "phone" : null, type === "call" ? { result: str(fd, "result") } : {});
    if (type === "call") {
      await db.update(s.leads).set({ lastContactAt: new Date(), firstResponseAt: sql`coalesce(${s.leads.firstResponseAt}, now())` }).where(eq(s.leads.id, id));
      const [l] = await db.select({ stage: s.leads.stage }).from(s.leads).where(eq(s.leads.id, id)).limit(1);
      if (l?.stage === "NEW") await setStage(id, "CONTACTED", "Զանգից հետո");
    }
    refresh(id);
    return ok("Ավելացված է");
  } catch (e) { return fail(e); }
}

export async function sendMessage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const id = str(fd, "id");
    const [lead] = await db.select().from(s.leads).where(eq(s.leads.id, id)).limit(1);
    if (!lead) return { error: "Չի գտնվել" };
    const ch = str(fd, "channel");
    const channel = (CHANNELS as readonly string[]).includes(ch) ? (ch as Channel) : "auto";
    let text = str(fd, "text"), subject = str(fd, "subject");
    const tpl = str(fd, "template");
    if (!text && tpl) {
      const t = await getTemplate(tpl);
      if (t) { const v = await templateVars(lead); text = render(t.body, lead.locale, v); subject ||= render(t.subject, lead.locale, v); }
    } else if (text) text = render(text, lead.locale, await templateVars(lead));
    if (!text) return { error: "Գրեք հաղորդագրությունը կամ ընտրեք ձևանմուշ" };
    const r = await sendToLead(lead, channel, { text, subject, marketing: false });
    if (r.ok && lead.stage === "NEW") await setStage(id, "CONTACTED", "Առաջին հաղորդագրությունից հետո");
    refresh(id);
    return r.ok ? ok(`Ուղարկված է (${r.channel})`) : { error: r.error ?? "Չհաջողվեց" };
  } catch (e) { return fail(e); }
}

/* ---------------- tasks ---------------- */
export async function saveTask(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const title = str(fd, "title"), due = dt(str(fd, "dueAt")) ?? new Date();
    if (!title) return { error: "Գրեք առաջադրանքը" };
    const leadId = str(fd, "leadId") || null;
    await addTask(leadId, title, due);
    if (leadId) await db.update(s.leads).set({ nextAction: title, nextActionAt: due }).where(eq(s.leads.id, leadId));
    refresh(leadId ?? undefined);
    return ok("Առաջադրանքն ավելացված է");
  } catch (e) { return fail(e); }
}

export async function toggleTask(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id"), done = str(fd, "done") === "1";
  const [t] = await db.update(s.crmTasks).set({ done, doneAt: done ? new Date() : null }).where(eq(s.crmTasks.id, id)).returning();
  if (t?.leadId && done) await logActivity(t.leadId, "task", `Կատարված՝ ${t.title}`);
  refresh(t?.leadId ?? undefined);
}

/* ---------------- templates ---------------- */
export async function saveTemplate(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const id = str(fd, "id");
    const data = { name: str(fd, "name"), subject: l10n(fd, "subject"), body: l10n(fd, "body") };
    if (!data.name || !data.body.hy) return { error: "Լրացրեք անվանումը և հայերեն տեքստը" };
    if (id) await db.update(s.crmTemplates).set(data).where(eq(s.crmTemplates.id, id));
    else await db.insert(s.crmTemplates).values({ ...data, key: str(fd, "key") || `custom_${Date.now()}` });
    refresh();
    return ok();
  } catch (e) { return fail(e); }
}

export async function deleteTemplate(fd: FormData) {
  await requireAdmin();
  await db.delete(s.crmTemplates).where(and(eq(s.crmTemplates.id, str(fd, "id")), sql`${s.crmTemplates.key} like 'custom_%'`));
  refresh();
}

/* ---------------- campaigns (broadcast to a segment) ---------------- */
export async function sendCampaign(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const tplKey = str(fd, "template"), ch = str(fd, "channel");
    const channel = (CHANNELS as readonly string[]).includes(ch) ? (ch as Channel) : "auto";
    if (!tplKey) return { error: "Ընտրեք ձևանմուշը" };
    const conds: SQL[] = [eq(s.leads.unsubscribed, false), eq(s.leads.marketingOptIn, true)];
    const stages = fd.getAll("stages").map(String).filter((x) => stageOf(x)) as LeadStage[];
    if (stages.length) conds.push(inArray(s.leads.stage, stages));
    if (str(fd, "source")) conds.push(eq(s.leads.source, str(fd, "source")));
    if (str(fd, "courseId")) conds.push(eq(s.leads.courseId, str(fd, "courseId")));
    if (str(fd, "tag")) conds.push(sql`${s.leads.tags} ? ${str(fd, "tag")}`);
    if (num(fd, "minScore")) conds.push(sql`${s.leads.score} >= ${num(fd, "minScore")}`);
    const limit = Math.min(150, Math.max(1, num(fd, "limit", 100)));
    const targets = await db.select().from(s.leads).where(and(...conds)).limit(limit);
    if (bool(fd, "dry")) return ok(`Սեգմենտում ${targets.length} լիդ (առավելագույնը ${limit})։ Ուղարկելու համար հանեք «Միայն հաշվել» նշումը։`);
    const [c] = await db.insert(s.crmCampaigns).values({ name: str(fd, "name") || tplKey, channel, templateKey: tplKey, segment: { stages: stages.join(","), source: str(fd, "source"), courseId: str(fd, "courseId"), tag: str(fd, "tag") }, total: targets.length }).returning();
    let sent = 0, failed = 0;
    for (const l of targets) {
      const r = await sendTemplate(l, tplKey, { key: `camp:${c.id}`, channel, marketing: true });
      if (r.ok) sent++; else failed++;
      await new Promise((res) => setTimeout(res, 200)); // gentle pace for messengers
    }
    await db.update(s.crmCampaigns).set({ sent, failed }).where(eq(s.crmCampaigns.id, c.id));
    refresh();
    return ok(`Ուղարկված է ${sent}, չհաջողված ${failed} (չհաջողվածների մեծ մասը՝ կապի ալիք չունեցողներ)`);
  } catch (e) { return fail(e); }
}

/* ---------------- settings & maintenance ---------------- */
export async function saveCrm(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const cur = await getCrmSettings();
    await saveCrmSettings({
      ...cur,
      autoReply: bool(fd, "autoReply"), followUps: bool(fd, "followUps"), reminders: bool(fd, "reminders"),
      reviewRequest: bool(fd, "reviewRequest"), digest: bool(fd, "digest"),
      speedMinutes: Math.max(5, num(fd, "speedMinutes", cur.speedMinutes)),
      followUpDays: str(fd, "followUpDays").split(/[ ,]+/).map(Number).filter((n) => n > 0).slice(0, 3),
      reengageDays: Math.max(0, num(fd, "reengageDays", cur.reengageDays)),
      autoLoseDays: Math.max(0, num(fd, "autoLoseDays", cur.autoLoseDays)),
      dailyLimit: Math.min(300, Math.max(1, num(fd, "dailyLimit", cur.dailyLimit))),
    });
    refresh();
    return ok();
  } catch (e) { return fail(e); }
}

export async function importFromSite(_: ActionResult): Promise<ActionResult> {
  await requireAdmin();
  try {
    const { created } = await syncFromSite();
    refresh();
    return ok(`Համաժամեցված է։ Նոր լիդեր՝ ${created}`);
  } catch (e) { return fail(e); }
}

export async function runAutomationsNow(_: ActionResult): Promise<ActionResult> {
  await requireAdmin();
  try {
    const r = await runCrmDaily();
    refresh();
    return ok(`Պատրաստ է․ հետևողական՝ ${r.followUps}, հիշեցումներ՝ ${r.reminders}, վերաակտիվացում՝ ${r.reengaged}, կարծիքի խնդրանք՝ ${r.reviews}, փակված՝ ${r.lost}, նոր առաջադրանքներ՝ ${r.tasks}`);
  } catch (e) { return fail(e); }
}

export async function connectWebhooks(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const r = await ensureWebhooks(bool(fd, "force"));
    refresh();
    const parts = [
      r.greenApi ? `WhatsApp՝ ${r.greenApi === "ok" ? "միացված է" : r.greenApi.startsWith("conflict") ? `GREEN-API-ում արդեն կա այլ webhook (${r.greenApi.slice(9)}). նշեք «Փոխարինել» և կրկնեք` : r.greenApi}` : "WhatsApp՝ GREEN-API բանալիները դեռ չկան",
      r.telegram ? `Telegram՝ ${r.telegram === "ok" ? `միացված է (@${r.telegramUsername ?? ""})` : r.telegram}` : "Telegram՝ բոտի token-ը դեռ չկա",
    ];
    return ok(parts.join(" · "));
  } catch (e) { return fail(e); }
}
