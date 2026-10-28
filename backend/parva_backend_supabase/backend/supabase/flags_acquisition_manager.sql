-- Lets the Lead Acquisition Manager see and handle every flag (additive; existing policies stay).
drop policy if exists flags_select_acquisition on public.flags;
create policy flags_select_acquisition on public.flags for select
  using (auth.role() = 'authenticated' and public.current_role() = 'acquisition_manager');

drop policy if exists flags_insert_acquisition on public.flags;
create policy flags_insert_acquisition on public.flags for insert
  with check (auth.role() = 'authenticated' and public.current_role() = 'acquisition_manager');

drop policy if exists flags_update_acquisition on public.flags;
create policy flags_update_acquisition on public.flags for update
  using (auth.role() = 'authenticated' and public.current_role() = 'acquisition_manager')
  with check (auth.role() = 'authenticated' and public.current_role() = 'acquisition_manager');
