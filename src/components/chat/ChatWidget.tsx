"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { Dict } from "@/lib/i18n";

export type QuickAnswer = { q: string; a: string; link?: { href: string; label: string } };
type Msg = { id: string; from: "visitor" | "admin" | "bot"; body: string; at: string; link?: QuickAnswer["link"] };
type ThreadInfo = { name: string | null; email: string | null; unread?: number; closed?: boolean } | null;

const STARTED_KEY = "alta_chat_started";
const ASKED_KEY = "alta_chat_contact_asked";
const OPEN_POLL_MS = 4000;
const IDLE_POLL_MS = 30000;

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export function ChatWidget({ locale, t, quick, startOpen = false }: { locale: string; t: Dict["chat"]; quick: QuickAnswer[]; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [local, setLocal] = useState<Msg[]>([]);
  const [thread, setThread] = useState<ThreadInfo>(null);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [askContact, setAskContact] = useState(false);
  const [contact, setContact] = useState({ name: "", email: "" });
  const [note, setNote] = useState("");
  const carry = useRef<{ name: string; email: string } | null>(null); // contact details passed on to a new conversation
  const lastAt = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hp = useRef<HTMLInputElement>(null);
  const [mobile, setMobile] = useState(false);
  const [vv, setVv] = useState<{ h: number; top: number } | null>(null);

  // phones: the chat is a full-screen sheet that follows the visible area (so the keyboard never covers the input)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639.98px), (max-height: 520px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!open || !mobile) { setVv(null); return; }
    const root = document.documentElement, prev = root.style.overflow;
    root.style.overflow = "hidden"; // the page behind must not scroll
    const v = window.visualViewport;
    const fit = () => setVv(v ? { h: Math.round(v.height), top: Math.round(v.offsetTop) } : null);
    fit();
    v?.addEventListener("resize", fit);
    v?.addEventListener("scroll", fit);
    return () => { root.style.overflow = prev; v?.removeEventListener("resize", fit); v?.removeEventListener("scroll", fit); };
  }, [open, mobile]);

  const merge = useCallback((incoming: Msg[], replace = false) => {
    setMsgs((prev) => {
      const base = replace ? [] : prev;
      const seen = new Set(base.map((m) => m.id));
      const next = [...base, ...incoming.filter((m) => !seen.has(m.id))];
      if (next.length) lastAt.current = next[next.length - 1].at;
      return next;
    });
  }, []);

  const poll = useCallback(async (full = false, isOpen = false) => {
    try {
      const q = new URLSearchParams();
      if (!full && lastAt.current) q.set("after", lastAt.current);
      if (isOpen) q.set("open", "1");
      const r = await fetch(`/api/chat?${q}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { thread: ThreadInfo; messages: Msg[] };
      if (!d.thread) return;
      setThread(d.thread);
      merge(d.messages, full);
      if (!isOpen) setUnread(d.thread.unread ?? 0);
    } catch { /* offline: try again on the next tick */ }
  }, [merge]);

  // open from an e-mail link (?chat=1); background check for replies when a conversation exists
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("chat") === "1") setOpen(true);
    if (store.get(STARTED_KEY)) poll(true, false);
  }, [poll]);

  useEffect(() => {
    const started = Boolean(store.get(STARTED_KEY));
    if (!open && !started) return;
    if (open) { setUnread(0); if (started) poll(!lastAt.current, true); }
    const id = window.setInterval(() => { if (document.visibilityState === "visible") poll(false, open); }, open ? OPEN_POLL_MS : IDLE_POLL_MS);
    return () => clearInterval(id);
  }, [open, poll]);

  useEffect(() => {
    if (!open) return;
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const timeline = [...local, ...msgs].sort((a, b) => a.at.localeCompare(b.at));
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [timeline.length, askContact, note]);

  const pickQuick = (x: QuickAnswer) => {
    const at = new Date().toISOString();
    setLocal((l) => [...l, { id: `q-${l.length}-a`, from: "visitor", body: x.q, at }, { id: `q-${l.length}-b`, from: "bot", body: x.a, at: at + "1", link: x.link }]);
  };

  const post = async (payload: Record<string, string>) => {
    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, locale, page: window.location.pathname, website: hp.current?.value ?? "" }) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 409 && d.error === "closed") { await poll(true, true); throw new Error(t.closedText); }
    if (!r.ok) throw new Error(d.error === "rate" ? t.errRate : d.error === "email" ? t.errEmail : t.errSend);
    return d as { message?: Msg; thread?: ThreadInfo };
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setError("");
    try {
      const c = carry.current;
      const d = await post(c ? { body, ...(c.name ? { name: c.name } : {}), ...(c.email ? { email: c.email } : {}) } : { body });
      carry.current = null;
      if (d.message) merge([d.message]);
      if (d.thread) setThread(d.thread);
      setText("");
      store.set(STARTED_KEY, "1");
      if (!(d.thread?.email ?? thread?.email) && !store.get(ASKED_KEY)) setAskContact(true);
      else setNote(t.waiting);
    } catch (err) { setError((err as Error).message); }
    finally { setSending(false); if (inputRef.current) inputRef.current.style.height = ""; }
  };

  const saveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const d = await post({ name: contact.name, email: contact.email });
      if (d.thread) setThread(d.thread);
      store.set(ASKED_KEY, "1");
      setAskContact(false);
      setNote(contact.email ? t.saved : t.waiting);
    } catch (err) { setError((err as Error).message); }
  };

  const startNew = async () => {
    setError("");
    try { await fetch("/api/chat", { method: "DELETE" }); } catch { /* the next message will retry */ }
    carry.current = thread?.name || thread?.email ? { name: thread?.name ?? "", email: thread?.email ?? "" } : null;
    setThread(null); setMsgs([]); setLocal([]); setNote(""); setAskContact(false); lastAt.current = null;
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const skipContact = () => { store.set(ASKED_KEY, "1"); setAskContact(false); setNote(t.waiting); };

  return (
    <div className="pointer-events-none fixed right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-3 sm:right-5 sm:bottom-5">
      {open && (
        <section role="dialog" aria-modal={mobile || undefined} aria-label={t.title}
          style={mobile && vv ? { height: vv.h, top: vv.top } : undefined}
          className={`pointer-events-auto flex flex-col overflow-hidden bg-white ${mobile
            ? "fixed inset-x-0 top-0 z-50 h-dvh w-full"
            : "h-[min(620px,calc(100dvh-7rem))] w-[390px] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-[#e3dccb] shadow-[0_24px_60px_rgba(10,26,47,0.28)]"}`}>
          <header className={`flex flex-none items-center gap-3 bg-navy-900 px-4 text-white ${mobile ? "pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]" : "py-3.5"}`}>
            <span className="mt-0.5 flex size-9 flex-none items-center justify-center rounded-full bg-gold-500 text-navy-950"><Icon name="chat" size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="m-0 font-serif text-[16px] font-bold">{t.title}</p>
              <p className="m-0 text-[12.5px] text-[#c9d2e3]">{t.subtitle}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t.close} className="-mr-1 flex size-10 items-center justify-center rounded-full text-white hover:bg-white/10"><Icon name="close" size={18} /></button>
          </header>

          <div ref={listRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain bg-[#faf8f3] px-3.5 py-4" aria-live="polite">
            {quick.length > 0 && (
              <div>
                <p className="m-0 mb-2 text-[12px] font-semibold tracking-wide text-gold-700 uppercase">{t.quick}</p>
                <div className="flex flex-wrap gap-2">
                  {quick.map((x) => (
                    <button key={x.q} type="button" onClick={() => pickQuick(x)}
                      className="min-h-10 max-w-full rounded-full border border-[#d9d0bd] bg-white px-3.5 py-2 text-left text-[14px] leading-snug text-navy-800 [overflow-wrap:anywhere] hover:border-navy-800 sm:min-h-9 sm:py-1.5 sm:text-[13px]">{x.q}</button>
                  ))}
                </div>
              </div>
            )}
            {timeline.map((m) => (
              <div key={m.id} className={`flex ${m.from === "visitor" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-line [overflow-wrap:anywhere] sm:text-[14px] ${m.from === "visitor" ? "rounded-br-md bg-navy-800 text-white" : "rounded-bl-md border border-[#ece5d6] bg-white text-ink"}`}>
                  {m.from === "admin" && <span className="mb-0.5 block text-[11.5px] font-semibold text-gold-700">{t.team}</span>}
                  {m.body}
                  {m.link && <a href={m.link.href} className="mt-1.5 block text-[13px] font-semibold text-navy-800">{m.link.label} →</a>}
                </div>
              </div>
            ))}
            {askContact && !thread?.closed && (
              <form onSubmit={saveContact} className="space-y-2 rounded-2xl border border-[#ece5d6] bg-white p-3.5">
                <p className="m-0 text-[14px] font-semibold text-navy-900">{t.contactTitle}</p>
                <p className="m-0 text-[12.5px] text-[#5b6170]">{t.contactHint}</p>
                <label className="block text-[12.5px] text-[#5b6170]">{t.name}
                  <input value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} autoComplete="name" maxLength={120} className="input mt-1 min-h-11 text-[16px] sm:text-[14px]" />
                </label>
                <label className="block text-[12.5px] text-[#5b6170]">{t.email}
                  <input type="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} autoComplete="email" inputMode="email" maxLength={200} className="input mt-1 min-h-11 text-[16px] sm:text-[14px]" />
                </label>
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={!contact.name.trim() && !contact.email.trim()} className="btn-navy min-h-10 px-4 text-[13.5px] disabled:opacity-50">{t.save}</button>
                  <button type="button" onClick={skipContact} className="btn-soft min-h-10 px-4 text-[13.5px]">{t.skip}</button>
                </div>
              </form>
            )}
            {note && !askContact && <p className="m-0 text-center text-[12.5px] text-[#5b6170]">{note}</p>}
            {!msgs.length && !askContact && (
              <p className="m-0 pt-1 text-[13px] text-[#5b6170]">{t.notFound}</p>
            )}
          </div>

          {thread?.closed ? (
            <div className="flex-none border-t border-[#ece5d6] bg-white px-4 pt-3.5 pb-[max(0.9rem,env(safe-area-inset-bottom))] text-center">
              <p className="m-0 mb-3 text-[13.5px] leading-snug text-[#5b6170]">{t.closedText}</p>
              <button type="button" onClick={startNew} className="btn-navy min-h-11 w-full text-[14.5px]">{t.newChat}</button>
            </div>
          ) : (
          <form onSubmit={send} className="relative flex-none border-t border-[#ece5d6] bg-white px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <input ref={hp} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
            {error && <p role="alert" className="m-0 mb-2 text-[12.5px] text-[#a33a2b]">{error}</p>}
            <div className="flex items-end gap-2">
              <label className="sr-only" htmlFor="alta-chat-input">{t.placeholder}</label>
              <textarea id="alta-chat-input" ref={inputRef} value={text} maxLength={2000} rows={1}
                onChange={(e) => { setText(e.target.value); const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 128)}px`; }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                placeholder={t.placeholder} className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-[#d9d0bd] px-3 py-2.5 text-[16px] leading-snug focus:border-navy-800 focus:outline-none sm:text-[14.5px]" />
              <button type="submit" disabled={sending || !text.trim()} aria-label={t.send} className="flex size-11 flex-none items-center justify-center rounded-xl bg-gold-500 text-navy-950 hover:bg-gold-400 disabled:opacity-50"><Icon name="send" size={18} /></button>
            </div>
            <p className="m-0 mt-2 text-[11.5px] leading-snug text-[#6b7180]">{t.privacy}</p>
          </form>
          )}
        </section>
      )}

      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? t.close : t.open}
        className={`pointer-events-auto relative min-h-14 min-w-14 items-center justify-center gap-2 rounded-full ${open && mobile ? "hidden" : "flex"} bg-navy-900 px-4 text-white shadow-[0_12px_30px_rgba(10,26,47,0.35)] ring-2 ring-gold-500/70 hover:bg-navy-800 sm:px-5`}>
        <Icon name={open ? "close" : "chat"} size={22} />
        {!open && <span className="hidden text-[14.5px] font-semibold sm:inline">{t.open}</span>}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-6 items-center justify-center rounded-full bg-[#c2412d] px-1.5 text-[12px] font-bold text-white" aria-label={t.newReply}>{unread}</span>
        )}
      </button>
    </div>
  );
}
