import "server-only";

/**
 * Renders a self-contained print page (certificate, supplement, contract) to a PDF file with headless Chromium.
 * On Vercel it uses the serverless build from @sparticuz/chromium; locally it uses CHROME_PATH or the system Chrome.
 * `origin` is used as the base URL so fonts, guilloche backgrounds and the seal load from the site's public folder.
 */
export async function htmlToPdf(html: string, origin: string): Promise<Uint8Array> {
  const puppeteer = (await import("puppeteer-core")).default;
  let executablePath = process.env.CHROME_PATH;
  let args = ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"];
  if (!executablePath) {
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const chromium = (await import("@sparticuz/chromium")).default;
      executablePath = await chromium.executablePath();
      args = [...chromium.args, "--font-render-hinting=none"];
    } else {
      executablePath = "/usr/bin/google-chrome";
    }
  }
  const browser = await puppeteer.launch({ executablePath, args, headless: true });
  try {
    const page = await browser.newPage();
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
    await browser.close();
  }
}

/** ASCII-safe file name plus the UTF-8 one for browsers that support it. */
export function pdfHeaders(fileName: string): HeadersInit {
  const ascii = fileName.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/["\\/]/g, "-").replace(/\s+/g, "_") || "document.pdf";
  return {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "cache-control": "private, no-store",
    "x-robots-tag": "noindex",
  };
}
