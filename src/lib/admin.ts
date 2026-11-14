import type { L10n, L10nList } from "@/db/schema";
import { str } from "./validate";

export function l10n(fd: FormData, name: string): L10n {
  return { hy: str(fd, `${name}_hy`), ru: str(fd, `${name}_ru`), en: str(fd, `${name}_en`) };
}
export function l10nList(fd: FormData, name: string): L10nList {
  const split = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
  return { hy: split(str(fd, `${name}_hy`)), ru: split(str(fd, `${name}_ru`)), en: split(str(fd, `${name}_en`)) };
}
export const listToText = (v?: Partial<L10nList> | null): Partial<L10n> => ({ hy: (v?.hy ?? []).join("\n"), ru: (v?.ru ?? []).join("\n"), en: (v?.en ?? []).join("\n") });
