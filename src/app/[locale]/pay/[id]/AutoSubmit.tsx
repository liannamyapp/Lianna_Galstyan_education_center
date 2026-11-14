"use client";
import { useEffect, useRef } from "react";

export function AutoSubmit({ action, fields, label }: { action: string; fields: Record<string, string>; label: string }) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { ref.current?.submit(); }, []);
  return (
    <form ref={ref} action={action} method="POST" acceptCharset="utf-8">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" className="btn-navy">{label} →</button>
    </form>
  );
}
