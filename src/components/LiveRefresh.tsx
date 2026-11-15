"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Keeps a server-rendered page current: refreshes when the tab regains focus,
 *  and polls while something is waiting for the admin (e.g. a review under moderation). */
export function LiveRefresh({ poll = false, every = 20000 }: { poll?: boolean; every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const id = poll ? window.setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, every) : undefined;
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); if (id) clearInterval(id); };
  }, [router, poll, every]);
  return null;
}
