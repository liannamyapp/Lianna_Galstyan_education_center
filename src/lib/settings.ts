import "server-only";
import { unstable_cache } from "next/cache";
import { db, s } from "@/db";
import type { L10n } from "@/db/schema";

export type SiteSettings = {
  site: { name: L10n; tagline: L10n; description: L10n };
  hero: { eyebrow: L10n; title: L10n; subtitle: L10n };
  stats: { value: string; label: L10n }[];
  instructor: { name: L10n; role: L10n; bio: L10n; photoUrl: string; tags: string[] };
  contacts: { phone: string; email: string; telegram: string; whatsapp: string; instagram: string; facebook: string; city: L10n };
  legal: { entity: L10n; tin: string; endorsement: L10n };
  payments: { card: boolean; idram: boolean; reminderDays: number; graceDays: number };
  adminEmail: string;
};

const L = (hy: string, ru: string, en: string): L10n => ({ hy, ru, en });

export const defaultSettings: SiteSettings = {
  site: {
    name: L("Լիաննա Գալստյան", "Лианна Галстян", "Lianna Galstyan"),
    tagline: L("Կրթական կենտրոն", "Образовательный центр", "Education Centre"),
    description: L(
      "Ծրագրավորման առցանց դասընթացներ Երևանում՝ կենդանի դասեր փոքր խմբերով, գործնական նախագծեր և վկայական։ Ֆրոնթենդ (HTML, CSS, JavaScript, React) և բեքենդ (Node.js)։",
      "Онлайн-курсы программирования в Ереване: живые занятия в малых группах, практические проекты и сертификат. Фронтенд (HTML, CSS, JavaScript, React) и бэкенд (Node.js).",
      "Online programming courses in Yerevan: live lessons in small groups, hands-on projects and a certificate. Frontend (HTML, CSS, JavaScript, React) and backend (Node.js)."
    ),
  },
  hero: {
    eyebrow: L("Ծրագրավորման առցանց դասընթացներ · Երևան", "Онлайн-курсы программирования · Ереван", "Online programming courses · Yerevan"),
    title: L("Ծրագրավորում՝ առաջին տողից մինչև աշխատող նախագիծ", "Программирование — от первой строки до работающего проекта", "Programming — from your first line to a working project"),
    subtitle: L(
      "Կենդանի առցանց դասեր փոքր խմբերով, գործնական առաջադրանքներ յուրաքանչյուր դասին և ավարտական նախագիծ, որը կդնես քո փորձապանակում։",
      "Живые онлайн-занятия в малых группах, практика на каждом уроке и выпускной проект для вашего портфолио.",
      "Live online lessons in small groups, practice in every lesson and a final project for your portfolio."
    ),
  },
  stats: [
    { value: "10+", label: L("տարի ծրագրավորման դասավանդման փորձ", "лет опыта преподавания программирования", "years of teaching programming") },
    { value: "6–12", label: L("ունկնդիր մեկ խմբում", "слушателей в группе", "learners per group") },
    { value: "70%", label: L("դասաժամերի գործնական աշխատանք", "учебного времени — практика", "of class time is practice") },
    { value: "100%", label: L("կենդանի դասեր և ձայնագրություններ", "живые занятия и записи", "live lessons with recordings") },
  ],
  instructor: {
    name: L("Լիաննա Գալստյան", "Лианна Галстян", "Lianna Galstyan"),
    role: L("Ֆուլսթեք ծրագրավորող, դասավանդող", "Fullstack-разработчик, преподаватель", "Full-stack developer, instructor"),
    bio: L(
      "Ֆուլսթեք վեբ ծրագրավորող՝ ծրագրավորման ոլորտում 10 տարվա փորձով, որից վերջին 5 տարին՝ նաև բեքենդ մշակման մեջ։ 2016 թվականից դասավանդում է վեբ ծրագրավորում, մշակում ուսումնական ծրագրեր և ղեկավարում ունկնդիրների նախագծերը։ Ունի GREEN-API հարթակի մշակողի որակավորման սերտիֆիկատ՝ WhatsApp ինտեգրացիաների և չաթ-բոտերի ոլորտում։",
      "Fullstack веб-разработчик с 10-летним опытом в программировании, из них последние 5 лет — также в бэкенд-разработке. С 2016 года преподаёт веб-программирование, разрабатывает учебные программы и руководит проектами слушателей. Имеет сертификат разработчика платформы GREEN-API в области интеграций WhatsApp и чат-ботов.",
      "Full-stack web developer with 10 years of programming experience, the last 5 also in backend development. Teaching web development since 2016, designing curricula and supervising learners' projects. Holds a GREEN-API developer certificate in WhatsApp integrations and chatbots."
    ),
    photoUrl: "/images/instructor.webp",
    tags: ["React · TypeScript · Next.js", "Node.js · Express · NestJS", "MS SQL · PostgreSQL · Docker", "GREEN-API"],
  },
  contacts: {
    phone: "+374 77 053446",
    email: "galstyan.liana.87@gmail.com",
    telegram: "G_liann",
    whatsapp: "37477053446",
    instagram: "",
    facebook: "",
    city: L("Երևան · առցանց դասեր", "Ереван · онлайн-занятия", "Yerevan · online classes"),
  },
  legal: {
    entity: L("ԱՁ Լիաննա Գալստյան", "ИП Лианна Галстян", "IE Lianna Galstyan"),
    tin: "58229843",
    endorsement: L("", "", ""),
  },
  payments: { card: true, idram: true, reminderDays: 5, graceDays: 7 },
  adminEmail: "galstyan.liana.87@gmail.com",
};

function merge<T>(base: T, over: unknown): T {
  if (over === undefined || over === null) return base;
  if (Array.isArray(base)) return (Array.isArray(over) && over.length ? over : base) as T;
  if (typeof base === "object" && base && typeof over === "object") {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
      out[k] = k in out ? merge(out[k], v) : v;
    }
    return out as T;
  }
  return over as T;
}

const cachedSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    const rows = await db.select().from(s.settings);
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return merge(defaultSettings, stored);
  },
  ["site-settings"],
  { tags: ["settings"], revalidate: 3600 }
);

/** Site settings (defaults merged with admin edits). A failed DB read falls back to defaults without being cached. */
export async function getSettings(): Promise<SiteSettings> {
  try { return await cachedSettings(); } catch (e) { console.error("[settings]", (e as Error).message); return defaultSettings; }
}
