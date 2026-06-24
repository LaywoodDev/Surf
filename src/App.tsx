import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Search, ArrowUp, User, Users, Copy, Trash2, Image, File, Camera, Settings, LogOut, Shield, Pencil, MoreVertical, Pin, Folder, X, Reply, ChevronDown, BarChart3, Cloud, BadgeCheck, ChevronRight, CheckCircle, Check, Loader2, AlertCircle } from 'lucide-react'
import { t, langName, p } from './i18n'
import * as e2e from './crypto'
import Offer from './pages/Offer'
import Contacts from './pages/Contacts'
import ProSuccess from './pages/ProSuccess'
import './App.css'

interface Chat {
  id: number
  name: string
  lastMessage: string
  time: string
  pinned?: boolean
  participantId?: number
  participantAvatar?: string
  participantOnline?: boolean
  participantLastSeen?: string | null
  isGroup?: boolean
  participantCount?: number
  avatar?: string
  role?: 'admin' | 'member'
}

interface GroupParticipant {
  id: number
  name: string
  surname?: string
  username?: string
  avatar?: string
  role?: 'admin' | 'member'
}

interface Folder {
  id: number
  name: string
  icon: string
  sortOrder: number
  chats: number[]
}

interface Plan {
  id: number
  name: string
  price_rub: number
  duration_days: number
  description: string
}

interface ProStatus {
  active: boolean
  end_date?: string
}

interface PollOption {
  id: number
  text: string
  votes: number
}

interface Poll {
  id: number
  question: string
  createdBy: number
  options: PollOption[]
  totalVotes: number
  userVote: number | null
}

interface Message {
  id: number
  sender: 'me' | 'them'
  text: string
  time: string
  createdAt?: string
  status?: 'sent' | 'delivered' | 'read'
  senderId?: number
  senderName?: string
  senderAvatar?: string
  replyToId?: number
  replyText?: string
  replyAttachmentUrl?: string
  replyAttachmentType?: string
  viaOpus?: boolean
  attachmentUrl?: string
  attachmentType?: string
  pollId?: number
}

interface UserData {
  id: number
  name: string
  surname: string
  email: string
  username: string
  phone: string
  bio: string
  avatar?: string
}

const API = '/api'
const CHAT_DRAFTS_STORAGE_KEY = 'surf_chat_drafts'
const SETTINGS_STORAGE_KEY = 'surf_settings'
const defaultSettings = {
  language: 'English',
  theme: 'Dark',
  previews: 'On',
  sounds: 'On',
  lastSeen: 'Everyone',
  profilePhoto: 'Everyone',
  autoDownload: 'Wi-Fi only',
  phonePrivacy: 'Everyone',
  emailPrivacy: 'Everyone',
  bioPrivacy: 'Everyone',
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? { ...defaultSettings, ...parsed } : defaultSettings
  } catch {
    return defaultSettings
  }
}

function loadChatDrafts() {
  try {
    const raw = localStorage.getItem(CHAT_DRAFTS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Record<number, string> : {}
  } catch {
    return {}
  }
}

function getChatDraftPreview(text?: string) {
  const draft = text?.trim()
  return draft ? `Draft: ${draft}` : null
}

function getMessageDayKey(createdAt?: string) {
  if (!createdAt) return null
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function formatMessageDay(createdAt?: string) {
  if (!createdAt) return ''
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  if (isSameDay(date, today)) return 'Today'
  if (isSameDay(date, yesterday)) return 'Yesterday'

  return date.toLocaleDateString([], { day: 'numeric', month: 'long' })
}

async function uploadPendingFile(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return api('/upload/file', { method: 'POST', body: formData })
}

function api(path: string, options?: RequestInit) {
  const token = localStorage.getItem('token')
  const isFormData = options?.body instanceof FormData
  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  }).then(r => r.json().then(d => {
    if (!r.ok) throw new Error(d.error || 'Request failed')
    return d
  }))
}

function formatLastSeen(lastSeen: string | null | undefined, online: boolean | null | undefined, lang: string): string {
  if (online) return t('online', lang)
  if (!lastSeen) return ''
  const diff = Date.now() - new Date(lastSeen + 'Z').getTime()
  if (diff < 60000) return t('lastSeenFormat', lang).replace('%s', '1 min')
  if (diff < 3600000) return t('lastSeenFormat', lang).replace('%s', `${Math.floor(diff / 60000)} min`)
  if (diff < 86400000) return t('lastSeenFormat', lang).replace('%s', `${Math.floor(diff / 3600000)} h`)
  const d = new Date(lastSeen + 'Z')
  return t('lastSeenFormat', lang).replace('%s', `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`)
}

function MessageStatusIcon({ status }: { status?: 'sent' | 'delivered' | 'read' }) {
  if (!status) return null

  if (status === 'sent') {
    return <Check size={13} strokeWidth={2.2} className="message-status-icon" />
  }

  return (
    <span className={`message-status-double${status === 'read' ? ' is-read' : ''}`}>
      <Check size={13} strokeWidth={2.2} className="message-status-icon overlap" />
      <Check size={13} strokeWidth={2.2} className="message-status-icon" />
    </span>
  )
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<UserData | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authForm, setAuthForm] = useState({ name: '', surname: '', email: '', password: '' })
  const [isLoggedIn, setIsLoggedIn] = useState(!!token)

  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'chat' | 'profile' | 'settings' | 'edit-profile' | 'group'>('home')
  const [activeChatId, setActiveChatId] = useState<number | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [chatInputTexts, setChatInputTexts] = useState<Record<number, string>>(loadChatDrafts)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)

  const [inputText, setInputText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [opusMessagesLoading, setOpusMessagesLoading] = useState(false)
  const [aiConversation, setAiConversation] = useState<{ role: 'user' | 'ai'; text: string; time?: string }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserData[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const aiMessagesRef = useRef<HTMLDivElement>(null)
  const initialMsgCount = useRef(aiConversation.length)
  const avatarRef = useRef<HTMLDivElement>(null)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [attachMenu, setAttachMenu] = useState<{ x: number; y: number; dir: 'up' | 'down' } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; messageId: number } | null>(null)
  const [aiContextMenu, setAiContextMenu] = useState<{ x: number; y: number; index: number } | null>(null)
  const [chatContextMenu, setChatContextMenu] = useState<{ x: number; y: number; chatId: number } | null>(null)
  const [profileMenu, setProfileMenu] = useState<{ x: number; y: number } | null>(null)
  const [settingDropdown, setSettingDropdown] = useState<{ key: string; x: number; y: number } | null>(null)
  const [chatMenu, setChatMenu] = useState<{ x: number; y: number } | null>(null)
  const [memberMenu, setMemberMenu] = useState<{ participantId: number; x: number; y: number } | null>(null)
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
  const groupInfoAddInputRef = useRef<HTMLInputElement>(null)
  const [clearChatSubmenu, setClearChatSubmenu] = useState(false)
  const [deleteMessageSubmenu, setDeleteMessageSubmenu] = useState(false)
  const [settingsSection, setSettingsSection] = useState<'general' | 'account' | 'privacy'>('general')
  const [editProfile, setEditProfile] = useState({ username: '', phone: '', bio: '' })
  const [proOpen, setProOpen] = useState(false)
  const [proPlan, setProPlan] = useState<'monthly' | 'annual'>('annual')
  const [proPlans, setProPlans] = useState<Plan[]>([])
  const [proStatus, setProStatus] = useState<ProStatus | null>(null)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentErrorClosing, setPaymentErrorClosing] = useState(false)
  const closePaymentError = () => {
    setPaymentErrorClosing(true)
    setTimeout(() => {
      setPaymentError(null)
      setPaymentErrorClosing(false)
    }, 220)
  }
  const closeCreateGroup = useCallback(() => {
    setCreateGroupClosing(true)
    setTimeout(() => {
      setCreateGroupOpen(false)
      setCreateGroupClosing(false)
    }, 220)
  }, [])
  const closeDeleteFolderConfirm = useCallback(() => {
    setDeleteFolderConfirmClosing(true)
    setTimeout(() => {
      setDeleteFolderConfirm(null)
      setDeleteFolderConfirmClosing(false)
    }, 220)
  }, [])
  const closeRenameFolder = useCallback(() => {
    setRenameFolderClosing(true)
    setTimeout(() => {
      setRenameFolderId(null)
      setRenameFolderInput('')
      setRenameFolderClosing(false)
    }, 220)
  }, [])
  const submitRenameFolder = () => {
    const folderId = renameFolderId
    const name = renameFolderInput.trim()
    if (!folderId || !name) return
    api(`/folders/${folderId}`, { method: 'PUT', body: JSON.stringify({ name }) }).then(() => {
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name } : f))
      closeRenameFolder()
      setFolderContextMenu(null)
    }).catch(err => alert(err.message))
  }
  const closeNewFolder = useCallback(() => {
    setNewFolderClosing(true)
    setTimeout(() => {
      setNewFolderOpen(false)
      setNewFolderInput('')
      setNewFolderClosing(false)
    }, 220)
  }, [])
  const submitNewFolder = () => {
    const name = newFolderInput.trim()
    if (!name) return
    createFolder(name)
    closeNewFolder()
  }
  const [pageStack, setPageStack] = useState<string[]>(() => {
    const p = window.location.pathname
    if (p === '/offer') return ['offer']
    if (p === '/contacts') return ['contacts']
    return []
  })
  const [showProSuccess, setShowProSuccess] = useState(window.location.pathname === '/pro/success')
  const [contactProfile, setContactProfile] = useState<UserData | null>(null)
  const [viewedUser, setViewedUser] = useState<UserData | null>(null)
  const [contacts, setContacts] = useState<UserData[]>([])
  const [mentionMenu, setMentionMenu] = useState<{ chatId: number; query: string } | null>(null)
  const [replyTo, setReplyTo] = useState<{ messageId: number; text: string; attachmentUrl?: string; attachmentType?: string } | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<{ url: string; type: string; name: string }[]>([])
  const [isPeerTyping, setIsPeerTyping] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null)
  const [folderDropdown, setFolderDropdown] = useState<{ chatId: number; x: number; y: number } | null>(null)
  const [folderContextMenu, setFolderContextMenu] = useState<{ x: number; y: number; folderId: number } | null>(null)
  const [newChatCtxMenu, setNewChatCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [folderEditOpen, setFolderEditOpen] = useState(false)
  const [folderEditInput, setFolderEditInput] = useState('')
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<number | null>(null)
  const [deleteFolderConfirmClosing, setDeleteFolderConfirmClosing] = useState(false)
  const [renameFolderId, setRenameFolderId] = useState<number | null>(null)
  const [renameFolderInput, setRenameFolderInput] = useState('')
  const [renameFolderClosing, setRenameFolderClosing] = useState(false)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderInput, setNewFolderInput] = useState('')
  const [newFolderClosing, setNewFolderClosing] = useState(false)
  const [efSelectedFolderId, setEfSelectedFolderId] = useState<number | null>(null)
  const [efRenamingId, setEfRenamingId] = useState<number | null>(null)
  const [efRenamingInput, setEfRenamingInput] = useState('')
  const [efAddOpen, setEfAddOpen] = useState(false)
  const [efAddQuery, setEfAddQuery] = useState('')
  const [efChatQuery, setEfChatQuery] = useState('')
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [toastClosing, setToastClosing] = useState(false)
  const typingHeartbeatRef = useRef<Record<number, number>>({})
  const typingStopTimeoutRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const [pollModalOpen, setPollModalOpen] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [pollsCache, setPollsCache] = useState<Record<number, Poll>>({})

  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [createGroupClosing, setCreateGroupClosing] = useState(false)
  const [createGroupName, setCreateGroupName] = useState('')
  const [createGroupSelected, setCreateGroupSelected] = useState<number[]>([])
  const [groupParticipants, setGroupParticipants] = useState<GroupParticipant[]>([])
  const [groupInfoAddQuery, setGroupInfoAddQuery] = useState('')
  const [groupInfoAddResults, setGroupInfoAddResults] = useState<UserData[]>([])
  const [groupAvatarUploading, setGroupAvatarUploading] = useState(false)

  const profileAvatarRef = useRef<HTMLDivElement>(null)
  const avatarCloneRef = useRef<{ clone: HTMLElement; original: HTMLElement; overlay: HTMLDivElement } | null>(null)
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    if (token) {
      api('/users/me').then(u => {
        setUser(u)
        setEditProfile({ username: u.username || '', phone: u.phone || '', bio: u.bio || '' })
        if (u.privacy) {
          setSettings(prev => ({
            ...prev,
            phonePrivacy: u.privacy.phone || 'Everyone',
            emailPrivacy: u.privacy.email || 'Everyone',
            bioPrivacy: u.privacy.bio || 'Everyone',
            profilePhoto: u.privacy.profilePhoto || 'Everyone',
            lastSeen: u.privacy.lastSeen || 'Everyone',
          }))
        }
      }).catch(() => {
        localStorage.removeItem('token')
        setToken(null)
        setIsLoggedIn(false)
      })
    }
  }, [token])

  useEffect(() => {
    if (isLoggedIn) {
      api('/chats').then(async (data: Chat[]) => {
        const decrypted = await Promise.all(data.map(async (c) => {
          if (c.participantId && c.lastMessage && e2e.isEncrypted(c.lastMessage)) {
            const key = await e2e.getSharedKey(c.participantId, localStorage.getItem('token')!)
            if (key) c.lastMessage = await e2e.decrypt(key, c.lastMessage)
          }
          return c
        }))
        setChats(decrypted)
      })
      api('/folders').then(setFolders)
      api('/users/contacts').then(setContacts)
      api('/subscription/status').then(setProStatus).catch(() => {})
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (!isLoggedIn) return
    api('/users/ping', { method: 'POST' }).catch(() => {})
    const pingInterval = window.setInterval(() => {
      api('/users/ping', { method: 'POST' }).catch(() => {})
    }, 30000)
    return () => window.clearInterval(pingInterval)
  }, [isLoggedIn])

  useEffect(() => {
    if (proOpen) {
      api('/subscription/plans').then(data => setProPlans(data.plans || [])).catch(() => {})
    }
  }, [proOpen])

  useEffect(() => {
    localStorage.setItem(CHAT_DRAFTS_STORAGE_KEY, JSON.stringify(chatInputTexts))
  }, [chatInputTexts])

  useEffect(() => {
    const currentChat = chats.find(c => c.id === activeChatId)
    if (!activeChatId || !currentChat?.participantId || currentChat.name === 'Opus') {
      setIsPeerTyping(false)
      return
    }

    let typingStableAt = 0

    const pollTyping = () => {
      api(`/chats/${activeChatId}/typing`).then((res: { typing: boolean }) => {
        const isTyping = !!res.typing
        if (isTyping) {
          if (!typingStableAt) typingStableAt = Date.now()
          else if (Date.now() - typingStableAt > 15000) {
            setIsPeerTyping(false)
            return
          }
        } else {
          typingStableAt = 0
        }
        setIsPeerTyping(isTyping)
      }).catch(() => setIsPeerTyping(false))
    }

    pollTyping()
    const interval = window.setInterval(pollTyping, 1800)
    return () => window.clearInterval(interval)
  }, [activeChatId, chats])

  useEffect(() => {
    if (activeChatId) {
      const chat = chats.find(c => c.id === activeChatId)
      const fetchMessages = () => {
        api(`/chats/${activeChatId}/messages`).then(async (msgs: Message[]) => {
          if (chat?.participantId && !chat.isGroup && chat.name !== 'Opus') {
            const key = await e2e.getSharedKey(chat.participantId, localStorage.getItem('token')!)
            if (key) {
              msgs = await Promise.all(msgs.map(async m => ({
                ...m,
                text: await e2e.decrypt(key, m.text)
              })))
            }
          }
          setMessages(prev => {
            if (prev.length === msgs.length && prev.every((m, i) => m.id === msgs[i].id)) return prev
            const hasNewThem = msgs.some(m => m.sender === 'them' && !prev.some(p => p.id === m.id))
            if (hasNewThem) setIsPeerTyping(false)
            return msgs
          })
          if (chat && !chat.isGroup && chat.name !== 'Opus') {
            api(`/chats/${activeChatId}/read`, { method: 'POST' }).then(() => {
              setMessages(prev => prev.map(m => m.sender === 'them' ? { ...m, status: 'read' } : m))
            }).catch(() => {})
          }
        })
      }

      fetchMessages()
      if (chat?.isGroup) {
        api(`/chats/${activeChatId}/participants`).then(setGroupParticipants).catch(() => setGroupParticipants([]))
        setContactProfile(null)
      } else {
        api(`/chats/${activeChatId}/other-user`).then(setContactProfile).catch(() => setContactProfile(null))
      }
      api(`/polls/chat/${activeChatId}`).then((polls: Poll[]) => {
        const cacheUpdate: Record<number, Poll> = {}
        polls.forEach(p => { cacheUpdate[p.id] = p })
        setPollsCache(prev => ({ ...prev, ...cacheUpdate }))
      }).catch(() => {})

      const pollInterval = window.setInterval(fetchMessages, 3000)
      return () => {
        window.clearInterval(pollInterval)
      }
    }
    setMentionMenu(null)
    setViewedUser(null)
    setGroupParticipants([])
  }, [activeChatId, chats])

  const opusLoadedRef = useRef(false)
  useEffect(() => {
    if (activeTab === 'home' && chats.length > 0 && !opusLoadedRef.current) {
      opusLoadedRef.current = true
      const opusChatId = chats.find(c => c.name === 'Opus')?.id
      if (opusChatId) {
        setOpusMessagesLoading(true)
        api(`/chats/${opusChatId}/messages`).then((msgs: any[]) => {
          setAiConversation(msgs.map(m => ({
            role: (m.sender === 'me' ? 'user' : 'ai') as 'user' | 'ai',
            text: m.text,
            time: m.time
          })))
          initialMsgCount.current = msgs.length
        }).catch(() => {}).finally(() => setOpusMessagesLoading(false))
      }
    }
    if (activeTab !== 'home') {
      opusLoadedRef.current = false
    }
  }, [activeTab, chats])

  const [firstHomeEntry, setFirstHomeEntry] = useState(true)

  useEffect(() => {
    if (firstHomeEntry) {
      const t = setTimeout(() => setFirstHomeEntry(false), 600)
      return () => clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (aiMessagesRef.current) {
      aiMessagesRef.current.scrollTop = aiMessagesRef.current.scrollHeight
    }
  }, [aiConversation, aiLoading])

  useEffect(() => {
    if (activeTab === 'search') {
      searchInputRef.current?.blur()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'search' && searchQuery.trim()) {
      const t = setTimeout(() => {
        api(`/users/search?q=${encodeURIComponent(searchQuery)}`).then(setSearchResults)
      }, 300)
      return () => clearTimeout(t)
    } else {
      setSearchResults([])
    }
  }, [searchQuery, activeTab])

  const activeChat = chats.find(c => c.id === activeChatId)
  const hasEditChanges = editProfile.username !== (user?.username || '') || editProfile.phone !== (user?.phone || '') || editProfile.bio !== (user?.bio || '')

  const playSentMessageSound = () => {
    if (settings.sounds !== 'On') return
    new Audio(`${import.meta.env.BASE_URL}sentmessage_1.mp3`).play().catch(() => {})
  }

  const handleSendMessage = async (chatId: number) => {
    const text = chatInputTexts[chatId]?.trim()
    if (!text && pendingAttachments.length === 0) return
    setMentionMenu(null)

    const atts = pendingAttachments
    const chat = chats.find(c => c.id === chatId)
    let finalText = text
    const e2eKey = chat?.participantId && !chat.isGroup && chat.name !== 'Opus'
      ? await e2e.getSharedKey(chat.participantId, localStorage.getItem('token')!)
      : null
    if (finalText && e2eKey) finalText = await e2e.encrypt(e2eKey, finalText)
    const body: any = { text: finalText, replyTo: replyTo?.messageId }
    if (atts.length > 0) {
      body.attachmentUrl = atts[0].url
      body.attachmentType = atts[0].type
    }

    api(`/chats/${chatId}/messages`, { method: 'POST', body: JSON.stringify(body) }).then(async (msg: any) => {
      if (e2eKey) {
        if (msg.messages && Array.isArray(msg.messages)) {
          msg.messages = await Promise.all(msg.messages.map(async (m: any) => ({
            ...m,
            text: m.sender === 'me' ? await e2e.decrypt(e2eKey, m.text) : m.text
          })))
        } else {
          msg.text = await e2e.decrypt(e2eKey, msg.text)
        }
      }
      if (msg.messages && Array.isArray(msg.messages)) {
        setMessages(prev => [...prev, ...msg.messages])
      } else {
        setMessages(prev => [...prev, msg])
      }
      playSentMessageSound()
      if (typingStopTimeoutRef.current[chatId]) {
        clearTimeout(typingStopTimeoutRef.current[chatId])
        delete typingStopTimeoutRef.current[chatId]
      }
      sendTypingFalse(chatId)
      setChatInputTexts(prev => ({ ...prev, [chatId]: '' }))
      setReplyTo(null)
      setPendingAttachments([])
      const lastMsg = msg.messages ? msg.messages[msg.messages.length - 1] : msg
      setChats(prev => prev.map(c =>
        c.id === chatId ? { ...c, lastMessage: text || lastMsg.attachmentType || t('attachment', settings.language), time: lastMsg.time } : c
      ))
      const remaining = atts.slice(1)
      if (remaining.length > 0) {
        remaining.forEach((att, i) => {
          setTimeout(() => {
            api(`/chats/${chatId}/messages`, { method: 'POST', body: JSON.stringify({ text: '', attachmentUrl: att.url, attachmentType: att.type }) }).then((m: any) => {
              setMessages(prev => {
                const newMsgs = m.messages ? m.messages : [m]
                return [...prev, ...newMsgs]
              })
            })
          }, (i + 1) * 200)
        })
      }
    })
  }

  const handleCreatePoll = () => {
    if (!activeChatId || !pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) return
    api('/polls', {
      method: 'POST',
      body: JSON.stringify({
        chatId: activeChatId,
        question: pollQuestion.trim(),
        options: pollOptions.filter(o => o.trim()),
      })
    }).then((res: any) => {
      const newPoll: Poll = {
        id: res.pollId,
        question: res.question,
        createdBy: res.createdBy,
        options: res.options.map((o: any) => ({ id: o.id, text: o.text, votes: 0 })),
        totalVotes: 0,
        userVote: null,
      }
      setPollsCache(prev => ({ ...prev, [newPoll.id]: newPoll }))
      api(`/chats/${activeChatId}/messages`).then(async (msgs: any[]) => {
        const chat = chats.find(c => c.id === activeChatId)
        if (chat?.participantId && !chat.isGroup && chat.name !== 'Opus') {
          const key = await e2e.getSharedKey(chat.participantId, localStorage.getItem('token')!)
          if (key) {
            msgs = await Promise.all(msgs.map(async m => ({
              ...m,
              text: await e2e.decrypt(key, m.text)
            })))
          }
        }
        setMessages(msgs)
        const lastMsg = msgs[msgs.length - 1]
        if (lastMsg) {
          setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, lastMessage: t('poll', settings.language), time: lastMsg.time } : c))
        }
      })
      setPollModalOpen(false)
      setPollQuestion('')
      setPollOptions(['', ''])
    }).catch(err => alert(err.message))
  }

  const loadPoll = (pollId: number) => {
    if (pollsCache[pollId]) return
    api(`/polls/chat/${activeChatId}`).then((polls: Poll[]) => {
      const cacheUpdate: Record<number, Poll> = {}
      polls.forEach(p => { cacheUpdate[p.id] = p })
      setPollsCache(prev => ({ ...prev, ...cacheUpdate }))
    }).catch(() => {})
  }

  const handleVote = (pollId: number, optionId: number) => {
    api(`/polls/${pollId}/vote`, { method: 'POST', body: JSON.stringify({ optionId }) }).then((res: any) => {
      setPollsCache(prev => ({
        ...prev,
        [pollId]: {
          ...prev[pollId],
          options: res.options,
          totalVotes: res.totalVotes,
          userVote: res.userVote,
        }
      }))
    }).catch(err => alert(err.message))
  }

  const sendTypingFalse = (chatId: number) => {
    delete typingHeartbeatRef.current[chatId]
    api(`/chats/${chatId}/typing`, { method: 'POST', body: JSON.stringify({ typing: false }) }).catch(() => {})
  }

  const handleChatInputChange = (chatId: number, value: string) => {
    setChatInputTexts(prev => ({ ...prev, [chatId]: value }))
    const chat = chats.find(c => c.id === chatId)
    if (chat?.participantId && chat.name !== 'Opus') {
      const now = Date.now()
      const hasText = value.trim().length > 0
      if (hasText) {
        if (!typingHeartbeatRef.current[chatId] || now - typingHeartbeatRef.current[chatId] > 2000) {
          typingHeartbeatRef.current[chatId] = now
          api(`/chats/${chatId}/typing`, { method: 'POST', body: JSON.stringify({ typing: true }) }).catch(() => {})
        }
        if (typingStopTimeoutRef.current[chatId]) {
          clearTimeout(typingStopTimeoutRef.current[chatId])
        }
        typingStopTimeoutRef.current[chatId] = setTimeout(() => sendTypingFalse(chatId), 3000)
      }
      if (!hasText) {
        if (typingStopTimeoutRef.current[chatId]) {
          clearTimeout(typingStopTimeoutRef.current[chatId])
          delete typingStopTimeoutRef.current[chatId]
        }
        sendTypingFalse(chatId)
      }
    }
    const input = chatInputRefs.current[chatId]
    if (!input) return
    const cursorPos = input.selectionStart || 0
    const textBeforeCursor = value.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    if (lastAtIndex === -1) {
      setMentionMenu(null)
      return
    }
    const afterAt = textBeforeCursor.slice(lastAtIndex + 1)
    if (afterAt.includes(' ') || afterAt.includes('\n')) {
      setMentionMenu(null)
      return
    }
    setMentionMenu({ chatId, query: afterAt.toLowerCase() })
  }

  const handleChatPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = Array.from(e.clipboardData.items || [])
    const imageItem = items.find(item => item.type.startsWith('image/'))
    if (!imageItem) return

    const file = imageItem.getAsFile()
    if (!file) return

    e.preventDefault()
    try {
      const res = await uploadPendingFile(file)
      setPendingAttachments(prev => [...prev, { url: res.url, type: res.type, name: file.name || 'clipboard-image.png' }])
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to paste image')
    }
  }

  const insertMention = (chatId: number, username: string) => {
    const input = chatInputRefs.current[chatId]
    if (!input) return
    const value = chatInputTexts[chatId] || ''
    const cursorPos = input.selectionStart || 0
    const textBeforeCursor = value.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    if (lastAtIndex === -1) return
    const before = value.slice(0, lastAtIndex)
    const after = value.slice(cursorPos)
    const newValue = before + '@' + username + ' ' + after
    setChatInputTexts(prev => ({ ...prev, [chatId]: newValue }))
    setMentionMenu(null)
    setTimeout(() => {
      const newPos = lastAtIndex + username.length + 2
      input.focus()
      input.setSelectionRange(newPos, newPos)
    }, 0)
  }

  const clearChat = (chatId: number, forBoth: boolean) => {
    api(`/chats/${chatId}/messages`, { method: 'DELETE', body: JSON.stringify({ forBoth }) }).then(() => {
      setChatInputTexts(prev => ({ ...prev, [chatId]: '' }))
      if (activeChatId === chatId) {
        setMessages([])
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, lastMessage: '', time: '' } : c))
      }
      closeChatMenu()
    }).catch(() => {})
  }

  const handleCreateGroup = () => {
    const name = createGroupName.trim()
    if (!name || createGroupSelected.length === 0) return
    api('/chats/group', {
      method: 'POST',
      body: JSON.stringify({ name, participantIds: createGroupSelected })
    }).then((newChat: Chat) => {
      setChats(prev => [newChat, ...prev])
      setActiveChatId(newChat.id)
      setActiveTab('chat')
      closeCreateGroup()
      setCreateGroupName('')
      setCreateGroupSelected([])
    }).catch(err => alert(err.message))
  }

  const handleAddGroupMember = (userId: number) => {
    if (!activeChatId) return
    api(`/chats/${activeChatId}/participants`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    }).then(() => {
      api(`/chats/${activeChatId}/participants`).then(setGroupParticipants).catch(() => setGroupParticipants([]))
      setGroupInfoAddQuery('')
      setGroupInfoAddResults([])
      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, participantCount: (c.participantCount || 0) + 1 } : c))
    }).catch(err => alert(err.message))
  }

  const handleRemoveGroupMember = (userId: number) => {
    if (!activeChatId) return
    api(`/chats/${activeChatId}/participants/${userId}`, { method: 'DELETE' }).then(() => {
      api(`/chats/${activeChatId}/participants`).then(setGroupParticipants).catch(() => setGroupParticipants([]))
      setGroupParticipants(prev => prev.filter(p => p.id !== userId))
      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, participantCount: Math.max(1, (c.participantCount || 1) - 1) } : c))
    }).catch(err => alert(err.message))
  }

  const handleLeaveGroup = () => {
    if (!activeChatId || !user) return
    api(`/chats/${activeChatId}/participants/${user.id}`, { method: 'DELETE' }).then(() => {
      setChats(prev => prev.filter(c => c.id !== activeChatId))
      setActiveChatId(null)
      setActiveTab('home')
      setMessages([])
    }).catch(err => alert(err.message))
  }

  const handleGroupAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>, chatId: number) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('avatar', file)
    formData.append('chatId', String(chatId))
    setGroupAvatarUploading(true)
    try {
      const res = await api('/upload/group-avatar', { method: 'POST', body: formData })
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, avatar: res.avatar } : c))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to upload avatar')
    } finally {
      setGroupAvatarUploading(false)
    }
  }

  useEffect(() => {
    if (!activeChatId || !groupInfoAddQuery.trim()) {
      setGroupInfoAddResults([])
      return
    }
    const t = setTimeout(() => {
      api(`/users/search?q=${encodeURIComponent(groupInfoAddQuery)}`).then((results: UserData[]) => {
        const existingIds = new Set(groupParticipants.map(p => p.id))
        setGroupInfoAddResults(results.filter(r => !existingIds.has(r.id)))
      }).catch(() => setGroupInfoAddResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [groupInfoAddQuery, groupParticipants, activeChatId])

  const openChatWithUser = (username: string) => {
    if (username.toLowerCase() === 'opus') {
      setActiveTab('home')
      setActiveChatId(null)
      return
    }
    api('/chats/find-or-create', { method: 'POST', body: JSON.stringify({ username }) }).then((chat: any) => {
      setChats(prev => {
        if (prev.find(c => c.id === chat.id)) return prev
        return [chat, ...prev]
      })
      setActiveChatId(chat.id)
      setActiveTab('chat')
    }).catch(() => {})
  }

  const renderMessageText = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9_.]+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const username = part.slice(1)
        return <span key={i} className="mention-link" onClick={() => openChatWithUser(username)}>{part}</span>
      }
      return <span key={i}>{part}</span>
    })
  }

  const handleAiSend = async () => {
    const text = inputText.trim()
    if (!text || aiLoading) return
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setInputText('')
    setAiConversation(prev => [...prev, { role: 'user', text, time: now }])
    setAiLoading(true)
    try {
      const opusChatId = chats.find(c => c.name === 'Opus')?.id
      const result = await api('/ai/process', {
        method: 'POST',
        body: JSON.stringify({ text, history: aiConversation, chatId: opusChatId })
      })
      setAiConversation(prev => [...prev, { role: 'ai', text: result.response, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])
    } catch {
      setAiConversation(prev => [...prev, { role: 'ai', text: 'Произошла ошибка. Попробуйте ещё раз.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])
    } finally {
      setAiLoading(false)
    }
  }

  const openAvatarAnim = useCallback(() => {
    const original = profileAvatarRef.current
    if (!original || !user?.avatar) return
    const rect = original.getBoundingClientRect()

    const overlay = document.createElement('div')
    overlay.className = 'avatar-expand-overlay'
    document.body.appendChild(overlay)
    void overlay.offsetWidth
    overlay.classList.add('open')

    const clone = original.cloneNode(true) as HTMLElement
    clone.style.position = 'fixed'
    clone.style.top = `${rect.top}px`
    clone.style.left = `${rect.left}px`
    clone.style.width = `${rect.width}px`
    clone.style.height = `${rect.height}px`
    clone.style.margin = '0'
    clone.style.zIndex = '10000'
    clone.style.transition = 'none'
    document.body.appendChild(clone)

    const dot = clone.querySelector('.online-dot')
    if (dot) dot.remove()

    clone.addEventListener('click', closeAvatarAnim)
    overlay.addEventListener('click', closeAvatarAnim)

    original.style.opacity = '0'
    original.style.transition = 'opacity 0.1s ease'

    const targetSize = Math.min(window.innerWidth * 0.5, window.innerHeight * 0.6, 400)
    const scale = targetSize / rect.width
    const deltaX = window.innerWidth / 2 - (rect.left + rect.width / 2)
    const deltaY = window.innerHeight / 2 - (rect.top + rect.height / 2)

    clone.animate([
      { transform: 'translate(0,0) scale(1)' },
      { transform: `translate(${deltaX}px, ${deltaY}px) scale(${scale})` }
    ], {
      duration: 500,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'forwards'
    })

    avatarCloneRef.current = { clone, original, overlay }
    setAvatarOpen(true)
  }, [user?.avatar])

  const closeAvatarAnim = useCallback(() => {
    const animData = avatarCloneRef.current
    if (!animData) return
    const { clone, original, overlay } = animData
    avatarCloneRef.current = null

    const rect = original.getBoundingClientRect()
    const targetSize = Math.min(window.innerWidth * 0.5, window.innerHeight * 0.6, 400)
    const scale = targetSize / rect.width
    const deltaX = window.innerWidth / 2 - (rect.left + rect.width / 2)
    const deltaY = window.innerHeight / 2 - (rect.top + rect.height / 2)

    clone.getAnimations().forEach(a => a.cancel())

    const anim = clone.animate([
      { transform: `translate(${deltaX}px, ${deltaY}px) scale(${scale})` },
      { transform: 'translate(0,0) scale(1)' }
    ], {
      duration: 400,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'forwards'
    })

    if (overlay) overlay.classList.remove('open')

    anim.onfinish = () => {
      clone.remove()
      if (overlay) overlay.remove()
      original.style.opacity = ''
      original.style.transition = ''
      setAvatarOpen(false)
    }
  }, [])

  const handleContextMenu = (e: React.MouseEvent, messageId: number) => {
    e.preventDefault()
    if (contextMenu) { closeContextMenu(); return }
    setContextMenu({ x: e.clientX, y: e.clientY, messageId })
  }

  const closeContextMenu = () => {
    setContextMenu(null)
    setDeleteMessageSubmenu(false)
  }

  const copyMessage = () => {
    if (!contextMenu) return
    const msg = messages.find(m => m.id === contextMenu.messageId)
    if (msg) navigator.clipboard.writeText(msg.text)
    closeContextMenu()
  }

  const closeAiContextMenu = () => setAiContextMenu(null)

  const copyAiMessage = () => {
    if (!aiContextMenu) return
    const msg = aiConversation[aiContextMenu.index]
    if (msg) navigator.clipboard.writeText(msg.text)
    closeAiContextMenu()
  }

  const copyField = (label: string, value: string) => {
    navigator.clipboard.writeText(value)
    setToastClosing(false)
    setToast(`${label} ${t('copied', settings.language)}`)
    setTimeout(() => setToastClosing(true), 1200)
    setTimeout(() => { setToast(null); setToastClosing(false) }, 1500)
  }

  const replyMessage = () => {
    if (!contextMenu) return
    const msg = messages.find(m => m.id === contextMenu.messageId)
    if (msg) setReplyTo({ messageId: msg.id, text: msg.text, attachmentUrl: msg.attachmentUrl, attachmentType: msg.attachmentType })
    closeContextMenu()
  }

  const deleteMessage = (forBoth: boolean) => {
    if (!contextMenu || !activeChatId) return
    api(`/chats/${activeChatId}/messages/${contextMenu.messageId}`, {
      method: 'DELETE',
      body: JSON.stringify({ forBoth })
    }).then(() => {
      setMessages(prev => prev.filter(m => m.id !== contextMenu.messageId))
      setDeleteMessageSubmenu(false)
      closeContextMenu()
    }).catch(err => alert(err.message))
  }

  const deleteChat = () => {
    if (!chatContextMenu) return
    api(`/chats/${chatContextMenu.chatId}`, { method: 'DELETE' }).then(() => {
      setChats(prev => prev.filter(c => c.id !== chatContextMenu.chatId))
      setChatContextMenu(null)
    }).catch(err => alert(err.message))
  }

  const togglePinChat = (chatId: number) => {
    const chat = chats.find(c => c.id === chatId)
    if (!chat) return
    const newPinned = !chat.pinned
    api(`/chats/${chatId}/pin`, { method: 'PUT', body: JSON.stringify({ pinned: newPinned }) }).then(() => {
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, pinned: newPinned } : c).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)))
      setChatContextMenu(null)
    }).catch(err => alert(err.message))
  }

  const addChatToFolder = (chatId: number, folderId: number) => {
    api(`/folders/${folderId}/chats/${chatId}`, { method: 'POST' }).then(() => {
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, chats: [...f.chats, chatId] } : f))
      setFolderDropdown(null)
      setChatContextMenu(null)
    }).catch(err => alert(err.message))
  }

  const createFolder = (name: string) => {
    api('/folders', { method: 'POST', body: JSON.stringify({ name }) }).then((folder: Folder) => {
      setFolders(prev => [...prev, folder])
    }).catch(err => alert(err.message))
  }

  const renameFolder = (folderId: number) => {
    const folder = folders.find(f => f.id === folderId)
    setRenameFolderInput(folder?.name || '')
    setRenameFolderId(folderId)
    setFolderContextMenu(null)
  }

  const deleteFolder = (folderId: number) => {
    setDeleteFolderConfirm(folderId)
    setFolderContextMenu(null)
  }

  const confirmDeleteFolder = () => {
    const folderId = deleteFolderConfirm
    if (!folderId) return
    api(`/folders/${folderId}`, { method: 'DELETE' }).then(() => {
      setFolders(prev => prev.filter(f => f.id !== folderId))
      if (activeFolderId === folderId) setActiveFolderId(null)
      if (efSelectedFolderId === folderId) setEfSelectedFolderId(null)
      closeDeleteFolderConfirm()
    }).catch(err => alert(err.message))
  }

  const startEfRename = (folderId: number) => {
    const folder = folders.find(f => f.id === folderId)
    setEfRenamingInput(folder?.name || '')
    setEfRenamingId(folderId)
  }

  const submitEfRename = () => {
    const folderId = efRenamingId
    const name = efRenamingInput.trim()
    if (!folderId || !name) { setEfRenamingId(null); return }
    api(`/folders/${folderId}`, { method: 'PUT', body: JSON.stringify({ name }) }).then(() => {
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name } : f))
      setEfRenamingId(null)
    }).catch(err => alert(err.message))
  }

  const cancelEfRename = () => setEfRenamingId(null)

  const closeAttachMenu = () => setAttachMenu(null)
  const closeProfileMenu = () => setProfileMenu(null)
  const closeChatContextMenu = () => setChatContextMenu(null)
  const closeFolderDropdown = () => setFolderDropdown(null)
  const closeChatMenu = () => setChatMenu(null)
  const closeMemberMenu = () => setMemberMenu(null)
  const closeFolderContextMenu = () => setFolderContextMenu(null)
  const closeNewChatCtxMenu = () => setNewChatCtxMenu(null)

  const handleClearActiveChat = () => {
    setNewChatCtxMenu(null)
    if (activeTab === 'home') {
      const opusChatId = chats.find(c => c.name === 'Opus')?.id
      if (opusChatId) api(`/chats/${opusChatId}/messages`, { method: 'DELETE' }).catch(() => {})
      setAiConversation([])
    } else if (activeChatId) {
      clearChat(activeChatId, false)
    }
  }
  const closeSettingDropdown = () => setSettingDropdown(null)

  const settingOptions: Record<string, string[]> = {
    lastSeen: ['Everyone', 'My Contacts', 'Nobody'],
    profilePhoto: ['Everyone', 'My Contacts', 'Nobody'],
    phonePrivacy: ['Everyone', 'My Contacts', 'Nobody'],
    emailPrivacy: ['Everyone', 'My Contacts', 'Nobody'],
    bioPrivacy: ['Everyone', 'My Contacts', 'Nobody'],
    autoDownload: ['Wi-Fi only', 'Always', 'Never'],
    language: ['English', 'Russian'],
  }

  const cycleSetting = (key: keyof typeof settings, options: string[]) => {
    setSettings(prev => {
      const idx = options.indexOf(prev[key])
      return { ...prev, [key]: options[(idx + 1) % options.length] }
    })
  }

  const selectSetting = (key: string, value: string) => {
    setSettings(prev => {
      const next = { ...prev, [key as keyof typeof prev]: value }
      if (key === 'phonePrivacy' || key === 'emailPrivacy' || key === 'bioPrivacy' || key === 'profilePhoto' || key === 'lastSeen') {
        api('/users/me/privacy', {
          method: 'PUT',
          body: JSON.stringify({
            phone: next.phonePrivacy,
            email: next.emailPrivacy,
            bio: next.bioPrivacy,
            profilePhoto: next.profilePhoto,
            lastSeen: next.lastSeen,
          })
        }).catch(console.error)
      }
      return next
    })
    closeSettingDropdown()
  }

  useEffect(() => {
    const handleClick = () => { closeContextMenu(); closeAiContextMenu(); closeAttachMenu(); closeProfileMenu(); closeChatContextMenu(); closeFolderDropdown(); closeFolderContextMenu(); closeNewChatCtxMenu(); closeSettingDropdown(); closeChatMenu(); closeMemberMenu(); setClearChatSubmenu(false); setFolderEditOpen(false); setPollModalOpen(false) }
    const handleScroll = () => { closeContextMenu(); closeAiContextMenu(); closeAttachMenu(); closeProfileMenu(); closeChatContextMenu(); closeFolderDropdown(); closeFolderContextMenu(); closeNewChatCtxMenu(); closeSettingDropdown(); closeChatMenu(); closeMemberMenu(); setClearChatSubmenu(false); setFolderEditOpen(false); setPollModalOpen(false) }
    if (contextMenu || aiContextMenu || attachMenu || profileMenu || chatContextMenu || folderDropdown || folderContextMenu || newChatCtxMenu || folderEditOpen || settingDropdown || chatMenu || memberMenu || clearChatSubmenu || pollModalOpen) {
      document.addEventListener('click', handleClick)
      document.addEventListener('scroll', handleScroll, true)
    }
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [contextMenu, aiContextMenu, attachMenu, profileMenu, chatContextMenu, folderDropdown, folderContextMenu, newChatCtxMenu, folderEditOpen, settingDropdown, chatMenu, clearChatSubmenu, pollModalOpen])

  useEffect(() => {
    if (!fullscreenImage) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreenImage(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [fullscreenImage])

  useEffect(() => {
    if (!addMemberDialogOpen) return
    const t = setTimeout(() => groupInfoAddInputRef.current?.focus(), 100)
    return () => clearTimeout(t)
  }, [addMemberDialogOpen])

  useEffect(() => {
    if (!avatarOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAvatarAnim() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [avatarOpen, closeAvatarAnim])

  useEffect(() => {
    if (activeTab !== 'group' && !createGroupOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setActiveTab('chat'); closeCreateGroup() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activeTab, createGroupOpen, closeCreateGroup])

  if (!isLoggedIn) {
    return (<>
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <div className="auth-logo">
              <svg width="36" height="21" viewBox="0 0 24 14" fill="none">
                <mask id="auth_mask" style={{ maskType: 'alpha' as any }} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="14">
                  <path d="M0.188963 1.7392L6.82464 11.9946C7.16161 12.5153 7.85613 12.664 8.37683 12.327L14.5238 8.34973C14.7617 8.19573 15.0697 8.2003 15.303 8.36116L22.2314 13.1397C23.2423 13.8365 24.4781 12.6373 23.811 11.6066L17.1746 1.35116C16.8376 0.830456 16.1431 0.681795 15.6232 1.01876L9.47465 4.99682C9.23679 5.15082 8.92879 5.14624 8.6955 4.98538L1.7686 0.2076C0.757692 -0.489971 -0.478113 0.710003 0.188963 1.74073V1.7392Z" fill="url(#auth_grad)"/>
                </mask>
                <g mask="url(#auth_mask)">
                  <g filter="url(#auth_f0)"><circle cx="23.25" cy="9.75" r="9.75" fill="#3287FE"/></g>
                  <g filter="url(#auth_f1)"><circle cx="10.5" cy="14.25" r="9.75" fill="#13B962"/></g>
                  <g filter="url(#auth_f2)"><circle cx="-1.5" cy="2.25" r="9.75" fill="#F6BE11"/></g>
                  <g filter="url(#auth_f3)"><circle cx="12.75" cy="-1.5" r="9.75" fill="#FA4442"/></g>
                </g>
                <defs>
                  <filter id="auth_f0" x="6.15" y="-7.35" width="34.2" height="34.2" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                    <feGaussianBlur stdDeviation="3.675" result="effect1_foregroundBlur_1173_79"/>
                  </filter>
                  <filter id="auth_f1" x="-6.6" y="-2.85" width="34.2" height="34.2" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                    <feGaussianBlur stdDeviation="3.675" result="effect1_foregroundBlur_1173_79"/>
                  </filter>
                  <filter id="auth_f2" x="-18.6" y="-14.85" width="34.2" height="34.2" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                    <feGaussianBlur stdDeviation="3.675" result="effect1_foregroundBlur_1173_79"/>
                  </filter>
                  <filter id="auth_f3" x="-4.35" y="-18.6" width="34.2" height="34.2" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                    <feGaussianBlur stdDeviation="3.675" result="effect1_foregroundBlur_1173_79"/>
                  </filter>
                  <linearGradient id="auth_grad" x1="12" y1="0" x2="12" y2="13.347" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#E20736"/><stop offset="1" stopColor="#BEE000"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="auth-title">Surf</h1>
            <p className="auth-subtitle">{authMode === 'login' ? t('welcomeBack', settings.language) : t('createAccount', settings.language)}</p>
          </div>
          <form className="auth-form" onSubmit={(e) => {
            e.preventDefault()
            const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register'
            api(endpoint, { method: 'POST', body: JSON.stringify(authForm) }).then(async data => {
              localStorage.setItem('token', data.token)
              setToken(data.token)
              setUser(data.user)
              setIsLoggedIn(true)
              setEditProfile({ username: data.user.username || '', phone: data.user.phone || '', bio: data.user.bio || '' })
              if (!e2e.hasKeys(data.user.id)) {
                e2e.clearCache()
                await e2e.generateKeyPair()
                localStorage.setItem('e2e_user_id', String(data.user.id))
                const pub = e2e.getPublicKey()
                if (pub) await api('/keys', { method: 'POST', body: JSON.stringify({ publicKey: pub }) })
              }
            }).catch(err => alert(err.message))
          }}>
            {authMode === 'register' && (
              <>
                <div className="auth-field">
                  <label className="auth-label">{t('name', settings.language)}</label>
                  <input className="auth-input" placeholder={t('name', settings.language)} value={authForm.name} onChange={(e) => setAuthForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="auth-field">
                  <label className="auth-label">{t('surname', settings.language)}</label>
                  <input className="auth-input" placeholder={t('surname', settings.language)} value={authForm.surname} onChange={(e) => setAuthForm(f => ({ ...f, surname: e.target.value }))} required />
                </div>
              </>
            )}
            <div className="auth-field">
              <label className="auth-label">{t('email', settings.language)}</label>
              <input className="auth-input" type="email" placeholder={t('emailPlaceholder', settings.language)} value={authForm.email} onChange={(e) => setAuthForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="auth-field">
              <label className="auth-label">{t('password', settings.language)}</label>
              <input className="auth-input" type="password" placeholder="••••••••" value={authForm.password} onChange={(e) => setAuthForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            <button className="auth-submit" type="submit">{authMode === 'login' ? t('logIn', settings.language) : t('createAccount', settings.language)}</button>
          </form>
          <p className="auth-terms">
            {t('byTappingAgree', settings.language).replace('{action}', authMode === 'login' ? t('logIn', settings.language) : t('createAccount', settings.language))}{' '}
            <button type="button" className="auth-terms-link" onClick={() => setPageStack(prev => [...prev, 'offer'])}>{t('terms', settings.language)}</button>{' '}
            {t('and', settings.language)}{' '}
            <button type="button" className="auth-terms-link" onClick={() => setPageStack(prev => [...prev, 'contacts'])}>{t('privacyPolicy', settings.language)}</button>.
          </p>
          <p className="auth-switch">
            {authMode === 'login' ? (
              <>{t('dontHaveAccount', settings.language)} <button className="auth-link" onClick={() => { setAuthMode('register'); setAuthForm({ name: '', surname: '', email: '', password: '' }) }}>{t('register', settings.language)}</button></>
            ) : (
              <>{t('alreadyHaveAccount', settings.language)} <button className="auth-link" onClick={() => { setAuthMode('login'); setAuthForm({ name: '', surname: '', email: '', password: '' }) }}>{t('logIn', settings.language)}</button></>
            )}
          </p>
        </div>
      </div>
      {pageStack.includes('offer') && (
        <Offer language={settings.language} onClose={() => { setPageStack(prev => prev.filter(p => p !== 'offer')); window.history.replaceState(null, '', window.location.origin) }} />
      )}
      {pageStack.includes('contacts') && (
        <Contacts language={settings.language} onClose={() => { setPageStack(prev => prev.filter(p => p !== 'contacts')); window.history.replaceState(null, '', window.location.origin) }} />
      )}
    </>)
  }

  return (
    <><div className="app-container">
      <aside className={`sidebar ${isSidebarExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="sidebar-top-section">
          <div className="sidebar-logo" onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}>
            <svg width="24" height="14" viewBox="0 0 24 14" fill="none">
              <mask id="mask0_1173_79" style={{ maskType: 'alpha' as any }} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="14">
                <path d="M0.188963 1.7392L6.82464 11.9946C7.16161 12.5153 7.85613 12.664 8.37683 12.327L14.5238 8.34973C14.7617 8.19573 15.0697 8.2003 15.303 8.36116L22.2314 13.1397C23.2423 13.8365 24.4781 12.6373 23.811 11.6066L17.1746 1.35116C16.8376 0.830456 16.1431 0.681795 15.6232 1.01876L9.47465 4.99682C9.23679 5.15082 8.92879 5.14624 8.6955 4.98538L1.7686 0.2076C0.757692 -0.489971 -0.478113 0.710003 0.188963 1.74073V1.7392Z" fill="url(#paint0_linear_1173_79)"/>
              </mask>
              <g mask="url(#mask0_1173_79)">
                <g filter="url(#filter0_f_1173_79)"><circle cx="23.25" cy="9.74999" r="9.74999" fill="#3287FE"/></g>
                <g filter="url(#filter1_f_1173_79)"><circle cx="10.5" cy="14.25" r="9.74999" fill="#13B962"/></g>
                <g filter="url(#filter2_f_1173_79)"><circle cx="-1.50001" cy="2.24999" r="9.74999" fill="#F6BE11"/></g>
                <g filter="url(#filter3_f_1173_79)"><circle cx="12.75" cy="-1.50001" r="9.74999" fill="#FA4442"/></g>
              </g>
              <defs>
                <filter id="filter0_f_1173_79" x="6.15" y="-7.35" width="34.2" height="34.2" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                  <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                  <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                  <feGaussianBlur stdDeviation="3.675" result="effect1_foregroundBlur_1173_79"/>
                </filter>
                <filter id="filter1_f_1173_79" x="-6.6" y="-2.85" width="34.2" height="34.2" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                  <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                  <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                  <feGaussianBlur stdDeviation="3.675" result="effect1_foregroundBlur_1173_79"/>
                </filter>
                <filter id="filter2_f_1173_79" x="-18.6" y="-14.85" width="34.2" height="34.2" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                  <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                  <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                  <feGaussianBlur stdDeviation="3.675" result="effect1_foregroundBlur_1173_79"/>
                </filter>
                <filter id="filter3_f_1173_79" x="-4.35" y="-18.6" width="34.2" height="34.2" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                  <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                  <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                  <feGaussianBlur stdDeviation="3.675" result="effect1_foregroundBlur_1173_79"/>
                </filter>
                <linearGradient id="paint0_linear_1173_79" x1="12" y1="0" x2="12" y2="13.347" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#E20736"/><stop offset="1" stopColor="#BEE000"/>
                </linearGradient>
              </defs>
            </svg>
            <span className="sidebar-logo-text">Surf</span>
          </div>
          <nav className="sidebar-navigation">
            <button className={`sidebar-nav-btn ${activeTab === 'home' && activeChatId === null ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setActiveTab('home'); setActiveChatId(null) }}
              onContextMenu={(e) => { e.preventDefault(); setNewChatCtxMenu({ x: e.clientX, y: e.clientY }) }} title={t('newChat', settings.language)}>
              <Plus size={18} />
              <span className="sidebar-text">{t('newChat', settings.language)}</span>
            </button>
            <button className={`sidebar-nav-btn ${activeTab === 'search' && activeChatId === null ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setActiveTab('search'); setActiveChatId(null) }} title={t('search', settings.language)}>
              <Search size={18} />
              <span className="sidebar-text">{t('search', settings.language)}</span>
            </button>
          </nav>

          <div className="sidebar-chat-list">
            {(activeFolderId
              ? chats.filter(c => folders.find(f => f.id === activeFolderId)?.chats.includes(c.id))
              : chats
            ).filter(c => c.name !== 'Opus').map(chat => {
              const draftPreview = getChatDraftPreview(chatInputTexts[chat.id])
              return (
              <div key={chat.id}
                className={`sidebar-chat-item ${activeTab === 'chat' && activeChatId === chat.id ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setActiveChatId(chat.id); setActiveTab('chat') }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setChatContextMenu({ x: e.clientX, y: e.clientY, chatId: chat.id })
                }}
                title={chat.name}
              >
                <div className={`chat-item-avatar${chat.isGroup ? ' group-avatar' : ''}`} style={chat.isGroup ? (chat.avatar ? { backgroundImage: `url(${chat.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent' } : {}) : (chat.participantAvatar ? { backgroundImage: `url(${chat.participantAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent' } : {})}>
                  {chat.isGroup ? (!chat.avatar && <Users size={18} strokeWidth={1.5} />) : (!chat.participantAvatar && <User size={18} strokeWidth={1.5} />)}
                  {!chat.isGroup && <span className={`online-dot${chat.participantOnline ? ' online' : ''}`} />}
                </div>
                <div className="chat-item-info">
                  <span className="chat-item-name">{chat.name}</span>
                  {settings.previews === 'On' && (
                    <span className={`chat-item-message${draftPreview ? ' is-draft' : ''}`}>{draftPreview || (chat.isGroup ? (chat.lastMessage || `${chat.participantCount || 0} members`) : chat.lastMessage)}</span>
                  )}
                </div>
                {chat.pinned && <div className="chat-item-pin" />}
              </div>
              )
            })}
          </div>
        </div>

        {folders.length > 0 && (
          <div className="sidebar-folder-list">
            <button className={`sidebar-folder-btn ${activeFolderId === null ? 'active' : ''}`} onClick={() => setActiveFolderId(null)}>{t('all', settings.language)}</button>
            {folders.map(folder => (
              <button key={folder.id} className={`sidebar-folder-btn ${activeFolderId === folder.id ? 'active' : ''}`}
                onClick={() => setActiveFolderId(folder.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setFolderContextMenu({ x: e.clientX, y: e.clientY, folderId: folder.id })
                }}
              >
                <span className="sidebar-folder-name">{folder.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="sidebar-profile-footer">
          <div className="profile-footer-content" onClick={(e) => {
            e.stopPropagation()
            if (profileMenu) { closeProfileMenu(); return }
            const el = avatarRef.current
            if (!el) return
            const r = el.getBoundingClientRect()
            setProfileMenu({ x: r.left - 10, y: Math.max(8, r.top - 130) })
          }}>
            <div className="sidebar-avatar" title={t('profile', settings.language)} ref={avatarRef} style={user?.avatar ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent' } : {}}>
              {!user?.avatar && <User size={18} strokeWidth={1.5} />}
            </div>
            <span className="profile-username">{user?.name || t('profile', settings.language)}</span>
          </div>
          {profileMenu && (
            <div className="context-menu" style={{ position: 'fixed', left: profileMenu.x, top: profileMenu.y, zIndex: 300 }} onClick={(e) => e.stopPropagation()}>
              <button className="context-menu-item" onClick={() => { setActiveTab('profile'); setActiveChatId(null); closeProfileMenu() }}>
                <User size={14} /><span>{t('profile', settings.language)}</span>
              </button>
              <button className="context-menu-item" onClick={() => { setActiveTab('settings'); closeProfileMenu() }}>
                <Settings size={14} /><span>{t('settings', settings.language)}</span>
              </button>
              <button className="context-menu-item" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('e2e_user_id'); e2e.clearCache(); setToken(null); setUser(null); setIsLoggedIn(false); closeProfileMenu() }}>
                <LogOut size={14} /><span>{t('logOut', settings.language)}</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="main-area">
        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => {
          const files = Array.from(e.target.files || [])
          if (!files.length) return
          files.forEach(f => {
            const formData = new FormData()
            formData.append('file', f)
            api('/upload/file', { method: 'POST', body: formData }).then((res: any) => {
              setPendingAttachments(prev => [...prev, { url: res.url, type: res.type, name: f.name }])
            }).catch(() => {})
          })
          e.target.value = ''
        }} />

        {attachMenu && (
          <div className="context-menu" style={{ left: attachMenu.x, top: attachMenu.y }} onClick={(e) => e.stopPropagation()}>
            <button className="context-menu-item" onClick={() => { fileInputRef.current?.click(); closeAttachMenu() }}>
              <Image size={14} /><span>{t('photoOrVideo', settings.language)}</span>
            </button>
            <button className="context-menu-item" onClick={() => { fileInputRef.current?.click(); closeAttachMenu() }}>
              <File size={14} /><span>{t('document', settings.language)}</span>
            </button>
            <button className="context-menu-item" onClick={() => { closeAttachMenu(); setPollModalOpen(true) }}>
              <BarChart3 size={14} /><span>{t('poll', settings.language)}</span>
            </button>
          </div>
        )}

        {activeTab === 'home' ? (
          <div className={`chat-thread-container ai-chat ${aiConversation.length > 0 ? 'has-messages' : ''} ${firstHomeEntry ? 'home-entry' : ''}`}>
            {opusMessagesLoading ? (
              <div className="chat-thread-messages ai-messages-loading">
                <Loader2 size={32} className="btn-spinner" />
              </div>
            ) : aiConversation.length === 0 ? (
              <div className="chat-thread-messages">
                <div className="ai-welcome">
                  <h1 className="landing-header">{t('letsTextSomeone', settings.language)}</h1>
                  <div className={`chat-input-wrapper${replyTo ? ' has-reply' : ''}`}>
                    <input type="text" className="chat-input" placeholder={t('askOpus', settings.language)} value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAiSend() }} />
                    <button className={`send-btn${inputText.trim() ? ' active' : ''}`} title={t('send', settings.language)} onClick={handleAiSend}><ArrowUp size={18} /></button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="chat-thread-messages" ref={aiMessagesRef}>
                  {aiConversation.map((msg, i) => (
                    <div key={i} className={`message-row ${msg.role === 'user' ? 'sender-me' : 'sender-them'}${i >= initialMsgCount.current ? ' new-msg' : ''}`}
                      onContextMenu={(e) => { e.preventDefault(); setAiContextMenu(prev => prev?.index === i ? null : { x: e.clientX, y: e.clientY, index: i }) }}>
                      <div className="message-bubble">
                        <div className="message-text">{renderMessageText(msg.text)}</div>
                        {msg.time && <div className="message-time">{msg.time}</div>}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="message-row sender-them">
                      <div className="message-bubble ai-typing-bubble">
                        <span className="ai-thinking">{t('thinking', settings.language)}</span>
                      </div>
                    </div>
                  )}
                </div>
                {aiContextMenu && (
                  <div className="context-menu" style={{ left: aiContextMenu.x, top: aiContextMenu.y }} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => { e.preventDefault(); closeAiContextMenu() }}>
                    <button className="context-menu-item" onClick={copyAiMessage}><Copy size={14} /><span>{t('copy', settings.language)}</span></button>
                  </div>
                )}
                <div className="chat-thread-input-container">
              <div className={`chat-input-wrapper${replyTo ? ' has-reply' : ''}${pendingAttachments.length > 0 ? ' has-attachment' : ''}`}>
                    <input type="text" className="chat-input" placeholder={t('askOpus', settings.language)} value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAiSend() }} />
                    <button className={`send-btn${inputText.trim() ? ' active' : ''}`} title={t('send', settings.language)} onClick={handleAiSend}><ArrowUp size={18} /></button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : activeTab === 'search' ? (
          <div className="search-content">
            <div className="search-bar-container">
              <div className="search-bar-wrapper">
                <Search size={18} className="search-bar-icon" />
                <input ref={searchInputRef} type="text" className="search-bar-input" placeholder={t('searchUsers', settings.language)} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
            <div className="recent-section">
              <div className="recent-title">{t('recent', settings.language)}</div>
              <div className="recent-grid">
                {searchResults.length > 0 ? (
                  searchResults.map(u => (
                    <div key={u.id} className="recent-item" onClick={() => {
                      api('/chats/find-or-create', { method: 'POST', body: JSON.stringify({ username: u.username }) }).then(newChat => {
                        setChats(prev => {
                          if (prev.find(c => c.id === newChat.id)) return prev
                          return [newChat, ...prev]
                        })
                        setActiveChatId(newChat.id)
                        setActiveTab('chat')
                      }).catch(err => alert(err.message))
                    }}>
                      <div className="item-avatar" style={u.avatar ? { backgroundImage: `url(${u.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent' } : {}}>
                        {!u.avatar && <User size={18} strokeWidth={1.5} />}
                      </div>
                      <div className="item-content">
                        <div className="item-name">{u.name} {u.surname}</div>
                        <div className="item-subtext">{u.email}</div>
                      </div>
                    </div>
                  ))
                ) : searchQuery.trim() ? (
                  <div className="recent-empty">{t('noUsersFound', settings.language)}</div>
                ) : null}
              </div>
            </div>
          </div>
        ) : activeTab === 'chat' && activeChat ? (
          <div className="chat-thread-container">
            <div className="chat-thread-header">
              <div className="chat-header-left" onClick={() => activeChat.isGroup ? setActiveTab('group') : setActiveTab('profile')} style={{ cursor: 'pointer' }}>
                <div className={`chat-header-avatar${activeChat.isGroup ? ' group-avatar' : ''}`} style={activeChat.isGroup ? (activeChat.avatar ? { backgroundImage: `url(${activeChat.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent' } : {}) : ((viewedUser || contactProfile)?.avatar || activeChat?.participantAvatar ? { backgroundImage: `url(${(viewedUser || contactProfile)?.avatar || activeChat?.participantAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent' } : {})}>
                  {activeChat.isGroup ? (!activeChat.avatar && <Users size={20} strokeWidth={1.5} />) : (!(viewedUser || contactProfile)?.avatar && !activeChat?.participantAvatar && <User size={20} strokeWidth={1.5} />)}
                  {!activeChat.isGroup && <span className={`online-dot${contactProfile?.online ? ' online' : ''}`} />}
                </div>
                <div className="chat-header-info">
                  <div className="chat-header-name">
                    {activeChat.name}
                  </div>
                  {activeChat.isGroup ? (
                    <div className="chat-header-status">{activeChat.participantCount || 0} members</div>
                  ) : (() => {
                    const lastSeen = (contactProfile || activeChat)?.lastSeen
                    const online = contactProfile?.online ?? activeChat?.participantOnline
                    const text = formatLastSeen(lastSeen, online, settings.language)
                    return text ? <div className={`chat-header-status${online ? ' online' : ''}`}>{text}</div> : null
                  })()}
                </div>
              </div>
              <div className="chat-header-actions">
                <button className="chat-header-action-btn" title={t('more', settings.language)} onClick={(e) => {
                  e.stopPropagation()
                  if (chatMenu) { closeChatMenu(); setClearChatSubmenu(false); return }
                  const rect = e.currentTarget.getBoundingClientRect()
                  setChatMenu({ x: rect.right, y: rect.bottom + 8 })
                }}><MoreVertical size={18} /></button>
              </div>
            </div>

            {chatMenu && (
              <div className="context-menu" style={{ right: window.innerWidth - chatMenu.x, top: chatMenu.y }} onClick={(e) => e.stopPropagation()}>
                {!clearChatSubmenu ? (
                  <button className="context-menu-item" onClick={() => setClearChatSubmenu(true)}><Trash2 size={14} /><span>{t('clearChat', settings.language)}</span></button>
                ) : (
                  <>
                    <button className="context-menu-item" onClick={() => { if (activeChatId) clearChat(activeChatId, false); setClearChatSubmenu(false) }}><User size={14} /><span>{t('clearForMe', settings.language)}</span></button>
                    <button className="context-menu-item" onClick={() => { if (activeChatId) clearChat(activeChatId, true); setClearChatSubmenu(false) }}><Users size={14} /><span>{t('clearForEveryone', settings.language)}</span></button>
                  </>
                )}
              </div>
            )}

            <div className="chat-thread-messages" onContextMenu={(e) => e.preventDefault()}>
              {messages.map((msg, index) => {
                const showDateDivider = getMessageDayKey(msg.createdAt) !== getMessageDayKey(messages[index - 1]?.createdAt)
                return (
                <div key={msg.id}>
                  {showDateDivider && <div className="message-date-divider">{formatMessageDay(msg.createdAt)}</div>}
                  <div id={`msg-${msg.id}`} className={`message-row ${msg.sender === 'me' ? 'sender-me' : 'sender-them'}`}
                    onContextMenu={(e) => handleContextMenu(e, msg.id)}>
                    <div className="message-bubble">
                      {activeChat?.isGroup && msg.sender !== 'me' && msg.senderName && (
                        <div className="message-sender-name">{msg.senderName}</div>
                      )}
                      {msg.replyToId && (msg.replyText || msg.replyAttachmentUrl) && (
                        <div className="message-reply" onClick={() => { const el = document.getElementById(`msg-${msg.replyToId}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                          <div className="message-reply-line" />
                          <div className="message-reply-text">{msg.replyAttachmentUrl && !msg.replyText ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{msg.replyAttachmentType === 'image' ? <><Image size={14} /> {t('photoOrVideo', settings.language)}</> : <><File size={14} /> {t('document', settings.language)}</>}</span> : msg.replyText}</div>
                        </div>
                      )}
                      {msg.attachmentUrl && (
                        <div className="message-attachment">
                          {msg.attachmentType === 'image' ? (
                            <img src={`http://localhost:3001${msg.attachmentUrl}`} alt="" className="message-attachment-image" onClick={() => setFullscreenImage(`http://localhost:3001${msg.attachmentUrl}`)} />
                          ) : (
                            <a href={`http://localhost:3001${msg.attachmentUrl}`} target="_blank" rel="noopener noreferrer" className="message-attachment-file">
                              <File size={18} /><span>{t('document', settings.language)}</span>
                            </a>
                          )}
                        </div>
                      )}
                      {msg.pollId && (
                        <div className="message-poll" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            loadPoll(msg.pollId!)
                            const poll = pollsCache[msg.pollId!]
                            if (!poll) return <div className="message-poll-loading">{t('pollLoading', settings.language)}</div>
                            return (
                              <>
                                <div className="message-poll-question"><BarChart3 size={16} style={{ marginRight: 8, opacity: 0.7 }} />{poll.question}</div>
                                <div className="message-poll-options">
                                  {poll.options.map(opt => {
                                    const percent = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0
                                    const isVoted = poll.userVote === opt.id
                                    return (
                                      <button key={opt.id} className={`message-poll-option${isVoted ? ' voted' : ''}`} onClick={() => handleVote(poll.id, opt.id)}>
                                        <div className="message-poll-option-bar" style={{ width: `${percent}%` }} />
                                        <span className="message-poll-option-text">{opt.text}</span>
                                        {poll.userVote !== null && <span className="message-poll-option-percent">{percent}%</span>}
                                      </button>
                                    )
                                  })}
                                </div>
                                <div className="message-poll-footer">{poll.totalVotes} {t(poll.totalVotes !== 1 ? 'votes' : 'vote', settings.language)}</div>
                              </>
                            )
                          })()}
                        </div>
                      )}
                      {msg.text && <div className="message-text">{renderMessageText(msg.text)}</div>}
                      <div className="message-meta">
                        <span className="message-time">{msg.time}</span>
                        {msg.sender === 'me' && <MessageStatusIcon status={msg.status} />}
                      </div>
                    </div>
                  </div>
                </div>
                )
              })}
              {isPeerTyping && (
                <div className="message-row sender-them">
                  <div className="message-bubble ai-typing-bubble typing-indicator-bubble">
                    <span className="ai-thinking">typing...</span>
                  </div>
                </div>
              )}
            </div>

            {contextMenu && (
              <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
                {!deleteMessageSubmenu ? (
                  <>
                    <button className="context-menu-item" onClick={replyMessage}><Reply size={14} /><span>{t('reply', settings.language)}</span></button>
                    <button className="context-menu-item" onClick={copyMessage}><Copy size={14} /><span>{t('copy', settings.language)}</span></button>
                    <button className="context-menu-item context-menu-item-danger" onClick={() => setDeleteMessageSubmenu(true)}><Trash2 size={14} /><span>{t('delete', settings.language)}</span></button>
                  </>
                ) : (
                  <>
                    <button className="context-menu-item" onClick={() => deleteMessage(false)}><User size={14} /><span>{t('clearForMe', settings.language)}</span></button>
                    <button className="context-menu-item context-menu-item-danger" onClick={() => deleteMessage(true)}><Users size={14} /><span>{t('clearForEveryone', settings.language)}</span></button>
                  </>
                )}
              </div>
            )}

            <div className="chat-thread-input-container">
              {replyTo && (
                <div className="reply-bar">
                  <div className="reply-line" />
                  <div className="reply-info">
                    <div className="reply-label">{t('reply', settings.language)}</div>
                    <div className="reply-text">{replyTo.attachmentUrl && !replyTo.text ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{replyTo.attachmentType === 'image' ? <><Image size={14} /> {t('photoOrVideo', settings.language)}</> : <><File size={14} /> {t('document', settings.language)}</>}</span> : replyTo.text}</div>
                  </div>
                  <button className="reply-close" onClick={() => setReplyTo(null)}>
                    <X size={16} />
                  </button>
                </div>
              )}
              {mentionMenu?.chatId === activeChat.id && (
                <div className="mention-menu">
                  {contacts
                    .filter(c => {
                      const q = mentionMenu.query
                      return c.username?.toLowerCase().includes(q) ||
                        c.name.toLowerCase().includes(q) ||
                        c.surname?.toLowerCase().includes(q)
                    })
                    .slice(0, 5)
                    .map(c => (
                      <button
                        key={c.id}
                        className="mention-item"
                        onClick={() => insertMention(activeChat.id, c.username || `${c.name}${c.surname ? ' ' + c.surname : ''}`)}
                      >
                        <div className="mention-avatar"><User size={16} strokeWidth={1.5} /></div>
                        <div className="mention-info">
                          <div className="mention-name">{c.name} {c.surname}</div>
                          {c.username && <div className="mention-username">@{c.username}</div>}
                        </div>
                      </button>
                    ))}
                </div>
              )}
              {pendingAttachments.length > 0 && (
                <div className={`pending-attachment${replyTo ? ' pending-attachment-noround' : ''}`}>
                  {pendingAttachments.map((att, idx) => (
                    <div key={idx} className="pending-attachment-item">
                      {att.type === 'image' ? (
                        <img src={`http://localhost:3001${att.url}`} alt="" className="pending-attachment-thumb" />
                      ) : (
                        <div className="pending-attachment-file-icon"><File size={16} /></div>
                      )}
                      <div className="pending-attachment-info">
                        <span className="pending-attachment-name">{att.name}</span>
                        <span className="pending-attachment-hint">{att.type === 'image' ? t('photoOrVideo', settings.language) : t('document', settings.language)}</span>
                      </div>
                      <button className="pending-attachment-remove" onClick={() => setPendingAttachments(prev => prev.filter((_, i) => i !== idx))}><X size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="chat-input-wrapper">
                <button className="input-icon-btn" title={t('addFile', settings.language)} onClick={(e) => {
                  e.stopPropagation()
                  if (attachMenu) { closeAttachMenu(); return }
                  const rect = e.currentTarget.getBoundingClientRect()
                  setAttachMenu({ x: rect.left, y: rect.top - 90, dir: 'up' })
                }}>
                  <Plus size={18} />
                </button>
                <input
                  ref={el => void (chatInputRefs.current[activeChat.id] = el)}
                  type="text" className="chat-input" placeholder={t('writeMessage', settings.language)}
                  value={chatInputTexts[activeChat.id] || ''}
                  onChange={(e) => handleChatInputChange(activeChat.id, e.target.value)}
                  onPaste={handleChatPaste}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(activeChat.id) }} />
                <button className={`send-btn${(chatInputTexts[activeChat.id] || '').trim() || pendingAttachments.length > 0 ? ' active' : ''}`} title={t('send', settings.language)}
                  onClick={() => handleSendMessage(activeChat.id)}>
                  <ArrowUp size={18} />
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'group' && activeChat ? (
          <div className="profile-container">
            <div className="profile-top">
              <label className="profile-avatar-large group-avatar" style={activeChat.avatar ? { backgroundImage: `url(${activeChat.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent', cursor: activeChat.role === 'admin' ? 'pointer' : 'default' } : { cursor: activeChat.role === 'admin' ? 'pointer' : 'default' }}>
                {!activeChat.avatar && <Users size={36} strokeWidth={1.5} />}
                {activeChat.role === 'admin' && <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleGroupAvatarChange(e, activeChat.id)} />}
                {groupAvatarUploading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: '50%' }}><Loader2 size={18} className="btn-spinner" /></div>}
              </label>
              <div className="profile-info-header">
                <div className="profile-name">{activeChat.name}</div>
              </div>
              {activeChat.role === 'admin' && (
                <button className="profile-add-btn" onClick={() => { setGroupInfoAddQuery(''); setGroupInfoAddResults([]); setAddMemberDialogOpen(true) }}>
                  <Plus size={16} />
                  <span>{t('add', settings.language)}</span>
                </button>
              )}
            </div>
            <div className="profile-content">
              <div className="profile-section">
                <h3 className="profile-section-title">{t('members', settings.language)}</h3>
                <div className="profile-card">
                  {groupParticipants.map(p => (
                    <div key={p.id} className="profile-info-row" style={{ justifyContent: 'flex-start', gap: 10, cursor: p.id === user?.id ? 'default' : 'pointer' }} onClick={() => p.username && p.id !== user?.id && openChatWithUser(p.username)}>
                      <div className="item-avatar" style={p.avatar ? { backgroundImage: `url(${p.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent' } : {}}>
                        {!p.avatar && <User size={16} strokeWidth={1.5} />}
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                        <span style={{ color: '#fff', fontWeight: 500 }}>{p.name} {p.surname}</span>
                        {p.username && <span style={{ color: '#8c8c88', fontSize: 12 }}>@{p.username}</span>}
                      </div>
                      {p.role === 'admin' && <span style={{ fontSize: 11, color: '#3287FE', textTransform: 'capitalize' }}>{t('admin', settings.language)}</span>}
                      {activeChat.role === 'admin' && p.id !== user?.id && (
                        <>
                          <button className="dialog-close" title={t('more', settings.language)} onClick={(e) => {
                            e.stopPropagation()
                            if (memberMenu?.participantId === p.id) { closeMemberMenu(); return }
                            const rect = e.currentTarget.getBoundingClientRect()
                            setMemberMenu({ participantId: p.id, x: rect.right, y: rect.bottom + 8 })
                          }}><MoreVertical size={14} /></button>
                          {memberMenu?.participantId === p.id && (
                            <div className="context-menu" style={{ right: window.innerWidth - memberMenu.x, top: memberMenu.y }} onClick={(e) => e.stopPropagation()}>
                              <button className="context-menu-item context-menu-item-danger" onClick={() => { handleRemoveGroupMember(p.id); closeMemberMenu() }}><Trash2 size={14} /><span>{t('removeMember', settings.language)}</span></button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>


            </div>
          </div>
        ) : activeTab === 'profile' && activeChatId === null ? (
          <div className="profile-container">
            <div className="profile-top">
              <div
                ref={profileAvatarRef}
                className="profile-avatar-large"
                style={user?.avatar ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent', cursor: 'pointer' } : { backgroundColor: 'var(--accent-color)' }}
                onClick={openAvatarAnim}
              >
                {!user?.avatar && <User size={36} strokeWidth={1.5} />}
                {user?.avatar && <span className="online-dot online-dot-lg online" />}
              </div>
              <div className="profile-info-header">
                <div className="profile-name">{user?.name || ''}{user?.surname ? ` ${user.surname}` : ''}</div>
                {user?.bio && <div className="profile-bio">{user.bio}</div>}
              </div>
            </div>
            <div className="profile-content">
              <div className="profile-section">
                <div className="profile-card">
                  <div className="profile-info-row" onClick={() => { setActiveTab('edit-profile'); setEditProfile({ username: user?.username || '', phone: user?.phone || '', bio: user?.bio || '' }) }}
                    style={{ cursor: 'pointer' }}>
                    <span className="profile-info-label" style={{ color: '#3287FE' }}>{t('editProfile', settings.language)}</span>
                    <Pencil size={14} style={{ color: '#3287FE' }} />
                  </div>
                </div>
              </div>
              <div className="profile-section">
                {proStatus?.active ? (
                  <button className="desktop-pro-card desktop-pro-card-active" onClick={() => setProOpen(true)}>
                    <div className="desktop-pro-card-content">
                      <span className="desktop-pro-card-title">
                        <CheckCircle size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                        {t('proActive', settings.language)}
                      </span>
                      {proStatus.end_date && (
                        <span className="desktop-pro-card-subtitle">
                          {t('proExpires', settings.language)}: {new Date(proStatus.end_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <ChevronRight size={18} className="desktop-pro-card-chevron" />
                  </button>
                ) : (
                  <button className="desktop-pro-card" onClick={() => setProOpen(true)}>
                    <div className="desktop-pro-card-content">
                      <span className="desktop-pro-card-title">{t('upgradeToPro', settings.language)}</span>
                      <span className="desktop-pro-card-subtitle">{t('unlockPremiumFeatures', settings.language)}</span>
                    </div>
                    <ChevronRight size={18} className="desktop-pro-card-chevron" />
                  </button>
                )}
              </div>
            </div>

          </div>
        ) : activeTab === 'edit-profile' ? (
          <div className="edit-profile-container">
            <div className="edit-profile-header">
              <h2 className="edit-profile-title">{t('editProfile', settings.language)}</h2>
              <button className={`edit-profile-save${!hasEditChanges ? ' disabled' : ''}`} disabled={!hasEditChanges} onClick={() => {
                api('/users/me', { method: 'PUT', body: JSON.stringify(editProfile) }).then(() => {
                  setUser(prev => prev ? { ...prev, ...editProfile } : prev)
                  setActiveTab('profile')
                }).catch(err => alert(err.message))
              }}>{t('save', settings.language)}</button>
            </div>
            <div className="edit-profile-body">
              <input ref={avatarFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const formData = new FormData()
                formData.append('avatar', file)
                fetch('/api/upload/avatar', {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                  body: formData
                }).then(r => r.json()).then(data => {
                  setUser(prev => prev ? { ...prev, avatar: data.avatar } : prev)
                }).catch(err => alert(err.message))
                e.target.value = ''
              }} />
              <div className="edit-profile-avatar-section">
                <div className="edit-profile-avatar" style={user?.avatar ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent' } : { backgroundColor: 'var(--accent-color)' }}>
                  {!user?.avatar && <User size={36} strokeWidth={1.5} />}
                  <button className="edit-profile-avatar-btn" type="button" onClick={() => avatarFileRef.current?.click()}><Camera size={14} /></button>
                </div>
              </div>
              <div className="edit-profile-field">
                <label className="edit-profile-label">{t('username', settings.language)}</label>
                <input className="edit-profile-input" value={editProfile.username}
                  onChange={(e) => setEditProfile(p => ({ ...p, username: e.target.value }))} placeholder={t('usernamePlaceholder', settings.language)} />
              </div>
              <div className="edit-profile-field">
                <label className="edit-profile-label">{t('phone', settings.language)}</label>
                <input className="edit-profile-input" value={editProfile.phone}
                  onChange={(e) => setEditProfile(p => ({ ...p, phone: e.target.value }))} placeholder={t('phonePlaceholder', settings.language)} />
              </div>
              <div className="edit-profile-field">
                <label className="edit-profile-label">{t('bio', settings.language)}</label>
                <textarea className="edit-profile-textarea" rows={3} placeholder={t('bio', settings.language)}
                  value={editProfile.bio} onChange={(e) => setEditProfile(p => ({ ...p, bio: e.target.value }))} />
              </div>
            </div>
          </div>
        ) : activeTab === 'profile' && (activeChat || viewedUser) ? (
          <div className="profile-container">
            <div className="profile-top">
              <div className="profile-avatar-large" style={(viewedUser || contactProfile)?.avatar ? { backgroundImage: `url(${(viewedUser || contactProfile)?.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent', cursor: 'pointer' } : {}}
                onClick={() => (viewedUser || contactProfile)?.avatar && setFullscreenImage((viewedUser || contactProfile)?.avatar!)}>
                {!(viewedUser || contactProfile)?.avatar && <User size={36} strokeWidth={1.5} />}
                <span className={`online-dot online-dot-lg${(contactProfile || viewedUser)?.online ? ' online' : ''}`} />
              </div>
              <div className="profile-info-header">
                <div className="profile-name">{(viewedUser || contactProfile)?.name ? `${(viewedUser || contactProfile)!.name} ${(viewedUser || contactProfile)!.surname || ''}` : activeChat?.name || ''}</div>
              </div>
              {(viewedUser || contactProfile)?.bio && <div className="profile-bio">{(viewedUser || contactProfile)?.bio}</div>}
            </div>
            <div className="profile-content">
              <div className="profile-section">
                <div className="profile-card">
                  <div className="profile-info-row"><span className="profile-info-label">{t('email', settings.language)}</span><span className="profile-info-value click-to-copy" onClick={() => (viewedUser || contactProfile)?.email && copyField(t('email', settings.language), (viewedUser || contactProfile)!.email!)}>{(viewedUser || contactProfile)?.email || '—'}</span></div>
                  {(viewedUser || contactProfile)?.phone && <div className="profile-info-row"><span className="profile-info-label">{t('phone', settings.language)}</span><span className="profile-info-value click-to-copy" onClick={() => copyField(t('phone', settings.language), (viewedUser || contactProfile)!.phone!)}>{(viewedUser || contactProfile)?.phone}</span></div>}
                  {(viewedUser || contactProfile)?.username && <div className="profile-info-row"><span className="profile-info-label">{t('username', settings.language)}</span><span className="profile-info-value click-to-copy" onClick={() => copyField(t('username', settings.language), (viewedUser || contactProfile)!.username!)}>@{(viewedUser || contactProfile)?.username}</span></div>}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'settings' ? (
          <div className="settings-container">
            <div className="settings-sidebar">
              <button className={`settings-nav-btn ${settingsSection === 'general' ? 'active' : ''}`} onClick={() => setSettingsSection('general')}>
                <Settings size={16} /><span>{t('general', settings.language)}</span>
              </button>
              <button className={`settings-nav-btn ${settingsSection === 'account' ? 'active' : ''}`} onClick={() => setSettingsSection('account')}>
                <User size={16} /><span>{t('account', settings.language)}</span>
              </button>
              <button className={`settings-nav-btn ${settingsSection === 'privacy' ? 'active' : ''}`} onClick={() => setSettingsSection('privacy')}>
                <Shield size={16} /><span>{t('privacy', settings.language)}</span>
              </button>
            </div>
            <div className="settings-content">
              {settingsSection === 'general' && (
                <>
                  <div className="profile-section">
                    <h3 className="profile-section-title">{t('appearance', settings.language)}</h3>
                    <div className="profile-card">
                      <div className="profile-info-row" onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'language', x: r.right - 180, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">{t('language', settings.language)}</span><span className="profile-info-value">{langName(settings.language)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="profile-section">
                    <h3 className="profile-section-title">{t('notifications', settings.language)}</h3>
                    <div className="profile-card">
                      <div className="profile-info-row">
                        <span className="profile-info-label">{t('messagePreviews', settings.language)}</span>
                        <ToggleSwitch checked={settings.previews === 'On'} onChange={() => cycleSetting('previews', ['On', 'Off'])} />
                      </div>
                      <div className="profile-info-row">
                        <span className="profile-info-label">{t('sounds', settings.language)}</span>
                        <ToggleSwitch checked={settings.sounds === 'On'} onChange={() => cycleSetting('sounds', ['On', 'Off'])} />
                      </div>
                    </div>
                  </div>
                </>
              )}
              {settingsSection === 'account' && (
                <div className="profile-section">
                  <h3 className="profile-section-title">{t('profile', settings.language)}</h3>
                  <div className="profile-card">
                    <div className="profile-info-row"><span className="profile-info-label">{t('name', settings.language)}</span><span className="profile-info-value">{user?.name || ''}{user?.surname ? ` ${user.surname}` : ''}</span></div>
                    <div className="profile-info-row"><span className="profile-info-label">{t('email', settings.language)}</span><span className="profile-info-value">{user?.email || ''}</span></div>
                  </div>
                </div>
              )}
              {settingsSection === 'privacy' && (
                <>
                  <div className="profile-section">
                    <h3 className="profile-section-title">{t('privacy', settings.language)}</h3>
                    <div className="profile-card">
                      <div className="profile-info-row" onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'lastSeen', x: r.right - 180, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">{t('lastSeen', settings.language)}</span><span className="profile-info-value">{p(settings.lastSeen, settings.language)}</span>
                      </div>
                      <div className="profile-info-row" onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'profilePhoto', x: r.right - 180, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">{t('profilePhoto', settings.language)}</span><span className="profile-info-value">{p(settings.profilePhoto, settings.language)}</span>
                      </div>
                      <div className="profile-info-row" onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'phonePrivacy', x: r.right - 180, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">{t('phone', settings.language)}</span><span className="profile-info-value">{p(settings.phonePrivacy, settings.language)}</span>
                      </div>
                      <div className="profile-info-row" onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'emailPrivacy', x: r.right - 180, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">{t('email', settings.language)}</span><span className="profile-info-value">{p(settings.emailPrivacy, settings.language)}</span>
                      </div>
                      <div className="profile-info-row" onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'bioPrivacy', x: r.right - 180, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">{t('bio', settings.language)}</span><span className="profile-info-value">{p(settings.bioPrivacy, settings.language)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="landing-empty">{t('selectChat', settings.language)}</div>
        )}
      </main>
    </div>

    {chatContextMenu && (
      <div className="context-menu" style={{ left: chatContextMenu.x, top: chatContextMenu.y }} onClick={(e) => e.stopPropagation()}>
        <button className="context-menu-item" onClick={() => chatContextMenu && togglePinChat(chatContextMenu.chatId)}>
          <Pin size={14} /><span>{chats.find(c => c.id === chatContextMenu.chatId)?.pinned ? t('unpin', settings.language) : t('pin', settings.language)}</span>
        </button>
        <button className="context-menu-item" onClick={() => chatContextMenu && setFolderDropdown({ chatId: chatContextMenu.chatId, x: chatContextMenu.x + 190, y: chatContextMenu.y })}>
          <Folder size={14} /><span>{t('folder', settings.language)}</span>
        </button>
        <button className="context-menu-item context-menu-item-danger" onClick={deleteChat}><Trash2 size={14} /><span>{t('deleteChat', settings.language)}</span></button>
      </div>
    )}

    {folderDropdown && (
      <div className="context-menu" style={{ left: folderDropdown.x, top: folderDropdown.y }} onClick={(e) => e.stopPropagation()}>
        {folders.map(folder => (
          <button key={folder.id} className="context-menu-item" onClick={() => addChatToFolder(folderDropdown.chatId, folder.id)}>
            <span>{folder.name}</span>
            {folder.chats.includes(folderDropdown.chatId) && <span style={{ marginLeft: 'auto', color: '#13B962' }}>✓</span>}
          </button>
        ))}
        <button className="context-menu-item" onClick={() => { setNewFolderOpen(true); setFolderDropdown(null) }}>
          <Plus size={14} /><span>{t('newFolder', settings.language)}</span>
        </button>
      </div>
    )}

    {folderContextMenu && (
      <div className="context-menu" style={{ left: folderContextMenu.x, top: folderContextMenu.y }} onClick={(e) => e.stopPropagation()}>
        <button className="context-menu-item" onClick={() => folderContextMenu && renameFolder(folderContextMenu.folderId)}>
          <Pencil size={14} /><span>{t('rename', settings.language)}</span>
        </button>
        <button className="context-menu-item context-menu-item-danger" onClick={() => folderContextMenu && deleteFolder(folderContextMenu.folderId)}>
          <Trash2 size={14} /><span>{t('delete', settings.language)}</span>
        </button>
      </div>
    )}

    {newChatCtxMenu && (
      <div className="context-menu" style={{ left: newChatCtxMenu.x, top: newChatCtxMenu.y }} onClick={(e) => e.stopPropagation()}>
        <button className="context-menu-item" onClick={() => { setNewChatCtxMenu(null); setCreateGroupOpen(true) }}>
          <Users size={14} /><span>{t('newGroup', settings.language)}</span>
        </button>
        <button className="context-menu-item" onClick={() => { setNewChatCtxMenu(null); setFolderEditOpen(true) }}>
          <Folder size={14} /><span>{t('editFolders', settings.language)}</span>
        </button>
        {(activeTab === 'home' ? aiConversation.length > 0 : messages.length > 0) && (
          <button className="context-menu-item" onClick={handleClearActiveChat}>
            <Trash2 size={14} /><span>{t('clearChat', settings.language)}</span>
          </button>
        )}
      </div>
    )}

    {folderEditOpen && (
      <div className="dialog-overlay" onClick={() => setFolderEditOpen(false)}>
        <div className="dialog dialog-ef" onClick={e => e.stopPropagation()}>
          <div className="dialog-header">
            <div className="dialog-title">{t('editFolders', settings.language)}</div>
            <button className="dialog-close" onClick={() => setFolderEditOpen(false)}><X size={16} /></button>
          </div>

          <div className="dialog-ef-body">
            {/* LEFT SIDEBAR */}
            <div className="dialog-ef-sidebar">
              <div className="dialog-ef-sidebar-title">{t('folders', settings.language)}</div>
              <div className="dialog-ef-sidebar-list">
                {folders.map(folder => {
                  const isActive = efSelectedFolderId === folder.id || (efSelectedFolderId === null && folder.id === folders[0]?.id)
                  const isRenaming = efRenamingId === folder.id
                  return (
                    <div key={folder.id}
                      className={`dialog-ef-sidebar-item ${isActive ? 'active' : ''}`}
                      onClick={() => { setEfSelectedFolderId(folder.id); setEfAddOpen(false); setEfAddQuery(''); setEfChatQuery(''); }}
                    >
                      <Folder size={16} />
                      {isRenaming ? (
                        <input className="dialog-ef-sidebar-input" autoFocus
                          value={efRenamingInput}
                          onChange={e => setEfRenamingInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { submitEfRename() }
                            else if (e.key === 'Escape') { cancelEfRename() }
                          }}
                          onBlur={submitEfRename}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span className="dialog-ef-sidebar-name">{folder.name}</span>
                      )}
                      <span className="dialog-ef-sidebar-count">{folder.chats.length}</span>
                      {isActive && !isRenaming && (
                        <div className="dialog-ef-sidebar-actions">
                          <button className="dialog-ef-sidebar-btn" title={t('rename', settings.language)} onClick={(e) => { e.stopPropagation(); startEfRename(folder.id) }}>
                            <Pencil size={12} />
                          </button>
                          <button className="dialog-ef-sidebar-btn danger" title={t('delete', settings.language)} onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id) }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
                {folders.length === 0 && <div className="dialog-ef-empty">{t('noChats', settings.language)}</div>}
              </div>
              <div className="dialog-ef-sidebar-footer">
                <input className="dialog-input" placeholder={t('newFolderName', settings.language)} value={folderEditInput}
                  onChange={e => setFolderEditInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && folderEditInput.trim()) { createFolder(folderEditInput.trim()); setFolderEditInput('') } }} />
                <button className="dialog-btn dialog-btn-primary" onClick={() => { if (folderEditInput.trim()) { createFolder(folderEditInput.trim()); setFolderEditInput('') } }}>
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* RIGHT MAIN */}
            <div className="dialog-ef-main">
              {(() => {
                const selectedFolder = folders.find(f => f.id === efSelectedFolderId) || folders[0]
                if (!selectedFolder) return <div className="dialog-ef-main-placeholder">{t('noChats', settings.language)}</div>
                const folderChats = chats.filter(c => selectedFolder.chats.includes(c.id))
                const filteredChats = folderChats.filter(c => c.name.toLowerCase().includes(efChatQuery.toLowerCase()))
                const availableChats = chats.filter(c => !selectedFolder.chats.includes(c.id) && c.name !== 'Opus')
                const filteredAvailable = availableChats.filter(c => c.name.toLowerCase().includes(efAddQuery.toLowerCase()))
                return (
                  <>
                    <div className="dialog-ef-main-header">
                      <div className="dialog-ef-main-title">
                        <span>{selectedFolder.name}</span>
                        <span className="dialog-ef-main-subtitle">{folderChats.length} {t('chats', settings.language)}</span>
                      </div>
                      <div className="dialog-ef-main-search">
                        <Search size={14} />
                        <input placeholder={t('search', settings.language)} value={efChatQuery} onChange={e => setEfChatQuery(e.target.value)} />
                      </div>
                    </div>
                    <div className="dialog-ef-main-list">
                      {filteredChats.length === 0 ? (
                        <div className="dialog-ef-main-empty">
                          {efChatQuery ? t('noUsersFound', settings.language) : t('allChatsInFolder', settings.language)}
                        </div>
                      ) : (
                        filteredChats.map(chat => (
                          <div key={chat.id} className="dialog-ef-main-chat">
                            <div className="dialog-ef-main-avatar">
                              {chat.participantAvatar ? (
                                <img src={chat.participantAvatar} alt="" />
                              ) : chat.isGroup ? (
                                <Users size={14} />
                              ) : (
                                <User size={14} />
                              )}
                            </div>
                            <span className="dialog-ef-main-chat-name">{chat.name}</span>
                            <button className="dialog-ef-main-chat-remove" onClick={() => {
                              api(`/folders/${selectedFolder.id}/chats/${chat.id}`, { method: 'DELETE' }).then(() => {
                                setFolders(prev => prev.map(f => f.id === selectedFolder.id ? { ...f, chats: f.chats.filter(c => c !== chat.id) } : f))
                              })
                            }}>
                              <X size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="dialog-ef-main-add">
                      <button className="dialog-ef-main-add-toggle" onClick={() => setEfAddOpen(v => !v)}>
                        <Plus size={14} />
                        <span>{t('addChat', settings.language)}</span>
                        {efAddOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      {efAddOpen && (
                        <div className="dialog-ef-main-add-panel">
                          <div className="dialog-ef-main-add-search">
                            <Search size={14} />
                            <input placeholder={t('search', settings.language)} value={efAddQuery} onChange={e => setEfAddQuery(e.target.value)} />
                          </div>
                          <div className="dialog-ef-main-add-list">
                            {filteredAvailable.length === 0 ? (
                              <div className="dialog-ef-main-add-empty">{t('allChatsInFolder', settings.language)}</div>
                            ) : (
                              filteredAvailable.map(chat => (
                                <button key={chat.id} className="dialog-ef-main-add-item" onClick={() => {
                                  api(`/folders/${selectedFolder.id}/chats/${chat.id}`, { method: 'POST' }).then(() => {
                                    setFolders(prev => prev.map(f => f.id === selectedFolder.id ? { ...f, chats: [...f.chats, chat.id] } : f))
                                  })
                                }}>
                                  <div className="dialog-ef-main-add-avatar">
                                    {chat.participantAvatar ? (
                                      <img src={chat.participantAvatar} alt="" />
                                    ) : chat.isGroup ? (
                                      <Users size={14} />
                                    ) : (
                                      <User size={14} />
                                    )}
                                  </div>
                                  <span className="dialog-ef-main-add-item-name">{chat.name}</span>
                                  <Plus size={14} className="dialog-ef-main-add-icon" />
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      </div>
    )}

    {settingDropdown && (
      <div className="context-menu" style={{ left: settingDropdown.x, top: settingDropdown.y }} onClick={e => e.stopPropagation()}>
        {settingOptions[settingDropdown.key]?.map(option => (
          <button
            key={option}
            className={`context-menu-item${(settings as any)[settingDropdown.key] === option ? ' context-menu-item-active' : ''}`}
            onClick={() => selectSetting(settingDropdown.key, option)}
          >
            {['lastSeen','profilePhoto','phonePrivacy','emailPrivacy','bioPrivacy'].includes(settingDropdown.key)
              ? p(option, settings.language)
              : settingDropdown.key === 'language'
                ? langName(option)
                : settingDropdown.key === 'autoDownload'
                  ? t(option === 'Wi-Fi only' ? 'wiFiOnly' : option.toLowerCase(), settings.language)
                  : option}
            {(settings as any)[settingDropdown.key] === option && <span style={{ marginLeft: 'auto', color: '#ffffff' }}>✓</span>}
          </button>
        ))}
      </div>
    )}

    {fullscreenImage && (
      <div className="fullscreen-overlay" onClick={() => setFullscreenImage(null)}>
        <img src={fullscreenImage} className="fullscreen-image" alt={t('fullscreen', settings.language)} />
      </div>
    )}

    {pollModalOpen && (
      <div className="poll-modal-overlay" onClick={() => setPollModalOpen(false)}>
        <div className="poll-modal" onClick={e => e.stopPropagation()}>
          <div className="poll-modal-header">
            <h2 className="poll-modal-title">{t('newPoll', settings.language)}</h2>
            <button className="poll-modal-close" onClick={() => setPollModalOpen(false)}><X size={18} /></button>
          </div>
          <div className="poll-modal-body">
            <div className="poll-question-wrap">
              <label className="poll-label">{t('question', settings.language)}</label>
              <input
                className="poll-question-input"
                placeholder={t('askSomething', settings.language)}
                value={pollQuestion}
                onChange={e => setPollQuestion(e.target.value)}
                autoFocus
              />
            </div>
            <div className="poll-options-wrap">
              <label className="poll-label">{t('options', settings.language)}</label>
              <div className="poll-options-list">
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="poll-option-row">
                    <span className="poll-option-badge">{String.fromCharCode(65 + idx)}</span>
                    <input
                      className="poll-option-input"
                      placeholder={`${t('option', settings.language)} ${idx + 1}`}
                      value={opt}
                      onChange={e => {
                        const next = [...pollOptions]
                        next[idx] = e.target.value
                        setPollOptions(next)
                      }}
                    />
                    {pollOptions.length > 2 && (
                      <button className="poll-option-remove" onClick={() => setPollOptions(prev => prev.filter((_, i) => i !== idx))}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {pollOptions.length < 10 && (
                <button className="poll-add-option" onClick={() => setPollOptions(prev => [...prev, ''])}>
                  <Plus size={16} /><span>{t('addOption', settings.language)}</span>
                </button>
              )}
            </div>
          </div>
          <div className="poll-modal-footer">
            <button className="poll-btn poll-btn-secondary" onClick={() => setPollModalOpen(false)}>{t('cancel', settings.language)}</button>
            <button
              className="poll-btn poll-btn-primary"
              disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
              onClick={handleCreatePoll}
            >
              {t('createPoll', settings.language)}
            </button>
          </div>
        </div>
      </div>
    )}

    {createGroupOpen && (
      <div className={`dialog-overlay create-group-overlay${createGroupClosing ? ' closing' : ''}`} onClick={closeCreateGroup}>
        <div className={`dialog create-group-dialog${createGroupClosing ? ' closing' : ''}`} style={{ minWidth: 320, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
          <div className="dialog-header">
            <h2 className="dialog-title">{t('newGroup', settings.language)}</h2>
            <button className="dialog-close" onClick={closeCreateGroup}><X size={18} /></button>
          </div>
          <input
            className="dialog-input"
            placeholder={t('groupName', settings.language)}
            value={createGroupName}
            onChange={e => setCreateGroupName(e.target.value)}
            autoFocus
          />
          <div className="dialog-text">{t('selectMembers', settings.language)}</div>
          <div className="dialog-ef-list" style={{ maxHeight: 260 }}>
            {chats.filter(c => !c.isGroup && c.participantId && c.name !== 'Opus').map(contact => {
              const selected = createGroupSelected.includes(contact.participantId!)
              return (
                <button key={contact.participantId} className="context-menu-item" onClick={() => {
                  setCreateGroupSelected(prev => selected ? prev.filter(id => id !== contact.participantId) : [...prev, contact.participantId!])
                }} style={{ justifyContent: 'flex-start', gap: 10 }}>
                  <div className="item-avatar" style={contact.participantAvatar ? { backgroundImage: `url(${contact.participantAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent' } : {}}>
                    {!contact.participantAvatar && <User size={16} strokeWidth={1.5} />}
                  </div>
                  <span style={{ flex: 1, textAlign: 'left' }}>{contact.name}</span>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: '1.5px solid #8c8c88', background: selected ? '#3287FE' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selected && <Check size={12} color="#fff" />}
                  </div>
                </button>
              )
            })}
          </div>
          <div className="dialog-actions">
            <button className="dialog-btn dialog-btn-cancel" onClick={closeCreateGroup}>{t('cancel', settings.language)}</button>
            <button
              className="dialog-btn dialog-btn-primary"
              disabled={!createGroupName.trim() || createGroupSelected.length === 0}
              onClick={handleCreateGroup}
            >{t('create', settings.language)}</button>
          </div>
        </div>
      </div>
    )}

    {addMemberDialogOpen && (
      <div className="dialog-overlay" onClick={() => setAddMemberDialogOpen(false)}>
        <div className="dialog" style={{ minWidth: 320, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
          <div className="dialog-header">
            <h2 className="dialog-title">{t('addMember', settings.language)}</h2>
            <button className="dialog-close" onClick={() => setAddMemberDialogOpen(false)}><X size={18} /></button>
          </div>
          <input
            ref={groupInfoAddInputRef}
            className="dialog-input"
            placeholder={t('searchUsers', settings.language)}
            value={groupInfoAddQuery}
            onChange={e => setGroupInfoAddQuery(e.target.value)}
          />
          {groupInfoAddResults.length > 0 && (
            <div className="dialog-ef-list" style={{ maxHeight: 260 }}>
              {groupInfoAddResults.map(u => (
                <button key={u.id} className="context-menu-item" onClick={() => { handleAddGroupMember(u.id); setAddMemberDialogOpen(false) }} style={{ justifyContent: 'flex-start', gap: 10 }}>
                  <div className="item-avatar" style={u.avatar ? { backgroundImage: `url(${u.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent' } : {}}>
                    {!u.avatar && <User size={16} strokeWidth={1.5} />}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                    <span style={{ color: '#fff' }}>{u.name} {u.surname}</span>
                    {u.username && <span style={{ color: '#8c8c88', fontSize: 12 }}>@{u.username}</span>}
                  </div>
                  <Plus size={16} color="#3287FE" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )}

    {proOpen && (
      <div className="desktop-pro-page">
        <button className="desktop-pro-close" onClick={() => setProOpen(false)} aria-label={t('close', settings.language)}>
          <X size={20} />
        </button>
        <div className="desktop-pro-plans">
          <h1 className="desktop-pro-plans-title">{t('upgradeYourPlan', settings.language)}</h1>
          <div className="desktop-pro-plans-toggle">
            <div className={`desktop-pro-plans-toggle-slider${proPlan === 'annual' ? ' right' : ''}`} />
            <button
              className={`desktop-pro-plans-toggle-btn${proPlan === 'monthly' ? ' active' : ''}`}
              onClick={() => setProPlan('monthly')}
            >
              {t('month', settings.language)}
            </button>
            <button
              className={`desktop-pro-plans-toggle-btn${proPlan === 'annual' ? ' active' : ''}`}
              onClick={() => setProPlan('annual')}
            >
              {t('year', settings.language)}
            </button>
          </div>

          <div className="desktop-pro-plans-grid">
            <div className="desktop-pro-plan-card desktop-pro-plan-card-free">
              <div>
                <div className="desktop-pro-plan-card-name">{t('free', settings.language)}</div>
                <div className="desktop-pro-plan-card-price-wrap">
                  <span className="desktop-pro-plan-card-currency">₽</span>
                  <span className="desktop-pro-plan-card-price">0</span>
                </div>
                <div className="desktop-pro-plan-card-desc">{t('freePlanDesc', settings.language)}</div>
                <ul className="desktop-pro-plan-card-features">
                  <li>
                    <span className="desktop-pro-plan-card-check free"><Check size={14} strokeWidth={2.5} /></span>
                    {t('conversations', settings.language)}
                  </li>
                  <li>
                    <span className="desktop-pro-plan-card-check free"><Check size={14} strokeWidth={2.5} /></span>
                    {t('privacyCustomization', settings.language)}
                  </li>
                  <li>
                    <span className="desktop-pro-plan-card-check free"><Check size={14} strokeWidth={2.5} /></span>
                    {t('basicAiTools', settings.language)}
                  </li>
                </ul>
              </div>
              <button className="desktop-pro-plan-card-btn" disabled>
                {proStatus?.active ? t('downgrade', settings.language) : t('currentPlan', settings.language)}
              </button>
            </div>

            <div className="desktop-pro-plan-card desktop-pro-plan-card-pro">
              <div>
                <div className="desktop-pro-plan-card-name">{t('pro', settings.language)}</div>
                <div className="desktop-pro-plan-card-price-wrap">
                  <span className="desktop-pro-plan-card-currency">₽</span>
                  <span className="desktop-pro-plan-card-price">
                    {proPlans.find((plan: Plan) => proPlan === (plan.id === 1 ? 'monthly' : 'annual'))?.price_rub.toLocaleString() || '—'}
                  </span>
                </div>
                <div className="desktop-pro-plan-card-desc">{t('proPlanDesc', settings.language)}</div>
                <ul className="desktop-pro-plan-card-features">
                  <li>
                    <span className="desktop-pro-plan-card-check pro"><Check size={14} strokeWidth={2.5} /></span>
                    {t('opusInChats', settings.language)}
                  </li>
                  <li>
                    <span className="desktop-pro-plan-card-check pro"><Check size={14} strokeWidth={2.5} /></span>
                    {t('doubledLimits', settings.language)}
                  </li>
                  <li>
                    <span className="desktop-pro-plan-card-check pro"><Check size={14} strokeWidth={2.5} /></span>
                    {t('profileBadge', settings.language)}
                  </li>
                  <li>
                    <span className="desktop-pro-plan-card-check pro"><Check size={14} strokeWidth={2.5} /></span>
                    {t('advancedAiTools', settings.language)}
                  </li>
                  <li>
                    <span className="desktop-pro-plan-card-check pro"><Check size={14} strokeWidth={2.5} /></span>
                    {t('appearanceCustomization', settings.language)}
                  </li>
                  <li>
                    <span className="desktop-pro-plan-card-check pro"><Check size={14} strokeWidth={2.5} /></span>
                    {t('appearanceCustomization', settings.language)}
                  </li>
                </ul>
              </div>
              <button
                className={`desktop-pro-plan-card-btn${upgradeLoading ? ' loading' : ''}`}
                disabled={upgradeLoading || proStatus?.active}
                onClick={async () => {
                  if (proStatus?.active) return
                  setUpgradeLoading(true)
                  try {
                    const planId = proPlan === 'monthly' ? 1 : 2
                    const data = await api('/subscription/create', {
                      method: 'POST',
                      body: JSON.stringify({ plan_id: planId })
                    })
                    if (data.confirmation_url) {
                      window.location.href = data.confirmation_url
                    }
                  } catch (err: unknown) {
                    setPaymentError(err instanceof Error ? err.message : 'Payment failed')
                  } finally {
                    setUpgradeLoading(false)
                  }
                }}
              >
                {upgradeLoading ? <Loader2 size={20} className="btn-spinner" /> : (proStatus?.active ? t('currentPlan', settings.language) : t('upgrade', settings.language))}
              </button>
            </div>
          </div>

          <div className="desktop-pro-legal">
            <button className="desktop-pro-legal-link" onClick={() => setPageStack(prev => [...prev, 'offer'])}>{t('termsOfService', settings.language)}</button>
            <button className="desktop-pro-legal-link" onClick={() => setPageStack(prev => [...prev, 'contacts'])}>{t('contactsTitle', settings.language)}</button>
          </div>
        </div>
      </div>
    )}

    {paymentError && (
      <div className={`payment-error-overlay${paymentErrorClosing ? ' closing' : ''}`} onClick={closePaymentError}>
        <div className={`payment-error-modal${paymentErrorClosing ? ' closing' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className="payment-error-icon">
            <AlertCircle size={36} />
          </div>
          <h2 className="payment-error-title">{t('paymentError', settings.language)}</h2>
          <p className="payment-error-message">{paymentError}</p>
          <button className="payment-error-btn" onClick={closePaymentError}>
            {t('close', settings.language)}
          </button>
        </div>
      </div>
    )}

    {showProSuccess && (
      <ProSuccess
        language={settings.language}
        onClose={() => {
          setShowProSuccess(false)
          window.history.replaceState(null, '', window.location.origin)
          api('/subscription/status').then(setProStatus).catch(() => {})
        }}
      />
    )}

    {pageStack.includes('offer') && (
      <Offer language={settings.language} onClose={() => {
        setPageStack(prev => prev.filter(p => p !== 'offer'))
        window.history.replaceState(null, '', window.location.origin)
      }} />
    )}
    {pageStack.includes('contacts') && (
      <Contacts language={settings.language} onClose={() => {
        setPageStack(prev => prev.filter(p => p !== 'contacts'))
        window.history.replaceState(null, '', window.location.origin)
      }} />
    )}

    {newFolderOpen && (
      <div className={`dialog-overlay new-folder-overlay${newFolderClosing ? ' closing' : ''}`} onClick={closeNewFolder}>
        <div className={`new-folder-dialog${newFolderClosing ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>
          <h2 className="new-folder-title">{t('folderNamePrompt', settings.language)}</h2>
          <input
            className="new-folder-input"
            value={newFolderInput}
            onChange={e => setNewFolderInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitNewFolder() }}
            autoFocus
          />
          <div className="new-folder-actions">
            <button className="new-folder-btn cancel" onClick={closeNewFolder}>{t('cancel', settings.language)}</button>
            <button className="new-folder-btn primary" onClick={submitNewFolder} disabled={!newFolderInput.trim()}>{t('create', settings.language)}</button>
          </div>
        </div>
      </div>
    )}

    {renameFolderId && (
      <div className={`dialog-overlay rename-folder-overlay${renameFolderClosing ? ' closing' : ''}`} onClick={closeRenameFolder}>
        <div className={`rename-folder-dialog${renameFolderClosing ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>
          <h2 className="rename-folder-title">{t('renameFolderPrompt', settings.language)}</h2>
          <input
            className="rename-folder-input"
            value={renameFolderInput}
            onChange={e => setRenameFolderInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitRenameFolder() }}
            autoFocus
          />
          <div className="rename-folder-actions">
            <button className="rename-folder-btn cancel" onClick={closeRenameFolder}>{t('cancel', settings.language)}</button>
            <button className="rename-folder-btn primary" onClick={submitRenameFolder} disabled={!renameFolderInput.trim()}>{t('save', settings.language)}</button>
          </div>
        </div>
      </div>
    )}

    {deleteFolderConfirm && (
      <div className={`dialog-overlay delete-folder-overlay${deleteFolderConfirmClosing ? ' closing' : ''}`} onClick={closeDeleteFolderConfirm}>
        <div className={`delete-folder-dialog${deleteFolderConfirmClosing ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>
          <h2 className="delete-folder-title">{t('deleteFolderConfirm', settings.language)}</h2>
          <p className="delete-folder-message">{t('deleteFolderConfirmDesc', settings.language)}</p>
          <div className="delete-folder-actions">
            <button className="delete-folder-btn cancel" onClick={closeDeleteFolderConfirm}>{t('cancel', settings.language)}</button>
            <button className="delete-folder-btn danger" onClick={confirmDeleteFolder}>{t('delete', settings.language)}</button>
          </div>
        </div>
      </div>
    )}

    {toast && <div className={`toast${toastClosing ? ' closing' : ''}`}>{toast}</div>}
  </>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      className={`mobile-toggle ${checked ? 'active' : ''}`}
      onClick={(e) => { e.stopPropagation(); onChange() }}
    >
      <div className="mobile-toggle-knob" />
    </button>
  )
}

export default App
