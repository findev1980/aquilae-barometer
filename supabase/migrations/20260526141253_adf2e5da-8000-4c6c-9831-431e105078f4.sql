CREATE OR REPLACE FUNCTION public.import_office_records(_year integer, _records jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can import records';
  END IF;

  DELETE FROM public.office_records WHERE survey_year = _year;

  INSERT INTO public.office_records (
    office_name, source_language, survey_year, activities,
    num_managers, num_employees_fte, commission_insurance, commission_bank,
    pct_private, pct_sme, pct_life, pct_nonlife,
    ranking_nonlife, ranking_life, growth_phase,
    strengths_text, challenges_text, priorities,
    satisfaction_aquilae, recommend_aquilae, reasons_membership,
    participation_charter, mission_alignment, vision_alignment, values_alignment
  )
  SELECT
    (r->>'office_name')::text,
    (r->>'source_language')::text,
    COALESCE((r->>'survey_year')::integer, _year),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(r->'activities')), '{}'::text[]),
    NULLIF(r->>'num_managers','')::numeric,
    NULLIF(r->>'num_employees_fte','')::numeric,
    NULLIF(r->>'commission_insurance','')::numeric,
    NULLIF(r->>'commission_bank','')::numeric,
    NULLIF(r->>'pct_private','')::numeric,
    NULLIF(r->>'pct_sme','')::numeric,
    NULLIF(r->>'pct_life','')::numeric,
    NULLIF(r->>'pct_nonlife','')::numeric,
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(r->'ranking_nonlife')), '{}'::text[]),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(r->'ranking_life')), '{}'::text[]),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(r->'growth_phase')), '{}'::text[]),
    COALESCE(r->>'strengths_text',''),
    COALESCE(r->>'challenges_text',''),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(r->'priorities')), '{}'::text[]),
    COALESCE(r->>'satisfaction_aquilae',''),
    COALESCE(r->>'recommend_aquilae',''),
    COALESCE(r->>'reasons_membership',''),
    COALESCE(r->>'participation_charter',''),
    COALESCE(r->>'mission_alignment',''),
    COALESCE(r->>'vision_alignment',''),
    COALESCE(r->>'values_alignment','')
  FROM jsonb_array_elements(_records) AS r;

  GET DIAGNOSTICS _count = ROW_COUNT;

  INSERT INTO public.import_meta (survey_year, record_count, imported_at)
  VALUES (_year, _count, now())
  ON CONFLICT (survey_year)
  DO UPDATE SET record_count = EXCLUDED.record_count, imported_at = EXCLUDED.imported_at;
END;
$$;

-- Ensure unique constraint exists for ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'import_meta_survey_year_key'
  ) THEN
    ALTER TABLE public.import_meta ADD CONSTRAINT import_meta_survey_year_key UNIQUE (survey_year);
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.import_office_records(integer, jsonb) TO authenticated;