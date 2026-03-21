import { useBarometerStore } from "@/store/useBarometerStore";
import { t, type Language } from "@/i18n/translations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("barometer_theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("barometer_theme", dark ? "dark" : "light");
  }, [dark]);

  return [dark, () => setDark((d) => !d)] as const;
}

export default function Header() {
  const { language, setLanguage, selectedYear, setSelectedYear, sourceLanguageFilter, setSourceLanguageFilter, meta } = useBarometerStore();
  const [dark, toggleDark] = useTheme();

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

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.95]"
          aria-label="Toggle dark mode"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
