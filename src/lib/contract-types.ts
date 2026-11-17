/** Shape of the signed-contract snapshot stored on an application (shared by schema and pages). */
export type ContractSnapshotData = {
  v: 1;
  no: string;
  signedAt: string;
  signedName: string;
  signedLocale: "hy" | "ru" | "en";
  ip: string | null;
  client: { name: string; email: string; phone: string | null };
  body: { hy: string; ru: string; en: string };
};
