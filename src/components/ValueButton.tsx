"use client";
/** A submit button whose name/value always reaches the server action
 *  (React form actions don't include the clicked button in FormData). */
export function ValueButton({ name, value, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { name: string; value: string }) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      {...rest}
      onClick={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        let input = form.querySelector<HTMLInputElement>(`input[type=hidden][data-vb="${name}"]`);
        if (!input) { input = document.createElement("input"); input.type = "hidden"; input.name = name; input.dataset.vb = name; form.appendChild(input); }
        input.value = value;
      }}
    >
      {children}
    </button>
  );
}
