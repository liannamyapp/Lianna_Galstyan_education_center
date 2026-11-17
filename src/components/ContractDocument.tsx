import type { Locale } from "@/lib/i18n";

type Labels = Record<string, string>;
type Party = { name: string; lines: string[] };

const TZ = "Asia/Yerevan";
const INTL: Record<Locale, string> = { hy: "hy-AM", ru: "ru-RU", en: "en-GB" };

export function dateTime(d: Date | string, l: Locale) {
  return new Date(d).toLocaleString(INTL[l], { timeZone: TZ, day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * The agreement as a branded document: ALTA header, parties, numbered clauses, signatures.
 * `sample` shows labelled blanks and a watermark; otherwise the learner's own data.
 */
export function ContractDocument({
  locale, labels, tagline, no, dateText, provider, client, bodyHtml, sample, signed,
}: {
  locale: Locale;
  labels: Labels;
  tagline: string;
  no: string;
  /** HTML (escaped text or a blank) */
  dateText: string;
  provider: Party;
  client: Party;
  bodyHtml: string;
  sample: boolean;
  signed: { at: Date | string; name: string } | null;
}) {
  const t = labels;
  return (
    <div className="contract-doc relative overflow-hidden rounded-[22px] border border-[#e6dcc6] bg-white shadow-[0_18px_50px_rgba(15,36,64,.10)] print:rounded-none print:border-0 print:shadow-none">
      {sample && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 flex select-none flex-col items-center justify-around overflow-hidden">
          {[0, 1, 2].map((i) => (
            <span key={i} className="-rotate-[24deg] whitespace-nowrap font-serif text-[clamp(64px,15vw,150px)] font-bold tracking-[0.12em] text-navy-900 opacity-[0.045]">{t.sample}</span>
          ))}
        </div>
      )}

      <header className="relative z-10 flex items-center gap-4 bg-navy-900 px-5 py-5 text-white sm:px-10 sm:py-6">
        <img src="/logo-emblem.svg" alt="" width={92} height={50} className="h-[42px] w-auto flex-none sm:h-[50px]" />
        <div className="min-w-0 leading-tight">
          <p className="m-0 font-serif text-[19px] font-bold tracking-[0.06em] sm:text-[22px]">ALTA Academy</p>
          <p className="m-0 mt-1 text-[10.5px] tracking-[0.16em] text-[#b9c4d4] uppercase sm:text-[11px]">{tagline}</p>
        </div>
        <div className="ml-auto hidden text-right text-[12.5px] leading-snug text-[#dfe6f0] sm:block">
          <span className="font-semibold text-gold-300">№ {no}</span><br />{t.city} · <span dangerouslySetInnerHTML={{ __html: dateText }} />
        </div>
      </header>
      <div className="relative z-10 h-[3px] bg-[linear-gradient(90deg,#9a7432,#e3c27a_50%,#9a7432)]" />

      <div className="relative z-10 px-5 py-8 sm:px-12 sm:py-11">
        <div className="text-center">
          <p className="m-0 text-[11.5px] font-semibold tracking-[0.2em] text-gold-700 uppercase">{sample ? t.sample : `№ ${no}`}</p>
          <h1 className="mx-auto mt-2 max-w-[560px] font-serif text-[clamp(22px,4.6vw,30px)] leading-tight font-bold break-words text-navy-900">{t.docTitle}</h1>
          <p className="mt-2 mb-0 text-[14px] text-muted">№ {no} · {t.city} · <span dangerouslySetInnerHTML={{ __html: dateText }} /></p>
          <div className="mx-auto mt-5 flex max-w-[220px] items-center gap-3 text-gold-500" aria-hidden="true">
            <span className="h-px flex-1 bg-current opacity-60" /><span className="text-[10px]">◆</span><span className="h-px flex-1 bg-current opacity-60" />
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[{ role: t.provider, p: provider }, { role: t.client, p: client }].map(({ role, p }) => (
            <section key={role} className="min-w-0 rounded-2xl border border-[#eadfc8] bg-[#fbf8f1] p-5">
              <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-gold-700 uppercase">{role}</p>
              <p className="mt-2 mb-1 text-[16px] font-bold [overflow-wrap:anywhere] text-navy-900" dangerouslySetInnerHTML={{ __html: p.name }} />
              {p.lines.map((x, i) => <p key={i} className="m-0 text-[13.5px] leading-relaxed [overflow-wrap:anywhere] text-[#4a5568]" dangerouslySetInnerHTML={{ __html: x }} />)}
            </section>
          ))}
        </div>
        <p className="mt-3 mb-0 text-[13px] text-muted italic">{t.minorNote}</p>

        <div className="contract-body mt-8 [overflow-wrap:anywhere]" dangerouslySetInnerHTML={{ __html: bodyHtml }} />

        <section className="mt-10 break-inside-avoid">
          <h2 className="m-0 border-b border-[#eadfc8] pb-2 font-serif text-[18px] font-bold text-navy-900">{t.signatures}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#e6ecf4] p-5">
              <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-gold-700 uppercase">{t.provider}</p>
              <p className="mt-2 mb-3 font-semibold text-navy-900" dangerouslySetInnerHTML={{ __html: provider.name }} />
              <span className="inline-flex items-center gap-2 rounded-full bg-[#e3f1e6] px-3 py-1.5 text-[12.5px] font-semibold text-[#1f5f33]">✓ {t.providerSigned}</span>
            </div>
            <div className="rounded-2xl border border-[#e6ecf4] p-5">
              <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-gold-700 uppercase">{t.client}</p>
              {signed ? (
                <>
                  <p className="mt-2 mb-1 font-serif text-[20px] font-bold [overflow-wrap:anywhere] text-navy-900 italic">{signed.name}</p>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#e3f1e6] px-3 py-1.5 text-[12.5px] font-semibold text-[#1f5f33]">✓ {t.clientSigned}</span>
                  <p className="mt-2 mb-0 text-[12.5px] text-muted">{t.signedAt}: {dateTime(signed.at, locale)}</p>
                </>
              ) : (
                <>
                  <p className="mt-2 mb-3 font-semibold [overflow-wrap:anywhere] text-navy-900" dangerouslySetInnerHTML={{ __html: client.name }} />
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#fdf3e1] px-3 py-1.5 text-[12.5px] font-semibold text-[#8a5a2b]">{t.awaiting}</span>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      <footer className="relative z-10 flex flex-wrap justify-between gap-2 border-t border-[#eee7d8] bg-[#fbf8f1] px-5 py-4 text-[12px] text-muted sm:px-12">
        <span>ALTA Academy · {provider.lines.slice(-1)[0]?.replace(/<[^>]+>/g, "")}</span>
        <span>№ {no}</span>
      </footer>
    </div>
  );
}
