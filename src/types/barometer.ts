export interface OfficeRecord {
  office_name: string;
  source_language: "nl" | "fr";
  survey_year: number;
  activities: string[];
  num_managers: number | null;
  num_employees_fte: number | null;
  commission_insurance: number | null;
  commission_bank: number | null;
  pct_private: number | null;
  pct_sme: number | null;
  pct_life: number | null;
  pct_nonlife: number | null;
  ranking_nonlife: string[];
  ranking_life: string[];
  growth_phase: string[];
  strengths_text: string;
  challenges_text: string;
  priorities: string[];
  satisfaction_aquilae: string;
  recommend_aquilae: string;
  reasons_membership: string;
  participation_charter: string;
  mission_alignment: string;
  vision_alignment: string;
  values_alignment: string;
}

// Computed at runtime
export interface ComputedFields {
  total_commission: number | null;
  total_fte: number | null;
  commission_per_fte: number | null;
}

export interface BenchmarkResult {
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  q1: number | null;
  q3: number | null;
  percentile: number | null;
  quartile: number | null;
  n: number;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  nlCount: number;
  frCount: number;
  emptyFieldCounts: Record<string, number>;
}

export interface WeightedRanking {
  company: string;
  totalPoints: number;
  inTop3: number;
  rank: number;
}
