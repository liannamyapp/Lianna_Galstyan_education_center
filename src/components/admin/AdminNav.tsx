"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

/** Admin sections: a vertical list on desktop; on phones a "Sections" button that opens a 2-column grid (no sideways scrolling). */
export function AdminNav({ items }: { items: [string, string, string][] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const current = [...items].sort((a, b) => b[0].length - a[0].length).find(([href]) => pathname === href || pathname.startsWith(href + "/")) ?? items[0];
  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="admin-nav"
        className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-white/15 px-3 text-left text-[14.5px] text-white lg:hidden">
        <Icon name={current[2]} size={17} /><span className="min-w-0 flex-1 truncate">{current[1]}</span>
        <span aria-hidden="true" className={`text-[12px] transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      <nav id="admin-nav" aria-label="Ադմին"
        className={`${open ? "grid" : "hidden"} mt-2 grid-cols-2 gap-1 lg:mt-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto [scrollbar-color:#3a4a62_transparent] [scrollbar-width:thin]`}>
        {items.map(([href, label, icon]) => {
          const active = href === current[0];
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={`flex min-h-10 min-w-0 items-center gap-2 rounded-xl px-2.5 py-1 text-[13px] no-underline lg:min-h-9 lg:gap-3 lg:text-[14px] ${active ? "bg-white/10 text-white" : "text-[#b9c4d4] hover:bg-white/5 hover:text-white"}`}>
              <Icon name={icon} size={17} className="flex-none" /><span className="min-w-0 leading-tight break-words lg:truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
