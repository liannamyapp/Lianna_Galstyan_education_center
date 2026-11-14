import type { Metadata } from "next";
import { getDict, tr, type Locale } from "@/lib/i18n";
import { findCertificate } from "@/lib/data";
import { date } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(locale);
  return pageMeta({ locale, path: "/verify", title: t.verify.title, description: t.home.verifyText });
}

const mask = (name: string) => name.split(/\s+/).map((p, i) => (i === 0 ? p : `${p[0]}.`)).join(" ");

export default async function Verify({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ n?: string }> }) {
  const { locale } = await params;
  const { n } = await searchParams;
  const t = getDict(locale);
  const cert = n ? await findCertificate(n) : null;
  return (
    <div className="container-x max-w-[900px] pt-16 text-center">
      <p className="eyebrow">{t.verify.eyebrow}</p>
      <h1 className="mt-3 font-serif text-[clamp(30px,4vw,46px)] font-bold text-navy-900">{t.verify.title}</h1>
      <p className="mx-auto mt-3 mb-8 max-w-[560px] text-muted">{t.verify.text}</p>
      <form className="mx-auto flex max-w-[620px] flex-wrap justify-center gap-2.5">
        <label htmlFor="vn" className="sr-only">{t.verify.number}</label>
        <input id="vn" name="n" defaultValue={n ?? ""} required placeholder="ՖՎԾ-01/2027/001" className="input min-h-14 flex-[1_1_300px] rounded-full border-[1.5px] border-navy-800 px-6 font-mono text-[16px]" />
        <button className="btn-navy min-h-14 px-8">{t.verify.check}</button>
      </form>
      {n && (
        <div className="card mx-auto mt-10 max-w-[680px] overflow-hidden text-left" role="status">
          {!cert ? (
            <p className="m-0 flex items-center gap-3 bg-[#fbefeb] px-6 py-4 font-semibold text-[#8a2f1d]"><Icon name="close" />{t.verify.invalid}</p>
          ) : (
            <>
              <p className={`m-0 flex items-center gap-3 px-6 py-4 font-bold ${cert.revoked ? "bg-[#fbefeb] text-[#8a2f1d]" : "bg-[#e3f1e6] text-[#1f5f33]"}`}>
                <Icon name={cert.revoked ? "close" : "check"} strokeWidth={2.4} />{cert.revoked ? t.verify.revoked : t.verify.valid}
              </p>
              <dl className="m-0 grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] gap-x-5 gap-y-3 p-6 text-[15px]">
                <dt className="text-muted">{t.verify.number}</dt><dd className="m-0 font-mono">{cert.number}</dd>
                <dt className="text-muted">{t.verify.holder}</dt><dd className="m-0 font-semibold text-navy-900">{mask(cert.holderName)}</dd>
                <dt className="text-muted">{t.verify.program}</dt><dd className="m-0">{tr(cert.courseTitle, locale)} ({cert.code}) · {cert.hours} {t.course.hours}</dd>
                <dt className="text-muted">{t.verify.period}</dt><dd className="m-0">{date(cert.startDate, locale)} – {date(cert.endDate, locale)}</dd>
                <dt className="text-muted">{t.verify.issued}</dt><dd className="m-0">{date(cert.issuedAt, locale)}</dd>
              </dl>
              <p className="m-0 px-6 pb-5 text-[13px] text-muted">{t.verify.privacy}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
