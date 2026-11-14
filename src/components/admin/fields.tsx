import type { L10n } from "@/db/schema";

const langs = [["hy", "ՀԱՅ"], ["ru", "РУС"], ["en", "ENG"]] as const;

export function L10nInput({ name, label, value, required, textarea, rows = 3, hint }: { name: string; label: string; value?: Partial<L10n> | null; required?: boolean; textarea?: boolean; rows?: number; hint?: string }) {
  return (
    <fieldset className="m-0 rounded-2xl border border-line p-4">
      <legend className="px-1.5 text-[13.5px] font-semibold text-[#3d4757]">{label}</legend>
      <div className="grid gap-3 lg:grid-cols-3">
        {langs.map(([l, tag]) => (
          <label key={l} className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            {tag}
            {textarea
              ? <textarea name={`${name}_${l}`} defaultValue={value?.[l] ?? ""} rows={rows} required={required && l === "hy"} className="input py-2.5 text-[14px] font-normal" />
              : <input name={`${name}_${l}`} defaultValue={value?.[l] ?? ""} required={required && l === "hy"} className="input min-h-11 text-[14px] font-normal" />}
          </label>
        ))}
      </div>
      {hint && <p className="mt-2 mb-0 text-[12.5px] text-muted">{hint}</p>}
    </fieldset>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`label ${className}`}>{label}{children}</label>;
}

export function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return <label className="flex min-h-11 items-center gap-2.5 text-[14px]"><input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-[18px] accent-navy-800" />{label}</label>;
}

export function AdminCard({ title, children, actions }: { title?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="card p-6">
      {(title || actions) && <div className="mb-4 flex flex-wrap items-center justify-between gap-3">{title && <h2 className="text-[17px] font-semibold text-navy-900">{title}</h2>}{actions}</div>}
      {children}
    </section>
  );
}

export function PageHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><h1 className="font-serif text-[28px] font-bold text-navy-900">{title}</h1><div className="flex flex-wrap gap-2.5">{children}</div></div>;
}

export const th = "px-3 py-2.5 text-left text-[12.5px] font-semibold text-muted";
export const td = "border-t border-[#eee7d8] px-3 py-3 align-top text-[14px]";
export const badge: Record<string, string> = {
  NEW: "bg-[#e6eef8] text-navy-800", INTERVIEW: "bg-[#fbf2dd] text-[#7a5a12]", APPROVED: "bg-[#e6eef8] text-navy-800", PAID: "bg-[#e3f1e6] text-[#1f5f33]",
  REJECTED: "bg-[#fbefeb] text-[#8a2f1d]", CANCELLED: "bg-[#eef0f3] text-[#4b5563]", PENDING: "bg-[#fbf2dd] text-[#7a5a12]", FAILED: "bg-[#fbefeb] text-[#8a2f1d]",
  REFUNDED: "bg-[#eef0f3] text-[#4b5563]", OPEN: "bg-[#e3f1e6] text-[#1f5f33]", FULL: "bg-[#fbf2dd] text-[#7a5a12]", RUNNING: "bg-[#e6eef8] text-navy-800", FINISHED: "bg-[#eef0f3] text-[#4b5563]",
};
export const statusHy: Record<string, string> = {
  NEW: "Նոր", INTERVIEW: "Մուտքային զրույց", APPROVED: "Հաստատված", REJECTED: "Մերժված", PAID: "Վճարված / ակտիվ", CANCELLED: "Չեղարկված",
  PENDING: "Սպասվում է", FAILED: "Չհաջողված", REFUNDED: "Վերադարձված", OPEN: "Գրանցումը բաց է", FULL: "Լրացված", RUNNING: "Ընթացքում", FINISHED: "Ավարտված",
};
