import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { OfficeRecord } from "@/types/barometer";
import type { Language } from "@/i18n/translations";
import { t } from "@/i18n/translations";
import {
  getComputed, calcBenchmark, calcWeightedRanking,
  formatCurrency, satisfactionScore, recommendScore, alignmentScore,
  calcFrequency
} from "@/utils/benchmarkCalc";

const PRIMARY = [121, 97, 171] as const; // #7961AB
const PRIMARY_LIGHT = [237, 232, 245] as const;
const DARK = [45, 45, 63] as const;
const GREY = [102, 102, 119] as const;
const WHITE = [255, 255, 255] as const;

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
  doc.text(new Date().toLocaleDateString("nl-BE"), w - 15, h - 9, { align: "right" });
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text(title, 15, y);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(15, y + 2, 80, y + 2);
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

export function generateOfficePDF(
  office: OfficeRecord,
  allData: OfficeRecord[],
  lang: Language,
  allYearsData?: OfficeRecord[]
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const computed = getComputed(office);
  const year = office.survey_year;
  const totalPages = 5;

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
  const badges = [
    office.source_language.toUpperCase(),
    String(year),
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
  y = labelValue(doc, t("field.managers", lang), String(office.num_managers ?? "—"), 15, y);
  y = labelValue(doc, t("field.employees", lang), String(office.num_employees_fte ?? "—"), 15, y);
  y = labelValue(doc, "Total FTE", computed.total_fte !== null ? computed.total_fte.toFixed(1) : "—", 15, y);
  y += 6;

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
      bm.quartile !== null ? `Q${bm.quartile}` : "—",
    ];
  });

  doc.autoTable({
    startY: y,
    head: [[
      "", t("office.value", lang), t("benchmark.mean", lang),
      t("benchmark.median", lang), t("benchmark.percentile", lang), t("benchmark.quartile", lang)
    ]],
    body: tableBody,
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], fontSize: 8, fontStyle: "bold", textColor: [...WHITE] },
    bodyStyles: { fontSize: 8, textColor: [...DARK] },
    alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 2 },
  });

  y = doc.lastAutoTable.finalY + 10;

  // Ratio comparison
  y = sectionTitle(doc, `${t("field.pct_private", lang)} / ${t("field.pct_sme", lang)}`, y);
  const allPctPrivate = allData.map((r) => r.pct_private).filter((v): v is number => v !== null);
  const groupAvgPrivate = allPctPrivate.length > 0 ? allPctPrivate.reduce((s, v) => s + v, 0) / allPctPrivate.length : null;

  if (office.pct_private !== null) {
    // Office bar
    doc.setFillColor(...PRIMARY);
    const barW = (office.pct_private / 100) * (w - 80);
    doc.roundedRect(15, y, barW, 6, 1, 1, "F");
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text(`${office.pct_private}%`, 17, y + 4.5);
    doc.setTextColor(...DARK);
    doc.text(t("benchmark.office", lang), w - 60, y + 4.5);
    y += 10;

    // Group bar
    if (groupAvgPrivate !== null) {
      doc.setFillColor(...PRIMARY_LIGHT);
      const gBarW = (groupAvgPrivate / 100) * (w - 80);
      doc.roundedRect(15, y, gBarW, 6, 1, 1, "F");
      doc.setFontSize(7);
      doc.setTextColor(...PRIMARY);
      doc.text(`${Math.round(groupAvgPrivate)}%`, 17, y + 4.5);
      doc.setTextColor(...GREY);
      doc.text(t("benchmark.group", lang), w - 60, y + 4.5);
    }
  }

  y += 16;

  // Life/Non-life ratio
  y = sectionTitle(doc, `${t("field.pct_life", lang)} / ${t("field.pct_nonlife", lang)}`, y);
  const allPctLife = allData.map((r) => r.pct_life).filter((v): v is number => v !== null);
  const groupAvgLife = allPctLife.length > 0 ? allPctLife.reduce((s, v) => s + v, 0) / allPctLife.length : null;

  if (office.pct_life !== null) {
    doc.setFillColor(...PRIMARY);
    const barW = (office.pct_life / 100) * (w - 80);
    doc.roundedRect(15, y, Math.max(barW, 2), 6, 1, 1, "F");
    doc.setFontSize(7);
    doc.setTextColor(office.pct_life > 10 ? 255 : 45, office.pct_life > 10 ? 255 : 45, office.pct_life > 10 ? 255 : 63);
    doc.text(`${office.pct_life}%`, 17, y + 4.5);
    doc.setTextColor(...DARK);
    doc.text(t("benchmark.office", lang), w - 60, y + 4.5);
    y += 10;

    if (groupAvgLife !== null) {
      doc.setFillColor(...PRIMARY_LIGHT);
      const gBarW = (groupAvgLife / 100) * (w - 80);
      doc.roundedRect(15, y, Math.max(gBarW, 2), 6, 1, 1, "F");
      doc.setFontSize(7);
      doc.setTextColor(...PRIMARY);
      doc.text(`${Math.round(groupAvgLife)}%`, 17, y + 4.5);
      doc.setTextColor(...GREY);
      doc.text(t("benchmark.group", lang), w - 60, y + 4.5);
    }
  }

  addFooter(doc, year, 2, totalPages, lang);

  // ===== PAGE 3 — Companies & Strategy =====
  doc.addPage();
  addHeader(doc, office.office_name, 3);
  y = 28;

  // Non-life ranking
  const groupNonLife = calcWeightedRanking(allData, "ranking_nonlife").slice(0, 5);
  y = sectionTitle(doc, t("field.companies_nonlife", lang), y);

  const nlBody = office.ranking_nonlife.slice(0, 5).map((c, i) => {
    const groupEntry = groupNonLife.find((g) => g.company === c);
    return [String(i + 1), c, groupEntry ? `#${groupEntry.rank} (${groupEntry.totalPoints} pts)` : "—"];
  });

  doc.autoTable({
    startY: y,
    head: [["#", t("benchmark.office", lang), t("benchmark.group", lang) + " ranking"]],
    body: nlBody,
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], fontSize: 8, textColor: [...WHITE] },
    bodyStyles: { fontSize: 8, textColor: [...DARK] },
    alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 10 } },
  });
  y = doc.lastAutoTable.finalY + 10;

  // Life ranking
  const groupLife = calcWeightedRanking(allData, "ranking_life").slice(0, 5);
  y = sectionTitle(doc, t("field.companies_life", lang), y);

  const lifeBody = office.ranking_life.slice(0, 5).map((c, i) => {
    const groupEntry = groupLife.find((g) => g.company === c);
    return [String(i + 1), c, groupEntry ? `#${groupEntry.rank} (${groupEntry.totalPoints} pts)` : "—"];
  });

  doc.autoTable({
    startY: y,
    head: [["#", t("benchmark.office", lang), t("benchmark.group", lang) + " ranking"]],
    body: lifeBody,
    theme: "grid",
    headStyles: { fillColor: [...PRIMARY], fontSize: 8, textColor: [...WHITE] },
    bodyStyles: { fontSize: 8, textColor: [...DARK] },
    alternateRowStyles: { fillColor: [...PRIMARY_LIGHT] },
    margin: { left: 15, right: 15 },
    styles: { cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 10 } },
  });
  y = doc.lastAutoTable.finalY + 10;

  // Priorities
  const groupTopPriorities = calcFrequency(allData, "priorities").slice(0, 5).map((p) => p.label);
  y = sectionTitle(doc, t("field.priorities", lang), y);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  for (const p of office.priorities) {
    const isGroupTop = groupTopPriorities.includes(p);
    if (isGroupTop) {
      doc.setTextColor(...PRIMARY);
      doc.setFont("helvetica", "bold");
    } else {
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "normal");
    }
    const bullet = isGroupTop ? "\u2605 " : "\u2022 ";
    const lines = doc.splitTextToSize(bullet + p, w - 30);
    doc.text(lines, 15, y);
    y += lines.length * 4 + 2;
  }
  y += 6;

  // Strengths & Challenges
  if (office.strengths_text) {
    y = sectionTitle(doc, t("field.strengths", lang), y);
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    const sLines = doc.splitTextToSize(office.strengths_text, w - 30);
    doc.text(sLines, 15, y);
    y += sLines.length * 4 + 6;
  }

  if (office.challenges_text) {
    y = sectionTitle(doc, t("field.challenges", lang), y);
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

  doc.autoTable({
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
  y = doc.lastAutoTable.finalY + 10;

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

  doc.autoTable({
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
  y = doc.lastAutoTable.finalY + 10;

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

    doc.autoTable({
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
    y = doc.lastAutoTable.finalY + 12;

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
    y += 12;

    y = sectionTitle(doc, lang === "nl" ? "Samenvatting" : "Resume", y);
    const c = getComputed(office);
    const commBm = calcBenchmark(allData.map((r) => r.commission_insurance), office.commission_insurance);

    const summaryPoints = [
      `${t("field.commission_ins", lang)}: ${fmtCur(office.commission_insurance)} (P${commBm.percentile ?? "—"})`,
      `FTE: ${c.total_fte?.toFixed(1) ?? "—"}`,
      `${t("field.commission_per_fte", lang)}: ${fmtCur(c.commission_per_fte)}`,
      `${t("field.satisfaction", lang)}: ${office.satisfaction_aquilae || "—"}`,
      `${t("field.recommend", lang)}: ${office.recommend_aquilae || "—"}`,
      `${t("field.priorities", lang)}: ${office.priorities.slice(0, 3).join("; ")}`,
    ];

    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    for (const point of summaryPoints) {
      const lines = doc.splitTextToSize("\u2022 " + point, w - 30);
      doc.text(lines, 15, y);
      y += lines.length * 4.5 + 2;
    }
  }

  addFooter(doc, year, 5, totalPages, lang);

  return doc;
}

export function generateOfficeFileName(officeName: string, year: number): string {
  const safeName = officeName.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "").replace(/\s+/g, "_");
  return `Aquilae_Barometer_${year}_${safeName}.pdf`;
}
