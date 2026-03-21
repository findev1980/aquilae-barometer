
-- Drop existing permissive policies on office_records
DROP POLICY IF EXISTS "Authenticated users can insert office_records" ON public.office_records;
DROP POLICY IF EXISTS "Authenticated users can delete office_records" ON public.office_records;

-- Drop existing permissive policies on import_meta
DROP POLICY IF EXISTS "Authenticated users can insert import_meta" ON public.import_meta;
DROP POLICY IF EXISTS "Authenticated users can update import_meta" ON public.import_meta;
DROP POLICY IF EXISTS "Authenticated users can delete import_meta" ON public.import_meta;

-- Recreate with explicit auth.uid() check
CREATE POLICY "Authenticated users can insert office_records"
  ON public.office_records FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete office_records"
  ON public.office_records FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert import_meta"
  ON public.import_meta FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update import_meta"
  ON public.import_meta FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete import_meta"
  ON public.import_meta FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);
