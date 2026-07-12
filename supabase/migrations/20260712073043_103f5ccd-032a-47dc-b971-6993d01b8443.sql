
-- 1. Move SECURITY DEFINER helpers to a private schema (not exposed by the Data API)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.is_workspace_member(_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE workspace_owner_id = _owner_id
      AND user_id = auth.uid()
      AND active = true
  )
$$;

CREATE OR REPLACE FUNCTION private.workspace_owner_for(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_owner_id FROM public.staff_members
  WHERE user_id = _user_id AND active = true
  ORDER BY created_at ASC LIMIT 1
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_workspace_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.workspace_owner_for(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_workspace_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.workspace_owner_for(uuid) TO authenticated, service_role;

-- Recreate policies that reference the helpers so they use the private schema versions
DROP POLICY IF EXISTS "members read staff" ON public.staff_members;
CREATE POLICY "members read staff" ON public.staff_members
FOR SELECT USING (user_id = auth.uid() OR private.is_workspace_member(workspace_owner_id));

DROP POLICY IF EXISTS "workspace docs" ON public.docs;
CREATE POLICY "workspace docs" ON public.docs FOR ALL
USING (owner_user_id = auth.uid() OR private.is_workspace_member(owner_user_id))
WITH CHECK (owner_user_id = auth.uid() OR private.is_workspace_member(owner_user_id));

DROP POLICY IF EXISTS "workspace customers" ON public.customers;
CREATE POLICY "workspace customers" ON public.customers FOR ALL
USING (owner_user_id = auth.uid() OR private.is_workspace_member(owner_user_id))
WITH CHECK (owner_user_id = auth.uid() OR private.is_workspace_member(owner_user_id));

DROP POLICY IF EXISTS "workspace catalog_items" ON public.catalog_items;
CREATE POLICY "workspace catalog_items" ON public.catalog_items FOR ALL
USING (owner_user_id = auth.uid() OR private.is_workspace_member(owner_user_id))
WITH CHECK (owner_user_id = auth.uid() OR private.is_workspace_member(owner_user_id));

DROP POLICY IF EXISTS "workspace expenses" ON public.expenses;
CREATE POLICY "workspace expenses" ON public.expenses FOR ALL
USING (owner_user_id = auth.uid() OR private.is_workspace_member(owner_user_id))
WITH CHECK (owner_user_id = auth.uid() OR private.is_workspace_member(owner_user_id));

DROP POLICY IF EXISTS "workspace expense_categories" ON public.expense_categories;
CREATE POLICY "workspace expense_categories" ON public.expense_categories FOR ALL
USING (owner_user_id = auth.uid() OR private.is_workspace_member(owner_user_id))
WITH CHECK (owner_user_id = auth.uid() OR private.is_workspace_member(owner_user_id));

DROP POLICY IF EXISTS "workspace company_profile read" ON public.company_profile;
CREATE POLICY "workspace company_profile read" ON public.company_profile
FOR SELECT USING (owner_user_id = auth.uid() OR private.is_workspace_member(owner_user_id));

-- Drop the publicly-exposed public.* helpers now that no policy references them
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_workspace_member(uuid);
DROP FUNCTION IF EXISTS public.workspace_owner_for(uuid);

-- 2. Prevent self role assignment on user_roles
DROP POLICY IF EXISTS "owner manage roles" ON public.user_roles;
-- Role writes now require service_role (via server-only code). SELECT policy stays.

-- 3. Add DELETE policy on workspaces
CREATE POLICY "Users can delete own workspace" ON public.workspaces
FOR DELETE USING (owner_user_id = auth.uid());
