import "server-only";
import { eq } from "drizzle-orm";
import { db, s } from "@/db";
import type { L10n } from "@/db/schema";

export type CrmSettings = {
  /** Instant reply to every new lead on the channel they used (or the best available one). */
  autoReply: boolean;
  /** Minutes the admin has to make first contact with a new lead (task due time). */
  speedMinutes: number;
  /** Automatic follow-ups to silent NEW/CONTACTED leads, in days after creation. */
  followUps: boolean;
  followUpDays: number[];
  /** Day-before reminder for scheduled consultations / trial lessons. */
  reminders: boolean;
  /** Re-engage LOST leads after N days (0 = off). */
  reengageDays: number;
  /** Ask paid learners for a review and a referral once their course ends. */
  reviewRequest: boolean;
  /** Mark a lead LOST automatically after N days without any reply (0 = off). */
  autoLoseDays: number;
  /** Daily digest for the admin (e-mail + WhatsApp). */
  digest: boolean;
  /** Messages per automation run, to stay far from messenger spam limits. */
  dailyLimit: number;
};

export const defaultCrm: CrmSettings = {
  autoReply: true, speedMinutes: 30, followUps: true, followUpDays: [1, 3, 7], reminders: true,
  reengageDays: 30, reviewRequest: true, autoLoseDays: 45, digest: true, dailyLimit: 80,
};

export async function getCrmSettings(): Promise<CrmSettings> {
  try {
    const [row] = await db.select().from(s.settings).where(eq(s.settings.key, "crm")).limit(1);
    return { ...defaultCrm, ...((row?.value as Partial<CrmSettings>) ?? {}) };
  } catch {
    return defaultCrm;
  }
}

export async function saveCrmSettings(v: CrmSettings) {
  await db.insert(s.settings).values({ key: "crm", value: v }).onConflictDoUpdate({ target: s.settings.key, set: { value: v } });
}

const L = (hy: string, ru: string, en: string): L10n => ({ hy, ru, en });

/** Message templates used by the automations. Admin can edit every text in /admin/crm/templates. */
export const DEFAULT_TEMPLATES: { key: string; name: string; subject: L10n; body: L10n }[] = [
  {
    key: "welcome", name: "Ողջույն նոր լիդին (ավտոմատ, անմիջապես)",
    subject: L("Շնորհակալություն դիմելու համար", "Спасибо за обращение", "Thank you for reaching out"),
    body: L(
      "Բարև, {name} 👋\nՇնորհակալություն {center}-ին դիմելու համար։ Ես կապ կհաստատեմ Ձեզ հետ մոտակա ժամերին։\nՄինչ այդ կարող եք ծանոթանալ դասընթացներին՝ {link}",
      "Здравствуйте, {name} 👋\nСпасибо, что обратились в {center}. Я свяжусь с вами в ближайшие часы.\nА пока можно посмотреть курсы: {link}",
      "Hi {name} 👋\nThank you for contacting {center}. I will get back to you within a few hours.\nMeanwhile, have a look at our courses: {link}"
    ),
  },
  {
    key: "followup_1", name: "Հետևողական №1 (1 օր հետո)",
    subject: L("Ունե՞ք հարցեր դասընթացի մասին", "Остались вопросы о курсе?", "Any questions about the course?"),
    body: L(
      "{name}, բարև։ Ուզում էի ճշտել՝ կա՞ն հարցեր դասընթացի վերաբերյալ։ Կարող ենք անցկացնել 15 րոպեանոց անվճար խորհրդատվություն, որտեղ կպատմեմ ծրագրի, գրաֆիկի և վճարման մասին։",
      "{name}, здравствуйте! Хотела уточнить, остались ли вопросы по курсу. Можем провести бесплатную 15-минутную консультацию: расскажу о программе, графике и оплате.",
      "Hi {name}! Just checking whether you have any questions about the course. We can do a free 15-minute consultation about the programme, schedule and payment."
    ),
  },
  {
    key: "followup_2", name: "Հետևողական №2 (3 օր հետո)",
    subject: L("Մոտակա խումբը մեկնարկում է շուտով", "Ближайшая группа скоро стартует", "The next group starts soon"),
    body: L(
      "{name}, մոտակա խումբը մեկնարկում է {date}-ին, տեղերի քանակը սահմանափակ է։ Եթե ցանկանում եք, կամրագրեմ Ձեզ համար տեղ, կամ կարող ենք սկսել անհատական ձևաչափով։ {link}",
      "{name}, ближайшая группа стартует {date}, мест немного. Могу забронировать для вас место или начать в индивидуальном формате. {link}",
      "{name}, the next group starts on {date} and seats are limited. I can reserve a place for you, or we can start one-to-one. {link}"
    ),
  },
  {
    key: "followup_3", name: "Հետևողական №3 (7 օր հետո, վերջին)",
    subject: L("Վերջին հիշեցում", "Последнее напоминание", "A last reminder"),
    body: L(
      "{name}, չեմ ուզում անհանգստացնել 🙂 Եթե հիմա հարմար ժամանակ չէ, ոչ մի խնդիր, պարզապես գրեք «ավելի ուշ», և կտեղեկացնեմ հաջորդ խմբերի մասին։",
      "{name}, не хочу беспокоить 🙂 Если сейчас неудобно — ничего страшного, просто напишите «позже», и я сообщу о следующих группах.",
      "{name}, I don't want to bother you 🙂 If now isn't the right time, just reply \"later\" and I'll let you know about future groups."
    ),
  },
  {
    key: "reminder", name: "Հիշեցում խորհրդատվության / փորձնական դասի մասին (1 օր առաջ)",
    subject: L("Հիշեցում՝ վաղը հանդիպում ենք", "Напоминание: встречаемся завтра", "Reminder: see you tomorrow"),
    body: L(
      "{name}, հիշեցնում եմ՝ վաղը՝ {date}, մեր հանդիպումն է։ Եթե ժամը չի համապատասխանում, գրեք, և կփոխենք։",
      "{name}, напоминаю: завтра, {date}, наша встреча. Если время неудобно — напишите, перенесём.",
      "{name}, a reminder: our meeting is tomorrow, {date}. If the time doesn't suit you, just let me know."
    ),
  },
  {
    key: "reengage", name: "Վերաակտիվացում (կորցրած լիդ, 30 օր հետո)",
    subject: L("Նոր խումբ է բացվում", "Открывается новая группа", "A new group is opening"),
    body: L(
      "{name}, բարև։ Բացվում է նոր խումբ, մեկնարկը՝ {date}։ Եթե դեռ մտածում եք ուսման մասին, ուրախ կլինեմ օգնել ընտրության հարցում։ {link}",
      "{name}, здравствуйте! Открывается новая группа, старт {date}. Если вы всё ещё думаете об обучении — с радостью помогу с выбором. {link}",
      "Hi {name}! A new group starts on {date}. If you are still thinking about studying, I'd be glad to help you choose. {link}"
    ),
  },
  {
    key: "won", name: "Ողջույն նոր ունկնդրին (վճարումից հետո)",
    subject: L("Բարի գալուստ դասընթաց", "Добро пожаловать на курс", "Welcome to the course"),
    body: L(
      "{name}, շնորհավորում եմ և բարի գալուստ «{course}» դասընթաց 🎉 Դասացուցակն ու դասերի հղումները անձնական էջում են՝ {link}",
      "{name}, поздравляю и добро пожаловать на курс «{course}» 🎉 Расписание и ссылки на занятия — в личном кабинете: {link}",
      "{name}, congratulations and welcome to \"{course}\" 🎉 The schedule and lesson links are in your account: {link}"
    ),
  },
  {
    key: "review", name: "Կարծիքի և խորհրդի խնդրանք (դասընթացի ավարտից հետո)",
    subject: L("Ինչպե՞ս անցավ դասընթացը", "Как прошёл курс?", "How was the course?"),
    body: L(
      "{name}, շնորհակալություն, որ սովորեցիք մեզ հետ ❤️ Կխնդրեի թողնել կարծիք անձնական էջում՝ {link}\nԻսկ եթե ընկերներից որևէ մեկը մտածում է սովորելու մասին, շատ ուրախ կլինեմ, եթե խորհուրդ տաք մեզ։",
      "{name}, спасибо, что учились с нами ❤️ Буду благодарна за отзыв в личном кабинете: {link}\nА если кто-то из друзей думает об обучении — буду очень рада вашей рекомендации.",
      "{name}, thank you for studying with us ❤️ I'd be grateful for a review in your account: {link}\nAnd if any of your friends is thinking about studying, I'd really appreciate your recommendation."
    ),
  },
];
