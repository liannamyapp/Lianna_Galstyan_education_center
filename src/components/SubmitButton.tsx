"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText, className = "btn-navy", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className} {...rest}>
      {pending ? pendingText ?? children : children}
    </button>
  );
}
