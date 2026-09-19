-- ============================================================================
-- ONE-TIME MANUAL FIXUP — run this once in the Supabase SQL editor against
-- your EXISTING live database. It does NOT recreate or drop any tables.
--
-- Why this is needed:
-- 1. seed.sql previously inserted an employee named "Shradha" who has since
--    been confirmed NOT to be a Parva Realty employee. If schema.sql/seed.sql
--    were already run against this database before this fix, her row may
--    still exist live — this script removes it.
-- 2. "Deekshitha M V" was never in the original seed.sql (an oversight) even
--    though she is a real, already-invited employee. This script makes sure
--    her row exists with the correct role/office, without inventing an
--    employee_code for her (left NULL, matching Ajoy/Ankitha).
--
-- Safe to run more than once (idempotent). Uses email as the stable key.
-- ============================================================================

-- 1. Ensure Deekshitha M V's employee record exists/is correct.
insert into public.employees
  (employee_code, name, email, phone, role, designation, department, office_id, status, source_note)
values
  (NULL, 'Deekshitha M V', 'deekshitha@parvarealty.ae', '9880988655', 'manager', 'Sales Manager', 'Sales',
   (select id from public.offices where name = 'Bangalore'), 'active', NULL)
on conflict (email) do update set
  name = excluded.name, phone = excluded.phone, role = excluded.role,
  designation = excluded.designation, department = excluded.department,
  office_id = excluded.office_id, status = excluded.status;

update public.employees e
set manager_id = (select id from public.employees where name = 'Chaitra')
where e.name = 'Deekshitha M V' and e.manager_id is null;

-- 2. Remove Shradha's employee row if it exists. This will fail with a
-- foreign-key error if any leads/activities/approvals already reference her
-- (assigned_to / created_by / assigned_approver) — if that happens, deactivate
-- her instead by running:
--   update public.employees set status = 'inactive' where email = 'shradha@diagofinace.com';
-- and reassign her records to the correct owner before retrying the delete.
delete from public.employees where email = 'shradha@diagofinace.com';

-- 3. Sanity check — run this after the above and confirm it returns exactly
-- the 6 real employees (Chaitra, Nagesh N, Deekshitha M V, Vijaya Vaishnavi A,
-- Ajoy, Ankitha) and nobody named Shradha:
-- select name, email, role, status from public.employees order by name;
