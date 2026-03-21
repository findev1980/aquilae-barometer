import { useMemo, useState } from "react";
import { useBarometerStore } from "@/store/useBarometerStore";
import { t } from "@/i18n/translations";
import {
  filterByYear, filterBySourceLang, getComputed, formatCurrency,
  calcBenchmark, calcWeightedRanking, satisfactionScore, recommendScore,
  alignmentScore
} from "@/utils/benchmarkCalc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Download, Loader2, TrendingUp } from "lucide-react";
import { generateOfficePDF, generateOfficeFileName } from "@/utils/pdfGenerator";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, LineChart, Line } from "recharts";
import type { OfficeRecord } from "@/types/barometer";

function BenchmarkRow({ label, value, mean, median, percentile, quartile, formatFn }: {
  label: string; value: number | null; mean: number | null; median: number | null;
  percentile: number | null; quartile: number | null; formatFn: (v: number | null) => string;
}) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-2 pr-3 text-sm font-medium">{label}</td>
      <td className="py-2 pr-3 text-right text-sm tabular-nums font-semibold">{formatFn(value)}</td>
      <td className="py-2 pr-3 text-right text-sm tabular-nums text-muted-foreground">{formatFn(mean)}</td>
      <td className="py-2 pr-3 text-right text-sm tabular-nums text-muted-foreground">{formatFn(median)}</td>
      <td className="py-2 pr-3 text-right text-sm tabular-nums">{percentile !== null ? `P${percentile}` : "—"}</td>
      <td className="py-2 text-right text-sm tabular-nums">{quartile !== null ? `Q${quartile}` : "—"}</td>
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

  const nonLifeRanking = useMemo(() => calcWeightedRanking(data, "ranking_nonlife").slice(0, 5), [data]);
  const lifeRanking = useMemo(() => calcWeightedRanking(data, "ranking_life").slice(0, 5), [data]);

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
                      <th className="pb-2 pr-3 text-right text-xs font-medium text-muted-foreground">{t("benchmark.mean", language)}</th>
                      <th className="pb-2 pr-3 text-right text-xs font-medium text-muted-foreground">{t("benchmark.median", language)}</th>
                      <th className="pb-2 pr-3 text-right text-xs font-medium text-muted-foreground">{t("benchmark.percentile", language)}</th>
                      <th className="pb-2 text-right text-xs font-medium text-muted-foreground">{t("benchmark.quartile", language)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <BenchmarkRow label={t("field.commission_ins", language)} value={office.commission_insurance} mean={benchmarks.commIns.mean} median={benchmarks.commIns.median} percentile={benchmarks.commIns.percentile} quartile={benchmarks.commIns.quartile} formatFn={formatCurrency} />
                    <BenchmarkRow label={t("field.commission_bank", language)} value={office.commission_bank} mean={benchmarks.commBank.mean} median={benchmarks.commBank.median} percentile={benchmarks.commBank.percentile} quartile={benchmarks.commBank.quartile} formatFn={formatCurrency} />
                    <BenchmarkRow label={t("field.total_commission", language)} value={benchmarks.computed.total_commission} mean={benchmarks.totalComm.mean} median={benchmarks.totalComm.median} percentile={benchmarks.totalComm.percentile} quartile={benchmarks.totalComm.quartile} formatFn={formatCurrency} />
                    <BenchmarkRow label={t("field.commission_per_fte", language)} value={benchmarks.computed.commission_per_fte} mean={benchmarks.commPerFte.mean} median={benchmarks.commPerFte.median} percentile={benchmarks.commPerFte.percentile} quartile={benchmarks.commPerFte.quartile} formatFn={formatCurrency} />
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">n = {benchmarks.commIns.n} {t("common.offices", language)}</p>
            </div>
          )}

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
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t("field.companies_nonlife", language)}</p>
                  <ol className="space-y-0.5">
                    {office.ranking_nonlife.slice(0, 5).map((c, i) => {
                      const inGroupTop5 = nonLifeRanking.some((r) => r.company === c);
                      return <li key={i} className={`text-xs ${inGroupTop5 ? "font-semibold text-primary" : ""}`}>{i + 1}. {c}</li>;
                    })}
                  </ol>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t("field.companies_life", language)}</p>
                  <ol className="space-y-0.5">
                    {office.ranking_life.slice(0, 5).map((c, i) => {
                      const inGroupTop5 = lifeRanking.some((r) => r.company === c);
                      return <li key={i} className={`text-xs ${inGroupTop5 ? "font-semibold text-primary" : ""}`}>{i + 1}. {c}</li>;
                    })}
                  </ol>
                </div>
              </div>
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
