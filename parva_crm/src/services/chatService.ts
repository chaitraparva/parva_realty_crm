import { supabase } from '../lib/supabase'
import { sendChatMessageNotifications } from './notificationService'

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
  description?: string | null
  avatar_url?: string | null
  created_by: string
  created_at: string
}

export interface ChatMemberRow {
  conversation_id: string
  employee_id: string
  joined_at: string
  last_read_at?: string
}

export interface ChatGroup {
  id: string
  name: string
  description?: string
  avatarUrl?: string
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

export interface ChatMessageReaction {
  id?: string
  conversation_id: string
  message_id: string
  employee_id: string
  emoji: string
  created_at?: string
}

export interface ChatState {
  messages: ChatMessageRow[]
  conversations: ChatConversationRow[]
  members: ChatMemberRow[]
  groups: ChatGroup[]
  reactions: Record<string, ChatMessageReaction[]>
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || 'Chat request failed')
}

/**
 * Detects if a PostgREST/Postgres error is specifically due to the missing last_read_at column.
 */
function isMissingLastReadAtColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return (
    error.code === '42703' ||
    (typeof error.message === 'string' &&
      error.message.toLowerCase().includes('last_read_at') &&
      error.message.toLowerCase().includes('does not exist'))
  )
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
  let myMemberships: any[] | null = null
  const { data: firstMyMemberships, error: firstMembershipError } = await supabase
    .from('conversation_members')
    .select('conversation_id, employee_id, joined_at, last_read_at')
    .eq('employee_id', employeeId)

  if (firstMembershipError) {
    if (isMissingLastReadAtColumn(firstMembershipError)) {
      // Gracefully fall back to querying without last_read_at if column does not exist
      const { data: fallbackMyMemberships, error: fallbackError } = await supabase
        .from('conversation_members')
        .select('conversation_id, employee_id, joined_at')
        .eq('employee_id', employeeId)

      throwIfError(fallbackError)
      myMemberships = fallbackMyMemberships
    } else {
      // Re-throw any other database / auth / network error
      throwIfError(firstMembershipError)
    }
  } else {
    myMemberships = firstMyMemberships
  }

  const conversationIds = [...new Set((myMemberships ?? []).map((m) => m.conversation_id))]
  if (conversationIds.length === 0) {
    return { messages: [], conversations: [], members: [], groups: [], reactions: {} }
  }

  const [
    conversationsResult,
    membersResult,
    { data: messages, error: messagesError },
    reactionsResult,
  ] = await Promise.all([
    (async () => {
      const first = await supabase
        .from('conversations')
        .select('id, type, name, description, avatar_url, created_by, created_at')
        .in('id', conversationIds)

      if (first.error) {
        // Fall back to original columns if description/avatar_url do not exist yet
        return supabase
          .from('conversations')
          .select('id, type, name, created_by, created_at')
          .in('id', conversationIds)
      }
      return first
    })(),
    (async () => {
      const first = await supabase
        .from('conversation_members')
        .select('conversation_id, employee_id, joined_at, last_read_at')
        .in('conversation_id', conversationIds)

      if (first.error && isMissingLastReadAtColumn(first.error)) {
        return supabase
          .from('conversation_members')
          .select('conversation_id, employee_id, joined_at')
          .in('conversation_id', conversationIds)
      }
      return first
    })(),
    supabase
      .from('messages')
      .select('id, conversation_id, sender_id, body, created_at, attachment_name, attachment_url')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: true }),
    (async () => {
      try {
        const { data, error } = await supabase
          .from('message_reactions')
          .select('id, conversation_id, message_id, employee_id, emoji, created_at')
          .in('conversation_id', conversationIds)
        if (error) return []
        return (data || []) as ChatMessageReaction[]
      } catch {
        return [] as ChatMessageReaction[]
      }
    })(),
  ])

  throwIfError(conversationsResult.error)
  throwIfError(membersResult.error)
  throwIfError(messagesError)

  const conversations = conversationsResult.data
  const members = membersResult.data
  const groupRows = (conversations ?? []).filter((c) => c.type === 'group')
  const groups: ChatGroup[] = groupRows.map((group) => ({
    id: group.id,
    name: group.name || 'Group',
    description: (group as any).description || '',
    avatarUrl: (group as any).avatar_url || '',
    memberIds: (members ?? [])
      .filter((m) => m.conversation_id === group.id)
      .map((m) => m.employee_id),
    createdBy: group.created_by,
    createdAt: group.created_at,
  }))

  const reactionsMap: Record<string, ChatMessageReaction[]> = {}
  ;(reactionsResult || []).forEach((r) => {
    if (!reactionsMap[r.message_id]) {
      reactionsMap[r.message_id] = []
    }
    reactionsMap[r.message_id].push(r)
  })

  return {
    messages: (messages ?? []) as ChatMessageRow[],
    conversations: (conversations ?? []) as ChatConversationRow[],
    members: (members ?? []) as ChatMemberRow[],
    groups,
    reactions: reactionsMap,
  }
}

/**
 * Inserts a new message row into public.messages and notifies recipient members.
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  attachmentName?: string,
  attachmentUrl?: string,
  senderName?: string
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

  // Keep sender's own conversation read state up to date
  void markConversationAsRead(conversationId, senderId).catch(() => {})

  // Dispatch incoming chat notifications to other members asynchronously
  void (async () => {
    try {
      const [{ data: convo }, { data: members }] = await Promise.all([
        supabase.from('conversations').select('type, name').eq('id', conversationId).maybeSingle(),
        supabase.from('conversation_members').select('employee_id').eq('conversation_id', conversationId),
      ])

      const recipientIds = (members ?? [])
        .map((m) => m.employee_id)
        .filter((id) => id && id !== senderId)

      if (recipientIds.length === 0) return

      let resolvedName = senderName
      if (!resolvedName) {
        const { data: senderEmp } = await supabase
          .from('employees')
          .select('name')
          .eq('id', senderId)
          .maybeSingle()
        resolvedName = senderEmp?.name || 'Someone'
      }

      await sendChatMessageNotifications({
        senderId,
        senderName: resolvedName || 'Someone',
        conversationId,
        conversationType: convo?.type || 'direct',
        groupName: convo?.name,
        body: body.trim(),
        recipientIds,
      })
    } catch (err) {
      console.warn('Failed to send chat notifications:', err)
    }
  })()

  return data as ChatMessageRow
}

/**
 * Updates an employee's last_read_at timestamp for a conversation in public.conversation_members.
 */
export async function markConversationAsRead(
  conversationId: string,
  employeeId: string
): Promise<void> {
  const { error } = await supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('employee_id', employeeId)

  if (error && !isMissingLastReadAtColumn(error)) {
    console.warn('Failed to mark conversation as read in Supabase:', error.message)
  }
}

/**
 * Updates a group conversation name, description, and avatar.
 * Supabase RLS enforces that only group creator or Chaitra (when member) can update.
 */
export async function updateGroupProfile(
  conversationId: string,
  updates: { name?: string; description?: string; avatarUrl?: string | null }
): Promise<void> {
  const payload: any = {}
  if (updates.name !== undefined) {
    const trimmed = updates.name.trim()
    if (!trimmed) throw new Error('Group name cannot be empty')
    payload.name = trimmed
  }
  if (updates.description !== undefined) {
    payload.description = updates.description.trim()
  }
  if (updates.avatarUrl !== undefined) {
    payload.avatar_url = updates.avatarUrl || null
  }

  if (Object.keys(payload).length === 0) return

  const { error } = await supabase
    .from('conversations')
    .update(payload)
    .eq('id', conversationId)
    .eq('type', 'group')

  if (error) {
    // If error is due to missing columns in DB, fallback to updating just the name
    if (payload.name && (updates.description !== undefined || updates.avatarUrl !== undefined)) {
      const { error: nameError } = await supabase
        .from('conversations')
        .update({ name: payload.name })
        .eq('id', conversationId)
        .eq('type', 'group')
      throwIfError(nameError)
      return
    }
    throwIfError(error)
  }
}

/**
 * Updates a group conversation name (backward compatibility).
 */
export async function updateGroupName(
  conversationId: string,
  name: string
): Promise<void> {
  return updateGroupProfile(conversationId, { name })
}

/**
 * Adds new members to an existing group conversation.
 */
export async function addMembersToGroup(
  conversationId: string,
  newEmployeeIds: string[]
): Promise<void> {
  if (newEmployeeIds.length === 0) return

  const rows = newEmployeeIds.map((employee_id) => ({
    conversation_id: conversationId,
    employee_id,
  }))

  const { error } = await supabase
    .from('conversation_members')
    .insert(rows)

  throwIfError(error)
}

/**
 * Removes a member from a group (can be called by creator, admin, or the member themselves).
 */
export async function removeMemberFromGroup(
  conversationId: string,
  employeeId: string
): Promise<void> {
  const { error } = await supabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('employee_id', employeeId)

  throwIfError(error)
}

/**
 * Leaves a group conversation by deleting the member row from public.conversation_members.
 */
export async function leaveGroup(
  conversationId: string,
  employeeId: string
): Promise<void> {
  return removeMemberFromGroup(conversationId, employeeId)
}

/**
 * Toggles a message reaction in the database (or graceful fallback).
 * Returns 'add' if reaction was added, 'remove' if removed.
 */
export async function toggleMessageReaction(
  conversationId: string,
  messageId: string,
  employeeId: string,
  emoji: string,
  currentHasReacted: boolean
): Promise<'add' | 'remove'> {
  if (currentHasReacted) {
    try {
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('employee_id', employeeId)
        .eq('emoji', emoji)
    } catch (err) {
      console.warn('Could not delete reaction from database:', err)
    }
    return 'remove'
  } else {
    try {
      await supabase
        .from('message_reactions')
        .insert({
          conversation_id: conversationId,
          message_id: messageId,
          employee_id: employeeId,
          emoji,
        })
    } catch (err) {
      console.warn('Could not insert reaction into database:', err)
    }
    return 'add'
  }
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
  const { data, error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('type', 'group')
    .select('id')

  throwIfError(error)
  // RLS silently blocks deletes you are not allowed to do (0 rows, no error).
  if (!data || data.length === 0) {
    throw new Error('You do not have permission to delete this group.')
  }
}

export type ReactionSignalPayload = {
  conversationId: string
  messageId: string
  employeeId: string
  emoji: string
  action: 'add' | 'remove'
}

export type GroupUpdateSignalPayload = {
  conversationId: string
  name?: string
  description?: string
  avatarUrl?: string | null
}

export interface MessageSubscriptionHandle {
  (): void
  unsubscribe: () => void
  broadcastReaction: (payload: ReactionSignalPayload) => Promise<void>
  broadcastGroupUpdate: (payload: GroupUpdateSignalPayload) => Promise<void>
}

/**
 * Subscribes to realtime INSERT and DELETE events on public.messages for a specific conversation,
 * plus realtime broadcast events for reactions and group profile updates.
 */
export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: ChatMessageRow) => void,
  onDelete?: (messageId: string) => void,
  onReaction?: (reaction: ReactionSignalPayload) => void,
  onGroupUpdate?: (update: GroupUpdateSignalPayload) => void
): MessageSubscriptionHandle {
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
    .on(
      'broadcast',
      { event: 'reaction' },
      (payload) => {
        if (payload.payload && onReaction) {
          onReaction(payload.payload as ReactionSignalPayload)
        }
      }
    )
    .on(
      'broadcast',
      { event: 'group_update' },
      (payload) => {
        if (payload.payload && onGroupUpdate) {
          onGroupUpdate(payload.payload as GroupUpdateSignalPayload)
        }
      }
    )
    .subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`Realtime error on messages:${conversationId}:`, status, error)
      }
    })

  const unsubscribeFn = (() => {
    void supabase.removeChannel(channel)
  }) as MessageSubscriptionHandle

  unsubscribeFn.unsubscribe = () => {
    void supabase.removeChannel(channel)
  }

  unsubscribeFn.broadcastReaction = async (payload: ReactionSignalPayload) => {
    try {
      await channel.send({
        type: 'broadcast',
        event: 'reaction',
        payload,
      })
    } catch (err) {
      console.warn('Could not broadcast reaction:', err)
    }
  }

  unsubscribeFn.broadcastGroupUpdate = async (payload: GroupUpdateSignalPayload) => {
    try {
      await channel.send({
        type: 'broadcast',
        event: 'group_update',
        payload,
      })
    } catch (err) {
      console.warn('Could not broadcast group update:', err)
    }
  }

  return unsubscribeFn
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
