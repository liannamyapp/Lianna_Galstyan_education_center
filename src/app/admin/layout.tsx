import type { Metadata } from "next";
import Link from "next/link";
import "../globals.css";
import { requireAdmin } from "@/lib/auth";
import { Icon } from "@/components/Icon";
import { logoutAction } from "../[locale]/actions";

export const metadata: Metadata = { title: "Ադմին · Լիաննա Գալստյան", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const nav: [string, string, string][] = [
  ["/admin", "Վահանակ", "chart"],
  ["/admin/applications", "Հայտեր", "file"],
  ["/admin/students", "Ունկնդիրներ", "users"],
  ["/admin/payments", "Վճարումներ", "card"],
  ["/admin/reviews", "Կարծիքներ", "star"],
  ["/admin/messages", "Հաղորդագրություններ", "mail"],
  ["/admin/directions", "Ուղղություններ", "globe"],
  ["/admin/courses", "Դասընթացներ", "book"],
  ["/admin/groups", "Խմբեր և դասացուցակ", "calendar"],
  ["/admin/lessons", "Տեսադասեր", "play"],
  ["/admin/certificates", "Վկայականներ", "shield"],
  ["/admin/posts", "Բլոգ", "palette"],
  ["/admin/faq", "Հաճախ տրվող հարցեր", "plus"],
  ["/admin/pages", "Փաստաթղթեր (էջեր)", "file"],
  ["/admin/subscribers", "Բաժանորդներ", "send"],
  ["/admin/settings", "Կարգավորումներ", "code"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  return (
    <html lang="hy">
      <body className="bg-[#f3f1ec]">
        <div className="flex min-h-screen flex-wrap">
          <aside className="w-full bg-navy-950 p-4 lg:sticky lg:top-0 lg:h-screen lg:w-[260px] lg:flex-none lg:overflow-y-auto">
            <Link href="/admin" className="mb-4 flex items-center gap-3 px-2 py-2 text-white no-underline">
              <span className="flex size-10 items-center justify-center rounded-full border-[1.5px] border-gold-500 font-serif font-bold text-gold-300">ԼԳ</span>
              <span><span className="block font-serif font-bold">Ադմին</span><span className="block text-[12px] text-[#8193ab]">{me.name}</span></span>
            </Link>
            <nav aria-label="Ադմին" className="flex gap-1 overflow-x-auto lg:flex-col">
              {nav.map(([href, label, icon]) => (
                <Link key={href} href={href} className="flex min-h-10 flex-none items-center gap-3 rounded-xl px-3 text-[14px] text-[#b9c4d4] no-underline hover:bg-white/5 hover:text-white"><Icon name={icon} size={17} />{label}</Link>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-1 border-t border-white/10 pt-3">
              <Link href="/hy" target="_blank" className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-[14px] text-gold-300 no-underline hover:bg-white/5"><Icon name="globe" size={17} />Բացել կայքը</Link>
              <form action={logoutAction}><input type="hidden" name="locale" value="hy" /><button className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-[14px] text-[#b9c4d4] hover:bg-white/5"><Icon name="logout" size={17} />Դուրս գալ</button></form>
            </div>
          </aside>
          <main id="main" className="min-w-0 flex-1 p-5 sm:p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
