-- Store the place (address / meeting point) of each site visit
alter table public.site_visits add column if not exists place text;
