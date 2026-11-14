export function Stars({ value, size = 16, label }: { value: number; size?: number; label: string }) {
  return (
    <span className="inline-flex gap-0.5 text-gold-500" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= value ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
        </svg>
      ))}
    </span>
  );
}
