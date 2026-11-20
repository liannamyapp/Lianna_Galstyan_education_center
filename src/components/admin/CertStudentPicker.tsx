"use client";

export type PickerOption = { userId: string; courseId: string; label: string; start?: string; end?: string };

/** Choosing a learner also fills in their course and, when known, the group's dates. */
export function CertStudentPicker({ options }: { options: PickerOption[] }) {
  return (
    <select name="userId" className="input" defaultValue=""
      onChange={(e) => {
        const o = options[e.currentTarget.selectedIndex - 1];
        const form = e.currentTarget.form;
        if (!o || !form) return;
        const set = (name: string, v?: string) => { const el = form.elements.namedItem(name); if (v && (el instanceof HTMLSelectElement || el instanceof HTMLInputElement)) el.value = v; };
        set("courseId", o.courseId); set("startDate", o.start); set("endDate", o.end);
      }}>
      <option value="">— ձեռքով մուտքագրել ներքևում —</option>
      {options.map((o, i) => <option key={i} value={o.userId}>{o.label}</option>)}
    </select>
  );
}
