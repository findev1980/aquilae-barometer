
-- Create office_records table
CREATE TABLE public.office_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_name TEXT NOT NULL,
  source_language TEXT NOT NULL CHECK (source_language IN ('nl', 'fr')),
  survey_year INTEGER NOT NULL,
  activities TEXT[] NOT NULL DEFAULT '{}',
  num_managers NUMERIC,
  num_employees_fte NUMERIC,
  commission_insurance NUMERIC,
  commission_bank NUMERIC,
  pct_private NUMERIC,
  pct_sme NUMERIC,
  pct_life NUMERIC,
  pct_nonlife NUMERIC,
  ranking_nonlife TEXT[] NOT NULL DEFAULT '{}',
  ranking_life TEXT[] NOT NULL DEFAULT '{}',
  growth_phase TEXT[] NOT NULL DEFAULT '{}',
  strengths_text TEXT NOT NULL DEFAULT '',
  challenges_text TEXT NOT NULL DEFAULT '',
  priorities TEXT[] NOT NULL DEFAULT '{}',
  satisfaction_aquilae TEXT NOT NULL DEFAULT '',
  recommend_aquilae TEXT NOT NULL DEFAULT '',
  reasons_membership TEXT NOT NULL DEFAULT '',
  participation_charter TEXT NOT NULL DEFAULT '',
  mission_alignment TEXT NOT NULL DEFAULT '',
  vision_alignment TEXT NOT NULL DEFAULT '',
  values_alignment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create import_meta table
CREATE TABLE public.import_meta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_year INTEGER NOT NULL UNIQUE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record_count INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.office_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_meta ENABLE ROW LEVEL SECURITY;

-- RLS policies for office_records
CREATE POLICY "Authenticated users can read office_records"
  ON public.office_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert office_records"
  ON public.office_records FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete office_records"
  ON public.office_records FOR DELETE TO authenticated USING (true);

-- RLS policies for import_meta
CREATE POLICY "Authenticated users can read import_meta"
  ON public.import_meta FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert import_meta"
  ON public.import_meta FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update import_meta"
  ON public.import_meta FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete import_meta"
  ON public.import_meta FOR DELETE TO authenticated USING (true);

-- Index for fast year-based queries
CREATE INDEX idx_office_records_year ON public.office_records (survey_year);
