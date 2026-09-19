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

export interface ChatState {
    messages: ChatMessageRow[]
    conversations: ChatConversationRow[]
    members: ChatMemberRow[]
    groups: ChatGroup[]
}

function throwIfError(error: { message?: string } | null) {
    if (error) throw new Error(error.message || 'Chat request failed')
}

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

    const [{ data: conversations, error: conversationError }, { data: members, error: membersError }, { data: messages, error: messagesError }] = await Promise.all([
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

export async function getOrCreateDirectConversation(otherEmployeeId: string): Promise<string> {
    const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
        p_other_employee_id: otherEmployeeId,
    })
    throwIfError(error)
    if (!data) throw new Error('Could not create the direct conversation')
    return data as string
}

export async function createGroupConversation(name: string, memberIds: string[]): Promise<string> {
    const { data, error } = await supabase.rpc('create_group_conversation', {
        p_name: name,
        p_member_ids: memberIds,
    })
    throwIfError(error)
    if (!data) throw new Error('Could not create the group')
    return data as string
}

export async function sendMessage(
    conversationId: string,
    senderId: string,
    body: string,
    attachmentName?: string,
    attachmentUrl?: string,
): Promise<ChatMessageRow> {
    const { data, error } = await supabase
        .from('messages')
        .insert({
            conversation_id: conversationId,
            sender_id: senderId,
            body,
            attachment_name: attachmentName || null,
            attachment_url: attachmentUrl || null,
        })
        .select('id, conversation_id, sender_id, body, created_at, attachment_name, attachment_url')
        .single()

    throwIfError(error)
    if (!data) throw new Error('Message was not saved')
    return data as ChatMessageRow
}

export function subscribeToChat(onChange: () => void) {
    const channel = supabase
        .channel('parva-chat-db-changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'messages' },
            onChange,
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'conversation_members' },
            onChange,
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'conversations' },
            onChange,
        )
        .subscribe((status, error) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('Chat realtime error:', status, error)
            }
        })

    return () => {
        void supabase.removeChannel(channel)
    }
}
