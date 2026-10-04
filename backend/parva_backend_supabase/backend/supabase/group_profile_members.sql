-- Let ANY member of a group change its name, description and icon.
-- (Adding/removing members and deleting the group stay creator / Super Admin only.)
-- Run once in the Supabase SQL editor. Safe to re-run.

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations for update
  using (
    auth.role() = 'authenticated'
    and type = 'group'
    and exists (
      select 1 from public.conversation_members cm
      join public.profiles p on p.employee_id = cm.employee_id
      where cm.conversation_id = conversations.id and p.id = auth.uid()
    )
  )
  with check (
    auth.role() = 'authenticated'
    and type = 'group'
  );

-- RLS cannot limit which columns change, so lock everything except the profile
-- fields: a member must not be able to change who created the group, its type, etc.
create or replace function public.conversations_lock_non_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if new.created_by is distinct from old.created_by
     or new.type is distinct from old.type
     or new.created_at is distinct from old.created_at then
    raise exception 'Only the group name, description and icon can be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists conversations_lock_non_profile_columns on public.conversations;
create trigger conversations_lock_non_profile_columns
  before update on public.conversations
  for each row execute function public.conversations_lock_non_profile_columns();
