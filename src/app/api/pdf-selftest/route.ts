import { htmlToPdf, pdfHeaders } from "@/lib/pdf";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
// temporary deployment check for serverless Chromium; removed right after
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("t") !== "c092245729fbff75843653cd") return new Response("Not found", { status: 404 });
  const html = '<!DOCTYPE html><html><head><style>@font-face{font-family:S;src:url(/fonts/sans-arm-400.woff2)}@page{size:210mm 297mm;margin:0}body{font-family:S;font-size:30pt;padding:30mm}</style></head><body>Վկայական · Certificate<br><img src="/cert/seal.png" style="height:40mm"></body></html>';
  try { return new Response(Buffer.from(await htmlToPdf(html, new URL(req.url).origin)), { headers: pdfHeaders("selftest.pdf") }); }
  catch (e) { return new Response(String((e as Error)?.stack || e), { status: 500 }); }
}
