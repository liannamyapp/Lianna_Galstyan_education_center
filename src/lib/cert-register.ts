import "server-only";
import { and, asc, eq, gte, lt, type SQL } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db, s } from "@/db";
import { tr } from "@/lib/i18n";
import { dateShort } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { esc } from "@/lib/escape";

export type RegisterFilter = { year?: number | null; courseId?: string | null };
export type RegisterRow = {
  n: number; number: string; holder: string; course: string; hours: number; endorsement: string;
  start: Date; end: Date; project: string; attendance: number | null; issued: Date; revoked: boolean;
};

/** Issued certificates in register order (by date of issue, then number). Revoked ones stay in the register, marked. */
export async function loadRegister(f: RegisterFilter): Promise<RegisterRow[]> {
  const conds: SQL[] = [];
  if (f.year) conds.push(gte(s.certificates.issuedAt, new Date(`${f.year}-01-01T00:00:00+04:00`)), lt(s.certificates.issuedAt, new Date(`${f.year + 1}-01-01T00:00:00+04:00`)));
  if (f.courseId) conds.push(eq(s.certificates.courseId, f.courseId));
  const rows = await db.query.certificates.findMany({
    where: conds.length ? and(...conds) : undefined,
    orderBy: [asc(s.certificates.issuedAt), asc(s.certificates.number)],
    with: { course: true },
  });
  return rows.map((c, i) => ({
    n: i + 1, number: c.number, holder: c.holderName,
    course: `${c.course.code} · ${tr(c.course.title, "hy")}`, hours: c.course.hours,
    endorsement: c.course.endorsementNo ? `№ ${c.course.endorsementNo}${c.course.endorsementDate ? `, ${dateShort(c.course.endorsementDate)}` : ""}` : "",
    start: c.startDate, end: c.endDate, project: c.projectTopic ?? "", attendance: c.attendance,
    issued: c.issuedAt, revoked: c.revoked,
  }));
}

const COLS = [
  "հ/հ", "Վկայականի համար", "Անուն, ազգանուն, հայրանուն", "Կրթական ծրագիր", "Ժամեր", "Երաշխավորման հրաման",
  "Ուսուցման սկիզբ", "Ուսուցման ավարտ", "Ավարտական նախագիծ", "Հաճախում, %", "Տրման ամսաթիվ", "Կարգավիճակ", "Ստացողի ստորագրություն",
];
/** Excel keeps dates without a time zone: pass the Yerevan calendar day as a UTC midnight, or it shows the day before. */
const excelDay = (d: Date) => {
  const [y, m, dd] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Yerevan", year: "numeric", month: "2-digit", day: "2-digit" }).format(d).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
};
const status = (r: RegisterRow) => (r.revoked ? "Չեղարկված" : "Գործող");

export async function registerMeta(f: RegisterFilter, courseLabel?: string) {
  const st = await getSettings();
  const period = [f.year ? `${f.year} թ.` : "Բոլոր տարիները", courseLabel].filter(Boolean).join(" · ");
  return { entity: tr(st.legal.entity, "hy"), tin: st.legal.tin, address: tr(st.legal.address, "hy"), period, generated: dateShort(new Date()) };
}
type Meta = Awaited<ReturnType<typeof registerMeta>>;

export async function registerXlsx(rows: RegisterRow[], m: Meta): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = m.entity;
  const ws = wb.addWorksheet("Մատյան", { pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } } });
  ws.mergeCells(1, 1, 1, COLS.length);
  ws.getCell(1, 1).value = "Տրված վկայականների հաշվառման մատյան";
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.mergeCells(2, 1, 2, COLS.length);
  ws.getCell(2, 1).value = `${m.entity} · ՀՎՀՀ ${m.tin} · ${m.address}`;
  ws.mergeCells(3, 1, 3, COLS.length);
  ws.getCell(3, 1).value = `${m.period} · Ձևավորված՝ ${m.generated} · Ընդամենը՝ ${rows.length}`;
  ws.getCell(3, 1).font = { color: { argb: "FF555B69" } };
  const head = ws.getRow(5);
  head.values = COLS;
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  head.height = 34;
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2440" } }; });
  for (const r of rows) {
    const row = ws.addRow([r.n, r.number, r.holder, r.course, r.hours, r.endorsement, excelDay(r.start), excelDay(r.end), r.project, r.attendance ?? "", excelDay(r.issued), status(r), ""]);
    row.alignment = { vertical: "top", wrapText: true };
    for (const i of [7, 8, 11]) row.getCell(i).numFmt = "dd.mm.yyyy";
    if (r.revoked) row.font = { color: { argb: "FF8A2F1D" }, strike: false };
  }
  [6, 18, 30, 34, 10, 20, 13, 13, 30, 11, 13, 12, 18].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  const last = ws.rowCount;
  for (let r = 5; r <= last; r++) for (let c = 1; c <= COLS.length; c++) {
    ws.getCell(r, c).border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  }
  ws.views = [{ state: "frozen", ySplit: 5 }];
  ws.headerFooter.oddFooter = "&L" + m.entity + "&RԷջ &P / &N";
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Print-ready register: A4 landscape, header repeated on every page, signature column left blank for paper use. */
export function registerHtml(rows: RegisterRow[], m: Meta, toolbar?: { xlsx: string; pdf: string; back: string }) {
  const body = rows.map((r) => `<tr${r.revoked ? ' class="rev"' : ""}>
<td class="c">${r.n}</td><td class="mono">${esc(r.number)}</td><td>${esc(r.holder)}</td><td>${esc(r.course)}</td><td class="c">${r.hours}</td><td>${esc(r.endorsement)}</td>
<td class="c">${dateShort(r.start)}</td><td class="c">${dateShort(r.end)}</td><td>${esc(r.project)}</td><td class="c">${r.attendance ?? ""}</td><td class="c">${dateShort(r.issued)}</td><td class="c">${status(r)}</td><td></td></tr>`).join("");
  return `<!doctype html><html lang="hy"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Վկայականների հաշվառման մատյան</title>
<style>
@font-face{font-family:Sans;src:url(/fonts/sans-lat-400.woff2) format("woff2");font-weight:400;unicode-range:U+0000-024F,U+2000-206F,U+20AC,U+2116}
@font-face{font-family:Sans;src:url(/fonts/sans-lat-600.woff2) format("woff2");font-weight:600;unicode-range:U+0000-024F,U+2000-206F,U+20AC,U+2116}
@font-face{font-family:Sans;src:url(/fonts/sans-arm-400.woff2) format("woff2");font-weight:400;unicode-range:U+0530-058F,U+FB13-FB17}
@font-face{font-family:Sans;src:url(/fonts/sans-arm-600.woff2) format("woff2");font-weight:600;unicode-range:U+0530-058F,U+FB13-FB17}
@page{size:A4 landscape;margin:12mm 10mm}
*{box-sizing:border-box}body{margin:0;font-family:Sans,"Noto Sans Armenian",Arial,sans-serif;color:#1c2433;font-size:10.5px}
.wrap{padding:16px}h1{font-size:17px;margin:0 0 4px;color:#0f2440}.meta{margin:0 0 2px;color:#3d4757}.muted{color:#5b6170}
table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #9aa3b2;padding:5px 4px;vertical-align:top;overflow-wrap:anywhere}
th{background:#0f2440;color:#fff;font-weight:600;font-size:8.5px;line-height:1.25;overflow-wrap:normal;word-break:normal;hyphens:manual}table{table-layout:fixed}thead{display:table-header-group}tr{break-inside:avoid}
.c{text-align:center;white-space:nowrap}.mono{font-family:ui-monospace,Menlo,monospace;white-space:nowrap}.rev td{color:#8a2f1d}
.sign{display:flex;justify-content:space-between;margin-top:28px;font-size:11px}
.bar{position:sticky;top:0;display:flex;flex-wrap:wrap;gap:8px;padding:10px 16px;background:#0f2440}
.bar a{background:#c9a24b;color:#0a1a2f;text-decoration:none;font-weight:600;padding:9px 14px;border-radius:999px;font-size:13px}
.bar a.ghost{background:transparent;color:#fff;border:1px solid #ffffff55}
@media screen{.scroll{overflow-x:auto}table{min-width:1100px}}
@media print{.bar{display:none}.wrap{padding:0}}
</style></head><body>
${toolbar ? `<div class="bar"><a class="ghost" href="${toolbar.back}">← Վկայականներ</a><a href="${toolbar.xlsx}">⬇ Excel</a><a href="${toolbar.pdf}">⬇ PDF</a><a href="#" onclick="window.print();return false">🖨 Տպել</a></div>` : ""}
<div class="wrap">
<h1>Տրված վկայականների հաշվառման մատյան</h1>
<p class="meta">${esc(m.entity)} · ՀՎՀՀ ${esc(m.tin)} · ${esc(m.address)}</p>
<p class="meta muted">${esc(m.period)} · Ձևավորված՝ ${m.generated} · Ընդամենը՝ ${rows.length}</p>
<div class="scroll"><table><colgroup>${[3, 10, 11, 12, 4, 9, 7, 7, 9, 5, 7, 7, 9].map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr>${COLS.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${body || `<tr><td colspan="${COLS.length}" class="c muted">Վկայականներ չկան</td></tr>`}</tbody></table></div>
<div class="sign"><span>Պատասխանատու՝ ____________________</span><span>Ստորագրություն՝ ____________________</span></div>
</div></body></html>`;
}
