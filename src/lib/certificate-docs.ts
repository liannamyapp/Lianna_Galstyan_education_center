/**
 * Print-ready certificate documents, built from the official forms (texts unchanged):
 * - "hy": certificate in Armenian (A4), "en": certificate in English (A4),
 * - "insert": bilingual supplement (A3 landscape, folded to A4: Armenian left, English right).
 * Fields the site does not hold (Personal ID) stay as dotted lines to fill in by hand.
 */
import type { L10n } from "@/db/schema";
import { SIGNATURE_PNG } from "@/lib/signature";

export type CertDocKind = "hy" | "en" | "insert";
export type CertData = {
  number: string;
  holderName: string;
  holderNameEn: string;
  startDate: Date;
  endDate: Date;
  issuedAt: Date;
  projectTopic: string | null;
  projectTopicEn: string | null;
  projectUrl: string | null;
  attendance: number | null;
  revoked: boolean;
  course: { code: string; title: L10n; hours: number; theoryHours: number; practiceHours: number; endorsementNo: string | null; endorsementDate: string | null };
  modules: { code: string; title: L10n; hours: number; outcomes: Partial<L10n> | null }[];
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const HY_MONTHS = ["հունվարի", "փետրվարի", "մարտի", "ապրիլի", "մայիսի", "հունիսի", "հուլիսի", "օգոստոսի", "սեպտեմբերի", "հոկտեմբերի", "նոյեմբերի", "դեկտեմբերի"];
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ymd = (d: Date) => { const x = new Date(d.getTime() + 4 * 3_600_000); return [x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()] as const; }; // Yerevan calendar day
const hyDate = (d: Date) => { const [y, m, day] = ymd(d); return `«${day}» ${HY_MONTHS[m]} ${y} թ.`; };
const enDate = (d: Date) => { const [y, m, day] = ymd(d); return `${day} ${EN_MONTHS[m]} ${y}`; };
const numDate = (d: Date) => { const [y, m, day] = ymd(d); return `${String(day).padStart(2, "0")}.${String(m + 1).padStart(2, "0")}.${y}`; };
const isoToDate = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T08:00:00Z`) : null);

const FONTS = `
@font-face{font-family:'LG Sans';font-weight:400;src:url(/fonts/sans-arm-400.woff2) format('woff2');unicode-range:U+0530-058F,U+FB13-FB17}
@font-face{font-family:'LG Sans';font-weight:400;src:url(/fonts/sans-lat-400.woff2) format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2116}
@font-face{font-family:'LG Sans';font-weight:700;src:url(/fonts/sans-arm-700.woff2) format('woff2');unicode-range:U+0530-058F,U+FB13-FB17}
@font-face{font-family:'LG Sans';font-weight:700;src:url(/fonts/sans-lat-700.woff2) format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2116}
@font-face{font-family:'LG Serif';font-weight:700;src:url(/fonts/serif-arm-700.woff2) format('woff2');unicode-range:U+0530-058F,U+FB13-FB17}
@font-face{font-family:'LG Serif';font-weight:700;src:url(/fonts/serif-lat-700.woff2) format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2116}
@font-face{font-family:'LG Serif';font-weight:500;src:url(/fonts/serif-arm-500.woff2) format('woff2');unicode-range:U+0530-058F,U+FB13-FB17}
@font-face{font-family:'LG Serif';font-weight:500;src:url(/fonts/serif-lat-500.woff2) format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2116}`;

const BASE = `
html,body{margin:0;padding:0}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
.pw{flex:none;position:relative}
.pw>.page{transform-origin:0 0}
body{font-family:'LG Sans',Arial,sans-serif;color:#1b1b1b;background:#e9e5dc;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bg{position:absolute;left:0;top:0;width:100%;height:100%}
.bar{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;padding:10px 12px;background:#0f2440;color:#fff;font:14px 'LG Sans',Arial,sans-serif}
.bar a,.bar button{font:inherit;color:#fff;text-decoration:none;border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:8px 14px;background:transparent;cursor:pointer}
.bar a.on{background:#fff;color:#0f2440}
.bar button.p{background:#c9a24b;border-color:#c9a24b;color:#0f2440;font-weight:700}
.bar .hint{width:100%;text-align:center;font-size:12px;color:#b9c4d4}
.wrap{padding:16px 8px 40px;display:flex;flex-direction:column;align-items:center;gap:16px;overflow-x:hidden}
.revoked{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:4}
.revoked div{transform:rotate(-28deg);font:700 90px 'LG Serif',serif;color:rgba(160,30,30,.28);border:8px solid rgba(160,30,30,.28);padding:6px 40px;letter-spacing:12px}
@media print{body{background:#fff}.bar{display:none}.wrap{padding:0;gap:0;display:block}.pw{width:auto!important;height:auto!important}.page{box-shadow:none!important;margin:0!important;transform:none!important}}
`;

const A4 = `
@page{size:210mm 297mm;margin:0}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.18);page-break-after:always;flex:none}
.c{position:absolute;left:26mm;right:26mm;top:30mm;bottom:28mm;text-align:center;font-size:10.6pt;line-height:1.55}
.org{font-size:8.8pt;color:#33445c;letter-spacing:.2px}
.org b{font-size:10pt;color:#17375e;letter-spacing:.6px}
.title{font-family:'LG Serif',serif;font-size:34pt;letter-spacing:9px;color:#17375e;margin:16mm 0 1mm;font-weight:700}
.rule{width:70mm;height:0;border-top:.4mm solid #b08d3c;margin:2mm auto 3mm;position:relative}
.rule:after{content:'◆';color:#b08d3c;position:absolute;left:50%;top:-3.1mm;transform:translateX(-50%);background:#fff;padding:0 2mm;font-size:9pt}
.num{font-size:12pt;letter-spacing:1px;color:#33445c;margin-bottom:9mm}
.c p{margin:3.2mm 0}
.name{font-family:'LG Serif',serif;font-weight:700;font-size:15pt;color:#17375e;border-bottom:.25mm solid #8a8a8a;display:inline-block;min-width:120mm;min-height:7mm;line-height:7mm;padding:0 2mm}
.lbl{font-size:8.2pt;color:#555}
.prog{font-family:'LG Serif',serif;font-size:15pt;color:#17375e;font-weight:700;margin:2mm 0 1mm!important}
.foot{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;align-items:flex-end;text-align:left;font-size:9.4pt}
.seal{width:30mm;height:30mm}
.sig{position:relative;border-top:.25mm solid #555;width:74mm;padding-top:1mm;font-size:8.6pt;color:#333}
.sig img.sg{position:absolute;left:16mm;bottom:100%;height:15mm;width:auto;margin-bottom:-2mm}
.note{position:absolute;left:0;right:0;bottom:-12mm;font-size:8.2pt;font-style:italic;color:#555}
.meta{font-size:9.4pt;color:#333}
.v{color:#17375e;font-weight:700}
`;

const A3 = `
@page{size:420mm 297mm;margin:0}
.page{width:420mm;height:297mm;position:relative;display:flex;overflow:hidden;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.18);flex:none}
.half{width:210mm;height:297mm;position:relative}
.fold{position:absolute;left:210mm;top:6mm;bottom:6mm;border-left:.2mm dashed #c9bfa6}
.ic{position:absolute;left:21mm;right:21mm;top:24mm;bottom:20mm;font-size:10pt;line-height:1.36}
.ih{text-align:center}
.ih .t{font-family:'LG Serif',serif;font-size:19pt;letter-spacing:3px;color:#17375e;font-weight:700}
.ih .s{font-size:10pt;color:#33445c;margin-top:.6mm}
.ih .p{font-family:'LG Serif',serif;font-size:13pt;color:#17375e;font-weight:700;margin-top:1.4mm}
.rule{width:64mm;border-top:.35mm solid #b08d3c;margin:2.4mm auto 3mm}
.f{margin:1.6mm 0}
table{width:100%;border-collapse:collapse;margin:1.6mm 0;background:rgba(255,255,255,.55)}
th,td{border:.2mm solid #9aa6b5;padding:1.4mm 1.8mm;vertical-align:top}
th{background:rgba(23,55,94,.08);color:#17375e;font-size:9.2pt;text-align:left}
td.n{text-align:center;white-space:nowrap}
td.code{white-space:nowrap;font-size:9pt}
tr.tot td{font-weight:700}
th:nth-child(1){width:7%}th:nth-child(2){width:24%}th:nth-child(3){width:6%}th:nth-child(5){width:12%}
.ic.hy{font-size:9.4pt;line-height:1.32}.ic.hy th{font-size:8.8pt}
.sig{margin-top:10mm;display:flex;justify-content:space-between;align-items:flex-end}
.sig .l{position:relative;border-top:.2mm solid #555;width:64mm;padding-top:.8mm;font-size:9pt;color:#333}
.sig .l img.sg{position:absolute;left:14mm;bottom:100%;height:12mm;width:auto;margin-bottom:-1.5mm}
.v{color:#17375e;font-weight:700}
`;

const dots = (n = 3) => "…".repeat(n);

function certificateHy(d: CertData) {
  const c = d.course; const end = isoToDate(c.endorsementDate);
  return `<section class="page"><img class="bg" src="/cert/bg-a4.svg" alt="">
<div class="c"><div class="org"><b>ԱՆՀԱՏ ՁԵՌՆԱՐԿԱՏԵՐ ԳԱԼՍՏՅԱՆ ԼԻԱՆՆԱ ԱՐՍԵՆԻ</b><br>ՀՎՀՀ 58229843 · ք. Երևան</div>
<div class="title">ՎԿԱՅԱԿԱՆ</div><div class="rule"></div>
<div class="num">№ <span class="v">${esc(d.number)}</span></div>
<p>Տրվում է</p><div class="name">${esc(d.holderName)}</div><div class="lbl">(անուն, ազգանուն, հայրանուն) · ՀԾՀ՝ ……………………………</div>
<p>այն մասին, որ նա <span class="v">${hyDate(d.startDate)}</span>-ից <span class="v">${hyDate(d.endDate)}</span><br>մասնակցել և հաջողությամբ ավարտել է</p>
<p class="prog">«${esc(c.title.hy)}»</p>
<p>(որակիչ՝ <b>${esc(c.code)}</b>) լրացուցիչ (ոչ ֆորմալ) կրթական մոդուլային ծրագիրը՝<br><b>${c.hours} ակադեմիական ժամ</b> ծավալով (տեսական՝ ${c.theoryHours}, գործնական՝ ${c.practiceHours}),<br>և ձեռք է բերել ներդիրում նշված ուսումնառության արդյունքները։</p>
<p class="meta">Ծրագիրը երաշխավորված է ՀՀ կրթության, գիտության, մշակույթի և սպորտի<br>նախարարի ${end ? hyDate(end) : "«……» …………… 20…… թ."} № ${c.endorsementNo ? esc(c.endorsementNo) : "………"} հրամանով։</p>
<p class="meta">Գրանցման համար՝ <span class="v">${esc(d.number)}</span><br>Տրման ամսաթիվ՝ <span class="v">${hyDate(d.issuedAt)}</span> · ք. Երևան</p>
<div class="foot"><div><img class="seal" src="/cert/seal.png" alt="ALTA Academy"></div><div class="sig"><img class="sg" src="${SIGNATURE_PNG}" alt="">Դասավանդող, անհատ ձեռնարկատեր<br><b>Լ. Ա. Գալստյան</b></div></div>
<div class="note">Վկայականն առանց ներդիրի անվավեր է։</div></div></section>`;
}

function certificateEn(d: CertData) {
  const c = d.course; const end = isoToDate(c.endorsementDate);
  return `<section class="page"><img class="bg" src="/cert/bg-a4.svg" alt="">
<div class="c"><div class="org"><b>INDIVIDUAL ENTREPRENEUR LIANNA GALSTYAN</b><br>Tax ID 58229843</div>
<div class="title">CERTIFICATE</div><div class="rule"></div>
<div class="num">No. <span class="v">${esc(d.number)}</span></div>
<p>This is to certify that</p><div class="name">${esc(d.holderNameEn)}</div><div class="lbl">(full name) · Personal ID No. ……………………………</div>
<p>has successfully completed,<br>from <span class="v">${enDate(d.startDate)}</span> to <span class="v">${enDate(d.endDate)}</span>, the</p>
<p class="prog">“${esc(c.title.en || c.title.hy)}”</p>
<p>(code <b>${esc(c.code)}</b>) supplementary (non-formal) modular education program<br>of <b>${c.hours} academic hours</b> (theory ${c.theoryHours}, practice ${c.practiceHours}),<br>and has achieved the learning outcomes listed in the supplement.</p>
<p class="meta">The program is endorsed by Order No. ${c.endorsementNo ? esc(c.endorsementNo) : "………"} of ${end ? enDate(end) : "…………………… 20……"}<br>of the Minister of Education, Science, Culture and Sport of the Republic of Armenia.</p>
<p class="meta">Registration No. <span class="v">${esc(d.number)}</span><br>Date of issue: <span class="v">${enDate(d.issuedAt)}</span> · Yerevan</p>
<div class="foot"><div><img class="seal" src="/cert/seal.png" alt="ALTA Academy"></div><div class="sig"><img class="sg" src="${SIGNATURE_PNG}" alt="">Instructor, Individual Entrepreneur<br><b>L. A. Galstyan</b></div></div>
<div class="note">This certificate is not valid without the supplement.</div></div></section>`;
}

function insertHalf(d: CertData, lang: "hy" | "en") {
  const c = d.course; const hy = lang === "hy";
  const L = hy
    ? { t: "ՆԵՐԴԻՐ", s: `№ <span class="v">${esc(d.number)}</span> վկայականի`, p: `«${esc(c.title.hy)}» (${esc(c.code)})`, learner: "Ունկնդիր", pid: "ՀԾՀ", period: "Ուսուցման ժամկետը", cols: ["Մոդուլ", "Անվանում", "Ժամ", "Ձեռք բերված ուսումնառության արդյունքներ", "Արդյունք"], res: "յուրացված", tot: "Ընդամենը", topic: "Ավարտական նախագծի թեման", link: "Նախագծի հղումը", att: "Հաճախումը", min: "(նվազ.՝ 80 %)", sig: "Դասավանդող՝ Լ. Ա. Գալստյան<br>(ստորագրություն)", date: "Տրման ամսաթիվ" }
    : { t: "SUPPLEMENT", s: `to Certificate No. <span class="v">${esc(d.number)}</span>`, p: `“${esc(c.title.en || c.title.hy)}” (${esc(c.code)})`, learner: "Learner", pid: "Personal ID", period: "Period of study", cols: ["Module", "Title", "Hours", "Learning outcomes achieved", "Result"], res: "achieved", tot: "Total", topic: "Final project", link: "Project link", att: "Attendance", min: "(min. 80 %)", sig: "Instructor: L. A. Galstyan<br>(signature)", date: "Date of issue" };
  const name = hy ? d.holderName : d.holderNameEn;
  const rows = d.modules.map((m, i) => {
    const code = hy ? (m.code || `Մ${i + 1}`) : (m.code || "").replace(/^Մ/, "M") || `M${i + 1}`;
    const out = m.outcomes?.[lang] ?? "";
    return `<tr><td class="code">${esc(code)}</td><td>${esc(m.title[lang] || m.title.hy)}</td><td class="n">${m.hours}</td><td>${esc(out)}</td><td>${L.res}</td></tr>`;
  }).join("");
  const total = d.modules.reduce((a, m) => a + m.hours, 0) || c.hours;
  return `<div class="half"><img class="bg" src="/cert/bg-half.svg" alt="">
<div class="ic ${lang}"><div class="ih"><div class="t">${L.t}</div><div class="s">${L.s}</div><div class="p">${L.p}</div><div class="rule"></div></div>
<div class="f">${L.learner}՝ <span class="v">${esc(name)}</span> · ${L.pid}՝ ……………………</div>
<div class="f">${L.period}՝ <span class="v">${numDate(d.startDate)} – ${numDate(d.endDate)}</span></div>
<table><tr>${L.cols.map((x) => `<th>${x}</th>`).join("")}</tr>${rows}<tr class="tot"><td></td><td>${L.tot}</td><td class="n">${total}</td><td></td><td></td></tr></table>
<div class="f">${L.topic}՝ ${(hy ? d.projectTopic : d.projectTopicEn || d.projectTopic) ? `<span class="v">${esc((hy ? d.projectTopic : d.projectTopicEn || d.projectTopic)!)}</span>` : dots(30)}</div>
<div class="f">${L.link}՝ ${d.projectUrl ? `<span class="v">${esc(d.projectUrl)}</span>` : dots(20)} · ${L.att}՝ ${d.attendance != null ? `<span class="v">${d.attendance} %</span>` : `${dots(3)} %`} ${L.min}</div>
<div class="sig"><div class="l"><img class="sg" src="${SIGNATURE_PNG}" alt="">${L.sig}</div><div class="l" style="width:44mm"><span class="v">${numDate(d.issuedAt)}</span><br>${L.date}</div></div></div></div>`.replace(/՝/g, hy ? "՝" : ":");
}

const TITLES: Record<CertDocKind, string> = { hy: "Վկայական", en: "Certificate", insert: "Ներդիր / Supplement" };

/** A complete standalone HTML page for one document, with a toolbar (hidden when printing). */
export function certificatePage(d: CertData, kind: CertDocKind, links: Record<CertDocKind, string>, back: string) {
  const body = kind === "insert" ? `<section class="page">${insertHalf(d, "hy")}${insertHalf(d, "en")}<div class="fold"></div></section>` : kind === "hy" ? certificateHy(d) : certificateEn(d);
  const hint = kind === "insert"
    ? "Տպեք A3 թղթի վրա, հորիզոնական (կամ պահպանեք PDF), և ծալեք կետագծով։ · Print on A3 landscape and fold on the dashed line."
    : "Տպեք A4 թղթի վրա՝ առանց լուսանցքների, կամ պահպանեք որպես PDF։ · Print on A4 without margins or save as PDF.";
  const tab = (k: CertDocKind, label: string) => `<a href="${links[k]}" class="${k === kind ? "on" : ""}">${label}</a>`;
  return `<!DOCTYPE html><html lang="${kind === "en" ? "en" : "hy"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${TITLES[kind]} № ${esc(d.number)} · ALTA Academy</title><style>${FONTS}${BASE}${kind === "insert" ? A3 : A4}</style></head><body>
<div class="bar"><a href="${back}">←</a>${tab("hy", "Վկայական (հայ.)")}${tab("en", "Certificate (Eng.)")}${tab("insert", "Ներդիր / Supplement")}<button class="p" onclick="window.print()">Տպել / PDF</button><div class="hint">${hint}</div></div>
${d.revoked ? '<div class="revoked"><div>ՉԵՂԱՐԿՎԱԾ</div></div>' : ""}
<div class="wrap">${body.replace(/<section class="page">/g, '<div class="pw"><section class="page">').replace(/<\/section>/g, "</section></div>")}</div>
<script>(function(){function fit(){document.querySelectorAll('.pw').forEach(function(w){var p=w.firstElementChild,pw=p.offsetWidth,ph=p.offsetHeight,s=Math.min(1,(document.documentElement.clientWidth-16)/pw);p.style.transform=s<1?'scale('+s+')':'';w.style.width=(pw*s)+'px';w.style.height=(ph*s)+'px';});}fit();addEventListener('resize',fit);addEventListener('orientationchange',function(){setTimeout(fit,300)});if(document.fonts)document.fonts.ready.then(fit);})();</script></body></html>`;
}
