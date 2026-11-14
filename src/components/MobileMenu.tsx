"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** <details> dropdown that closes after choosing a link, on navigation, Escape or a click outside. */
export function MobileMenu({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [pathname]);
  useEffect(() => {
    const close = () => { if (ref.current) ref.current.open = false; };
    const onDown = (e: PointerEvent) => { if (ref.current?.open && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && ref.current?.open) { close(); ref.current.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);
  return (
    <details ref={ref} className={className} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) ref.current!.open = false; }}>
      {children}
    </details>
  );
}
