import readXlsxFile from "read-excel-file/browser";
import type { OfficeRecord, ValidationResult } from "@/types/barometer";

function parseRatio(value: string | null | undefined): [number | null, number | null] {
  if (!value || typeof value !== "string") return [null, null];
  const cleaned = value.replace(/\s/g, "");
  const parts = cleaned.split("-");
  if (parts.length !== 2) return [null, null];
  const a = parseFloat(parts[0]);
  const b = parseFloat(parts[1]);
  return [isNaN(a) ? null : a, isNaN(b) ? null : b];
}

function splitSemicolon(value: string | null | undefined): string[] {
  if (!value || typeof value !== "string") return [];
  return value
    .split(";")
    .map((s) => s.replace(/<br\/?>/gi, "").trim())
    .filter(Boolean);
}

function parseNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[,\s]/g, "").replace(/\./g, ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function cleanString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/<br\/?>/gi, "\n").replace(/;$/, "").trim();
}

function cellStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

async function readSheet(file: File, sheetName: string): Promise<unknown[][] | null> {
  try {
    const sheets = await readXlsxFile(file, { getSheets: true });
    const match = sheets.find((s) => s.name.toUpperCase() === sheetName.toUpperCase());
    if (!match) return null;
    const sheetIndex = sheets.indexOf(match) + 1;
    const rows = await readXlsxFile(file, { sheet: sheetIndex });
    return rows as unknown[][];
  } catch {
    return null;
  }
}

export async function parseExcelFile(
  file: File,
  surveyYear: number
): Promise<{ records: OfficeRecord[]; validation: ValidationResult }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const emptyFieldCounts: Record<string, number> = {};
  const records: OfficeRecord[] = [];

  const allSheets = await readXlsxFile(file, { getSheets: true });
  const sheetNames = allSheets.map((s) => s.name);

  const hasNL = sheetNames.some((n) => n.toUpperCase() === "NL");
  const hasFR = sheetNames.some((n) => n.toUpperCase() === "FR");

  if (!hasNL) errors.push("Tabblad 'NL' ontbreekt / Onglet 'NL' manquant");
  if (!hasFR) errors.push("Tabblad 'FR' ontbreekt / Onglet 'FR' manquant");

  const sheets: { name: string; lang: "nl" | "fr" }[] = [];
  if (hasNL) sheets.push({ name: sheetNames.find((n) => n.toUpperCase() === "NL")!, lang: "nl" });
  if (hasFR) sheets.push({ name: sheetNames.find((n) => n.toUpperCase() === "FR")!, lang: "fr" });

  for (const { name, lang } of sheets) {
    const rows = await readSheet(file, name);
    if (!rows || rows.length < 2) {
      warnings.push(`Tabblad ${lang.toUpperCase()} is leeg`);
      continue;
    }

    const colCount = rows[0].length;
    if (colCount !== 21) {
      warnings.push(`Tabblad ${lang.toUpperCase()} heeft ${colCount} kolommen (verwacht: 21)`);
    }

    const dataRows = rows.slice(1);
    const names = new Set<string>();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;
      const officeName = cleanString(row[0]);
      if (!officeName) {
        errors.push(`${lang.toUpperCase()} rij ${i + 2}: lege kantoornaam`);
        continue;
      }
      if (names.has(officeName)) {
        errors.push(`${lang.toUpperCase()} rij ${i + 2}: dubbele naam "${officeName}"`);
        continue;
      }
      names.add(officeName);

      const [pctPrivate, pctSme] = parseRatio(cellStr(row[6]));
      const [pctLife, pctNonlife] = parseRatio(cellStr(row[7]));

      const record: OfficeRecord = {
        office_name: officeName,
        source_language: lang,
        survey_year: surveyYear,
        activities: splitSemicolon(cellStr(row[1])),
        num_managers: parseNum(row[2]),
        num_employees_fte: parseNum(row[3]),
        commission_insurance: parseNum(row[4]),
        commission_bank: parseNum(row[5]),
        pct_private: pctPrivate,
        pct_sme: pctSme,
        pct_life: pctLife,
        pct_nonlife: pctNonlife,
        ranking_nonlife: splitSemicolon(cellStr(row[8])),
        ranking_life: splitSemicolon(cellStr(row[9])),
        growth_phase: splitSemicolon(cellStr(row[10])),
        strengths_text: cleanString(row[11]),
        challenges_text: cleanString(row[12]),
        priorities: splitSemicolon(cellStr(row[13])),
        satisfaction_aquilae: cleanString(row[14]),
        recommend_aquilae: cleanString(row[15]),
        reasons_membership: cleanString(row[16]),
        participation_charter: cleanString(row[17]),
        mission_alignment: cleanString(row[18]),
        vision_alignment: cleanString(row[19]),
        values_alignment: cleanString(row[20]),
      };

      const fields = ["commission_insurance", "commission_bank", "pct_private", "pct_life"] as const;
      for (const f of fields) {
        if (record[f] === null) {
          emptyFieldCounts[f] = (emptyFieldCounts[f] || 0) + 1;
        }
      }

      records.push(record);
    }
  }

  const nlCount = records.filter((r) => r.source_language === "nl").length;
  const frCount = records.filter((r) => r.source_language === "fr").length;

  return { records, validation: { errors, warnings, nlCount, frCount, emptyFieldCounts } };
}
