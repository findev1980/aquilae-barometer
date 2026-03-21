import { useMemo, useState } from "react";
import { useBarometerStore } from "@/store/useBarometerStore";
import { t } from "@/i18n/translations";
import { filterByYear, filterBySourceLang } from "@/utils/benchmarkCalc";
import { generateOfficePDF, generateOfficeFileName } from "@/utils/pdfGenerator";
import { Download, FileText, Loader2, CheckCircle2 } from "lucide-react";
import JSZip from "jszip";

export default function ExportsPage() {
  const { language, selectedYear, sourceLanguageFilter, allData } = useBarometerStore();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [singleExporting, setSingleExporting] = useState<string | null>(null);

  const data = useMemo(
    () => filterBySourceLang(filterByYear(allData, selectedYear), sourceLanguageFilter),
    [allData, selectedYear, sourceLanguageFilter]
  );

  const handleExportSingle = async (officeName: string) => {
    const office = data.find((r) => r.office_name === officeName);
    if (!office || !selectedYear) return;

    setSingleExporting(officeName);
    // Use requestAnimationFrame to let the UI update
    await new Promise((r) => requestAnimationFrame(r));

    try {
      const doc = generateOfficePDF(office, data, language, allData);
      doc.save(generateOfficeFileName(officeName, selectedYear));
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
    setSingleExporting(null);
  };

  const handleExportAll = async () => {
    if (!selectedYear) return;
    setExporting(true);
    setProgress(0);
    setDone(false);

    try {
      const zip = new JSZip();

      for (let i = 0; i < data.length; i++) {
        const office = data[i];
        const doc = generateOfficePDF(office, data, language, allData);
        const pdfBlob = doc.output("blob");
        zip.file(generateOfficeFileName(office.office_name, selectedYear), pdfBlob);
        setProgress(Math.round(((i + 1) / data.length) * 100));
        // Yield to UI
        await new Promise((r) => setTimeout(r, 10));
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Aquilae_Barometer_${selectedYear}_all.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch (err) {
      console.error("ZIP generation failed:", err);
    }

    setExporting(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold animate-fade-in">{t("nav.export", language)}</h1>

      {/* Bulk export */}
      <div className="rounded-xl border border-border bg-card p-6 card-shadow animate-fade-in" style={{ animationDelay: "60ms" }}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">{t("export.pdf_all", language)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.length} {t("common.offices", language)} — {selectedYear}
            </p>

            {exporting && (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>{progress}%</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {done && !exporting && (
              <div className="mt-3 flex items-center gap-2 text-sm font-medium text-accent-green">
                <CheckCircle2 className="h-4 w-4" />
                {data.length} PDFs — ZIP {language === "nl" ? "gedownload" : "telecharge"}
              </div>
            )}

            <button
              onClick={handleExportAll}
              disabled={exporting || data.length === 0}
              className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.97] disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t("export.zip", language)}
            </button>
          </div>
        </div>
      </div>

      {/* Individual office list */}
      <div className="rounded-xl border border-border bg-card card-shadow animate-fade-in" style={{ animationDelay: "120ms" }}>
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{t("export.pdf_single", language)}</h2>
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          {data.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t("status.no_data", language)}</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {data
                .sort((a, b) => a.office_name.localeCompare(b.office_name))
                .map((r) => (
                  <li key={r.office_name} className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.office_name}</p>
                      <p className="text-xs text-muted-foreground">{r.source_language.toUpperCase()}</p>
                    </div>
                    <button
                      onClick={() => handleExportSingle(r.office_name)}
                      disabled={singleExporting === r.office_name}
                      className="ml-3 flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-all hover:border-primary/30 hover:bg-primary/5 active:scale-[0.97] disabled:opacity-50"
                    >
                      {singleExporting === r.office_name ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      PDF
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
