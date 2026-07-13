
-- 1) Harden helper function: pin search_path
CREATE OR REPLACE FUNCTION private.is_workspace_member(_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE workspace_owner_id = _owner_id
      AND user_id = auth.uid()
      AND active = true
  )
$$;

-- 2) Re-scope public-role policies to authenticated
DROP POLICY IF EXISTS "workspace catalog_items" ON public.catalog_items;
CREATE POLICY "workspace catalog_items" ON public.catalog_items
  FOR ALL TO authenticated
  USING ((owner_user_id = auth.uid()) OR private.is_workspace_member(owner_user_id))
  WITH CHECK ((owner_user_id = auth.uid()) OR private.is_workspace_member(owner_user_id));

DROP POLICY IF EXISTS "workspace customers" ON public.customers;
CREATE POLICY "workspace customers" ON public.customers
  FOR ALL TO authenticated
  USING ((owner_user_id = auth.uid()) OR private.is_workspace_member(owner_user_id))
  WITH CHECK ((owner_user_id = auth.uid()) OR private.is_workspace_member(owner_user_id));

DROP POLICY IF EXISTS "workspace docs" ON public.docs;
CREATE POLICY "workspace docs" ON public.docs
  FOR ALL TO authenticated
  USING ((owner_user_id = auth.uid()) OR private.is_workspace_member(owner_user_id))
  WITH CHECK ((owner_user_id = auth.uid()) OR private.is_workspace_member(owner_user_id));

DROP POLICY IF EXISTS "workspace expense_categories" ON public.expense_categories;
CREATE POLICY "workspace expense_categories" ON public.expense_categories
  FOR ALL TO authenticated
  USING ((owner_user_id = auth.uid()) OR private.is_workspace_member(owner_user_id))
  WITH CHECK ((owner_user_id = auth.uid()) OR private.is_workspace_member(owner_user_id));

DROP POLICY IF EXISTS "workspace expenses" ON public.expenses;
CREATE POLICY "workspace expenses" ON public.expenses
  FOR ALL TO authenticated
  USING ((owner_user_id = auth.uid()) OR private.is_workspace_member(owner_user_id))
  WITH CHECK ((owner_user_id = auth.uid()) OR private.is_workspace_member(owner_user_id));

DROP POLICY IF EXISTS "members read staff" ON public.staff_members;
CREATE POLICY "members read staff" ON public.staff_members
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.is_workspace_member(workspace_owner_id));

-- 3) Explicit write policies on user_roles for workspace owners
CREATE POLICY "owners insert workspace roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (workspace_owner_id = auth.uid());

CREATE POLICY "owners update workspace roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (workspace_owner_id = auth.uid())
  WITH CHECK (workspace_owner_id = auth.uid());

CREATE POLICY "owners delete workspace roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (workspace_owner_id = auth.uid());
