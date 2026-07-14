ALTER TABLE public.company_profile
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS enabled_modules text[];

ALTER TABLE public.docs
  ADD COLUMN IF NOT EXISTS module_data jsonb;