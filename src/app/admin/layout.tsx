import { AdminNav } from "@/components/admin/AdminNav";
import type { Metadata } from "next";
import Link from "next/link";
import "../globals.css";
import { requireAdmin } from "@/lib/auth";
import { Icon } from "@/components/Icon";
import { logoutAction } from "../[locale]/actions";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, s } from "@/db";

export const metadata: Metadata = { title: "Ադմին · ALTA Academy", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const nav: [string, string, string][] = [
  ["/admin", "Վահանակ", "chart"],
  ["/admin/crm", "CRM · Վաճառքներ", "send"],
  ["/admin/applications", "Հայտեր", "file"],
  ["/admin/students", "Ունկնդիրներ", "users"],
  ["/admin/payments", "Վճարումներ", "card"],
  ["/admin/reviews", "Կարծիքներ", "star"],
  ["/admin/chats", "Չատեր", "chat"],
  ["/admin/messages", "Հաղորդագրություններ", "mail"],
  ["/admin/directions", "Ուղղություններ", "globe"],
  ["/admin/courses", "Դասընթացներ", "book"],
  ["/admin/groups", "Խմբեր և դասացուցակ", "calendar"],
  ["/admin/lessons", "Տեսադասեր", "play"],
  ["/admin/journal", "Էլ. մատյան", "book"],
  ["/admin/certificates", "Վկայականներ", "shield"],
  ["/admin/posts", "Բլոգ", "palette"],
  ["/admin/faq", "Հաճախ տրվող հարցեր", "plus"],
  ["/admin/pages", "Փաստաթղթեր (էջեր)", "file"],
  ["/admin/subscribers", "Բաժանորդներ", "send"],
  ["/admin/settings", "Կարգավորումներ", "code"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  const unreadChats = await db.select({ n: sql<number>`count(*)::int` }).from(s.chatThreads)
    .where(and(eq(s.chatThreads.status, "open"), gt(s.chatThreads.adminUnread, 0))).then((r) => r[0]?.n ?? 0).catch(() => 0);
  const items = nav.map(([href, label, icon]) => [href, href === "/admin/chats" && unreadChats ? `${label} (${unreadChats})` : label, icon] as [string, string, string]);
  return (
    <html lang="hy">
      <body className="bg-[#f3f1ec]">
        <div className="flex min-h-screen flex-wrap">
          <aside className="w-full bg-navy-950 p-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[260px] lg:flex-none lg:flex-col">
            <div className="flex items-center justify-between gap-3">
              <Link href="/admin" className="flex min-w-0 items-center gap-3 px-2 py-2 text-white no-underline">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-emblem.svg" alt="ALTA Academy" width={73} height={40} className="h-10 w-auto flex-none" />
                <span className="min-w-0"><span className="block font-serif font-bold">Ադմին</span><span className="block truncate text-[12px] text-[#8193ab]">{me.name}</span></span>
              </Link>
            </div>
            {/* Always visible, whatever the screen height */}
            <div className="mt-2 mb-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
              <Link href="/hy" target="_blank" rel="noopener" className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gold-500 px-3 whitespace-nowrap lg:justify-start text-[13.5px] font-semibold text-navy-950 no-underline hover:bg-gold-400"><Icon name="globe" size={16} />Բացել կայքը</Link>
              <Link href="/hy/account#profile" className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/20 px-3 whitespace-nowrap lg:justify-start text-[13.5px] text-white no-underline hover:bg-white/5"><Icon name="lock" size={16} />Մուտքի տվյալներ</Link>
            </div>
            <AdminNav items={items} />
            <form action={logoutAction} className="mt-2 border-t border-white/10 pt-2"><input type="hidden" name="locale" value="hy" /><button className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-[14px] text-[#b9c4d4] hover:bg-white/5 hover:text-white"><Icon name="logout" size={17} />Դուրս գալ</button></form>
          </aside>
          <main id="main" className="min-w-0 flex-1 p-5 sm:p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
