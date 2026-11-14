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
  role: roleEnum("role").notNull().default("STUDENT"),
  locale: text("locale").notNull().default("hy"),
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
  createdAt: created(),
  moderatedAt: timestamp("moderated_at", { withTimezone: true }),
}, (t) => [index("reviews_status_idx").on(t.status)]);

export const certificates = pgTable("certificates", {
  id: id(),
  number: text("number").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  holderName: text("holder_name").notNull(),
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
