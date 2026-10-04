-- ============================================================================
-- PARVA REALTY CRM — CHAT REACTIONS, GROUP AVATAR & ENHANCED GROUP MANAGEMENT
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- 1. GROUP PROFILE & DESCRIPTION COLUMNS
alter table if exists public.conversations
  add column if not exists description text,
  add column if not exists avatar_url text;

-- 2. MESSAGE REACTIONS TABLE
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, employee_id, emoji)
);

create index if not exists idx_msg_reactions_msg on public.message_reactions(message_id);
create index if not exists idx_msg_reactions_conv on public.message_reactions(conversation_id);

-- 3. RLS FOR MESSAGE REACTIONS
alter table public.message_reactions enable row level security;

drop policy if exists message_reactions_select on public.message_reactions;
create policy message_reactions_select on public.message_reactions for select
  using (
    exists (
      select 1 from public.conversation_members cm
      join public.profiles p on p.employee_id = cm.employee_id
      where cm.conversation_id = message_reactions.conversation_id and p.id = auth.uid()
    )
  );

drop policy if exists message_reactions_insert on public.message_reactions;
create policy message_reactions_insert on public.message_reactions for insert
  with check (
    auth.role() = 'authenticated'
    and employee_id = (select employee_id from public.profiles where id = auth.uid())
  );

drop policy if exists message_reactions_delete on public.message_reactions;
create policy message_reactions_delete on public.message_reactions for delete
  using (
    auth.role() = 'authenticated'
    and employee_id = (select employee_id from public.profiles where id = auth.uid())
  );

-- 4. CONVERSATION_MEMBERS DELETE POLICY (Allow creator or Chaitra to remove members)
drop policy if exists conversation_members_delete on public.conversation_members;
create policy conversation_members_delete on public.conversation_members for delete
  using (
    auth.role() = 'authenticated'
    and (
      -- A member can leave
      employee_id = (select employee_id from public.profiles where id = auth.uid())
      -- Or the group creator / Chaitra can remove members
      or exists (
        select 1 from public.conversations c
        where c.id = conversation_members.conversation_id
        and (
          c.created_by = (select employee_id from public.profiles where id = auth.uid())
          or exists (
            select 1 from public.employees e
            join public.profiles p on p.employee_id = e.id
            where p.id = auth.uid() and e.email = 'chaitra@parvarealty.ae'
          )
        )
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
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
