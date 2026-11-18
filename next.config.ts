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
    "/api/pdf-selftest": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
