import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useBarometerStore } from "@/store/useBarometerStore";
import { t } from "@/i18n/translations";
import {
  filterByYear, filterBySourceLang, getComputed, formatCurrency,
  calcWeightedRanking, calcFrequency, satisfactionScore, recommendScore,
  alignmentScore, calcBenchmark, isOutlier
} from "@/utils/benchmarkCalc";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Cell, PieChart, Pie, LineChart, Line, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { X } from "lucide-react";

const TABS = ["financial", "personnel", "companies", "strategy", "engagement", "topbottom", "evolution", "compare"] as const;
type Tab = (typeof TABS)[number];
const TAB_KEYS: Record<Tab, string> = {
  financial: "group.financial",
  personnel: "group.personnel",
  companies: "group.companies",
  strategy: "group.strategy",
  engagement: "group.engagement",
  topbottom: "group.top_bottom",
  evolution: "group.evolution",
  compare: "group.compare",
};

const COLORS = ["hsl(262,30%,53%)", "hsl(262,30%,68%)", "hsl(262,40%,78%)", "hsl(262,20%,85%)", "hsl(122,39%,49%)", "hsl(14,100%,63%)"];

export default function GroupDashboard() {
  const { language, selectedYear, sourceLanguageFilter, allData, meta } = useBarometerStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as Tab) || "financial";

  const data = useMemo(() => filterBySourceLang(filterByYear(allData, selectedYear), sourceLanguageFilter), [allData, selectedYear, sourceLanguageFilter]);

  const setTab = (tab: Tab) => setSearchParams({ tab });

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground animate-fade-in">
        <p>{t("status.no_data", language)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold animate-fade-in">{t("nav.group", language)}</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted p-1 animate-fade-in" style={{ animationDelay: "60ms" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setTab(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab ? "bg-card text-foreground card-shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(TAB_KEYS[tab], language)}
          </button>
        ))}
      </div>

      <div className="animate-fade-in" style={{ animationDelay: "120ms" }}>
        {activeTab === "financial" && <FinancialTab data={data} language={language} />}
        {activeTab === "personnel" && <PersonnelTab data={data} language={language} />}
        {activeTab === "companies" && <CompaniesTab data={data} language={language} />}
        {activeTab === "strategy" && <StrategyTab data={data} language={language} />}
        {activeTab === "engagement" && <EngagementTab data={data} language={language} />}
        {activeTab === "topbottom" && <TopBottomTab data={data} language={language} />}
        {activeTab === "evolution" && <EvolutionTab allData={allData} meta={meta} sourceLanguageFilter={sourceLanguageFilter} language={language} />}
        {activeTab === "compare" && <CompareTab data={data} language={language} />}
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 card-shadow">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function FinancialTab({ data, language }: { data: import("@/types/barometer").OfficeRecord[]; language: "nl" | "fr" }) {
  type SortCol = "office_name" | "commission_ins" | "commission_bank" | "total_commission" | "commission_per_fte";
  const [sortCol, setSortCol] = useState<SortCol>("commission_ins");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(col === "office_name"); }
  };

  const commData = useMemo(() =>
    data
      .filter((r) => r.commission_insurance !== null)
      .map((r) => ({ name: r.office_name.slice(0, 20), value: r.commission_insurance! }))
      .sort((a, b) => b.value - a.value),
    [data]
  );

  const commBankData = useMemo(() =>
    data
      .filter((r) => r.commission_bank !== null)
      .map((r) => ({ name: r.office_name.slice(0, 20), value: r.commission_bank! }))
      .sort((a, b) => b.value - a.value),
    [data]
  );


  const privateSmeData = useMemo(() =>
    data
      .filter((r) => r.pct_private !== null)
      .map((r) => ({ name: r.office_name.slice(0, 20), private: r.pct_private!, sme: r.pct_sme || 0 }))
      .sort((a, b) => b.private - a.private),
    [data]
  );

  const sortedData = useMemo(() => {
    const withComputed = data.map((r) => ({ record: r, computed: getComputed(r) }));
    const dir = sortAsc ? 1 : -1;
    return withComputed.sort((a, b) => {
      let va: number | string, vb: number | string;
      switch (sortCol) {
        case "office_name": va = a.record.office_name.toLowerCase(); vb = b.record.office_name.toLowerCase(); return va < vb ? -dir : va > vb ? dir : 0;
        case "commission_ins": va = a.record.commission_insurance ?? -Infinity; vb = b.record.commission_insurance ?? -Infinity; break;
        case "commission_bank": va = a.record.commission_bank ?? -Infinity; vb = b.record.commission_bank ?? -Infinity; break;
        case "total_commission": va = a.computed.total_commission ?? -Infinity; vb = b.computed.total_commission ?? -Infinity; break;
        case "commission_per_fte": va = a.computed.commission_per_fte ?? -Infinity; vb = b.computed.commission_per_fte ?? -Infinity; break;
        default: return 0;
      }
      return ((va as number) - (vb as number)) * dir;
    });
  }, [data, sortCol, sortAsc]);

  const SortHeader = ({ col, label, align }: { col: SortCol; label: string; align?: string }) => (
    <th
      className={`pb-2 pr-4 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortCol === col ? (
          <span className="text-primary text-[10px]">{sortAsc ? "▲" : "▼"}</span>
        ) : (
          <span className="text-muted-foreground/40 text-[10px]">⇅</span>
        )}
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={t("field.commission_ins", language)}>
          <ResponsiveContainer width="100%" height={Math.max(300, commData.length * 28)}>
            <BarChart data={commData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(252,25%,90%)" />
              <XAxis type="number" tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" fill="hsl(262,30%,53%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>


      {/* Summary table */}
      <SectionCard title={`${t("nav.group", language)} — ${t("group.financial", language)}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <SortHeader col="office_name" label={t("field.office_name", language)} />
                <SortHeader col="commission_ins" label={t("field.commission_ins", language)} align="right" />
                <SortHeader col="commission_bank" label={t("field.commission_bank", language)} align="right" />
                <SortHeader col="total_commission" label={t("field.total_commission", language)} align="right" />
                <SortHeader col="commission_per_fte" label={t("field.commission_per_fte", language)} align="right" />
              </tr>
            </thead>
            <tbody>
              {sortedData.map(({ record: r, computed: c }, i) => (
                <tr key={r.office_name} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-primary-light/30" : ""}`}>
                  <td className="py-2 pr-4 font-medium">{r.office_name}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatCurrency(r.commission_insurance)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatCurrency(r.commission_bank)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatCurrency(c.total_commission)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(c.commission_per_fte)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function PersonnelTab({ data, language }: { data: import("@/types/barometer").OfficeRecord[]; language: "nl" | "fr" }) {
  const efficiencyData = useMemo(() =>
    data
      .map((r) => ({ name: r.office_name.slice(0, 20), value: getComputed(r).commission_per_fte }))
      .filter((d) => d.value !== null)
      .sort((a, b) => b.value! - a.value!) as { name: string; value: number }[],
    [data]
  );

  const fteData = useMemo(() =>
    data
      .map((r) => {
        const c = getComputed(r);
        return { name: r.office_name.slice(0, 25), fullName: r.office_name, fte: c.total_fte, managers: r.num_managers ?? 0, employees: r.num_employees_fte ?? 0 };
      })
      .filter((d) => d.fte !== null)
      .sort((a, b) => b.fte! - a.fte!) as { name: string; fullName: string; fte: number; managers: number; employees: number }[],
    [data]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={`${t("kpi.avg_fte", language)} ${language === "nl" ? "per kantoor" : "par bureau"}`}>
          <ResponsiveContainer width="100%" height={Math.max(300, fteData.length * 28)}>
            <BarChart data={fteData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(252,25%,90%)" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 9 }} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold mb-1">{d.fullName}</p>
                    <p className="text-muted-foreground">{t("field.managers", language)}: {d.managers}</p>
                    <p className="text-muted-foreground">{t("field.employees", language)}: {d.employees}</p>
                    <p className="font-medium mt-1">Total FTE: {d.fte}</p>
                  </div>
                );
              }} />
              <Bar dataKey="managers" stackId="fte" fill="hsl(262,30%,53%)" name={t("field.managers", language)} />
              <Bar dataKey="employees" stackId="fte" fill="hsl(262,40%,78%)" name={t("field.employees", language)} radius={[0, 4, 4, 0]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title={t("field.commission_per_fte", language)}>
          <ResponsiveContainer width="100%" height={Math.max(300, efficiencyData.length * 26)}>
            <BarChart data={efficiencyData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(252,25%,90%)" />
              <XAxis type="number" tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" fill="hsl(122,39%,49%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
    </div>
  );
}

function CompaniesTab({ data, language }: { data: import("@/types/barometer").OfficeRecord[]; language: "nl" | "fr" }) {
  const nonLifeRanking = useMemo(() => calcWeightedRanking(data, "ranking_nonlife"), [data]);
  const lifeRanking = useMemo(() => calcWeightedRanking(data, "ranking_life"), [data]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {[
          { title: t("field.companies_nonlife", language), ranking: nonLifeRanking },
          { title: t("field.companies_life", language), ranking: lifeRanking },
        ].map(({ title, ranking }) => (
          <SectionCard key={title} title={title}>
            <div className="mb-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ranking.slice(0, 5)} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(252,25%,90%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="company" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="totalPoints" fill="hsl(262,30%,53%)" radius={[0, 4, 4, 0]} name={t("common.points", language)} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-2 font-medium text-muted-foreground">{t("common.rank", language)}</th>
                  <th className="pb-2 pr-2 font-medium text-muted-foreground">{t("common.company", language)}</th>
                  <th className="pb-2 pr-2 font-medium text-muted-foreground text-right">{t("common.points", language)}</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">{t("common.in_top3", language)}</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.company} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-primary-light/30" : ""}`}>
                    <td className="py-1.5 pr-2 tabular-nums">{r.rank}</td>
                    <td className="py-1.5 pr-2">{r.company}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{r.totalPoints}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.inTop3}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}

function StrategyTab({ data, language }: { data: import("@/types/barometer").OfficeRecord[]; language: "nl" | "fr" }) {
  const growthDist = useMemo(() => calcFrequency(data, "growth_phase"), [data]);
  const priorityDist = useMemo(() => calcFrequency(data, "priorities").slice(0, 10), [data]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={t("field.growth_phase", language)}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={growthDist.map((d) => ({ ...d, name: d.label.slice(0, 40) }))} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, count }: { name: string; count: number }) => `${name.slice(0, 15)}… (${count})`} labelLine={false}>
                {growthDist.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title={t("field.priorities", language)}>
          <ResponsiveContainer width="100%" height={Math.max(300, priorityDist.length * 36)}>
            <BarChart data={priorityDist} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(252,25%,90%)" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={250} tick={{ fontSize: 9 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(262,30%,53%)" radius={[0, 4, 4, 0]} name={t("common.frequency", language)} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
    </div>
  );
}

function EngagementTab({ data, language }: { data: import("@/types/barometer").OfficeRecord[]; language: "nl" | "fr" }) {
  const satDist = useMemo(() => calcFrequency(data, "satisfaction_aquilae"), [data]);
  const recDist = useMemo(() => calcFrequency(data, "recommend_aquilae"), [data]);

  const avgScores = useMemo(() => {
    const sat = data.map((r) => satisfactionScore(r.satisfaction_aquilae)).filter((v): v is number => v !== null);
    const rec = data.map((r) => recommendScore(r.recommend_aquilae)).filter((v): v is number => v !== null);
    const mis = data.map((r) => alignmentScore(r.mission_alignment)).filter((v): v is number => v !== null);
    const vis = data.map((r) => alignmentScore(r.vision_alignment)).filter((v): v is number => v !== null);
    const val = data.map((r) => alignmentScore(r.values_alignment)).filter((v): v is number => v !== null);
    const cha = data.map((r) => alignmentScore(r.participation_charter)).filter((v): v is number => v !== null);
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
    return [
      { label: t("field.satisfaction", language), score: avg(sat), max: 3 },
      { label: t("field.recommend", language), score: avg(rec), max: 3 },
      { label: t("field.mission", language), score: avg(mis), max: 4 },
      { label: t("field.vision", language), score: avg(vis), max: 4 },
      { label: t("field.values", language), score: avg(val), max: 4 },
      { label: t("field.charter", language), score: avg(cha), max: 4 },
    ];
  }, [data, language]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={t("field.satisfaction", language)}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={satDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(252,25%,90%)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(262,30%,53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title={t("field.recommend", language)}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={recDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(252,25%,90%)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(122,39%,49%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      <SectionCard title={`${t("benchmark.mean", language)} scores`}>
        <div className="space-y-3">
          {avgScores.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-40 text-sm text-muted-foreground">{item.label}</span>
              <div className="flex-1 h-6 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: item.score !== null ? `${(item.score / item.max) * 100}%` : "0%" }}
                />
              </div>
              <span className="w-16 text-right text-sm font-medium tabular-nums">
                {item.score !== null ? `${item.score.toFixed(2)}/${item.max}` : "—"}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function TopBottomTab({ data, language }: { data: import("@/types/barometer").OfficeRecord[]; language: "nl" | "fr" }) {
  const { top5Comm, bottom5Comm, top5Eff, outliers } = useMemo(() => {
    const withComm = data
      .filter((r) => r.commission_insurance !== null)
      .map((r) => ({ name: r.office_name, commission: r.commission_insurance!, lang: r.source_language }))
      .sort((a, b) => b.commission - a.commission);

    const withEff = data
      .map((r) => {
        const c = getComputed(r);
        return { name: r.office_name, efficiency: c.commission_per_fte, lang: r.source_language };
      })
      .filter((d) => d.efficiency !== null)
      .sort((a, b) => b.efficiency! - a.efficiency!) as { name: string; efficiency: number; lang: string }[];

    // Outlier detection on commission_insurance
    const commValues = withComm.map((d) => d.commission);
    const sorted = [...commValues].sort((a, b) => a - b);
    const q1Idx = Math.floor(sorted.length * 0.25);
    const q3Idx = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Idx] ?? 0;
    const q3 = sorted[q3Idx] ?? 0;

    const outlierList = withComm.filter((d) => isOutlier(d.commission, q1, q3));

    return {
      top5Comm: withComm.slice(0, 5),
      bottom5Comm: withComm.slice(-5).reverse(),
      top5Eff: withEff.slice(0, 5),
      outliers: outlierList,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top 5 Commission */}
        <SectionCard title={t("group.top5_commission", language)}>
          <div className="space-y-2">
            {top5Comm.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{d.name}</span>
                    <span className="ml-2 text-sm font-semibold tabular-nums">{formatCurrency(d.commission)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(d.commission / (top5Comm[0]?.commission || 1)) * 100}%` }} />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">{d.lang.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Bottom 5 Commission */}
        <SectionCard title={t("group.bottom5_commission", language)}>
          <div className="space-y-2">
            {bottom5Comm.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-orange/10 text-xs font-bold text-accent-orange">{data.filter((r) => r.commission_insurance !== null).length - i}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{d.name}</span>
                    <span className="ml-2 text-sm font-semibold tabular-nums">{formatCurrency(d.commission)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-accent-orange transition-all" style={{ width: `${(d.commission / (top5Comm[0]?.commission || 1)) * 100}%` }} />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">{d.lang.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top 5 Efficiency */}
        <SectionCard title={t("group.top5_efficiency", language)}>
          <div className="space-y-2">
            {top5Eff.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-green/10 text-xs font-bold text-accent-green">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{d.name}</span>
                    <span className="ml-2 text-sm font-semibold tabular-nums">{formatCurrency(d.efficiency)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-accent-green transition-all" style={{ width: `${(d.efficiency / (top5Eff[0]?.efficiency || 1)) * 100}%` }} />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">{d.lang.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Outliers */}
        <SectionCard title={t("group.outliers", language)}>
          {outliers.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {language === "nl" ? "Geen uitschieters gedetecteerd (1,5× IQR)" : "Aucune valeur aberrante detectee (1,5x IQR)"}
            </p>
          ) : (
            <div className="space-y-2">
              {outliers.map((d) => {
                const commValues = data.map((r) => r.commission_insurance).filter((v): v is number => v !== null);
                const sorted = [...commValues].sort((a, b) => a - b);
                const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
                const isHigh = d.commission > q3;
                return (
                  <div key={d.name} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isHigh ? "bg-accent-green/10 text-accent-green" : "bg-accent-orange/10 text-accent-orange"}`}>
                      {isHigh ? "↑" : "↓"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium">{d.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{d.lang.toUpperCase()}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(d.commission)}</span>
                  </div>
                );
              })}
              <p className="mt-2 text-[10px] text-muted-foreground">
                {language === "nl" ? "Waarden > 1,5× IQR boven Q3 of onder Q1 voor commissie verzekeringen" : "Valeurs > 1,5x IQR au-dessus de Q3 ou en dessous de Q1 pour commission assurances"}
              </p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function EvolutionTab({ allData, meta, sourceLanguageFilter, language }: {
  allData: import("@/types/barometer").OfficeRecord[];
  meta: { available_years: number[] };
  sourceLanguageFilter: "nl" | "fr" | "all";
  language: "nl" | "fr";
}) {
  const evolutionData = useMemo(() => {
    return meta.available_years.map((year) => {
      const yearData = filterBySourceLang(filterByYear(allData, year), sourceLanguageFilter);
      const n = yearData.length;
      if (n === 0) return null;

      const comms = yearData.map((r) => getComputed(r).total_commission).filter((v): v is number => v !== null);
      const ftes = yearData.map((r) => getComputed(r).total_fte).filter((v): v is number => v !== null);
      const sats = yearData.map((r) => satisfactionScore(r.satisfaction_aquilae)).filter((v): v is number => v !== null);

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

      return {
        year,
        avgComm: avg(comms),
        avgFte: avg(ftes),
        avgSat: avg(sats),
        officeCount: n,
      };
    }).filter(Boolean);
  }, [allData, meta.available_years, sourceLanguageFilter]);

  if (evolutionData.length < 2) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 card-shadow text-center">
        <p className="text-sm text-muted-foreground">{t("evolution.no_history", language)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={t("group.avg_commission_trend", language)}>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={evolutionData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [formatCurrency(v), t("benchmark.mean", language)]} labelFormatter={(l) => `${t("evolution.year", language)}: ${l}`} />
              <Line type="monotone" dataKey="avgComm" name={t("benchmark.mean", language)} stroke="hsl(262,30%,53%)" strokeWidth={2.5} dot={{ r: 5, fill: "hsl(262,30%,53%)" }} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title={t("group.avg_fte_trend", language)}>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={evolutionData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [v?.toFixed(1) ?? "—", t("benchmark.mean", language)]} labelFormatter={(l) => `${t("evolution.year", language)}: ${l}`} />
              <Line type="monotone" dataKey="avgFte" name={t("benchmark.mean", language)} stroke="hsl(122,39%,49%)" strokeWidth={2.5} dot={{ r: 5, fill: "hsl(122,39%,49%)" }} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title={t("group.avg_satisfaction_trend", language)}>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={evolutionData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 3]} ticks={[0, 1, 2, 3]} />
              <Tooltip formatter={(v: number) => [v?.toFixed(2) ?? "—", t("benchmark.mean", language)]} labelFormatter={(l) => `${t("evolution.year", language)}: ${l}`} />
              <Line type="monotone" dataKey="avgSat" name={t("benchmark.mean", language)} stroke="hsl(35,90%,55%)" strokeWidth={2.5} dot={{ r: 5, fill: "hsl(35,90%,55%)" }} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title={t("group.office_count_trend", language)}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={evolutionData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip labelFormatter={(l) => `${t("evolution.year", language)}: ${l}`} />
              <Bar dataKey="officeCount" fill="hsl(262,30%,53%)" radius={[4, 4, 0, 0]} name={t("common.offices", language)} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
    </div>
  );
}

const COMPARE_COLORS = ["hsl(262,30%,53%)", "hsl(122,39%,49%)", "hsl(14,100%,63%)", "hsl(200,70%,50%)", "hsl(45,90%,50%)", "hsl(310,50%,55%)"];

function CompareTab({ data, language }: { data: import("@/types/barometer").OfficeRecord[]; language: "nl" | "fr" }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const offices = useMemo(() => data.map((r) => r.office_name).sort(), [data]);
  const filtered = useMemo(() => {
    if (!search) return offices.filter((n) => !selected.includes(n));
    return offices.filter((n) => !selected.includes(n) && n.toLowerCase().includes(search.toLowerCase()));
  }, [offices, selected, search]);

  const addOffice = (name: string) => {
    setSelected((prev) => [...prev, name]);
    setSearch("");
  };
  const removeOffice = (name: string) => setSelected((prev) => prev.filter((n) => n !== name));

  const selectedData = useMemo(() =>
    selected.map((name) => {
      const r = data.find((d) => d.office_name === name)!;
      const c = getComputed(r);
      return { record: r, computed: c };
    }),
    [selected, data]
  );

  const radarData = useMemo(() => {
    if (selectedData.length < 2) return [];
    const allComm = data.map((r) => r.commission_insurance).filter((v): v is number => v !== null);
    const allFte = data.map((r) => getComputed(r).total_fte).filter((v): v is number => v !== null);
    const allEff = data.map((r) => getComputed(r).commission_per_fte).filter((v): v is number => v !== null);
    const allSat = data.map((r) => satisfactionScore(r.satisfaction_aquilae)).filter((v): v is number => v !== null);
    const maxComm = Math.max(...allComm, 1);
    const maxFte = Math.max(...allFte, 1);
    const maxEff = Math.max(...allEff, 1);
    const maxSat = Math.max(...allSat, 1);

    const metrics = [
      { key: "comm", label: t("field.commission_ins", language), getValue: (r: import("@/types/barometer").OfficeRecord) => r.commission_insurance, max: maxComm },
      { key: "fte", label: t("kpi.avg_fte", language), getValue: (r: import("@/types/barometer").OfficeRecord) => getComputed(r).total_fte, max: maxFte },
      { key: "eff", label: t("field.commission_per_fte", language), getValue: (r: import("@/types/barometer").OfficeRecord) => getComputed(r).commission_per_fte, max: maxEff },
      { key: "sat", label: t("field.satisfaction", language), getValue: (r: import("@/types/barometer").OfficeRecord) => satisfactionScore(r.satisfaction_aquilae), max: maxSat },
    ];

    return metrics.map((m) => {
      const point: Record<string, string | number> = { metric: m.label };
      selectedData.forEach(({ record }, i) => {
        const val = m.getValue(record);
        point[`office_${i}`] = val !== null ? (val / m.max) * 100 : 0;
      });
      return point;
    });
  }, [selectedData, data, language]);

  return (
    <div className="space-y-6">
      {/* Office selector */}
      <SectionCard title={t("compare.select_offices", language)}>
        <div className="flex flex-wrap gap-2 mb-3">
          {selected.map((name, i) => (
            <span key={name} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length] }}>
              {name}
              <button onClick={() => removeOffice(name)} className="hover:opacity-70 transition-opacity"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("compare.add_office", language)}
            className="w-full max-w-sm rounded-lg border border-border bg-background py-2 pl-3 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {search && filtered.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-48 w-full max-w-sm overflow-auto rounded-lg border border-border bg-card shadow-lg">
              {filtered.slice(0, 10).map((name) => (
                <li key={name}>
                  <button onClick={() => addOffice(name)} className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors">{name}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      {selectedData.length < 2 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          {t("compare.no_selection", language)}
        </div>
      ) : (
        <>
          {/* Radar chart */}
          {radarData.length > 0 && (
            <SectionCard title={t("compare.radar_title", language)}>
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={120}>
                  <PolarGrid stroke="hsl(252,25%,90%)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  {selectedData.map((_, i) => (
                    <Radar
                      key={i}
                      name={selected[i]}
                      dataKey={`office_${i}`}
                      stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                      fill={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(0)}%`} />
                </RadarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {/* Comparison table */}
          <SectionCard title={`${t("group.compare", language)} — ${language === "nl" ? "Detail" : "Détail"}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-4 text-left font-medium text-muted-foreground" />
                    {selectedData.map(({ record }, i) => (
                      <th key={record.office_name} className="pb-2 pr-4 text-right font-medium" style={{ color: COMPARE_COLORS[i % COMPARE_COLORS.length] }}>
                        {record.office_name.slice(0, 25)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: t("field.commission_ins", language), getValue: (r: import("@/types/barometer").OfficeRecord, c: import("@/types/barometer").ComputedFields) => formatCurrency(r.commission_insurance) },
                    { label: t("field.commission_bank", language), getValue: (r: import("@/types/barometer").OfficeRecord, c: import("@/types/barometer").ComputedFields) => formatCurrency(r.commission_bank) },
                    { label: t("field.total_commission", language), getValue: (_: import("@/types/barometer").OfficeRecord, c: import("@/types/barometer").ComputedFields) => formatCurrency(c.total_commission) },
                    { label: t("field.commission_per_fte", language), getValue: (_: import("@/types/barometer").OfficeRecord, c: import("@/types/barometer").ComputedFields) => formatCurrency(c.commission_per_fte) },
                    { label: t("field.managers", language), getValue: (r: import("@/types/barometer").OfficeRecord) => r.num_managers !== null ? String(r.num_managers) : "—" },
                    { label: t("field.employees", language), getValue: (r: import("@/types/barometer").OfficeRecord) => r.num_employees_fte !== null ? String(r.num_employees_fte) : "—" },
                    { label: t("kpi.avg_fte", language), getValue: (_: import("@/types/barometer").OfficeRecord, c: import("@/types/barometer").ComputedFields) => c.total_fte !== null ? String(c.total_fte) : "—" },
                    { label: t("field.pct_private", language), getValue: (r: import("@/types/barometer").OfficeRecord) => r.pct_private !== null ? `${r.pct_private}%` : "—" },
                    { label: t("field.pct_sme", language), getValue: (r: import("@/types/barometer").OfficeRecord) => r.pct_sme !== null ? `${r.pct_sme}%` : "—" },
                    { label: t("field.satisfaction", language), getValue: (r: import("@/types/barometer").OfficeRecord) => r.satisfaction_aquilae || "—" },
                    { label: t("field.recommend", language), getValue: (r: import("@/types/barometer").OfficeRecord) => r.recommend_aquilae || "—" },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium text-muted-foreground">{row.label}</td>
                      {selectedData.map(({ record, computed }) => (
                        <td key={record.office_name} className="py-2 pr-4 text-right tabular-nums">{row.getValue(record, computed)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Bar comparison */}
          <SectionCard title={t("field.commission_ins", language)}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={selectedData.map(({ record }, i) => ({ name: record.office_name.slice(0, 20), value: record.commission_insurance ?? 0, fill: COMPARE_COLORS[i % COMPARE_COLORS.length] }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(252,25%,90%)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {selectedData.map((_, i) => (
                    <Cell key={i} fill={COMPARE_COLORS[i % COMPARE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </>
      )}
    </div>
  );
}
