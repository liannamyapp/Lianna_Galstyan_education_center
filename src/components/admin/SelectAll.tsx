"use client";
/** Checks or clears every row checkbox that belongs to the given form. */
export function SelectAll({ form, label }: { form: string; label: string }) {
  return (
    <input
      type="checkbox" aria-label={label} title={label} className="size-4"
      onChange={(e) => document.querySelectorAll<HTMLInputElement>(`input[name="ids"][form="${form}"]`).forEach((x) => { x.checked = e.currentTarget.checked; })}
    />
  );
}
