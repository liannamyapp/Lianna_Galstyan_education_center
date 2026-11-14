const paths: Record<string, string> = {
  code: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
  arrow: "M5 12h14M13 6l6 6-6 6",
  check: "M5 12l5 5 9-10",
  plus: "M12 5v14M5 12h14",
  shield: "M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7zM9 12l2 2 4-4",
  lock: "M5 11h14v9H5zM8 11V8a4 4 0 018 0v3",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4z",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  file: "M14 3H6v18h12V7zM14 3v4h4",
  card: "M3 6h18v12H3zM3 10h18",
  wallet: "M3 7h16v12H3zM16 13h2M3 7l12-3v3",
  calendar: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
  users: "M16 20v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M9 11a4 4 0 100-8 4 4 0 000 8M22 20v-1a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8",
  play: "M8 5v14l11-7z",
  logout: "M9 21H5V3h4M16 17l5-5-5-5M21 12H9",
  palette: "M12 3a9 9 0 100 18c1 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 005-5c0-4.4-4-8-9-8zM7.5 11a1 1 0 100-2 1 1 0 000 2M10.5 7.5a1 1 0 100-2 1 1 0 000 2M15 7.5a1 1 0 100-2 1 1 0 000 2",
  globe: "M12 3a9 9 0 100 18 9 9 0 000-18M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3",
  book: "M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4zM20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  telegram: "M21 4L3 11l6 2 2 6 3-4 5 4z",
  whatsapp: "M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-4-1.1zM9 8.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1a3.5 3.5 0 01-2-2l1-1-1-2z",
  instagram: "M4 4h16v16H4zM12 16a4 4 0 100-8 4 4 0 000 8M17 7h.01",
  facebook: "M14 8h3V4h-3a4 4 0 00-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z",
};

export function Icon({ name, size = 20, className, strokeWidth = 1.9, label }: { name: string; size?: number; className?: string; strokeWidth?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      <path d={paths[name] ?? paths.code} />
    </svg>
  );
}

export const iconNames = Object.keys(paths);
