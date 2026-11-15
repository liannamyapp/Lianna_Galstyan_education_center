"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { eq, like, sql } from "drizzle-orm";
import { db, s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { l10n, l10nList } from "@/lib/admin";
import { str, num, bool } from "@/lib/validate";
import { storeFile } from "@/lib/storage";
import { slugify } from "@/lib/format";
import { emailHtml, sendMail } from "@/lib/mail";
import { getDict, fmt, tr } from "@/lib/i18n";
import { markFailed, markPaid, markRefunded } from "@/lib/payments";
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
      contractNo: str(fd, "contractNo") || app.contractNo,
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
    await db.update(s.reviews).set({ status: status || r.status, reply: str(fd, "reply") || r.reply, text: str(fd, "text") || r.text, moderatedAt: new Date() }).where(eq(s.reviews.id, id));
    if (status === "APPROVED" && r.status !== "APPROVED") {
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
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.certificates).where(like(s.certificates.number, `${prefix}%`));
      number = `${prefix}${String(n + 1).padStart(3, "0")}`;
    }
    const userId = str(fd, "userId") || null;
    let holderName = str(fd, "holderName");
    if (!holderName && userId) holderName = (await db.select({ name: s.users.name }).from(s.users).where(eq(s.users.id, userId)).limit(1))[0]?.name ?? "";
    if (!holderName) return { error: "Նշեք ունկնդրի անունը" };
    const fileUrl = await storeFile(file(fd, "file"), "certificates");
    await db.insert(s.certificates).values({ number, userId, holderName, courseId, startDate: new Date(str(fd, "startDate")), endDate: new Date(str(fd, "endDate")), fileUrl });
    revalidatePath("/admin/certificates");
    return ok(`Վկայականը տրված է՝ № ${number}`);
  } catch (e) { return fail(e); }
}

export async function updateCertificate(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const fileUrl = await storeFile(file(fd, "file"), "certificates");
  await db.update(s.certificates).set({ revoked: bool(fd, "revoked"), ...(fileUrl ? { fileUrl } : {}) }).where(eq(s.certificates.id, id));
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
