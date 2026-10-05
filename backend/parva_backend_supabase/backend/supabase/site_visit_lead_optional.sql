-- Allow site visits without a lead
alter table public.site_visits alter column lead_id drop not null;
