/**
 * Lead scoring and "next best action" — pure functions, no DB access.
 *
 * Score 0–100 = fit (who the person is) + intent (what they did) + engagement (how recently they talked to us).
 *   ≥ 70 → hot  (call today), 40–69 → warm (follow up this week), < 40 → cold (nurture with content)
 */
import type { LeadStage } from "@/db/schema";

export type ScoreInput = {
  stage: LeadStage;
  source: string;
  phone?: string | null;
  email?: string | null;
  courseId?: string | null;
  format?: string | null;
  utm?: { source?: string; medium?: string } | null;
  inboundCount: number; // messages they sent us
  lastInboundAt?: Date | string | null;
  createdAt: Date | string;
  hasUser: boolean; // registered on the site
};

export type ScorePart = { label: string; points: number };

const SOURCE_POINTS: Record<string, number> = {
  site_enroll: 30, referral: 25, walk_in: 25, phone_call: 20, event: 20,
  site_contact: 15, whatsapp: 15, telegram: 15, site_register: 12, site_form: 12,
  instagram: 10, facebook: 10, tiktok: 8, google: 10, site_subscribe: 5, other: 5,
};
const STAGE_POINTS: Record<LeadStage, number> = { NEW: 0, CONTACTED: 5, CONSULTATION: 15, TRIAL: 20, NEGOTIATION: 25, WON: 0, LOST: 0 };

const days = (d?: Date | string | null) => (d ? (Date.now() - new Date(d).getTime()) / 86_400_000 : Infinity);

export function scoreLead(l: ScoreInput): { score: number; parts: ScorePart[] } {
  const parts: ScorePart[] = [];
  const add = (label: string, points: number) => { if (points) parts.push({ label, points }); };

  add("Աղբյուր", SOURCE_POINTS[l.source] ?? 5);
  add("Հեռախոսահամար", l.phone ? 10 : 0);
  add("Էլ. փոստ", l.email ? 5 : 0);
  add("Ընտրել է դասընթաց", l.courseId ? 10 : 0);
  add("Անհատական ձևաչափ", l.format === "individual" ? 8 : 0);
  add("Գրանցված է կայքում", l.hasUser ? 5 : 0);
  add("Վճարովի գովազդից", l.utm?.medium && /cpc|paid|ads?|ppc/i.test(l.utm.medium) ? 3 : 0);
  add("Ինքն է գրել մեզ", Math.min(20, l.inboundCount * 5));
  add("Փուլ", STAGE_POINTS[l.stage]);

  const quiet = days(l.lastInboundAt ?? l.createdAt);
  add("Վերջին ակտիվություն", quiet <= 2 ? 10 : quiet <= 7 ? 5 : quiet > 45 ? -15 : quiet > 21 ? -8 : 0);

  const score = Math.max(0, Math.min(100, parts.reduce((n, p) => n + p.points, 0)));
  return { score, parts };
}

export const temperature = (score: number) => (score >= 70 ? "hot" : score >= 40 ? "warm" : "cold") as "hot" | "warm" | "cold";

/** Suggests the next step for a lead, based on its stage and how long it has been quiet. */
export function nextBestAction(l: { stage: LeadStage; lastContactAt?: Date | string | null; createdAt: Date | string; phone?: string | null }): string {
  const sinceTouch = days(l.lastContactAt ?? null);
  switch (l.stage) {
    case "NEW":
      return l.phone ? "Զանգահարել առաջին 15 րոպեում (արագ արձագանքը կրկնապատկում է գրանցման հավանականությունը)" : "Գրել ողջույնի հաղորդագրություն և խնդրել հեռախոսահամար";
    case "CONTACTED":
      return sinceTouch > 3 ? "Հետևողական հաղորդագրություն + հրավեր անվճար խորհրդատվության" : "Նշանակել 15 րոպեանոց խորհրդատվություն";
    case "CONSULTATION":
      return "Խորհրդատվությունից հետո ուղարկել ծրագիրը, գինը և հրավեր փորձնական դասի";
    case "TRIAL":
      return "Փորձնական դասից 1 օր հետո հարցնել տպավորությունը և առաջարկել գրանցում մոտակա խմբում";
    case "NEGOTIATION":
      return sinceTouch > 2 ? "Հիշեցնել տեղերի սահմանափակ քանակի և մեկնարկի ամսաթվի մասին" : "Պատասխանել հարցերին, առաջարկել ամսական վճարում";
    case "WON":
      return "Ողջունել, ուղարկել դասացուցակը, դասընթացից հետո խնդրել կարծիք և ընկերոջ խորհուրդ";
    case "LOST":
      return "30 օր հետո տեղեկացնել նոր խմբի մեկնարկի մասին";
  }
}
