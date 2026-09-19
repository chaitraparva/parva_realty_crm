-- ============================================================================
-- PARVA REALTY CRM — INTERACT / CHAT TABLES & RLS POLICIES
-- Run this in your Supabase SQL Editor to ensure chat tables, RLS policies,
-- and Realtime publications are configured.
-- ============================================================================

-- 1. TABLES
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'group')),
  name text,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, employee_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.employees(id) on delete cascade,
  body text not null,
  attachment_name text,
  attachment_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_conversation_members_employee on public.conversation_members(employee_id);
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at);

-- 2. ROW LEVEL SECURITY (RLS)
alter table public.employees enable row level security;
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- EMPLOYEES: Authenticated users can read active employees
drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select
  using (auth.role() = 'authenticated');

-- PROFILES: Authenticated users can read their own profile (or profiles for resolving)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (auth.role() = 'authenticated');

-- CONVERSATIONS:
-- Conversation members can read their conversations
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_members cm
      join public.profiles p on p.employee_id = cm.employee_id
      where cm.conversation_id = conversations.id and p.id = auth.uid()
    )
  );

-- Authenticated employees can create direct or group conversations
drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations for insert
  with check (auth.role() = 'authenticated');

-- CONVERSATION_MEMBERS:
-- Members can view memberships of conversations they belong to
drop policy if exists conversation_members_select on public.conversation_members;
create policy conversation_members_select on public.conversation_members for select
  using (
    exists (
      select 1 from public.conversation_members cm
      join public.profiles p on p.employee_id = cm.employee_id
      where cm.conversation_id = conversation_members.conversation_id and p.id = auth.uid()
    )
  );

-- Authenticated users can add members when setting up conversations
drop policy if exists conversation_members_insert on public.conversation_members;
create policy conversation_members_insert on public.conversation_members for insert
  with check (auth.role() = 'authenticated');

-- MESSAGES:
-- Members can select messages from their conversations
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select
  using (
    exists (
      select 1 from public.conversation_members cm
      join public.profiles p on p.employee_id = cm.employee_id
      where cm.conversation_id = messages.conversation_id and p.id = auth.uid()
    )
  );

-- Members can insert messages where sender_id is their employee id
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (
    auth.role() = 'authenticated'
    and sender_id = (select employee_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = messages.conversation_id and cm.employee_id = messages.sender_id
    )
  );

-- 3. SUPABASE REALTIME REPLICATION (Idempotent)
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
end $$;

