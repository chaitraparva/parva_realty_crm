import { useState, useMemo, useRef, useEffect } from 'react'
import { Send, ArrowLeft, Search, Paperclip, FileText, X as XIcon, MessageCircle, Phone, Mail, PhoneMissed, PhoneOff, PhoneIncoming, Plus, Video, Users, Check, Trash2, Edit2, LogOut, UserPlus } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { supabase } from '../lib/supabase'
import CallModal from '../components/ui/CallModal'
import Modal from '../components/ui/Modal'
import type { Role, CallLog, InternalEmail } from '../types'
import {
  loadChatState,
  createDirectConversation,
  createGroup,
  sendMessage as saveMessage,
  deleteMessage,
  deleteGroup,
  markConversationAsRead,
  updateGroupName,
  addMembersToGroup,
  leaveGroup,
  subscribeToChat,
  subscribeToMessages,
  getAllEmployees,
  getCurrentEmployee,
  type ChatState,
  type ChatGroup,
  type ChatMessageRow,
  type ChatEmployee,
} from '../services/chatService'
import { markConversationNotificationsAsRead } from '../services/notificationService'
import type { Dispatch, SetStateAction } from 'react'

type Tab = 'chat' | 'calls' | 'email'

type UiMessage = {
  id: string
  senderId: string
  recipientId?: string
  text: string
  timestamp: string
  read: boolean
  attachmentName?: string
  attachmentUrl?: string
}

type UiGroupMessage = UiMessage & {
  groupId: string
  readBy: string[]
}

type UiConversation = {
  contact: any
  thread: UiMessage[]
  last?: UiMessage
  unread: number
}

type UiGroupConversation = {
  group: ChatGroup
  thread: UiGroupMessage[]
  last?: UiGroupMessage
  unread: number
}

function initials(name: string) {
  return (name || '').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

function formatTime(ts: string) {
  const normalized = ts.includes('T') ? ts : ts.replace(' ', 'T')
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(normalized)
  const d = new Date(hasTimezone ? normalized : `${normalized}Z`)

  if (Number.isNaN(d.getTime())) return ''

  const today = new Date()
  const isToday = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) ===
    today.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })

  if (isToday) {
    return d.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    })
  }

  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  })
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}


type PersistedCallMeta = {
  call_type?: 'voice' | 'video'
  group_id?: string
  participant_ids?: string[]
}

function parseCallMeta(notes: string | null | undefined): PersistedCallMeta {
  if (!notes) return {}
  try {
    const parsed = JSON.parse(notes)
    return parsed && typeof parsed === 'object' ? parsed as PersistedCallMeta : {}
  } catch {
    return {}
  }
}

function toUiCallLog(row: {
  id: string
  employee_id: string | null
  contact_employee_id: string | null
  direction: string
  status: string
  duration_seconds: number
  notes: string | null
  created_at: string
}): CallLog {
  const meta = parseCallMeta(row.notes)
  const callerId = row.employee_id || ''
  const calleeId = row.contact_employee_id || undefined
  const statusMap: Record<string, CallLog['status']> = {
    completed: 'Completed',
    missed: 'Missed',
    declined: 'Declined',
  }

  return {
    id: row.id,
    callerId,
    calleeId,
    groupId: meta.group_id,
    participantIds: meta.participant_ids,
    timestamp: row.created_at,
    durationSec: Number(row.duration_seconds || 0),
    status: statusMap[row.status] || 'Completed',
    type: meta.call_type === 'video' ? 'video' : 'voice',
  }
}

async function loadPersistentCallLogs(employeeId: string): Promise<CallLog[]> {
  const { data, error } = await supabase
    .from('call_logs')
    .select('id, employee_id, contact_employee_id, direction, status, duration_seconds, notes, created_at')
    .or(`employee_id.eq.${employeeId},contact_employee_id.eq.${employeeId}`)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => toUiCallLog(row))
}


type PersistedEmailMeta = {
  version: 1
  group_id?: string
  attachment_name?: string
  attachment_url?: string
}

const EMAIL_META_PREFIX = '__PARVA_EMAIL_META__'

function serializeEmailBody(body: string, meta: Omit<PersistedEmailMeta, 'version'>): string {
  const payload: PersistedEmailMeta = { version: 1, ...meta }
  return `${EMAIL_META_PREFIX}${JSON.stringify(payload)}\n${body}`
}

function parseEmailBody(rawBody: string | null | undefined): { body: string; meta: PersistedEmailMeta } {
  if (!rawBody || !rawBody.startsWith(EMAIL_META_PREFIX)) {
    return { body: rawBody || '', meta: { version: 1 } }
  }

  const newlineIndex = rawBody.indexOf('\n')
  if (newlineIndex === -1) return { body: rawBody, meta: { version: 1 } }

  try {
    const meta = JSON.parse(rawBody.slice(EMAIL_META_PREFIX.length, newlineIndex)) as PersistedEmailMeta
    return {
      body: rawBody.slice(newlineIndex + 1),
      meta: meta && typeof meta === 'object' ? meta : { version: 1 },
    }
  } catch {
    return { body: rawBody, meta: { version: 1 } }
  }
}

function toUiInternalEmail(row: {
  id: string
  sender_id: string | null
  recipient_ids: string[] | null
  subject: string
  body: string
  read_by: string[] | null
  created_at: string
}, activeEmployeeId: string): InternalEmail {
  const parsed = parseEmailBody(row.body)
  const senderId = row.sender_id || ''
  const recipientIds = Array.isArray(row.recipient_ids) ? row.recipient_ids.map(String) : []
  const isSender = senderId === activeEmployeeId
  const read = isSender || (Array.isArray(row.read_by) && row.read_by.map(String).includes(activeEmployeeId))

  return {
    id: row.id,
    senderId,
    recipientIds,
    recipientId: parsed.meta.group_id ? undefined : recipientIds[0],
    groupId: parsed.meta.group_id,
    subject: row.subject,
    body: parsed.body,
    timestamp: row.created_at,
    read,
    attachmentName: parsed.meta.attachment_name,
    attachmentUrl: parsed.meta.attachment_url,
  }
}

async function loadPersistentEmails(employeeId: string): Promise<InternalEmail[]> {
  const [sentResult, receivedResult] = await Promise.all([
    supabase
      .from('internal_emails')
      .select('id, sender_id, recipient_ids, subject, body, read_by, created_at')
      .eq('sender_id', employeeId),
    supabase
      .from('internal_emails')
      .select('id, sender_id, recipient_ids, subject, body, read_by, created_at')
      .contains('recipient_ids', [employeeId]),
  ])

  if (sentResult.error) throw new Error(sentResult.error.message)
  if (receivedResult.error) throw new Error(receivedResult.error.message)

  const byId = new Map<string, {
    id: string
    sender_id: string | null
    recipient_ids: string[] | null
    subject: string
    body: string
    read_by: string[] | null
    created_at: string
  }>()

  for (const row of [...(sentResult.data ?? []), ...(receivedResult.data ?? [])]) {
    byId.set(row.id, row as typeof row & { id: string })
  }

  return Array.from(byId.values())
    .map((row) => toUiInternalEmail(row, employeeId))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

async function insertPersistentEmail(input: {
  senderId: string
  recipientIds: string[]
  subject: string
  body: string
  groupId?: string
  attachmentName?: string
  attachmentUrl?: string
}) {
  const storedBody = serializeEmailBody(input.body, {
    ...(input.groupId ? { group_id: input.groupId } : {}),
    ...(input.attachmentName ? { attachment_name: input.attachmentName } : {}),
    ...(input.attachmentUrl ? { attachment_url: input.attachmentUrl } : {}),
  })

  const { data, error } = await supabase
    .from('internal_emails')
    .insert({
      sender_id: input.senderId,
      recipient_ids: input.recipientIds,
      subject: input.subject,
      body: storedBody,
      read_by: [input.senderId],
    })
    .select('id, sender_id, recipient_ids, subject, body, read_by, created_at')
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Email was not returned after saving')

  return toUiInternalEmail(data, input.senderId)
}

async function markPersistentEmailRead(emailId: string, employeeId: string) {
  const { data: current, error: readError } = await supabase
    .from('internal_emails')
    .select('read_by')
    .eq('id', emailId)
    .single()

  if (readError) throw new Error(readError.message)

  const currentReadBy = Array.isArray(current?.read_by) ? current.read_by.map(String) : []
  if (currentReadBy.includes(employeeId)) return

  const { error } = await supabase
    .from('internal_emails')
    .update({ read_by: [...currentReadBy, employeeId] })
    .eq('id', emailId)

  if (error) throw new Error(error.message)
}

async function insertPersistentCallLog(input: {
  employeeId: string
  contactEmployeeId?: string | null
  durationSeconds: number
  callType: 'voice' | 'video'
  groupId?: string
  participantIds?: string[]
}) {
  const notes: PersistedCallMeta = {
    call_type: input.callType,
    ...(input.groupId ? { group_id: input.groupId } : {}),
    ...(input.participantIds ? { participant_ids: input.participantIds } : {}),
  }

  const { data, error } = await supabase
    .from('call_logs')
    .insert({
      employee_id: input.employeeId,
      contact_employee_id: input.contactEmployeeId ?? null,
      lead_id: null,
      direction: 'outgoing',
      status: 'completed',
      duration_seconds: input.durationSeconds,
      notes: JSON.stringify(notes),
    })
    .select('id, employee_id, contact_employee_id, direction, status, duration_seconds, notes, created_at')
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Call log was not returned after saving')
  return toUiCallLog(data)
}

interface MessagesProps {
  role: Role
  currentUserId: string
  initialContactId?: string
  initialGroupId?: string
  // These props are retained so App.tsx does not need a large UI rewrite.
  groupList?: any[]
  setGroupList?: Dispatch<SetStateAction<any[]>>
  msgs?: any[]
  setMsgs?: Dispatch<SetStateAction<any[]>>
  callLogsList?: CallLog[]
  setCallLogsList?: Dispatch<SetStateAction<CallLog[]>>
  emailsList?: InternalEmail[]
  setEmailsList?: Dispatch<SetStateAction<InternalEmail[]>>
  groupMsgsList?: any[]
  setGroupMsgsList?: Dispatch<SetStateAction<any[]>>
}

export default function Messages({
  role,
  currentUserId,
  initialContactId,
  initialGroupId,
  groupList = [],
  callLogsList = [],
  setCallLogsList = () => { },
  emailsList = [],
  setEmailsList = () => { },
}: MessagesProps) {
  const { employees } = useData()
  const [dbEmployees, setDbEmployees] = useState<ChatEmployee[]>([])
  const [activeEmployeeId, setActiveEmployeeId] = useState<string>(currentUserId)
  const [sending, setSending] = useState(false)

  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [pendingAttachment, setPendingAttachment] = useState<{ name: string; url: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [chatState, setChatState] = useState<ChatState>({ messages: [], conversations: [], members: [], groups: [] })
  const [chatLoading, setChatLoading] = useState(true)
  const [chatError, setChatError] = useState('')

  const callLogs = callLogsList
  const setCallLogs = (value: SetStateAction<CallLog[]>) => {
    if (setCallLogsList) setCallLogsList(value)
  }
  const emails = emailsList
  const setEmails = (value: SetStateAction<InternalEmail[]>) => {
    if (setEmailsList) setEmailsList(value)
  }

  const [tab, setTab] = useState<Tab>('chat')
  const [activeCallWith, setActiveCallWith] = useState<string | null>(null)
  const [activeCallType, setActiveCallType] = useState<'voice' | 'video'>('voice')
  const [activeCallGroupId, setActiveCallGroupId] = useState<string | null>(null)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [openEmailId, setOpenEmailId] = useState<string | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [composeForm, setComposeForm] = useState({ subject: '', body: '' })
  const [composeAttachment, setComposeAttachment] = useState<{ name: string; url: string } | null>(null)
  const emailFileInputRef = useRef<HTMLInputElement>(null)
  const [showNewGroupModal, setShowNewGroupModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupMembers, setNewGroupMembers] = useState<Set<string>>(new Set())
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const [deletingMessageLoading, setDeletingMessageLoading] = useState(false)
  const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState(false)
  const [deletingGroupLoading, setDeletingGroupLoading] = useState(false)
  const [editingGroupName, setEditingGroupName] = useState(false)
  const [editGroupNameInput, setEditGroupNameInput] = useState('')
  const [savingGroupName, setSavingGroupName] = useState(false)
  const [showAddMembersModal, setShowAddMembersModal] = useState(false)
  const [newMemberSelection, setNewMemberSelection] = useState<Set<string>>(new Set())
  const [addingMembersLoading, setAddingMembersLoading] = useState(false)
  const [showLeaveGroupConfirm, setShowLeaveGroupConfirm] = useState(false)
  const [leavingGroupLoading, setLeavingGroupLoading] = useState(false)

  // Resolve authentic Supabase user -> employee record & load all active employees
  useEffect(() => {
    if (currentUserId) setActiveEmployeeId(currentUserId)

    getCurrentEmployee()
      .then((me) => {
        if (me?.id) setActiveEmployeeId(me.id)
      })
      .catch((err) => {
        console.warn('Could not resolve current employee from Supabase Auth:', err)
      })

    getAllEmployees()
      .then((all) => {
        if (all && all.length > 0) setDbEmployees(all)
      })
      .catch((err) => {
        console.error('Could not load all employees from Supabase:', err)
      })
  }, [currentUserId])

  // Load persistent call history from Supabase for this employee.
  useEffect(() => {
    let active = true
    if (!activeEmployeeId) return

    void loadPersistentCallLogs(activeEmployeeId)
      .then((logs) => {
        if (active) setCallLogsList(logs)
      })
      .catch((error) => {
        if (active) {
          console.error('Could not load call logs:', error)
        }
      })

    return () => {
      active = false
    }
  }, [activeEmployeeId, setCallLogsList])

  // Load persistent internal email history for this employee.
  useEffect(() => {
    let active = true
    if (!activeEmployeeId) return

    void loadPersistentEmails(activeEmployeeId)
      .then((loaded) => {
        if (active) setEmailsList(loaded)
      })
      .catch((error) => {
        if (active) console.error('Could not load internal emails:', error)
      })

    const channel = supabase
      .channel(`internal-emails-${activeEmployeeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_emails' },
        () => {
          void loadPersistentEmails(activeEmployeeId)
            .then((loaded) => {
              if (active) setEmailsList(loaded)
            })
            .catch((error) => console.error('Realtime email reload failed:', error))
        }
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [activeEmployeeId, setEmailsList])

  // Combine database employees with DataContext fallback
  const allEmployees = useMemo(() => {
    if (dbEmployees.length > 0) return dbEmployees
    return employees
  }, [dbEmployees, employees])

  const reloadChat = async () => {
    if (!activeEmployeeId) return
    try {
      setChatError('')
      const next = await loadChatState(activeEmployeeId)
      setChatState(next)
    } catch (error) {
      console.error('Could not load chat:', error)
      setChatError(error instanceof Error ? error.message : 'Could not load messages.')
    } finally {
      setChatLoading(false)
    }
  }

  // Initial load and global subscription
  useEffect(() => {
    let active = true
    if (!activeEmployeeId) return

    setChatLoading(true)
    setChatError('')

    void loadChatState(activeEmployeeId)
      .then((next) => {
        if (active) setChatState(next)
      })
      .catch((error) => {
        if (active) {
          console.error('Could not load chat:', error)
          setChatError(error instanceof Error ? error.message : 'Could not load messages.')
        }
      })
      .finally(() => {
        if (active) setChatLoading(false)
      })

    const unsubscribe = subscribeToChat(() => {
      void loadChatState(activeEmployeeId)
        .then((next) => {
          if (active) setChatState(next)
        })
        .catch((error) => console.error('Realtime chat reload failed:', error))
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [activeEmployeeId])

  // Active employees list: excludes only the logged in employee
  const contacts = useMemo(
    () => allEmployees.filter((e: any) => e.id !== activeEmployeeId && e.status !== 'inactive'),
    [allEmployees, activeEmployeeId]
  )

  const directConversationFor = (contactId: string) =>
    chatState.conversations.find((conversation) =>
      conversation.type === 'direct' &&
      chatState.members.some((m) => m.conversation_id === conversation.id && m.employee_id === activeEmployeeId) &&
      chatState.members.some((m) => m.conversation_id === conversation.id && m.employee_id === contactId)
    )

  const toUiMessage = (row: ChatMessageRow, recipientId?: string): UiMessage => ({
    id: row.id,
    senderId: row.sender_id,
    recipientId,
    text: row.body || '',
    timestamp: row.created_at,
    read: true,
    attachmentName: row.attachment_name || undefined,
    attachmentUrl: row.attachment_url || undefined,
  })

  const conversations = useMemo<UiConversation[]>(() => {
    const searchLower = search.trim().toLowerCase()

    return contacts
      .map((contact: any) => {
        const conversation = chatState.conversations.find((c) =>
          c.type === 'direct' &&
          chatState.members.some((m) => m.conversation_id === c.id && m.employee_id === activeEmployeeId) &&
          chatState.members.some((m) => m.conversation_id === c.id && m.employee_id === contact.id)
        )
        const thread = conversation
          ? chatState.messages
            .filter((m) => m.conversation_id === conversation.id)
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((m) => toUiMessage(m, m.sender_id === activeEmployeeId ? contact.id : activeEmployeeId))
          : []
        const last = thread[thread.length - 1]
        const myMember = conversation
          ? chatState.members.find((m) => m.conversation_id === conversation.id && m.employee_id === activeEmployeeId)
          : null
        const unread = conversation && myMember
          ? chatState.messages.filter((m) =>
              m.conversation_id === conversation.id &&
              m.sender_id !== activeEmployeeId &&
              (!myMember.last_read_at || m.created_at > myMember.last_read_at)
            ).length
          : 0
        return { contact, thread, last, unread }
      })
      .filter((c) => {
        if (!searchLower) return true
        return (
          c.contact.name?.toLowerCase().includes(searchLower) ||
          c.contact.email?.toLowerCase().includes(searchLower) ||
          c.contact.department?.toLowerCase().includes(searchLower) ||
          c.contact.designation?.toLowerCase().includes(searchLower) ||
          c.contact.role?.toLowerCase().includes(searchLower) ||
          c.contact.team?.toLowerCase().includes(searchLower)
        )
      })
      .sort((a, b) => {
        if (!a.last && !b.last) return (a.contact.name || '').localeCompare(b.contact.name || '')
        if (!a.last) return 1
        if (!b.last) return -1
        return b.last.timestamp.localeCompare(a.last.timestamp)
      })
  }, [contacts, chatState, activeEmployeeId, search])

  const groupConversations = useMemo<UiGroupConversation[]>(() => {
    const searchLower = search.trim().toLowerCase()

    return chatState.groups
      .map((group) => {
        const thread = chatState.messages
          .filter((m) => chatState.members.some((member) => member.conversation_id === group.id && member.employee_id === activeEmployeeId) && m.conversation_id === group.id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((m) => ({ ...toUiMessage(m), groupId: group.id, readBy: [m.sender_id] }))
        const last = thread[thread.length - 1]
        const myMember = chatState.members.find((m) => m.conversation_id === group.id && m.employee_id === activeEmployeeId)
        const unread = myMember
          ? chatState.messages.filter((m) =>
              m.conversation_id === group.id &&
              m.sender_id !== activeEmployeeId &&
              (!myMember.last_read_at || m.created_at > myMember.last_read_at)
            ).length
          : 0
        return { group, thread, last, unread }
      })
      .filter((g) => !searchLower || g.group.name.toLowerCase().includes(searchLower))
      .sort((a, b) => {
        if (!a.last && !b.last) return (a.group.name || '').localeCompare(b.group.name || '')
        if (!a.last) return 1
        if (!b.last) return -1
        return b.last.timestamp.localeCompare(a.last.timestamp)
      })
  }, [chatState, activeEmployeeId, search])

  const [selectedId, setSelectedId] = useState<string | null>(initialContactId ?? initialGroupId ?? null)
  const selected = conversations.find((c) => c.contact.id === selectedId)
  const selectedGroupConvo = groupConversations.find((g) => g.group.id === selectedId)

  // Dedicated realtime subscriber for active conversation thread
  useEffect(() => {
    let activeConvoId: string | undefined

    if (selectedGroupConvo) {
      activeConvoId = selectedGroupConvo.group.id
    } else if (selectedId) {
      const convo = chatState.conversations.find((c) =>
        c.type === 'direct' &&
        chatState.members.some((m) => m.conversation_id === c.id && m.employee_id === activeEmployeeId) &&
        chatState.members.some((m) => m.conversation_id === c.id && m.employee_id === selectedId)
      )
      activeConvoId = convo?.id
    }

    if (!activeConvoId) return

    const unsubscribe = subscribeToMessages(
      activeConvoId,
      (incomingRow) => {
        setChatState((prev) => {
          // Prevent duplicate messages in realtime
          if (prev.messages.some((m) => m.id === incomingRow.id)) {
            return prev
          }
          return {
            ...prev,
            messages: [...prev.messages, incomingRow],
          }
        })
        if (incomingRow.sender_id !== activeEmployeeId) {
          markCurrentAsRead(activeConvoId, selectedGroupConvo ? undefined : (selectedId || undefined))
        }
      },
      (deletedMessageId) => {
        setChatState((prev) => ({
          ...prev,
          messages: prev.messages.filter((m) => m.id !== deletedMessageId),
        }))
      }
    )

    return () => {
      unsubscribe()
    }
  }, [selectedId, selectedGroupConvo?.group.id, chatState.conversations, chatState.members, activeEmployeeId])

  const markCurrentAsRead = (convoId: string, contactId?: string) => {
    if (!convoId || !activeEmployeeId) return
    void markConversationAsRead(convoId, activeEmployeeId)
    void markConversationNotificationsAsRead(convoId, contactId, activeEmployeeId)
    const nowIso = new Date().toISOString()
    setChatState((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.conversation_id === convoId && m.employee_id === activeEmployeeId
          ? { ...m, last_read_at: nowIso }
          : m
      ),
    }))
  }

  // Automatically mark active conversation read on selection or load
  useEffect(() => {
    if (!selectedId || !activeEmployeeId) return
    if (selectedGroupConvo) {
      markCurrentAsRead(selectedGroupConvo.group.id)
    } else {
      const convo = directConversationFor(selectedId)
      if (convo) {
        markCurrentAsRead(convo.id, selectedId)
      }
    }
  }, [selectedId, activeEmployeeId, chatState.conversations.length, selectedGroupConvo?.group.id])

  const handleSaveGroupName = async () => {
    if (!selectedGroupConvo || !editGroupNameInput.trim()) return
    try {
      setSavingGroupName(true)
      const trimmed = editGroupNameInput.trim()
      await updateGroupName(selectedGroupConvo.group.id, trimmed)
      setChatState((prev) => ({
        ...prev,
        groups: prev.groups.map((g) => g.id === selectedGroupConvo.group.id ? { ...g, name: trimmed } : g),
        conversations: prev.conversations.map((c) => c.id === selectedGroupConvo.group.id ? { ...c, name: trimmed } : c),
      }))
      setEditingGroupName(false)
    } catch (err) {
      console.error('Failed to update group name:', err)
      alert(err instanceof Error ? err.message : 'Could not update group name')
    } finally {
      setSavingGroupName(false)
    }
  }

  const handleAddMembers = async () => {
    if (!selectedGroupConvo || newMemberSelection.size === 0) return
    try {
      setAddingMembersLoading(true)
      const memberIdsToAdd = Array.from(newMemberSelection)
      await addMembersToGroup(selectedGroupConvo.group.id, memberIdsToAdd)
      
      const nowIso = new Date().toISOString()
      const newMemberRows = memberIdsToAdd.map((employee_id) => ({
        conversation_id: selectedGroupConvo.group.id,
        employee_id,
        joined_at: nowIso,
        last_read_at: nowIso,
      }))

      setChatState((prev) => ({
        ...prev,
        members: [...prev.members, ...newMemberRows],
        groups: prev.groups.map((g) =>
          g.id === selectedGroupConvo.group.id
            ? { ...g, memberIds: [...new Set([...g.memberIds, ...memberIdsToAdd])] }
            : g
        ),
      }))
      setShowAddMembersModal(false)
      setNewMemberSelection(new Set())
    } catch (err) {
      console.error('Failed to add members:', err)
      alert(err instanceof Error ? err.message : 'Could not add members to group')
    } finally {
      setAddingMembersLoading(false)
    }
  }

  const handleLeaveGroup = async () => {
    if (!selectedGroupConvo || !activeEmployeeId) return
    try {
      setLeavingGroupLoading(true)
      await leaveGroup(selectedGroupConvo.group.id, activeEmployeeId)
      
      setChatState((prev) => ({
        ...prev,
        members: prev.members.filter(
          (m) => !(m.conversation_id === selectedGroupConvo.group.id && m.employee_id === activeEmployeeId)
        ),
        groups: prev.groups.filter((g) => g.id !== selectedGroupConvo.group.id),
      }))
      setSelectedId(null)
      setShowGroupInfo(false)
      setShowLeaveGroupConfirm(false)
    } catch (err) {
      console.error('Failed to leave group:', err)
      alert(err instanceof Error ? err.message : 'Could not leave group')
    } finally {
      setLeavingGroupLoading(false)
    }
  }

  const handleDeleteMessage = async () => {
    if (!deletingMessageId || !activeEmployeeId) return
    try {
      setDeletingMessageLoading(true)
      await deleteMessage(deletingMessageId, activeEmployeeId)
      setChatState((prev) => ({
        ...prev,
        messages: prev.messages.filter((m) => m.id !== deletingMessageId),
      }))
      setDeletingMessageId(null)
    } catch (err) {
      console.error('Failed to delete message:', err)
    } finally {
      setDeletingMessageLoading(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (!selectedGroupConvo) return
    const groupId = selectedGroupConvo.group.id
    try {
      setDeletingGroupLoading(true)
      await deleteGroup(groupId)
      setShowGroupInfo(false)
      setShowDeleteGroupConfirm(false)
      setSelectedId(null)
      setChatState((prev) => ({
        ...prev,
        groups: prev.groups.filter((g) => g.id !== groupId),
        conversations: prev.conversations.filter((c) => c.id !== groupId),
        messages: prev.messages.filter((m) => m.conversation_id !== groupId),
      }))
    } catch (err) {
      console.error('Failed to delete group:', err)
    } finally {
      setDeletingGroupLoading(false)
    }
  }

  useEffect(() => {
    if (initialContactId) {
      setSelectedId(initialContactId)
      setTab('chat')
    }
  }, [initialContactId])

  useEffect(() => {
    if (initialGroupId) {
      setSelectedId(initialGroupId)
      setTab('chat')
    }
  }, [initialGroupId])

  useEffect(() => {
    if (!selectedId && conversations.length > 0 && window.innerWidth >= 1024) {
      setSelectedId(null)
    }
  }, [selectedId, conversations.length])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [selected?.thread.length, selectedGroupConvo?.thread.length, selectedId])

  useEffect(() => {
    if (tab !== 'email' || !selectedId || !activeEmployeeId) return

    const unread = emails.filter((email) => {
      if (email.read) return false
      if (selectedGroupConvo) return email.groupId === selectedId
      return email.senderId === selectedId && email.recipientId === activeEmployeeId
    })

    if (unread.length === 0) return

    void Promise.all(
      unread.map((email) => markPersistentEmailRead(email.id, activeEmployeeId).catch((error) => {
        console.error('Could not mark email as read:', error)
      }))
    ).then(() => {
      setEmails((prev) =>
        prev.map((email) => (unread.some((item) => item.id === email.id) ? { ...email, read: true } : email))
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedId, activeEmployeeId, selectedGroupConvo?.group.id, emails.length])

  const openConversation = async (contactId: string) => {
    setSelectedId(contactId)
    setTab('chat')
    try {
      const convoId = await createDirectConversation(activeEmployeeId, contactId)
      if (!chatState.conversations.some((c) => c.id === convoId)) {
        await reloadChat()
      }
      markCurrentAsRead(convoId, contactId)
    } catch (err) {
      console.error('Failed to prepare direct conversation:', err)
    }
  }

  const openGroup = (groupId: string) => {
    setSelectedId(groupId)
    setTab('chat')
    markCurrentAsRead(groupId)
  }

  const send = async () => {
    if ((!draft.trim() && !pendingAttachment) || !selectedId || sending) return

    setSending(true)
    try {
      setChatError('')
      let conversationId = selectedGroupConvo?.group.id

      if (!conversationId) {
        conversationId = await createDirectConversation(activeEmployeeId, selectedId)
      }

      const myEmp = allEmployees.find((e) => e.id === activeEmployeeId)
      const saved = await saveMessage(
        conversationId,
        activeEmployeeId,
        draft.trim(),
        pendingAttachment?.name,
        pendingAttachment?.url,
        myEmp?.name
      )

      setDraft('')
      setPendingAttachment(null)

      // Add to local state immediately without waiting
      setChatState((prev) => {
        const exists = prev.messages.some((m) => m.id === saved.id)
        const hasConvo = prev.conversations.some((c) => c.id === conversationId)
        return {
          ...prev,
          conversations: hasConvo
            ? prev.conversations
            : [
              ...prev.conversations,
              {
                id: conversationId!,
                type: selectedGroupConvo ? 'group' : 'direct',
                name: selectedGroupConvo?.group.name || null,
                created_by: activeEmployeeId,
                created_at: new Date().toISOString(),
              },
            ],
          messages: exists ? prev.messages : [...prev.messages, saved],
        }
      })
    } catch (error) {
      console.error('Could not send message:', error)
      setChatError(error instanceof Error ? error.message : 'Could not send message.')
      // NOTE: draft is kept in input so user does not lose their text
    } finally {
      setSending(false)
    }
  }

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPendingAttachment({ name: file.name, url: reader.result as string })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const endCall = async (durationSec: number) => {
    try {
      if (activeCallGroupId) {
        const group = chatState.groups.find((g) => g.id === activeCallGroupId)
        const participantIds = group?.memberIds || [activeEmployeeId]

        const saved = await insertPersistentCallLog({
          employeeId: activeEmployeeId,
          contactEmployeeId: null,
          durationSeconds: durationSec,
          callType: activeCallType,
          groupId: activeCallGroupId,
          participantIds,
        })

        setCallLogs((prev) => [saved, ...prev.filter((c) => c.id !== saved.id)])
        setActiveCallGroupId(null)
        return
      }

      if (!activeCallWith) return

      const saved = await insertPersistentCallLog({
        employeeId: activeEmployeeId,
        contactEmployeeId: activeCallWith,
        durationSeconds: durationSec,
        callType: activeCallType,
      })

      setCallLogs((prev) => [saved, ...prev.filter((c) => c.id !== saved.id)])
      setActiveCallWith(null)
    } catch (error) {
      console.error('Could not save call log:', error)
      setChatError(error instanceof Error ? error.message : 'Could not save call history.')
      setActiveCallGroupId(null)
      setActiveCallWith(null)
    }
  }

  const startCall = (contactId: string, type: 'voice' | 'video') => {
    setActiveCallType(type)
    setActiveCallWith(contactId)
  }

  const startGroupCall = (groupId: string, type: 'voice' | 'video') => {
    setActiveCallType(type)
    setActiveCallGroupId(groupId)
  }

  const handleEmailFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setComposeAttachment({ name: file.name, url: reader.result as string })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const sendEmail = async () => {
    if (!composeForm.subject.trim() || !activeEmployeeId) return

    try {
      const recipientIds = selectedGroupConvo
        ? selectedGroupConvo.group.memberIds.filter((id) => id !== activeEmployeeId)
        : selectedId
          ? [selectedId]
          : []

      if (recipientIds.length === 0) return

      const saved = await insertPersistentEmail({
        senderId: activeEmployeeId,
        recipientIds,
        subject: composeForm.subject.trim(),
        body: composeForm.body.trim(),
        groupId: selectedGroupConvo?.group.id,
        attachmentName: composeAttachment?.name,
        attachmentUrl: composeAttachment?.url,
      })

      setEmails((prev) => [saved, ...prev.filter((email) => email.id !== saved.id)])
      setComposeForm({ subject: '', body: '' })
      setComposeAttachment(null)
      setShowCompose(false)
    } catch (error) {
      console.error('Could not send internal email:', error)
      setChatError(error instanceof Error ? error.message : 'Could not send email.')
    }
  }

  const toggleNewGroupMember = (id: string) => {
    setNewGroupMembers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const createGroupHandler = async () => {
    if (!newGroupName.trim() || newGroupMembers.size === 0) return
    try {
      setChatError('')
      const memberIds = [activeEmployeeId, ...Array.from(newGroupMembers)]
      const groupId = await createGroup(newGroupName.trim(), memberIds, activeEmployeeId)
      setNewGroupName('')
      setNewGroupMembers(new Set())
      setShowNewGroupModal(false)
      await reloadChat()
      setSelectedId(groupId)
      setTab('chat')
    } catch (error) {
      console.error('Could not create group:', error)
      setChatError(error instanceof Error ? error.message : 'Could not create group.')
    }
  }

  const contactCallHistory = selectedId
    ? callLogs.filter((c) => (c.callerId === activeEmployeeId && c.calleeId === selectedId) || (c.callerId === selectedId && c.calleeId === activeEmployeeId)).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    : []

  const contactEmails = selectedId
    ? emails.filter((e) => (e.senderId === activeEmployeeId && e.recipientId === selectedId) || (e.senderId === selectedId && e.recipientId === activeEmployeeId)).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    : []

  const groupCallHistory = selectedGroupConvo
    ? callLogs.filter((c) => c.groupId === selectedGroupConvo.group.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    : []

  const groupEmails = selectedGroupConvo
    ? emails.filter((e) => e.groupId === selectedGroupConvo.group.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    : []

  const groupMemberNames = (group: ChatGroup) =>
    group.memberIds
      .filter((id) => id !== activeEmployeeId)
      .map((id) => allEmployees.find((e: any) => e.id === id)?.name?.split(' ')[0])
      .filter(Boolean)
      .join(', ')

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Conversation list */}
      <div className={`w-full lg:w-80 shrink-0 border-r border-border flex-col ${selectedId ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-lg font-semibold text-foreground">Interact</h2>
            <button
              onClick={() => setShowNewGroupModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ backgroundColor: 'rgba(201,169,110,0.12)', color: '#C9A96E' }}
            >
              <Users size={13} /> New Group
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people or groups"
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {groupConversations.length > 0 && (
            <>
              <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Groups</p>
              {groupConversations.map(({ group, last, unread }) => (
                <button
                  key={group.id}
                  onClick={() => openGroup(group.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/60 hover:bg-muted/40 transition-colors text-left"
                  style={{ backgroundColor: selectedId === group.id ? 'rgba(201,169,110,0.08)' : undefined }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}
                  >
                    <Users size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{group.name}</p>
                      {last && <span className="text-[11px] text-muted-foreground shrink-0">{formatTime(last.timestamp)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground truncate">
                        {last ? `${allEmployees.find((e) => e.id === last.senderId)?.name.split(' ')[0] || 'Someone'}: ${last.text || (last.attachmentName ? 'Attachment' : 'Sent an attachment')}` : `${group.memberIds.length} members`}
                      </p>
                      {unread > 0 && (
                        <span className="ml-1 flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] font-bold text-white shrink-0 shadow-sm" style={{ backgroundColor: '#C9A96E' }}>
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Direct</p>
          {conversations.map(({ contact, last, unread }) => (
            <button
              key={contact.id}
              onClick={() => openConversation(contact.id)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/60 hover:bg-muted/40 transition-colors text-left"
              style={{ backgroundColor: selectedId === contact.id ? 'rgba(201,169,110,0.08)' : undefined }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                style={{ backgroundColor: 'rgba(28,43,74,0.1)', color: '#1C2B4A' }}
              >
                {initials(contact.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
                  {last && <span className="text-[11px] text-muted-foreground shrink-0">{formatTime(last.timestamp)}</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-xs text-muted-foreground truncate ${last ? '' : 'capitalize'}`}>
                    {last ? (last.text || (last.attachmentName ? 'Attachment' : 'Sent an attachment')) : `${contact.role} · ${contact.team}`}
                  </p>
                  {unread > 0 && (
                    <span className="ml-1 flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] font-bold text-white shrink-0 shadow-sm" style={{ backgroundColor: '#C9A96E' }}>
                      {unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
          {conversations.length === 0 && groupConversations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No matching people or groups</p>
          )}
        </div>
      </div>

      {/* Thread */}
      <div className={`flex-1 flex-col min-w-0 ${selectedId ? 'flex' : 'hidden lg:flex'}`}>
        {selectedGroupConvo ? (
          <>
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
              <button onClick={() => setSelectedId(null)} className="lg:hidden p-1 -ml-1 text-muted-foreground">
                <ArrowLeft size={18} />
              </button>
              <button onClick={() => setShowGroupInfo(true)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}
                >
                  <Users size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{selectedGroupConvo.group.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedGroupConvo.group.memberIds.length} members · {groupMemberNames(selectedGroupConvo.group)}</p>
                </div>
              </button>
              <button
                onClick={() => startGroupCall(selectedGroupConvo.group.id, 'voice')}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
                style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10B981' }}
                title="Group voice call"
              >
                <Phone size={16} />
              </button>
              <button
                onClick={() => startGroupCall(selectedGroupConvo.group.id, 'video')}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
                style={{ backgroundColor: 'rgba(37,99,235,0.1)', color: '#2563EB' }}
                title="Group video call"
              >
                <Video size={16} />
              </button>
            </div>

            <div className="flex border-b border-border">
              {([
                { id: 'chat' as Tab, label: 'Chat', icon: <MessageCircle size={14} /> },
                { id: 'calls' as Tab, label: 'Calls', icon: <Phone size={14} /> },
                { id: 'email' as Tab, label: 'Email', icon: <Mail size={14} /> },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2"
                  style={{
                    color: tab === t.id ? '#1C2B4A' : '#7A7065',
                    borderColor: tab === t.id ? '#C9A96E' : 'transparent',
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {tab === 'chat' && (
              <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ backgroundColor: '#FAF8F5' }}>
                  {chatError ? (
                    <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg text-center mx-4">{chatError}</div>
                  ) : selectedGroupConvo.thread.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center mt-8">No messages yet — say hello 👋</p>
                  ) : null}
                  {selectedGroupConvo.thread.map((m) => {
                    const mine = m.senderId === activeEmployeeId
                    const sender = allEmployees.find((e) => e.id === m.senderId)
                    return (
                      <div key={m.id} className={`group relative flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className="relative max-w-[75%] sm:max-w-[60%] px-4 py-2.5 rounded-2xl text-sm"
                          style={{
                            backgroundColor: mine ? '#1C2B4A' : '#fff',
                            color: mine ? '#FAF8F5' : '#1C2B4A',
                            border: mine ? 'none' : '1px solid #E5DFD5',
                            borderBottomRightRadius: mine ? 4 : undefined,
                            borderBottomLeftRadius: !mine ? 4 : undefined,
                          }}
                        >
                          {!mine && <p className="text-[11px] font-semibold mb-0.5" style={{ color: '#C9A96E' }}>{sender?.name}</p>}
                          {m.attachmentUrl && (
                            m.attachmentUrl.startsWith('data:image') ? (
                              <img src={m.attachmentUrl} alt={m.attachmentName} className="rounded-lg mb-1.5 max-h-40 object-cover" />
                            ) : (
                              <div className="flex items-center gap-2 mb-1.5 px-2.5 py-2 rounded-lg" style={{ backgroundColor: mine ? 'rgba(255,255,255,0.1)' : '#F5F2EC' }}>
                                <FileText size={14} />
                                <span className="text-xs truncate">{m.attachmentName}</span>
                              </div>
                            )
                          )}
                          {m.text && <p className="leading-relaxed">{m.text}</p>}
                          <div className="flex items-center justify-between gap-3 mt-1">
                            <p className="text-[10px] opacity-60">{formatTime(m.timestamp)}</p>
                            {mine && (
                              <button
                                onClick={() => setDeletingMessageId(m.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-white/60 hover:text-red-400"
                                title="Delete message"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="border-t border-border">
                  {pendingAttachment && (
                    <div className="flex items-center gap-2 px-3 pt-2.5">
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted text-xs text-foreground">
                        <FileText size={12} />
                        <span className="truncate max-w-40">{pendingAttachment.name}</span>
                        <button onClick={() => setPendingAttachment(null)} className="text-muted-foreground hover:text-foreground">
                          <XIcon size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="p-3 flex items-center gap-2">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFilePick} />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Paperclip size={16} />
                    </button>
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && send()}
                      placeholder={`Message ${selectedGroupConvo.group.name}`}
                      className="flex-1 px-4 py-2.5 rounded-full border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                    <button
                      onClick={send}
                      disabled={(!draft.trim() && !pendingAttachment) || sending}
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-opacity"
                      style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: (draft.trim() || pendingAttachment) && !sending ? 1 : 0.4 }}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {tab === 'calls' && (
              <div className="flex-1 overflow-y-auto px-5 py-4" style={{ backgroundColor: '#FAF8F5' }}>
                <div className="flex gap-2 mb-5">
                  <button
                    onClick={() => startGroupCall(selectedGroupConvo.group.id, 'voice')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}
                  >
                    <Phone size={16} /> Group Voice Call
                  </button>
                  <button
                    onClick={() => startGroupCall(selectedGroupConvo.group.id, 'video')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: '#2563EB', color: '#fff' }}
                  >
                    <Video size={16} /> Group Video Call
                  </button>
                </div>
                {groupCallHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center mt-8">No call history yet</p>
                ) : (
                  <div className="space-y-2">
                    {groupCallHistory.map((c) => {
                      const caller = employees.find((e) => e.id === c.callerId)
                      const icon = c.type === 'video' ? <Video size={15} className="text-blue-600" /> : <Phone size={15} className="text-emerald-600" />
                      return (
                        <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                          {icon}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground capitalize">{c.type} call · started by {c.callerId === currentUserId ? 'you' : caller?.name.split(' ')[0]}</p>
                            <p className="text-xs text-muted-foreground">{formatTime(c.timestamp)} · {c.participantIds?.length} participants</p>
                          </div>
                          {c.durationSec > 0 && <span className="text-xs font-medium text-muted-foreground">{formatDuration(c.durationSec)}</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'email' && (
              <div className="flex-1 overflow-y-auto px-5 py-4" style={{ backgroundColor: '#FAF8F5' }}>
                <button
                  onClick={() => setShowCompose(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold mb-5"
                  style={{ backgroundColor: '#C9A96E', color: '#1C2B4A' }}
                >
                  <Plus size={16} /> Compose Group Email
                </button>
                {groupEmails.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center mt-8">No emails in {selectedGroupConvo.group.name} yet</p>
                ) : (
                  <div className="space-y-2">
                    {groupEmails.map((e) => {
                      const sender = employees.find((emp) => emp.id === e.senderId)
                      const outgoing = e.senderId === currentUserId
                      const isOpen = openEmailId === e.id
                      return (
                        <div key={e.id} className="rounded-xl bg-card border border-border overflow-hidden">
                          <button
                            onClick={() => setOpenEmailId(isOpen ? null : e.id)}
                            className="w-full flex items-center gap-3 p-3.5 text-left"
                          >
                            <Mail size={15} className={!e.read && !outgoing ? 'text-accent' : 'text-muted-foreground'} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm truncate ${!e.read && !outgoing ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}>{e.subject}</p>
                              <p className="text-xs text-muted-foreground truncate">{outgoing ? 'You' : sender?.name.split(' ')[0]} · {formatTime(e.timestamp)}</p>
                            </div>
                            {e.attachmentName && <Paperclip size={13} className="text-muted-foreground shrink-0" />}
                          </button>
                          {isOpen && (
                            <div className="px-3.5 pb-3.5 pt-0">
                              <p className="text-sm text-foreground whitespace-pre-line border-t border-border pt-3">{e.body}</p>
                              {e.attachmentName && (
                                e.attachmentUrl?.startsWith('data:image') ? (
                                  <img src={e.attachmentUrl} alt={e.attachmentName} className="mt-3 rounded-lg max-h-48 object-cover border border-border" />
                                ) : (
                                  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm text-foreground">
                                    <FileText size={14} className="text-muted-foreground shrink-0" />
                                    <span className="truncate flex-1">{e.attachmentName}</span>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : selected ? (
          <>
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
              <button onClick={() => setSelectedId(null)} className="lg:hidden p-1 -ml-1 text-muted-foreground">
                <ArrowLeft size={18} />
              </button>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                style={{ backgroundColor: 'rgba(28,43,74,0.1)', color: '#1C2B4A' }}
              >
                {initials(selected.contact.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{selected.contact.name}</p>
                <p className="text-xs text-muted-foreground capitalize truncate">
                  {selected.contact.role === 'admin' ? 'Super Admin' : selected.contact.role === 'manager' ? 'Sales Manager' : 'CRM Agent'} · {selected.contact.team}
                </p>
              </div>
              <button
                onClick={() => startCall(selected.contact.id, 'voice')}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
                style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10B981' }}
                title="Voice call"
              >
                <Phone size={16} />
              </button>
              <button
                onClick={() => startCall(selected.contact.id, 'video')}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
                style={{ backgroundColor: 'rgba(37,99,235,0.1)', color: '#2563EB' }}
                title="Video call"
              >
                <Video size={16} />
              </button>
            </div>

            <div className="flex border-b border-border">
              {([
                { id: 'chat' as Tab, label: 'Chat', icon: <MessageCircle size={14} /> },
                { id: 'calls' as Tab, label: 'Calls', icon: <Phone size={14} /> },
                { id: 'email' as Tab, label: 'Email', icon: <Mail size={14} /> },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2"
                  style={{
                    color: tab === t.id ? '#1C2B4A' : '#7A7065',
                    borderColor: tab === t.id ? '#C9A96E' : 'transparent',
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {tab === 'chat' && (
              <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ backgroundColor: '#FAF8F5' }}>
                  {chatError ? (
                    <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg text-center mx-4">{chatError}</div>
                  ) : selected.thread.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center mt-8">No messages yet — say hello 👋</p>
                  ) : null}
                  {selected.thread.map((m) => {
                    const mine = m.senderId === activeEmployeeId
                    return (
                      <div key={m.id} className={`group relative flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className="relative max-w-[75%] sm:max-w-[60%] px-4 py-2.5 rounded-2xl text-sm"
                          style={{
                            backgroundColor: mine ? '#1C2B4A' : '#fff',
                            color: mine ? '#FAF8F5' : '#1C2B4A',
                            border: mine ? 'none' : '1px solid #E5DFD5',
                            borderBottomRightRadius: mine ? 4 : undefined,
                            borderBottomLeftRadius: !mine ? 4 : undefined,
                          }}
                        >
                          {m.attachmentUrl && (
                            m.attachmentUrl.startsWith('data:image') ? (
                              <img src={m.attachmentUrl} alt={m.attachmentName} className="rounded-lg mb-1.5 max-h-40 object-cover" />
                            ) : (
                              <div className="flex items-center gap-2 mb-1.5 px-2.5 py-2 rounded-lg" style={{ backgroundColor: mine ? 'rgba(255,255,255,0.1)' : '#F5F2EC' }}>
                                <FileText size={14} />
                                <span className="text-xs truncate">{m.attachmentName}</span>
                              </div>
                            )
                          )}
                          {m.text && <p className="leading-relaxed">{m.text}</p>}
                          <div className="flex items-center justify-between gap-3 mt-1">
                            <p className="text-[10px] opacity-60">{formatTime(m.timestamp)}</p>
                            {mine && (
                              <button
                                onClick={() => setDeletingMessageId(m.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-white/60 hover:text-red-400"
                                title="Delete message"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="border-t border-border">
                  {pendingAttachment && (
                    <div className="flex items-center gap-2 px-3 pt-2.5">
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted text-xs text-foreground">
                        <FileText size={12} />
                        <span className="truncate max-w-40">{pendingAttachment.name}</span>
                        <button onClick={() => setPendingAttachment(null)} className="text-muted-foreground hover:text-foreground">
                          <XIcon size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="p-3 flex items-center gap-2">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFilePick} />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Paperclip size={16} />
                    </button>
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && send()}
                      placeholder="Type a message"
                      className="flex-1 px-4 py-2.5 rounded-full border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                    <button
                      onClick={send}
                      disabled={(!draft.trim() && !pendingAttachment) || sending}
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-opacity"
                      style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: (draft.trim() || pendingAttachment) && !sending ? 1 : 0.4 }}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {tab === 'calls' && (
              <div className="flex-1 overflow-y-auto px-5 py-4" style={{ backgroundColor: '#FAF8F5' }}>
                <div className="flex gap-2 mb-5">
                  <button
                    onClick={() => startCall(selected.contact.id, 'voice')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}
                  >
                    <Phone size={16} /> Voice Call
                  </button>
                  <button
                    onClick={() => startCall(selected.contact.id, 'video')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: '#2563EB', color: '#fff' }}
                  >
                    <Video size={16} /> Video Call
                  </button>
                </div>
                {contactCallHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center mt-8">No call history yet</p>
                ) : (
                  <div className="space-y-2">
                    {contactCallHistory.map((c) => {
                      const outgoing = c.callerId === currentUserId
                      const icon = c.status === 'Missed' ? <PhoneMissed size={15} className="text-red-500" /> : c.status === 'Declined' ? <PhoneOff size={15} className="text-red-500" /> : c.type === 'video' ? <Video size={15} className="text-blue-600" /> : outgoing ? <Phone size={15} className="text-emerald-600" /> : <PhoneIncoming size={15} className="text-emerald-600" />
                      return (
                        <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                          {icon}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground capitalize">{outgoing ? 'Outgoing' : 'Incoming'} {c.type} · {c.status}</p>
                            <p className="text-xs text-muted-foreground">{formatTime(c.timestamp)}</p>
                          </div>
                          {c.durationSec > 0 && <span className="text-xs font-medium text-muted-foreground">{formatDuration(c.durationSec)}</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'email' && (
              <div className="flex-1 overflow-y-auto px-5 py-4" style={{ backgroundColor: '#FAF8F5' }}>
                <button
                  onClick={() => setShowCompose(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold mb-5"
                  style={{ backgroundColor: '#C9A96E', color: '#1C2B4A' }}
                >
                  <Plus size={16} /> Compose Email
                </button>
                {contactEmails.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center mt-8">No emails with {selected.contact.name.split(' ')[0]} yet</p>
                ) : (
                  <div className="space-y-2">
                    {contactEmails.map((e) => {
                      const outgoing = e.senderId === activeEmployeeId
                      const isOpen = openEmailId === e.id
                      return (
                        <div key={e.id} className="rounded-xl bg-card border border-border overflow-hidden">
                          <button
                            onClick={() => setOpenEmailId(isOpen ? null : e.id)}
                            className="w-full flex items-center gap-3 p-3.5 text-left"
                          >
                            <Mail size={15} className={!e.read && !outgoing ? 'text-accent' : 'text-muted-foreground'} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm truncate ${!e.read && !outgoing ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}>{e.subject}</p>
                              <p className="text-xs text-muted-foreground truncate">{outgoing ? 'You' : selected.contact.name.split(' ')[0]} · {formatTime(e.timestamp)}</p>
                            </div>
                            {e.attachmentName && <Paperclip size={13} className="text-muted-foreground shrink-0" />}
                          </button>
                          {isOpen && (
                            <div className="px-3.5 pb-3.5 pt-0">
                              <p className="text-sm text-foreground whitespace-pre-line border-t border-border pt-3">{e.body}</p>
                              {e.attachmentName && (
                                e.attachmentUrl?.startsWith('data:image') ? (
                                  <img src={e.attachmentUrl} alt={e.attachmentName} className="mt-3 rounded-lg max-h-48 object-cover border border-border" />
                                ) : (
                                  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm text-foreground">
                                    <FileText size={14} className="text-muted-foreground shrink-0" />
                                    <span className="truncate flex-1">{e.attachmentName}</span>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 hidden lg:flex items-center justify-center text-sm text-muted-foreground">
            Select a conversation to start messaging
          </div>
        )}
      </div>

      {(activeCallWith || activeCallGroupId) && (
        <CallModal
          open={!!(activeCallWith || activeCallGroupId)}
          callType={activeCallType}
          contactName={allEmployees.find((e) => e.id === activeCallWith)?.name || ''}
          contactInitials={initials(allEmployees.find((e) => e.id === activeCallWith)?.name || '')}
          groupName={activeCallGroupId ? (chatState.groups.find((g) => g.id === activeCallGroupId)?.name || groupList.find((g) => g.id === activeCallGroupId)?.name) : undefined}
          participants={
            activeCallGroupId
              ? (chatState.groups.find((g) => g.id === activeCallGroupId)?.memberIds || groupList.find((g) => g.id === activeCallGroupId)?.memberIds || [])
                .filter((id: string) => id !== activeEmployeeId)
                .map((id: string) => {
                  const emp = allEmployees.find((e) => e.id === id)
                  return { name: emp?.name || '', initials: initials(emp?.name || '') }
                })
              : undefined
          }
          onEnd={endCall}
        />
      )}

      <Modal open={showCompose} onClose={() => { setShowCompose(false); setComposeAttachment(null) }} title={selectedGroupConvo ? `Email ${selectedGroupConvo.group.name}` : `Email ${selected?.contact.name || ''}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Subject</label>
            <input
              value={composeForm.subject}
              onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
              placeholder="Subject"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Message</label>
            <textarea
              rows={6}
              value={composeForm.body}
              onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
              placeholder="Write your message…"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
            />
          </div>
          <div>
            <input ref={emailFileInputRef} type="file" className="hidden" onChange={handleEmailFilePick} />
            {composeAttachment ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm text-foreground">
                <FileText size={14} className="text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{composeAttachment.name}</span>
                <button onClick={() => setComposeAttachment(null)} className="text-muted-foreground hover:text-foreground">
                  <XIcon size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => emailFileInputRef.current?.click()}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Paperclip size={14} /> Attach a file
              </button>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowCompose(false); setComposeAttachment(null) }} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              onClick={sendEmail}
              disabled={!composeForm.subject.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
              style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: composeForm.subject.trim() ? 1 : 0.5 }}
            >
              Send
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showNewGroupModal} onClose={() => setShowNewGroupModal(false)} title="New Group">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Group name</label>
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g. Team Alpha, Weekend On-call"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Add members</label>
            <div className="max-h-56 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {contacts.map((c) => {
                const checked = newGroupMembers.has(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleNewGroupMember(c.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                      style={{ backgroundColor: 'rgba(28,43,74,0.1)', color: '#1C2B4A' }}
                    >
                      {initials(c.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground capitalize truncate">{c.role} · {c.team}</p>
                    </div>
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center border shrink-0"
                      style={{ backgroundColor: checked ? '#1C2B4A' : 'transparent', borderColor: checked ? '#1C2B4A' : '#E5DFD5' }}
                    >
                      {checked && <Check size={13} color="#FAF8F5" />}
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">{newGroupMembers.size} member{newGroupMembers.size !== 1 ? 's' : ''} selected</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowNewGroupModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              onClick={createGroupHandler}
              disabled={!newGroupName.trim() || newGroupMembers.size === 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
              style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: (!newGroupName.trim() || newGroupMembers.size === 0) ? 0.5 : 1 }}
            >
              Create Group
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showGroupInfo && !!selectedGroupConvo} onClose={() => { setShowGroupInfo(false); setEditingGroupName(false); }} title="Group Info">
        {selectedGroupConvo && (
          <div className="space-y-5">
            {(() => {
              const isCurrentCreator = selectedGroupConvo.group.createdBy === activeEmployeeId
              const myEmp = allEmployees.find((e) => e.id === activeEmployeeId)
              const isChaitraAdmin = (myEmp?.role === 'admin' || myEmp?.email === 'chaitra@parvarealty.ae' || role === 'admin')
              const isChaitraMember = isChaitraAdmin && selectedGroupConvo.group.memberIds.includes(activeEmployeeId)
              const canManageThisGroup = isCurrentCreator || isChaitraMember
              const canDeleteThisGroup = isCurrentCreator || isChaitraMember

              return (
                <>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}
                    >
                      <Users size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingGroupName ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editGroupNameInput}
                            onChange={(e) => setEditGroupNameInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && void handleSaveGroupName()}
                            className="flex-1 px-3 py-1.5 text-sm font-semibold rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30"
                            placeholder="Group name"
                            autoFocus
                          />
                          <button
                            onClick={() => void handleSaveGroupName()}
                            disabled={savingGroupName || !editGroupNameInput.trim()}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-50 shrink-0"
                            style={{ backgroundColor: '#1C2B4A' }}
                          >
                            {savingGroupName ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingGroupName(false)}
                            className="px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="font-serif text-lg font-semibold text-foreground truncate">{selectedGroupConvo.group.name}</h3>
                          {canManageThisGroup && (
                            <button
                              onClick={() => {
                                setEditGroupNameInput(selectedGroupConvo.group.name)
                                setEditingGroupName(true)
                              }}
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                              title="Edit group name"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Created {selectedGroupConvo.group.createdAt} by {allEmployees.find((e) => e.id === selectedGroupConvo.group.createdBy)?.name || 'Unknown'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowGroupInfo(false); startGroupCall(selectedGroupConvo.group.id, 'voice') }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10B981' }}
                    >
                      <Phone size={14} /> Voice Call
                    </button>
                    <button
                      onClick={() => { setShowGroupInfo(false); startGroupCall(selectedGroupConvo.group.id, 'video') }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: 'rgba(37,99,235,0.1)', color: '#2563EB' }}
                    >
                      <Video size={14} /> Video Call
                    </button>
                    <button
                      onClick={() => { setShowGroupInfo(false); setTab('email'); setShowCompose(true) }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: 'rgba(201,169,110,0.12)', color: '#C9A96E' }}
                    >
                      <Mail size={14} /> Email
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {selectedGroupConvo.group.memberIds.length} Members
                      </p>
                      {canManageThisGroup && (
                        <button
                          onClick={() => {
                            setNewMemberSelection(new Set())
                            setShowAddMembersModal(true)
                          }}
                          className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                        >
                          <UserPlus size={13} /> Add Members
                        </button>
                      )}
                    </div>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {selectedGroupConvo.group.memberIds.map((id) => {
                        const member = allEmployees.find((e) => e.id === id)
                        if (!member) return null
                        const isYou = id === activeEmployeeId
                        const isMemberCreator = id === selectedGroupConvo.group.createdBy
                        const isMemberChaitra = member.role === 'admin' || member.email === 'chaitra@parvarealty.ae'
                        return (
                          <div key={id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/30 transition-colors">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                              style={{ backgroundColor: 'rgba(28,43,74,0.1)', color: '#1C2B4A' }}
                            >
                              {initials(member.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{member.name} {isYou && <span className="text-muted-foreground font-normal">(you)</span>}</p>
                              <p className="text-xs text-muted-foreground capitalize truncate">{member.role} · {member.team}</p>
                            </div>
                            {isMemberCreator ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: 'rgba(201,169,110,0.12)', color: '#C9A96E' }}>
                                Creator
                              </span>
                            ) : isMemberChaitra ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: 'rgba(28,43,74,0.1)', color: '#1C2B4A' }}>
                                Admin
                              </span>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border space-y-2">
                    {!isCurrentCreator && selectedGroupConvo.group.memberIds.includes(activeEmployeeId) && (
                      <button
                        onClick={() => setShowLeaveGroupConfirm(true)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                      >
                        <LogOut size={14} /> Leave Group
                      </button>
                    )}
                    {isCurrentCreator && (
                      <p className="text-[11px] text-muted-foreground text-center">
                        You are the group creator. Creators cannot leave; you can delete the group below.
                      </p>
                    )}
                    {canDeleteThisGroup && (
                      <button
                        onClick={() => setShowDeleteGroupConfirm(true)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={14} /> Delete Group
                      </button>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </Modal>

      {/* Add Members to Group Modal */}
      <Modal
        open={showAddMembersModal && !!selectedGroupConvo}
        onClose={() => {
          setShowAddMembersModal(false)
          setNewMemberSelection(new Set())
        }}
        title={`Add Members to ${selectedGroupConvo?.group.name}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Select employees to add to this group:
          </p>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {allEmployees
              .filter((e) => e.status !== 'inactive' && !selectedGroupConvo?.group.memberIds.includes(e.id))
              .map((employee) => {
                const isSelected = newMemberSelection.has(employee.id)
                return (
                  <label
                    key={employee.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setNewMemberSelection((prev) => {
                          const next = new Set(prev)
                          if (next.has(employee.id)) next.delete(employee.id)
                          else next.add(employee.id)
                          return next
                        })
                      }}
                      className="rounded text-accent focus:ring-accent/30"
                    />
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                      style={{ backgroundColor: 'rgba(28,43,74,0.1)', color: '#1C2B4A' }}
                    >
                      {initials(employee.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{employee.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{employee.role} · {employee.team}</p>
                    </div>
                  </label>
                )
              })}
            {allEmployees.filter((e) => e.status !== 'inactive' && !selectedGroupConvo?.group.memberIds.includes(e.id)).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">All active employees are already in this group.</p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setShowAddMembersModal(false)
                setNewMemberSelection(new Set())
              }}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddMembers}
              disabled={newMemberSelection.size === 0 || addingMembersLoading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#1C2B4A' }}
            >
              {addingMembersLoading ? 'Adding…' : `Add ${newMemberSelection.size > 0 ? `(${newMemberSelection.size})` : ''}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Leave Group Confirmation Modal */}
      <Modal
        open={showLeaveGroupConfirm && !!selectedGroupConvo}
        onClose={() => setShowLeaveGroupConfirm(false)}
        title="Leave Group?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to leave <span className="font-semibold text-foreground">"{selectedGroupConvo?.group.name}"</span>? You will no longer receive new messages or participate in this group.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowLeaveGroupConfirm(false)}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLeaveGroup}
              disabled={leavingGroupLoading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {leavingGroupLoading ? 'Leaving…' : 'Leave Group'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Message Confirmation Modal */}
      <Modal
        open={!!deletingMessageId}
        onClose={() => setDeletingMessageId(null)}
        title="Delete Message?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this message? It will be removed for everyone in this conversation.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setDeletingMessageId(null)}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteMessage}
              disabled={deletingMessageLoading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {deletingMessageLoading ? 'Deleting…' : 'Delete for Everyone'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Group Confirmation Modal */}
      <Modal
        open={showDeleteGroupConfirm}
        onClose={() => setShowDeleteGroupConfirm(false)}
        title="Delete Group?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">"{selectedGroupConvo?.group.name}"</span>? All messages and conversation history in this group will be permanently deleted for all members.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowDeleteGroupConfirm(false)}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteGroup}
              disabled={deletingGroupLoading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {deletingGroupLoading ? 'Deleting…' : 'Delete Group'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
