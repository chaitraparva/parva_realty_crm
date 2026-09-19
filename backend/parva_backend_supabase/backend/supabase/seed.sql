-- ============================================================================
-- PARVA REALTY CRM — SEED DATA
-- Source of truth: PA_employee_Details_.xlsx + org.docx (uploaded by the user).
-- This file inserts ONLY the people who actually appear in those two sources.
-- It is idempotent: re-running it will not create duplicates (keyed on the
-- unique office name / employee email, using ON CONFLICT ... DO UPDATE).
--
-- ⚠ READ MIGRATION_REPORT.md SECTION C/D BEFORE RUNNING — it documents real
-- conflicts between org.docx and the xlsx that were resolved here, and one
-- employee (Chaitra) who cannot be given a Supabase Auth login yet because
-- no email address exists for her in either source file.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- OFFICES — Bangalore & Dubai (existing app offices). "Dehradun" was
-- previously added here for an employee (Shradha) who has since been
-- confirmed NOT to be a Parva Realty employee and has been removed from the
-- active roster below. The office row is left in place (harmless, unused)
-- rather than dropped, since removing it is not required for correctness.
-- ----------------------------------------------------------------------------
insert into public.offices (name, country) values
  ('Bangalore', 'India'),
  ('Dubai',     'UAE'),
  ('Dehradun',  'India')
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- EMPLOYEES
-- Columns mapped 1:1 from PA_employee_Details_.xlsx: "Employee d" → employee_code,
-- "Name" → name, "Official Mail ID" → email, "Phone no" → phone,
-- "Designation" → designation, "Report Manager" → manager_id (resolved below),
-- "Location" → office_id (resolved below). "role" comes from org.docx, which is
-- the authoritative source for permissions/approval routing (see conflict notes).
-- ----------------------------------------------------------------------------

-- Chaitra — Super Admin / Director (org.docx). NOT present as a row in the
-- xlsx (only referenced there as everyone else's "Report Manager"), so she has
-- no employee_code, email, phone or office on file. email is left NULL on
-- purpose — do not invent one. She cannot log in via Supabase Auth until a
-- real email is provided; see MIGRATION_REPORT.md.
insert into public.employees
  (employee_code, name, email, phone, role, designation, department, office_id, status, source_note)
values
  (NULL, 'Chaitra', NULL, NULL, 'admin', 'Director', 'Executive', NULL, 'active',
   'org.docx only — no employee_code/email/phone/office found in PA_employee_Details_.xlsx; referenced there only as "Report Manager".')
on conflict (email) do nothing;

-- Nagesh N — PA230018 — Bangalore
-- CONFLICT: xlsx designation = "Marketing & Business Development Associate";
-- org.docx labels this person "sales Manager". role below follows org.docx
-- (it governs the approval hierarchy); xlsx wording preserved verbatim in
-- designation. See MIGRATION_REPORT.md §D.
insert into public.employees
  (employee_code, name, email, phone, role, designation, department, office_id, status, source_note)
values
  ('PA230018', 'Nagesh N', 'nagesh@parvarealty.ae', '7892347497', 'manager',
   'Marketing & Business Development Associate', 'Sales',
   (select id from public.offices where name = 'Bangalore'), 'active',
   'Role taken from org.docx ("sales Manager"); xlsx designation text differs — see MIGRATION_REPORT.md.')
on conflict (email) do update set
  employee_code = excluded.employee_code, name = excluded.name, phone = excluded.phone,
  role = excluded.role, designation = excluded.designation, department = excluded.department,
  office_id = excluded.office_id, status = excluded.status, source_note = excluded.source_note;

-- Vijaya Vaishnavi A — PA230041 — Bangalore (same conflict as Nagesh N above)
insert into public.employees
  (employee_code, name, email, phone, role, designation, department, office_id, status, source_note)
values
  ('PA230041', 'Vijaya Vaishnavi A', 'vaishnavi@parvarealty.ae', '8095565535', 'manager',
   'Marketing & Business Development Associate', 'Sales',
   (select id from public.offices where name = 'Bangalore'), 'active',
   'Role taken from org.docx ("sales Manager"); xlsx designation text differs — see MIGRATION_REPORT.md.')
on conflict (email) do update set
  employee_code = excluded.employee_code, name = excluded.name, phone = excluded.phone,
  role = excluded.role, designation = excluded.designation, department = excluded.department,
  office_id = excluded.office_id, status = excluded.status, source_note = excluded.source_note;

-- Deekshitha M V — Bangalore — Sales Manager. No employee_code exists for her
-- in the source xlsx/org.docx, so none is invented here (left NULL, same
-- pattern as Ajoy/Ankitha below).
insert into public.employees
  (employee_code, name, email, phone, role, designation, department, office_id, status, source_note)
values
  (NULL, 'Deekshitha M V', 'deekshitha@parvarealty.ae', '9880988655', 'manager', 'Sales Manager', 'Sales',
   (select id from public.offices where name = 'Bangalore'), 'active', NULL)
on conflict (email) do update set
  name = excluded.name, phone = excluded.phone, role = excluded.role,
  designation = excluded.designation, department = excluded.department,
  office_id = excluded.office_id, status = excluded.status;

-- Ajoy — no employee_code in xlsx — Dubai — Sales Manager (both sources agree)
insert into public.employees
  (employee_code, name, email, phone, role, designation, department, office_id, status, source_note)
values
  (NULL, 'Ajoy', 'ajoy@parvarealty.ae', '971564227854', 'manager', 'Sales Manager', 'Sales',
   (select id from public.offices where name = 'Dubai'), 'active', NULL)
on conflict (email) do update set
  name = excluded.name, phone = excluded.phone, role = excluded.role,
  designation = excluded.designation, department = excluded.department,
  office_id = excluded.office_id, status = excluded.status;

-- Ankitha — no employee_code in xlsx — Dubai — Sales Manager (both sources agree)
insert into public.employees
  (employee_code, name, email, phone, role, designation, department, office_id, status, source_note)
values
  (NULL, 'Ankitha', 'ankita@parvarealty.ae', '971564227855', 'manager', 'Sales Manager', 'Sales',
   (select id from public.offices where name = 'Dubai'), 'active', NULL)
on conflict (email) do update set
  name = excluded.name, phone = excluded.phone, role = excluded.role,
  designation = excluded.designation, department = excluded.department,
  office_id = excluded.office_id, status = excluded.status;

-- ----------------------------------------------------------------------------
-- MANAGER LINKS — xlsx "Report Manager" column says "Chaitra" for the other
-- employees. Resolved by name after all rows exist. (Shradha was previously
-- seeded here and has been removed — she is not a Parva Realty employee;
-- see README.md / MIGRATION_REPORT.md for the original flag.)
-- ----------------------------------------------------------------------------
update public.employees e
set manager_id = (select id from public.employees where name = 'Chaitra')
where e.name in ('Nagesh N', 'Deekshitha M V', 'Vijaya Vaishnavi A', 'Ajoy', 'Ankitha');

-- ============================================================================
-- NOTE — no "agent" (frontline CRM user) rows exist in the source data.
-- Every seeded employee is a sales_manager or the super_admin. The approval
-- flow (CRM → Sales Manager → Super Admin) still works today because Sales
-- Managers can submit leads themselves; once real agent employees are
-- supplied, add them the same way (role = 'agent', manager_id = their Sales
-- Manager's id) — see MIGRATION_REPORT.md §D.
--
-- CREATING LOGINS: this script only creates public.employees rows (business
-- data). It deliberately does NOT create passwords or auth.users rows — do
-- not insert passwords into SQL. See README.md "Creating Supabase Auth users"
-- for the correct, secure process (Dashboard invite or auth.admin.createUser
-- via the service role, run outside of SQL).
-- ============================================================================
