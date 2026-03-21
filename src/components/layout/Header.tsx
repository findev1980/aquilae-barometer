import { useBarometerStore } from "@/store/useBarometerStore";
import { t, type Language } from "@/i18n/translations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Header() {
  const { language, setLanguage, selectedYear, setSelectedYear, sourceLanguageFilter, setSourceLanguageFilter, meta } = useBarometerStore();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/80 px-6 py-3 backdrop-blur-sm">
      <div />
      <div className="flex items-center gap-3">
        {/* Source language filter */}
        <div className="flex items-center rounded-lg border border-border p-0.5 text-sm">
          {(["all", "nl", "fr"] as const).map((val) => (
            <button
              key={val}
              onClick={() => setSourceLanguageFilter(val)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                sourceLanguageFilter === val
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {val === "all" ? t("filter.all", language) : val.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Year selector */}
        {meta.available_years.length > 0 && (
          <Select value={String(selectedYear || "")} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder={t("filter.year", language)} />
            </SelectTrigger>
            <SelectContent>
              {meta.available_years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Language toggle */}
        <div className="flex items-center rounded-lg border border-border p-0.5 text-sm">
          {(["nl", "fr"] as Language[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                language === lang
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
