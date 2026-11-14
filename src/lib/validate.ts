import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(160);
export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const num = (fd: FormData, k: string, d = 0) => { const n = Number(fd.get(k)); return Number.isFinite(n) ? n : d; };
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
/** Honeypot: bots fill the hidden "website" field. */
export const isBot = (fd: FormData) => str(fd, "website") !== "";
