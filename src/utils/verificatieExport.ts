import { supabase } from "@/integrations/supabase/client";
import ExcelJS from "exceljs";
import JSZip from "jszip";

interface OfficeYearData {
  num_managers: number | null;
  num_employees_fte: number | null;
  commission_insurance: number | null;
  commission_bank: number | null;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim();
}

export async function generateVerificatieZip(): Promise<Blob> {
  // Fetch all records
  const { data, error } = await supabase
    .from("office_records")
    .select("office_name, survey_year, num_managers, num_employees_fte, commission_insurance, commission_bank")
    .order("office_name")
    .order("survey_year");

  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Geen data gevonden");

  // Get all unique years and group by office
  const allYears = [...new Set(data.map((r) => r.survey_year))].sort();
  const officeMap = new Map<string, Map<number, OfficeYearData>>();

  for (const r of data) {
    if (!officeMap.has(r.office_name)) officeMap.set(r.office_name, new Map());
    officeMap.get(r.office_name)!.set(r.survey_year, {
      num_managers: r.num_managers,
      num_employees_fte: r.num_employees_fte,
      commission_insurance: r.commission_insurance,
      commission_bank: r.commission_bank,
    });
  }

  const yellowFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFFF00" },
  };

  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1A365D" },
  };

  const headerFont: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 11,
  };

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  const zip = new JSZip();

  for (const [officeName, yearMap] of officeMap) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Verificatie");

    // Title
    ws.mergeCells("A1:E1");
    const titleCell = ws.getCell("A1");
    titleCell.value = `Verificatie data - ${officeName}`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: "left" };

    // Empty row
    ws.addRow([]);

    // Headers
    const headerRow = ws.addRow(["Jaar", "Zaakvoerders", "Bedienden (FTE)", "Commissie Verzekeringen (€)", "Commissie Bank (€)"]);
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: "center" };
      cell.border = borderStyle;
    });

    // Data rows
    for (const year of allYears) {
      const d = yearMap.get(year);
      const values = [
        year,
        d?.num_managers ?? null,
        d?.num_employees_fte ?? null,
        d?.commission_insurance ?? null,
        d?.commission_bank ?? null,
      ];

      const row = ws.addRow(values);
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = borderStyle;
        cell.alignment = { horizontal: colNumber === 1 ? "center" : "right" };

        // Format numbers
        if (colNumber >= 4) {
          cell.numFmt = '#,##0';
        } else if (colNumber === 3) {
          cell.numFmt = '#,##0.0';
        }

        // Yellow for missing data (skip year column)
        if (colNumber > 1 && (cell.value === null || cell.value === undefined)) {
          cell.fill = yellowFill;
          cell.value = ""; // ensure cell exists
        }

        // If entire year is missing, also highlight year cell
        if (!d && colNumber === 1) {
          cell.fill = yellowFill;
        }
      });
    }

    // Column widths
    ws.getColumn(1).width = 10;
    ws.getColumn(2).width = 16;
    ws.getColumn(3).width = 18;
    ws.getColumn(4).width = 32;
    ws.getColumn(5).width = 22;

    const buffer = await wb.xlsx.writeBuffer();
    zip.file(`${sanitizeFilename(officeName)}.xlsx`, buffer);
  }

  return zip.generateAsync({ type: "blob" });
}
