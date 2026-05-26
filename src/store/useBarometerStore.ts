import { create } from "zustand";
import type { Language } from "@/i18n/translations";
import type { OfficeRecord } from "@/types/barometer";
import type { OfficeSize } from "@/utils/benchmarkCalc";
import { supabase } from "@/integrations/supabase/client";

interface BarometerMeta {
  available_years: number[];
  last_import: string | null;
}

interface BarometerState {
  language: Language;
  selectedYear: number | null;
  selectedOffice: string | null;
  sourceLanguageFilter: "nl" | "fr" | "all";
  sizeFilter: OfficeSize | "all";
  allData: OfficeRecord[];
  meta: BarometerMeta;
  loading: boolean;
  anonymized: boolean;

  setLanguage: (lang: Language) => void;
  setSelectedYear: (year: number) => void;
  setSelectedOffice: (office: string | null) => void;
  setSourceLanguageFilter: (filter: "nl" | "fr" | "all") => void;
  setSizeFilter: (filter: OfficeSize | "all") => void;
  toggleAnonymized: () => void;
  getDisplayName: (officeName: string) => string;
  importData: (records: OfficeRecord[], year: number) => Promise<void>;
  deleteYear: (year: number) => Promise<void>;
  loadData: () => Promise<void>;
}

const SETTINGS_KEY = "barometer_settings";

function loadSettings(): { language: Language } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { language: "nl" };
}

export const useBarometerStore = create<BarometerState>((set, get) => ({
  language: loadSettings().language,
  selectedYear: null,
  selectedOffice: null,
  sourceLanguageFilter: "all",
  sizeFilter: "all",
  allData: [],
  meta: { available_years: [], last_import: null },
  loading: false,
  anonymized: false,

  setLanguage: (lang) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ language: lang }));
    set({ language: lang });
  },

  setSelectedYear: (year) => set({ selectedYear: year }),
  setSelectedOffice: (office) => set({ selectedOffice: office }),
  setSourceLanguageFilter: (filter) => set({ sourceLanguageFilter: filter }),
  setSizeFilter: (filter) => set({ sizeFilter: filter }),
  toggleAnonymized: () => set((s) => ({ anonymized: !s.anonymized })),

  getDisplayName: (officeName: string) => {
    const state = get();
    if (!state.anonymized) return officeName;
    const uniqueNames = [...new Set(state.allData.map((r) => r.office_name))].sort();
    const idx = uniqueNames.indexOf(officeName);
    return idx >= 0 ? `Kantoor ${idx + 1}` : officeName;
  },

  importData: async (records, year) => {
    // Atomic import via Postgres function (transactional, admin-only)
    const { error } = await supabase.rpc("import_office_records", {
      _year: year,
      _records: records as unknown as any,
    });
    if (error) throw error;

    // Reload all data
    await get().loadData();
    set({ selectedYear: year });
  },

  deleteYear: async (year) => {
    await supabase.from("office_records").delete().eq("survey_year", year);
    await supabase.from("import_meta").delete().eq("survey_year", year);
    
    const currentYear = get().selectedYear;
    await get().loadData();
    
    if (currentYear === year) {
      const meta = get().meta;
      set({ selectedYear: meta.available_years[meta.available_years.length - 1] || null });
    }
  },

  loadData: async () => {
    set({ loading: true });

    const [recordsRes, metaRes] = await Promise.all([
      supabase.from("office_records").select("*").order("survey_year"),
      supabase.from("import_meta").select("*").order("survey_year"),
    ]);

    const records = (recordsRes.data || []) as unknown as OfficeRecord[];
    const metaRows = metaRes.data || [];

    const available_years = metaRows.map((m: any) => m.survey_year).sort((a: number, b: number) => a - b);
    const lastRow = metaRows.length > 0 ? metaRows[metaRows.length - 1] : null;
    const last_import = lastRow ? (lastRow as any).imported_at?.split("T")[0] || null : null;

    const selectedYear = available_years.length > 0 ? available_years[available_years.length - 1] : null;

    set({
      allData: records,
      meta: { available_years, last_import },
      selectedYear: get().selectedYear ?? selectedYear,
      loading: false,
    });
  },
}));
