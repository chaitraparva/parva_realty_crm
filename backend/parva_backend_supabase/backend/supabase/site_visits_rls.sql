-- ============================================================================
-- PARVA REALTY CRM — SITE VISITS RLS POLICIES
-- Idempotent: safe to run multiple times in Supabase SQL editor.
--
-- Requirements:
-- 1. Use the existing public.site_visits table.
-- 2. Allow authenticated employees to insert a site visit for themselves:
--    employee_id = public.current_employee_id()
-- 3. Preserve admin functionality: admin can insert/delegate with any employee_id.
-- 4. Do not weaken security by allowing arbitrary employee_id values for non-admin.
-- ============================================================================

alter table public.site_visits enable row level security;

-- SELECT: authenticated employees can view site visits
-- (admin sees all; managers see their delegated or team visits; agents see own visits)
drop policy if exists site_visits_select on public.site_visits;
create policy site_visits_select on public.site_visits for select
  using (
    auth.role() = 'authenticated'
    and (
      public.current_role() = 'admin'
      or employee_id = public.current_employee_id()
      or exists (
        select 1 from public.employees e
        where e.id = public.site_visits.employee_id
          and (
            (public.current_role() = 'manager' and e.office_id = public.current_office_id())
            or e.manager_id = public.current_employee_id()
          )
      )
    )
  );

-- INSERT:
-- Admin can insert any site visit (e.g. assigning to manager).
-- Non-admin authenticated employees can only insert site visits for THEMSELVES:
-- employee_id = public.current_employee_id().
drop policy if exists site_visits_insert on public.site_visits;
create policy site_visits_insert on public.site_visits for insert
  with check (
    auth.role() = 'authenticated'
    and (
      public.current_role() = 'admin'
      or employee_id = public.current_employee_id()
    )
  );

-- UPDATE:
-- Admin can update any site visit.
-- Managers can assign agent or update status.
-- Assigned employee can update status/outcome of their own visit.
drop policy if exists site_visits_update on public.site_visits;
create policy site_visits_update on public.site_visits for update
  using (
    auth.role() = 'authenticated'
    and (
      public.current_role() = 'admin'
      or employee_id = public.current_employee_id()
      or exists (
        select 1 from public.employees e
        where e.id = public.site_visits.employee_id
          and e.manager_id = public.current_employee_id()
      )
    )
  )
  with check (
    auth.role() = 'authenticated'
    and (
      public.current_role() = 'admin'
      or employee_id = public.current_employee_id()
      or public.current_role() = 'manager'
    )
  );

-- DELETE:
-- Admin only.
drop policy if exists site_visits_delete on public.site_visits;
create policy site_visits_delete on public.site_visits for delete
  using (
    public.current_role() = 'admin'
  );
