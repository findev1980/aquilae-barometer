import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useBarometerStore } from "@/store/useBarometerStore";
import { t } from "@/i18n/translations";
import {
  filterByYear, filterBySourceLang, getComputed, formatCurrency,
  calcWeightedRanking, calcFrequency, satisfactionScore, recommendScore,
  alignmentScore, calcBenchmark
} from "@/utils/benchmarkCalc";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Cell, PieChart, Pie, LineChart, Line, Legend, ReferenceLine,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { X, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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


  const privateSmeData = useMemo(() =>
    data
      .filter((r) => r.pct_private !== null || r.pct_sme !== null)
      .map((r) => ({ name: r.office_name.slice(0, 20), fullName: r.office_name, private: r.pct_private ?? 0, sme: r.pct_sme ?? 0 }))
      .sort((a, b) => b.private - a.private),
    [data]
  );

  const lifeNonlifeData = useMemo(() =>
    data
      .filter((r) => r.pct_life !== null || r.pct_nonlife !== null)
      .map((r) => ({ name: r.office_name.slice(0, 20), fullName: r.office_name, life: r.pct_life ?? 0, nonlife: r.pct_nonlife ?? 0 }))
      .sort((a, b) => b.nonlife - a.nonlife),
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
        <SectionCard title={t("field.commission_bank", language)}>
          <ResponsiveContainer width="100%" height={Math.max(300, commBankData.length * 28)}>
            <BarChart data={commBankData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(252,25%,90%)" />
              <XAxis type="number" tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" fill="hsl(221,50%,55%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={`${t("field.pct_private", language)} / ${t("field.pct_sme", language)}`}>
          <ResponsiveContainer width="100%" height={Math.max(300, privateSmeData.length * 26)}>
            <BarChart data={privateSmeData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(252,25%,90%)" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold mb-1">{d.fullName}</p>
                    <p className="text-muted-foreground">{t("field.pct_private", language)}: {d.private}%</p>
                    <p className="text-muted-foreground">{t("field.pct_sme", language)}: {d.sme}%</p>
                    <hr className="my-1 border-border" />
                    <p className="text-muted-foreground">{language === "nl" ? "Groepsgemiddelde" : "Moyenne groupe"}:</p>
                    <p className="text-muted-foreground">&nbsp;&nbsp;{t("field.pct_private", language)}: {avgPrivate.toFixed(1)}%</p>
                    <p className="text-muted-foreground">&nbsp;&nbsp;{t("field.pct_sme", language)}: {avgSme.toFixed(1)}%</p>
                  </div>
                );
              }} />
              <ReferenceLine x={avgPrivate} stroke="hsl(262,50%,40%)" strokeDasharray="5 3" strokeWidth={2} label={{ value: `⌀ ${avgPrivate.toFixed(0)}%`, position: "top", fontSize: 10, fill: "hsl(262,50%,40%)" }} />
              <Bar dataKey="private" stackId="ps" fill="hsl(262,30%,53%)" name={t("field.pct_private", language)} />
              <Bar dataKey="sme" stackId="ps" fill="hsl(262,40%,78%)" name={t("field.pct_sme", language)} radius={[0, 4, 4, 0]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title={`${t("field.pct_life", language)} / ${t("field.pct_nonlife", language)}`}>
          <ResponsiveContainer width="100%" height={Math.max(300, lifeNonlifeData.length * 26)}>
            <BarChart data={lifeNonlifeData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(252,25%,90%)" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold mb-1">{d.fullName}</p>
                    <p className="text-muted-foreground">{t("field.pct_life", language)}: {d.life}%</p>
                    <p className="text-muted-foreground">{t("field.pct_nonlife", language)}: {d.nonlife}%</p>
                    <hr className="my-1 border-border" />
                    <p className="text-muted-foreground">{language === "nl" ? "Groepsgemiddelde" : "Moyenne groupe"}:</p>
                    <p className="text-muted-foreground">&nbsp;&nbsp;{t("field.pct_life", language)}: {avgLife.toFixed(1)}%</p>
                    <p className="text-muted-foreground">&nbsp;&nbsp;{t("field.pct_nonlife", language)}: {avgNonlife.toFixed(1)}%</p>
                  </div>
                );
              }} />
              <ReferenceLine x={avgNonlife} stroke="hsl(14,60%,40%)" strokeDasharray="5 3" strokeWidth={2} label={{ value: `⌀ ${avgNonlife.toFixed(0)}%`, position: "top", fontSize: 10, fill: "hsl(14,60%,40%)" }} />
              <Bar dataKey="nonlife" stackId="ln" fill="hsl(14,80%,55%)" name={t("field.pct_nonlife", language)} />
              <Bar dataKey="life" stackId="ln" fill="hsl(45,85%,55%)" name={t("field.pct_life", language)} radius={[0, 4, 4, 0]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
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
      <div className="flex items-center gap-2 mb-2">
        <Popover>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Info className="h-3.5 w-3.5" />
              {language === "nl" ? "Hoe worden punten berekend?" : "Comment les points sont-ils calculés ?"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 text-sm" align="start">
            <p className="font-semibold mb-2">{language === "nl" ? "Puntentelling" : "Calcul des points"}</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>{language === "nl" ? "• Positie 1 = 5 punten" : "• Position 1 = 5 points"}</li>
              <li>{language === "nl" ? "• Positie 2 = 4 punten" : "• Position 2 = 4 points"}</li>
              <li>{language === "nl" ? "• Positie 3 = 3 punten" : "• Position 3 = 3 points"}</li>
              <li>{language === "nl" ? "• Positie 4 = 2 punten" : "• Position 4 = 2 points"}</li>
              <li>{language === "nl" ? "• Positie 5 = 1 punt" : "• Position 5 = 1 point"}</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              {language === "nl"
                ? "Elk kantoor geeft een top 5 op. De punten worden opgeteld per maatschappij. 'In Top 3' toont hoe vaak een maatschappij in de top 3 van een kantoor stond."
                : "Chaque bureau fournit un top 5. Les points sont additionnés par compagnie. 'Dans le Top 3' indique combien de fois une compagnie figurait dans le top 3 d'un bureau."}
            </p>
          </PopoverContent>
        </Popover>
      </div>
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
          <div className="space-y-3">
            {growthDist.map((d, i) => {
              const total = growthDist.reduce((s, g) => s + g.count, 0);
              const pct = total > 0 ? (d.count / total) * 100 : 0;
              return (
                <div key={d.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate mr-2" title={d.label}>{d.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {d.count} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="pt-2 text-xs text-muted-foreground tabular-nums">
              {language === "nl" ? "Totaal" : "Total"}: {growthDist.reduce((s, g) => s + g.count, 0)} {t("common.offices", language)}
            </p>
          </div>
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

    const infoSat = language === "nl"
      ? "Score van 1 (ontevreden) tot 3 (zeer tevreden) over de algemene tevredenheid met Aquilae."
      : "Score de 1 (insatisfait) à 3 (très satisfait) sur la satisfaction générale envers Aquilae.";
    const infoRec = language === "nl"
      ? "Score van 1 (zou niet aanbevelen) tot 3 (zou zeker aanbevelen)."
      : "Score de 1 (ne recommanderait pas) à 3 (recommanderait certainement).";
    const infoAlignment = language === "nl"
      ? "Score van 1 (helemaal niet akkoord) tot 4 (helemaal akkoord)."
      : "Score de 1 (pas du tout d'accord) à 4 (tout à fait d'accord).";

    return [
      { label: t("field.satisfaction", language), score: avg(sat), max: 3, info: infoSat },
      { label: t("field.recommend", language), score: avg(rec), max: 3, info: infoRec },
      { label: t("field.mission", language), score: avg(mis), max: 4, info: infoAlignment },
      { label: t("field.vision", language), score: avg(vis), max: 4, info: infoAlignment },
      { label: t("field.values", language), score: avg(val), max: 4, info: infoAlignment },
      { label: t("field.charter", language), score: avg(cha), max: 4, info: infoAlignment },
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
              <span className="w-40 text-sm text-muted-foreground flex items-center gap-1">
                {item.label}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" className="text-xs max-w-[220px] p-2">
                    {item.info}
                  </PopoverContent>
                </Popover>
              </span>
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
  const rankings = useMemo(() => {
    const withCommIns = data
      .filter((r) => r.commission_insurance !== null)
      .map((r) => ({ name: r.office_name, value: r.commission_insurance!, lang: r.source_language }))
      .sort((a, b) => b.value - a.value);

    const withCommBank = data
      .filter((r) => r.commission_bank !== null)
      .map((r) => ({ name: r.office_name, value: r.commission_bank!, lang: r.source_language }))
      .sort((a, b) => b.value - a.value);

    const withTotal = data
      .map((r) => {
        const c = getComputed(r);
        return { name: r.office_name, value: c.total_commission ?? 0, lang: r.source_language };
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);

    const withEff = data
      .map((r) => {
        const c = getComputed(r);
        return { name: r.office_name, value: c.commission_per_fte ?? 0, lang: r.source_language };
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);

    return { withCommIns, withCommBank, withTotal, withEff };
  }, [data]);

  const RankingList = ({ items, maxValue, color }: { items: { name: string; value: number; lang: string }[]; maxValue: number; color: string }) => (
    <div className="space-y-2">
      {items.map((d, i) => (
        <div key={d.name} className="flex items-center gap-3">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${color === "primary" ? "bg-primary/10 text-primary" : "bg-accent-orange/10 text-accent-orange"} text-xs font-bold`}>{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">{d.name}</span>
              <span className="ml-2 text-sm font-semibold tabular-nums">{formatCurrency(d.value)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${color === "primary" ? "bg-primary" : "bg-accent-orange"} transition-all`} style={{ width: `${(d.value / (maxValue || 1)) * 100}%` }} />
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground">{d.lang.toUpperCase()}</span>
        </div>
      ))}
    </div>
  );

  const sections = [
    { topKey: "group.top10_commission_ins", bottomKey: "group.bottom10_commission_ins", items: rankings.withCommIns, count: 10 },
    { topKey: "group.top10_commission_bank", bottomKey: "group.bottom10_commission_bank", items: rankings.withCommBank, count: 5 },
    { topKey: "group.top10_commission_total", bottomKey: "group.bottom10_commission_total", items: rankings.withTotal, count: 10 },
    { topKey: "group.top10_efficiency", bottomKey: "group.bottom10_efficiency", items: rankings.withEff, count: 10 },
  ];

  return (
    <div className="space-y-6">
      {sections.map(({ topKey, bottomKey, items, count }) => {
        const topItems = items.slice(0, count);
        const bottomItems = items.slice(-count).reverse();
        const maxVal = topItems[0]?.value || 1;
        return (
          <div key={topKey} className="grid gap-6 lg:grid-cols-2">
            <SectionCard title={t(topKey, language)}>
              <RankingList items={topItems} maxValue={maxVal} color="primary" />
            </SectionCard>
            <SectionCard title={t(bottomKey, language)}>
              <RankingList items={bottomItems} maxValue={maxVal} color="orange" />
            </SectionCard>
          </div>
        );
      })}
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

function CompareAnalysis({ selectedData, selected, data, language }: {
  selectedData: { record: import("@/types/barometer").OfficeRecord; computed: import("@/types/barometer").ComputedFields }[];
  selected: string[];
  data: import("@/types/barometer").OfficeRecord[];
  language: "nl" | "fr";
}) {
  const insights = useMemo(() => {
    if (selectedData.length < 2) return [];
    const nl = language === "nl";
    const results: { icon: string; text: string; type: "positive" | "negative" | "neutral" }[] = [];

    // Group averages for context
    const allComms = data.map((r) => getComputed(r).total_commission).filter((v): v is number => v !== null);
    const groupAvgComm = allComms.length ? allComms.reduce((a, b) => a + b, 0) / allComms.length : 0;
    const allEff = data.map((r) => getComputed(r).commission_per_fte).filter((v): v is number => v !== null);
    const groupAvgEff = allEff.length ? allEff.reduce((a, b) => a + b, 0) / allEff.length : 0;

    // Best/worst total commission
    const commSorted = [...selectedData].sort((a, b) => (b.computed.total_commission ?? 0) - (a.computed.total_commission ?? 0));
    const best = commSorted[0];
    const worst = commSorted[commSorted.length - 1];
    if (best.computed.total_commission && worst.computed.total_commission && best.computed.total_commission > 0) {
      const diff = best.computed.total_commission - worst.computed.total_commission;
      const pct = ((diff / worst.computed.total_commission) * 100).toFixed(0);
      results.push({
        icon: "📊",
        text: nl
          ? `${best.record.office_name} genereert ${formatCurrency(diff)} (${pct}%) meer totale commissie dan ${worst.record.office_name}.`
          : `${best.record.office_name} génère ${formatCurrency(diff)} (${pct}%) de plus en commission totale que ${worst.record.office_name}.`,
        type: "neutral",
      });
    }

    // Efficiency comparison
    const effSorted = [...selectedData].filter((d) => d.computed.commission_per_fte !== null).sort((a, b) => (b.computed.commission_per_fte ?? 0) - (a.computed.commission_per_fte ?? 0));
    if (effSorted.length >= 2) {
      const bestEff = effSorted[0];
      const worstEff = effSorted[effSorted.length - 1];
      results.push({
        icon: "⚡",
        text: nl
          ? `${bestEff.record.office_name} is het meest efficiënt met ${formatCurrency(bestEff.computed.commission_per_fte)} commissie per FTE, ${worstEff.record.office_name} het minst met ${formatCurrency(worstEff.computed.commission_per_fte)}.`
          : `${bestEff.record.office_name} est le plus efficace avec ${formatCurrency(bestEff.computed.commission_per_fte)} de commission par ETP, ${worstEff.record.office_name} le moins avec ${formatCurrency(worstEff.computed.commission_per_fte)}.`,
        type: "neutral",
      });
    }

    // Compare to group average
    selectedData.forEach(({ record, computed }) => {
      if (computed.total_commission !== null && groupAvgComm > 0) {
        const pctVsGroup = ((computed.total_commission / groupAvgComm - 1) * 100).toFixed(0);
        const above = computed.total_commission >= groupAvgComm;
        results.push({
          icon: above ? "✅" : "⚠️",
          text: nl
            ? `${record.office_name} zit ${above ? "+" : ""}${pctVsGroup}% ${above ? "boven" : "onder"} het groepsgemiddelde qua totale commissie.`
            : `${record.office_name} est ${above ? "+" : ""}${pctVsGroup}% ${above ? "au-dessus" : "en dessous"} de la moyenne du groupe en commission totale.`,
          type: above ? "positive" : "negative",
        });
      }
    });

    // Efficiency vs group average
    selectedData.forEach(({ record, computed }) => {
      if (computed.commission_per_fte !== null && groupAvgEff > 0) {
        const pctVsGroup = ((computed.commission_per_fte / groupAvgEff - 1) * 100).toFixed(0);
        const above = computed.commission_per_fte >= groupAvgEff;
        results.push({
          icon: above ? "🎯" : "📉",
          text: nl
            ? `${record.office_name} heeft een efficiëntie van ${above ? "+" : ""}${pctVsGroup}% t.o.v. het groepsgemiddelde (${formatCurrency(groupAvgEff)}/FTE).`
            : `${record.office_name} a une efficacité de ${above ? "+" : ""}${pctVsGroup}% par rapport à la moyenne du groupe (${formatCurrency(groupAvgEff)}/ETP).`,
          type: above ? "positive" : "negative",
        });
      }
    });

    // FTE comparison
    const fteSorted = [...selectedData].filter((d) => d.computed.total_fte !== null).sort((a, b) => (b.computed.total_fte ?? 0) - (a.computed.total_fte ?? 0));
    if (fteSorted.length >= 2) {
      const largest = fteSorted[0];
      const smallest = fteSorted[fteSorted.length - 1];
      if (largest.computed.total_fte && smallest.computed.total_fte) {
        const ratio = (largest.computed.total_fte / smallest.computed.total_fte).toFixed(1);
        results.push({
          icon: "👥",
          text: nl
            ? `${largest.record.office_name} (${largest.computed.total_fte} FTE) is ${ratio}x groter dan ${smallest.record.office_name} (${smallest.computed.total_fte} FTE).`
            : `${largest.record.office_name} (${largest.computed.total_fte} ETP) est ${ratio}x plus grand que ${smallest.record.office_name} (${smallest.computed.total_fte} ETP).`,
          type: "neutral",
        });
      }
    }

    // Portfolio mix comparison
    selectedData.forEach(({ record }) => {
      if (record.pct_private !== null && record.pct_sme !== null) {
        const dominant = record.pct_private > record.pct_sme
          ? (nl ? "particulier" : "particulier")
          : (nl ? "KMO" : "PME");
        const pct = Math.max(record.pct_private, record.pct_sme ?? 0);
        results.push({
          icon: "🏢",
          text: nl
            ? `${record.office_name} richt zich voornamelijk op ${dominant} (${pct}%).`
            : `${record.office_name} se concentre principalement sur ${dominant} (${pct}%).`,
          type: "neutral",
        });
      }
    });

    return results;
  }, [selectedData, data, language]);

  if (insights.length === 0) return null;

  return (
    <div className="space-y-3">
      {insights.map((insight, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
            insight.type === "positive"
              ? "border-accent-green/30 bg-accent-green/5"
              : insight.type === "negative"
              ? "border-accent-orange/30 bg-accent-orange/5"
              : "border-border bg-muted/30"
          }`}
        >
          <span className="text-base shrink-0">{insight.icon}</span>
          <p className="text-foreground/90">{insight.text}</p>
        </div>
      ))}
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

          {/* Analysis */}
          <SectionCard title={language === "nl" ? "Analyse" : "Analyse"}>
            <CompareAnalysis selectedData={selectedData} selected={selected} data={data} language={language} />
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
