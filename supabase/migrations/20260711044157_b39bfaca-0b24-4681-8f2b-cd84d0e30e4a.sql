
ALTER TABLE public.company_profile
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS primary_unit text NOT NULL DEFAULT 'km',
  ADD COLUMN IF NOT EXISTS custom_units text[] NOT NULL DEFAULT '{}'::text[];

-- Storage RLS: users can read/write only their own logos in the company-assets bucket
CREATE POLICY "Users read own company assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'company-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users insert own company assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own company assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own company assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
