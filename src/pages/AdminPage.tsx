import { useState, useCallback } from "react";
import { useBarometerStore } from "@/store/useBarometerStore";
import { t } from "@/i18n/translations";
import { parseExcelFile } from "@/utils/dataParser";
import { Upload, FileSpreadsheet, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function AdminPage() {
  const { language, meta, importData } = useBarometerStore();
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [validation, setValidation] = useState<Awaited<ReturnType<typeof parseExcelFile>> | null>(null);
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showOverwrite, setShowOverwrite] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".xlsx")) setFile(f);
  }, []);

  const handleValidate = async () => {
    if (!file) return;
    const buf = await file.arrayBuffer();
    const result = parseExcelFile(buf, year);
    setValidation(result);
    setSuccess(false);

    if (meta.available_years.includes(year) && result.validation.errors.length === 0) {
      setShowOverwrite(true);
    }
  };

  const handleImport = async () => {
    if (!validation) return;
    setImporting(true);
    try {
      await importData(validation.records, year);
      setSuccess(true);
      setShowOverwrite(false);
    } catch (err) {
      console.error("Import failed:", err);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold animate-fade-in">{t("nav.admin", language)}</h1>

      {/* Upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-12 transition-colors hover:border-primary/50 animate-fade-in"
        style={{ animationDelay: "60ms" }}
      >
        {file ? (
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{t("admin.file_selected", language)}</p>
            </div>
          </div>
        ) : (
          <>
            <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">{t("admin.drag_drop", language)}</p>
          </>
        )}
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="absolute inset-0 cursor-pointer opacity-0"
          style={{ position: "relative" }}
        />
      </div>

      {/* Year input */}
      <div className="flex items-center gap-4 animate-fade-in" style={{ animationDelay: "120ms" }}>
        <label className="text-sm font-medium">{t("admin.year", language)}</label>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring tabular-nums"
        />
        <button
          onClick={handleValidate}
          disabled={!file}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.97] disabled:opacity-50"
        >
          {t("admin.validate", language)}
        </button>
      </div>

      {/* Validation results */}
      {validation && (
        <div className="space-y-4 animate-fade-in" style={{ animationDelay: "180ms" }}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-muted-foreground">{t("admin.offices_nl", language)}</p>
              <p className="text-lg font-bold">{validation.validation.nlCount}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-muted-foreground">{t("admin.offices_fr", language)}</p>
              <p className="text-lg font-bold">{validation.validation.frCount}</p>
            </div>
          </div>

          {validation.validation.errors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertCircle className="h-4 w-4" />
                {t("admin.errors", language)} ({validation.validation.errors.length})
              </div>
              <ul className="space-y-1 text-xs text-destructive">
                {validation.validation.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {validation.validation.warnings.length > 0 && (
            <div className="rounded-lg border border-accent-orange/30 bg-accent-orange/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-accent-orange">
                <AlertTriangle className="h-4 w-4" />
                {t("admin.warnings", language)} ({validation.validation.warnings.length})
              </div>
              <ul className="space-y-1 text-xs">
                {validation.validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {showOverwrite && (
            <div className="rounded-lg border border-accent-orange/30 bg-accent-orange/5 p-4 text-sm">
              <p className="font-medium">{t("admin.overwrite_warning", language)}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={handleImport} className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground">{t("admin.overwrite", language)}</button>
                <button onClick={() => setShowOverwrite(false)} className="rounded-lg border border-border px-4 py-1.5 text-xs font-medium">{t("admin.cancel", language)}</button>
              </div>
            </div>
          )}

          {validation.validation.errors.length === 0 && !showOverwrite && !success && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.97] disabled:opacity-50"
            >
              {importing ? "..." : t("admin.confirm_import", language)}
            </button>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-accent-green/30 bg-accent-green/5 p-4 text-sm font-medium text-accent-green">
              <CheckCircle2 className="h-4 w-4" />
              {t("admin.import_success", language)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
