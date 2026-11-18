import { htmlToPdf } from "@/lib/pdf";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
// temporary: 4 simultaneous renders on a cold instance (the ETXTBSY case); removed right after
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("t") !== "681e7a42dc38160d19b6eb21") return new Response("Not found", { status: 404 });
  const o = new URL(req.url).origin; const t0 = Date.now();
  const page = (i: number) => '<!DOCTYPE html><html><head><style>@page{size:210mm 297mm;margin:0}</style></head><body>test ' + i + '<img src="/cert/seal.png" style="height:30mm"></body></html>';
  const r = await Promise.allSettled([1, 2, 3, 3].map((i) => htmlToPdf(page(i), o)));
  return Response.json({ ms: Date.now() - t0, results: r.map((x) => x.status === "fulfilled" ? x.value.byteLength : String(x.reason)) });
}
