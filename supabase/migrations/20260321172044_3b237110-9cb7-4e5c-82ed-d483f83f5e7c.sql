
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- user_roles RLS: admins can manage, users can read own
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update office_records: restrict write/delete to admins only
DROP POLICY IF EXISTS "Authenticated users can insert office_records" ON public.office_records;
DROP POLICY IF EXISTS "Authenticated users can delete office_records" ON public.office_records;

CREATE POLICY "Admins can insert office_records"
  ON public.office_records FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete office_records"
  ON public.office_records FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Update import_meta: restrict write/update/delete to admins only
DROP POLICY IF EXISTS "Authenticated users can insert import_meta" ON public.import_meta;
DROP POLICY IF EXISTS "Authenticated users can update import_meta" ON public.import_meta;
DROP POLICY IF EXISTS "Authenticated users can delete import_meta" ON public.import_meta;

CREATE POLICY "Admins can insert import_meta"
  ON public.import_meta FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update import_meta"
  ON public.import_meta FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete import_meta"
  ON public.import_meta FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
