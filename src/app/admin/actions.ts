"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import { db, s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { l10n, l10nList } from "@/lib/admin";
import { str, num, bool } from "@/lib/validate";
import { storeFile } from "@/lib/storage";
import { slugify } from "@/lib/format";
import { emailHtml, sendMail } from "@/lib/mail";
import { getDict, fmt, tr, type Locale } from "@/lib/i18n";
import type { L10n } from "@/db/schema";
import { markFailed, markPaid, markRefunded } from "@/lib/payments";
import { priceFor } from "@/lib/billing";
import { autoTranslateEnabled, translateAll } from "@/lib/translate";
import { hyToLatin } from "@/lib/translit";
import { siteUrl } from "@/lib/seo";
import type { ActionResult } from "@/components/ActionForm";
import { syncLeadForUser } from "@/lib/crm/automations";
import { logOutbound } from "@/lib/crm/leads";

const ok = (message = "Պահպանված է"): ActionResult => ({ ok: true, message });
const fail = (e: unknown): ActionResult => ({ error: e instanceof Error ? e.message : "Սխալ" });
function refresh(...tags: string[]) {
  for (const t of tags.length ? tags : ["content"]) revalidateTag(t);
  revalidatePath("/", "layout");
}
const file = (fd: FormData, k: string) => (fd.get(k) instanceof File ? (fd.get(k) as File) : null);

/* ---------------- Directions ---------------- */
export async function saveDirection(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const id = str(fd, "id");
    const title = l10n(fd, "title");
    const data = {
      slug: slugify(str(fd, "slug") || title.en || title.hy) || `direction-${Date.now()}`,
      title, description: l10n(fd, "description"), icon: str(fd, "icon") || "code",
      published: bool(fd, "published"), order: num(fd, "order"),
    };
    if (id) await db.update(s.directions).set(data).where(eq(s.directions.id, id));
    else await db.insert(s.directions).values(data);
    refresh();
    return ok();
  } catch (e) { return fail(e); }
}

export async function deleteDirection(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.courses).where(eq(s.courses.directionId, id));
  if (n === 0) await db.delete(s.directions).where(eq(s.directions.id, id));
  refresh();
}

/* ---------------- Courses ---------------- */
export async function saveCourse(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  let id = str(fd, "id");
  try {
    const title = l10n(fd, "title");
    const image = await storeFile(file(fd, "image"), "courses");
    const cert = await storeFile(file(fd, "certificate"), "certificates");
    const data = {
      slug: slugify(str(fd, "slug") || title.en || str(fd, "code")),
      code: str(fd, "code").toUpperCase(),
      directionId: str(fd, "directionId"),
      title, summary: l10n(fd, "summary"), description: l10n(fd, "description"), level: l10n(fd, "level"),
      outcomes: l10nList(fd, "outcomes"), requirements: l10n(fd, "requirements"),
      hours: num(fd, "hours"), theoryHours: num(fd, "theoryHours"), practiceHours: num(fd, "practiceHours"),
      weeks: num(fd, "weeks"), lessonsPerWeek: num(fd, "lessonsPerWeek", 3),
      priceMonthly: num(fd, "priceMonthly"), priceFull: num(fd, "priceFull") || null,
      priceIndividual: num(fd, "priceIndividual", 125000), priceIndividualFull: num(fd, "priceIndividualFull") || null, months: Math.max(1, num(fd, "months", 3)), minAge: num(fd, "minAge", 16),
      endorsement: str(fd, "endorsement") || null,
      endorsementNo: str(fd, "endorsementNo") || null,
      endorsementDate: /^\d{4}-\d{2}-\d{2}$/.test(str(fd, "endorsementDate")) ? str(fd, "endorsementDate") : null,
      published: bool(fd, "published"), featured: bool(fd, "featured"), order: num(fd, "order"),
      ...(image ? { imageUrl: image } : {}), ...(cert ? { certificateUrl: cert } : {}),
    };
    if (!data.code || !data.directionId || !data.title.hy || data.hours <= 0 || data.priceMonthly <= 0) return { error: "Լրացրեք կոդը, ուղղությունը, հայերեն անվանումը, ժամերը և գինը։" };
    if (id) await db.update(s.courses).set(data).where(eq(s.courses.id, id));
    else id = (await db.insert(s.courses).values(data).returning({ id: s.courses.id }))[0].id;

    // modules: rows m_code[], m_hours[], m_title_hy[] ...
    const codes = fd.getAll("m_code").map(String);
    const hours = fd.getAll("m_hours").map(Number);
    const hy = fd.getAll("m_title_hy").map(String), ru = fd.getAll("m_title_ru").map(String), en = fd.getAll("m_title_en").map(String);
    await db.delete(s.courseModules).where(eq(s.courseModules.courseId, id));
    const rows = codes.map((code, i) => ({ courseId: id, code: code.trim() || `Մ${i + 1}`, hours: hours[i] || 0, title: { hy: hy[i]?.trim() ?? "", ru: ru[i]?.trim() ?? "", en: en[i]?.trim() ?? "" }, order: i }))
      .filter((r) => r.title.hy);
    if (rows.length) await db.insert(s.courseModules).values(rows);
    refresh();
  } catch (e) { return fail(e); }
  redirect(`/admin/courses/${id}?saved=1`);
}

export async function deleteCourse(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.applications).where(eq(s.applications.courseId, id));
  if (n > 0) await db.update(s.courses).set({ published: false }).where(eq(s.courses.id, id));
  else await db.delete(s.courses).where(eq(s.courses.id, id));
  refresh();
  redirect("/admin/courses");
}

/* ---------------- Groups ---------------- */
export async function saveGroup(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const id = str(fd, "id");
    const data = {
      courseId: str(fd, "courseId"), name: str(fd, "name") || "Խումբ", startDate: new Date(str(fd, "startDate")),
      schedule: l10n(fd, "schedule"), seats: num(fd, "seats", 12),
      status: (str(fd, "status") || "OPEN") as "OPEN" | "FULL" | "RUNNING" | "FINISHED",
      meetingUrl: str(fd, "meetingUrl") || null, recordingsUrl: str(fd, "recordingsUrl") || null,
    };
    if (!data.courseId || isNaN(+data.startDate)) return { error: "Ընտրեք դասընթացը և մեկնարկի ամսաթիվը։" };
    if (id) await db.update(s.groups).set(data).where(eq(s.groups.id, id));
    else await db.insert(s.groups).values(data);
    refresh();
    return ok();
  } catch (e) { return fail(e); }
}

export async function deleteGroup(fd: FormData) {
  await requireAdmin();
  await db.delete(s.groups).where(eq(s.groups.id, str(fd, "id")));
  refresh();
}

/* ---------------- Applications ---------------- */
export async function updateApplication(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const id = str(fd, "id");
    const app = await db.query.applications.findFirst({ where: eq(s.applications.id, id), with: { user: true, course: true } });
    if (!app) return { error: "Չի գտնվել" };
    const status = str(fd, "status") as typeof app.status;
    await db.update(s.applications).set({
      status, adminNote: str(fd, "adminNote") || null, groupId: str(fd, "groupId") || null, lessonsDone: num(fd, "lessonsDone", app.lessonsDone),
      contractNo: app.contractSignedAt ? app.contractNo : str(fd, "contractNo") || app.contractNo,
      format: str(fd, "format") === "individual" ? "individual" : "group",
      startDate: str(fd, "startDate") ? new Date(str(fd, "startDate")) : null,
      monthlyAmount: num(fd, "monthlyAmount") || app.monthlyAmount,
      months: num(fd, "months") || app.months,
      meetingUrl: str(fd, "meetingUrl") || null,
    }).where(eq(s.applications.id, id));
    if (status !== app.status && bool(fd, "notify")) {
      const t = getDict(app.user.locale);
      const custom = str(fd, "message");
      await sendMail(app.user.email, t.mail.statusSubject, emailHtml(t.mail.statusSubject, [
        `${app.user.name},`, fmt(t.mail.statusBody, { course: tr(app.course.title, app.user.locale), status: t.account.status[status] }), ...(custom ? [custom] : []),
      ], { label: t.mail.openAccount, url: `${siteUrl()}/${app.user.locale}/account` }));
    }
    if (status !== app.status) await syncLeadForUser(app.userId); // CRM stage follows the application
    revalidatePath("/admin/applications");
    return ok(status !== app.status && bool(fd, "notify") ? "Պահպանված է, նամակն ուղարկված է" : undefined);
  } catch (e) { return fail(e); }
}

/* ---------------- Payments ---------------- */
export async function addManualPayment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const app = await db.query.applications.findFirst({ where: eq(s.applications.id, str(fd, "applicationId")), with: { course: true } });
    if (!app) return { error: "Ընտրեք հայտը" };
    const amount = num(fd, "amount");
    if (amount <= 0) return { error: "Գումարը սխալ է" };
    // paying the whole course at its (discounted) full price switches the plan to "full": nothing more is due.
    // Automatic when the very first payment equals the full price; otherwise the admin ticks the box.
    const fullPrice = app.fullAmount ?? priceFor(app.course, app.format).full;
    const earlier = await db.select({ id: s.payments.id }).from(s.payments).where(and(eq(s.payments.applicationId, app.id), eq(s.payments.status, "PAID"))).limit(1);
    if (app.plan !== "full" && fullPrice && (bool(fd, "full") || (!earlier.length && amount === fullPrice))) {
      await db.update(s.applications).set({ plan: "full", fullAmount: fullPrice }).where(eq(s.applications.id, app.id));
    }
    const [p] = await db.insert(s.payments).values({ userId: app.userId, applicationId: app.id, amount, method: "CASH", description: str(fd, "description") || `${app.course.code} · կանխիկ / փոխանցում` }).returning();
    await markPaid(p.id, "MANUAL");
    revalidatePath("/admin/payments");
    return ok();
  } catch (e) { return fail(e); }
}

export async function setPaymentStatus(fd: FormData) {
  await requireAdmin();
  const status = str(fd, "status") as "PAID" | "REFUNDED" | "FAILED";
  const id = str(fd, "id");
  if (status === "PAID") await markPaid(id, "MANUAL");
  else if (status === "FAILED") await markFailed(id);
  else if (status === "REFUNDED") await markRefunded(id);
  revalidatePath("/admin/payments");
}

/* ---------------- Reviews ---------------- */
export async function moderateReview(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const status = str(fd, "status") as "APPROVED" | "REJECTED" | "PENDING";
  const r = await db.query.reviews.findFirst({ where: eq(s.reviews.id, id), with: { user: true } });
  if (!r) return;
  if (str(fd, "op") === "delete") {
    await db.delete(s.reviews).where(eq(s.reviews.id, id));
  } else {
    const text = str(fd, "text") || r.text;
    const reply = str(fd, "reply");
    const src = (["hy", "ru", "en"].includes(r.locale) ? r.locale : "hy") as Locale;
    // translations typed by the admin; the original language always mirrors the main text
    const pick = (prefix: string) => Object.fromEntries((["hy", "ru", "en"] as const).map((l) => [l, str(fd, `${prefix}_${l}`)]).filter(([, v]) => v)) as Partial<L10n>;
    let textI18n: Partial<L10n> = { ...pick("text"), [src]: text };
    let replyI18n: Partial<L10n> = reply ? { ...pick("reply") } : {};
    const forceAuto = str(fd, "op") === "translate";
    const textChanged = text !== r.text;
    const missing = (v: Partial<L10n>) => (["hy", "ru", "en"] as const).some((l) => !v[l]);
    if (autoTranslateEnabled() && (forceAuto || textChanged || ((status === "APPROVED" || forceAuto) && missing(textI18n)))) {
      const auto = await translateAll(text, src);
      textI18n = forceAuto || textChanged ? { ...textI18n, ...auto, [src]: text } : { ...auto, ...textI18n };
    }
    if (reply && (forceAuto || missing(replyI18n) || reply !== r.reply)) {
      const auto = await translateAll(reply, "hy");
      replyI18n = forceAuto || reply !== r.reply ? { ...replyI18n, ...auto } : { ...auto, ...replyI18n };
    }
    await db.update(s.reviews).set({
      status: forceAuto ? r.status : status || r.status, text, reply: reply || null,
      textI18n, replyI18n: reply ? replyI18n : null, moderatedAt: new Date(),
    }).where(eq(s.reviews.id, id));
    if (!forceAuto && status === "APPROVED" && r.status !== "APPROVED") {
      const t = getDict(r.user.locale);
      await sendMail(r.user.email, t.mail.reviewSubject, emailHtml(t.mail.reviewSubject, [`${r.user.name},`, t.mail.reviewBody], { label: tr({ hy: "Կայք", ru: "Сайт", en: "Website" }, r.user.locale), url: `${siteUrl()}/${r.user.locale}#reviews` }));
    }
  }
  refresh("reviews");
  revalidatePath("/admin/reviews");
}

/* ---------------- Messages ---------------- */
export async function replyMessage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const id = str(fd, "id"), reply = str(fd, "reply");
    const [m] = await db.select().from(s.messages).where(eq(s.messages.id, id)).limit(1);
    if (!m || reply.length < 2) return { error: "Գրեք պատասխանը" };
    const t = getDict(m.locale);
    await sendMail(m.email, t.mail.contactReplySubject, emailHtml(t.mail.contactReplySubject, [`${m.name},`, ...reply.split("\n").filter(Boolean), "—", t.mail.yourMessage, m.message]));
    await db.update(s.messages).set({ reply, repliedAt: new Date(), handled: true }).where(eq(s.messages.id, id));
    await logOutbound({ email: m.email }, reply, "email"); // CRM timeline + response time
    revalidatePath("/admin/messages");
    return ok("Պատասխանն ուղարկված է");
  } catch (e) { return fail(e); }
}

export async function toggleMessage(fd: FormData) {
  await requireAdmin();
  await db.update(s.messages).set({ handled: str(fd, "handled") === "1" }).where(eq(s.messages.id, str(fd, "id")));
  revalidatePath("/admin/messages");
}

/* ---------------- Certificates ---------------- */
export async function issueCertificate(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const courseId = str(fd, "courseId");
    const [course] = await db.select().from(s.courses).where(eq(s.courses.id, courseId)).limit(1);
    if (!course) return { error: "Ընտրեք դասընթացը" };
    let number = str(fd, "number").toUpperCase();
    if (!number) {
      const year = new Date(str(fd, "endDate") || Date.now()).getFullYear();
      const prefix = `${course.code}/${year}/`;
      // Next number after the highest one ever issued with this prefix. Certificates are never deleted
      // (only revoked), so a number is never reused and never left as a gap.
      const [{ n }] = await db.select({ n: sql<number>`coalesce(max(substring(${s.certificates.number} from '([0-9]+)$')::int), 0)::int` }).from(s.certificates).where(like(s.certificates.number, `${prefix}%`));
      number = `${prefix}${String(n + 1).padStart(3, "0")}`;
    }
    const userId = str(fd, "userId") || null;
    let holderName = str(fd, "holderName");
    if (!holderName && userId) holderName = (await db.select({ name: s.users.name }).from(s.users).where(eq(s.users.id, userId)).limit(1))[0]?.name ?? "";
    if (!holderName) return { error: "Նշեք ունկնդրի անունը" };
    const fileUrl = await storeFile(file(fd, "file"), "certificates");
    const manual = Boolean(str(fd, "number"));
    for (let attempt = 0; ; attempt++) {
      try {
        await db.insert(s.certificates).values({ number, userId, holderName, courseId, startDate: new Date(str(fd, "startDate")), endDate: new Date(str(fd, "endDate")), fileUrl, ...certExtras(fd, holderName) });
        break;
      } catch (e) {
        // two certificates issued at the same moment: take the next number (a number typed by hand is never changed)
        if (manual || attempt >= 3 || !String((e as { code?: string })?.code ?? e).includes("23505")) throw manual && String((e as { code?: string })?.code ?? e).includes("23505") ? new Error(`№ ${number} արդեն տրված է`) : e;
        const m = number.match(/^(.*\/)(\d+)$/);
        if (!m) throw e;
        number = `${m[1]}${String(Number(m[2]) + 1).padStart(3, "0")}`;
      }
    }
    if (userId) {
      const [u] = await db.select({ email: s.users.email, name: s.users.name, locale: s.users.locale }).from(s.users).where(eq(s.users.id, userId)).limit(1);
      if (u?.email) {
        const loc = (["hy", "ru", "en"].includes(u.locale) ? u.locale : "hy") as Locale;
        const T = getDict(loc).account;
        await sendMail(u.email, T.certMailSubject, emailHtml(T.certMailSubject, [`${u.name},`, fmt(T.certMailBody, { no: number, course: `${course.code} · ${tr(course.title, loc)}` })], { label: T.certMailCta, url: `${siteUrl()}/${loc}/account#documents` }));
      }
    }
    revalidatePath("/admin/certificates");
    return ok(`Վկայականը տրված է՝ № ${number}`);
  } catch (e) { return fail(e); }
}

/** Optional details printed on the English certificate and the supplement. */
function certExtras(fd: FormData, holderName: string) {
  const att = Number(str(fd, "attendance"));
  return {
    holderNameEn: str(fd, "holderNameEn") || hyToLatin(holderName),
    projectTopic: str(fd, "projectTopic") || null,
    projectTopicEn: str(fd, "projectTopicEn") || null,
    projectUrl: str(fd, "projectUrl") || null,
    attendance: str(fd, "attendance") && Number.isFinite(att) ? Math.min(100, Math.max(0, Math.round(att))) : null,
  };
}

export async function updateCertificate(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const fileUrl = await storeFile(file(fd, "file"), "certificates");
  const [c] = await db.select().from(s.certificates).where(eq(s.certificates.id, id)).limit(1);
  if (!c) return;
  const holderName = str(fd, "holderName") || c.holderName;
  await db.update(s.certificates).set({
    revoked: bool(fd, "revoked"), ...(fileUrl ? { fileUrl } : {}),
    ...(fd.has("holderNameEn") ? { holderName, ...certExtras(fd, holderName) } : {}),
  }).where(eq(s.certificates.id, id));
  revalidatePath("/admin/certificates");
}

/* ---------------- Posts ---------------- */
export async function savePost(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  let id = str(fd, "id");
  try {
    const title = l10n(fd, "title");
    const cover = await storeFile(file(fd, "cover"), "blog");
    const published = bool(fd, "published");
    const [prev] = id ? await db.select().from(s.posts).where(eq(s.posts.id, id)).limit(1) : [];
    const data = {
      slug: slugify(str(fd, "slug") || title.en || title.ru) || `post-${Date.now()}`, title, excerpt: l10n(fd, "excerpt"), body: l10n(fd, "body"), published,
      publishedAt: published ? prev?.publishedAt ?? new Date() : prev?.publishedAt ?? null, ...(cover ? { coverUrl: cover } : {}),
    };
    if (!title.hy) return { error: "Լրացրեք վերնագիրը" };
    if (id) await db.update(s.posts).set(data).where(eq(s.posts.id, id));
    else id = (await db.insert(s.posts).values(data).returning({ id: s.posts.id }))[0].id;
    refresh();
  } catch (e) { return fail(e); }
  redirect(`/admin/posts/${id}?saved=1`);
}

export async function deletePost(fd: FormData) {
  await requireAdmin();
  await db.delete(s.posts).where(eq(s.posts.id, str(fd, "id")));
  refresh();
  redirect("/admin/posts");
}

/* ---------------- FAQ ---------------- */
export async function saveFaq(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const id = str(fd, "id");
    const data = { question: l10n(fd, "question"), answer: l10n(fd, "answer"), order: num(fd, "order"), published: bool(fd, "published") };
    if (!data.question.hy) return { error: "Լրացրեք հարցը" };
    if (id) await db.update(s.faqs).set(data).where(eq(s.faqs.id, id));
    else await db.insert(s.faqs).values(data);
    refresh();
    return ok();
  } catch (e) { return fail(e); }
}

export async function deleteFaq(fd: FormData) {
  await requireAdmin();
  await db.delete(s.faqs).where(eq(s.faqs.id, str(fd, "id")));
  refresh();
}

/* ---------------- Pages ---------------- */
export async function savePage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const slug = str(fd, "slug");
    const data = { slug, title: l10n(fd, "title"), body: l10n(fd, "body") };
    await db.insert(s.pages).values(data).onConflictDoUpdate({ target: s.pages.slug, set: { title: data.title, body: data.body, updatedAt: new Date() } });
    refresh();
    return ok();
  } catch (e) { return fail(e); }
}

/* ---------------- Settings ---------------- */
export async function saveSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const photo = await storeFile(file(fd, "instructorPhoto"), "site");
    const stats = [0, 1, 2, 3].map((i) => ({ value: str(fd, `stat${i}_value`), label: l10n(fd, `stat${i}`) })).filter((x) => x.value);
    const values: Record<string, unknown> = {
      site: { name: l10n(fd, "siteName"), tagline: l10n(fd, "tagline"), description: l10n(fd, "description") },
      hero: { eyebrow: l10n(fd, "heroEyebrow"), title: l10n(fd, "heroTitle"), subtitle: l10n(fd, "heroSubtitle") },
      stats,
      instructor: {
        name: l10n(fd, "instName"), role: l10n(fd, "instRole"), bio: l10n(fd, "instBio"),
        tags: str(fd, "instTags").split("\n").map((x) => x.trim()).filter(Boolean),
        ...(photo ? { photoUrl: photo } : { photoUrl: str(fd, "instructorPhotoUrl") || "/images/instructor.webp" }),
      },
      contacts: {
        phone: str(fd, "phone"), email: str(fd, "email"), telegram: str(fd, "telegram"), whatsapp: str(fd, "whatsapp"),
        instagram: str(fd, "instagram"), facebook: str(fd, "facebook"), city: l10n(fd, "city"),
      },
      legal: { entity: l10n(fd, "entity"), tin: str(fd, "tin"), endorsement: l10n(fd, "endorsement") },
      payments: { card: bool(fd, "payCard"), idram: bool(fd, "payIdram"), reminderDays: Math.min(20, Math.max(1, num(fd, "reminderDays", 5))), graceDays: Math.min(60, Math.max(0, num(fd, "graceDays", 7))) },
      adminEmail: str(fd, "adminEmail"),
    };
    for (const [key, value] of Object.entries(values)) {
      await db.insert(s.settings).values({ key, value }).onConflictDoUpdate({ target: s.settings.key, set: { value } });
    }
    refresh("settings", "content");
    return ok();
  } catch (e) { return fail(e); }
}

/* ---------------- Users ---------------- */
export async function setUserRole(fd: FormData) {
  const me = await requireAdmin();
  const id = str(fd, "id");
  if (id === me.id) return;
  await db.update(s.users).set({ role: str(fd, "role") === "ADMIN" ? "ADMIN" : "STUDENT" }).where(eq(s.users.id, id));
  revalidatePath("/admin/students");
}

/** Permanently removes the selected students and everything tied to them (applications, payments, reviews, CRM lead). Admin accounts are never touched. */
export async function deleteUsers(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireAdmin();
  try {
    const ids = fd.getAll("ids").map(String).filter((x) => x && x !== me.id);
    if (!ids.length) return { error: "Ընտրեք ունկնդիրներին" };
    if (fd.get("confirm") !== "1") return { error: "Նշեք «Հաստատում եմ» դաշտը" };
    const list = await db.select({ id: s.users.id, email: s.users.email }).from(s.users).where(and(inArray(s.users.id, ids), eq(s.users.role, "STUDENT")));
    if (!list.length) return { error: "Ադմինի հաշիվները չեն ջնջվում" };
    const uids = list.map((u) => u.id), emails = list.map((u) => u.email);
    await db.delete(s.leads).where(or(inArray(s.leads.userId, uids), inArray(s.leads.email, emails)));
    await db.delete(s.messages).where(inArray(s.messages.email, emails));
    // Issued certificates stay in the register (number, holder name, course, dates) and remain verifiable;
    // only the link to the removed account is cleared (user_id → null).
    await db.update(s.certificates).set({ userId: null }).where(inArray(s.certificates.userId, uids));
    await db.delete(s.users).where(inArray(s.users.id, uids)); // applications, payments, reviews, tokens cascade
    refresh("reviews");
    for (const path of ["/admin/students", "/admin/payments", "/admin/applications", "/admin/reviews", "/admin/crm/leads", "/admin/certificates", "/admin"]) revalidatePath(path);
    if (fd.get("back") !== "1") return ok(`Ջնջված է՝ ${list.length} ունկնդիր`);
  } catch (e) { return fail(e); }
  redirect("/admin/students"); // removed from the student's own page → back to the list
}

/** Removes the admin's own test enrollments, payments and reviews; the account itself stays. */
export async function clearMyTestData(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireAdmin();
  try {
    if (fd.get("confirm") !== "1") return { error: "Նշեք «Հաստատում եմ» դաշտը" };
    await db.delete(s.payments).where(eq(s.payments.userId, me.id));
    await db.delete(s.reviews).where(eq(s.reviews.userId, me.id));
    await db.delete(s.applications).where(eq(s.applications.userId, me.id));
    await db.delete(s.leads).where(eq(s.leads.userId, me.id));
    refresh("reviews");
    for (const path of ["/admin/students", "/admin/payments", "/admin/applications", "/admin/reviews", "/admin"]) revalidatePath(path);
    return ok("Ձեր փորձնական հայտերը, վճարումները և կարծիքները ջնջված են");
  } catch (e) { return fail(e); }
}

/** After testing: numbering continues from the data that is still in the database, as if the removed (test)
 *  learners had never existed. Removes certificates of deleted accounts, resets the contract counter and the payment
 *  order number. Numbers of learners who are still in the list are never touched. */
export async function resetNumbering(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    if (str(fd, "confirm").trim().toUpperCase() !== "ԶՐՈՅԱՑՆԵԼ") return { error: "Հաստատելու համար դաշտում գրեք՝ ԶՐՈՅԱՑՆԵԼ" };
    const removed = await db.delete(s.certificates).where(sql`${s.certificates.userId} is null`).returning({ id: s.certificates.id });
    await db.delete(s.settings).where(like(s.settings.key, "contract_seq_%"));
    await db.execute(sql`select setval(pg_get_serial_sequence('payments', 'order_no'), coalesce((select max(order_no) from payments), 0) + 1, false)`);
    for (const path of ["/admin/students", "/admin/certificates", "/admin/payments", "/admin/applications"]) revalidatePath(path);
    return ok(`Համարակալումը զրոյացված է${removed.length ? ` · ջնջված է հեռացված հաշիվների ${removed.length} վկայական` : ""}`);
  } catch (e) { return fail(e); }
}

/** Blocks or unblocks a student account. Blocking ends access at once (sessions, lessons, reviews, reminders). */
export async function setUserBlocked(fd: FormData) {
  const me = await requireAdmin();
  const id = str(fd, "id");
  if (!id || id === me.id) return;
  const block = str(fd, "block") === "1";
  await db.update(s.users).set({ blockedAt: block ? new Date() : null }).where(and(eq(s.users.id, id), eq(s.users.role, "STUDENT")));
  revalidatePath("/admin/students");
}

export async function deleteSubscriber(fd: FormData) {
  await requireAdmin();
  await db.delete(s.subscribers).where(eq(s.subscribers.id, str(fd, "id")));
  revalidatePath("/admin/subscribers");
}


/* ---------------- Video lessons ---------------- */
export async function saveLesson(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const id = str(fd, "id");
    const courseId = str(fd, "courseId");
    const aud = str(fd, "audience") || "all";
    const data = {
      courseId,
      groupId: aud.startsWith("g:") ? aud.slice(2) : null,
      userId: aud.startsWith("u:") ? aud.slice(2) : null,
      title: l10n(fd, "title"),
      moduleCode: str(fd, "moduleCode") || null,
      lessonDate: str(fd, "lessonDate") ? new Date(str(fd, "lessonDate")) : null,
      videoUrl: str(fd, "videoUrl") || null,
      materialsUrl: str(fd, "materialsUrl") || null,
      published: bool(fd, "published"),
      order: num(fd, "order", 0),
    };
    if (!courseId || !data.title.hy) return { error: "Ընտրեք դասընթացը և լրացրեք հայերեն վերնագիրը։" };
    if (!data.videoUrl && !data.materialsUrl) return { error: "Ավելացրեք տեսանյութի կամ նյութերի հղումը (կամ վերբեռնեք ֆայլը)։" };
    if (id) await db.update(s.lessons).set(data).where(eq(s.lessons.id, id));
    else await db.insert(s.lessons).values(data);

    let sent = 0;
    if (!id && data.published && bool(fd, "notify")) {
      const apps = await db.query.applications.findMany({ where: eq(s.applications.courseId, courseId), with: { user: true, course: true } });
      const targets = apps.filter((a) => a.status === "PAID" && (!data.groupId || a.groupId === data.groupId) && (!data.userId || a.userId === data.userId));
      for (const a of targets) {
        const l = a.user.locale;
        const t = getDict(l);
        const vars = { title: tr(data.title, l), course: tr(a.course.title, l) };
        await sendMail(a.user.email, fmt(t.mailx.lessonSubject, vars), emailHtml(fmt(t.mailx.lessonSubject, vars), [`${a.user.name},`, fmt(t.mailx.lessonBody, vars)], { label: t.mailx.lessonBtn, url: `${siteUrl()}/${l}/account/lessons/${a.id}` }));
        sent++;
      }
    }
    revalidatePath("/admin/lessons");
    return ok(sent ? `Պահպանված է, ծանուցվել է ${sent} ունկնդիր` : undefined);
  } catch (e) { return fail(e); }
}

export async function deleteLesson(fd: FormData) {
  await requireAdmin();
  await db.delete(s.lessons).where(eq(s.lessons.id, str(fd, "id")));
  revalidatePath("/admin/lessons");
}
