-- STEP 2 of 2 — run AFTER step 1 has succeeded.

-- 1. Remember who created each lead.
alter table public.leads
  add column if not exists created_by uuid references public.employees(id);

-- 2. Proof / screenshot attachments on lead activity.
alter table public.lead_activities
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text;

-- 3. Private storage bucket for those files.
insert into storage.buckets (id, name, public)
values ('lead-attachments', 'lead-attachments', false)
on conflict (id) do nothing;

drop policy if exists lead_attachments_insert on storage.objects;
create policy lead_attachments_insert on storage.objects for insert
  with check (bucket_id = 'lead-attachments' and auth.role() = 'authenticated');

drop policy if exists lead_attachments_select on storage.objects;
create policy lead_attachments_select on storage.objects for select
  using (bucket_id = 'lead-attachments' and auth.role() = 'authenticated');

-- 4. Nagesh becomes Lead Acquisition Manager and reports to Chaitra (Super Admin).
update public.employees
set role = 'acquisition_manager',
    manager_id = (select id from public.employees where lower(email) = 'chaitra@parvarealty.ae' limit 1)
where name ilike 'Nagesh%';

-- 5. Vijaya Vaishnavi reports to Nagesh. Everyone else stays as they are.
update public.employees
set manager_id = (select id from public.employees where name ilike 'Nagesh%' limit 1)
where name ilike 'Vijaya Vaishnavi%';

-- 6. Check the result.
select name, role, manager_id from public.employees order by name;
