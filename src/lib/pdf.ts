import "server-only";

/**
 * Renders a self-contained print page (certificate, supplement, contract) to a PDF file with headless Chromium.
 * On Vercel it uses the serverless build from @sparticuz/chromium; locally it uses CHROME_PATH or the system Chrome.
 * `origin` is used as the base URL so fonts, guilloche backgrounds and the seal load from the site's public folder.
 */
import { createHash } from "node:crypto";
import type { Browser } from "puppeteer-core";

type LaunchCfg = { executablePath: string; args: string[] };
let cfgPromise: Promise<LaunchCfg> | null = null;
let browserPromise: Promise<Browser> | null = null;
/** Identical requests in flight share one rendering (phones often send the same download request twice). */
const inflight = new Map<string, Promise<Uint8Array>>();
const done = new Map<string, { at: number; pdf: Uint8Array }>();

/** Resolved once per server instance: unpacking the serverless Chromium twice at the same time fails with ETXTBSY. */
function launchCfg(): Promise<LaunchCfg> {
  cfgPromise ??= (async () => {
    const base = ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"];
    if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args: base };
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const chromium = (await import("@sparticuz/chromium")).default;
      return { executablePath: await chromium.executablePath(), args: [...chromium.args, "--font-render-hinting=none"] };
    }
    return { executablePath: "/usr/bin/google-chrome", args: base };
  })().catch((e) => { cfgPromise = null; throw e; });
  return cfgPromise;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One browser per instance, reused between requests; relaunched if it died. Retries while the binary is still busy. */
async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b?.connected) return b;
    browserPromise = null;
  }
  browserPromise = (async () => {
    const puppeteer = (await import("puppeteer-core")).default;
    const cfg = await launchCfg();
    let last: unknown;
    for (let i = 0; i < 5; i++) {
      try {
        return await puppeteer.launch({ ...cfg, headless: true });
      } catch (e) {
        last = e;
        const code = (e as NodeJS.ErrnoException)?.code;
        if (code !== "ETXTBSY" && !String(e).includes("ETXTBSY")) break;
        await sleep(400 * (i + 1));
      }
    }
    throw last;
  })().catch((e) => { browserPromise = null; throw e; });
  return browserPromise;
}

async function render(html: string, origin: string): Promise<Uint8Array> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1400, height: 1000 });
    const withBase = html.replace(/<head>/i, `<head><base href="${origin}/">`);
    await page.setContent(withBase, { waitUntil: "load", timeout: 25_000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
    });
    await page.emulateMediaType("print");
    return await page.pdf({ preferCSSPageSize: true, printBackground: true });
  } finally {
    await page.close().catch(() => {});
  }
}

export async function htmlToPdf(html: string, origin: string): Promise<Uint8Array> {
  const key = createHash("sha1").update(origin).update(html).digest("hex");
  const hit = done.get(key);
  if (hit && Date.now() - hit.at < 120_000) return hit.pdf;
  let p = inflight.get(key);
  if (!p) {
    p = (async () => {
      try {
        return await render(html, origin);
      } catch (e) {
        // the shared browser may have crashed: start a fresh one and try once more
        const b = await browserPromise?.catch(() => null);
        browserPromise = null;
        await b?.close().catch(() => {});
        return await render(html, origin);
      }
    })();
    inflight.set(key, p);
    p.then((pdf) => { done.set(key, { at: Date.now(), pdf }); if (done.size > 20) done.delete(done.keys().next().value!); }, () => {})
      .finally(() => inflight.delete(key));
  }
  return p;
}

/** ASCII-safe file name plus the UTF-8 one for browsers that support it. */
export function pdfHeaders(fileName: string, inline = false): HeadersInit {
  const ascii = fileName.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/["\\/]/g, "-").replace(/\s+/g, "_") || "document.pdf";
  return {
    "content-type": "application/pdf",
    "content-disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "cache-control": "private, no-store",
    "x-robots-tag": "noindex",
  };
}

/** Shown instead of a blank error if the PDF could not be made: retry, or open the printable page. */
export function pdfFailedPage(viewUrl: string, retryUrl: string): string {
  return `<!DOCTYPE html><html lang="hy"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>PDF</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f2440;color:#fff;font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px;box-sizing:border-box}
.c{max-width:420px;text-align:center}h1{font-size:20px;margin:0 0 10px}p{margin:0 0 18px;color:#d9dfe8}
a{display:block;margin:10px 0;padding:14px 18px;border-radius:999px;text-decoration:none;font-weight:700}
.p{background:#c9a24b;color:#0f2440}.s{border:1px solid #ffffff55;color:#fff}</style></head><body><div class="c">
<h1>Ֆայլը պատրաստվում է…</h1><p>PDF-ը առաջին անգամ պատրաստելը կարող է տևել մի քանի վայրկյան։ Սեղմեք «Կրկին փորձել»։<br><small>Файл готовится — нажмите «Повторить». · The file is being prepared — tap “Try again”.</small></p>
<a class="p" href="${retryUrl}">⬇ Կրկին փորձել · Повторить · Try again</a>
<a class="s" href="${viewUrl}">Բացել և տպել · Открыть и распечатать</a></div></body></html>`;
}
