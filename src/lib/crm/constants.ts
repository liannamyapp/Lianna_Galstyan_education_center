/** CRM labels and colours (safe to import from client and server code). */
import type { LeadStage } from "@/db/schema";

export const STAGES: LeadStage[] = ["NEW", "CONTACTED", "CONSULTATION", "TRIAL", "NEGOTIATION", "WON", "LOST"];
/** Stages that are still "in the pipeline" (not closed). */
export const OPEN_STAGES: LeadStage[] = ["NEW", "CONTACTED", "CONSULTATION", "TRIAL", "NEGOTIATION"];

export const stageHy: Record<LeadStage, string> = {
  NEW: "Նոր",
  CONTACTED: "Կապ հաստատված",
  CONSULTATION: "Խորհրդատվություն",
  TRIAL: "Փորձնական դաս",
  NEGOTIATION: "Որոշման փուլ",
  WON: "Գրանցված / վճարած",
  LOST: "Կորցրած",
};

export const stageCls: Record<LeadStage, string> = {
  NEW: "bg-[#e6eef8] text-navy-800",
  CONTACTED: "bg-[#eef0f3] text-[#374151]",
  CONSULTATION: "bg-[#fbf2dd] text-[#7a5a12]",
  TRIAL: "bg-[#f3e8fb] text-[#5b2a86]",
  NEGOTIATION: "bg-[#fdebd8] text-[#8a4a12]",
  WON: "bg-[#e3f1e6] text-[#1f5f33]",
  LOST: "bg-[#fbefeb] text-[#8a2f1d]",
};

export const SOURCES = [
  "site_enroll", "site_register", "site_contact", "site_subscribe", "site_form",
  "whatsapp", "telegram", "instagram", "facebook", "tiktok", "google",
  "referral", "phone_call", "walk_in", "event", "other",
] as const;
export type LeadSource = (typeof SOURCES)[number];

export const sourceHy: Record<string, string> = {
  site_enroll: "Կայք՝ հայտ դասընթացին",
  site_register: "Կայք՝ գրանցում",
  site_contact: "Կայք՝ «Կապ» ձև",
  site_subscribe: "Կայք՝ բաժանորդագրություն",
  site_form: "Կայք / արտաքին ձև",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  google: "Google",
  referral: "Ընկերոջ խորհուրդ",
  phone_call: "Հեռախոսազանգ",
  walk_in: "Այցելություն գրասենյակ",
  event: "Միջոցառում / բաց դաս",
  other: "Այլ",
};

export const CHANNELS = ["whatsapp", "telegram", "email", "instagram", "facebook"] as const;
export type Channel = (typeof CHANNELS)[number];

export const channelHy: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  email: "Էլ. փոստ",
  instagram: "Instagram",
  facebook: "Messenger",
  site: "Կայք",
  phone: "Հեռախոս",
};

export const activityHy: Record<string, string> = {
  note: "Նշում",
  call: "Զանգ",
  message_in: "Մուտքային հաղորդագրություն",
  message_out: "Ուղարկված հաղորդագրություն",
  stage: "Փուլի փոփոխություն",
  task: "Առաջադրանք",
  system: "Համակարգ",
};

export const tempHy = { hot: "Տաք", warm: "Գոլ", cold: "Սառը" } as const;
export const tempCls = { hot: "bg-[#8a2f1d] text-white", warm: "bg-[#fbf2dd] text-[#7a5a12]", cold: "bg-[#e6eef8] text-navy-800" } as const;

/** Template placeholders available in every message. */
export const PLACEHOLDERS = ["{name}", "{course}", "{date}", "{link}", "{phone}", "{center}"] as const;
