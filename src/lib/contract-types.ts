/** Shape of the signed-contract snapshot stored on an application (shared by schema and pages). */
export type ContractSnapshotData = {
  v: 1;
  no: string;
  signedAt: string;
  signedName: string;
  signedLocale: "hy" | "ru" | "en";
  ip: string | null;
  client: { name: string; email: string; phone: string | null };
  /** learner's date of birth (YYYY-MM-DD) and, for a minor, the parent or guardian who signed */
  birthDate?: string;
  guardian?: { name: string; relation: "parent" | "guardian"; phone: string; email: string | null } | null;
  body: { hy: string; ru: string; en: string };
};
