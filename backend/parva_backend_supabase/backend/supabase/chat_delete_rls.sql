-- ============================================================================
-- PARVA REALTY CRM — CHAT DELETION RLS POLICIES & REALTIME
-- Run this in your Supabase SQL Editor to enforce:
-- 1. Message deletion: User can only delete their own messages.
-- 2. Group deletion: Only group creator (or Chaitra if member) can delete group.
-- ============================================================================

-- 1. MESSAGES DELETION POLICY
-- Authenticated user can delete a message ONLY IF they are the sender
alter table if exists public.messages enable row level security;

drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete
  using (
    auth.role() = 'authenticated'
    and sender_id = (select employee_id from public.profiles where id = auth.uid())
  );

-- 2. CONVERSATIONS DELETION POLICY
-- Group conversations can be deleted by:
-- a) The original group creator (created_by = current user's employee_id)
-- b) Super Admin (Chaitra) ONLY IF she is a member of that group
alter table if exists public.conversations enable row level security;

drop policy if exists conversations_delete on public.conversations;
create policy conversations_delete on public.conversations for delete
  using (
    auth.role() = 'authenticated'
    and type = 'group'
    and (
      -- Group creator
      created_by = (select employee_id from public.profiles where id = auth.uid())
      or (
        -- Super Admin Chaitra specifically, only if she is actually a member of the group
        exists (
          select 1 from public.employees e
          join public.profiles p on p.employee_id = e.id
          join public.conversation_members cm on cm.conversation_id = conversations.id and cm.employee_id = e.id
          where p.id = auth.uid() and e.email = 'chaitra@parvarealty.ae'
        )
      )
    )
  );

-- 3. ENSURE REALTIME PUBLICATION FOR MESSAGES & CONVERSATIONS
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
end $$;
