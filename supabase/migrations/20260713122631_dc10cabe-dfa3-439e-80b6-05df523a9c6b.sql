
-- Helper: does the current user have `_action` in workspace `_owner`?
CREATE OR REPLACE FUNCTION private.staff_perm(_owner uuid, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.app_role;
  perms jsonb;
  preset jsonb;
  override_val jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF _owner = auth.uid() THEN
    RETURN true;
  END IF;
  SELECT role, permissions
    INTO r, perms
    FROM public.staff_members
   WHERE workspace_owner_id = _owner
     AND user_id = auth.uid()
     AND active = true
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  override_val := perms -> _action;
  IF override_val IS NOT NULL AND jsonb_typeof(override_val) = 'boolean' THEN
    RETURN (override_val)::text::boolean;
  END IF;
  preset := CASE r
    WHEN 'owner' THEN
      '{"jobs.viewAll":true,"jobs.create":true,"jobs.edit":true,"jobs.markPaid":true,"jobs.delete":true,"expenses.addOwn":true,"expenses.viewAll":true,"expenses.editAny":true,"customers.view":true,"customers.add":true,"customers.edit":true,"catalog.view":true,"catalog.edit":true,"reports.viewOwn":true,"reports.viewAll":true,"planner.view":true,"planner.edit":true}'::jsonb
    WHEN 'manager' THEN
      '{"jobs.viewAll":true,"jobs.create":true,"jobs.edit":true,"jobs.markPaid":true,"jobs.delete":false,"expenses.addOwn":true,"expenses.viewAll":true,"expenses.editAny":true,"customers.view":true,"customers.add":true,"customers.edit":true,"catalog.view":true,"catalog.edit":true,"reports.viewOwn":true,"reports.viewAll":true,"planner.view":true,"planner.edit":true}'::jsonb
    WHEN 'staff' THEN
      '{"jobs.viewAll":false,"jobs.create":false,"jobs.edit":false,"jobs.markPaid":false,"jobs.delete":false,"expenses.addOwn":true,"expenses.viewAll":false,"expenses.editAny":false,"customers.view":true,"customers.add":false,"customers.edit":false,"catalog.view":true,"catalog.edit":false,"reports.viewOwn":true,"reports.viewAll":false,"planner.view":true,"planner.edit":false}'::jsonb
  END;
  RETURN COALESCE((preset -> _action)::text::boolean, false);
END;
$$;

GRANT EXECUTE ON FUNCTION private.staff_perm(uuid, text) TO authenticated;

-- catalog_items --------------------------------------------------------------
DROP POLICY IF EXISTS "workspace catalog_items" ON public.catalog_items;
CREATE POLICY "catalog_items select" ON public.catalog_items
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'catalog.view'));
CREATE POLICY "catalog_items insert" ON public.catalog_items
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'catalog.edit'));
CREATE POLICY "catalog_items update" ON public.catalog_items
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'catalog.edit'))
  WITH CHECK (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'catalog.edit'));
CREATE POLICY "catalog_items delete" ON public.catalog_items
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'catalog.edit'));

-- customers ------------------------------------------------------------------
DROP POLICY IF EXISTS "workspace customers" ON public.customers;
CREATE POLICY "customers select" ON public.customers
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'customers.view'));
CREATE POLICY "customers insert" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'customers.add'));
CREATE POLICY "customers update" ON public.customers
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'customers.edit'))
  WITH CHECK (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'customers.edit'));
CREATE POLICY "customers delete" ON public.customers
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'customers.edit'));

-- docs (jobs / quotes / invoices) --------------------------------------------
DROP POLICY IF EXISTS "workspace docs" ON public.docs;
CREATE POLICY "docs select" ON public.docs
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR assigned_to = auth.uid()
    OR private.staff_perm(owner_user_id, 'jobs.viewAll')
  );
CREATE POLICY "docs insert" ON public.docs
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'jobs.create'));
CREATE POLICY "docs update" ON public.docs
  FOR UPDATE TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR private.staff_perm(owner_user_id, 'jobs.edit')
    OR (assigned_to = auth.uid() AND private.staff_perm(owner_user_id, 'jobs.markPaid'))
  )
  WITH CHECK (
    owner_user_id = auth.uid()
    OR private.staff_perm(owner_user_id, 'jobs.edit')
    OR (assigned_to = auth.uid() AND private.staff_perm(owner_user_id, 'jobs.markPaid'))
  );
CREATE POLICY "docs delete" ON public.docs
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'jobs.delete'));

-- expenses -------------------------------------------------------------------
DROP POLICY IF EXISTS "workspace expenses" ON public.expenses;
CREATE POLICY "expenses select" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR private.staff_perm(owner_user_id, 'expenses.viewAll')
  );
CREATE POLICY "expenses insert" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'expenses.addOwn'));
CREATE POLICY "expenses update" ON public.expenses
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'expenses.editAny'))
  WITH CHECK (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'expenses.editAny'));
CREATE POLICY "expenses delete" ON public.expenses
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'expenses.editAny'));

-- expense_categories: read for anyone who can see/add expenses; write catalog.edit
DROP POLICY IF EXISTS "workspace expense_categories" ON public.expense_categories;
CREATE POLICY "expense_categories select" ON public.expense_categories
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR private.staff_perm(owner_user_id, 'expenses.addOwn')
    OR private.staff_perm(owner_user_id, 'expenses.viewAll')
  );
CREATE POLICY "expense_categories insert" ON public.expense_categories
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'catalog.edit'));
CREATE POLICY "expense_categories update" ON public.expense_categories
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'catalog.edit'))
  WITH CHECK (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'catalog.edit'));
CREATE POLICY "expense_categories delete" ON public.expense_categories
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid() OR private.staff_perm(owner_user_id, 'catalog.edit'));
