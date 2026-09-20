-- ============================================================================
-- PARVA REALTY CRM — CHAT UX, NOTIFICATIONS & GROUP MANAGEMENT ENHANCEMENT
-- Run this in your Supabase SQL Editor.
-- 
-- 1. Adds last_read_at to conversation_members for per-user unread tracking
-- 2. RLS policy for members updating their own last_read_at
-- 3. RLS policy for members leaving a group (deleting their own membership)
-- 4. RLS policy for group name updates (creator, or Chaitra when member)
-- 5. Ensures Realtime publication for immediate broadcast across users
-- ============================================================================

-- 1. PER-USER UNREAD TRACKING COLUMN
alter table if exists public.conversation_members
  add column if not exists last_read_at timestamptz not null default now();

create index if not exists idx_cm_employee_read
  on public.conversation_members(conversation_id, employee_id, last_read_at);

-- 2. CONVERSATION_MEMBERS UPDATE POLICY (for marking conversations as read)
alter table if exists public.conversation_members enable row level security;

drop policy if exists conversation_members_update on public.conversation_members;
create policy conversation_members_update on public.conversation_members for update
  using (
    auth.role() = 'authenticated'
    and employee_id = (select employee_id from public.profiles where id = auth.uid())
  )
  with check (
    auth.role() = 'authenticated'
    and employee_id = (select employee_id from public.profiles where id = auth.uid())
  );

-- 3. CONVERSATION_MEMBERS DELETE POLICY (for leaving a group)
drop policy if exists conversation_members_delete on public.conversation_members;
create policy conversation_members_delete on public.conversation_members for delete
  using (
    auth.role() = 'authenticated'
    and employee_id = (select employee_id from public.profiles where id = auth.uid())
  );

-- 4. CONVERSATIONS UPDATE POLICY (for editing group name)
-- Group name can be edited ONLY by:
-- a) The original group creator (created_by = current user's employee_id)
-- b) Super Admin (Chaitra) ONLY IF she is an active member of that group
-- Normal members cannot edit. Direct conversations cannot be updated.
alter table if exists public.conversations enable row level security;

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations for update
  using (
    auth.role() = 'authenticated'
    and type = 'group'
    and (
      created_by = (select employee_id from public.profiles where id = auth.uid())
      or exists (
        select 1 from public.employees e
        join public.profiles p on p.employee_id = e.id
        join public.conversation_members cm on cm.conversation_id = conversations.id and cm.employee_id = e.id
        where p.id = auth.uid() and e.email = 'chaitra@parvarealty.ae'
      )
    )
  )
  with check (
    auth.role() = 'authenticated'
    and type = 'group'
    and (
      created_by = (select employee_id from public.profiles where id = auth.uid())
      or exists (
        select 1 from public.employees e
        join public.profiles p on p.employee_id = e.id
        join public.conversation_members cm on cm.conversation_id = conversations.id and cm.employee_id = e.id
        where p.id = auth.uid() and e.email = 'chaitra@parvarealty.ae'
      )
    )
  );

-- 5. REALTIME PUBLICATION VERIFICATION
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_members'
  ) then
    alter publication supabase_realtime add table public.conversation_members;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
