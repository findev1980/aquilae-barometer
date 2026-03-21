import { useBarometerStore } from "@/store/useBarometerStore";
import { t } from "@/i18n/translations";
import { Trash2 } from "lucide-react";

export default function SettingsPage() {
  const { language, setLanguage, meta, deleteYear } = useBarometerStore();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold animate-fade-in">{t("settings.title", language)}</h1>

      {/* Language */}
      <div className="rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in" style={{ animationDelay: "60ms" }}>
        <h2 className="mb-3 text-sm font-semibold">{t("settings.language", language)}</h2>
        <div className="flex gap-2">
          {(["nl", "fr"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-all active:scale-[0.97] ${
                language === lang ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"
              }`}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Data management */}
      <div className="rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in" style={{ animationDelay: "120ms" }}>
        <h2 className="mb-3 text-sm font-semibold">{t("settings.data_management", language)}</h2>
        {meta.available_years.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("status.no_data", language)}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("settings.available_years", language)}</p>
            {meta.available_years.map((year) => (
              <div key={year} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm font-medium tabular-nums">{year}</span>
                <button
                  onClick={() => { if (confirm(`${t("settings.delete_year", language)} ${year}?`)) deleteYear(year); }}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* About */}
      <div className="rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in" style={{ animationDelay: "180ms" }}>
        <h2 className="mb-3 text-sm font-semibold">{t("settings.about", language)}</h2>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>{t("settings.version", language)}: 1.0.0</p>
          {meta.last_import && <p>{t("home.last_import", language)}: {meta.last_import}</p>}
        </div>
      </div>
    </div>
  );
}
