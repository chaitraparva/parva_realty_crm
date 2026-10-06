-- Clears ALL test chats, groups, reactions, call history and chat notifications.
-- Employees, leads, site visits, leave etc. are NOT touched.
-- Run once in Supabase SQL Editor.

do $$
begin
  if to_regclass('public.message_reactions') is not null then
    delete from public.message_reactions;
  end if;
  if to_regclass('public.messages') is not null then
    delete from public.messages;
  end if;
  if to_regclass('public.conversation_members') is not null then
    delete from public.conversation_members;
  end if;
  if to_regclass('public.conversations') is not null then
    delete from public.conversations;
  end if;
  if to_regclass('public.call_logs') is not null then
    delete from public.call_logs;
  end if;
  if to_regclass('public.internal_emails') is not null then
    delete from public.internal_emails;
  end if;
  if to_regclass('public.notifications') is not null then
    delete from public.notifications where type = 'chat_message';
  end if;
end $$;
