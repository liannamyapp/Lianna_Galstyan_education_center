"use client";
import { useEffect, useRef } from "react";

export type PickerOption = { appId?: string; userId: string; courseId: string; label: string; start?: string; end?: string };

/** Choosing a learner also fills in their course and, when known, the group's dates. `initial` (an application id) preselects one. */
export function CertStudentPicker({ options, initial }: { options: PickerOption[]; initial?: string }) {
  const ref = useRef<HTMLSelectElement>(null);
  const start = initial ? options.findIndex((o) => o.appId === initial) : -1;
  const fill = (o: PickerOption | undefined, form: HTMLFormElement | null) => {
    if (!o || !form) return;
    const set = (name: string, v?: string) => { const el = form.elements.namedItem(name); if (v && (el instanceof HTMLSelectElement || el instanceof HTMLInputElement)) el.value = v; };
    set("courseId", o.courseId); set("startDate", o.start); set("endDate", o.end);
  };
  useEffect(() => {
    if (start < 0 || !ref.current) return;
    fill(options[start], ref.current.form);
    ref.current.scrollIntoView({ block: "center", behavior: "smooth" });
    ref.current.focus({ preventScroll: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <select ref={ref} name="userId" className="input" defaultValue={start >= 0 ? options[start].userId : ""}
      onChange={(e) => fill(options[e.currentTarget.selectedIndex - 1], e.currentTarget.form)}>
      <option value="">— ձեռքով մուտքագրել ներքևում —</option>
      {options.map((o, i) => <option key={i} value={o.userId}>{o.label}</option>)}
    </select>
  );
}
