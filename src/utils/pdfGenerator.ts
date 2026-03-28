import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { OfficeRecord } from "@/types/barometer";
import type { Language } from "@/i18n/translations";
import { t } from "@/i18n/translations";
import {
  getComputed, calcBenchmark, calcWeightedRanking,
  formatCurrency, satisfactionScore, recommendScore, alignmentScore,
  calcFrequency, getOfficeSize, getOfficeSizeLabel, filterByYear, filterBySourceLang
} from "@/utils/benchmarkCalc";
import { calcFrequencyTranslated, GROWTH_PHASE_MAP, PRIORITIES_MAP } from "@/utils/termMappings";

const PRIMARY = [121, 97, 171] as const; // #7961AB
const PRIMARY_LIGHT = [237, 232, 245] as const;
const DARK = [45, 45, 63] as const;
const GREY = [102, 102, 119] as const;
const WHITE = [255, 255, 255] as const;

type DocWithLastAutoTable = jsPDF & { lastAutoTable?: { finalY?: number } };

function lastAutoTableFinalY(doc: jsPDF, fallbackY: number): number {
  return (doc as DocWithLastAutoTable).lastAutoTable?.finalY ?? fallbackY;
}

function fmtCur(v: number | null): string {
  if (v === null) return "—";
  return "\u20AC" + Math.round(v).toLocaleString("de-DE");
}

function addHeader(doc: jsPDF, officeName: string, pageNum: number) {
  const w = doc.internal.pageSize.getWidth();
  // Purple top bar
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, w, 14, "F");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.text("AQUILAE BAROMETER", 15, 9);
  doc.setFont("helvetica", "normal");
  doc.text(officeName, w - 15, 9, { align: "right" });
}

function addFooter(doc: jsPDF, year: number, pageNum: number, totalPages: number, lang: Language) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...PRIMARY_LIGHT);
  doc.line(15, h - 15, w - 15, h - 15);
  doc.setFontSize(7);
  doc.setTextColor(...GREY);
  doc.text(`${t("filter.year", lang)}: ${year}`, 15, h - 9);
  doc.text(`${pageNum} / ${totalPages}`, w / 2, h - 9, { align: "center" });
  doc.text(new Date().toLocaleDateString(lang === "fr" ? "fr-BE" : "nl-BE"), w - 15, h - 9, { align: "right" });
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text(title, 15, y);
  const titleWidth = doc.getTextWidth(title);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(15, y + 2, 15 + titleWidth, y + 2);
  return y + 10;
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
  allYearsData?: OfficeRecord[]
): jsPDF {
  // Use the office's own language for the PDF content
  const officeLang: Language = (office.source_language === "fr" ? "fr" : "nl");
  lang = officeLang;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const computed = getComputed(office);
  const year = office.survey_year;
  const totalPages = 6;

  // ===== PAGE 1 — Office Profile =====
  addHeader(doc, office.office_name, 1);
  let y = 28;

  doc.setFontSize(20);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.text(office.office_name, 15, y);
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
    const avgManagers = (() => { const v = allData.map(r => r.num_managers).filter((v): v is number => v !== null); return v.length ? v.reduce((a,b) => a+b, 0) / v.length : null; })();
    const avgEmployees = (() => { const v = allData.map(r => r.num_employees_fte).filter((v): v is number => v !== null); return v.length ? v.reduce((a,b) => a+b, 0) / v.length : null; })();
    const avgFte = (() => { const v = allData.map(r => getComputed(r).total_fte).filter((v): v is number => v !== null); return v.length ? v.reduce((a,b) => a+b, 0) / v.length : null; })();
    const avgCommPerFte = (() => { const v = allData.map(r => getComputed(r).commission_per_fte).filter((v): v is number => v !== null); return v.length ? v.reduce((a,b) => a+b, 0) / v.length : null; })();

    const persRows = [
      { label: t("field.managers", lang), value: office.num_managers, groupAvg: avgManagers, fmt: (v: number | null) => v !== null ? v.toFixed(2) : "—" },
      { label: t("field.employees", lang), value: office.num_employees_fte, groupAvg: avgEmployees, fmt: (v: number | null) => v !== null ? v.toFixed(2) : "—" },
      { label: "Total FTE", value: computed.total_fte, groupAvg: avgFte, fmt: (v: number | null) => v !== null ? v.toFixed(2) : "—" },
      { label: t("field.commission_per_fte", lang), value: computed.commission_per_fte, groupAvg: avgCommPerFte, fmt: (v: number | null) => fmtCur(v) },
    ];

    const officeLabel = lang === "nl" ? "Kantoor" : "Bureau";
    const groupLabel = lang === "nl" ? "Groepsgemiddelde" : "Moyenne groupe";
    const diffLabel = lang === "nl" ? "Verschil" : "Différence";

    autoTable(doc, {
      startY: y,
      head: [["", officeLabel, groupLabel, diffLabel]],
      body: persRows.map(({ label, value, groupAvg, fmt }) => {
        const diff = value !== null && groupAvg !== null ? value - groupAvg : null;
        const diffStr = diff !== null ? `${diff >= 0 ? "+" : ""}${fmt(diff)}` : "—";
        return [label, fmt(value), groupAvg !== null ? fmt(groupAvg) : "—", diffStr];
      }),
      theme: "grid",
      headStyles: { fillColor: [...PRIMARY], fontSize: 8, fontStyle: "bold", textColor: [...WHITE] },
      bodyStyles: { fontSize: 8, textColor: [...DARK] },
      alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
      margin: { left: 15, right: 15 },
      styles: { cellPadding: 2 },
    });
    y = lastAutoTableFinalY(doc, y) + 8;
  }

  y = sectionTitle(doc, t("field.activities", lang), y);
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "normal");
  doc.text(office.activities.join(", "), 15, y);

  addFooter(doc, year, 1, totalPages, lang);

  // ===== PAGE 2 — Financial Benchmark =====
  doc.addPage();
  addHeader(doc, office.office_name, 2);
  y = 28;
  y = sectionTitle(doc, t("office.financial_benchmark", lang), y);

  const benchRows = [
    { label: t("field.commission_ins", lang), value: office.commission_insurance, allVals: allData.map((r) => r.commission_insurance) },
    { label: t("field.commission_bank", lang), value: office.commission_bank, allVals: allData.map((r) => r.commission_bank) },
    { label: t("field.total_commission", lang), value: computed.total_commission, allVals: allData.map((r) => getComputed(r).total_commission) },
    { label: t("field.commission_per_fte", lang), value: computed.commission_per_fte, allVals: allData.map((r) => getComputed(r).commission_per_fte) },
  ];

  const tableBody = benchRows.map((row) => {
    const bm = calcBenchmark(row.allVals, row.value);
    return [
      row.label,
      fmtCur(row.value),
      fmtCur(bm.mean),
      fmtCur(bm.median),
      bm.percentile !== null ? `P${bm.percentile}` : "—",
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [[
      "", t("office.value", lang), t("benchmark.mean", lang),
      t("benchmark.median", lang), t("benchmark.percentile", lang)
    ]],
    body: tableBody,
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], fontSize: 8, fontStyle: "bold", textColor: [...WHITE] },
    bodyStyles: { fontSize: 8, textColor: [...DARK] },
    alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 2 },
  });

  y = lastAutoTableFinalY(doc, y) + 10;

  // Portfolio distribution - styled like app with bars + group marker
  y = sectionTitle(doc, `${t("field.pct_private", lang)} / ${t("field.pct_sme", lang)}`, y);
  {
    const allPctPrivate = allData.map((r) => r.pct_private).filter((v): v is number => v !== null);
    const avgPrivate = allPctPrivate.length > 0 ? allPctPrivate.reduce((s, v) => s + v, 0) / allPctPrivate.length : null;
    const allPctSme = allData.map((r) => r.pct_sme).filter((v): v is number => v !== null);
    const avgSme = allPctSme.length > 0 ? allPctSme.reduce((s, v) => s + v, 0) / allPctSme.length : null;
    const barMaxW = w - 60;

    const drawPortfolioBar = (label: string, officeVal: number | null, groupAvg: number | null, yPos: number): number => {
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.text(label, 15, yPos);
      doc.setFont("helvetica", "normal");
      if (officeVal !== null) {
        doc.text(`${officeVal}%`, w - 40, yPos, { align: "right" });
      }
      yPos += 3;
      // Background bar
      doc.setFillColor(235, 235, 240);
      doc.roundedRect(15, yPos, barMaxW, 5, 1.5, 1.5, "F");
      // Office bar
      if (officeVal !== null && officeVal > 0) {
        doc.setFillColor(...PRIMARY);
        doc.roundedRect(15, yPos, Math.max((officeVal / 100) * barMaxW, 2), 5, 1.5, 1.5, "F");
      }
      // Group average marker line
      if (groupAvg !== null) {
        const markerX = 15 + (groupAvg / 100) * barMaxW;
        doc.setDrawColor(80, 80, 90);
        doc.setLineWidth(0.6);
        doc.line(markerX, yPos - 0.5, markerX, yPos + 5.5);
      }
      yPos += 7;
      // Legend
      doc.setFontSize(6);
      doc.setTextColor(...GREY);
      doc.setFillColor(...PRIMARY);
      doc.rect(15, yPos, 4, 2, "F");
      doc.text(lang === "nl" ? "Kantoor" : "Bureau", 21, yPos + 1.5);
      if (groupAvg !== null) {
        doc.setDrawColor(80, 80, 90);
        doc.setLineWidth(0.6);
        doc.line(50, yPos, 50, yPos + 2);
        doc.text(`${lang === "nl" ? "Groepsgemiddelde" : "Moyenne groupe"} (${Math.round(groupAvg * 10) / 10}%)`, 53, yPos + 1.5);
      }
      return yPos + 6;
    };

    y = drawPortfolioBar(t("field.pct_private", lang), office.pct_private, avgPrivate, y);
    y = drawPortfolioBar(t("field.pct_sme", lang), office.pct_sme, avgSme, y);
  }

  y += 6;

  // Life / BOAR distribution
  y = sectionTitle(doc, `${t("field.pct_life", lang)} / ${t("field.pct_nonlife", lang)}`, y);
  {
    const allPctLife = allData.map((r) => r.pct_life).filter((v): v is number => v !== null);
    const avgLife = allPctLife.length > 0 ? allPctLife.reduce((s, v) => s + v, 0) / allPctLife.length : null;
    const allPctNonlife = allData.map((r) => r.pct_nonlife).filter((v): v is number => v !== null);
    const avgNonlife = allPctNonlife.length > 0 ? allPctNonlife.reduce((s, v) => s + v, 0) / allPctNonlife.length : null;
    const barMaxW = w - 60;

    const drawBar = (label: string, officeVal: number | null, groupAvg: number | null, yPos: number): number => {
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.text(label, 15, yPos);
      doc.setFont("helvetica", "normal");
      if (officeVal !== null) {
        doc.text(`${officeVal}%`, w - 40, yPos, { align: "right" });
      }
      yPos += 3;
      doc.setFillColor(235, 235, 240);
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
      yPos += 7;
      doc.setFontSize(6);
      doc.setTextColor(...GREY);
      doc.setFillColor(...PRIMARY);
      doc.rect(15, yPos, 4, 2, "F");
      doc.text(lang === "nl" ? "Kantoor" : "Bureau", 21, yPos + 1.5);
      if (groupAvg !== null) {
        doc.setDrawColor(80, 80, 90);
        doc.setLineWidth(0.6);
        doc.line(50, yPos, 50, yPos + 2);
        doc.text(`${lang === "nl" ? "Groepsgemiddelde" : "Moyenne groupe"} (${Math.round(groupAvg * 10) / 10}%)`, 53, yPos + 1.5);
      }
      return yPos + 6;
    };

    y = drawBar(t("field.pct_nonlife", lang), office.pct_nonlife, avgNonlife, y);
    y = drawBar(t("field.pct_life", lang), office.pct_life, avgLife, y);
  }

  addFooter(doc, year, 2, totalPages, lang);

  // ===== PAGE 3 — Companies & Strategy =====
  doc.addPage();
  addHeader(doc, office.office_name, 3);
  y = 28;

  // Companies - styled like app with numbered list and group position badges
  const groupNonLife = calcWeightedRanking(allData, "ranking_nonlife").slice(0, 10);
  const groupLife = calcWeightedRanking(allData, "ranking_life").slice(0, 10);

  const drawCompanyList = (title: string, officeList: string[], groupRanking: ReturnType<typeof calcWeightedRanking>, yPos: number): number => {
    yPos = sectionTitle(doc, title, yPos);
    for (let i = 0; i < Math.min(officeList.length, 5); i++) {
      const company = officeList[i];
      const groupEntry = groupRanking.find((g) => g.company === company);
      const groupPos = groupEntry?.rank;
      const inGroupTop5 = groupPos !== undefined && groupPos <= 5;

      // Number circle
      if (i < 3) {
        doc.setFillColor(...PRIMARY_LIGHT);
      } else {
        doc.setFillColor(235, 235, 240);
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
          doc.setFillColor(235, 235, 240);
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

  addFooter(doc, year, 3, totalPages, lang);

  // ===== PAGE 4 — Aquilae Engagement =====
  doc.addPage();
  addHeader(doc, office.office_name, 4);
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

  addFooter(doc, year, 4, totalPages, lang);

  // ===== PAGE 5 — Evolution =====
  doc.addPage();
  addHeader(doc, office.office_name, 5);
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
        r.satisfaction_aquilae || "—",
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [[t("filter.year", lang), t("field.commission_ins", lang), "FTE", t("field.commission_per_fte", lang), t("field.satisfaction", lang)]],
      body: evoBody,
      theme: "grid",
      headStyles: { fillColor: [...PRIMARY], fontSize: 8, textColor: [...WHITE] },
      bodyStyles: { fontSize: 8, textColor: [...DARK] },
      alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
      margin: { left: 15, right: 15 },
      styles: { cellPadding: 2 },
    });
    y = lastAutoTableFinalY(doc, y) + 12;

    // Prepare chart data
    const chartYears = officeAllYears.map((r) => r.survey_year);
    const chartComm = officeAllYears.map((r) => getComputed(r).total_commission);
    const chartFte = officeAllYears.map((r) => getComputed(r).total_fte);
    const chartSat = officeAllYears.map((r) => satisfactionScore(r.satisfaction_aquilae));

    // Also compute group means per year for comparison
    const allYearsSet = [...new Set((allYearsData || []).map((r) => r.survey_year))].sort();
    const groupCommByYear: Record<number, number[]> = {};
    const groupFteByYear: Record<number, number[]> = {};
    const groupSatByYear: Record<number, number[]> = {};
    for (const r of (allYearsData || [])) {
      const c = getComputed(r);
      if (!groupCommByYear[r.survey_year]) { groupCommByYear[r.survey_year] = []; groupFteByYear[r.survey_year] = []; groupSatByYear[r.survey_year] = []; }
      if (c.total_commission !== null) groupCommByYear[r.survey_year].push(c.total_commission);
      if (c.total_fte !== null) groupFteByYear[r.survey_year].push(c.total_fte);
      const s = satisfactionScore(r.satisfaction_aquilae);
      if (s !== null) groupSatByYear[r.survey_year].push(s);
    }
    const avgArr = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const groupCommMeans = chartYears.map((yr) => avgArr(groupCommByYear[yr] || []));
    const groupFteMeans = chartYears.map((yr) => avgArr(groupFteByYear[yr] || []));
    const groupSatMeans = chartYears.map((yr) => avgArr(groupSatByYear[yr] || []));

    const chartW = 80;
    const chartH = 40;

    // Draw 3 mini charts in a row
    const charts: { title: string; officeVals: (number | null)[]; groupVals: (number | null)[]; formatFn: (v: number) => string; maxOverride?: number }[] = [
      { title: t("field.total_commission", lang), officeVals: chartComm, groupVals: groupCommMeans, formatFn: (v) => `€${(v / 1000).toFixed(0)}k` },
      { title: "FTE", officeVals: chartFte, groupVals: groupFteMeans, formatFn: (v) => v.toFixed(1) },
      { title: t("field.satisfaction", lang), officeVals: chartSat, groupVals: groupSatMeans, formatFn: (v) => v.toFixed(1), maxOverride: 3 },
    ];

    // Two charts per row
    for (let ci = 0; ci < charts.length; ci++) {
      const chart = charts[ci];
      const col = ci % 2;
      const xOff = 15 + col * (chartW + 15);

      if (ci === 2) y += chartH + 22;

      const chartY = col === 0 && ci < 2 ? y : y;

      // Title
      doc.setFontSize(8);
      doc.setTextColor(...PRIMARY);
      doc.setFont("helvetica", "bold");
      doc.text(chart.title, xOff, chartY);

      const areaX = xOff;
      const areaY = chartY + 3;

      // Axes
      doc.setDrawColor(200, 200, 210);
      doc.setLineWidth(0.3);
      doc.line(areaX, areaY, areaX, areaY + chartH); // Y axis
      doc.line(areaX, areaY + chartH, areaX + chartW, areaY + chartH); // X axis

      // Combine all values for scale
      const allVals = [...chart.officeVals, ...chart.groupVals].filter((v): v is number => v !== null);
      if (allVals.length === 0) continue;
      const minVal = chart.maxOverride !== undefined ? 0 : Math.min(...allVals) * 0.85;
      const maxVal = chart.maxOverride !== undefined ? chart.maxOverride : Math.max(...allVals) * 1.1;
      const range = maxVal - minVal || 1;

      const toX = (i: number) => areaX + (i / Math.max(chartYears.length - 1, 1)) * chartW;
      const toY = (v: number) => areaY + chartH - ((v - minVal) / range) * chartH;

      // Y-axis labels
      doc.setFontSize(5.5);
      doc.setTextColor(...GREY);
      doc.setFont("helvetica", "normal");
      doc.text(chart.formatFn(maxVal), areaX - 1, areaY + 2, { align: "right" });
      doc.text(chart.formatFn(minVal), areaX - 1, areaY + chartH, { align: "right" });

      // X-axis labels
      for (let i = 0; i < chartYears.length; i++) {
        doc.text(String(chartYears[i]), toX(i), areaY + chartH + 4, { align: "center" });
      }

      // Draw group line (dashed)
      const groupPts = chart.groupVals.map((v, i) => v !== null ? { x: toX(i), y: toY(v) } : null).filter(Boolean) as { x: number; y: number }[];
      if (groupPts.length > 1) {
        doc.setDrawColor(...PRIMARY_LIGHT);
        doc.setLineWidth(0.6);
        doc.setLineDashPattern([1.5, 1.5], 0);
        for (let i = 1; i < groupPts.length; i++) {
          doc.line(groupPts[i - 1].x, groupPts[i - 1].y, groupPts[i].x, groupPts[i].y);
        }
        doc.setLineDashPattern([], 0);
      }

      // Draw office line (solid)
      const officePts = chart.officeVals.map((v, i) => v !== null ? { x: toX(i), y: toY(v) } : null).filter(Boolean) as { x: number; y: number }[];
      if (officePts.length > 1) {
        doc.setDrawColor(...PRIMARY);
        doc.setLineWidth(0.8);
        for (let i = 1; i < officePts.length; i++) {
          doc.line(officePts[i - 1].x, officePts[i - 1].y, officePts[i].x, officePts[i].y);
        }
        // Dots
        doc.setFillColor(...PRIMARY);
        for (const pt of officePts) {
          doc.circle(pt.x, pt.y, 1, "F");
        }
      }

      // Data value labels on office dots
      doc.setFontSize(5);
      doc.setTextColor(...DARK);
      for (let i = 0; i < chart.officeVals.length; i++) {
        const v = chart.officeVals[i];
        if (v !== null) {
          doc.text(chart.formatFn(v), toX(i), toY(v) - 2.5, { align: "center" });
        }
      }
    }

    y += chartH + 22;

    // Legend
    doc.setFontSize(6);
    doc.setDrawColor(...PRIMARY);
    doc.setLineWidth(0.8);
    doc.line(15, y, 22, y);
    doc.setFillColor(...PRIMARY);
    doc.circle(18.5, y, 0.8, "F");
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    doc.text(t("benchmark.office", lang), 24, y + 1);

    doc.setDrawColor(...PRIMARY_LIGHT);
    doc.setLineWidth(0.6);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(55, y, 62, y);
    doc.setLineDashPattern([], 0);
    doc.setTextColor(...GREY);
    doc.text(t("benchmark.group", lang) + " " + t("benchmark.mean", lang).toLowerCase(), 64, y + 1);

  } else {
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.setFont("helvetica", "italic");
    doc.text(lang === "nl"
      ? "Evolutiedata beschikbaar wanneer meerdere surveyjaren zijn geimporteerd."
      : "Donnees d'evolution disponibles lorsque plusieurs annees d'enquete sont importees.", 15, y);
  }

  addFooter(doc, year, 5, totalPages, lang);

  // ===== PAGE 6 — Analysis Summary =====
  doc.addPage();
  addHeader(doc, office.office_name, 6);
  y = 28;
  y = sectionTitle(doc, t("office.analysis", lang), y);

  const analysisInsights = generateAnalysisInsights(office, allData, computed, lang);

  if (analysisInsights.length > 0) {
    for (const insight of analysisInsights) {
      // Icon indicator (vector shape instead of emoji)
      const isPositive = insight.type === "positive";
      const isNegative = insight.type === "negative";
      const indicatorColor: readonly [number, number, number] = isPositive ? [34, 139, 34] : isNegative ? [220, 120, 20] : [...GREY];

      doc.setFillColor(indicatorColor[0], indicatorColor[1], indicatorColor[2]);
      doc.circle(19, y + 1, 1.5, "F");

      // Text
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(insight.text, w - 40);
      doc.text(lines, 25, y + 2);
      y += lines.length * 4 + 5;

      if (y > 270) break; // Safety: don't overflow page
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.setFont("helvetica", "italic");
    doc.text(lang === "nl" ? "Onvoldoende data voor analyse." : "Données insuffisantes pour l'analyse.", 15, y);
  }

  addFooter(doc, year, 6, totalPages, lang);

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
  doc.setDrawColor(200, 200, 210);
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

export function generateGroupPDF(
  allData: OfficeRecord[],
  lang: Language,
  year: number,
  sourceLanguageFilter: "nl" | "fr" | "all"
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const totalPages = 4;

  // Filter data for selected year
  const data = allData
    .filter((r) => r.survey_year === year)
    .filter((r) => sourceLanguageFilter === "all" || r.source_language === sourceLanguageFilter);

  // Get all years for evolution
  const allYears = [...new Set(allData.map((r) => r.survey_year))].sort();

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const med = (arr: number[]) => {
    if (arr.length === 0) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  // ===== PAGE 1 — Overview & KPIs =====
  addHeader(doc, "Groepsrapport", 1);
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
      return [String(i + 1), r.office_name, fmtCur(r.commission_insurance), c.total_fte?.toFixed(1) ?? "—", fmtCur(c.commission_per_fte)];
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
      return [String(i + 1), r.office_name, fmtCur(r.eff), fmtCur(c.total_commission)];
    }),
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], fontSize: 8, textColor: [...WHITE] },
    bodyStyles: { fontSize: 8, textColor: [...DARK] },
    alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 10 } },
  });

  addFooter(doc, year, 1, totalPages, lang);

  // ===== PAGE 2 — Companies & Engagement =====
  doc.addPage();
  addHeader(doc, "Groepsrapport", 2);
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

  addFooter(doc, year, 2, totalPages, lang);

  // ===== PAGE 3 — Groei en strategie =====
  doc.addPage();
  addHeader(doc, "Groepsrapport", 3);
  y = 28;

  y = sectionTitle(doc, lang === "nl" ? "Groei en strategie" : "Croissance et stratégie", y);

  // Growth phase frequency
  const growthFreq = calcFrequency(data, "growth_phase");
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

  // Priorities frequency
  const priorityFreq = calcFrequency(data, "priorities");
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


  addFooter(doc, year, 3, totalPages, lang);

  // ===== PAGE 4 — Evolution Trends =====
  doc.addPage();
  addHeader(doc, "Groepsrapport", 4);
  y = 28;
  y = sectionTitle(doc, lang === "nl" ? "Evolutie groepsgemiddelden" : "Évolution moyennes de groupe", y);

  if (allYears.length >= 2) {
    const evolutionData = allYears.map((yr) => {
      const yrData = allData
        .filter((r) => r.survey_year === yr)
        .filter((r) => sourceLanguageFilter === "all" || r.source_language === sourceLanguageFilter);
      const yComms = yrData.map((r) => getComputed(r).total_commission).filter((v): v is number => v !== null);
      const yFtes = yrData.map((r) => getComputed(r).total_fte).filter((v): v is number => v !== null);
      const ySats = yrData.map((r) => satisfactionScore(r.satisfaction_aquilae)).filter((v): v is number => v !== null);
      return {
        year: yr,
        avgComm: avg(yComms),
        avgFte: avg(yFtes),
        avgSat: avg(ySats),
        count: yrData.length,
      };
    });

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
      color: [76, 175, 80],
    });

    y += chartH + 20;

    drawMiniLineChart(doc, evolutionData.map((d) => ({ year: d.year, value: d.avgSat, groupValue: null })), {
      x: 25, y, w: chartW, h: chartH,
      title: lang === "nl" ? "Gem. tevredenheid" : "Satisfaction moy.",
      formatFn: (v) => v.toFixed(2),
      color: [245, 166, 35],
      maxOverride: 3,
    });

    drawMiniLineChart(doc, evolutionData.map((d) => ({ year: d.year, value: d.count, groupValue: null })), {
      x: 115, y, w: chartW, h: chartH,
      title: lang === "nl" ? "Aantal kantoren" : "Nombre de bureaux",
      formatFn: (v) => String(Math.round(v)),
      color: PRIMARY,
    });

    y += chartH + 16;

    // Evolution data table
    y = sectionTitle(doc, lang === "nl" ? "Cijfers per jaar" : "Chiffres par année", y);
    autoTable(doc, {
      startY: y,
      head: [[t("filter.year", lang), lang === "nl" ? "Kantoren" : "Bureaux", lang === "nl" ? "Gem. commissie" : "Commission moy.", lang === "nl" ? "Gem. FTE" : "ETP moy.", lang === "nl" ? "Gem. tevredenheid" : "Satisfaction moy."]],
      body: evolutionData.map((d) => [
        String(d.year),
        String(d.count),
        fmtCur(d.avgComm),
        d.avgFte?.toFixed(1) ?? "—",
        d.avgSat !== null ? `${d.avgSat.toFixed(2)}/3` : "—",
      ]),
      theme: "grid",
      headStyles: { fillColor: [...PRIMARY], fontSize: 8, textColor: [...WHITE] },
      bodyStyles: { fontSize: 8, textColor: [...DARK] },
      alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
      margin: { left: 15, right: 15 },
      styles: { cellPadding: 2 },
    });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.setFont("helvetica", "italic");
    doc.text(lang === "nl"
      ? "Evolutiedata beschikbaar wanneer meerdere surveyjaren zijn geimporteerd."
      : "Donnees d'evolution disponibles lorsque plusieurs annees d'enquete sont importees.", 15, y);
  }

  addFooter(doc, year, 4, totalPages, lang);
  return doc;
}

// ===== Compare PDF =====
const COMPARE_PDF_COLORS: [number, number, number][] = [
  [121, 97, 171],   // purple
  [76, 175, 80],    // green
  [255, 87, 34],    // orange
  [33, 150, 243],   // blue
  [255, 193, 7],    // yellow
  [186, 104, 200],  // pink
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
  const totalPages = 2;

  // ===== PAGE 1 — Radar + Detail Table =====
  addHeader(doc, lang === "nl" ? "Vergelijking" : "Comparaison", 1);
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
    doc.setDrawColor(220, 220, 230);
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
    doc.setDrawColor(200, 200, 210);
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

  addFooter(doc, year, 1, totalPages, lang);

  // ===== PAGE 2 — Bar chart + Analysis =====
  doc.addPage();
  addHeader(doc, lang === "nl" ? "Vergelijking" : "Comparaison", 2);
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
        addHeader(doc, lang === "nl" ? "Vergelijking" : "Comparaison", 3);
        y = 28;
        y = sectionTitle(doc, lang === "nl" ? "Analyse (vervolg)" : "Analyse (suite)", y);
      }

      // Background
      let bgColor: [number, number, number];
      let dotColor: [number, number, number];
      if (insight.type === "positive") {
        bgColor = [232, 245, 233];
        dotColor = [56, 142, 60];
      } else if (insight.type === "negative") {
        bgColor = [255, 243, 224];
        dotColor = [230, 126, 34];
      } else {
        bgColor = [245, 245, 250];
        dotColor = [120, 120, 150];
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

  addFooter(doc, year, 2, totalPages, lang);
  return doc;
}
