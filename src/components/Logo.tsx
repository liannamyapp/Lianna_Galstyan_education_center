import Link from "next/link";

export function Logo({ href, name, tagline, light = true }: { href: string; name: string; tagline?: string; light?: boolean }) {
  return (
    <Link href={href} className={`flex items-center gap-3 no-underline ${light ? "text-white" : "text-navy-900"}`}>
      <span className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-gold-500 font-serif text-[17px] font-bold text-gold-300" aria-hidden="true">ԼԳ</span>
      <span className="flex flex-col leading-tight">
        <span className="whitespace-nowrap font-serif text-[18px] font-bold">{name}</span>
        {tagline ? <span className={`whitespace-nowrap text-[11px] tracking-[0.14em] uppercase ${light ? "text-[#b9c4d4]" : "text-muted"}`}>{tagline}</span> : null}
      </span>
    </Link>
  );
}
