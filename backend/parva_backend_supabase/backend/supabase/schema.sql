-- ============================================================================
-- PARVA REALTY CRM — SUPABASE SCHEMA
-- Run this once, in full, in Supabase Dashboard → SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'manager', 'agent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type employee_status as enum ('active', 'on-leave', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_source as enum ('Housing.com', 'Social Media', 'Referral', 'Walk-in');
exception when duplicate_object then null; end $$;

do $$ begin
  create type property_type as enum ('Apartment', 'Villa', 'Plot');
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_type as enum
    ('call','email','note','site-visit','whatsapp','transfer','escalation','ai-assignment','approval');
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_stage as enum
    ('pending_manager','pending_admin','approved','rejected');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- OFFICES  (source: org.docx / employee dataset → Bangalore, Dubai, Dehradun)
-- ----------------------------------------------------------------------------
create table if not exists public.offices (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  country     text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- EMPLOYEES  (business/org data — NOT authentication credentials)
-- ----------------------------------------------------------------------------
create table if not exists public.employees (
  id              uuid primary key default gen_random_uuid(),
  employee_code   text unique,                 -- e.g. PA230018 (nullable: not every
                                                 -- source row had one)
  name            text not null,
  email           text unique,                  -- nullable: source data has at least one
                                                  -- employee (Chaitra) with no email on file;
                                                  -- she cannot get a Supabase Auth login until
                                                  -- a real email is supplied (see MIGRATION_REPORT.md)
  phone           text,
  role            user_role not null,
  designation     text,                         -- verbatim job title from source data
  department      text default 'Sales',
  office_id       uuid references public.offices(id),
  manager_id      uuid references public.employees(id),
  status          employee_status not null default 'active',
  join_date       date,
  capacity_limit  integer default 35,
  source_note     text,                         -- data-provenance / conflict notes
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_employees_office on public.employees(office_id);
create index if not exists idx_employees_manager on public.employees(manager_id);
create index if not exists idx_employees_role on public.employees(role);

-- ----------------------------------------------------------------------------
-- PROFILES  — links Supabase Auth identity (auth.users) to an employee record.
-- Authentication credentials live ONLY in auth.users (managed by Supabase Auth).
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  employee_id  uuid not null unique references public.employees(id) on delete cascade,
  email        text not null,
  created_at   timestamptz not null default now()
);

-- Auto-create a profile row whenever a Supabase Auth user is created whose
-- email matches a pre-seeded employee (see supabase/seed.sql + README §"Creating
-- logins"). This lets you create employees first (business data) and Auth users
-- second (credentials), and have them link automatically by email.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_employee_id uuid;
begin
  select id into v_employee_id
  from public.employees
  where lower(email) = lower(new.email)
  limit 1;

  if v_employee_id is not null then
    insert into public.profiles (id, employee_id, email)
    values (new.id, v_employee_id, new.email)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- LEADS
-- ----------------------------------------------------------------------------
create table if not exists public.leads (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  phone                 text not null,
  email                 text,
  source                lead_source,
  status                text not null default 'Lead Generation',
  office_id             uuid references public.offices(id),
  assigned_to           uuid references public.employees(id),
  budget                text,
  property_type         property_type,
  location              text,
  follow_up_date        date,
  notes                 text,
  shortlisted_unit_ids  text[] default '{}',
  cancellation_reason   text,
  previous_status       text,
  transferred_from      uuid references public.employees(id),
  transferred_at        timestamptz,
  escalation_reason     text,
  escalation_status     text check (escalation_status in ('pending','reviewed','reassigned','rejected')),
  escalation_comment    text,
  ai_assigned           boolean default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_leads_office on public.leads(office_id);
create index if not exists idx_leads_assigned_to on public.leads(assigned_to);
create index if not exists idx_leads_status on public.leads(status);

-- ----------------------------------------------------------------------------
-- LEAD ACTIVITIES  (timeline entries — replaces embedded Mongo sub-documents)
-- ----------------------------------------------------------------------------
create table if not exists public.lead_activities (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.leads(id) on delete cascade,
  type         activity_type not null,
  description  text,
  created_by   uuid references public.employees(id),
  created_at   timestamptz not null default now()
);

create index if not exists idx_activities_lead on public.lead_activities(lead_id);

-- ----------------------------------------------------------------------------
-- APPROVALS / ESCALATIONS
-- Implements: CRM submission → Sales Manager → Super Admin  (org.docx)
-- ----------------------------------------------------------------------------
create table if not exists public.approvals (
  id                 uuid primary key default gen_random_uuid(),
  item_type          text not null default 'lead',
  lead_id            uuid references public.leads(id) on delete cascade,
  submitted_by       uuid not null references public.employees(id),
  stage              approval_stage not null default 'pending_manager',
  assigned_approver  uuid references public.employees(id),
  comments           text,
  submitted_at       timestamptz not null default now(),
  reviewed_at        timestamptz,
  approved_by        uuid references public.employees(id),
  rejected_by        uuid references public.employees(id),
  rejection_reason   text,
  escalated_to       uuid references public.employees(id),
  escalated_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_approvals_lead on public.approvals(lead_id);
create index if not exists idx_approvals_assigned on public.approvals(assigned_approver);
create index if not exists idx_approvals_stage on public.approvals(stage);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_employees_updated on public.employees;
create trigger trg_employees_updated before update on public.employees
  for each row execute function public.set_updated_at();

drop trigger if exists trg_leads_updated on public.leads;
create trigger trg_leads_updated before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists trg_approvals_updated on public.approvals;
create trigger trg_approvals_updated before update on public.approvals
  for each row execute function public.set_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS (used by RLS policies)
-- ============================================================================
create or replace function public.current_employee_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select employee_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_role()
returns user_role
language sql stable security definer set search_path = public
as $$
  select e.role from public.employees e
  join public.profiles p on p.employee_id = e.id
  where p.id = auth.uid();
$$;

create or replace function public.current_office_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select e.office_id from public.employees e
  join public.profiles p on p.employee_id = e.id
  where p.id = auth.uid();
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- NOTE: the Express backend authenticates every request itself and, for most
-- writes, uses the SUPABASE_SERVICE_ROLE_KEY (which bypasses RLS by Supabase's
-- own design). These policies are the defense-in-depth layer that protects the
-- data if a client ever talks to Supabase directly with a user's own session
-- (anon/authenticated key) — e.g. from the frontend in a future iteration.
-- ============================================================================
alter table public.offices        enable row level security;
alter table public.employees      enable row level security;
alter table public.profiles       enable row level security;
alter table public.leads          enable row level security;
alter table public.lead_activities enable row level security;
alter table public.approvals      enable row level security;

-- OFFICES: any authenticated employee can read; only admin (super admin) writes.
drop policy if exists offices_select on public.offices;
create policy offices_select on public.offices for select
  using (auth.role() = 'authenticated');

drop policy if exists offices_write on public.offices;
create policy offices_write on public.offices for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- PROFILES: a user can read their own profile; admin (super admin) can read all.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.current_role() = 'admin');

-- EMPLOYEES:
--   admin (super admin)      → read/write all
--   manager (sales manager)     → read employees in their own office
--   agent             → read own record only
drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select
  using (
    public.current_role() = 'admin'
    or id = public.current_employee_id()
    or (public.current_role() = 'manager' and office_id = public.current_office_id())
  );

drop policy if exists employees_write on public.employees;
create policy employees_write on public.employees for insert
  with check (public.current_role() = 'admin');

drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees for update
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- LEADS:
--   admin (super admin)   → all leads
--   manager (sales manager) → leads in their own office
--   agent         → leads assigned to them
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select
  using (
    public.current_role() = 'admin'
    or (public.current_role() = 'manager' and office_id = public.current_office_id())
    or (public.current_role() = 'agent' and assigned_to = public.current_employee_id())
  );

drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads for insert
  with check (auth.role() = 'authenticated');

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads for update
  using (
    public.current_role() = 'admin'
    or (public.current_role() = 'manager' and office_id = public.current_office_id())
    or (public.current_role() = 'agent' and assigned_to = public.current_employee_id())
  );

drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads for delete
  using (public.current_role() = 'admin');

-- LEAD ACTIVITIES: readable/writable by anyone who can see the parent lead.
drop policy if exists activities_select on public.lead_activities;
create policy activities_select on public.lead_activities for select
  using (exists (
    select 1 from public.leads l where l.id = lead_id and (
      public.current_role() = 'admin'
      or (public.current_role() = 'manager' and l.office_id = public.current_office_id())
      or (public.current_role() = 'agent' and l.assigned_to = public.current_employee_id())
    )
  ));

drop policy if exists activities_insert on public.lead_activities;
create policy activities_insert on public.lead_activities for insert
  with check (auth.role() = 'authenticated');

-- APPROVALS: submitter, assigned approver, and admin (super admin) can see; only the
-- assigned approver or admin (super admin) can update (approve/reject/escalate).
drop policy if exists approvals_select on public.approvals;
create policy approvals_select on public.approvals for select
  using (
    public.current_role() = 'admin'
    or submitted_by = public.current_employee_id()
    or assigned_approver = public.current_employee_id()
  );

drop policy if exists approvals_insert on public.approvals;
create policy approvals_insert on public.approvals for insert
  with check (auth.role() = 'authenticated');

drop policy if exists approvals_update on public.approvals;
create policy approvals_update on public.approvals for update
  using (
    public.current_role() = 'admin'
    or assigned_approver = public.current_employee_id()
  );

-- ============================================================================
-- STORAGE BUCKETS (property images public, documents/attachments private)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('lead-documents', 'lead-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('employee-photos', 'employee-photos', true)
on conflict (id) do nothing;

drop policy if exists "public read property images" on storage.objects;
create policy "public read property images" on storage.objects for select
  using (bucket_id = 'property-images');

drop policy if exists "authenticated upload property images" on storage.objects;
create policy "authenticated upload property images" on storage.objects for insert
  with check (bucket_id = 'property-images' and auth.role() = 'authenticated');

drop policy if exists "authenticated read lead documents" on storage.objects;
create policy "authenticated read lead documents" on storage.objects for select
  using (bucket_id = 'lead-documents' and auth.role() = 'authenticated');

drop policy if exists "authenticated upload lead documents" on storage.objects;
create policy "authenticated upload lead documents" on storage.objects for insert
  with check (bucket_id = 'lead-documents' and auth.role() = 'authenticated');

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
