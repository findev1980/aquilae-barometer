import { useMemo, useState } from "react";
import { useBarometerStore } from "@/store/useBarometerStore";
import { t } from "@/i18n/translations";
import { filterByYear, filterBySourceLang } from "@/utils/benchmarkCalc";
import { Download, FileText, Loader2 } from "lucide-react";

export default function ExportsPage() {
  const { language, selectedYear, sourceLanguageFilter, allData } = useBarometerStore();
  const [exporting, setExporting] = useState(false);

  const data = useMemo(() => filterBySourceLang(filterByYear(allData, selectedYear), sourceLanguageFilter), [allData, selectedYear, sourceLanguageFilter]);

  const handleExportAll = async () => {
    setExporting(true);
    // PDF + ZIP generation will be implemented in next iteration
    setTimeout(() => {
      setExporting(false);
      alert("PDF/ZIP export komt in de volgende versie / PDF/ZIP export coming in next version");
    }, 500);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold animate-fade-in">{t("nav.export", language)}</h1>

      <div className="rounded-xl border border-border bg-card p-6 card-shadow animate-fade-in" style={{ animationDelay: "60ms" }}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">{t("export.pdf_all", language)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.length} {t("common.offices", language)} — {selectedYear}
            </p>
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
    </div>
  );
}
