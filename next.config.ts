import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const config: NextConfig = {
  poweredByHeader: false,
  // put <title>/<meta> in <head> for every client (no streamed metadata) — best for SEO tools
  htmlLimitedBots: /.*/,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  // the CRM guide page reads docs/CRM.md at runtime
  outputFileTracingIncludes: {
    "/admin/crm/guide": ["./docs/CRM.md"],
    // serverless Chromium binary for certificate PDF downloads
    "/[locale]/account/certificate/[id]/[doc]": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // the site moved to altaacademy.am: old vercel.app links keep working via a permanent redirect
  // (API webhooks and the Search Console verification file stay on the old host)
  async redirects() {
    // 301 (not 308) so Search Console's "Change of address" check accepts it
    const has = [{ type: "host" as const, value: "lianna-galstyan-education.vercel.app" }];
    return [
      { source: "/", has, destination: "https://altaacademy.am/", statusCode: 301 },
      {
        source: "/:path((?!api/|google7c672a8654214504\\.html).+)",
        has,
        destination: "https://altaacademy.am/:path",
        statusCode: 301,
      },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
