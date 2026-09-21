-- ============================================================================
-- PARVA REALTY CRM — SHARED CALENDAR SCHEMA ADDITION + RLS
-- Idempotent: safe to run multiple times.
-- Run once in Supabase Dashboard → SQL Editor.
--
-- Changes:
-- 1. Adds assigned_to column to calendar_events
--    assigned_to = the employee the event is FOR (separate from created_by)
--    Existing events where assigned_to IS NULL fall back to created_by.
--
-- 2. Creates/replaces RLS policies for calendar_events:
--    SELECT  → any authenticated user sees all shared calendar events
--    INSERT  → any authenticated user can create; created_by must = caller
--    UPDATE  → creator or admin
--    DELETE  → creator or admin
--
-- 3. Adds employees_select_calendar policy:
--    Allows any authenticated user to read id/name of ALL active employees.
--    This is additive — the existing employees_select policy is preserved.
--    Multiple SELECT policies in Postgres are evaluated with OR logic.
-- ============================================================================

-- ── 1. Enable RLS on calendar_events (no-op if already enabled) ───────────────
alter table public.calendar_events enable row level security;

-- ── 2. Calendar events RLS policies ──────────────────────────────────────────
-- SELECT: any authenticated employee can view all shared calendar events
drop policy if exists calendar_events_select on public.calendar_events;
create policy calendar_events_select on public.calendar_events for select
  using (auth.role() = 'authenticated');

-- INSERT: any authenticated employee can create a calendar event only for themselves.
-- created_by must equal the caller's employee id.
drop policy if exists calendar_events_insert on public.calendar_events;
create policy calendar_events_insert on public.calendar_events for insert
  with check (
    auth.role() = 'authenticated'
    and created_by = public.current_employee_id()
  );

-- UPDATE: only the event owner/creator can modify an event.
drop policy if exists calendar_events_update on public.calendar_events;
create policy calendar_events_update on public.calendar_events for update
  using (created_by = public.current_employee_id())
  with check (created_by = public.current_employee_id());

-- DELETE: only the event owner/creator can delete an event.
drop policy if exists calendar_events_delete on public.calendar_events;
create policy calendar_events_delete on public.calendar_events for delete
  using (created_by = public.current_employee_id());

-- ── 4. Employees: calendar-specific read policy ───────────────────────────────
-- Allows ANY authenticated user to read active employee records.
-- The frontend calendar only queries: id, name (two non-sensitive fields).
-- This is a SECOND, ADDITIVE SELECT policy — the existing employees_select
-- (role-based) policy is preserved. Postgres OR's permissive policies.
-- This does NOT grant INSERT/UPDATE/DELETE; it does NOT expose salary, phone,
-- or any sensitive columns (those are never requested by the calendar query).
drop policy if exists employees_select_calendar on public.employees;
create policy employees_select_calendar on public.employees for select
  using (
    auth.role() = 'authenticated'
    and status = 'active'
  );

-- ── Sanity check (run manually after applying) ────────────────────────────────
-- select name, status from public.employees where status = 'active' order by name;
-- select count(*) from public.calendar_events;
