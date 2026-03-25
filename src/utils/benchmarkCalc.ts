import type { OfficeRecord, BenchmarkResult, ComputedFields, WeightedRanking } from "@/types/barometer";

export function getComputed(r: OfficeRecord): ComputedFields {
  const ci = r.commission_insurance;
  const cb = r.commission_bank;
  const managers = r.num_managers;
  const employees = r.num_employees_fte;

  const total_commission = ci !== null || cb !== null ? (ci || 0) + (cb || 0) : null;
  const total_fte = managers !== null || employees !== null ? (managers || 0) + (employees || 0) : null;
  const commission_per_fte = total_commission !== null && total_fte !== null && total_fte > 0
    ? total_commission / total_fte : null;

  return { total_commission, total_fte, commission_per_fte };
}

function sortedNonNull(values: (number | null)[]): number[] {
  return values.filter((v): v is number => v !== null).sort((a, b) => a - b);
}

function mean(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

function percentileRank(sorted: number[], value: number): number {
  if (sorted.length === 0) return 0;
  let count = 0;
  for (const v of sorted) {
    if (v < value) count++;
    else if (v === value) count += 0.5;
  }
  return Math.round((count / sorted.length) * 100);
}

function quartile(sorted: number[], value: number): number {
  const p = percentileRank(sorted, value);
  if (p <= 25) return 1;
  if (p <= 50) return 2;
  if (p <= 75) return 3;
  return 4;
}

export function calcBenchmark(
  values: (number | null)[],
  officeValue: number | null
): BenchmarkResult {
  const sorted = sortedNonNull(values);
  const q1Idx = Math.floor(sorted.length * 0.25);
  const q3Idx = Math.floor(sorted.length * 0.75);

  return {
    mean: mean(sorted),
    median: median(sorted),
    min: sorted.length > 0 ? sorted[0] : null,
    max: sorted.length > 0 ? sorted[sorted.length - 1] : null,
    q1: sorted.length > 0 ? sorted[q1Idx] : null,
    q3: sorted.length > 0 ? sorted[q3Idx] : null,
    percentile: officeValue !== null ? percentileRank(sorted, officeValue) : null,
    quartile: officeValue !== null ? quartile(sorted, officeValue) : null,
    n: sorted.length,
  };
}

// Likert score mappings
export function satisfactionScore(val: string): number | null {
  const lower = val.toLowerCase().trim();
  if (lower.includes("zeer tevreden") || lower.includes("très satisfait")) return 3;
  if (lower.includes("tevreden") || lower.includes("satisfait")) return 2;
  if (lower.includes("neutraal") || lower.includes("neutre")) return 1;
  return null;
}

export function recommendScore(val: string): number | null {
  const lower = val.toLowerCase().trim();
  if (lower.includes("zeer zeker") || lower.includes("certainement")) return 3;
  if (lower.includes("waarschijnlijk") || lower.includes("probablement")) return 2;
  if (lower.includes("misschien")) return 1;
  return null;
}

export function alignmentScore(val: string): number | null {
  const lower = val.toLowerCase().trim();
  if (lower.includes("helemaal") || lower.includes("complètement")) return 4;
  if (lower === "ja" || lower === "oui") return 4;
  if (lower.includes("gedeeltelijk") || lower.includes("partiellement")) return 3;
  if (lower.includes("eerder niet") || lower.includes("plutôt pas")) return 2;
  if (lower.includes("pas du tout")) return 1;
  return null;
}

export function calcWeightedRanking(records: OfficeRecord[], field: "ranking_nonlife" | "ranking_life"): WeightedRanking[] {
  const scores: Record<string, { points: number; top3: number }> = {};

  for (const r of records) {
    const list = r[field];
    for (let i = 0; i < Math.min(list.length, 5); i++) {
      const company = list[i].trim();
      if (!company) continue;
      if (!scores[company]) scores[company] = { points: 0, top3: 0 };
      scores[company].points += 5 - i;
      if (i < 3) scores[company].top3++;
    }
  }

  return Object.entries(scores)
    .map(([company, { points, top3 }]) => ({ company, totalPoints: points, inTop3: top3, rank: 0 }))
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

export function calcFrequency(records: OfficeRecord[], field: keyof OfficeRecord): { label: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const r of records) {
    const val = r[field];
    if (Array.isArray(val)) {
      for (const v of val) {
        const trimmed = v.trim();
        if (trimmed) counts[trimmed] = (counts[trimmed] || 0) + 1;
      }
    } else if (typeof val === "string" && val) {
      counts[val] = (counts[val] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export function formatCurrency(value: number | null): string {
  if (value === null) return "—";
  return "€" + Math.round(value).toLocaleString("de-DE");
}

export function formatNumber(value: number | null, decimals = 1): string {
  if (value === null) return "—";
  return value.toFixed(decimals);
}

export function isOutlier(value: number, q1: number, q3: number): boolean {
  const iqr = q3 - q1;
  return value > q3 + 1.5 * iqr || value < q1 - 1.5 * iqr;
}

export function filterByYear(data: OfficeRecord[], year: number | null): OfficeRecord[] {
  if (!year) return [];
  return data.filter((r) => r.survey_year === year);
}

export function filterBySourceLang(data: OfficeRecord[], filter: "nl" | "fr" | "all"): OfficeRecord[] {
  if (filter === "all") return data;
  return data.filter((r) => r.source_language === filter);
}

export type OfficeSize = "klein" | "middelgroot" | "groot";

export function getOfficeSize(record: OfficeRecord): OfficeSize | null {
  const fte = getComputed(record).total_fte;
  if (fte === null) return null;
  if (fte <= 4) return "klein";
  if (fte <= 10) return "middelgroot";
  return "groot";
}

export function getOfficeSizeLabel(size: OfficeSize | null, lang: "nl" | "fr"): string {
  if (size === null) return "—";
  const labels: Record<OfficeSize, Record<"nl" | "fr", string>> = {
    klein: { nl: "Klein (0-4 FTE)", fr: "Petit (0-4 ETP)" },
    middelgroot: { nl: "Middelgroot (4-10 FTE)", fr: "Moyen (4-10 ETP)" },
    groot: { nl: "Groot (+10 FTE)", fr: "Grand (+10 ETP)" },
  };
  return labels[size][lang];
}

export function filterBySize(data: OfficeRecord[], size: OfficeSize | "all"): OfficeRecord[] {
  if (size === "all") return data;
  return data.filter((r) => getOfficeSize(r) === size);
}
