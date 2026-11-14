"use client";
import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

/** URL field + optional direct upload to Vercel Blob (large files, with progress). */
export function UploadField({ name, label, defaultValue, accept, blob, hint }: { name: string; label: string; defaultValue?: string | null; accept: string; blob: boolean; hint?: string }) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  async function onFile(f: File | undefined) {
    if (!f) return;
    setErr(""); setPct(0);
    try {
      const r = await upload(`lessons/${f.name.replace(/[^\w.\-]+/g, "_")}`, f, {
        access: "public", handleUploadUrl: "/api/admin/upload", multipart: f.size > 50 * 1024 * 1024,
        onUploadProgress: (p) => setPct(Math.round(p.percentage)),
      });
      setUrl(r.url);
    } catch (e) {
      setErr((e as Error).message || "Upload failed");
    } finally {
      setPct(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <div className="label">
      <span>{label}</span>
      <input name={name} type="text" inputMode="url" autoComplete="off" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="input" />
      {blob && (
        <span className="flex flex-wrap items-center gap-3 font-normal">
          <label className="btn-soft min-h-10 cursor-pointer px-4 text-[13.5px]">
            Վերբեռնել ֆայլ
            <input ref={fileRef} type="file" accept={accept} className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} disabled={pct !== null} />
          </label>
          {pct !== null && <span className="flex items-center gap-2 text-[13px] text-navy-800"><span className="h-2 w-40 overflow-hidden rounded-full bg-[#efe9dc]"><span className="block h-2 bg-navy-800" style={{ width: `${pct}%` }} /></span>{pct}%</span>}
          {err && <span className="text-[13px] text-[#8a2f1d]">{err}</span>}
        </span>
      )}
      {hint && <span className="text-[12.5px] font-normal text-muted">{hint}</span>}
    </div>
  );
}
