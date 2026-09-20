import { supabase } from '../lib/supabase'

export interface ChatMessageRow {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
  attachment_name?: string | null
  attachment_url?: string | null
}

export interface ChatConversationRow {
  id: string
  type: 'direct' | 'group' | string
  name: string | null
  created_by: string
  created_at: string
}

export interface ChatMemberRow {
  conversation_id: string
  employee_id: string
  joined_at: string
}

export interface ChatGroup {
  id: string
  name: string
  memberIds: string[]
  createdBy: string
  createdAt: string
}

export interface ChatEmployee {
  id: string
  employee_code?: string | null
  name: string
  email?: string | null
  phone?: string | null
  role: string
  department?: string | null
  designation?: string | null
  status: string
  team?: string
}

export interface ChatState {
  messages: ChatMessageRow[]
  conversations: ChatConversationRow[]
  members: ChatMemberRow[]
  groups: ChatGroup[]
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || 'Chat request failed')
}

/**
 * Resolves the authenticated Supabase user -> profile -> employee record.
 * Uses auth user ID -> profiles.id -> profiles.employee_id -> employees.id
 */
export async function getCurrentEmployee(): Promise<ChatEmployee> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated with Supabase')
  }

  // 1. Resolve via profiles table (profiles.id = user.id)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, employee_id, email')
    .eq('id', user.id)
    .maybeSingle()

  let employeeId = profile?.employee_id

  // 2. Fallback: match employees by email if profile record missing
  if (!employeeId && user.email) {
    const { data: empByEmail } = await supabase
      .from('employees')
      .select('id')
      .eq('email', user.email)
      .maybeSingle()

    if (empByEmail) {
      employeeId = empByEmail.id
    }
  }

  if (!employeeId) {
    throw new Error('No employee record found for authenticated Supabase user')
  }

  // 3. Fetch authoritative employee record
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, employee_code, name, email, phone, role, department, designation, status')
    .eq('id', employeeId)
    .single()

  throwIfError(empError)
  if (!employee) throw new Error('Employee record could not be loaded')

  return {
    ...employee,
    team: employee.department || 'Sales',
  }
}

/**
 * Fetches all active employees from public.employees without filtering
 * by department, role, or manager.
 */
export async function getAllEmployees(): Promise<ChatEmployee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, employee_code, name, email, phone, role, department, designation, status')
    .neq('status', 'inactive')
    .order('name', { ascending: true })

  throwIfError(error)

  return (data ?? []).map((e) => ({
    ...e,
    team: e.department || 'Sales',
  }))
}

/**
 * Finds an existing direct conversation between two employees by querying
 * conversation_members for matching conversation_ids of type 'direct'.
 */
export async function getDirectConversation(
  currentEmployeeId: string,
  otherEmployeeId: string
): Promise<string | null> {
  // Find conversation IDs where current employee is a member
  const { data: myMemberships, error: myError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('employee_id', currentEmployeeId)

  throwIfError(myError)

  const myConvoIds = (myMemberships ?? []).map((m) => m.conversation_id)
  if (myConvoIds.length === 0) return null

  // Find which of these conversations other employee is also a member of
  const { data: sharedMemberships, error: sharedError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('employee_id', otherEmployeeId)
    .in('conversation_id', myConvoIds)

  throwIfError(sharedError)

  const candidateIds = (sharedMemberships ?? []).map((m) => m.conversation_id)
  if (candidateIds.length === 0) return null

  // Check which candidate conversation is of type 'direct'
  const { data: directConvos, error: convoError } = await supabase
    .from('conversations')
    .select('id')
    .eq('type', 'direct')
    .in('id', candidateIds)
    .limit(1)

  throwIfError(convoError)

  if (directConvos && directConvos.length > 0) {
    return directConvos[0].id
  }

  return null
}

/**
 * Creates a direct conversation between current employee and other employee,
 * adding both to conversation_members. If one already exists, reuses it.
 */
export async function createDirectConversation(
  currentEmployeeId: string,
  otherEmployeeId: string
): Promise<string> {
  const existingId = await getDirectConversation(currentEmployeeId, otherEmployeeId)
  if (existingId) return existingId

  // Create new direct conversation
  const { data: convo, error: convoError } = await supabase
    .from('conversations')
    .insert({
      type: 'direct',
      name: null,
      created_by: currentEmployeeId,
    })
    .select('id')
    .single()

  throwIfError(convoError)
  if (!convo) throw new Error('Could not create direct conversation')

  // Insert both members
  const { error: membersError } = await supabase
    .from('conversation_members')
    .insert([
      { conversation_id: convo.id, employee_id: currentEmployeeId },
      { conversation_id: convo.id, employee_id: otherEmployeeId },
    ])

  throwIfError(membersError)

  return convo.id
}

/**
 * Alias for backward compatibility with existing callers.
 */
export async function getOrCreateDirectConversation(
  otherEmployeeId: string,
  currentEmployeeId?: string
): Promise<string> {
  let senderId = currentEmployeeId
  if (!senderId) {
    const me = await getCurrentEmployee()
    senderId = me.id
  }
  return createDirectConversation(senderId, otherEmployeeId)
}

/**
 * Creates a persistent group conversation and inserts all selected members.
 */
export async function createGroup(
  name: string,
  memberIds: string[],
  creatorId: string
): Promise<string> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Group name cannot be empty')

  const { data: convo, error: convoError } = await supabase
    .from('conversations')
    .insert({
      type: 'group',
      name: trimmedName,
      created_by: creatorId,
    })
    .select('id')
    .single()

  throwIfError(convoError)
  if (!convo) throw new Error('Could not create group conversation')

  // Deduplicate and ensure creator is included
  const allMemberIds = Array.from(new Set([creatorId, ...memberIds]))
  const memberRows = allMemberIds.map((employee_id) => ({
    conversation_id: convo.id,
    employee_id,
  }))

  const { error: membersError } = await supabase
    .from('conversation_members')
    .insert(memberRows)

  throwIfError(membersError)

  return convo.id
}

/**
 * Alias for group conversation creation.
 */
export async function createGroupConversation(
  name: string,
  memberIds: string[],
  creatorId?: string
): Promise<string> {
  let senderId = creatorId
  if (!senderId) {
    const me = await getCurrentEmployee()
    senderId = me.id
  }
  return createGroup(name, memberIds, senderId)
}

/**
 * Fetches all members of a group or conversation.
 */
export async function getGroupMembers(conversationId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('conversation_members')
    .select('employee_id')
    .eq('conversation_id', conversationId)

  throwIfError(error)
  return (data ?? []).map((row) => row.employee_id)
}

/**
 * Loads all messages for a specific conversation ordered by created_at ascending.
 */
export async function getConversationMessages(conversationId: string): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at, attachment_name, attachment_url')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  throwIfError(error)
  return (data ?? []) as ChatMessageRow[]
}

/**
 * Loads complete chat state for an employee:
 * their conversations, all members in those conversations, groups, and messages.
 */
export async function loadChatState(employeeId: string): Promise<ChatState> {
  const { data: myMemberships, error: membershipError } = await supabase
    .from('conversation_members')
    .select('conversation_id, employee_id, joined_at')
    .eq('employee_id', employeeId)

  throwIfError(membershipError)

  const conversationIds = [...new Set((myMemberships ?? []).map((m) => m.conversation_id))]
  if (conversationIds.length === 0) {
    return { messages: [], conversations: [], members: [], groups: [] }
  }

  const [
    { data: conversations, error: conversationError },
    { data: members, error: membersError },
    { data: messages, error: messagesError },
  ] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, type, name, created_by, created_at')
      .in('id', conversationIds),
    supabase
      .from('conversation_members')
      .select('conversation_id, employee_id, joined_at')
      .in('conversation_id', conversationIds),
    supabase
      .from('messages')
      .select('id, conversation_id, sender_id, body, created_at, attachment_name, attachment_url')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: true }),
  ])

  throwIfError(conversationError)
  throwIfError(membersError)
  throwIfError(messagesError)

  const groupRows = (conversations ?? []).filter((c) => c.type === 'group')
  const groups: ChatGroup[] = groupRows.map((group) => ({
    id: group.id,
    name: group.name || 'Group',
    memberIds: (members ?? [])
      .filter((m) => m.conversation_id === group.id)
      .map((m) => m.employee_id),
    createdBy: group.created_by,
    createdAt: group.created_at,
  }))

  return {
    messages: (messages ?? []) as ChatMessageRow[],
    conversations: (conversations ?? []) as ChatConversationRow[],
    members: (members ?? []) as ChatMemberRow[],
    groups,
  }
}

/**
 * Inserts a new message row into public.messages.
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  attachmentName?: string,
  attachmentUrl?: string
): Promise<ChatMessageRow> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: body.trim(),
      attachment_name: attachmentName || null,
      attachment_url: attachmentUrl || null,
    })
    .select('id, conversation_id, sender_id, body, created_at, attachment_name, attachment_url')
    .single()

  throwIfError(error)
  if (!data) throw new Error('Message was not saved')
  return data as ChatMessageRow
}

/**
 * Deletes a message owned by the current employee.
 * Supabase RLS enforces that sender_id matches the authenticated employee's profile.
 */
export async function deleteMessage(messageId: string, senderId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId)
    .eq('sender_id', senderId)

  throwIfError(error)
}

/**
 * Deletes a group conversation.
 * Cascades to conversation_members and messages automatically.
 * Supabase RLS enforces that only the group creator (or Chaitra if member) can delete.
 */
export async function deleteGroup(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('type', 'group')

  throwIfError(error)
}

/**
 * Subscribes to realtime INSERT and DELETE events on public.messages for a specific conversation.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: ChatMessageRow) => void,
  onDelete?: (messageId: string) => void
) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (payload.new) {
          onMessage(payload.new as ChatMessageRow)
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        if (payload.old?.id && onDelete) {
          onDelete(payload.old.id)
        }
      }
    )
    .subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`Realtime error on messages:${conversationId}:`, status, error)
      }
    })

  return () => {
    void supabase.removeChannel(channel)
  }
}

/**
 * Subscribes to global changes on messages, conversation_members, and conversations.
 * Used to keep sidebars and unread counts up to date.
 */
export function subscribeToChat(onChange: () => void) {
  const channel = supabase
    .channel('parva-chat-db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, onChange)
    .subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('Chat realtime error:', status, error)
      }
    })

  return () => {
    void supabase.removeChannel(channel)
  }
}
