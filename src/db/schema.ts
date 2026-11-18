import {
  pgTable, text, integer, boolean, timestamp, jsonb, pgEnum, serial, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/** Localized text: { hy, ru, en } */
export type L10n = { hy: string; ru: string; en: string };
export type L10nList = { hy: string[]; ru: string[]; en: string[] };

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", ["STUDENT", "ADMIN"]);
export const appStatusEnum = pgEnum("application_status", ["NEW", "INTERVIEW", "APPROVED", "REJECTED", "PAID", "CANCELLED"]);
export const payStatusEnum = pgEnum("payment_status", ["PENDING", "PAID", "FAILED", "REFUNDED"]);
export const payMethodEnum = pgEnum("payment_method", ["CARD", "IDRAM", "CASH", "TEST"]);
export const reviewStatusEnum = pgEnum("review_status", ["PENDING", "APPROVED", "REJECTED"]);
export const groupStatusEnum = pgEnum("group_status", ["OPEN", "FULL", "RUNNING", "FINISHED"]);

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  /** YYYY-MM-DD, given when signing an agreement */
  birthDate: text("birth_date"),
  role: roleEnum("role").notNull().default("STUDENT"),
  locale: text("locale").notNull().default("hy"),
  /** set when an admin blocks the account: no sign-in, no lessons, no reminders */
  blockedAt: timestamp("blocked_at", { withTimezone: true }),
  failedLogins: integer("failed_logins").notNull().default(0),
  loginLockedUntil: timestamp("login_locked_until", { withTimezone: true }),
  createdAt: created(),
});

export const tokens = pgTable("tokens", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // reset
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: created(),
});

export const directions = pgTable("directions", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: jsonb("title").$type<L10n>().notNull(),
  description: jsonb("description").$type<L10n>().notNull(),
  icon: text("icon").notNull().default("code"),
  published: boolean("published").notNull().default(true),
  order: integer("sort_order").notNull().default(0),
  createdAt: created(),
});

export const courses = pgTable("courses", {
  id: id(),
  slug: text("slug").notNull().unique(),
  code: text("code").notNull().unique(),
  directionId: text("direction_id").notNull().references(() => directions.id, { onDelete: "restrict" }),
  title: jsonb("title").$type<L10n>().notNull(),
  summary: jsonb("summary").$type<L10n>().notNull(),
  description: jsonb("description").$type<L10n>().notNull(),
  level: jsonb("level").$type<L10n>().notNull(),
  outcomes: jsonb("outcomes").$type<L10nList>().notNull(),
  requirements: jsonb("requirements").$type<L10n>().notNull(),
  hours: integer("hours").notNull(),
  theoryHours: integer("theory_hours").notNull().default(0),
  practiceHours: integer("practice_hours").notNull().default(0),
  weeks: integer("weeks").notNull(),
  lessonsPerWeek: integer("lessons_per_week").notNull().default(3),
  priceMonthly: integer("price_monthly").notNull(),
  priceFull: integer("price_full"),
  priceIndividual: integer("price_individual").notNull().default(125000),
  priceIndividualFull: integer("price_individual_full"),
  months: integer("months").notNull().default(3), // number of monthly instalments
  minAge: integer("min_age").notNull().default(16),
  imageUrl: text("image_url"),
  certificateUrl: text("certificate_url"),
  endorsement: text("endorsement"),
  /** Ministry endorsement order printed on certificates: number and date (YYYY-MM-DD) */
  endorsementNo: text("endorsement_no"),
  endorsementDate: text("endorsement_date"),
  published: boolean("published").notNull().default(true),
  featured: boolean("featured").notNull().default(true),
  order: integer("sort_order").notNull().default(0),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const courseModules = pgTable("course_modules", {
  id: id(),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  title: jsonb("title").$type<L10n>().notNull(),
  hours: integer("hours").notNull(),
  /** learning outcomes achieved, shown in the certificate supplement */
  outcomes: jsonb("outcomes").$type<Partial<L10n>>(),
  order: integer("sort_order").notNull().default(0),
});

export const groups = pgTable("groups", {
  id: id(),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  schedule: jsonb("schedule").$type<L10n>().notNull(),
  seats: integer("seats").notNull().default(12),
  status: groupStatusEnum("status").notNull().default("OPEN"),
  meetingUrl: text("meeting_url"),
  recordingsUrl: text("recordings_url"),
  createdAt: created(),
});

export const applications = pgTable("applications", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "restrict" }),
  groupId: text("group_id").references(() => groups.id, { onDelete: "set null" }),
  status: appStatusEnum("status").notNull().default("NEW"),
  plan: text("plan").notNull().default("monthly"),
  format: text("format").notNull().default("group"), // group | individual
  // price locked at enrollment (a signed contract's price never changes)
  monthlyAmount: integer("monthly_amount"),
  fullAmount: integer("full_amount"),
  months: integer("months"),
  startDate: timestamp("start_date", { withTimezone: true }), // individual start (groups use group.startDate)
  meetingUrl: text("meeting_url"), // personal lesson link for individual learners
  reminders: jsonb("reminders").$type<string[]>().notNull().default([]),
  note: text("note"),
  adminNote: text("admin_note"),
  contractNo: text("contract_no").unique(),
  /** electronic signature: when, by which typed name, and the exact text signed (never changes afterwards) */
  contractSignedAt: timestamp("contract_signed_at", { withTimezone: true }),
  contractSnapshot: jsonb("contract_snapshot").$type<import("@/lib/contract-types").ContractSnapshotData>(),
  lessonsDone: integer("lessons_done").notNull().default(0),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [index("applications_user_idx").on(t.userId)]);

export const payments = pgTable("payments", {
  id: id(),
  orderNo: serial("order_no").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  applicationId: text("application_id").references(() => applications.id, { onDelete: "set null" }),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("AMD"),
  method: payMethodEnum("method").notNull(),
  status: payStatusEnum("status").notNull().default("PENDING"),
  description: text("description").notNull(),
  providerRef: text("provider_ref"),
  providerData: jsonb("provider_data"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [index("payments_user_idx").on(t.userId)]);

export const lessons = pgTable("lessons", {
  id: id(),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  groupId: text("group_id").references(() => groups.id, { onDelete: "cascade" }), // null = every learner of the course
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }), // set = one individual learner
  title: jsonb("title").$type<L10n>().notNull(),
  moduleCode: text("module_code"),
  lessonDate: timestamp("lesson_date", { withTimezone: true }),
  videoUrl: text("video_url"),
  materialsUrl: text("materials_url"),
  published: boolean("published").notNull().default(true),
  order: integer("sort_order").notNull().default(0),
  createdAt: created(),
}, (t) => [index("lessons_course_idx").on(t.courseId)]);

export const reviews = pgTable("reviews", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId: text("course_id").references(() => courses.id, { onDelete: "set null" }),
  rating: integer("rating").notNull(),
  text: text("text").notNull(),
  locale: text("locale").notNull().default("hy"),
  status: reviewStatusEnum("status").notNull().default("PENDING"),
  reply: text("reply"),
  /** the review in each site language (original + translations) */
  textI18n: jsonb("text_i18n").$type<Partial<L10n>>(),
  replyI18n: jsonb("reply_i18n").$type<Partial<L10n>>(),
  createdAt: created(),
  moderatedAt: timestamp("moderated_at", { withTimezone: true }),
}, (t) => [index("reviews_status_idx").on(t.status)]);

export const certificates = pgTable("certificates", {
  id: id(),
  number: text("number").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  holderName: text("holder_name").notNull(),
  /** name in Latin letters for the English certificate and supplement */
  holderNameEn: text("holder_name_en"),
  projectTopic: text("project_topic"),
  projectTopicEn: text("project_topic_en"),
  projectUrl: text("project_url"),
  attendance: integer("attendance"),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "restrict" }),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  revoked: boolean("revoked").notNull().default(false),
  fileUrl: text("file_url"),
}, (t) => [uniqueIndex("certificates_number_idx").on(t.number)]);

export const posts = pgTable("posts", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: jsonb("title").$type<L10n>().notNull(),
  excerpt: jsonb("excerpt").$type<L10n>().notNull(),
  body: jsonb("body").$type<L10n>().notNull(),
  coverUrl: text("cover_url"),
  published: boolean("published").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const faqs = pgTable("faqs", {
  id: id(),
  question: jsonb("question").$type<L10n>().notNull(),
  answer: jsonb("answer").$type<L10n>().notNull(),
  order: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(true),
});

export const pages = pgTable("pages", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: jsonb("title").$type<L10n>().notNull(),
  body: jsonb("body").$type<L10n>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const subscribers = pgTable("subscribers", {
  id: id(),
  email: text("email").notNull().unique(),
  locale: text("locale").notNull().default("hy"),
  createdAt: created(),
});

export const messages = pgTable("messages", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message").notNull(),
  locale: text("locale").notNull().default("hy"),
  handled: boolean("handled").notNull().default(false),
  reply: text("reply"),
  repliedAt: timestamp("replied_at", { withTimezone: true }),
  createdAt: created(),
});

/* ---------------- CRM ---------------- */
export const leadStageEnum = pgEnum("lead_stage", ["NEW", "CONTACTED", "CONSULTATION", "TRIAL", "NEGOTIATION", "WON", "LOST"]);
export type LeadStage = (typeof leadStageEnum.enumValues)[number];
/** First-touch attribution captured from the URL / referrer */
export type Utm = { source?: string; medium?: string; campaign?: string; content?: string; term?: string; referrer?: string; landing?: string; clid?: string };

export const leads = pgTable("leads", {
  id: id(),
  name: text("name").notNull(),
  phone: text("phone"), // normalized digits, e.g. 37477123456
  email: text("email"),
  telegramChatId: text("telegram_chat_id"),
  telegramUsername: text("telegram_username"),
  instagramId: text("instagram_id"), // Instagram-scoped id (messaging)
  facebookId: text("facebook_id"), // Page-scoped id (Messenger)
  locale: text("locale").notNull().default("hy"),
  stage: leadStageEnum("stage").notNull().default("NEW"),
  source: text("source").notNull().default("other"),
  utm: jsonb("utm").$type<Utm>().notNull().default({}),
  courseId: text("course_id").references(() => courses.id, { onDelete: "set null" }),
  format: text("format"), // group | individual
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  score: integer("score").notNull().default(0),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  note: text("note"),
  lostReason: text("lost_reason"),
  nextActionAt: timestamp("next_action_at", { withTimezone: true }),
  nextAction: text("next_action"),
  lastContactAt: timestamp("last_contact_at", { withTimezone: true }), // our last outbound touch
  lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }), // their last message
  firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
  marketingOptIn: boolean("marketing_opt_in").notNull().default(true),
  unsubscribed: boolean("unsubscribed").notNull().default(false),
  sent: jsonb("sent").$type<string[]>().notNull().default([]), // automation steps already sent (idempotency keys)
  stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).notNull().defaultNow(),
  wonAt: timestamp("won_at", { withTimezone: true }),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("leads_stage_idx").on(t.stage), index("leads_phone_idx").on(t.phone), index("leads_email_idx").on(t.email),
  index("leads_user_idx").on(t.userId), index("leads_next_idx").on(t.nextActionAt),
]);

export const leadActivities = pgTable("lead_activities", {
  id: id(),
  leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  /** note | call | message_in | message_out | stage | task | system */
  type: text("type").notNull(),
  channel: text("channel"), // whatsapp | telegram | email | instagram | facebook | site | phone
  body: text("body").notNull().default(""),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: created(),
}, (t) => [index("lead_activities_lead_idx").on(t.leadId, t.createdAt)]);

export const crmTasks = pgTable("crm_tasks", {
  id: id(),
  leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  done: boolean("done").notNull().default(false),
  doneAt: timestamp("done_at", { withTimezone: true }),
  auto: boolean("auto").notNull().default(false),
  createdAt: created(),
}, (t) => [index("crm_tasks_due_idx").on(t.done, t.dueAt)]);

export const crmTemplates = pgTable("crm_templates", {
  id: id(),
  key: text("key").notNull().unique(), // used by automations, e.g. "welcome"
  name: text("name").notNull(),
  subject: jsonb("subject").$type<L10n>().notNull(),
  body: jsonb("body").$type<L10n>().notNull(),
  createdAt: created(),
});

export const crmCampaigns = pgTable("crm_campaigns", {
  id: id(),
  name: text("name").notNull(),
  channel: text("channel").notNull(),
  templateKey: text("template_key"),
  segment: jsonb("segment").$type<Record<string, string>>().notNull().default({}),
  total: integer("total").notNull().default(0),
  sent: integer("sent").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  createdAt: created(),
});

export const leadsRel = relations(leads, ({ one, many }) => ({
  course: one(courses, { fields: [leads.courseId], references: [courses.id] }),
  user: one(users, { fields: [leads.userId], references: [users.id] }),
  activities: many(leadActivities),
  tasks: many(crmTasks),
}));
export const leadActivitiesRel = relations(leadActivities, ({ one }) => ({
  lead: one(leads, { fields: [leadActivities.leadId], references: [leads.id] }),
}));
export const crmTasksRel = relations(crmTasks, ({ one }) => ({
  lead: one(leads, { fields: [crmTasks.leadId], references: [leads.id] }),
}));

/* relations */
export const directionsRel = relations(directions, ({ many }) => ({ courses: many(courses) }));
export const coursesRel = relations(courses, ({ one, many }) => ({
  direction: one(directions, { fields: [courses.directionId], references: [directions.id] }),
  modules: many(courseModules),
  groups: many(groups),
}));
export const modulesRel = relations(courseModules, ({ one }) => ({
  course: one(courses, { fields: [courseModules.courseId], references: [courses.id] }),
}));
export const groupsRel = relations(groups, ({ one, many }) => ({
  course: one(courses, { fields: [groups.courseId], references: [courses.id] }),
  applications: many(applications),
}));
export const applicationsRel = relations(applications, ({ one, many }) => ({
  user: one(users, { fields: [applications.userId], references: [users.id] }),
  course: one(courses, { fields: [applications.courseId], references: [courses.id] }),
  group: one(groups, { fields: [applications.groupId], references: [groups.id] }),
  payments: many(payments),
}));
export const paymentsRel = relations(payments, ({ one }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
  application: one(applications, { fields: [payments.applicationId], references: [applications.id] }),
}));
export const lessonsRel = relations(lessons, ({ one }) => ({
  course: one(courses, { fields: [lessons.courseId], references: [courses.id] }),
  group: one(groups, { fields: [lessons.groupId], references: [groups.id] }),
  user: one(users, { fields: [lessons.userId], references: [users.id] }),
}));
export const reviewsRel = relations(reviews, ({ one }) => ({
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
  course: one(courses, { fields: [reviews.courseId], references: [courses.id] }),
}));
export const certificatesRel = relations(certificates, ({ one }) => ({
  user: one(users, { fields: [certificates.userId], references: [users.id] }),
  course: one(courses, { fields: [certificates.courseId], references: [courses.id] }),
}));
export const usersRel = relations(users, ({ many }) => ({
  applications: many(applications),
  payments: many(payments),
  reviews: many(reviews),
  certificates: many(certificates),
}));
