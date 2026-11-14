/** Turns a lesson link into something the browser can play. */
export type Playable =
  | { kind: "iframe"; src: string; download: string | null }
  | { kind: "video"; src: string; download: string }
  | { kind: "link"; src: string; download: null };

export function playable(url: string): Playable {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?rel=0`, download: null };
    if (host.endsWith("youtube.com")) {
      const id = u.searchParams.get("v") || u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]+)/)?.[1];
      if (id) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0`, download: null };
    }
    if (host.endsWith("vimeo.com")) {
      const id = u.pathname.match(/(\d{6,})/)?.[1];
      if (id) return { kind: "iframe", src: `https://player.vimeo.com/video/${id}`, download: null };
    }
    if (host === "drive.google.com") {
      const id = u.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] || u.searchParams.get("id");
      if (id) return { kind: "iframe", src: `https://drive.google.com/file/d/${id}/preview`, download: `https://drive.google.com/uc?export=download&id=${id}` };
    }
    if (/\.(mp4|webm|mov|m4v|ogg)$/i.test(u.pathname) || host.endsWith("blob.vercel-storage.com") || u.pathname.startsWith("/uploads/")) {
      const dl = host.endsWith("blob.vercel-storage.com") ? `${url}${url.includes("?") ? "&" : "?"}download=1` : url;
      return { kind: "video", src: url, download: dl };
    }
  } catch { /* relative or invalid */ }
  if (url.startsWith("/")) return { kind: "video", src: url, download: url };
  return { kind: "link", src: url, download: null };
}
