"use client";
import { useActionState, useEffect, useRef } from "react";

export type ActionResult = { ok?: boolean; error?: string; message?: string; fields?: Record<string, string> } | null;

export function ActionForm({
  action, children, className, resetOnSuccess = false, successReplace = false,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode; className?: string; resetOnSuccess?: boolean; successReplace?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && resetOnSuccess) ref.current?.reset(); }, [state, resetOnSuccess]);
  if (state?.ok && successReplace && state.message) {
    return <p role="status" className="rounded-2xl border border-[#cfe5d4] bg-[#eef7f0] p-5 text-[15px] text-[#1f5f33]">{state.message}</p>;
  }
  return (
    <form ref={ref} action={formAction} className={className} noValidate={false}>
      {children}
      <div aria-live="polite" className="empty:hidden">
        {state?.error && <p role="alert" className="rounded-xl border border-[#f0cfc6] bg-[#fbefeb] px-4 py-3 text-[14px] text-[#8a2f1d]">{state.error}</p>}
        {state?.ok && state.message && <p role="status" className="rounded-xl border border-[#cfe5d4] bg-[#eef7f0] px-4 py-3 text-[14px] text-[#1f5f33]">{state.message}</p>}
      </div>
    </form>
  );
}
