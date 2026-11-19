"use client";

import type { ComponentProps } from "react";

/**
 * A <select> that submits its form as soon as the value changes.
 * `reset` names another field of the same form to clear first (e.g. the group list,
 * which still holds the previous course's groups until the page reloads).
 */
export function SubmitOnChange({ reset, ...props }: ComponentProps<"select"> & { reset?: string }) {
  return (
    <select
      {...props}
      onChange={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        if (reset) {
          const other = form.elements.namedItem(reset);
          if (other instanceof HTMLSelectElement) other.selectedIndex = -1;
        }
        form.requestSubmit();
      }}
    />
  );
}
