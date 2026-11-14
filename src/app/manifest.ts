import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Լիաննա Գալստյան · Կրթական կենտրոն",
    short_name: "ԼԳ Academy",
    description: "Ծրագրավորման առցանց դասընթացներ",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f0",
    theme_color: "#0f2440",
    lang: "hy",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
