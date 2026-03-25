import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBarometerStore } from "@/store/useBarometerStore";
import { t } from "@/i18n/translations";
import { filterByYear, filterBySourceLang, filterBySize, formatCurrency, getComputed, satisfactionScore, recommendScore } from "@/utils/benchmarkCalc";
import { Building2, TrendingUp, Users, ThumbsUp, Star, Search, BarChart3, Upload } from "lucide-react";

function KpiCard({ icon: Icon, label, value, sub, delay }: { icon: React.ElementType; label: string; value: string; sub?: string; delay: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { language, selectedYear, sourceLanguageFilter, allData, meta } = useBarometerStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const data = useMemo(() => {
    const yearly = filterByYear(allData, selectedYear);
    return filterBySourceLang(yearly, sourceLanguageFilter);
  }, [allData, selectedYear, sourceLanguageFilter]);

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const commissions = data.map((r) => r.commission_insurance).filter((v): v is number => v !== null);
    const avgComm = commissions.length > 0 ? commissions.reduce((s, v) => s + v, 0) / commissions.length : null;
    const sortedComm = [...commissions].sort((a, b) => a - b);
    const medComm = sortedComm.length > 0 ? (sortedComm.length % 2 === 0
      ? (sortedComm[sortedComm.length / 2 - 1] + sortedComm[sortedComm.length / 2]) / 2
      : sortedComm[Math.floor(sortedComm.length / 2)]) : null;

    const ftes = data.map((r) => getComputed(r).total_fte).filter((v): v is number => v !== null);
    const avgFte = ftes.length > 0 ? ftes.reduce((s, v) => s + v, 0) / ftes.length : null;

    const satScores = data.map((r) => satisfactionScore(r.satisfaction_aquilae)).filter((v): v is number => v !== null);
    const avgSat = satScores.length > 0 ? satScores.reduce((s, v) => s + v, 0) / satScores.length : null;

    const recScores = data.map((r) => recommendScore(r.recommend_aquilae)).filter((v): v is number => v !== null);
    const avgRec = recScores.length > 0 ? recScores.reduce((s, v) => s + v, 0) / recScores.length : null;

    return { total: data.length, avgComm, medComm, avgFte, avgSat, avgRec };
  }, [data]);

  const filteredOffices = useMemo(() => {
    if (!search) return [];
    return data.filter((r) => r.office_name.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  }, [data, search]);

  if (meta.available_years.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">{t("home.welcome", language)}</h1>
        <p className="mt-2 max-w-md text-muted-foreground">{t("home.no_data", language)}</p>
        <button onClick={() => navigate("/admin")} className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.97]">
          {t("admin.upload", language)}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold">{t("home.welcome", language)}</h1>
        <p className="text-sm text-muted-foreground">{t("home.subtitle", language)}</p>
      </div>

      {/* KPI Row */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard icon={Building2} label={t("kpi.total_offices", language)} value={String(stats.total)} delay={0} />
          <KpiCard icon={TrendingUp} label={t("kpi.avg_commission", language)} value={formatCurrency(stats.avgComm)} delay={60} />
          <KpiCard icon={TrendingUp} label={t("kpi.median_commission", language)} value={formatCurrency(stats.medComm)} delay={120} />
          <KpiCard icon={Users} label={t("kpi.avg_fte", language)} value={stats.avgFte !== null ? stats.avgFte.toFixed(1) : "—"} delay={180} />
          <KpiCard icon={ThumbsUp} label={t("kpi.avg_satisfaction", language)} value={stats.avgSat !== null ? `${stats.avgSat.toFixed(2)} / 3` : "—"} delay={240} />
          <KpiCard icon={Star} label={t("kpi.avg_recommend", language)} value={stats.avgRec !== null ? `${stats.avgRec.toFixed(2)} / 3` : "—"} delay={300} />
        </div>
      )}

      {/* Search + Quick nav */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Office search */}
        <div className="rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in" style={{ animationDelay: "350ms" }}>
          <h2 className="mb-3 text-sm font-semibold">{t("home.search_office", language)}</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("home.search_office", language)}
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {filteredOffices.length > 0 && (
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
              {filteredOffices.map((r) => (
                <li key={r.office_name}>
                  <button
                    onClick={() => { navigate("/office"); useBarometerStore.getState().setSelectedOffice(r.office_name); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                  >
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{r.office_name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{r.source_language.toUpperCase()}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick navigation */}
        <div className="rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in" style={{ animationDelay: "400ms" }}>
          <h2 className="mb-3 text-sm font-semibold">{t("home.quick_nav", language)}</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "group.financial", path: "/group?tab=financial", icon: TrendingUp },
              { key: "group.personnel", path: "/group?tab=personnel", icon: Users },
              { key: "group.companies", path: "/group?tab=companies", icon: BarChart3 },
              { key: "group.engagement", path: "/group?tab=engagement", icon: ThumbsUp },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-left text-sm font-medium transition-all hover:border-primary/30 hover:bg-primary/5 active:scale-[0.97]"
              >
                <item.icon className="h-4 w-4 text-primary" />
                {t(item.key, language)}
              </button>
            ))}
          </div>
          {meta.last_import && (
            <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
              <span>{t("home.last_import", language)}: {meta.last_import}</span>
              <span>{t("home.current_year", language)}: {selectedYear}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
