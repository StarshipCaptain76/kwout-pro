
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'staff');

-- user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  workspace_owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_owner_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- staff_members table
CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_owner_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'staff',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_owner_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_members TO authenticated;
GRANT ALL ON public.staff_members TO service_role;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER staff_members_set_updated_at
BEFORE UPDATE ON public.staff_members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Security-definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_owner_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE workspace_owner_id = _owner_id
      AND user_id = auth.uid()
      AND active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.workspace_owner_for(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_owner_id FROM public.staff_members
  WHERE user_id = _user_id AND active = true
  ORDER BY created_at ASC LIMIT 1
$$;

-- user_roles policies (owners can manage; users can read own)
CREATE POLICY "read own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR workspace_owner_id = auth.uid());

CREATE POLICY "owner manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (workspace_owner_id = auth.uid())
WITH CHECK (workspace_owner_id = auth.uid());

-- staff_members policies
CREATE POLICY "owner manage staff" ON public.staff_members
FOR ALL TO authenticated
USING (workspace_owner_id = auth.uid())
WITH CHECK (workspace_owner_id = auth.uid());

CREATE POLICY "members read staff" ON public.staff_members
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_workspace_member(workspace_owner_id));

-- Widen existing table policies to include workspace members
DROP POLICY "own docs" ON public.docs;
CREATE POLICY "workspace docs" ON public.docs
FOR ALL TO authenticated
USING (owner_user_id = auth.uid() OR public.is_workspace_member(owner_user_id))
WITH CHECK (owner_user_id = auth.uid() OR public.is_workspace_member(owner_user_id));

DROP POLICY "own customers" ON public.customers;
CREATE POLICY "workspace customers" ON public.customers
FOR ALL TO authenticated
USING (owner_user_id = auth.uid() OR public.is_workspace_member(owner_user_id))
WITH CHECK (owner_user_id = auth.uid() OR public.is_workspace_member(owner_user_id));

DROP POLICY "own catalog_items" ON public.catalog_items;
CREATE POLICY "workspace catalog_items" ON public.catalog_items
FOR ALL TO authenticated
USING (owner_user_id = auth.uid() OR public.is_workspace_member(owner_user_id))
WITH CHECK (owner_user_id = auth.uid() OR public.is_workspace_member(owner_user_id));

DROP POLICY "own expenses" ON public.expenses;
CREATE POLICY "workspace expenses" ON public.expenses
FOR ALL TO authenticated
USING (owner_user_id = auth.uid() OR public.is_workspace_member(owner_user_id))
WITH CHECK (owner_user_id = auth.uid() OR public.is_workspace_member(owner_user_id));

DROP POLICY "own expense_categories" ON public.expense_categories;
CREATE POLICY "workspace expense_categories" ON public.expense_categories
FOR ALL TO authenticated
USING (owner_user_id = auth.uid() OR public.is_workspace_member(owner_user_id))
WITH CHECK (owner_user_id = auth.uid() OR public.is_workspace_member(owner_user_id));

DROP POLICY "own company_profile" ON public.company_profile;
CREATE POLICY "workspace company_profile read" ON public.company_profile
FOR SELECT TO authenticated
USING (owner_user_id = auth.uid() OR public.is_workspace_member(owner_user_id));
CREATE POLICY "workspace company_profile write" ON public.company_profile
FOR ALL TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

-- Doc assignment column
ALTER TABLE public.docs ADD COLUMN IF NOT EXISTS assigned_to uuid;
