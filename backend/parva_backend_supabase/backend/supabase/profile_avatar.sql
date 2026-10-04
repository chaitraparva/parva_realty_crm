-- Profile photos shown to everyone (Org Chart, profile menu).
-- Run once in the Supabase SQL editor. Safe to re-run.
alter table public.employees add column if not exists avatar_url text;
