import "server-only";

/** Where an application is, seen from the admin's side, and what the admin should do next. */
export type FlowApp = {
  status: "NEW" | "INTERVIEW" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED";
  format: string;
  groupId: string | null;
  startDate: Date | null;
  meetingUrl: string | null;
  contractSignedAt: Date | null;
  lessonsDone: number;
  course: { weeks: number; lessonsPerWeek: number };
  group?: { meetingUrl: string | null; status: string } | null;
};
export type FlowCert = { revoked: boolean; receivedAt: Date | null } | undefined;

export type FlowKey = "NEW" | "INTERVIEW" | "SIGN" | "PAY" | "SETUP" | "STUDY" | "CERT" | "RECEIPT" | "DONE" | "STOPPED";

export const FLOW_STEPS = ["Հայտ", "Հարցազրույց", "Հաստատում", "Պայմանագիր", "Վճարում", "Ուսուցում", "Վկայական"] as const;

/** Problems that keep the learner from knowing when and where to study. */
export function flowWarnings(a: FlowApp): string[] {
  if (a.status !== "APPROVED" && a.status !== "PAID") return [];
  const w: string[] = [];
  if (a.format === "group" && !a.groupId) w.push("Խումբ նշված չէ՝ ունկնդիրը չի իմանա մեկնարկի օրը և դասացուցակը");
  if (a.format === "individual" && !a.startDate) w.push("Մեկնարկի օրը նշված չէ");
  if (a.status === "PAID" && !(a.meetingUrl || a.group?.meetingUrl)) w.push(a.format === "group" ? "Խմբի դասի հղում չկա (Խմբեր բաժնում)" : "Անձնական դասի հղում չկա");
  return w;
}

export function flowStage(a: FlowApp, cert: FlowCert): { key: FlowKey; done: number; text: string } {
  if (a.status === "REJECTED") return { key: "STOPPED", done: -1, text: "Հայտը մերժված է" };
  if (a.status === "CANCELLED") return { key: "STOPPED", done: -1, text: "Հայտը չեղարկված է" };
  if (cert && !cert.revoked) return cert.receivedAt
    ? { key: "DONE", done: 7, text: "Ավարտված է․ վկայականը տրված և ստացված է" }
    : { key: "RECEIPT", done: 6, text: "Վկայականը տրված է․ սպասում ենք, որ ունկնդիրը հաստատի ստացումը" };
  if (a.status === "PAID") {
    if (flowWarnings(a).length) return { key: "SETUP", done: 5, text: "Վճարված է․ լրացրեք խումբը / մեկնարկը / դասի հղումը" };
    const total = a.course.weeks * a.course.lessonsPerWeek;
    if (a.lessonsDone >= total || a.group?.status === "FINISHED") return { key: "CERT", done: 6, text: "Դասընթացն ավարտված է․ տվեք վկայականը" };
    return { key: "STUDY", done: 5, text: "Ուսուցումն ընթացքի մեջ է" };
  }
  if (a.status === "APPROVED") return a.contractSignedAt
    ? { key: "PAY", done: 4, text: "Պայմանագիրը կնքված է․ սպասում ենք վճարմանը" }
    : { key: "SIGN", done: 3, text: "Հաստատված է․ սպասում ենք, որ ունկնդիրը կնքի պայմանագիրը" };
  if (a.status === "INTERVIEW") return { key: "INTERVIEW", done: 1, text: "Անցկացրեք մուտքային զրույցը և որոշեք՝ հաստատել, թե մերժել" };
  return { key: "NEW", done: 1, text: "Նոր հայտ․ կապվեք ունկնդրի հետ և հրավիրեք մուտքային զրույցի" };
}

/** Steps that need the admin (the rest is waiting for the learner or simply in progress). */
export const NEEDS_ADMIN: FlowKey[] = ["NEW", "INTERVIEW", "SETUP", "CERT"];
