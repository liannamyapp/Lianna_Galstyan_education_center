"use client";
import { useEffect } from "react";

/** Brings a section into view after a redirect (server-action redirects keep the previous scroll position). */
export function ScrollToId({ id }: { id: string }) {
  useEffect(() => { document.getElementById(id)?.scrollIntoView({ block: "start" }); }, [id]);
  return null;
}
