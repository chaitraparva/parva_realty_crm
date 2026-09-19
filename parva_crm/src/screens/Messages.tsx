import { useState, useMemo, useRef, useEffect } from 'react'
import { Send, ArrowLeft, Search, Paperclip, FileText, X as XIcon, MessageCircle, Phone, Mail, PhoneMissed, PhoneOff, PhoneIncoming, Plus, Video, Users, Check } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import CallModal from '../components/ui/CallModal'
import Modal from '../components/ui/Modal'
import type { Role, CallLog, InternalEmail } from '../types'
import {
  loadChatState,
  getOrCreateDirectConversation,
  createGroupConversation,
  sendMessage as saveMessage,
  subscribeToChat,
  type ChatState,
  type ChatGroup,
  type ChatMessageRow,
} from '../services/chatService'
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

// Kept exported only for backward compatibility with any old import.
// Authentication now supplies the real employee ID; no employee ID is hardcoded here.
export const currentUserByRole: Record<Role, string> = {} as Record<Role, string>

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

function formatTime(ts: string) {
  const d = new Date(ts.replace(' ', 'T'))
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
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
  callLogsList = [],
  setCallLogsList = () => { },
  emailsList = [],
  setEmailsList = () => { },
}: MessagesProps) {
  const { employees } = useData()
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

  const reloadChat = async () => {
    if (!currentUserId) return
    try {
      setChatError('')
      const next = await loadChatState(currentUserId)
      setChatState(next)
    } catch (error) {
      console.error('Could not load chat:', error)
      setChatError(error instanceof Error ? error.message : 'Could not load messages.')
    } finally {
      setChatLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    setChatLoading(true)
    setChatError('')

    void loadChatState(currentUserId)
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
      void loadChatState(currentUserId)
        .then((next) => {
          if (active) setChatState(next)
        })
        .catch((error) => console.error('Realtime chat reload failed:', error))
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [currentUserId])

  const contacts = useMemo(
    () => employees.filter((e: any) => e.id !== currentUserId && e.status !== 'inactive'),
    [employees, currentUserId]
  )

  const directConversationFor = (contactId: string) =>
    chatState.conversations.find((conversation) =>
      conversation.type === 'direct' &&
      chatState.members.some((m) => m.conversation_id === conversation.id && m.employee_id === currentUserId) &&
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
    return contacts
      .map((contact: any) => {
        const conversation = chatState.conversations.find((c) =>
          c.type === 'direct' &&
          chatState.members.some((m) => m.conversation_id === c.id && m.employee_id === currentUserId) &&
          chatState.members.some((m) => m.conversation_id === c.id && m.employee_id === contact.id)
        )
        const thread = conversation
          ? chatState.messages
            .filter((m) => m.conversation_id === conversation.id)
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((m) => toUiMessage(m, m.sender_id === currentUserId ? contact.id : currentUserId))
          : []
        const last = thread[thread.length - 1]
        return { contact, thread, last, unread: 0 }
      })
      .filter((c) => !search || c.contact.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (!a.last && !b.last) return a.contact.name.localeCompare(b.contact.name)
        if (!a.last) return 1
        if (!b.last) return -1
        return b.last.timestamp.localeCompare(a.last.timestamp)
      })
  }, [contacts, chatState, currentUserId, search])

  const groupConversations = useMemo<UiGroupConversation[]>(() => {
    return chatState.groups
      .map((group) => {
        const thread = chatState.messages
          .filter((m) => chatState.members.some((member) => member.conversation_id === group.id && member.employee_id === currentUserId) && m.conversation_id === group.id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((m) => ({ ...toUiMessage(m), groupId: group.id, readBy: [m.sender_id] }))
        const last = thread[thread.length - 1]
        return { group, thread, last, unread: 0 }
      })
      .filter((g) => !search || g.group.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (!a.last && !b.last) return a.group.name.localeCompare(b.group.name)
        if (!a.last) return 1
        if (!b.last) return -1
        return b.last.timestamp.localeCompare(a.last.timestamp)
      })
  }, [chatState, currentUserId, search])

  const [selectedId, setSelectedId] = useState<string | null>(initialContactId ?? initialGroupId ?? null)
  const selected = conversations.find((c) => c.contact.id === selectedId)
  const selectedGroupConvo = groupConversations.find((g) => g.group.id === selectedId)

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
    if (tab === 'email' && selectedId) {
      if (selectedGroupConvo) {
        setEmails((prev) => prev.map((e) => (e.groupId === selectedId ? { ...e, read: true } : e)))
      } else {
        setEmails((prev) => prev.map((e) => (e.senderId === selectedId && e.recipientId === currentUserId ? { ...e, read: true } : e)))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedId, currentUserId])

  const openConversation = (contactId: string) => {
    setSelectedId(contactId)
    setTab('chat')
  }

  const openGroup = (groupId: string) => {
    setSelectedId(groupId)
    setTab('chat')
  }

  const send = async () => {
    if ((!draft.trim() && !pendingAttachment) || !selectedId) return

    try {
      setChatError('')
      let conversationId = selectedGroupConvo?.group.id

      if (!conversationId) {
        conversationId = await getOrCreateDirectConversation(selectedId)
      }

      await saveMessage(
        conversationId,
        currentUserId,
        draft.trim(),
        pendingAttachment?.name,
        pendingAttachment?.url,
      )

      setDraft('')
      setPendingAttachment(null)
      await reloadChat()
    } catch (error) {
      console.error('Could not send message:', error)
      setChatError(error instanceof Error ? error.message : 'Could not send message.')
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

  const endCall = (durationSec: number) => {
    if (activeCallGroupId) {
      const group = chatState.groups.find((g) => g.id === activeCallGroupId)
      const newCall: CallLog = {
        id: `call-${Date.now()}`,
        callerId: currentUserId,
        groupId: activeCallGroupId,
        participantIds: group?.memberIds || [currentUserId],
        timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
        durationSec,
        status: 'Completed',
        type: activeCallType,
      }
      setCallLogs((prev) => [...prev, newCall])
      setActiveCallGroupId(null)
      return
    }
    if (!activeCallWith) return
    const newCall: CallLog = {
      id: `call-${Date.now()}`,
      callerId: currentUserId,
      calleeId: activeCallWith,
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      durationSec,
      status: 'Completed',
      type: activeCallType,
    }
    setCallLogs((prev) => [...prev, newCall])
    setActiveCallWith(null)
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

  const sendEmail = () => {
    if (!composeForm.subject.trim()) return
    if (selectedGroupConvo) {
      const newEmail: InternalEmail = {
        id: `iemail-${Date.now()}`,
        senderId: currentUserId,
        groupId: selectedGroupConvo.group.id,
        recipientIds: selectedGroupConvo.group.memberIds.filter((id) => id !== currentUserId),
        subject: composeForm.subject.trim(),
        body: composeForm.body.trim(),
        timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
        read: true,
        attachmentName: composeAttachment?.name,
        attachmentUrl: composeAttachment?.url,
      }
      setEmails((prev) => [...prev, newEmail])
      setComposeForm({ subject: '', body: '' })
      setComposeAttachment(null)
      setShowCompose(false)
      return
    }
    if (!selectedId) return
    const newEmail: InternalEmail = {
      id: `iemail-${Date.now()}`,
      senderId: currentUserId,
      recipientId: selectedId,
      subject: composeForm.subject.trim(),
      body: composeForm.body.trim(),
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      read: true,
      attachmentName: composeAttachment?.name,
      attachmentUrl: composeAttachment?.url,
    }
    setEmails((prev) => [...prev, newEmail])
    setComposeForm({ subject: '', body: '' })
    setComposeAttachment(null)
    setShowCompose(false)
  }

  const toggleNewGroupMember = (id: string) => {
    setNewGroupMembers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const createGroup = async () => {
    if (!newGroupName.trim() || newGroupMembers.size === 0) return
    try {
      setChatError('')
      const memberIds = [currentUserId, ...Array.from(newGroupMembers)]
      const groupId = await createGroupConversation(newGroupName.trim(), memberIds)
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
    ? callLogs.filter((c) => (c.callerId === currentUserId && c.calleeId === selectedId) || (c.callerId === selectedId && c.calleeId === currentUserId)).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    : []

  const contactEmails = selectedId
    ? emails.filter((e) => (e.senderId === currentUserId && e.recipientId === selectedId) || (e.senderId === selectedId && e.recipientId === currentUserId)).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    : []

  const groupCallHistory = selectedGroupConvo
    ? callLogs.filter((c) => c.groupId === selectedGroupConvo.group.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    : []

  const groupEmails = selectedGroupConvo
    ? emails.filter((e) => e.groupId === selectedGroupConvo.group.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    : []

  const groupMemberNames = (group: ChatGroup) =>
    group.memberIds
      .filter((id) => id !== currentUserId)
      .map((id) => employees.find((e: any) => e.id === id)?.name?.split(' ')[0])
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
                        {last ? `${employees.find((e) => e.id === last.senderId)?.name.split(' ')[0]}: ${last.text || 'Sent an attachment'}` : `${group.memberIds.length} members`}
                      </p>
                      {unread > 0 && (
                        <span className="ml-1 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: '#C9A96E' }}>
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
                    {last ? last.text : `${contact.role} · ${contact.team}`}
                  </p>
                  {unread > 0 && (
                    <span className="ml-1 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: '#C9A96E' }}>
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
                  {selectedGroupConvo.thread.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center mt-8">No messages yet — say hello 👋</p>
                  )}
                  {selectedGroupConvo.thread.map((m) => {
                    const mine = m.senderId === currentUserId
                    const sender = employees.find((e) => e.id === m.senderId)
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className="max-w-[75%] sm:max-w-[60%] px-4 py-2.5 rounded-2xl text-sm"
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
                          <p className="text-[10px] mt-1 opacity-60">{formatTime(m.timestamp)}</p>
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
                      disabled={!draft.trim() && !pendingAttachment}
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-opacity"
                      style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: (draft.trim() || pendingAttachment) ? 1 : 0.4 }}
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
                  {selected.thread.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center mt-8">No messages yet — say hello 👋</p>
                  )}
                  {selected.thread.map((m) => {
                    const mine = m.senderId === currentUserId
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className="max-w-[75%] sm:max-w-[60%] px-4 py-2.5 rounded-2xl text-sm"
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
                          <p className="text-[10px] mt-1 opacity-60">{formatTime(m.timestamp)}</p>
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
                      disabled={!draft.trim() && !pendingAttachment}
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-opacity"
                      style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: (draft.trim() || pendingAttachment) ? 1 : 0.4 }}
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
          contactName={employees.find((e) => e.id === activeCallWith)?.name || ''}
          contactInitials={initials(employees.find((e) => e.id === activeCallWith)?.name || '')}
          groupName={activeCallGroupId ? groupList.find((g) => g.id === activeCallGroupId)?.name : undefined}
          participants={
            activeCallGroupId
              ? groupList
                .find((g) => g.id === activeCallGroupId)
                ?.memberIds.filter((id) => id !== currentUserId)
                .map((id) => {
                  const emp = employees.find((e) => e.id === id)
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
              onClick={createGroup}
              disabled={!newGroupName.trim() || newGroupMembers.size === 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
              style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: (!newGroupName.trim() || newGroupMembers.size === 0) ? 0.5 : 1 }}
            >
              Create Group
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showGroupInfo && !!selectedGroupConvo} onClose={() => setShowGroupInfo(false)} title="Group Info">
        {selectedGroupConvo && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}
              >
                <Users size={22} />
              </div>
              <div>
                <h3 className="font-serif text-lg font-semibold text-foreground">{selectedGroupConvo.group.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Created {selectedGroupConvo.group.createdAt} by {employees.find((e) => e.id === selectedGroupConvo.group.createdBy)?.name || 'Unknown'}
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
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                {selectedGroupConvo.group.memberIds.length} Members
              </p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {selectedGroupConvo.group.memberIds.map((id) => {
                  const member = employees.find((e) => e.id === id)
                  if (!member) return null
                  const isYou = id === currentUserId
                  const isCreator = id === selectedGroupConvo.group.createdBy
                  return (
                    <div key={id} className="flex items-center gap-3 px-2 py-2 rounded-lg">
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
                      {isCreator && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: 'rgba(201,169,110,0.12)', color: '#C9A96E' }}>
                          Creator
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
