import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { OfficeRecord } from "@/types/barometer";
import type { Language } from "@/i18n/translations";
import { t } from "@/i18n/translations";
import {
  getComputed, calcBenchmark, calcWeightedRanking,
  formatCurrency, satisfactionScore, recommendScore, alignmentScore,
  calcFrequency, getOfficeSize, getOfficeSizeLabel, filterByYear, filterBySourceLang,
  filterBySize, normalizeCompanyName
} from "@/utils/benchmarkCalc";
import type { OfficeSize } from "@/utils/benchmarkCalc";
import { calcFrequencyTranslated, GROWTH_PHASE_MAP, PRIORITIES_MAP } from "@/utils/termMappings";

const PRIMARY = [45, 74, 108] as const;         // navy
const PRIMARY_LIGHT = [232, 237, 242] as const;  // navy-tint
const DARK = [22, 32, 41] as const;              // ink
const GREY = [138, 139, 137] as const;           // grey
const WHITE = [255, 255, 255] as const;
const GOLD = [215, 173, 123] as const;           // gold
const GOLD_DARK = [196, 154, 99] as const;
const CREME = [240, 226, 210] as const;
const OFFWHITE = [250, 250, 247] as const;
const BORDER_SOFT = [236, 231, 223] as const;
const GREEN = [79, 138, 110] as const;
const RED = [184, 85, 68] as const;

type DocWithLastAutoTable = jsPDF & { lastAutoTable?: { finalY?: number } };

function lastAutoTableFinalY(doc: jsPDF, fallbackY: number): number {
  return (doc as DocWithLastAutoTable).lastAutoTable?.finalY ?? fallbackY;
}

function fmtCur(v: number | null): string {
  if (v === null) return "—";
  return "\u20AC" + Math.round(v).toLocaleString("de-DE");
}

function drawSpacedText(doc: jsPDF, text: string, x: number, y: number, spacing: number, align: "left" | "right" = "left") {
  // Draw uppercase letters with manual letter-spacing
  const chars = text.split("");
  const widths = chars.map((c) => doc.getTextWidth(c));
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let cx = align === "right" ? x - total : x;
  for (let i = 0; i < chars.length; i++) {
    doc.text(chars[i], cx, y);
    cx += widths[i] + spacing;
  }
}

function addHeader(doc: jsPDF, year: number, lang: Language) {
  const w = doc.internal.pageSize.getWidth();
  // Wordmark left
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PRIMARY);
  drawSpacedText(doc, "AQUILAE", 15, 14, 0.8);
  // Context right
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  const ctx = `${lang === "fr" ? "Baromètre" : "Barometer"} · ${year}`;
  doc.text(ctx, w - 15, 14, { align: "right" });
  // Hairline
  doc.setDrawColor(...BORDER_SOFT);
  doc.setLineWidth(0.5);
  doc.line(15, 18, w - 15, 18);
}

function addFooter(doc: jsPDF, _year: number, pageNum: number, totalPages: number, lang: Language) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.setFont("helvetica", "normal");
  const confidential = lang === "fr"
    ? "Confidentiel — usage interne uniquement"
    : "Vertrouwelijk — uitsluitend voor intern gebruik";
  doc.text(confidential, 15, h - 8);
  doc.text(`${pageNum} / ${totalPages}`, w - 15, h - 8, { align: "right" });
  // 4pt gold bar at very bottom
  doc.setFillColor(...GOLD);
  doc.rect(0, h - 4, w, 4, "F");
}

function sectionTitle(doc: jsPDF, title: string, y: number, kicker?: string): number {
  const kickerText = (kicker ?? title).toUpperCase();
  // Kicker
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...PRIMARY);
  drawSpacedText(doc, kickerText, 15, y, 0.5);
  // Title in ink
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text(title, 15, y + 6);
  // Gold accent line 36 x 2 pt
  doc.setFillColor(...GOLD);
  doc.rect(15, y + 8.5, 36 / 2.83465, 2 / 2.83465, "F"); // 36pt ~ 12.7mm, 2pt ~ 0.7mm
  return y + 14;
}

function drawCoverPage(doc: jsPDF, opts: {
  year: number;
  lang: Language;
  kicker: string;     // small navy uppercase kicker on lower half
  title: string;      // large ink title on lower half
  introLines?: string[]; // 1-3 short lines shown in off-white card
}) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const lang = opts.lang;

  // Navy block (top ~50%)
  const blockH = h * 0.5;
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, w, blockH, "F");
  // Gold rectangle top-right (~120 x 80 pt = 42.3 x 28.2 mm)
  const goldW = 120 / 2.83465;
  const goldH = 80 / 2.83465;
  doc.setFillColor(...GOLD);
  doc.rect(w - goldW, 0, goldW, goldH, "F");

  // White wordmark top-left
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...WHITE);
  drawSpacedText(doc, "AQUILAE", 20, 30, 2.2);
  // Short white line
  doc.setDrawColor(...WHITE);
  doc.setLineWidth(0.6);
  doc.line(20, 36, 60, 36);
  // Tagline
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  const tagline = lang === "fr" ? "BAROMÈTRE ANNUEL" : "JAARLIJKSE BAROMETER";
  drawSpacedText(doc, tagline, 20, 42, 1.0);

  // Big white year (bottom-left of navy block)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(72);
  doc.setTextColor(...WHITE);
  doc.text(String(opts.year), 20, blockH - 14);

  // Lower half (white): kicker + title
  let y = blockH + 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PRIMARY);
  drawSpacedText(doc, opts.kicker.toUpperCase(), 20, y, 1.0);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...DARK);
  const titleLines = doc.splitTextToSize(opts.title, w - 40);
  doc.text(titleLines, 20, y);
  y += titleLines.length * 10 + 6;

  // Off-white card with gold left edge
  if (opts.introLines && opts.introLines.length > 0) {
    const cardX = 20;
    const cardW = w - 40;
    const lineH = 5.2;
    const cardH = opts.introLines.length * lineH + 10;
    doc.setFillColor(...OFFWHITE);
    doc.rect(cardX, y, cardW, cardH, "F");
    doc.setFillColor(...GOLD);
    doc.rect(cardX, y, 0.7, cardH, "F"); // ~2pt
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    let ly = y + 7;
    for (const line of opts.introLines) {
      doc.text(line, cardX + 6, ly);
      ly += lineH;
    }
    y += cardH + 8;
  }

  // Meta line near bottom (above the gold bar)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  const dateStr = new Date().toLocaleDateString(lang === "fr" ? "fr-BE" : "nl-BE");
  const meta = lang === "fr"
    ? `Généré le ${dateStr} — Confidentiel, usage interne uniquement`
    : `Gegenereerd op ${dateStr} — Vertrouwelijk, uitsluitend voor intern gebruik`;
  doc.text(meta, 20, h - 12);

  // 4pt gold bar at very bottom
  doc.setFillColor(...GOLD);
  doc.rect(0, h - 4, w, 4, "F");
}

function labelValue(doc: jsPDF, label: string, value: string, x: number, y: number): number {
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.setFont("helvetica", "normal");
  doc.text(label, x, y);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.text(value, x + 65, y);
  return y + 6;
}

type AnalysisInsight = { text: string; type: "positive" | "neutral" | "negative" };

function generateAnalysisInsights(
  office: OfficeRecord,
  allData: OfficeRecord[],
  computed: ReturnType<typeof getComputed>,
  lang: Language
): AnalysisInsight[] {
  const nl = lang === "nl";
  const items: AnalysisInsight[] = [];

  const tc = computed.total_commission;
  const tcBm = calcBenchmark(allData.map(r => getComputed(r).total_commission), tc);
  if (tc !== null && tcBm.mean !== null && tcBm.percentile !== null) {
    const diff = ((tc - tcBm.mean) / tcBm.mean) * 100;
    const abs = Math.abs(Math.round(diff));
    if (diff > 10) items.push({ type: "positive", text: nl ? `De totale commissie ligt ${abs}% boven het groepsgemiddelde (P${tcBm.percentile}).` : `La commission totale est ${abs}% au-dessus de la moyenne du groupe (P${tcBm.percentile}).` });
    else if (diff < -10) items.push({ type: "negative", text: nl ? `De totale commissie ligt ${abs}% onder het groepsgemiddelde (P${tcBm.percentile}).` : `La commission totale est ${abs}% en dessous de la moyenne du groupe (P${tcBm.percentile}).` });
    else items.push({ type: "neutral", text: nl ? `De totale commissie ligt in lijn met het groepsgemiddelde (P${tcBm.percentile}).` : `La commission totale est en ligne avec la moyenne du groupe (P${tcBm.percentile}).` });
  }

  const cfte = computed.commission_per_fte;
  const cfteBm = calcBenchmark(allData.map(r => getComputed(r).commission_per_fte), cfte);
  if (cfte !== null && cfteBm.mean !== null && cfteBm.percentile !== null) {
    const diff = ((cfte - cfteBm.mean) / cfteBm.mean) * 100;
    const abs = Math.abs(Math.round(diff));
    if (diff > 15) items.push({ type: "positive", text: nl ? `Hoge effici\u00ebntie: commissie per FTE is ${abs}% hoger dan gemiddeld (P${cfteBm.percentile}).` : `Haute efficacit\u00e9 : commission par ETP ${abs}% sup\u00e9rieure \u00e0 la moyenne (P${cfteBm.percentile}).` });
    else if (diff < -15) items.push({ type: "negative", text: nl ? `De effici\u00ebntie (commissie/FTE) ligt ${abs}% onder het groepsgemiddelde (P${cfteBm.percentile}).` : `L'efficacit\u00e9 (commission/ETP) est ${abs}% inf\u00e9rieure \u00e0 la moyenne (P${cfteBm.percentile}).` });
  }

  const totalFte = computed.total_fte;
  const fteVals = allData.map(r => getComputed(r).total_fte).filter((v): v is number => v !== null);
  const avgFte = fteVals.length ? fteVals.reduce((a, b) => a + b, 0) / fteVals.length : null;
  if (totalFte !== null && avgFte !== null) {
    const ratio = totalFte / avgFte;
    if (ratio > 1.5) items.push({ type: "neutral", text: nl ? `Groter kantoor: ${totalFte.toFixed(1)} FTE vs. groepsgemiddelde ${avgFte.toFixed(1)} FTE.` : `Bureau plus grand : ${totalFte.toFixed(1)} ETP vs. moyenne groupe ${avgFte.toFixed(1)} ETP.` });
    else if (ratio < 0.6) items.push({ type: "neutral", text: nl ? `Kleiner kantoor: ${totalFte.toFixed(1)} FTE vs. groepsgemiddelde ${avgFte.toFixed(1)} FTE.` : `Bureau plus petit : ${totalFte.toFixed(1)} ETP vs. moyenne groupe ${avgFte.toFixed(1)} ETP.` });
  }

  if (office.pct_private !== null && office.pct_sme !== null) {
    const priVals = allData.map(r => r.pct_private).filter((v): v is number => v !== null);
    const avgPri = priVals.length ? priVals.reduce((a, b) => a + b, 0) / priVals.length : null;
    if (avgPri !== null) {
      const diff = office.pct_private - avgPri;
      if (diff > 15) items.push({ type: "neutral", text: nl ? `Sterkere focus op particulieren (${office.pct_private}% vs. gem. ${Math.round(avgPri)}%).` : `Orientation plus marqu\u00e9e vers les particuliers (${office.pct_private}% vs. moy. ${Math.round(avgPri)}%).` });
      else if (diff < -15) items.push({ type: "neutral", text: nl ? `Sterkere focus op KMO (${office.pct_sme}% vs. gem. ${Math.round(100 - avgPri)}%).` : `Orientation plus marqu\u00e9e vers les PME (${office.pct_sme}% vs. moy. ${Math.round(100 - avgPri)}%).` });
    }
  }

  if (office.commission_insurance !== null && office.commission_bank !== null && tc !== null && tc > 0) {
    const bankPct = (office.commission_bank / tc) * 100;
    const groupBankPcts = allData.map(r => { const c = getComputed(r); return c.total_commission && c.total_commission > 0 && r.commission_bank !== null ? (r.commission_bank / c.total_commission) * 100 : null; }).filter((v): v is number => v !== null);
    const avgBankPct = groupBankPcts.length ? groupBankPcts.reduce((a, b) => a + b, 0) / groupBankPcts.length : null;
    if (avgBankPct !== null && bankPct > avgBankPct + 10) items.push({ type: "neutral", text: nl ? `Hoger aandeel bankcommissie (${Math.round(bankPct)}% vs. gem. ${Math.round(avgBankPct)}%).` : `Part plus \u00e9lev\u00e9e de commission bancaire (${Math.round(bankPct)}% vs. moy. ${Math.round(avgBankPct)}%).` });
  }

  const satVal = satisfactionScore(office.satisfaction_aquilae);
  const groupSat = allData.map(r => satisfactionScore(r.satisfaction_aquilae)).filter((v): v is number => v !== null);
  const avgSatVal = groupSat.length ? groupSat.reduce((a, b) => a + b, 0) / groupSat.length : null;
  if (satVal !== null && avgSatVal !== null) {
    if (satVal >= 3) items.push({ type: "positive", text: nl ? `Zeer tevreden over Aquilae (score ${satVal}/3, gem. ${avgSatVal.toFixed(1)}/3).` : `Tr\u00e8s satisfait d'Aquilae (score ${satVal}/3, moy. ${avgSatVal.toFixed(1)}/3).` });
    else if (satVal < avgSatVal - 0.3) items.push({ type: "negative", text: nl ? `Tevredenheid lager dan gemiddeld (score ${satVal}/3, gem. ${avgSatVal.toFixed(1)}/3).` : `Satisfaction inf\u00e9rieure \u00e0 la moyenne (score ${satVal}/3, moy. ${avgSatVal.toFixed(1)}/3).` });
  }

  return items;
}

export function generateOfficePDF(
  office: OfficeRecord,
  allData: OfficeRecord[],
  lang: Language,
  allYearsData?: OfficeRecord[],
  displayNameFn?: (name: string) => string
): jsPDF {
  // Use the office's own language for the PDF content
  const officeLang: Language = (office.source_language === "fr" ? "fr" : "nl");
  lang = officeLang;
  const dn = displayNameFn || ((n: string) => n);
  const officeName = dn(office.office_name);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const computed = getComputed(office);
  const year = office.survey_year;
  const totalPages = 7;

  // ===== PAGE 1 — Cover =====
  const sizeForCover = getOfficeSize(office);
  const sizeLabelCover = sizeForCover ? getOfficeSizeLabel(sizeForCover, lang) : "";
  const introLines: string[] = [];
  if (sizeLabelCover) introLines.push(`${lang === "fr" ? "Taille" : "Grootte"}: ${sizeLabelCover}`);
  if (office.activities.length) introLines.push(`${lang === "fr" ? "Activités" : "Activiteiten"}: ${office.activities.join(", ")}`);
  if (computed.total_commission !== null) introLines.push(`${lang === "fr" ? "Commission totale" : "Totale commissie"}: ${fmtCur(computed.total_commission)}`);
  drawCoverPage(doc, {
    year,
    lang,
    kicker: lang === "fr" ? "Rapport de bureau" : "Kantoorrapport",
    title: officeName,
    introLines,
  });

  // ===== PAGE 2 — Office Profile =====
  doc.addPage();
  addHeader(doc, year, lang);
  let y = 28;

  doc.setFontSize(20);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.text(officeName, 15, y);
  y += 10;

  // Badge line
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const officeSize = getOfficeSize(office);
  const badges = [
    office.source_language.toUpperCase(),
    String(year),
    ...(officeSize ? [getOfficeSizeLabel(officeSize, lang)] : []),
    ...office.activities,
  ];
  let bx = 15;
  for (const badge of badges) {
    const tw = doc.getTextWidth(badge) + 6;
    doc.setFillColor(...PRIMARY_LIGHT);
    doc.roundedRect(bx, y - 3, tw, 5, 1.5, 1.5, "F");
    doc.setTextColor(...PRIMARY);
    doc.text(badge, bx + 3, y);
    bx += tw + 3;
  }
  y += 14;

  y = sectionTitle(doc, t("field.growth_phase", lang), y);
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "normal");
  for (const gp of office.growth_phase) {
    const lines = doc.splitTextToSize(gp, w - 30);
    doc.text(lines, 15, y);
    y += lines.length * 4.5 + 2;
  }
  y += 6;

  y = sectionTitle(doc, t("office.personnel", lang), y);
  {
    const calcAvg = (records: OfficeRecord[], getter: (r: OfficeRecord) => number | null) => {
      const v = records.map(getter).filter((x): x is number => x !== null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const officeSize = getOfficeSize(office);
    const sizeData = officeSize ? filterBySize(allData, officeSize) : null;

    const avgManagers = calcAvg(allData, r => r.num_managers);
    const avgEmployees = calcAvg(allData, r => r.num_employees_fte);
    const avgFte = calcAvg(allData, r => getComputed(r).total_fte);
    const avgCommPerFte = calcAvg(allData, r => getComputed(r).commission_per_fte);

    const sizeAvgManagers = sizeData ? calcAvg(sizeData, r => r.num_managers) : null;
    const sizeAvgEmployees = sizeData ? calcAvg(sizeData, r => r.num_employees_fte) : null;
    const sizeAvgFte = sizeData ? calcAvg(sizeData, r => getComputed(r).total_fte) : null;
    const sizeAvgCommPerFte = sizeData ? calcAvg(sizeData, r => getComputed(r).commission_per_fte) : null;

    const persRows = [
      { label: t("field.managers", lang), value: office.num_managers, groupAvg: avgManagers, sizeAvg: sizeAvgManagers, fmt: (v: number | null) => v !== null ? v.toFixed(2) : "—" },
      { label: t("field.employees", lang), value: office.num_employees_fte, groupAvg: avgEmployees, sizeAvg: sizeAvgEmployees, fmt: (v: number | null) => v !== null ? v.toFixed(2) : "—" },
      { label: "Total FTE", value: computed.total_fte, groupAvg: avgFte, sizeAvg: sizeAvgFte, fmt: (v: number | null) => v !== null ? v.toFixed(2) : "—" },
      { label: t("field.commission_per_fte", lang), value: computed.commission_per_fte, groupAvg: avgCommPerFte, sizeAvg: sizeAvgCommPerFte, fmt: (v: number | null) => fmtCur(v) },
    ];

    const officeLabel = lang === "nl" ? "Kantoor" : "Bureau";
    const groupLabel = lang === "nl" ? "Groep" : "Groupe";
    const sizeLabel = officeSize ? getOfficeSizeLabel(officeSize, lang) : "";
    const diffGroupLabel = lang === "nl" ? "Δ groep" : "Δ groupe";
    const diffSizeLabel = lang === "nl" ? "Δ grootte" : "Δ taille";
    const hasSizeCol = sizeData !== null && officeSize !== null;

    const head = hasSizeCol
      ? [["", officeLabel, groupLabel, diffGroupLabel, sizeLabel, diffSizeLabel]]
      : [["", officeLabel, groupLabel, diffGroupLabel]];

    autoTable(doc, {
      startY: y,
      head,
      body: persRows.map(({ label, value, groupAvg, sizeAvg, fmt }) => {
        const groupDiff = value !== null && groupAvg !== null ? value - groupAvg : null;
        const groupDiffStr = groupDiff !== null ? `${groupDiff >= 0 ? "+" : ""}${fmt(groupDiff)}` : "—";
        const sizeDiff = value !== null && sizeAvg !== null ? value - sizeAvg : null;
        const sizeDiffStr = sizeDiff !== null ? `${sizeDiff >= 0 ? "+" : ""}${fmt(sizeDiff)}` : "—";
        const row = [label, fmt(value), groupAvg !== null ? fmt(groupAvg) : "—", groupDiffStr];
        if (hasSizeCol) row.push(sizeAvg !== null ? fmt(sizeAvg) : "—", sizeDiffStr);
        return row;
      }),
      theme: "grid",
      headStyles: { fillColor: [...PRIMARY], fontSize: 7, fontStyle: "bold", textColor: [...WHITE] },
      bodyStyles: { fontSize: 7, textColor: [...DARK] },
      alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
      margin: { left: 15, right: 15 },
      styles: { cellPadding: 1.5 },
    });
    y = lastAutoTableFinalY(doc, y) + 8;
  }

  y = sectionTitle(doc, t("field.activities", lang), y);
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "normal");
  doc.text(office.activities.join(", "), 15, y);

  addFooter(doc, year, 2, totalPages, lang);

  // ===== PAGE 2 — Financial Benchmark =====
  doc.addPage();
  addHeader(doc, year, lang);
  y = 28;
  // Group-wide benchmark
  const bmOfficeSize = getOfficeSize(office);
  const bmSizeData = bmOfficeSize ? filterBySize(allData, bmOfficeSize) : null;

  const benchGroupLabel = lang === "nl" ? "Vergelijking t.o.v. alle kantoren" : "Comparaison avec tous les bureaux";
  y = sectionTitle(doc, benchGroupLabel, y);

  const benchRows = [
    { label: t("field.commission_ins", lang), value: office.commission_insurance, allVals: allData.map((r) => r.commission_insurance) },
    { label: t("field.commission_bank", lang), value: office.commission_bank, allVals: allData.map((r) => r.commission_bank) },
    { label: t("field.total_commission", lang), value: computed.total_commission, allVals: allData.map((r) => getComputed(r).total_commission) },
    { label: t("field.commission_per_fte", lang), value: computed.commission_per_fte, allVals: allData.map((r) => getComputed(r).commission_per_fte) },
  ];

  autoTable(doc, {
    startY: y,
    head: [[
      "", t("office.value", lang), t("benchmark.mean", lang),
      t("benchmark.median", lang), t("benchmark.percentile", lang)
    ]],
    body: benchRows.map((row) => {
      const bm = calcBenchmark(row.allVals, row.value);
      return [row.label, fmtCur(row.value), fmtCur(bm.mean), fmtCur(bm.median), bm.percentile !== null ? `P${bm.percentile}` : "—"];
    }),
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], fontSize: 7, fontStyle: "bold", textColor: [...WHITE] },
    bodyStyles: { fontSize: 7, textColor: [...DARK] },
    alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 1.5 },
  });
  y = lastAutoTableFinalY(doc, y) + 6;
  doc.setFontSize(6);
  doc.setTextColor(...GREY);
  doc.text(`n = ${allData.filter(r => r.commission_insurance !== null).length} ${lang === "nl" ? "kantoren" : "bureaux"}`, 15, y);
  y += 8;

  // Size-category benchmark
  if (bmSizeData && bmOfficeSize) {
    const benchSizeLabel = `${lang === "nl" ? "Vergelijking t.o.v. kantoorgrootte" : "Comparaison par taille"} — ${getOfficeSizeLabel(bmOfficeSize, lang)}`;
    y = sectionTitle(doc, benchSizeLabel, y);

    autoTable(doc, {
      startY: y,
      head: [[
        "", t("office.value", lang), t("benchmark.mean", lang),
        t("benchmark.median", lang), t("benchmark.percentile", lang)
      ]],
      body: benchRows.map((row) => {
        const sizeVals = bmSizeData.map((r) => {
          if (row.label === t("field.commission_ins", lang)) return r.commission_insurance;
          if (row.label === t("field.commission_bank", lang)) return r.commission_bank;
          if (row.label === t("field.total_commission", lang)) return getComputed(r).total_commission;
          return getComputed(r).commission_per_fte;
        });
        const bm = calcBenchmark(sizeVals, row.value);
        return [row.label, fmtCur(row.value), fmtCur(bm.mean), fmtCur(bm.median), bm.percentile !== null ? `P${bm.percentile}` : "—"];
      }),
      theme: "grid",
      headStyles: { fillColor: [...PRIMARY], fontSize: 7, fontStyle: "bold", textColor: [...WHITE] },
      bodyStyles: { fontSize: 7, textColor: [...DARK] },
      alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
      margin: { left: 15, right: 15 },
      styles: { cellPadding: 1.5 },
    });
    y = lastAutoTableFinalY(doc, y) + 4;
    doc.setFontSize(6);
    doc.setTextColor(...GREY);
    doc.text(`n = ${bmSizeData.filter(r => r.commission_insurance !== null).length} ${lang === "nl" ? "kantoren" : "bureaux"}`, 15, y);
    y += 12;
  }

  y += 6;

  // Portfolio distribution with size-category markers
  const ORANGE = [215, 173, 123] as const;
  const barMaxW = w - 60;
  const pdfSizeLabel = bmOfficeSize ? getOfficeSizeLabel(bmOfficeSize, lang) : "";

  const drawPortfolioBar = (label: string, officeVal: number | null, groupAvg: number | null, sizeAvg: number | null, yPos: number): number => {
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.text(label, 15, yPos);
    doc.setFont("helvetica", "normal");
    if (officeVal !== null) doc.text(`${officeVal}%`, w - 40, yPos, { align: "right" });
    yPos += 3;
    doc.setFillColor(236, 231, 223);
    doc.roundedRect(15, yPos, barMaxW, 5, 1.5, 1.5, "F");
    if (officeVal !== null && officeVal > 0) {
      doc.setFillColor(...PRIMARY);
      doc.roundedRect(15, yPos, Math.max((officeVal / 100) * barMaxW, 2), 5, 1.5, 1.5, "F");
    }
    if (groupAvg !== null) {
      const markerX = 15 + (groupAvg / 100) * barMaxW;
      doc.setDrawColor(80, 80, 90);
      doc.setLineWidth(0.6);
      doc.line(markerX, yPos - 0.5, markerX, yPos + 5.5);
    }
    if (sizeAvg !== null) {
      const markerX = 15 + (sizeAvg / 100) * barMaxW;
      doc.setDrawColor(...ORANGE);
      doc.setLineWidth(0.6);
      doc.line(markerX, yPos - 0.5, markerX, yPos + 5.5);
    }
    yPos += 7;
    doc.setFontSize(6);
    doc.setTextColor(...GREY);
    doc.setFillColor(...PRIMARY);
    doc.rect(15, yPos, 4, 2, "F");
    doc.text(lang === "nl" ? "Kantoor" : "Bureau", 21, yPos + 1.5);
    if (groupAvg !== null) {
      doc.setDrawColor(80, 80, 90);
      doc.setLineWidth(0.6);
      doc.line(48, yPos, 48, yPos + 2);
      doc.text(`${lang === "nl" ? "Groep" : "Groupe"} (${Math.round(groupAvg * 10) / 10}%)`, 50, yPos + 1.5);
    }
    if (sizeAvg !== null) {
      doc.setDrawColor(...ORANGE);
      doc.setLineWidth(0.6);
      doc.line(95, yPos, 95, yPos + 2);
      doc.text(`${pdfSizeLabel} (${Math.round(sizeAvg * 10) / 10}%)`, 97, yPos + 1.5);
    }
    return yPos + 6;
  };

  const calcFieldAvg = (records: OfficeRecord[], field: "pct_private" | "pct_sme" | "pct_life" | "pct_nonlife") => {
    const vals = records.map(r => r[field]).filter((v): v is number => v !== null);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };

  y = sectionTitle(doc, `${t("field.pct_private", lang)} / ${t("field.pct_sme", lang)}`, y);
  {
    y = drawPortfolioBar(t("field.pct_private", lang), office.pct_private, calcFieldAvg(allData, "pct_private"), bmSizeData ? calcFieldAvg(bmSizeData, "pct_private") : null, y);
    y = drawPortfolioBar(t("field.pct_sme", lang), office.pct_sme, calcFieldAvg(allData, "pct_sme"), bmSizeData ? calcFieldAvg(bmSizeData, "pct_sme") : null, y);
  }

  y += 6;

  y = sectionTitle(doc, `${t("field.pct_life", lang)} / ${t("field.pct_nonlife", lang)}`, y);
  {
    y = drawPortfolioBar(t("field.pct_nonlife", lang), office.pct_nonlife, calcFieldAvg(allData, "pct_nonlife"), bmSizeData ? calcFieldAvg(bmSizeData, "pct_nonlife") : null, y);
    y = drawPortfolioBar(t("field.pct_life", lang), office.pct_life, calcFieldAvg(allData, "pct_life"), bmSizeData ? calcFieldAvg(bmSizeData, "pct_life") : null, y);
  }

  addFooter(doc, year, 3, totalPages, lang);

  // ===== PAGE 3 — Companies & Strategy =====
  doc.addPage();
  addHeader(doc, year, lang);
  y = 28;

  // Companies - styled like app with numbered list and group position badges
  const groupNonLife = calcWeightedRanking(allData, "ranking_nonlife").slice(0, 10);
  const groupLife = calcWeightedRanking(allData, "ranking_life").slice(0, 10);

  const drawCompanyList = (title: string, officeList: string[], groupRanking: ReturnType<typeof calcWeightedRanking>, yPos: number): number => {
    yPos = sectionTitle(doc, title, yPos);
    for (let i = 0; i < Math.min(officeList.length, 5); i++) {
      const company = normalizeCompanyName(officeList[i]);
      const groupEntry = groupRanking.find((g) => g.company === company);
      const groupPos = groupEntry?.rank;
      const inGroupTop5 = groupPos !== undefined && groupPos <= 5;

      // Number circle
      if (i < 3) {
        doc.setFillColor(...PRIMARY_LIGHT);
      } else {
        doc.setFillColor(236, 231, 223);
      }
      doc.circle(19, yPos + 0.5, 3, "F");
      doc.setFontSize(7);
      doc.setTextColor(i < 3 ? PRIMARY[0] : GREY[0], i < 3 ? PRIMARY[1] : GREY[1], i < 3 ? PRIMARY[2] : GREY[2]);
      doc.setFont("helvetica", "bold");
      doc.text(String(i + 1), 19, yPos + 1.5, { align: "center" });

      // Company name
      doc.setFontSize(8);
      if (inGroupTop5) {
        doc.setTextColor(...PRIMARY);
        doc.setFont("helvetica", "bold");
      } else {
        doc.setTextColor(...DARK);
        doc.setFont("helvetica", "normal");
      }
      doc.text(company, 25, yPos + 1.5);

      // Group position badge
      if (groupPos !== undefined) {
        const badgeText = `${lang === "nl" ? "Groep" : "Groupe"} #${groupPos}`;
        const badgeW = doc.getTextWidth(badgeText) + 5;
        const badgeX = w - 15 - badgeW;
        if (inGroupTop5) {
          doc.setFillColor(...PRIMARY_LIGHT);
          doc.setTextColor(...PRIMARY);
        } else {
          doc.setFillColor(236, 231, 223);
          doc.setTextColor(...GREY);
        }
        doc.roundedRect(badgeX, yPos - 1.5, badgeW, 5, 1.5, 1.5, "F");
        doc.setFontSize(6);
        doc.text(badgeText, badgeX + 2.5, yPos + 1.5);
      }
      yPos += 7;
    }
    // Note
    doc.setFontSize(6);
    doc.setTextColor(...GREY);
    doc.setFont("helvetica", "normal");
    doc.text(
      lang === "nl"
        ? "Paars = in groep top 5. Groepspositie op gewogen puntensysteem."
        : "Violet = dans le top 5 du groupe. Position basée sur points pondérés.",
      15, yPos + 1
    );
    return yPos + 6;
  };

  y = drawCompanyList(t("field.companies_nonlife", lang), office.ranking_nonlife, groupNonLife, y);
  y += 4;
  y = drawCompanyList(t("field.companies_life", lang), office.ranking_life, groupLife, y);
  y += 6;

  // Strategy - styled like app with pill badges
  y = sectionTitle(doc, t("office.strategy", lang), y);

  // Priorities as pill badges
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  let pillX = 15;
  const pillY = y;
  let currentPillY = pillY;
  for (const p of office.priorities) {
    const tw = doc.getTextWidth(p) + 6;
    if (pillX + tw > w - 15) {
      pillX = 15;
      currentPillY += 7;
    }
    doc.setFillColor(...PRIMARY_LIGHT);
    doc.roundedRect(pillX, currentPillY - 3, tw, 5.5, 2, 2, "F");
    doc.setTextColor(...PRIMARY);
    doc.text(p, pillX + 3, currentPillY);
    pillX += tw + 2;
  }
  y = currentPillY + 8;

  if (office.strengths_text) {
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.setFont("helvetica", "bold");
    doc.text(t("field.strengths", lang), 15, y);
    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    const sLines = doc.splitTextToSize(office.strengths_text, w - 30);
    doc.text(sLines, 15, y);
    y += sLines.length * 4 + 4;
  }

  if (office.challenges_text) {
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.setFont("helvetica", "bold");
    doc.text(t("field.challenges", lang), 15, y);
    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    const cLines = doc.splitTextToSize(office.challenges_text, w - 30);
    doc.text(cLines, 15, y);
  }

  addFooter(doc, year, 4, totalPages, lang);

  // ===== PAGE 4 — Aquilae Engagement =====
  doc.addPage();
  addHeader(doc, year, lang);
  y = 28;
  y = sectionTitle(doc, t("office.engagement", lang), y);

  // Satisfaction + Recommendation
  const satScore = satisfactionScore(office.satisfaction_aquilae);
  const recScore = recommendScore(office.recommend_aquilae);
  const allSat = allData.map((r) => satisfactionScore(r.satisfaction_aquilae)).filter((v): v is number => v !== null);
  const allRec = allData.map((r) => recommendScore(r.recommend_aquilae)).filter((v): v is number => v !== null);
  const avgSat = allSat.length > 0 ? allSat.reduce((s, v) => s + v, 0) / allSat.length : null;
  const avgRec = allRec.length > 0 ? allRec.reduce((s, v) => s + v, 0) / allRec.length : null;

  const engBody = [
    [t("field.satisfaction", lang), office.satisfaction_aquilae || "—", satScore !== null ? `${satScore}/3` : "—", avgSat !== null ? `${avgSat.toFixed(2)}/3` : "—"],
    [t("field.recommend", lang), office.recommend_aquilae || "—", recScore !== null ? `${recScore}/3` : "—", avgRec !== null ? `${avgRec.toFixed(2)}/3` : "—"],
  ];

  autoTable(doc, {
    startY: y,
    head: [["", t("benchmark.office", lang), "Score", t("benchmark.group", lang) + " avg"]],
    body: engBody,
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], fontSize: 8, textColor: [...WHITE] },
    bodyStyles: { fontSize: 8, textColor: [...DARK] },
    alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 2 },
  });
  y = lastAutoTableFinalY(doc, y) + 10;

  // Alignment scores
  y = sectionTitle(doc, `${t("field.mission", lang)} / ${t("field.vision", lang)} / ${t("field.values", lang)} / ${t("field.charter", lang)}`, y);

  const alignFields = [
    { key: "mission_alignment" as const, label: t("field.mission", lang) },
    { key: "vision_alignment" as const, label: t("field.vision", lang) },
    { key: "values_alignment" as const, label: t("field.values", lang) },
    { key: "participation_charter" as const, label: t("field.charter", lang) },
  ];

  const alignBody = alignFields.map(({ key, label }) => {
    const officeVal = office[key];
    const officeScore = alignmentScore(officeVal);
    const groupScores = allData.map((r) => alignmentScore(r[key])).filter((v): v is number => v !== null);
    const groupAvg = groupScores.length > 0 ? groupScores.reduce((s, v) => s + v, 0) / groupScores.length : null;
    return [label, officeVal || "—", officeScore !== null ? `${officeScore}/4` : "—", groupAvg !== null ? `${groupAvg.toFixed(2)}/4` : "—"];
  });

  autoTable(doc, {
    startY: y,
    head: [["", t("benchmark.office", lang), "Score", t("benchmark.group", lang) + " avg"]],
    body: alignBody,
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], fontSize: 8, textColor: [...WHITE] },
    bodyStyles: { fontSize: 8, textColor: [...DARK] },
    alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 2 },
  });
  y = lastAutoTableFinalY(doc, y) + 10;

  // Reasons for membership
  if (office.reasons_membership) {
    y = sectionTitle(doc, t("field.reasons", lang), y);
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    const rLines = doc.splitTextToSize(office.reasons_membership, w - 30);
    doc.text(rLines, 15, y);
  }

  addFooter(doc, year, 5, totalPages, lang);

  // ===== PAGE 5 — Evolution =====
  doc.addPage();
  addHeader(doc, year, lang);
  y = 28;
  y = sectionTitle(doc, t("office.evolution", lang), y);

  const officeAllYears = (allYearsData || []).filter((r) => r.office_name === office.office_name).sort((a, b) => a.survey_year - b.survey_year);

  if (officeAllYears.length > 1) {
    // Year-over-year table
    const evoBody = officeAllYears.map((r) => {
      const c = getComputed(r);
      return [
        String(r.survey_year),
        fmtCur(r.commission_insurance),
        c.total_fte !== null ? c.total_fte.toFixed(1) : "—",
        fmtCur(c.commission_per_fte),
        r.pct_private !== null ? `${r.pct_private}%` : "—",
        r.pct_sme !== null ? `${r.pct_sme}%` : "—",
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [[t("filter.year", lang), t("field.commission_ins", lang), "FTE", t("field.commission_per_fte", lang), t("field.pct_private", lang), t("field.pct_sme", lang)]],
      body: evoBody,
      theme: "grid",
      headStyles: { fillColor: [...PRIMARY], fontSize: 7, textColor: [...WHITE] },
      bodyStyles: { fontSize: 7, textColor: [...DARK] },
      alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
      margin: { left: 15, right: 15 },
      styles: { cellPadding: 1.5 },
    });
    y = lastAutoTableFinalY(doc, y) + 10;

    // Prepare chart data
    const chartYears = officeAllYears.map((r) => r.survey_year);
    const chartComm = officeAllYears.map((r) => getComputed(r).total_commission);
    const chartFte = officeAllYears.map((r) => getComputed(r).total_fte);
    const chartCommPerFte = officeAllYears.map((r) => getComputed(r).commission_per_fte);
    const chartPctPrivate = officeAllYears.map((r) => r.pct_private);
    const chartPctSme = officeAllYears.map((r) => r.pct_sme);

    // Group means per year
    const groupCommByYear: Record<number, number[]> = {};
    const groupFteByYear: Record<number, number[]> = {};
    const groupPriByYear: Record<number, number[]> = {};
    const groupSmeByYear: Record<number, number[]> = {};
    for (const r of (allYearsData || [])) {
      const c = getComputed(r);
      if (!groupCommByYear[r.survey_year]) { groupCommByYear[r.survey_year] = []; groupFteByYear[r.survey_year] = []; groupPriByYear[r.survey_year] = []; groupSmeByYear[r.survey_year] = []; }
      if (c.total_commission !== null) groupCommByYear[r.survey_year].push(c.total_commission);
      if (c.total_fte !== null) groupFteByYear[r.survey_year].push(c.total_fte);
      if (r.pct_private !== null) groupPriByYear[r.survey_year].push(r.pct_private);
      if (r.pct_sme !== null) groupSmeByYear[r.survey_year].push(r.pct_sme);
    }
    const avgArr = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const groupCommMeans = chartYears.map((yr) => avgArr(groupCommByYear[yr] || []));
    const groupFteMeans = chartYears.map((yr) => avgArr(groupFteByYear[yr] || []));
    const groupPriMeans = chartYears.map((yr) => avgArr(groupPriByYear[yr] || []));
    const groupSmeMeans = chartYears.map((yr) => avgArr(groupSmeByYear[yr] || []));

    const chartW = 80;
    const chartH = 35;

    // Helper: draw mini line chart
    const drawMiniChart = (
      title: string, xOff: number, chartY: number,
      officeVals: (number | null)[], groupVals: (number | null)[],
      formatFn: (v: number) => string, maxOverride?: number,
      color: readonly [number, number, number] = PRIMARY,
      extraLine?: { vals: (number | null)[]; color: readonly [number, number, number]; label: string }
    ) => {
      doc.setFontSize(7);
      doc.setTextColor(...PRIMARY);
      doc.setFont("helvetica", "bold");
      doc.text(title, xOff, chartY);

      const areaX = xOff;
      const areaY = chartY + 3;

      doc.setDrawColor(236, 231, 223);
      doc.setLineWidth(0.3);
      doc.line(areaX, areaY, areaX, areaY + chartH);
      doc.line(areaX, areaY + chartH, areaX + chartW, areaY + chartH);

      const allVals = [...officeVals, ...groupVals, ...(extraLine?.vals || [])].filter((v): v is number => v !== null);
      if (allVals.length === 0) return;
      const minVal = maxOverride !== undefined ? 0 : Math.min(...allVals) * 0.85;
      const maxVal = maxOverride !== undefined ? maxOverride : Math.max(...allVals) * 1.1;
      const range = maxVal - minVal || 1;

      const toX = (i: number) => areaX + (i / Math.max(chartYears.length - 1, 1)) * chartW;
      const toY = (v: number) => areaY + chartH - ((v - minVal) / range) * chartH;

      // Y-axis labels
      doc.setFontSize(5);
      doc.setTextColor(...GREY);
      doc.setFont("helvetica", "normal");
      doc.text(formatFn(maxVal), areaX - 1, areaY + 2, { align: "right" });
      doc.text(formatFn(minVal), areaX - 1, areaY + chartH, { align: "right" });

      // X-axis labels
      for (let i = 0; i < chartYears.length; i++) {
        doc.text(String(chartYears[i]), toX(i), areaY + chartH + 4, { align: "center" });
      }

      // Group line (dashed)
      const groupPts = groupVals.map((v, i) => v !== null ? { x: toX(i), y: toY(v) } : null).filter(Boolean) as { x: number; y: number }[];
      if (groupPts.length > 1) {
        doc.setDrawColor(236, 231, 223);
        doc.setLineWidth(0.5);
        doc.setLineDashPattern([1.5, 1.5], 0);
        for (let i = 1; i < groupPts.length; i++) doc.line(groupPts[i - 1].x, groupPts[i - 1].y, groupPts[i].x, groupPts[i].y);
        doc.setLineDashPattern([], 0);
      }

      // Extra line (e.g. KMO)
      if (extraLine) {
        const pts = extraLine.vals.map((v, i) => v !== null ? { x: toX(i), y: toY(v) } : null).filter(Boolean) as { x: number; y: number }[];
        if (pts.length > 1) {
          doc.setDrawColor(...extraLine.color);
          doc.setLineWidth(0.7);
          for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
          doc.setFillColor(...extraLine.color);
          for (const pt of pts) doc.circle(pt.x, pt.y, 0.8, "F");
        }
      }

      // Office line (solid)
      const officePts = officeVals.map((v, i) => v !== null ? { x: toX(i), y: toY(v) } : null).filter(Boolean) as { x: number; y: number }[];
      if (officePts.length > 1) {
        doc.setDrawColor(...color);
        doc.setLineWidth(0.8);
        for (let i = 1; i < officePts.length; i++) doc.line(officePts[i - 1].x, officePts[i - 1].y, officePts[i].x, officePts[i].y);
        doc.setFillColor(...color);
        for (const pt of officePts) doc.circle(pt.x, pt.y, 1, "F");
      }

      // Value labels
      doc.setFontSize(4.5);
      doc.setTextColor(...DARK);
      for (let i = 0; i < officeVals.length; i++) {
        const v = officeVals[i];
        if (v !== null) doc.text(formatFn(v), toX(i), toY(v) - 2.5, { align: "center" });
      }
    };

    // Chart row 1: Commission + FTE
    drawMiniChart(t("field.total_commission", lang), 15, y, chartComm, groupCommMeans, (v) => `€${(v / 1000).toFixed(0)}k`);
    drawMiniChart("FTE", 15 + chartW + 15, y, chartFte, groupFteMeans, (v) => v.toFixed(1));
    y += chartH + 18;

    // Chart row 2: Commission/FTE + % Particulieren vs KMO
    drawMiniChart(t("field.commission_per_fte", lang), 15, y, chartCommPerFte, [], (v) => `€${(v / 1000).toFixed(0)}k`, undefined, [79, 138, 110] as const);
    drawMiniChart(
      lang === "nl" ? "% Particulieren vs KMO" : "% Particuliers vs PME",
      15 + chartW + 15, y,
      chartPctPrivate, groupPriMeans,
      (v) => `${Math.round(v)}%`, 100,
      PRIMARY,
      { vals: chartPctSme, color: [215, 173, 123] as const, label: t("field.pct_sme", lang) }
    );
    y += chartH + 14;

    // Legend
    doc.setFontSize(5.5);
    doc.setDrawColor(...PRIMARY);
    doc.setLineWidth(0.8);
    doc.line(15, y, 20, y);
    doc.setFillColor(...PRIMARY);
    doc.circle(17.5, y, 0.7, "F");
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    doc.text(t("benchmark.office", lang), 22, y + 1);

    doc.setDrawColor(236, 231, 223);
    doc.setLineWidth(0.5);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(50, y, 55, y);
    doc.setLineDashPattern([], 0);
    doc.setTextColor(...GREY);
    doc.text(lang === "nl" ? "Groepsgemiddelde" : "Moyenne groupe", 57, y + 1);
    y += 10;

    // === PAGE 5b — Company evolution ===
    // Build company evolution for this office
    const buildCompanyEvolution = (field: "ranking_nonlife" | "ranking_life") => {
      const companyYearPoints: Record<string, Record<number, number>> = {};
      for (const rec of officeAllYears) {
        const list = rec[field];
        for (let i = 0; i < Math.min(list.length, 5); i++) {
          const company = list[i]?.trim();
          if (!company) continue;
          const normalized = normalizeCompanyName(company);
          if (!companyYearPoints[normalized]) companyYearPoints[normalized] = {};
          companyYearPoints[normalized][rec.survey_year] = (companyYearPoints[normalized][rec.survey_year] || 0) + (5 - i);
        }
      }
      return Object.entries(companyYearPoints)
        .map(([company, years]) => ({ company, total: Object.values(years).reduce((a, b) => a + b, 0), years }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    };

    const companyNonlife = buildCompanyEvolution("ranking_nonlife");
    const companyLife = buildCompanyEvolution("ranking_life");

    addFooter(doc, year, 6, totalPages, lang);

    // === New page for company rankings ===
    doc.addPage();
    addHeader(doc, year, lang);
    y = 28;

    // Company non-life table
    if (companyNonlife.length > 0) {
      y = sectionTitle(doc, lang === "nl" ? "Top maatschappijen niet-leven (punten)" : "Top compagnies non-vie (points)", y);
      const compHead = [lang === "nl" ? "Maatschappij" : "Compagnie", ...chartYears.map(String), "Totaal"];
      const compBody = companyNonlife.map(({ company, years, total }) => [
        company,
        ...chartYears.map(yr => years[yr] ? String(years[yr]) : "—"),
        String(total),
      ]);
      autoTable(doc, {
        startY: y,
        head: [compHead],
        body: compBody,
        theme: "grid",
        headStyles: { fillColor: [...PRIMARY], fontSize: 7, textColor: [...WHITE] },
        bodyStyles: { fontSize: 7, textColor: [...DARK] },
        alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
        margin: { left: 15, right: 15 },
        styles: { cellPadding: 1.5 },
      });
      y = lastAutoTableFinalY(doc, y) + 12;
    }

    // Company life table
    if (companyLife.length > 0) {
      y = sectionTitle(doc, lang === "nl" ? "Top maatschappijen leven (punten)" : "Top compagnies vie (points)", y);
      const compHead = [lang === "nl" ? "Maatschappij" : "Compagnie", ...chartYears.map(String), "Totaal"];
      const compBody = companyLife.map(({ company, years, total }) => [
        company,
        ...chartYears.map(yr => years[yr] ? String(years[yr]) : "—"),
        String(total),
      ]);
      autoTable(doc, {
        startY: y,
        head: [compHead],
        body: compBody,
        theme: "grid",
        headStyles: { fillColor: [...PRIMARY], fontSize: 7, textColor: [...WHITE] },
        bodyStyles: { fontSize: 7, textColor: [...DARK] },
        alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
        margin: { left: 15, right: 15 },
        styles: { cellPadding: 1.5 },
      });
      y = lastAutoTableFinalY(doc, y) + 12;
    }

    // Analysis summary follows directly on this page
    y += 6;

  } else {
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.setFont("helvetica", "italic");
    doc.text(lang === "nl"
      ? "Evolutiedata beschikbaar wanneer meerdere surveyjaren zijn geimporteerd."
      : "Donnees d'evolution disponibles lorsque plusieurs annees d'enquete sont importees.", 15, y);
    addFooter(doc, year, 6, totalPages, lang);
    doc.addPage();
    addHeader(doc, year, lang);
    y = 28;
  }

  // ===== Analysis Summary (continues on current page) =====
  y = sectionTitle(doc, t("office.analysis", lang), y);

  const renderInsights = (insights: AnalysisInsight[], subtitle?: string) => {
    if (subtitle) {
      doc.setFontSize(8);
      doc.setTextColor(...GREY);
      doc.setFont("helvetica", "bold");
      doc.text(subtitle, 15, y);
      y += 5;
    }
    for (const insight of insights) {
      const isPositive = insight.type === "positive";
      const isNegative = insight.type === "negative";
      const indicatorColor: readonly [number, number, number] = isPositive ? [79, 138, 110] : isNegative ? [215, 173, 123] : [...GREY];

      doc.setFillColor(indicatorColor[0], indicatorColor[1], indicatorColor[2]);
      doc.circle(19, y + 1, 1.5, "F");

      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(insight.text, w - 40);
      doc.text(lines, 25, y + 2);
      y += lines.length * 4 + 5;

      if (y > 270) break;
    }
  };

  const groupInsights = generateAnalysisInsights(office, allData, computed, lang);
  const sizeInsights = bmSizeData && bmOfficeSize ? generateAnalysisInsights(office, bmSizeData, computed, lang) : [];

  if (groupInsights.length > 0 || sizeInsights.length > 0) {
    if (groupInsights.length > 0) {
      renderInsights(groupInsights, lang === "nl" ? "Vergelijking t.o.v. alle kantoren" : "Comparaison avec tous les bureaux");
    }
    if (sizeInsights.length > 0) {
      y += 4;
      renderInsights(sizeInsights, `${lang === "nl" ? "Vergelijking t.o.v. kantoorgrootte" : "Comparaison par taille"} — ${getOfficeSizeLabel(bmOfficeSize!, lang)}`);
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.setFont("helvetica", "italic");
    doc.text(lang === "nl" ? "Onvoldoende data voor analyse." : "Données insuffisantes pour l'analyse.", 15, y);
  }

  addFooter(doc, year, 7, totalPages, lang);

  return doc;
}

export function generateOfficeFileName(officeName: string, year: number): string {
  const safeName = officeName.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "").replace(/\s+/g, "_");
  return `Aquilae_Barometer_${year}_${safeName}.pdf`;
}

// ===== GROUP REPORT PDF =====

function drawMiniLineChart(
  doc: jsPDF,
  data: { year: number; value: number | null; groupValue: number | null }[],
  opts: { x: number; y: number; w: number; h: number; title: string; formatFn: (v: number) => string; maxOverride?: number; color: readonly [number, number, number] }
) {
  const { x, y, w, h, title, formatFn, color } = opts;

  // Title
  doc.setFontSize(9);
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text(title, x, y);

  const areaY = y + 4;

  // Axes
  doc.setDrawColor(236, 231, 223);
  doc.setLineWidth(0.3);
  doc.line(x, areaY, x, areaY + h);
  doc.line(x, areaY + h, x + w, areaY + h);

  const allVals = data.flatMap((d) => [d.value, d.groupValue]).filter((v): v is number => v !== null);
  if (allVals.length === 0) return;

  const minVal = opts.maxOverride !== undefined ? 0 : Math.min(...allVals) * 0.85;
  const maxVal = opts.maxOverride !== undefined ? opts.maxOverride : Math.max(...allVals) * 1.1;
  const range = maxVal - minVal || 1;

  const toX = (i: number) => x + (i / Math.max(data.length - 1, 1)) * w;
  const toY = (v: number) => areaY + h - ((v - minVal) / range) * h;

  // Y-axis labels
  doc.setFontSize(5.5);
  doc.setTextColor(...GREY);
  doc.setFont("helvetica", "normal");
  doc.text(formatFn(maxVal), x - 1, areaY + 2, { align: "right" });
  doc.text(formatFn(minVal), x - 1, areaY + h, { align: "right" });

  // X-axis labels
  for (let i = 0; i < data.length; i++) {
    doc.text(String(data[i].year), toX(i), areaY + h + 4, { align: "center" });
  }

  // Group line (dashed)
  const groupPts = data.map((d, i) => d.groupValue !== null ? { x: toX(i), y: toY(d.groupValue) } : null).filter(Boolean) as { x: number; y: number }[];
  if (groupPts.length > 1) {
    doc.setDrawColor(...PRIMARY_LIGHT);
    doc.setLineWidth(0.6);
    doc.setLineDashPattern([1.5, 1.5], 0);
    for (let i = 1; i < groupPts.length; i++) {
      doc.line(groupPts[i - 1].x, groupPts[i - 1].y, groupPts[i].x, groupPts[i].y);
    }
    doc.setLineDashPattern([], 0);
  }

  // Main line (solid)
  const pts = data.map((d, i) => d.value !== null ? { x: toX(i), y: toY(d.value) } : null).filter(Boolean) as { x: number; y: number }[];
  if (pts.length > 1) {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.8);
    for (let i = 1; i < pts.length; i++) {
      doc.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    }
    doc.setFillColor(...color);
    for (const pt of pts) doc.circle(pt.x, pt.y, 1, "F");
  }

  // Data labels
  doc.setFontSize(5);
  doc.setTextColor(...DARK);
  for (let i = 0; i < data.length; i++) {
    if (data[i].value !== null) {
      doc.text(formatFn(data[i].value!), toX(i), toY(data[i].value!) - 2.5, { align: "center" });
    }
  }
}

function drawMiniStackedBar(
  doc: jsPDF,
  data: { year: number; values: { value: number; color: readonly [number, number, number]; label: string }[] }[],
  opts: { x: number; y: number; w: number; h: number; title: string }
) {
  const { x, y, w, h, title } = opts;
  doc.setFontSize(9);
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text(title, x, y);

  const areaY = y + 4;
  doc.setDrawColor(236, 231, 223);
  doc.setLineWidth(0.3);
  doc.line(x, areaY + h, x + w, areaY + h);

  const maxTotal = Math.max(...data.map((d) => d.values.reduce((s, v) => s + v.value, 0)), 1);
  const barW = Math.min(w / data.length * 0.6, 12);
  const gap = w / data.length;

  for (let i = 0; i < data.length; i++) {
    const bx = x + i * gap + (gap - barW) / 2;
    let by = areaY + h;
    for (const seg of data[i].values) {
      const segH = (seg.value / maxTotal) * h;
      if (segH > 0) {
        doc.setFillColor(...seg.color);
        doc.rect(bx, by - segH, barW, segH, "F");
        if (segH > 4) {
          doc.setFontSize(5);
          doc.setTextColor(...WHITE);
          doc.text(String(seg.value), bx + barW / 2, by - segH / 2 + 1.5, { align: "center" });
        }
        by -= segH;
      }
    }
    doc.setFontSize(5.5);
    doc.setTextColor(...GREY);
    doc.setFont("helvetica", "normal");
    doc.text(String(data[i].year), x + i * gap + gap / 2, areaY + h + 4, { align: "center" });
  }

  // Legend
  const legendY = areaY + h + 8;
  let lx = x;
  const labels = data[0]?.values.map((v) => v.label) ?? [];
  const colors = data[0]?.values.map((v) => v.color) ?? [];
  doc.setFontSize(5);
  for (let i = 0; i < labels.length; i++) {
    doc.setFillColor(...colors[i]);
    doc.rect(lx, legendY - 2, 3, 3, "F");
    doc.setTextColor(...DARK);
    doc.text(labels[i], lx + 4, legendY + 0.5);
    lx += doc.getTextWidth(labels[i]) + 7;
  }
}

function drawMiniMultiLineChart(
  doc: jsPDF,
  data: { year: number; lines: { value: number | null; label: string; color: readonly [number, number, number] }[] }[],
  opts: { x: number; y: number; w: number; h: number; title: string; formatFn: (v: number) => string }
) {
  const { x, y, w, h, title, formatFn } = opts;
  doc.setFontSize(9);
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text(title, x, y);

  const areaY = y + 4;
  doc.setDrawColor(236, 231, 223);
  doc.setLineWidth(0.3);
  doc.line(x, areaY, x, areaY + h);
  doc.line(x, areaY + h, x + w, areaY + h);

  const allVals = data.flatMap((d) => d.lines.map((l) => l.value)).filter((v): v is number => v !== null);
  if (allVals.length === 0) return;

  const maxVal = Math.max(...allVals) * 1.1;
  const minVal = 0;
  const range = maxVal - minVal || 1;
  const toX = (i: number) => x + (i / Math.max(data.length - 1, 1)) * w;
  const toY = (v: number) => areaY + h - ((v - minVal) / range) * h;

  // Y-axis labels
  doc.setFontSize(5.5);
  doc.setTextColor(...GREY);
  doc.setFont("helvetica", "normal");
  doc.text(formatFn(maxVal), x - 1, areaY + 2, { align: "right" });
  doc.text("0", x - 1, areaY + h, { align: "right" });

  // X-axis labels
  for (let i = 0; i < data.length; i++) {
    doc.text(String(data[i].year), toX(i), areaY + h + 4, { align: "center" });
  }

  // Draw each line
  const lineCount = data[0]?.lines.length ?? 0;
  for (let li = 0; li < lineCount; li++) {
    const color = data[0].lines[li].color;
    const pts = data.map((d, i) => d.lines[li].value !== null ? { x: toX(i), y: toY(d.lines[li].value!) } : null).filter(Boolean) as { x: number; y: number }[];
    if (pts.length > 1) {
      doc.setDrawColor(...color);
      doc.setLineWidth(0.6);
      for (let i = 1; i < pts.length; i++) {
        doc.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
      }
      doc.setFillColor(...color);
      for (const pt of pts) doc.circle(pt.x, pt.y, 0.8, "F");
    }
  }

  // Legend
  const legendY = areaY + h + 8;
  let lx = x;
  doc.setFontSize(4.5);
  for (let li = 0; li < lineCount; li++) {
    const lbl = data[0].lines[li].label;
    const col = data[0].lines[li].color;
    doc.setFillColor(...col);
    doc.rect(lx, legendY - 2, 3, 2, "F");
    doc.setTextColor(...DARK);
    const truncated = lbl.length > 18 ? lbl.substring(0, 16) + ".." : lbl;
    doc.text(truncated, lx + 4, legendY);
    lx += doc.getTextWidth(truncated) + 7;
  }
}

export function generateGroupPDF(
  allData: OfficeRecord[],
  lang: Language,
  year: number,
  sourceLanguageFilter: "nl" | "fr" | "all"
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const totalPages = 6;

  // Filter data for selected year
  const data = allData
    .filter((r) => r.survey_year === year)
    .filter((r) => sourceLanguageFilter === "all" || r.source_language === sourceLanguageFilter);

  // Anonymize office names for group report
  const uniqueNames = [...new Set(data.map((r) => r.office_name))].sort();
  const anonLabel = lang === "fr" ? "Bureau" : "Kantoor";
  const anonMap = new Map<string, string>();
  uniqueNames.forEach((name, i) => anonMap.set(name, `${anonLabel} ${i + 1}`));
  const anon = (name: string) => anonMap.get(name) ?? name;

  // Get all years for evolution
  const allYears = [...new Set(allData.map((r) => r.survey_year))].sort();

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const med = (arr: number[]) => {
    if (arr.length === 0) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  // ===== PAGE 1 — Cover =====
  drawCoverPage(doc, {
    year,
    lang,
    kicker: lang === "fr" ? "Rapport de groupe" : "Groepsrapport",
    title: lang === "fr" ? "Rapport de groupe" : "Groepsrapport",
    introLines: [
      `${data.length} ${t("common.offices", lang)} · ${sourceLanguageFilter.toUpperCase()}`,
      lang === "fr"
        ? "Synthèse annuelle des bureaux Aquilae"
        : "Jaarlijkse synthese van de Aquilae-kantoren",
    ],
  });

  // ===== PAGE 2 — Overview & KPIs =====
  doc.addPage();
  addHeader(doc, year, lang);
  let y = 28;

  doc.setFontSize(20);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.text("Aquilae Barometer — " + (lang === "nl" ? "Groepsrapport" : "Rapport de groupe"), 15, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(...GREY);
  doc.setFont("helvetica", "normal");
  doc.text(`${t("filter.year", lang)}: ${year}  |  ${data.length} ${t("common.offices", lang)}  |  ${sourceLanguageFilter.toUpperCase()}`, 15, y);
  y += 14;

  // KPI cards
  const comms = data.map((r) => getComputed(r).total_commission).filter((v): v is number => v !== null);
  const ftes = data.map((r) => getComputed(r).total_fte).filter((v): v is number => v !== null);
  const efficiencies = data.map((r) => getComputed(r).commission_per_fte).filter((v): v is number => v !== null);
  const sats = data.map((r) => satisfactionScore(r.satisfaction_aquilae)).filter((v): v is number => v !== null);

  const commInsurance = data.map((r) => r.commission_insurance).filter((v): v is number => v !== null);
  const commBank = data.map((r) => r.commission_bank).filter((v): v is number => v !== null);
  const kantorMetBank = data.filter((r) => r.commission_bank !== null && r.commission_bank > 0).length;
  const kantorZonderBank = data.length - kantorMetBank;
  const pctPrivates = data.map((r) => r.pct_private).filter((v): v is number => v !== null);
  const pctSmes = data.map((r) => r.pct_sme).filter((v): v is number => v !== null);
  const pctLifes = data.map((r) => r.pct_life).filter((v): v is number => v !== null);
  const pctNonlifes = data.map((r) => r.pct_nonlife).filter((v): v is number => v !== null);

  y = sectionTitle(doc, lang === "nl" ? "Kerncijfers" : "Chiffres clés", y);

  const kpis = [
    { label: lang === "nl" ? "Aantal kantoren" : "Nombre de bureaux", value: String(data.length) },
    { label: lang === "nl" ? "Kantoren met bank" : "Bureaux avec banque", value: String(kantorMetBank) },
    { label: lang === "nl" ? "Kantoren zonder bank" : "Bureaux sans banque", value: String(kantorZonderBank) },
    { label: lang === "nl" ? "Gem. commissie verzekeringen" : "Commission assurances moy.", value: fmtCur(avg(commInsurance)) },
    { label: lang === "nl" ? "Gem. commissie bank" : "Commission banque moy.", value: fmtCur(avg(commBank)) },
    { label: lang === "nl" ? "Gem. totale commissie" : "Commission totale moy.", value: fmtCur(avg(comms)) },
    { label: lang === "nl" ? "Mediaan totale commissie" : "Médiane commission totale", value: fmtCur(med(comms)) },
    { label: lang === "nl" ? "Gem. FTE" : "ETP moyen", value: avg(ftes)?.toFixed(1) ?? "—" },
    { label: lang === "nl" ? "Gem. commissie/FTE" : "Commission/ETP moy.", value: fmtCur(avg(efficiencies)) },
    { label: lang === "nl" ? "Gem. % Particulier / % KMO" : "Moy. % Particulier / % PME", value: `${avg(pctPrivates)?.toFixed(1) ?? "—"}% / ${avg(pctSmes)?.toFixed(1) ?? "—"}%` },
    { label: lang === "nl" ? "Gem. % Leven / % BOAR" : "Moy. % Vie / % IARD", value: `${avg(pctLifes)?.toFixed(1) ?? "—"}% / ${avg(pctNonlifes)?.toFixed(1) ?? "—"}%` },
    { label: lang === "nl" ? "Gem. tevredenheid" : "Satisfaction moy.", value: avg(sats) !== null ? `${avg(sats)!.toFixed(2)}/3` : "—" },
  ];

  for (const kpi of kpis) {
    y = labelValue(doc, kpi.label, kpi.value, 15, y);
  }
  y += 8;

  // Top 10 commission table
  y = sectionTitle(doc, lang === "nl" ? "Top 10 commissie verzekeringen" : "Top 10 commission assurances", y);
  const top10 = [...data]
    .filter((r) => r.commission_insurance !== null)
    .sort((a, b) => b.commission_insurance! - a.commission_insurance!)
    .slice(0, 10);

  autoTable(doc, {
    startY: y,
    head: [["#", t("field.office_name", lang), t("field.commission_ins", lang), "FTE", t("field.commission_per_fte", lang)]],
    body: top10.map((r, i) => {
      const c = getComputed(r);
      return [String(i + 1), anon(r.office_name), fmtCur(r.commission_insurance), c.total_fte?.toFixed(1) ?? "—", fmtCur(c.commission_per_fte)];
    }),
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], fontSize: 8, textColor: [...WHITE] },
    bodyStyles: { fontSize: 8, textColor: [...DARK] },
    alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 10 } },
  });

  addFooter(doc, year, 2, totalPages, lang);

  // ===== PAGE 2 — Top 10 Efficiency + Companies & Engagement =====
  doc.addPage();
  addHeader(doc, year, lang);
  y = 28;

  // Top 10 efficiency
  y = sectionTitle(doc, lang === "nl" ? "Top 10 efficiëntie (commissie/FTE)" : "Top 10 efficacité (commission/ETP)", y);
  const top10Eff = [...data]
    .map((r) => ({ ...r, eff: getComputed(r).commission_per_fte }))
    .filter((r) => r.eff !== null)
    .sort((a, b) => b.eff! - a.eff!)
    .slice(0, 10);

  autoTable(doc, {
    startY: y,
    head: [["#", t("field.office_name", lang), t("field.commission_per_fte", lang), t("field.total_commission", lang)]],
    body: top10Eff.map((r, i) => {
      const c = getComputed(r);
      return [String(i + 1), anon(r.office_name), fmtCur(r.eff), fmtCur(c.total_commission)];
    }),
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], fontSize: 8, textColor: [...WHITE] },
    bodyStyles: { fontSize: 8, textColor: [...DARK] },
    alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 10 } },
  });
  y = lastAutoTableFinalY(doc, y) + 10;
  doc.addPage();
  addHeader(doc, year, lang);
  y = 28;

  // Company rankings
  const nonLifeRanking = calcWeightedRanking(data, "ranking_nonlife").slice(0, 10);
  const lifeRanking = calcWeightedRanking(data, "ranking_life").slice(0, 10);

  y = sectionTitle(doc, t("field.companies_nonlife", lang), y);
  autoTable(doc, {
    startY: y,
    head: [[t("common.rank", lang), t("common.company", lang), t("common.points", lang), t("common.in_top3", lang)]],
    body: nonLifeRanking.map((r) => [String(r.rank), r.company, String(r.totalPoints), String(r.inTop3)]),
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], fontSize: 8, textColor: [...WHITE] },
    bodyStyles: { fontSize: 8, textColor: [...DARK] },
    alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 12, halign: "center" } },
  });
  y = lastAutoTableFinalY(doc, y) + 10;

  y = sectionTitle(doc, t("field.companies_life", lang), y);
  autoTable(doc, {
    startY: y,
    head: [[t("common.rank", lang), t("common.company", lang), t("common.points", lang), t("common.in_top3", lang)]],
    body: lifeRanking.map((r) => [String(r.rank), r.company, String(r.totalPoints), String(r.inTop3)]),
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], fontSize: 8, textColor: [...WHITE] },
    bodyStyles: { fontSize: 8, textColor: [...DARK] },
    alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 12, halign: "center" } },
  });
  y = lastAutoTableFinalY(doc, y) + 10;

  // Engagement scores
  y = sectionTitle(doc, lang === "nl" ? "Aquilae-engagement" : "Engagement Aquilae", y);
  const alignFields = [
    { key: "satisfaction_aquilae" as const, label: t("field.satisfaction", lang), scoreFn: satisfactionScore, max: 3 },
    { key: "recommend_aquilae" as const, label: t("field.recommend", lang), scoreFn: recommendScore, max: 3 },
    { key: "mission_alignment" as const, label: t("field.mission", lang), scoreFn: alignmentScore, max: 4 },
    { key: "vision_alignment" as const, label: t("field.vision", lang), scoreFn: alignmentScore, max: 4 },
    { key: "values_alignment" as const, label: t("field.values", lang), scoreFn: alignmentScore, max: 4 },
    { key: "participation_charter" as const, label: t("field.charter", lang), scoreFn: alignmentScore, max: 4 },
  ];

  const engRows = alignFields.map(({ key, label, scoreFn, max }) => {
    const scores = data.map((r) => scoreFn(r[key])).filter((v): v is number => v !== null);
    const avgScore = avg(scores);
    const medScore = med(scores);
    return [label, `${avgScore?.toFixed(2) ?? "—"}/${max}`, `${medScore?.toFixed(2) ?? "—"}/${max}`, String(scores.length)];
  });

  autoTable(doc, {
    startY: y,
    head: [["", t("benchmark.mean", lang), t("benchmark.median", lang), "n"]],
    body: engRows,
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], fontSize: 8, textColor: [...WHITE] },
    bodyStyles: { fontSize: 8, textColor: [...DARK] },
    alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 2 },
  });

  addFooter(doc, year, 3, totalPages, lang);

  // ===== PAGE 3 — Groei en strategie =====
  doc.addPage();
  addHeader(doc, year, lang);
  y = 28;

  y = sectionTitle(doc, lang === "nl" ? "Groei en strategie" : "Croissance et stratégie", y);

  // Growth phase frequency (translated/merged)
  const growthFreq = calcFrequencyTranslated(data, "growth_phase", GROWTH_PHASE_MAP, lang);
  if (growthFreq.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.text(lang === "nl" ? "Groeifase" : "Phase de croissance", 15, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [[lang === "nl" ? "Groeifase" : "Phase de croissance", lang === "nl" ? "Aantal" : "Nombre", "%"]],
      body: growthFreq.map((g) => [g.label, String(g.count), `${((g.count / data.length) * 100).toFixed(1)}%`]),
      theme: "grid",
      headStyles: { fillColor: [...PRIMARY], fontSize: 8, textColor: [...WHITE] },
      bodyStyles: { fontSize: 8, textColor: [...DARK] },
      alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
      margin: { left: 15, right: 15 },
      styles: { cellPadding: 2 },
    });
    y = lastAutoTableFinalY(doc, y) + 10;
  }

  // Priorities frequency (translated/merged)
  const priorityFreq = calcFrequencyTranslated(data, "priorities", PRIORITIES_MAP, lang);
  if (priorityFreq.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.text(lang === "nl" ? "Prioriteiten" : "Priorités", 15, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [[lang === "nl" ? "Prioriteit" : "Priorité", lang === "nl" ? "Aantal" : "Nombre", "%"]],
      body: priorityFreq.slice(0, 15).map((p) => [p.label, String(p.count), `${((p.count / data.length) * 100).toFixed(1)}%`]),
      theme: "grid",
      headStyles: { fillColor: [...PRIMARY], fontSize: 8, textColor: [...WHITE] },
      bodyStyles: { fontSize: 8, textColor: [...DARK] },
      alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
      margin: { left: 15, right: 15 },
      styles: { cellPadding: 2 },
    });
    y = lastAutoTableFinalY(doc, y) + 10;
  }


  addFooter(doc, year, 4, totalPages, lang);

  // ===== PAGE 4 — Evolution Trends =====
  doc.addPage();
  addHeader(doc, year, lang);
  y = 28;
  y = sectionTitle(doc, lang === "nl" ? "Evolutie groepsgemiddelden" : "Évolution moyennes de groupe", y);

  const evolutionData = allYears.map((yr) => {
      const yrData = allData
        .filter((r) => r.survey_year === yr)
        .filter((r) => sourceLanguageFilter === "all" || r.source_language === sourceLanguageFilter);
      const yComms = yrData.map((r) => getComputed(r).total_commission).filter((v): v is number => v !== null);
      const yFtes = yrData.map((r) => getComputed(r).total_fte).filter((v): v is number => v !== null);
      const yCommPerFte = yrData.map((r) => getComputed(r).commission_per_fte).filter((v): v is number => v !== null);
      const yPriv = yrData.map((r) => r.pct_private).filter((v): v is number => v !== null);
      const ySme = yrData.map((r) => r.pct_sme).filter((v): v is number => v !== null);

      // Size distribution
      let klein = 0, middel = 0, groot = 0;
      yrData.forEach((r) => {
        const size = getOfficeSize(r);
        if (size === "klein") klein++;
        else if (size === "middelgroot") middel++;
        else if (size === "groot") groot++;
      });

      return {
        year: yr,
        avgComm: avg(yComms),
        avgFte: avg(yFtes),
        avgCommPerFte: avg(yCommPerFte),
        avgPrivate: avg(yPriv),
        avgSme: avg(ySme),
        count: yrData.length,
        klein, middel, groot,
      };
    });

  if (allYears.length >= 2) {
    const chartW = 75;
    const chartH = 45;

    drawMiniLineChart(doc, evolutionData.map((d) => ({ year: d.year, value: d.avgComm, groupValue: null })), {
      x: 25, y, w: chartW, h: chartH,
      title: lang === "nl" ? "Gem. commissie" : "Commission moy.",
      formatFn: (v) => `€${(v / 1000).toFixed(0)}k`,
      color: PRIMARY,
    });

    drawMiniLineChart(doc, evolutionData.map((d) => ({ year: d.year, value: d.avgFte, groupValue: null })), {
      x: 115, y, w: chartW, h: chartH,
      title: lang === "nl" ? "Gem. FTE" : "ETP moyen",
      formatFn: (v) => v.toFixed(1),
      color: [79, 138, 110],
    });

    y += chartH + 20;

    drawMiniLineChart(doc, evolutionData.map((d) => ({ year: d.year, value: d.avgCommPerFte, groupValue: null })), {
      x: 25, y, w: chartW, h: chartH,
      title: lang === "nl" ? "Gem. commissie/FTE" : "Commission moy./ETP",
      formatFn: (v) => `€${(v / 1000).toFixed(0)}k`,
      color: [79, 138, 110],
    });

    drawMiniLineChart(doc, evolutionData.map((d) => ({ year: d.year, value: d.count, groupValue: null })), {
      x: 115, y, w: chartW, h: chartH,
      title: lang === "nl" ? "Aantal deelnemende kantoren" : "Nombre de bureaux participants",
      formatFn: (v) => String(Math.round(v)),
      color: PRIMARY,
    });

    y += chartH + 20;

    // Size distribution (stacked bar)
    const sizeColors = {
      klein: [30, 51, 80] as const,  // blue
      middel: [215, 173, 123] as const, // orange
      groot: [45, 74, 108] as const,  // purple
    };
    drawMiniStackedBar(doc, evolutionData.map((d) => ({
      year: d.year,
      values: [
        { value: d.klein, color: sizeColors.klein, label: lang === "nl" ? "Klein" : "Petit" },
        { value: d.middel, color: sizeColors.middel, label: lang === "nl" ? "Middelgr." : "Moyen" },
        { value: d.groot, color: sizeColors.groot, label: lang === "nl" ? "Groot" : "Grand" },
      ],
    })), {
      x: 25, y, w: chartW, h: chartH,
      title: lang === "nl" ? "Kantoorgroottes" : "Tailles bureaux",
    });

    // Client segment (dual line)
    drawMiniMultiLineChart(doc, evolutionData.map((d) => ({
      year: d.year,
      lines: [
        { value: d.avgPrivate, label: lang === "nl" ? "% Particulieren" : "% Particuliers", color: PRIMARY },
        { value: d.avgSme, label: lang === "nl" ? "% KMO" : "% PME", color: [79, 138, 110] as const },
      ],
    })), {
      x: 115, y, w: chartW, h: chartH,
      title: lang === "nl" ? "Gem. % Part. vs KMO" : "Moy. % Part. vs PME",
      formatFn: (v) => `${v.toFixed(0)}%`,
    });

    y += chartH + 20;

  } else {
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.setFont("helvetica", "italic");
    doc.text(lang === "nl"
      ? "Evolutiedata beschikbaar wanneer meerdere surveyjaren zijn geimporteerd."
      : "Donnees d'evolution disponibles lorsque plusieurs annees d'enquete sont importees.", 15, y);
  }

  addFooter(doc, year, 5, totalPages, lang);

  // ===== PAGE 5 — Company Evolution + Cijfers per jaar =====
  doc.addPage();
  addHeader(doc, year, lang);
  y = 28;
  y = sectionTitle(doc, lang === "nl" ? "Evolutie top maatschappijen" : "Évolution top compagnies", y);

  if (allYears.length >= 2) {
    const COMPANY_COLORS: (readonly [number, number, number])[] = [
      [45, 74, 108], [79, 138, 110], [215, 173, 123], [30, 51, 80], [184, 85, 68],
    ];

    const allFiltered = allData.filter((r) => sourceLanguageFilter === "all" || r.source_language === sourceLanguageFilter);
    const top5NonLife = calcWeightedRanking(allFiltered, "ranking_nonlife").slice(0, 5).map((r) => r.company);

    if (top5NonLife.length > 0) {
      const compEvoNL = allYears.map((yr) => {
        const yrData = allData.filter((r) => r.survey_year === yr).filter((r) => sourceLanguageFilter === "all" || r.source_language === sourceLanguageFilter);
        if (yrData.length === 0) return null;
        const ranking = calcWeightedRanking(yrData, "ranking_nonlife");
        return {
          year: yr,
          lines: top5NonLife.map((c, i) => ({
            value: ranking.find((r) => r.company === c)?.totalPoints ?? 0,
            label: c,
            color: COMPANY_COLORS[i % COMPANY_COLORS.length],
          })),
        };
      }).filter(Boolean) as { year: number; lines: { value: number | null; label: string; color: readonly [number, number, number] }[] }[];

      drawMiniMultiLineChart(doc, compEvoNL, {
        x: 15, y, w: 170, h: 55,
        title: lang === "nl" ? "Top 5 maatschappijen niet-leven (punten)" : "Top 5 compagnies non-vie (points)",
        formatFn: (v) => String(Math.round(v)),
      });

      y += 80;
    }

    const top5Life = calcWeightedRanking(allFiltered, "ranking_life").slice(0, 5).map((r) => r.company);

    if (top5Life.length > 0) {
      const compEvoLife = allYears.map((yr) => {
        const yrData = allData.filter((r) => r.survey_year === yr).filter((r) => sourceLanguageFilter === "all" || r.source_language === sourceLanguageFilter);
        if (yrData.length === 0) return null;
        const ranking = calcWeightedRanking(yrData, "ranking_life");
        return {
          year: yr,
          lines: top5Life.map((c, i) => ({
            value: ranking.find((r) => r.company === c)?.totalPoints ?? 0,
            label: c,
            color: COMPANY_COLORS[i % COMPANY_COLORS.length],
          })),
        };
      }).filter(Boolean) as { year: number; lines: { value: number | null; label: string; color: readonly [number, number, number] }[] }[];

      drawMiniMultiLineChart(doc, compEvoLife, {
        x: 15, y, w: 170, h: 55,
        title: lang === "nl" ? "Top 5 maatschappijen leven (punten)" : "Top 5 compagnies vie (points)",
        formatFn: (v) => String(Math.round(v)),
      });

      y += 80;
    }

    y += 10;
    // Cijfers per jaar table
    y = sectionTitle(doc, lang === "nl" ? "Cijfers per jaar" : "Chiffres par année", y);
    autoTable(doc, {
      startY: y,
      head: [[
        t("filter.year", lang),
        lang === "nl" ? "Kantoren" : "Bureaux",
        lang === "nl" ? "Gem. commissie" : "Commission moy.",
        lang === "nl" ? "Gem. FTE" : "ETP moy.",
        lang === "nl" ? "Gem. comm./FTE" : "Comm. moy./ETP",
        lang === "nl" ? "% Part." : "% Part.",
        lang === "nl" ? "% KMO" : "% PME",
        lang === "nl" ? "K/M/G" : "P/M/G",
      ]],
      body: evolutionData.map((d) => [
        String(d.year),
        String(d.count),
        fmtCur(d.avgComm),
        d.avgFte?.toFixed(1) ?? "—",
        fmtCur(d.avgCommPerFte),
        d.avgPrivate !== null ? `${d.avgPrivate.toFixed(1)}%` : "—",
        d.avgSme !== null ? `${d.avgSme.toFixed(1)}%` : "—",
        `${d.klein}/${d.middel}/${d.groot}`,
      ]),
      theme: "grid",
      headStyles: { fillColor: [...PRIMARY], fontSize: 7, textColor: [...WHITE] },
      bodyStyles: { fontSize: 7, textColor: [...DARK] },
      alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
      margin: { left: 15, right: 15 },
      styles: { cellPadding: 2 },
    });
  }

  addFooter(doc, year, 6, totalPages, lang);
  return doc;
}

// ===== Compare PDF =====
const COMPARE_PDF_COLORS: [number, number, number][] = [
  [45, 74, 108],   // purple
  [79, 138, 110],    // green
  [215, 173, 123],    // orange
  [30, 51, 80],   // blue
  [196, 154, 99],    // yellow
  [138, 139, 137],  // pink
];

export interface CompareInsight {
  icon: string;
  text: string;
  type: "positive" | "negative" | "neutral";
}

export function generateComparePDF(
  selectedRecords: OfficeRecord[],
  allData: OfficeRecord[],
  lang: Language,
  year: number,
  insights: CompareInsight[]
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const totalPages = 3;

  // ===== PAGE 1 — Radar + Detail Table =====
  addHeader(doc, year, lang);
  let y = 28;

  doc.setFontSize(18);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.text(lang === "nl" ? "Vergelijking kantoren" : "Comparaison des bureaux", 15, y);
  y += 8;

  // Office badges
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  let bx = 15;
  selectedRecords.forEach((r, i) => {
    const color = COMPARE_PDF_COLORS[i % COMPARE_PDF_COLORS.length];
    const tw = doc.getTextWidth(r.office_name) + 8;
    doc.setFillColor(...color);
    doc.roundedRect(bx, y - 3.5, tw, 6, 2, 2, "F");
    doc.setTextColor(...WHITE);
    doc.text(r.office_name, bx + 4, y + 0.5);
    bx += tw + 3;
    if (bx > w - 30) { bx = 15; y += 9; }
  });
  y += 12;

  // Radar chart (drawn manually)
  y = sectionTitle(doc, lang === "nl" ? "Radaroverzicht" : "Aperçu radar", y);

  const allComm = allData.filter((r) => r.survey_year === year).map((r) => r.commission_insurance).filter((v): v is number => v !== null);
  const allFte = allData.filter((r) => r.survey_year === year).map((r) => getComputed(r).total_fte).filter((v): v is number => v !== null);
  const allEff = allData.filter((r) => r.survey_year === year).map((r) => getComputed(r).commission_per_fte).filter((v): v is number => v !== null);
  const allSat = allData.filter((r) => r.survey_year === year).map((r) => satisfactionScore(r.satisfaction_aquilae)).filter((v): v is number => v !== null);
  const maxComm = Math.max(...allComm, 1);
  const maxFte = Math.max(...allFte, 1);
  const maxEff = Math.max(...allEff, 1);
  const maxSat = Math.max(...allSat, 1);

  const metrics = [
    { label: t("field.commission_ins", lang), max: maxComm, getValue: (r: OfficeRecord) => r.commission_insurance },
    { label: t("kpi.avg_fte", lang), max: maxFte, getValue: (r: OfficeRecord) => getComputed(r).total_fte },
    { label: t("field.commission_per_fte", lang), max: maxEff, getValue: (r: OfficeRecord) => getComputed(r).commission_per_fte },
    { label: t("field.satisfaction", lang), max: maxSat, getValue: (r: OfficeRecord) => satisfactionScore(r.satisfaction_aquilae) },
  ];

  const cx = w / 2;
  const cy = y + 42;
  const radius = 35;
  const n = metrics.length;

  // Draw radar grid
  for (let ring = 1; ring <= 4; ring++) {
    const r = (ring / 4) * radius;
    doc.setDrawColor(236, 231, 223);
    doc.setLineWidth(0.2);
    for (let i = 0; i < n; i++) {
      const a1 = (Math.PI * 2 * i) / n - Math.PI / 2;
      const a2 = (Math.PI * 2 * ((i + 1) % n)) / n - Math.PI / 2;
      doc.line(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, cx + Math.cos(a2) * r, cy + Math.sin(a2) * r);
    }
  }

  // Draw axes and labels
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    doc.setDrawColor(236, 231, 223);
    doc.setLineWidth(0.15);
    doc.line(cx, cy, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    const lx = cx + Math.cos(angle) * (radius + 8);
    const ly = cy + Math.sin(angle) * (radius + 8);
    doc.setTextColor(...GREY);
    doc.text(metrics[i].label, lx, ly, { align: "center" });
  }

  // Draw data polygons
  selectedRecords.forEach((record, idx) => {
    const color = COMPARE_PDF_COLORS[idx % COMPARE_PDF_COLORS.length];
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const val = metrics[i].getValue(record);
      const pct = val !== null ? Math.min(val / metrics[i].max, 1) : 0;
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      points.push({ x: cx + Math.cos(angle) * pct * radius, y: cy + Math.sin(angle) * pct * radius });
    }
    // Draw polygon outline
    doc.setDrawColor(...color);
    doc.setLineWidth(0.8);
    for (let i = 0; i < points.length; i++) {
      const next = points[(i + 1) % points.length];
      doc.line(points[i].x, points[i].y, next.x, next.y);
    }
    // Draw dots
    doc.setFillColor(...color);
    points.forEach((p) => doc.circle(p.x, p.y, 1, "F"));
  });

  y = cy + radius + 18;

  // Legend for radar
  doc.setFontSize(7);
  let lx = 15;
  selectedRecords.forEach((r, i) => {
    const color = COMPARE_PDF_COLORS[i % COMPARE_PDF_COLORS.length];
    doc.setFillColor(...color);
    doc.rect(lx, y - 2.5, 4, 3, "F");
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    doc.text(r.office_name, lx + 6, y);
    lx += doc.getTextWidth(r.office_name) + 12;
    if (lx > w - 30) { lx = 15; y += 5; }
  });
  y += 10;

  // Detail comparison table
  y = sectionTitle(doc, lang === "nl" ? "Vergelijking — Detail" : "Comparaison — Détail", y);

  const tableHead = ["", ...selectedRecords.map((r) => r.office_name.slice(0, 22))];
  const rows = [
    { label: t("field.commission_ins", lang), fn: (r: OfficeRecord) => fmtCur(r.commission_insurance) },
    { label: t("field.commission_bank", lang), fn: (r: OfficeRecord) => fmtCur(r.commission_bank) },
    { label: t("field.total_commission", lang), fn: (r: OfficeRecord) => fmtCur(getComputed(r).total_commission) },
    { label: t("field.commission_per_fte", lang), fn: (r: OfficeRecord) => fmtCur(getComputed(r).commission_per_fte) },
    { label: t("field.managers", lang), fn: (r: OfficeRecord) => r.num_managers !== null ? String(r.num_managers) : "—" },
    { label: t("field.employees", lang), fn: (r: OfficeRecord) => r.num_employees_fte !== null ? String(r.num_employees_fte) : "—" },
    { label: t("kpi.avg_fte", lang), fn: (r: OfficeRecord) => getComputed(r).total_fte !== null ? String(getComputed(r).total_fte) : "—" },
    { label: t("field.pct_private", lang), fn: (r: OfficeRecord) => r.pct_private !== null ? `${r.pct_private}%` : "—" },
    { label: t("field.pct_sme", lang), fn: (r: OfficeRecord) => r.pct_sme !== null ? `${r.pct_sme}%` : "—" },
    { label: t("field.satisfaction", lang), fn: (r: OfficeRecord) => r.satisfaction_aquilae || "—" },
    { label: t("field.recommend", lang), fn: (r: OfficeRecord) => r.recommend_aquilae || "—" },
  ];

  const tableBody = rows.map((row) => [row.label, ...selectedRecords.map((r) => row.fn(r))]);

  // Color the header columns
  const headColStyles: Record<number, { textColor: number[] }> = {};
  selectedRecords.forEach((_, i) => {
    headColStyles[i + 1] = { textColor: [...COMPARE_PDF_COLORS[i % COMPARE_PDF_COLORS.length]] };
  });

  autoTable(doc, {
    startY: y,
    head: [tableHead],
    body: tableBody,
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], fontSize: 7, textColor: [...WHITE], fontStyle: "bold" },
    bodyStyles: { fontSize: 7, textColor: [...DARK] },
    alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", textColor: [...GREY] } },
  });

  addFooter(doc, year, 2, totalPages, lang);

  // ===== PAGE 2 — Bar chart + Analysis =====
  doc.addPage();
  addHeader(doc, year, lang);
  y = 28;

  // Commission bar chart
  y = sectionTitle(doc, t("field.commission_ins", lang), y);

  const barMaxVal = Math.max(...selectedRecords.map((r) => r.commission_insurance ?? 0), 1);
  const barW = w - 70;

  selectedRecords.forEach((r, i) => {
    const val = r.commission_insurance ?? 0;
    const color = COMPARE_PDF_COLORS[i % COMPARE_PDF_COLORS.length];
    const pct = val / barMaxVal;

    doc.setFontSize(7);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    doc.text(r.office_name.slice(0, 22), 15, y + 3.5);

    doc.setFillColor(...color);
    const bw = Math.max(pct * barW, 2);
    doc.roundedRect(55, y, bw, 5, 1.5, 1.5, "F");

    doc.setFontSize(6.5);
    doc.setTextColor(...DARK);
    doc.text(fmtCur(val), 55 + bw + 2, y + 3.5);
    y += 9;
  });
  y += 8;

  // Efficiency bar chart
  y = sectionTitle(doc, t("field.commission_per_fte", lang), y);
  const effMaxVal = Math.max(...selectedRecords.map((r) => getComputed(r).commission_per_fte ?? 0), 1);

  selectedRecords.forEach((r, i) => {
    const val = getComputed(r).commission_per_fte ?? 0;
    const color = COMPARE_PDF_COLORS[i % COMPARE_PDF_COLORS.length];
    const pct = val / effMaxVal;

    doc.setFontSize(7);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    doc.text(r.office_name.slice(0, 22), 15, y + 3.5);

    doc.setFillColor(...color);
    const bw = Math.max(pct * barW, 2);
    doc.roundedRect(55, y, bw, 5, 1.5, 1.5, "F");

    doc.setFontSize(6.5);
    doc.setTextColor(...DARK);
    doc.text(fmtCur(val), 55 + bw + 2, y + 3.5);
    y += 9;
  });
  y += 8;

  // Analysis insights
  if (insights.length > 0) {
    y = sectionTitle(doc, lang === "nl" ? "Analyse" : "Analyse", y);

    const pageH = doc.internal.pageSize.getHeight();
    const textAreaW = w - 38; // leave space for marker dot

    for (const insight of insights) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      // Strip emoji — jsPDF Helvetica cannot render them
      const lines = doc.splitTextToSize(insight.text, textAreaW);
      const blockH = lines.length * 4.2 + 4;

      if (y + blockH > pageH - 25) {
        doc.addPage();
        addHeader(doc, year, lang);
        y = 28;
        y = sectionTitle(doc, lang === "nl" ? "Analyse (vervolg)" : "Analyse (suite)", y);
      }

      // Background
      let bgColor: [number, number, number];
      let dotColor: [number, number, number];
      if (insight.type === "positive") {
        bgColor = [207, 225, 214];
        dotColor = [79, 138, 110];
      } else if (insight.type === "negative") {
        bgColor = [247, 238, 223];
        dotColor = [215, 173, 123];
      } else {
        bgColor = [248, 247, 243];
        dotColor = [138, 139, 137];
      }

      doc.setFillColor(...bgColor);
      doc.roundedRect(14, y - 3, w - 28, blockH, 1.5, 1.5, "F");

      // Colored marker dot instead of emoji
      doc.setFillColor(...dotColor);
      doc.circle(18, y + 1, 1.4, "F");

      // Text
      doc.setTextColor(...DARK);
      doc.text(lines, 22, y);
      y += blockH + 2;
    }
  }

  addFooter(doc, year, 3, totalPages, lang);
  return doc;
}
