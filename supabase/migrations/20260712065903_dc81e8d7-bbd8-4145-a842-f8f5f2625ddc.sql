-- Compensation fields on staff_members
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS pay_type text NOT NULL DEFAULT 'salary',
  ADD COLUMN IF NOT EXISTS base_salary numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS id_number text,
  ADD COLUMN IF NOT EXISTS tax_status text NOT NULL DEFAULT 'paye';

-- Payslips table
CREATE TABLE IF NOT EXISTS public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_owner_id uuid NOT NULL,
  staff_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_label text NOT NULL,
  hours numeric NOT NULL DEFAULT 0,
  gross numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  paye numeric NOT NULL DEFAULT 0,
  uif_employee numeric NOT NULL DEFAULT 0,
  uif_employer numeric NOT NULL DEFAULT 0,
  sdl numeric NOT NULL DEFAULT 0,
  other_deductions numeric NOT NULL DEFAULT 0,
  deductions_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  net numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  finalized_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payslips TO authenticated;
GRANT ALL ON public.payslips TO service_role;

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own workspace payslips"
  ON public.payslips FOR ALL
  TO authenticated
  USING (workspace_owner_id = auth.uid())
  WITH CHECK (workspace_owner_id = auth.uid());

CREATE TRIGGER payslips_set_updated_at
  BEFORE UPDATE ON public.payslips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payslips_owner_period ON public.payslips (workspace_owner_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_payslips_staff ON public.payslips (staff_id);
