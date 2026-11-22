"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Dict } from "@/lib/i18n";
import type { QuickAnswer } from "./ChatWidget";

const ChatWidget = dynamic(() => import("./ChatWidget").then((m) => m.ChatWidget), { ssr: false });

/** The chat code loads after the page has finished loading (or at once when the visitor taps the button / comes from an e-mail link). */
export function ChatLazy(props: { locale: string; t: Dict["chat"]; quick: QuickAnswer[] }) {
  const [ready, setReady] = useState(false);
  const [tapped, setTapped] = useState(false);
  useEffect(() => {
    const go = () => setReady(true);
    // opened from an e-mail link, or a conversation already exists (replies must show up): load right away
    let started = false;
    try { started = Boolean(localStorage.getItem("alta_chat_started")); } catch { /* private mode */ }
    if (new URLSearchParams(window.location.search).get("chat") === "1") { setTapped(true); go(); return; }
    if (started) { const id = window.setTimeout(go, 1500); return () => clearTimeout(id); }
    // otherwise the chat code waits for the first interaction, so it never slows down the first view of the page
    const evs = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    const once = (e: Event) => {
      evs.forEach((x) => window.removeEventListener(x, once));
      if ((e.target as Element | null)?.closest?.("[data-chat-lazy]")) setTapped(true); // the first tap was on the chat button itself
      go();
    };
    evs.forEach((e) => window.addEventListener(e, once, { passive: true, once: true }));
    return () => evs.forEach((e) => window.removeEventListener(e, once));
  }, []);
  if (ready) return <ChatWidget {...props} startOpen={tapped} />;
  return (
    <button type="button" data-chat-lazy onClick={() => { setTapped(true); setReady(true); }} aria-label={props.t.open}
      className="fixed right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex min-h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-navy-900 px-4 text-white shadow-[0_12px_30px_rgba(10,26,47,0.35)] ring-2 ring-gold-500/70 sm:right-5 sm:bottom-5 sm:px-5">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
      <span className="hidden text-[14.5px] font-semibold sm:inline">{props.t.open}</span>
    </button>
  );
}
