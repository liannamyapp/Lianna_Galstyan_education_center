import { Icon } from "@/components/Icon";

type Labels = { hy: string; en: string; insert: string; scan: string; open: string; download: string };

/** The three certificate documents, each with "open / print" and "download PDF", plus the uploaded scan. */
export function CertDocs({ base, fileUrl, labels }: { base: string; fileUrl?: string | null; labels: Labels }) {
  const docs = [["hy", labels.hy], ["en", labels.en], ["insert", labels.insert]] as const;
  return (
    <div className="grid basis-full gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr))]">
      {docs.map(([k, label]) => (
        <div key={k} className="flex flex-col gap-2 rounded-xl border border-[#eee7d8] bg-ivory p-3">
          <b className="text-[14px] text-navy-900">{label}</b>
          <div className="flex flex-wrap gap-2">
            <a href={`${base}/${k}`} target="_blank" rel="noopener" className="btn-soft min-h-10 flex-1 px-3 text-[13px] whitespace-nowrap">{labels.open}</a>
            <a href={`${base}/${k}?download=1`} className="btn-navy min-h-10 flex-1 gap-1.5 px-3 text-[13px] whitespace-nowrap"><Icon name="file" size={16} />{labels.download}</a>
          </div>
        </div>
      ))}
      {fileUrl && (
        <div className="flex flex-col gap-2 rounded-xl border border-[#eee7d8] bg-ivory p-3">
          <b className="text-[14px] text-navy-900">{labels.scan}</b>
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn-soft min-h-10 px-3 text-[13px]">{labels.open}</a>
        </div>
      )}
    </div>
  );
}
