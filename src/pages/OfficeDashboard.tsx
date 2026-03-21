import { useMemo, useState } from "react";
import { useBarometerStore } from "@/store/useBarometerStore";
import { t } from "@/i18n/translations";
import {
  filterByYear, filterBySourceLang, getComputed, formatCurrency,
  calcBenchmark, calcWeightedRanking, satisfactionScore, recommendScore,
  alignmentScore
} from "@/utils/benchmarkCalc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Download, Info, Loader2, TrendingUp } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { generateOfficePDF, generateOfficeFileName } from "@/utils/pdfGenerator";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, LineChart, Line } from "recharts";
import type { OfficeRecord } from "@/types/barometer";

function HeaderWithTooltip({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <th className="pb-2 pr-3 text-right text-xs font-medium text-muted-foreground">
      <TooltipProvider delayDuration={200}>
        <UITooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-help items-center gap-1">
              {label}
              <Info className="h-3 w-3 text-muted-foreground/60" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
            {tooltip}
          </TooltipContent>
        </UITooltip>
      </TooltipProvider>
    </th>
  );
}

function BenchmarkRow({ label, value, mean, median, percentile, formatFn }: {
  label: string; value: number | null; mean: number | null; median: number | null;
  percentile: number | null; formatFn: (v: number | null) => string;
}) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-2 pr-3 text-sm font-medium">{label}</td>
      <td className="py-2 pr-3 text-right text-sm tabular-nums font-semibold">{formatFn(value)}</td>
      <td className="py-2 pr-3 text-right text-sm tabular-nums text-muted-foreground">{formatFn(mean)}</td>
      <td className="py-2 pr-3 text-right text-sm tabular-nums text-muted-foreground">{formatFn(median)}</td>
      <td className="py-2 text-right text-sm tabular-nums">{percentile !== null ? `P${percentile}` : "—"}</td>
    </tr>
  );
}

export default function OfficeDashboard() {
  const { language, selectedYear, sourceLanguageFilter, allData, selectedOffice, setSelectedOffice, meta } = useBarometerStore();

  const data = useMemo(() => filterBySourceLang(filterByYear(allData, selectedYear), sourceLanguageFilter), [allData, selectedYear, sourceLanguageFilter]);
  const office = useMemo(() => data.find((r) => r.office_name === selectedOffice), [data, selectedOffice]);

  const offices = useMemo(() => data.map((r) => r.office_name).sort(), [data]);

  const benchmarks = useMemo(() => {
    if (!office) return null;
    const c = getComputed(office);
    return {
      commIns: calcBenchmark(data.map((r) => r.commission_insurance), office.commission_insurance),
      commBank: calcBenchmark(data.map((r) => r.commission_bank), office.commission_bank),
      totalComm: calcBenchmark(data.map((r) => getComputed(r).total_commission), c.total_commission),
      commPerFte: calcBenchmark(data.map((r) => getComputed(r).commission_per_fte), c.commission_per_fte),
      computed: c,
    };
  }, [office, data]);

  const radarData = useMemo(() => {
    if (!office) return [];
    const fields = [
      { key: "mission_alignment" as const, label: t("field.mission", language), scoreFn: alignmentScore, max: 4 },
      { key: "vision_alignment" as const, label: t("field.vision", language), scoreFn: alignmentScore, max: 4 },
      { key: "values_alignment" as const, label: t("field.values", language), scoreFn: alignmentScore, max: 4 },
      { key: "participation_charter" as const, label: t("field.charter", language), scoreFn: alignmentScore, max: 4 },
    ];
    return fields.map(({ key, label, scoreFn, max }) => {
      const officeScore = scoreFn(office[key]);
      const groupScores = data.map((r) => scoreFn(r[key])).filter((v): v is number => v !== null);
      const groupMean = groupScores.length > 0 ? groupScores.reduce((s, v) => s + v, 0) / groupScores.length : 0;
      return {
        label,
        office: officeScore !== null ? (officeScore / max) * 100 : 0,
        group: (groupMean / max) * 100,
      };
    });
  }, [office, data, language]);

  const nonLifeRanking = useMemo(() => calcWeightedRanking(data, "ranking_nonlife"), [data]);
  const lifeRanking = useMemo(() => calcWeightedRanking(data, "ranking_life"), [data]);

  // Evolution data: gather this office across all available years
  const evolutionData = useMemo(() => {
    if (!selectedOffice || meta.available_years.length < 2) return [];
    return meta.available_years
      .map((year) => {
        const yearData = filterBySourceLang(filterByYear(allData, year), sourceLanguageFilter);
        const rec = yearData.find((r) => r.office_name === selectedOffice);
        if (!rec) return null;
        const c = getComputed(rec);
        const groupComm = yearData.map((r) => getComputed(r).total_commission).filter((v): v is number => v !== null);
        const groupFte = yearData.map((r) => getComputed(r).total_fte).filter((v): v is number => v !== null);
        const groupSat = yearData.map((r) => satisfactionScore(r.satisfaction_aquilae)).filter((v): v is number => v !== null);
        return {
          year,
          commIns: rec.commission_insurance,
          commBank: rec.commission_bank,
          totalComm: c.total_commission,
          totalFte: c.total_fte,
          commPerFte: c.commission_per_fte,
          satisfaction: satisfactionScore(rec.satisfaction_aquilae),
          groupCommMean: groupComm.length > 0 ? groupComm.reduce((a, b) => a + b, 0) / groupComm.length : null,
          groupFteMean: groupFte.length > 0 ? groupFte.reduce((a, b) => a + b, 0) / groupFte.length : null,
          groupSatMean: groupSat.length > 0 ? groupSat.reduce((a, b) => a + b, 0) / groupSat.length : null,
        };
      })
      .filter(Boolean);
  }, [selectedOffice, allData, meta.available_years, sourceLanguageFilter]);

  if (data.length === 0) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground animate-fade-in">{t("status.no_data", language)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 animate-fade-in">
        <h1 className="text-2xl font-bold">{t("nav.office", language)}</h1>
        <Select value={selectedOffice || ""} onValueChange={setSelectedOffice}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder={t("office.select", language)} />
          </SelectTrigger>
          <SelectContent>
            {offices.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {office && selectedYear && (
          <ExportPDFButton office={office} data={data} allData={allData} language={language} year={selectedYear} />
        )}
      </div>

      {!office ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground animate-fade-in">
          <Building2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p>{t("office.select", language)}</p>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in" style={{ animationDelay: "60ms" }}>
          {/* Header badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{office.source_language.toUpperCase()}</span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{selectedYear}</span>
            {office.activities.map((a) => (
              <span key={a} className="rounded-full bg-muted px-3 py-1 text-xs">{a}</span>
            ))}
            {office.growth_phase.map((g) => (
              <span key={g} className="rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">{g.slice(0, 50)}{g.length > 50 ? "…" : ""}</span>
            ))}
          </div>

          {/* Financial benchmark */}
          {benchmarks && (
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <h3 className="mb-4 text-sm font-semibold">{t("office.financial_benchmark", language)}</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 pr-3 text-xs font-medium text-muted-foreground" />
                      <th className="pb-2 pr-3 text-right text-xs font-medium text-muted-foreground">{t("office.value", language)}</th>
                      <HeaderWithTooltip label={t("benchmark.mean", language)} tooltip={t("benchmark.mean_tooltip", language)} />
                      <HeaderWithTooltip label={t("benchmark.median", language)} tooltip={t("benchmark.median_tooltip", language)} />
                      <HeaderWithTooltip label={t("benchmark.percentile", language)} tooltip={t("benchmark.percentile_tooltip", language)} />
                    </tr>
                  </thead>
                  <tbody>
                    <BenchmarkRow label={t("field.commission_ins", language)} value={office.commission_insurance} mean={benchmarks.commIns.mean} median={benchmarks.commIns.median} percentile={benchmarks.commIns.percentile} formatFn={formatCurrency} />
                    <BenchmarkRow label={t("field.commission_bank", language)} value={office.commission_bank} mean={benchmarks.commBank.mean} median={benchmarks.commBank.median} percentile={benchmarks.commBank.percentile} formatFn={formatCurrency} />
                    <BenchmarkRow label={t("field.total_commission", language)} value={benchmarks.computed.total_commission} mean={benchmarks.totalComm.mean} median={benchmarks.totalComm.median} percentile={benchmarks.totalComm.percentile} formatFn={formatCurrency} />
                    <BenchmarkRow label={t("field.commission_per_fte", language)} value={benchmarks.computed.commission_per_fte} mean={benchmarks.commPerFte.mean} median={benchmarks.commPerFte.median} percentile={benchmarks.commPerFte.percentile} formatFn={formatCurrency} />
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">n = {benchmarks.commIns.n} {t("common.offices", language)}</p>
            </div>
          )}

          {/* Portfolio distribution */}
          {office && <PortfolioDistribution office={office} data={data} language={language} />}

          {/* Personnel + Companies */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <h3 className="mb-4 text-sm font-semibold">{t("office.personnel", language)}</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("field.managers", language)}</span><span className="font-medium">{office.num_managers ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("field.employees", language)}</span><span className="font-medium">{office.num_employees_fte ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("field.commission_per_fte", language)}</span><span className="font-medium">{formatCurrency(benchmarks?.computed.commission_per_fte ?? null)}</span></div>
              </div>
            </div>

            {/* Companies */}
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <h3 className="mb-3 text-sm font-semibold">{t("office.companies", language)}</h3>
              <div className="space-y-5">
                {[
                  { title: t("field.companies_nonlife", language), officeList: office.ranking_nonlife, groupRanking: nonLifeRanking },
                  { title: t("field.companies_life", language), officeList: office.ranking_life, groupRanking: lifeRanking },
                ].map(({ title, officeList, groupRanking }) => (
                  <div key={title}>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
                    <div className="space-y-1.5">
                      {officeList.slice(0, 5).map((company, i) => {
                        const groupEntry = groupRanking.find((r) => r.company === company);
                        const groupPos = groupEntry?.rank;
                        const inGroupTop5 = groupPos !== undefined && groupPos <= 5;
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${i < 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                              {i + 1}
                            </span>
                            <span className={`flex-1 truncate ${inGroupTop5 ? "font-semibold text-primary" : ""}`}>{company}</span>
                            {groupPos !== undefined ? (
                              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${inGroupTop5 ? "bg-primary/10 text-primary font-medium" : "bg-muted text-muted-foreground"}`}>
                                {language === "nl" ? "Groep" : "Groupe"} #{groupPos}
                              </span>
                            ) : (
                              <span className="shrink-0 text-[10px] text-muted-foreground/50">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground">
                {language === "nl"
                  ? "Paars gemarkeerd = in groep top 5. Groepspositie gebaseerd op gewogen puntensysteem."
                  : "Marqué en violet = dans le top 5 du groupe. Position basée sur un système de points pondérés."}
              </p>
            </div>
          </div>

          {/* Strategy + Engagement */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <h3 className="mb-3 text-sm font-semibold">{t("office.strategy", language)}</h3>
              <div className="mb-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t("field.priorities", language)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {office.priorities.map((p) => (
                    <span key={p} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{p}</span>
                  ))}
                </div>
              </div>
              {office.strengths_text && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t("field.strengths", language)}</p>
                  <p className="text-sm leading-relaxed">{office.strengths_text}</p>
                </div>
              )}
              {office.challenges_text && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t("field.challenges", language)}</p>
                  <p className="text-sm leading-relaxed">{office.challenges_text}</p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <h3 className="mb-3 text-sm font-semibold">{t("office.engagement", language)}</h3>
              <div className="mb-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("field.satisfaction", language)}</span><span className="font-medium">{office.satisfaction_aquilae || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("field.recommend", language)}</span><span className="font-medium">{office.recommend_aquilae || "—"}</span></div>
              </div>

              {radarData.length > 0 && (
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={70}>
                    <PolarGrid stroke="hsl(252,25%,90%)" />
                    <PolarAngleAxis dataKey="label" tick={{ fontSize: 9 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name={t("benchmark.office", language)} dataKey="office" stroke="hsl(262,30%,53%)" fill="hsl(262,30%,53%)" fillOpacity={0.3} />
                    <Radar name={t("benchmark.group", language)} dataKey="group" stroke="hsl(252,25%,70%)" fill="hsl(252,25%,70%)" fillOpacity={0.1} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>
              )}

              {office.reasons_membership && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t("field.reasons", language)}</p>
                  <p className="text-xs leading-relaxed">{office.reasons_membership}</p>
                </div>
              )}
            </div>
          </div>

          {/* Year-over-Year Evolution */}
          {evolutionData.length >= 2 ? (
            <div className="rounded-xl border border-border bg-card p-5 card-shadow animate-fade-in" style={{ animationDelay: "120ms" }}>
              <div className="mb-5 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">{t("evolution.title", language)}</h3>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Commission evolution */}
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{t("evolution.total_commission", language)}</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={evolutionData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name]} labelFormatter={(l) => `${t("evolution.year", language)}: ${l}`} />
                      <Line type="monotone" dataKey="totalComm" name={t("office.value", language)} stroke="hsl(262,30%,53%)" strokeWidth={2} dot={{ r: 4, fill: "hsl(262,30%,53%)" }} />
                      <Line type="monotone" dataKey="groupCommMean" name={t("office.group_mean", language)} stroke="hsl(252,25%,70%)" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 3 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* FTE evolution */}
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{t("evolution.fte", language)}</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={evolutionData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number, name: string) => [v?.toFixed(1) ?? "—", name]} labelFormatter={(l) => `${t("evolution.year", language)}: ${l}`} />
                      <Line type="monotone" dataKey="totalFte" name={t("office.value", language)} stroke="hsl(262,30%,53%)" strokeWidth={2} dot={{ r: 4, fill: "hsl(262,30%,53%)" }} />
                      <Line type="monotone" dataKey="groupFteMean" name={t("office.group_mean", language)} stroke="hsl(252,25%,70%)" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 3 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Commission per FTE evolution */}
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{t("evolution.commission_per_fte", language)}</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={evolutionData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name]} labelFormatter={(l) => `${t("evolution.year", language)}: ${l}`} />
                      <Line type="monotone" dataKey="commPerFte" name={t("office.value", language)} stroke="hsl(142,60%,40%)" strokeWidth={2} dot={{ r: 4, fill: "hsl(142,60%,40%)" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Satisfaction evolution */}
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{t("evolution.satisfaction", language)}</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={evolutionData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 3]} ticks={[0, 1, 2, 3]} />
                      <Tooltip formatter={(v: number, name: string) => [v ?? "—", name]} labelFormatter={(l) => `${t("evolution.year", language)}: ${l}`} />
                      <Line type="monotone" dataKey="satisfaction" name={t("office.value", language)} stroke="hsl(35,90%,55%)" strokeWidth={2} dot={{ r: 4, fill: "hsl(35,90%,55%)" }} />
                      <Line type="monotone" dataKey="groupSatMean" name={t("office.group_mean", language)} stroke="hsl(252,25%,70%)" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 3 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : evolutionData.length === 1 ? (
            <div className="rounded-xl border border-border bg-card p-5 card-shadow">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <p className="text-sm">{t("evolution.no_history", language)}</p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ExportPDFButton({ office, data, allData, language, year }: {
  office: OfficeRecord; data: OfficeRecord[]; allData: OfficeRecord[];
  language: "nl" | "fr"; year: number;
}) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    await new Promise((r) => requestAnimationFrame(r));
    try {
      const doc = generateOfficePDF(office, data, language, allData);
      doc.save(generateOfficeFileName(office.office_name, year));
    } catch (err) {
      console.error("PDF export failed:", err);
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="ml-auto flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-all hover:border-primary/30 hover:bg-primary/5 active:scale-[0.97] disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {t("export.pdf_single", language)}
    </button>
  );
}

function PortfolioDistribution({ office, data, language }: { office: OfficeRecord; data: OfficeRecord[]; language: "nl" | "fr" }) {
  const avgPrivate = useMemo(() => {
    const vals = data.map((r) => r.pct_private).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [data]);
  const avgSme = useMemo(() => {
    const vals = data.map((r) => r.pct_sme).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [data]);
  const avgLife = useMemo(() => {
    const vals = data.map((r) => r.pct_life).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [data]);
  const avgNonlife = useMemo(() => {
    const vals = data.map((r) => r.pct_nonlife).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [data]);

  const hasPrivateSme = office.pct_private !== null || office.pct_sme !== null;
  const hasLifeNonlife = office.pct_life !== null || office.pct_nonlife !== null;

  if (!hasPrivateSme && !hasLifeNonlife) return null;

  const barData = [
    ...(hasPrivateSme ? [{
      category: `${t("field.pct_private", language)} / ${t("field.pct_sme", language)}`,
      items: [
        { label: t("field.pct_private", language), office: office.pct_private ?? 0, group: Math.round(avgPrivate * 10) / 10 },
        { label: t("field.pct_sme", language), office: office.pct_sme ?? 0, group: Math.round(avgSme * 10) / 10 },
      ],
    }] : []),
    ...(hasLifeNonlife ? [{
      category: `${t("field.pct_life", language)} / ${t("field.pct_nonlife", language)}`,
      items: [
        { label: t("field.pct_nonlife", language), office: office.pct_nonlife ?? 0, group: Math.round(avgNonlife * 10) / 10 },
        { label: t("field.pct_life", language), office: office.pct_life ?? 0, group: Math.round(avgLife * 10) / 10 },
      ],
    }] : []),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {barData.map(({ category, items }) => (
        <div key={category} className="rounded-xl border border-border bg-card p-5 card-shadow">
          <h3 className="mb-4 text-sm font-semibold">{category}</h3>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{item.label}</span>
                  <span className="tabular-nums">{item.office}%</span>
                </div>
                {/* Office bar */}
                <div className="relative h-5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(item.office, 100)}%` }}
                  />
                  {/* Group average marker */}
                  <div
                    className="absolute top-0 h-full w-0.5 bg-foreground/70"
                    style={{ left: `${Math.min(item.group, 100)}%` }}
                    title={`${language === "nl" ? "Groepsgemiddelde" : "Moyenne groupe"}: ${item.group}%`}
                  />
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-primary" />
                    {language === "nl" ? "Kantoor" : "Bureau"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-0.5 bg-foreground/70" />
                    {language === "nl" ? "Groepsgemiddelde" : "Moyenne groupe"} ({item.group}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
