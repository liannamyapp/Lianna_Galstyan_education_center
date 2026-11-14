import "server-only";
import { put } from "@vercel/blob";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif", "application/pdf"];

/** Stores an uploaded file and returns its public URL (Vercel Blob in production, /public/uploads locally). */
export async function storeFile(file: File | null, folder = "uploads"): Promise<string | null> {
  if (!file || typeof file === "string" || file.size === 0) return null;
  if (!ALLOWED.includes(file.type)) throw new Error("Unsupported file type");
  if (file.size > 8 * 1024 * 1024) throw new Error("File too large (max 8 MB)");
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const name = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(name, file, { access: "public", contentType: file.type });
    return blob.url;
  }
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(process.cwd(), "public", "uploads", name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}
