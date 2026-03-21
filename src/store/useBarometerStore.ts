import { create } from "zustand";
import type { Language } from "@/i18n/translations";
import type { OfficeRecord } from "@/types/barometer";

interface BarometerMeta {
  available_years: number[];
  last_import: string | null;
}

interface BarometerState {
  language: Language;
  selectedYear: number | null;
  selectedOffice: string | null;
  sourceLanguageFilter: "nl" | "fr" | "all";
  allData: OfficeRecord[];
  meta: BarometerMeta;

  setLanguage: (lang: Language) => void;
  setSelectedYear: (year: number) => void;
  setSelectedOffice: (office: string | null) => void;
  setSourceLanguageFilter: (filter: "nl" | "fr" | "all") => void;
  importData: (records: OfficeRecord[], year: number) => void;
  deleteYear: (year: number) => void;
  loadFromStorage: () => void;
}

const STORAGE_PREFIX = "barometer_data_";
const META_KEY = "barometer_meta";
const SETTINGS_KEY = "barometer_settings";

function loadMeta(): BarometerMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { available_years: [], last_import: null };
}

function loadSettings(): { language: Language } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { language: "nl" };
}

function loadAllData(years: number[]): OfficeRecord[] {
  const all: OfficeRecord[] = [];
  for (const year of years) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + year);
      if (raw) all.push(...JSON.parse(raw));
    } catch { /* ignore */ }
  }
  return all;
}

export const useBarometerStore = create<BarometerState>((set, get) => ({
  language: loadSettings().language,
  selectedYear: null,
  selectedOffice: null,
  sourceLanguageFilter: "all",
  allData: [],
  meta: loadMeta(),

  setLanguage: (lang) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ language: lang }));
    set({ language: lang });
  },

  setSelectedYear: (year) => set({ selectedYear: year }),

  setSelectedOffice: (office) => set({ selectedOffice: office }),

  setSourceLanguageFilter: (filter) => set({ sourceLanguageFilter: filter }),

  importData: (records, year) => {
    const meta = get().meta;
    const newYears = meta.available_years.includes(year)
      ? meta.available_years
      : [...meta.available_years, year].sort();
    const newMeta = { available_years: newYears, last_import: new Date().toISOString().split("T")[0] };

    localStorage.setItem(STORAGE_PREFIX + year, JSON.stringify(records));
    localStorage.setItem(META_KEY, JSON.stringify(newMeta));

    // Reload all data
    const allData = loadAllData(newYears);
    set({ meta: newMeta, allData, selectedYear: year });
  },

  deleteYear: (year) => {
    const meta = get().meta;
    const newYears = meta.available_years.filter((y) => y !== year);
    const newMeta = { ...meta, available_years: newYears };
    localStorage.removeItem(STORAGE_PREFIX + year);
    localStorage.setItem(META_KEY, JSON.stringify(newMeta));
    const allData = loadAllData(newYears);
    const selectedYear = get().selectedYear === year ? (newYears[newYears.length - 1] || null) : get().selectedYear;
    set({ meta: newMeta, allData, selectedYear });
  },

  loadFromStorage: () => {
    const meta = loadMeta();
    const allData = loadAllData(meta.available_years);
    const selectedYear = meta.available_years.length > 0 ? meta.available_years[meta.available_years.length - 1] : null;
    set({ meta, allData, selectedYear });
  },
}));
