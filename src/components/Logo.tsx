import Link from "next/link";

export function Logo({ href, name, tagline, light = true }: { href: string; name: string; tagline?: string; light?: boolean }) {
  return (
    <Link href={href} aria-label={name} className={`flex items-center gap-3 no-underline ${light ? "text-white" : "text-navy-900"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={light ? "/logo-emblem.svg" : "/logo-emblem-light.svg"} alt="" width={84} height={46} className="h-[46px] w-auto flex-none" />
      <span className="flex flex-col leading-tight">
        <span className="whitespace-nowrap font-serif text-[19px] font-bold tracking-[0.06em]">{name}</span>
        {tagline ? <span className={`whitespace-nowrap text-[11px] tracking-[0.14em] uppercase ${light ? "text-[#b9c4d4]" : "text-muted"}`}>{tagline}</span> : null}
      </span>
    </Link>
  );
}
