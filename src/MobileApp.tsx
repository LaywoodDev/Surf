import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageSquare, User, Users, Plus, Search, ArrowUp, Reply,
  Copy, Trash2, Settings, Pencil, Phone,
  ChevronLeft, MoreVertical, Camera, Image, File, X,
  ChevronRight, Mail, AtSign,
  Globe, Eye, Volume2, AlignLeft, Clock,
  Pin, Folder, Check, LogOut, BarChart3, CheckCircle,
  Cloud, BadgeCheck
} from 'lucide-react'
import { t, langName, p } from './i18n'
import Offer from './pages/Offer'
import Contacts from './pages/Contacts'
import ProSuccess from './pages/ProSuccess'
import './MobileApp.css'

interface Chat {
  id: number
  name: string
  lastMessage: string
  time: string
  pinned?: boolean
  participantId?: number
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
  senderName?: string
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

function MessageStatusIcon({ status }: { status?: 'sent' | 'delivered' | 'read' }) {
  if (!status) return null

  if (status === 'sent') {
    return <Check size={13} strokeWidth={2.2} className="mobile-msg-status-icon" />
  }

  return (
    <span className={`mobile-msg-status-double${status === 'read' ? ' is-read' : ''}`}>
      <Check size={13} strokeWidth={2.2} className="mobile-msg-status-icon overlap" />
      <Check size={13} strokeWidth={2.2} className="mobile-msg-status-icon" />
    </span>
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

function AuthLogo({ size = 40 }: { size?: number }) {
  const w = size
  const h = Math.round(size * 0.58)
  return (
    <svg width={w} height={h} viewBox="0 0 24 14" fill="none">
      <mask id="auth_logo_mask" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="14">
        <path d="M0.188963 1.7392L6.82464 11.9946C7.16161 12.5153 7.85613 12.664 8.37683 12.327L14.5238 8.34973C14.7617 8.19573 15.0697 8.2003 15.303 8.36116L22.2314 13.1397C23.2423 13.8365 24.4781 12.6373 23.811 11.6066L17.1746 1.35116C16.8376 0.830456 16.1431 0.681795 15.6232 1.01876L9.47465 4.99682C9.23679 5.15082 8.92879 5.14624 8.6955 4.98538L1.7686 0.2076C0.757692 -0.489971 -0.478113 0.710003 0.188963 1.74073V1.7392Z" fill="url(#auth_logo_grad)"/>
      </mask>
      <g mask="url(#auth_logo_mask)">
        <g filter="url(#auth_logo_f0)"><circle cx="23.25" cy="9.75" r="9.75" fill="#3287FE"/></g>
        <g filter="url(#auth_logo_f1)"><circle cx="10.5" cy="14.25" r="9.75" fill="#13B962"/></g>
        <g filter="url(#auth_logo_f2)"><circle cx="-1.5" cy="2.25" r="9.75" fill="#F6BE11"/></g>
        <g filter="url(#auth_logo_f3)"><circle cx="12.75" cy="-1.5" r="9.75" fill="#FA4442"/></g>
      </g>
      <defs>
        <filter id="auth_logo_f0" x="6.15" y="-7.35" width="34.2" height="34.2" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix"/>
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
          <feGaussianBlur stdDeviation="2.4" result="effect1_foregroundBlur_1173_79"/>
        </filter>
        <filter id="auth_logo_f1" x="-6.6" y="-2.85" width="34.2" height="34.2" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix"/>
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
          <feGaussianBlur stdDeviation="2.4" result="effect1_foregroundBlur_1173_79"/>
        </filter>
        <filter id="auth_logo_f2" x="-18.6" y="-14.85" width="34.2" height="34.2" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix"/>
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
          <feGaussianBlur stdDeviation="2.4" result="effect1_foregroundBlur_1173_79"/>
        </filter>
        <filter id="auth_logo_f3" x="-4.35" y="-18.6" width="34.2" height="34.2" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix"/>
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
          <feGaussianBlur stdDeviation="2.4" result="effect1_foregroundBlur_1173_79"/>
        </filter>
        <linearGradient id="auth_logo_grad" x1="12" y1="0" x2="12" y2="13.347" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E20736"/><stop offset="1" stopColor="#BEE000"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

function MobileApp() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<UserData | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(!!token)
  type MobileAuthMode = 'welcome' | 'login' | 'register-email' | 'register-info'
  const [authMode, setAuthMode] = useState<MobileAuthMode>('welcome')
  const [authSheetClosing, setAuthSheetClosing] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragState = useRef({ startY: 0, dragging: false })
  const [authForm, setAuthForm] = useState({ email: '', password: '', firstName: '', lastName: '' })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const authFileInputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<'chats' | 'opus' | 'profile'>('chats')
  const [chatView, setChatView] = useState<'list' | 'thread' | 'contact'>('list')

  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [chatInputTexts, setChatInputTexts] = useState<Record<number, string>>(loadChatDrafts)
  const [contactProfile, setContactProfile] = useState<UserData | null>(null)
  const [viewedUser, setViewedUser] = useState<UserData | null>(null)
  const [contacts, setContacts] = useState<UserData[]>([])
  const [mentionMenu, setMentionMenu] = useState<{ chatId: number; query: string } | null>(null)
  const [replyTo, setReplyTo] = useState<{ messageId: number; text: string; attachmentUrl?: string; attachmentType?: string } | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<{ url: string; type: string; name: string }[]>([])
  const [isPeerTyping, setIsPeerTyping] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null)
  const [folderSheet, setFolderSheet] = useState<{ chatId: number } | null>(null)
  const [folderContextMenu, setFolderContextMenu] = useState<{ folderId: number } | null>(null)
  const [folderMenuSheet, setFolderMenuSheet] = useState(false)
  const [opusMenuSheet, setOpusMenuSheet] = useState(false)
  const [folderEditOpen, setFolderEditOpen] = useState(false)
  const [folderEditNames, setFolderEditNames] = useState<Record<number, string>>({})
  const [folderManageView, setFolderManageView] = useState<{ folderId: number } | null>(null)
  const [addChatsSheet, setAddChatsSheet] = useState<{ folderId: number; selected: Set<number> } | null>(null)
  const [folderDialog, setFolderDialog] = useState<{ type: 'rename' | 'delete' | 'create'; folderId?: number } | null>(null)
  const [folderDialogInput, setFolderDialogInput] = useState('')

  const [inputText, setInputText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiConversation, setAiConversation] = useState<{ role: 'user' | 'ai'; text: string; time?: string }[]>([])

  const handleRefresh = () => {
    api('/chats').then(setChats)
    api('/folders').then(setFolders)
    api('/users/me').then(u => {
      setUser(u)
      setEditProfile({ username: u.username || '', phone: u.phone || '', bio: u.bio || '' })
    })
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setIsLoggedIn(false)
    setUser(null)
    setProfileView('profile')
    setTab('chats')
    setChatView('list')
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

    const dot = clone.querySelector('.mobile-profile-status-dot')
    if (dot) dot.remove()

    clone.addEventListener('click', closeAvatarAnim)
    overlay.addEventListener('click', closeAvatarAnim)

    original.style.opacity = '0'
    original.style.transition = 'opacity 0.1s ease'

    const targetSize = Math.min(window.innerWidth * 0.8, window.innerHeight * 0.6, 400)
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
    const targetSize = Math.min(window.innerWidth * 0.8, window.innerHeight * 0.6, 400)
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

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserData[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [closingSearch, setClosingSearch] = useState(false)

  const toggleSearch = () => {
    if (searchOpen) {
      if (closingSearch) return
      setClosingSearch(true)
      setTimeout(() => {
        setSearchOpen(false)
        setClosingSearch(false)
      }, 200)
    } else {
      setSearchOpen(true)
    }
  }

  const [attachMenu, setAttachMenu] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ messageId: number } | null>(null)
  const [chatContextMenu, setChatContextMenu] = useState<{ chatId: number } | null>(null)
  const [threadMenu, setThreadMenu] = useState<{ x: number; y: number } | null>(null)
  const [clearChatSubmenu, setClearChatSubmenu] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const profileAvatarRef = useRef<HTMLDivElement>(null)
  const avatarCloneRef = useRef<{ clone: HTMLElement; original: HTMLElement; overlay: HTMLDivElement } | null>(null)
  const [closingThread, setClosingThread] = useState(false)
  const [closingContact, setClosingContact] = useState(false)
  const [closingSheet, setClosingSheet] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [toastClosing, setToastClosing] = useState(false)
  const typingHeartbeatRef = useRef<Record<number, number>>({})

  const closeSheet = (type: string) => {
    if (closingSheet) return
    setClosingSheet(type)
    setTimeout(() => {
      setAttachMenu(false)
      setContextMenu(null)
      setChatContextMenu(null)
      setThreadMenu(null)
      setClearChatSubmenu(false)
      setFolderSheet(null)
      setFolderContextMenu(null)
      setOptionPicker(null)
      setFolderMenuSheet(false)
      setOpusMenuSheet(false)
      setAddChatsSheet(null)
      setClosingSheet(null)
    }, 200)
  }

  const closeSheetImmediate = () => {
    setAttachMenu(false)
    setContextMenu(null)
    setThreadMenu(null)
    setClearChatSubmenu(false)
    setChatContextMenu(null)
    setFolderSheet(null)
    setFolderContextMenu(null)
    setOptionPicker(null)
    setFolderMenuSheet(false)
    setOpusMenuSheet(false)
    setAddChatsSheet(null)
    setClosingSheet(null)
  }

  const handleOpenPro = () => setProOpen(true)
  const handleClosePro = () => setProOpen(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const tabBarRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 })
  const touchDrag = useRef<{ startX: number; startTab: string } | null>(null)
  const chatLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const folderLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tabLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tabLongPressed = useRef(false)

  const tabKeys = ['chats', 'opus', 'profile'] as const

  const updateIndicator = useCallback((activeTab: string) => {
    const btn = tabRefs.current[activeTab]
    const bar = tabBarRef.current
    if (btn && bar) {
      const barRect = bar.getBoundingClientRect()
      const btnRect = btn.getBoundingClientRect()
      setTabIndicator({
        left: btnRect.left - barRect.left,
        width: btnRect.width,
      })
    }
  }, [])

  const getTabAtX = useCallback((clientX: number) => {
    for (const key of tabKeys) {
      const btn = tabRefs.current[key]
      if (!btn) continue
      const rect = btn.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) return key
    }
    const first = tabRefs.current[tabKeys[0]]
    if (first && clientX < first.getBoundingClientRect().left) return tabKeys[0]
    const last = tabRefs.current[tabKeys[tabKeys.length - 1]]
    if (last && clientX > last.getBoundingClientRect().right) return tabKeys[tabKeys.length - 1]
    return tabKeys[0]
  }, [])

  const handleTabTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    const activeBtn = tabRefs.current[tab]
    if (!activeBtn) return
    const rect = activeBtn.getBoundingClientRect()
    if (touch.clientX >= rect.left && touch.clientX <= rect.right) {
      touchDrag.current = { startX: touch.clientX, startTab: tab }
    }
  }

  const handleTabTouchMove = (e: React.TouchEvent) => {
    if (!touchDrag.current) return
    const touch = e.touches[0]
    const targetTab = getTabAtX(touch.clientX)
    const targetBtn = tabRefs.current[targetTab]
    const bar = tabBarRef.current
    if (targetBtn && bar) {
      const barRect = bar.getBoundingClientRect()
      const btnRect = targetBtn.getBoundingClientRect()
      setTabIndicator({
        left: btnRect.left - barRect.left,
        width: btnRect.width,
      })
    }
  }

  const handleTabTouchEnd = (e: React.TouchEvent) => {
    if (!touchDrag.current) return
    const touch = e.changedTouches[0]
    const targetTab = getTabAtX(touch.clientX)
    if (targetTab !== tab) {
      if (targetTab === 'profile') setProfileView('profile')
      setTab(targetTab as typeof tab)
    } else {
      const btn = tabRefs.current[tab]
      const bar = tabBarRef.current
      if (btn && bar) {
        const barRect = bar.getBoundingClientRect()
        const btnRect = btn.getBoundingClientRect()
        setTabIndicator({ left: btnRect.left - barRect.left, width: btnRect.width })
      }
    }
    touchDrag.current = null
  }

  useEffect(() => {
    updateIndicator(tab)
  }, [tab, updateIndicator, isLoggedIn])
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const aiMessagesRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [firstOpusEntry, setFirstOpusEntry] = useState(true)

  const [editProfile, setEditProfile] = useState({ username: '', phone: '', bio: '' })
  const [profileView, setProfileView] = useState<'profile' | 'edit' | 'settings'>('profile')
  const [proOpen, setProOpen] = useState(false)
  const [proPlan, setProPlan] = useState<'monthly' | 'annual'>('annual')
  const [proPlans, setProPlans] = useState<Plan[]>([])
  const [proStatus, setProStatus] = useState<ProStatus | null>(null)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [pageStack, setPageStack] = useState<string[]>(() => {
    const p = window.location.pathname
    if (p === '/offer') return ['offer']
    if (p === '/contacts') return ['contacts']
    return []
  })
  const [showProSuccess, setShowProSuccess] = useState(window.location.pathname === '/pro/success')
  const [optionPicker, setOptionPicker] = useState<string | null>(null)
  const [settings, setSettings] = useState(loadSettings)

  const [pollModalOpen, setPollModalOpen] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [pollsCache, setPollsCache] = useState<Record<number, Poll>>({})

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
      api('/chats').then(setChats)
      api('/folders').then(setFolders)
      api('/users/contacts').then(setContacts)
      api('/subscription/status').then(setProStatus).catch(() => {})
    }
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

    const pollTyping = () => {
      api(`/chats/${activeChatId}/typing`).then((res: { typing: boolean }) => {
        setIsPeerTyping(!!res.typing)
      }).catch(() => setIsPeerTyping(false))
    }

    pollTyping()
    const interval = window.setInterval(pollTyping, 1800)
    return () => window.clearInterval(interval)
  }, [activeChatId, chats])

  useEffect(() => {
    if (activeChatId) {
      api(`/chats/${activeChatId}/messages`).then((msgs: Message[]) => {
        setMessages(msgs)
        const chat = chats.find(c => c.id === activeChatId)
        if (chat?.name !== 'Opus') {
          api(`/chats/${activeChatId}/read`, { method: 'POST' }).then(() => {
            setMessages(prev => prev.map(m => m.sender === 'them' ? { ...m, status: 'read' } : m))
          }).catch(() => {})
        }
      })
      api(`/chats/${activeChatId}/other-user`).then(setContactProfile).catch(() => setContactProfile(null))
      api(`/polls/chat/${activeChatId}`).then((polls: Poll[]) => {
        const cacheUpdate: Record<number, Poll> = {}
        polls.forEach(p => { cacheUpdate[p.id] = p })
        setPollsCache(prev => ({ ...prev, ...cacheUpdate }))
      }).catch(() => {})
    }
    setMentionMenu(null)
    setViewedUser(null)
  }, [activeChatId, chats])

  const opusLoadedRef = useRef(false)
  useEffect(() => {
    if (tab === 'opus' && chats.length > 0 && !opusLoadedRef.current) {
      opusLoadedRef.current = true
      const opusChatId = chats.find(c => c.name === 'Opus')?.id
      if (opusChatId) {
        api(`/chats/${opusChatId}/messages`).then((msgs: any[]) => {
          setAiConversation(msgs.map(m => ({
            role: (m.sender === 'me' ? 'user' : 'ai') as 'user' | 'ai',
            text: m.text,
            time: m.time
          })))
        }).catch(() => {})
      }
    }
    if (tab !== 'opus') {
      opusLoadedRef.current = false
    }
  }, [tab, chats])

  useEffect(() => {
    if (firstOpusEntry) {
      const t = setTimeout(() => setFirstOpusEntry(false), 600)
      return () => clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (aiMessagesRef.current) {
      aiMessagesRef.current.scrollTop = aiMessagesRef.current.scrollHeight
    }
  }, [aiConversation, aiLoading])

  useEffect(() => {
    if (!searchOpen) {
      setSearchQuery('')
      setSearchResults([])
    }
  }, [searchOpen])

  useEffect(() => {
    if (tab !== 'chats' || chatView !== 'list') {
      setSearchOpen(false)
      setClosingSearch(false)
    }
  }, [tab, chatView])

  useEffect(() => {
    if (searchOpen && searchQuery.trim()) {
      const t = setTimeout(() => {
        api(`/users/search?q=${encodeURIComponent(searchQuery)}`).then(setSearchResults)
      }, 300)
      return () => clearTimeout(t)
    } else {
      setSearchResults([])
    }
  }, [searchQuery, searchOpen])

  useEffect(() => {
    if (!fullscreenImage) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreenImage(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [fullscreenImage])

  useEffect(() => {
    if (!avatarOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAvatarAnim() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [avatarOpen, closeAvatarAnim])

  useEffect(() => {
    if (!threadMenu) return
    const handleClick = () => { setThreadMenu(null); setClearChatSubmenu(false) }
    const handleScroll = () => { setThreadMenu(null); setClearChatSubmenu(false) }
    document.addEventListener('click', handleClick)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [threadMenu])

  const activeChat = chats.find(c => c.id === activeChatId)
  const hasEditChanges = editProfile.username !== (user?.username || '') || editProfile.phone !== (user?.phone || '') || editProfile.bio !== (user?.bio || '')

  const handleOpenChat = (chatId: number) => {
    setActiveChatId(chatId)
    setChatView('thread')
    setTab('chats')
    setMentionMenu(null)
  }

  const handleCloseChat = () => {
    if (closingThread) return
    setClosingThread(true)
    setMentionMenu(null)
    if (activeChatId) {
      delete typingHeartbeatRef.current[activeChatId]
      api(`/chats/${activeChatId}/typing`, { method: 'POST', body: JSON.stringify({ typing: false }) }).catch(() => {})
    }
    setTimeout(() => {
      setChatView('list')
      setActiveChatId(null)
      setContactProfile(null)
      setClosingThread(false)
    }, 280)
  }

  const handleCloseContact = () => {
    if (closingContact) return
    setClosingContact(true)
    setTimeout(() => {
      setChatView('thread')
      setClosingContact(false)
      setViewedUser(null)
    }, 280)
  }

  const playSentMessageSound = () => {
    if (settings.sounds !== 'On') return
    new Audio(`${import.meta.env.BASE_URL}sentmessage_1.mp3`).play().catch(() => {})
  }

  const handleSendMessage = (chatId: number) => {
    const text = chatInputTexts[chatId]?.trim()
    if (!text && pendingAttachments.length === 0) return
    setMentionMenu(null)

    const atts = pendingAttachments
    const body: any = { text, replyTo: replyTo?.messageId }
    if (atts.length > 0) {
      body.attachmentUrl = atts[0].url
      body.attachmentType = atts[0].type
    }

    api(`/chats/${chatId}/messages`, { method: 'POST', body: JSON.stringify(body) }).then((msg: any) => {
      if (msg.messages && Array.isArray(msg.messages)) {
        setMessages(prev => [...prev, ...msg.messages])
      } else {
        setMessages(prev => [...prev, msg])
      }
      playSentMessageSound()
      setChatInputTexts(prev => ({ ...prev, [chatId]: '' }))
      setReplyTo(null)
      setPendingAttachments([])
      const lastMsg = msg.messages ? msg.messages[msg.messages.length - 1] : msg
      setChats(prev => prev.map(c =>
        c.id === chatId ? { ...c, lastMessage: lastMsg.text || lastMsg.attachmentType || 'Attachment', time: lastMsg.time } : c
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
      api(`/chats/${activeChatId}/messages`).then((msgs: any[]) => {
        setMessages(msgs)
        const lastMsg = msgs[msgs.length - 1]
        if (lastMsg) {
          setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, lastMessage: 'Poll', time: lastMsg.time } : c))
        }
      })
      setPollModalOpen(false)
      setPollQuestion('')
      setPollOptions(['', ''])
    }).catch(err => alert(err.message))
  }

  const loadPoll = (pollId: number) => {
    if (pollsCache[pollId]) return
    if (!activeChatId) return
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

  const handleChatInputChange = (chatId: number, value: string) => {
    setChatInputTexts(prev => ({ ...prev, [chatId]: value }))
    const chat = chats.find(c => c.id === chatId)
    if (chat?.participantId && chat.name !== 'Opus') {
      const now = Date.now()
      const hasText = value.trim().length > 0
      if (hasText && (!typingHeartbeatRef.current[chatId] || now - typingHeartbeatRef.current[chatId] > 2000)) {
        typingHeartbeatRef.current[chatId] = now
        api(`/chats/${chatId}/typing`, { method: 'POST', body: JSON.stringify({ typing: true }) }).catch(() => {})
      }
      if (!hasText) {
        delete typingHeartbeatRef.current[chatId]
        api(`/chats/${chatId}/typing`, { method: 'POST', body: JSON.stringify({ typing: false }) }).catch(() => {})
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

  const openChatWithUser = (username: string) => {
    if (username.toLowerCase() === 'opus') {
      setTab('opus')
      return
    }
    api('/chats/find-or-create', { method: 'POST', body: JSON.stringify({ username }) }).then((chat: any) => {
      setChats(prev => {
        if (prev.find(c => c.id === chat.id)) return prev
        return [chat, ...prev]
      })
      setActiveChatId(chat.id)
      setChatView('thread')
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
      setAiConversation(prev => [...prev, { role: 'ai', text: result.response, time: now }])
    } catch {
      setAiConversation(prev => [...prev, { role: 'ai', text: 'Произошла ошибка. Попробуйте ещё раз.' }])
    } finally {
      setAiLoading(false)
    }
  }

  const copyMessage = () => {
    if (!contextMenu) return
    const msg = messages.find(m => m.id === contextMenu.messageId)
    if (msg) navigator.clipboard.writeText(msg.text)
    setContextMenu(null)
  }

  const copyField = (label: string, value: string) => {
    navigator.clipboard.writeText(value)
    setToastClosing(false)
    setToast(`${label} copied`)
    setTimeout(() => setToastClosing(true), 1200)
    setTimeout(() => { setToast(null); setToastClosing(false) }, 1500)
  }

  const deleteMessage = () => {
    if (!contextMenu) return
    setMessages(prev => prev.filter(m => m.id !== contextMenu.messageId))
    setContextMenu(null)
  }

  const clearChat = (chatId: number, forBoth: boolean) => {
    api(`/chats/${chatId}/messages`, { method: 'DELETE', body: JSON.stringify({ forBoth }) }).then(() => {
      setChatInputTexts(prev => ({ ...prev, [chatId]: '' }))
      if (activeChatId === chatId) {
        setMessages([])
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, lastMessage: '', time: '' } : c))
      }
      closeSheetImmediate()
    }).catch(() => {})
  }

  const handleChatLongPress = (chatId: number) => {
    setChatContextMenu({ chatId })
  }

  const handleFolderLongPress = (folderId: number) => {
    setFolderContextMenu({ folderId })
  }

  const deleteChat = () => {
    if (!chatContextMenu) return
    api(`/chats/${chatContextMenu.chatId}`, { method: 'DELETE' }).then(() => {
      setChats(prev => prev.filter(c => c.id !== chatContextMenu.chatId))
      setChatInputTexts(prev => {
        const next = { ...prev }
        delete next[chatContextMenu.chatId]
        return next
      })
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
      setFolderSheet(null)
      setChatContextMenu(null)
    }).catch(err => alert(err.message))
  }

  const renameFolder = (folderId: number) => {
    const folder = folders.find(f => f.id === folderId)
    setFolderDialogInput(folder?.name || '')
    setFolderDialog({ type: 'rename', folderId })
  }

  const deleteFolder = (folderId: number) => {
    setFolderDialog({ type: 'delete', folderId })
  }

  const handleFolderDialogConfirm = () => {
    if (!folderDialog) return
    if (folderDialog.type === 'rename') {
      const name = folderDialogInput.trim()
      if (!name) return
      api(`/folders/${folderDialog.folderId}`, { method: 'PUT', body: JSON.stringify({ name }) }).then(() => {
        setFolders(prev => prev.map(f => f.id === folderDialog.folderId ? { ...f, name } : f))
        setFolderDialog(null)
        setFolderContextMenu(null)
      }).catch(err => alert(err.message))
    } else if (folderDialog.type === 'delete') {
      api(`/folders/${folderDialog.folderId}`, { method: 'DELETE' }).then(() => {
        setFolders(prev => prev.filter(f => f.id !== folderDialog.folderId))
        if (activeFolderId === folderDialog.folderId) setActiveFolderId(null)
        setFolderDialog(null)
        setFolderContextMenu(null)
      }).catch(err => alert(err.message))
    } else if (folderDialog.type === 'create') {
      const name = folderDialogInput.trim()
      if (!name) return
      api('/folders', { method: 'POST', body: JSON.stringify({ name }) }).then((folder: Folder) => {
        setFolders(prev => [...prev, folder])
        setFolderDialog(null)
      }).catch(err => alert(err.message))
    }
  }

  const handleTabLongPress = (tabKey: string) => {
    tabLongPressed.current = true
    touchDrag.current = null
    if (tabKey === 'chats') {
      setFolderMenuSheet(true)
    } else if (tabKey === 'opus') {
      if (aiConversation.length === 0) return
      setOpusMenuSheet(true)
    }
  }

  const handleClearOpusChat = () => {
    const opusChatId = chats.find(c => c.name === 'Opus')?.id
    if (opusChatId) {
      api(`/chats/${opusChatId}/messages`, { method: 'DELETE' }).catch(() => {})
    }
    setAiConversation([])
    closeSheetImmediate()
  }

  const toggleChatInFolder = (folderId: number, chatId: number, add: boolean) => {
    if (add) {
      api(`/folders/${folderId}/chats/${chatId}`, { method: 'POST' }).then(() => {
        setFolders(prev => prev.map(f => f.id === folderId ? { ...f, chats: [...f.chats, chatId] } : f))
      }).catch(err => alert(err.message))
    } else {
      api(`/folders/${folderId}/chats/${chatId}`, { method: 'DELETE' }).then(() => {
        setFolders(prev => prev.map(f => f.id === folderId ? { ...f, chats: f.chats.filter(id => id !== chatId) } : f))
      }).catch(err => alert(err.message))
    }
  }

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
      if (key === 'phonePrivacy' || key === 'emailPrivacy' || key === 'bioPrivacy') {
        api('/users/me/privacy', {
          method: 'PUT',
          body: JSON.stringify({
            phone: next.phonePrivacy,
            email: next.emailPrivacy,
            bio: next.bioPrivacy,
          })
        }).catch(console.error)
      }
      return next
    })
    setOptionPicker(null)
  }

  if (!isLoggedIn) {
    const resetAuth = () => {
      setAuthForm({ email: '', password: '', firstName: '', lastName: '' })
      setAvatarFile(null)
      setAvatarPreview(null)
    }

    const closeSheet = () => {
      setAuthSheetClosing(true)
      setTimeout(() => {
        setAuthMode('welcome')
        setAuthSheetClosing(false)
      }, 300)
    }

    const handleDragStart = (clientY: number) => {
      dragState.current = { startY: clientY, dragging: true }
    }

    const handleDragMove = (clientY: number) => {
      if (!dragState.current.dragging) return
      const delta = (clientY - dragState.current.startY) * 0.5
      if (delta > 0 && sheetRef.current) {
        sheetRef.current.style.transition = 'none'
        sheetRef.current.style.transform = `translateY(${delta}px)`
      }
    }

    const handleDragEnd = () => {
      if (!dragState.current.dragging) return
      dragState.current.dragging = false
      const el = sheetRef.current
      if (!el) return
      const match = el.style.transform.match(/translateY\(([\d.]+)px\)/)
      const offset = match ? parseFloat(match[1]) : 0
      if (offset > 50) {
        el.style.transition = ''
        el.style.transform = ''
        closeSheet()
      } else {
        el.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        el.style.transform = 'translateY(0px)'
        setTimeout(() => {
          if (el) {
            el.style.transition = ''
            el.style.transform = ''
          }
        }, 200)
      }
    }

    const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    }

    if (authMode === 'register-info') {
      return (<>
        <div className="mobile-auth-page mobile-auth-info-page">
          <button
            className="mobile-auth-back"
            onClick={() => setAuthMode('register-email')}
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="mobile-auth-info-content">
            <button
              className="mobile-auth-avatar"
              onClick={() => authFileInputRef.current?.click()}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="" />
              ) : (
                <Camera size={32} />
              )}
              <input
                ref={authFileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarSelect}
              />
            </button>
            <h1 className="mobile-auth-info-title">{t('yourInfo', settings.language)}</h1>
            <p className="mobile-auth-info-subtitle">{t('enterNameAndPhoto', settings.language)}</p>
            <form
              className="mobile-auth-info-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (!authForm.firstName.trim()) return
                api('/auth/register', {
                  method: 'POST',
                  body: JSON.stringify({
                    name: authForm.firstName,
                    surname: authForm.lastName,
                    email: authForm.email,
                    password: authForm.password,
                  })
                }).then(async (data) => {
                  if (avatarFile) {
                    const formData = new FormData()
                    formData.append('avatar', avatarFile)
                    await fetch('/api/upload/avatar', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${data.token}` },
                      body: formData,
                    }).catch(() => {})
                  }
                  localStorage.setItem('token', data.token)
                  setToken(data.token)
                  setUser(data.user)
                  setIsLoggedIn(true)
                  setEditProfile({ username: data.user.username || '', phone: data.user.phone || '', bio: data.user.bio || '' })
                }).catch(err => alert(err.message))
              }}
            >
              <div className="mobile-auth-field">
                <label className="mobile-auth-label">{t('firstName', settings.language)}</label>
                <input
                  className="mobile-auth-input"
                  placeholder={t('firstName', settings.language)}
                  value={authForm.firstName}
                  onChange={(e) => setAuthForm(f => ({ ...f, firstName: e.target.value }))}
                  required
                />
              </div>
              <div className="mobile-auth-field">
                <label className="mobile-auth-label">{t('lastName', settings.language)}</label>
                <input
                  className="mobile-auth-input"
                  placeholder={t('lastName', settings.language)}
                  value={authForm.lastName}
                  onChange={(e) => setAuthForm(f => ({ ...f, lastName: e.target.value }))}
                />
              </div>
              <button className="mobile-auth-submit" type="submit">{t('continue', settings.language)}</button>
            </form>
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

    const isLogin = authMode === 'login'
    const agreeText = t('byTappingAgree', settings.language).replace('{action}', isLogin ? t('continue', settings.language) : t('signUp', settings.language))

    if (authMode === 'welcome' && !authSheetClosing) {
      return (<>
        <div className="mobile-auth-page">
          <div className="mobile-auth-welcome">
            <div className="mobile-auth-welcome-logo">
              <AuthLogo size={72} />
            </div>
          </div>
          <div className="mobile-auth-welcome-actions">
            <button
              className="mobile-auth-btn mobile-auth-btn-primary"
              onClick={() => { resetAuth(); setAuthMode('register-email'); setAuthSheetClosing(false) }}
            >
              {t('signUp', settings.language)}
            </button>
            <button
              className="mobile-auth-btn mobile-auth-btn-outline"
              onClick={() => { resetAuth(); setAuthMode('login'); setAuthSheetClosing(false) }}
            >
              {t('logIn', settings.language)}
            </button>
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

    return (<>
      <div className="mobile-auth-page mobile-auth-sheet-page">
        <div className="mobile-auth-sheet-header">
          <AuthLogo size={48} />
        </div>
        <div
          ref={sheetRef}
          className={`mobile-auth-sheet${authSheetClosing ? ' closing' : ''}`}
        >
          <div
            className="mobile-auth-sheet-drag-handle"
            onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
            onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
            onTouchEnd={handleDragEnd}
          />
          <button
            className="mobile-auth-sheet-close"
            onClick={() => {
              if (authSheetClosing) return
              closeSheet()
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <form
            className="mobile-auth-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (isLogin) {
                api('/auth/login', {
                  method: 'POST',
                  body: JSON.stringify({ email: authForm.email, password: authForm.password })
                }).then(data => {
                  localStorage.setItem('token', data.token)
                  setToken(data.token)
                  setUser(data.user)
                  setIsLoggedIn(true)
                  setEditProfile({ username: data.user.username || '', phone: data.user.phone || '', bio: data.user.bio || '' })
                }).catch(err => alert(err.message))
              } else {
                setAuthMode('register-info')
              }
            }}
          >
            <div className="mobile-auth-field">
              <label className="mobile-auth-label">{t('email', settings.language)}</label>
              <input
                className="mobile-auth-input"
                type="email"
                placeholder="example@email.com"
                value={authForm.email}
                onChange={(e) => setAuthForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="mobile-auth-field">
              <label className="mobile-auth-label">{t('password', settings.language)}</label>
              <input
                className="mobile-auth-input"
                type="password"
                placeholder="••••••••••••••"
                value={authForm.password}
                onChange={(e) => setAuthForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            <p className="mobile-auth-terms">
              {agreeText}{' '}
              <button type="button" className="mobile-auth-terms-link" onClick={() => setPageStack(prev => [...prev, 'offer'])}>{t('terms', settings.language)}</button>{' '}
              {t('and', settings.language)}{' '}
              <button type="button" className="mobile-auth-terms-link" onClick={() => setPageStack(prev => [...prev, 'contacts'])}>{t('privacyPolicy', settings.language)}</button>.
            </p>
            <button className="mobile-auth-submit" type="submit">
              {isLogin ? t('continue', settings.language) : t('signUp', settings.language)}
            </button>
          </form>
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

  const isInChat = proOpen || (tab === 'chats' && (chatView === 'thread' || chatView === 'contact'))

  return (
    <div className="mobile-app">
      <div className={`mobile-content${isInChat ? ' no-tabbar' : ''}`}>
        {/* ===== CHATS TAB ===== */}
        {tab === 'chats' && (chatView === 'list' || closingThread) && (
          <div className="mobile-chats">
            <div className="mobile-chats-header">
              <h1 className="mobile-chats-title" onClick={handleRefresh}><span className="mobile-chats-title-text">Surf</span></h1>
              <button className="mobile-header-btn" onClick={toggleSearch}>
                <Search size={22} />
              </button>
            </div>

            {(searchOpen || closingSearch) && (
              <div className={`mobile-search-bar${closingSearch ? ' closing' : ''}`}>
                <div className="mobile-search-input-wrapper">
                  <Search size={18} className="mobile-search-icon" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="mobile-search-input"
                    placeholder={t('searchUsers', settings.language)}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button className="mobile-search-clear" onClick={() => setSearchQuery('')}>
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {(searchOpen || closingSearch) ? (
              <div className="mobile-search-results">
                {searchResults.length > 0 ? (
                  searchResults.map(u => (
                    <div key={u.id} className="mobile-chat-item" onClick={() => {
                      api('/chats', { method: 'POST', body: JSON.stringify({ name: `${u.name} ${u.surname}`, participantId: u.id }) }).then(newChat => {
                        setChats(prev => [newChat, ...prev])
                        setSearchOpen(false); setClosingSearch(false)
                        handleOpenChat(newChat.id)
                      }).catch(err => alert(err.message))
                    }}>
                      <div className="mobile-chat-avatar"><User size={20} strokeWidth={1.5} /></div>
                      <div className="mobile-chat-info">
                        <div className="mobile-chat-name">{u.name} {u.surname}</div>
                        <div className="mobile-chat-preview">{u.email}</div>
                      </div>
                    </div>
                  ))
                ) : searchQuery.trim() ? (
                  <div className="mobile-search-empty">{t('noUsersFound', settings.language)}</div>
                ) : (
                  <div className="mobile-search-hint">{t('typeToSearch', settings.language)}</div>
                )}
              </div>
            ) : (
              <>
                {folders.length > 0 && (
                  <div className="mobile-folder-bar">
                    <button className={`mobile-folder-pill ${activeFolderId === null ? 'active' : ''}`} onClick={() => setActiveFolderId(null)}>{t('all', settings.language)}</button>
                    {folders.map(folder => (
                      <button key={folder.id} className={`mobile-folder-pill ${activeFolderId === folder.id ? 'active' : ''}`}
                        onClick={() => setActiveFolderId(folder.id)}
                        onTouchStart={() => {
                          folderLongPressTimer.current = setTimeout(() => handleFolderLongPress(folder.id), 500)
                        }}
                        onTouchEnd={() => {
                          if (folderLongPressTimer.current) { clearTimeout(folderLongPressTimer.current); folderLongPressTimer.current = null }
                        }}
                        onTouchMove={() => {
                          if (folderLongPressTimer.current) { clearTimeout(folderLongPressTimer.current); folderLongPressTimer.current = null }
                        }}
                        onContextMenu={(e) => { e.preventDefault(); handleFolderLongPress(folder.id) }}
                      >
                        {folder.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mobile-chat-list">
                  {(() => {
                    const displayChats = (activeFolderId
                      ? chats.filter(c => folders.find(f => f.id === activeFolderId)?.chats.includes(c.id))
                      : chats
                    ).filter(c => c.name !== 'Opus')
                    if (displayChats.length === 0) {
                      return (
                        <div className="mobile-chats-empty">
                          <div className="mobile-chats-empty-text">{t('noChats', settings.language)}</div>
                        </div>
                      )
                    }
                    return displayChats.map(chat => {
                      const draftPreview = getChatDraftPreview(chatInputTexts[chat.id])
                      return (
                      <div key={chat.id} className="mobile-chat-item"
                        onClick={() => handleOpenChat(chat.id)}
                        onTouchStart={() => {
                          chatLongPressTimer.current = setTimeout(() => handleChatLongPress(chat.id), 500)
                        }}
                        onTouchEnd={() => {
                          if (chatLongPressTimer.current) { clearTimeout(chatLongPressTimer.current); chatLongPressTimer.current = null }
                        }}
                        onTouchMove={() => {
                          if (chatLongPressTimer.current) { clearTimeout(chatLongPressTimer.current); chatLongPressTimer.current = null }
                        }}
                        onContextMenu={(e) => { e.preventDefault(); handleChatLongPress(chat.id) }}
                      >
                        <div className="mobile-chat-avatar"><User size={20} strokeWidth={1.5} /></div>
                        <div className="mobile-chat-info">
                          <div className="mobile-chat-name">{chat.name}</div>
                          {settings.previews === 'On' && (
                            <div className={`mobile-chat-preview${draftPreview ? ' is-draft' : ''}`}>{draftPreview || chat.lastMessage}</div>
                          )}
                        </div>
                        <div className="mobile-chat-time">{chat.time}</div>
                        {chat.pinned && <div className="mobile-chat-pin" />}
                      </div>
                      )
                    })
                  })()}
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== CHAT THREAD ===== */}
        {tab === 'chats' && activeChat && (chatView === 'thread' || closingContact) && (
          <div className={`mobile-chat-thread${closingThread ? ' closing' : ''}`}>
            <div className="mobile-thread-header">
              <button className="mobile-thread-back" onClick={handleCloseChat}>
                <ChevronLeft size={24} />
              </button>
              <div className="mobile-thread-header-info" onClick={() => setChatView('contact')}>
                <div className="mobile-thread-avatar">
                  <User size={18} strokeWidth={1.5} />
                  <span className="mobile-online-dot" />
                </div>
                <div className="mobile-thread-name">{activeChat.name}</div>
              </div>
              <div className="mobile-thread-actions">
                <button className="mobile-thread-action" title={t('more', settings.language)} onClick={(e) => {
                  e.stopPropagation()
                  if (threadMenu) { setThreadMenu(null); setClearChatSubmenu(false); return }
                  const rect = e.currentTarget.getBoundingClientRect()
                  setThreadMenu({ x: rect.right, y: rect.bottom + 8 })
                }}><MoreVertical size={20} /></button>
              </div>
            </div>

            {threadMenu && (
              <div className="context-menu" style={{ right: window.innerWidth - threadMenu.x, top: threadMenu.y, position: 'fixed', zIndex: 1000 }} onClick={(e) => e.stopPropagation()}>
                {!clearChatSubmenu ? (
                  <button className="context-menu-item" onClick={() => setClearChatSubmenu(true)}><Trash2 size={14} /><span>Clear chat</span></button>
                ) : (
                  <>
                    <button className="context-menu-item" onClick={() => { if (activeChatId) clearChat(activeChatId, false); setClearChatSubmenu(false) }}><User size={14} /><span>Clear for me</span></button>
                    <button className="context-menu-item" onClick={() => { if (activeChatId) clearChat(activeChatId, true); setClearChatSubmenu(false) }}><Users size={14} /><span>Clear for everyone</span></button>
                  </>
                )}
              </div>
            )}

            <div className="mobile-thread-messages" onContextMenu={(e) => e.preventDefault()}>
              {messages.map((msg, index) => {
                const showDateDivider = getMessageDayKey(msg.createdAt) !== getMessageDayKey(messages[index - 1]?.createdAt)
                return (
                <div key={msg.id}>
                  {showDateDivider && <div className="mobile-message-date-divider">{formatMessageDay(msg.createdAt)}</div>}
                  <div
                    id={`msg-${msg.id}`}
                    className={`mobile-msg-row ${msg.sender === 'me' ? 'sender-me' : 'sender-them'}`}
                    onClick={() => {
                      if (contextMenu) setContextMenu(null)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setContextMenu({ messageId: msg.id })
                    }}
                  >
                    <div className="mobile-msg-bubble">
                      {msg.replyToId && (msg.replyText || msg.replyAttachmentUrl) && (
                        <div className="mobile-msg-reply" onClick={() => { const el = document.getElementById(`msg-${msg.replyToId}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                          <div className="mobile-msg-reply-line" />
                          <div className="mobile-msg-reply-text">{msg.replyAttachmentUrl && !msg.replyText ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{msg.replyAttachmentType === 'image' ? <><Image size={14} /> Photo</> : <><File size={14} /> File</>}</span> : msg.replyText}</div>
                        </div>
                      )}
                      {msg.attachmentUrl && (
                        <div className="mobile-msg-attachment">
                          {msg.attachmentType === 'image' ? (
                            <img src={`http://localhost:3001${msg.attachmentUrl}`} alt="" className="mobile-msg-attachment-image" onClick={() => setFullscreenImage(`http://localhost:3001${msg.attachmentUrl}`)} />
                          ) : (
                            <a href={`http://localhost:3001${msg.attachmentUrl}`} target="_blank" rel="noopener noreferrer" className="mobile-msg-attachment-file"><File size={16} /><span>{msg.attachmentType || 'File'}</span></a>
                          )}
                        </div>
                      )}
                      {msg.pollId && (
                        <div className="message-poll" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            loadPoll(msg.pollId!)
                            const poll = pollsCache[msg.pollId!]
                            if (!poll) return <div className="message-poll-loading">Loading poll...</div>
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
                                <div className="message-poll-footer">{poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}</div>
                              </>
                            )
                          })()}
                        </div>
                      )}
                      <div className="mobile-msg-text">{renderMessageText(msg.text)}</div>
                      <div className="mobile-msg-meta">
                        <span className="mobile-msg-time">{msg.time}</span>
                        {msg.sender === 'me' && <MessageStatusIcon status={msg.status} />}
                      </div>
                    </div>
                  </div>
                </div>
                )
              })}
              {isPeerTyping && (
                <div className="mobile-msg-row sender-them">
                  <div className="mobile-msg-bubble mobile-ai-typing typing-indicator-bubble">
                    <span className="ai-thinking">typing...</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mobile-thread-input">
              {replyTo && (
                <div className="mobile-reply-bar">
                  <div className="mobile-reply-line" />
                  <div className="mobile-reply-info">
                    <div className="mobile-reply-label">{t('reply', settings.language)}</div>
                    <div className="mobile-reply-text">{replyTo.attachmentUrl && !replyTo.text ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{replyTo.attachmentType === 'image' ? <><Image size={14} /> Photo</> : <><File size={14} /> File</>}</span> : replyTo.text}</div>
                  </div>
                  <button className="mobile-reply-close" onClick={() => setReplyTo(null)}>
                    <X size={16} />
                  </button>
                </div>
              )}
              {mentionMenu?.chatId === activeChat.id && (
                <div className="mobile-mention-menu">
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
                        className="mobile-mention-item"
                        onClick={() => insertMention(activeChat.id, c.username || `${c.name}${c.surname ? ' ' + c.surname : ''}`)}
                      >
                        <div className="mobile-mention-avatar"><User size={16} strokeWidth={1.5} /></div>
                        <div className="mobile-mention-info">
                          <div className="mobile-mention-name">{c.name} {c.surname}</div>
                          {c.username && <div className="mobile-mention-username">@{c.username}</div>}
                        </div>
                      </button>
                    ))}
                </div>
              )}
              {pendingAttachments.length > 0 && (
                <div className={`mobile-pending-attachment${replyTo ? ' mobile-pending-attachment-noround' : ''}`}>
                  {pendingAttachments.map((att, idx) => (
                    <div key={idx} className="mobile-pending-attachment-item">
                      {att.type === 'image' ? (
                        <img src={`http://localhost:3001${att.url}`} alt="" className="mobile-pending-attachment-thumb" />
                      ) : (
                        <div className="mobile-pending-attachment-file-icon"><File size={16} /></div>
                      )}
                      <div className="mobile-pending-attachment-info">
                        <span className="mobile-pending-attachment-name">{att.name}</span>
                        <span className="mobile-pending-attachment-hint">{att.type === 'image' ? 'Photo' : 'Document'}</span>
                      </div>
                      <button className="mobile-pending-attachment-remove" onClick={() => setPendingAttachments(prev => prev.filter((_, i) => i !== idx))}><X size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className={`mobile-input-wrapper${replyTo ? ' has-reply' : ''}${pendingAttachments.length > 0 ? ' has-attachment' : ''}`}>
                <button className="mobile-input-attach" onClick={() => setAttachMenu(true)}>
                  <Plus size={22} />
                </button>
                <input
                  ref={el => void (chatInputRefs.current[activeChat.id] = el)}
                  type="text"
                  className="mobile-input"
                  placeholder={t('writeMessage', settings.language)}
                  value={chatInputTexts[activeChat.id] || ''}
                  onChange={(e) => handleChatInputChange(activeChat.id, e.target.value)}
                  onPaste={handleChatPaste}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(activeChat.id) }}
                />
                <button
                  className={`mobile-send-btn${((chatInputTexts[activeChat.id] || '').trim() || pendingAttachments.length > 0) ? ' active' : ''}`}
                  onClick={() => handleSendMessage(activeChat.id)}
                >
                  <ArrowUp size={20} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== CONTACT PROFILE (within chats tab) ===== */}
        {tab === 'chats' && chatView === 'contact' && (
          <div className={`mobile-contact-profile${closingContact ? ' closing' : ''}`}>
            <div className="mobile-thread-header">
              <button className="mobile-thread-back" onClick={handleCloseContact}>
                <ChevronLeft size={24} />
              </button>
              <div className="mobile-thread-name" style={{ flex: 1, textAlign: 'center' }}>{t('contact', settings.language)}</div>
              <div style={{ width: 44 }} />
            </div>
            <div className="mobile-profile-top">
              <div className="mobile-profile-avatar" style={(viewedUser || contactProfile)?.avatar ? { backgroundImage: `url(${(viewedUser || contactProfile)?.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                {!(viewedUser || contactProfile)?.avatar && <User size={40} strokeWidth={1.5} />}
              </div>
              <div className="mobile-profile-name">{(viewedUser || contactProfile) ? `${(viewedUser || contactProfile)!.name} ${(viewedUser || contactProfile)!.surname}` : activeChat?.name || ''}</div>
              {(viewedUser || contactProfile)?.bio && <div className="mobile-profile-bio">{(viewedUser || contactProfile)?.bio}</div>}
            </div>
            {(viewedUser || contactProfile) && (
              <div className="mobile-profile-section" style={{ paddingTop: 8 }}>
                <div className="mobile-profile-card">
                  <div className="mobile-profile-row"><span className="mobile-profile-label">{t('email', settings.language)}</span><span className="mobile-profile-value click-to-copy" onClick={() => (viewedUser || contactProfile)?.email && copyField(t('email', settings.language), (viewedUser || contactProfile)!.email!)}>{(viewedUser || contactProfile)?.email || '—'}</span></div>
                  {(viewedUser || contactProfile)?.phone && <div className="mobile-profile-row"><span className="mobile-profile-label">{t('phone', settings.language)}</span><span className="mobile-profile-value click-to-copy" onClick={() => copyField(t('phone', settings.language), (viewedUser || contactProfile)!.phone!)}>{(viewedUser || contactProfile)?.phone}</span></div>}
                  {(viewedUser || contactProfile)?.username && <div className="mobile-profile-row"><span className="mobile-profile-label">{t('username', settings.language)}</span><span className="mobile-profile-value click-to-copy" onClick={() => copyField(t('username', settings.language), (viewedUser || contactProfile)!.username!)}>@{(viewedUser || contactProfile)?.username}</span></div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== OPUS TAB ===== */}
        {tab === 'opus' && (
          <div className={`mobile-opus${aiConversation.length > 0 ? ' has-messages' : ''}${firstOpusEntry && aiConversation.length === 0 ? ' mobile-opus-entry' : ''}`}>
            <div className="mobile-opus-welcome" style={{ opacity: aiConversation.length > 0 ? 0 : 1, pointerEvents: aiConversation.length > 0 ? 'none' : 'auto' }}>
              <h1 className="mobile-opus-header">{t('letsTextSomeone', settings.language)}</h1>
              <div className="mobile-opus-input-wrapper">
                <input
                  type="text"
                  className="mobile-opus-input"
                  placeholder={t('askOpus', settings.language)}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAiSend() }}
                />
                <button className={`mobile-send-btn${inputText.trim() ? ' active' : ''}`} onClick={handleAiSend}>
                  <ArrowUp size={20} />
                </button>
              </div>
            </div>
            <div className="mobile-thread-messages" ref={aiMessagesRef} style={{ opacity: aiConversation.length > 0 ? 1 : 0, pointerEvents: aiConversation.length > 0 ? 'auto' : 'none' }}>
              {aiConversation.map((msg, i) => (
                <div key={i} className={`mobile-msg-row ${msg.role === 'user' ? 'sender-me' : 'sender-them'}`}>
                  <div className="mobile-msg-bubble">
                    <div className="mobile-msg-text">{renderMessageText(msg.text)}</div>
                    {msg.time && <div className="mobile-msg-time">{msg.time}</div>}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="mobile-msg-row sender-them">
                  <div className="mobile-msg-bubble mobile-ai-typing">
                    <span className="ai-thinking">thinking...</span>
                  </div>
                </div>
              )}
            </div>
            <div className="mobile-opus-bottom-input" style={{ opacity: aiConversation.length > 0 ? 1 : 0, pointerEvents: aiConversation.length > 0 ? 'auto' : 'none' }}>
              <div className="mobile-thread-input">
                <div className="mobile-opus-input-wrapper">
                  <input
                    type="text"
                    className="mobile-opus-input"
                    placeholder={t('askOpus', settings.language)}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAiSend() }}
                  />
                  <button className={`mobile-send-btn${inputText.trim() ? ' active' : ''}`} onClick={handleAiSend}>
                    <ArrowUp size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== PROFILE TAB ===== */}
        {tab === 'profile' && profileView === 'profile' && (
          <div className="mobile-profile">
            <div className="mobile-profile-header-bg" />
            <div className="mobile-profile-hero">
              <div className="mobile-profile-avatar-wrap" ref={profileAvatarRef}>
                <div className="mobile-profile-avatar-ring">
                  <div
                    className="mobile-profile-avatar-inner"
                    style={user?.avatar ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer' } : {}}
                    onClick={openAvatarAnim}
                  >
                    {!user?.avatar && <User size={44} strokeWidth={1.5} />}
                  </div>
                </div>
                <div className="mobile-profile-status-dot online" />
              </div>
              <h1 className="mobile-profile-hero-name">{user?.name || 'User'} {user?.surname || ''}</h1>
              {user?.username && <p className="mobile-profile-hero-handle">@{user.username}</p>}
              {user?.bio && <p className="mobile-profile-hero-bio">{user.bio}</p>}
            </div>

            <div className="mobile-profile-actions">
              <button className="mobile-profile-action-btn primary" onClick={() => setProfileView('edit')}>
                <Pencil size={16} /> {t('editProfile', settings.language)}
              </button>
              <button className="mobile-profile-action-btn icon-only" onClick={() => setProfileView('settings')}>
                <Settings size={18} />
              </button>
            </div>

            <div className="mobile-profile-section">
              {proStatus?.active ? (
                <button className="mobile-pro-card mobile-pro-card-active" onClick={handleOpenPro}>
                  <div className="mobile-pro-card-content">
                    <span className="mobile-pro-card-title">
                      <CheckCircle size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                      {t('proActive', settings.language)}
                    </span>
                    {proStatus.end_date && (
                      <span className="mobile-pro-card-subtitle">
                        {t('proExpires', settings.language)}: {new Date(proStatus.end_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <ChevronRight size={18} className="mobile-pro-card-chevron" />
                </button>
              ) : (
                <button className="mobile-pro-card" onClick={handleOpenPro}>
                  <div className="mobile-pro-card-content">
                    <span className="mobile-pro-card-title">{t('upgradeToPro', settings.language)}</span>
                    <span className="mobile-pro-card-subtitle">{t('unlockPremiumFeatures', settings.language)}</span>
                  </div>
                  <ChevronRight size={18} className="mobile-pro-card-chevron" />
                </button>
              )}
            </div>

          </div>
        )}

        {/* ===== EDIT PROFILE ===== */}
        {tab === 'profile' && profileView === 'edit' && (
          <div className="mobile-edit-profile">
            <div className="mobile-edit-header">
              <button className="mobile-edit-back" onClick={() => setProfileView('profile')}>
                <ChevronLeft size={24} />
              </button>
              <div className="mobile-edit-title">{t('editProfile', settings.language)}</div>
              <button className={`mobile-edit-save${!hasEditChanges ? ' disabled' : ''}`} disabled={!hasEditChanges} onClick={() => {
                api('/users/me', { method: 'PUT', body: JSON.stringify(editProfile) }).then(() => {
                  setUser(prev => prev ? { ...prev, ...editProfile } : prev)
                  setProfileView('profile')
                }).catch(err => alert(err.message))
              }}><Check size={22} /></button>
            </div>
            <div className="mobile-edit-body">
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
              <div className="mobile-edit-avatar-section">
                <div className="mobile-edit-avatar" style={user?.avatar ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                  {!user?.avatar && <User size={36} strokeWidth={1.5} />}
                  <button className="mobile-edit-avatar-btn" onClick={() => avatarFileRef.current?.click()}>
                    <Camera size={14} />
                  </button>
                </div>
              </div>
              <div className="mobile-edit-field">
                <label className="mobile-edit-label">{t('username', settings.language)}</label>
                <input className="mobile-edit-input" value={editProfile.username}
                  onChange={(e) => setEditProfile(p => ({ ...p, username: e.target.value }))} placeholder={t('username', settings.language)} />
              </div>
              <div className="mobile-edit-field">
                <label className="mobile-edit-label">{t('phone', settings.language)}</label>
                <input className="mobile-edit-input" value={editProfile.phone}
                  onChange={(e) => setEditProfile(p => ({ ...p, phone: e.target.value }))} placeholder={t('phone', settings.language)} />
              </div>
              <div className="mobile-edit-field">
                <label className="mobile-edit-label">{t('bio', settings.language)}</label>
                <textarea className="mobile-edit-textarea" rows={3} placeholder={t('bio', settings.language)}
                  value={editProfile.bio} onChange={(e) => setEditProfile(p => ({ ...p, bio: e.target.value }))} />
              </div>
            </div>
          </div>
        )}

        {/* ===== SETTINGS ===== */}
        {tab === 'profile' && profileView === 'settings' && (
          <div className="mobile-settings">
            <div className="mobile-edit-header">
              <button className="mobile-edit-back" onClick={() => setProfileView('profile')}>
                <ChevronLeft size={24} />
              </button>
              <div className="mobile-edit-title">{t('settings', settings.language)}</div>
            </div>
            <div className="mobile-settings-scroll">
              <div className="mobile-settings-group">
                <h3 className="mobile-settings-group-title">{t('general', settings.language)}</h3>
                <div className="mobile-settings-card">
                  <div className="mobile-settings-row clickable" onClick={() => setOptionPicker('language')}>
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#3287FE' }}>
                      <Globe size={18} />
                    </div>
                    <span className="mobile-settings-label">{t('language', settings.language)}</span>
                    <span className="mobile-settings-value">{langName(settings.language)}</span>
                    <ChevronRight size={16} className="mobile-settings-chevron" />
                  </div>
                </div>
              </div>

              <div className="mobile-settings-group">
                <h3 className="mobile-settings-group-title">{t('notifications', settings.language)}</h3>
                <div className="mobile-settings-card">
                  <div className="mobile-settings-row">
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#13B962' }}>
                      <Eye size={18} />
                    </div>
                    <span className="mobile-settings-label">{t('messagePreviews', settings.language)}</span>
                    <ToggleSwitch checked={settings.previews === 'On'} onChange={() => cycleSetting('previews', ['On', 'Off'])} />
                  </div>
                  <div className="mobile-settings-row">
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#F6BE11' }}>
                      <Volume2 size={18} />
                    </div>
                    <span className="mobile-settings-label">{t('sounds', settings.language)}</span>
                    <ToggleSwitch checked={settings.sounds === 'On'} onChange={() => cycleSetting('sounds', ['On', 'Off'])} />
                  </div>
                </div>
              </div>

              <div className="mobile-settings-group">
                <h3 className="mobile-settings-group-title">{t('account', settings.language)}</h3>
                <div className="mobile-settings-card">
                  <div className="mobile-settings-row">
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#3287FE' }}>
                      <User size={18} />
                    </div>
                    <span className="mobile-settings-label">{t('name', settings.language)}</span>
                    <span className="mobile-settings-value">{user?.name || ''}</span>
                  </div>
                  <div className="mobile-settings-row">
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#FA4442' }}>
                      <Mail size={18} />
                    </div>
                    <span className="mobile-settings-label">{t('email', settings.language)}</span>
                    <span className="mobile-settings-value">{user?.email || ''}</span>
                  </div>
                </div>
              </div>

              <div className="mobile-settings-group">
                <h3 className="mobile-settings-group-title">{t('privacy', settings.language)}</h3>
                <div className="mobile-settings-card">
                  <div className="mobile-settings-row clickable" onClick={() => setOptionPicker('lastSeen')}>
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#13B962' }}>
                      <Clock size={18} />
                    </div>
                    <span className="mobile-settings-label">{t('lastSeen', settings.language)}</span>
                    <span className="mobile-settings-value">{p(settings.lastSeen, settings.language)}</span>
                    <ChevronRight size={16} className="mobile-settings-chevron" />
                  </div>
                  <div className="mobile-settings-row clickable" onClick={() => setOptionPicker('profilePhoto')}>
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#3287FE' }}>
                      <Image size={18} />
                    </div>
                    <span className="mobile-settings-label">{t('profilePhoto', settings.language)}</span>
                    <span className="mobile-settings-value">{p(settings.profilePhoto, settings.language)}</span>
                    <ChevronRight size={16} className="mobile-settings-chevron" />
                  </div>
                  <div className="mobile-settings-row clickable" onClick={() => setOptionPicker('phonePrivacy')}>
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#F6BE11' }}>
                      <Phone size={18} />
                    </div>
                    <span className="mobile-settings-label">{t('phone', settings.language)}</span>
                    <span className="mobile-settings-value">{p(settings.phonePrivacy, settings.language)}</span>
                    <ChevronRight size={16} className="mobile-settings-chevron" />
                  </div>
                  <div className="mobile-settings-row clickable" onClick={() => setOptionPicker('emailPrivacy')}>
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#FA4442' }}>
                      <AtSign size={18} />
                    </div>
                    <span className="mobile-settings-label">{t('email', settings.language)}</span>
                    <span className="mobile-settings-value">{p(settings.emailPrivacy, settings.language)}</span>
                    <ChevronRight size={16} className="mobile-settings-chevron" />
                  </div>
                  <div className="mobile-settings-row clickable" onClick={() => setOptionPicker('bioPrivacy')}>
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#8c8c88' }}>
                      <AlignLeft size={18} />
                    </div>
                    <span className="mobile-settings-label">{t('bio', settings.language)}</span>
                    <span className="mobile-settings-value">{p(settings.bioPrivacy, settings.language)}</span>
                    <ChevronRight size={16} className="mobile-settings-chevron" />
                  </div>
                </div>
              </div>

              <div className="mobile-settings-logout-wrap">
                <button className="mobile-settings-logout" onClick={handleLogout}>
                  <LogOut size={18} />
                  <span>{t('logOut', settings.language)}</span>
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ===== BOTTOM TAB BAR ===== */}
      <div
        className={`mobile-tab-bar${isInChat ? ' hidden' : ''}`}
        ref={tabBarRef}
        onTouchStart={handleTabTouchStart}
        onTouchMove={handleTabTouchMove}
        onTouchEnd={handleTabTouchEnd}
        onTouchCancel={() => { touchDrag.current = null; updateIndicator(tab) }}
      >
        <div className="mobile-tab-indicator" style={{ left: tabIndicator.left, width: tabIndicator.width }} />
        <button
          ref={el => void (tabRefs.current['chats'] = el)}
          className={`mobile-tab ${tab === 'chats' ? 'active' : ''}`}
          onClick={() => {
            if (tabLongPressed.current) {
              tabLongPressed.current = false
              return
            }
            setTab('chats')
          }}
          onTouchStart={() => {
            tabLongPressTimer.current = setTimeout(() => {
              tabLongPressTimer.current = null
              handleTabLongPress('chats')
            }, 500)
          }}
          onTouchEnd={() => {
            if (tabLongPressTimer.current) {
              clearTimeout(tabLongPressTimer.current)
              tabLongPressTimer.current = null
            }
          }}
          onTouchMove={() => {
            if (tabLongPressTimer.current) {
              clearTimeout(tabLongPressTimer.current)
              tabLongPressTimer.current = null
            }
          }}
          onContextMenu={(e) => { e.preventDefault(); handleTabLongPress('chats') }}
        >
          <span className="mobile-tab-icon"><MessageSquare size={20} /></span>
        </button>
        <button
          ref={el => void (tabRefs.current['opus'] = el)}
          className={`mobile-tab ${tab === 'opus' ? 'active' : ''}`}
          onClick={() => {
            if (tabLongPressed.current) {
              tabLongPressed.current = false
              return
            }
            setTab('opus')
          }}
          onTouchStart={() => {
            tabLongPressTimer.current = setTimeout(() => {
              tabLongPressTimer.current = null
              handleTabLongPress('opus')
            }, 500)
          }}
          onTouchEnd={() => {
            if (tabLongPressTimer.current) {
              clearTimeout(tabLongPressTimer.current)
              tabLongPressTimer.current = null
            }
          }}
          onTouchMove={() => {
            if (tabLongPressTimer.current) {
              clearTimeout(tabLongPressTimer.current)
              tabLongPressTimer.current = null
            }
          }}
          onContextMenu={(e) => { e.preventDefault(); handleTabLongPress('opus') }}
        >
          <span className="mobile-tab-icon">
            <svg width="20" height="18" viewBox="0 0 112 96" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M0 82.924L29.2752 51.1712L29.4062 44.9901L0 13.095H33.378V-1.37723e-06H81.5227V13.0548H111.244L83.1678 44.9901L83.6308 51.1712L111.585 82.888H81.5227V95.9834H33.378V82.924H0ZM39.4876 55.8309V89.8024H75.413V82.8958H64.0808L39.4876 55.8309ZM66.7917 76.7073H97.9518L75.4452 51.1712H43.582L66.7917 76.7073ZM75.1475 44.8123H43.552L66.7631 19.2687H81.5227V19.2359H97.6336L75.1475 44.8123ZM75.413 13.0548V6.18105H39.4876V39.8994L63.8262 13.0548H75.413ZM33.378 19.2761H14.0535L33.378 40.2364V19.2761ZM33.378 55.7829V76.743H14.0535L33.378 55.7829Z" fill="currentColor"/>
            </svg>
          </span>
        </button>
        <button
          ref={el => void (tabRefs.current['profile'] = el)}
          className={`mobile-tab ${tab === 'profile' ? 'active' : ''}`}
          onClick={() => {
            if (tabLongPressed.current) {
              tabLongPressed.current = false
              return
            }
            setTab('profile')
            setProfileView('profile')
          }}
          onTouchStart={() => {
            tabLongPressTimer.current = setTimeout(() => {
              tabLongPressTimer.current = null
              handleTabLongPress('profile')
            }, 500)
          }}
          onTouchEnd={() => {
            if (tabLongPressTimer.current) {
              clearTimeout(tabLongPressTimer.current)
              tabLongPressTimer.current = null
            }
          }}
          onTouchMove={() => {
            if (tabLongPressTimer.current) {
              clearTimeout(tabLongPressTimer.current)
              tabLongPressTimer.current = null
            }
          }}
          onContextMenu={(e) => { e.preventDefault(); handleTabLongPress('profile') }}
        >
          <span className="mobile-tab-icon"><User size={20} /></span>
        </button>
      </div>

      <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => {
        closeSheetImmediate()
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

      {/* ===== BOTTOM SHEET: Attach Menu ===== */}
      {(attachMenu || closingSheet === 'attach') && (
        <div className={`mobile-sheet-overlay${closingSheet === 'attach' ? ' closing' : ''}`} onClick={() => closeSheet('attach')}>
          <div className={`mobile-sheet${closingSheet === 'attach' ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            <button className="mobile-sheet-item" onClick={() => { fileInputRef.current?.click(); }}>
              <Image size={18} /><span>{t('photoOrVideo', settings.language)}</span>
            </button>
            <button className="mobile-sheet-item" onClick={() => { fileInputRef.current?.click(); }}>
              <File size={18} /><span>{t('document', settings.language)}</span>
            </button>
            <button className="mobile-sheet-item" onClick={() => { closeSheetImmediate(); setPollModalOpen(true) }}>
              <BarChart3 size={18} /><span>Poll</span>
            </button>
          </div>
        </div>
      )}

      {/* ===== BOTTOM SHEET: Context Menu ===== */}
      {(contextMenu || closingSheet === 'context') && (
        <div className={`mobile-sheet-overlay${closingSheet === 'context' ? ' closing' : ''}`} onClick={() => closeSheet('context')}>
          <div className={`mobile-sheet${closingSheet === 'context' ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            <button className="mobile-sheet-item" onClick={() => {
              if (contextMenu) {
                const msg = messages.find(m => m.id === contextMenu.messageId)
                if (msg) setReplyTo({ messageId: msg.id, text: msg.text, attachmentUrl: msg.attachmentUrl, attachmentType: msg.attachmentType })
              }
              closeSheetImmediate()
            }}>
              <Reply size={18} /><span>{t('reply', settings.language)}</span>
            </button>
            <button className="mobile-sheet-item" onClick={() => { copyMessage(); closeSheetImmediate() }}>
              <Copy size={18} /><span>{t('copy', settings.language)}</span>
            </button>
            <button className="mobile-sheet-item mobile-sheet-item-danger" onClick={() => { deleteMessage(); closeSheetImmediate() }}>
              <Trash2 size={18} /><span>{t('delete', settings.language)}</span>
            </button>
          </div>
        </div>
      )}

      {/* ===== BOTTOM SHEET: Chat Actions ===== */}
      {(chatContextMenu || closingSheet === 'chat') && (
        <div className={`mobile-sheet-overlay${closingSheet === 'chat' ? ' closing' : ''}`} onClick={() => closeSheet('chat')}>
          <div className={`mobile-sheet${closingSheet === 'chat' ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            {chatContextMenu && (
              <>
                <button className="mobile-sheet-item" onClick={() => { togglePinChat(chatContextMenu.chatId); closeSheetImmediate() }}>
                  <Pin size={18} /><span>{chats.find(c => c.id === chatContextMenu.chatId)?.pinned ? t('unpin', settings.language) : t('pin', settings.language)}</span>
                </button>
                {folders.length > 0 && (
                  <button className="mobile-sheet-item" onClick={() => { setFolderSheet({ chatId: chatContextMenu.chatId }); setChatContextMenu(null); }}>
                    <Folder size={18} /><span>{t('folder', settings.language)}</span>
                  </button>
                )}
                <button className="mobile-sheet-item mobile-sheet-item-danger" onClick={() => { deleteChat(); closeSheetImmediate() }}>
                  <Trash2 size={18} /><span>{t('deleteChat', settings.language)}</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== BOTTOM SHEET: Folder Selector ===== */}
      {(folderSheet || closingSheet === 'folder') && (
        <div className={`mobile-sheet-overlay${closingSheet === 'folder' ? ' closing' : ''}`} onClick={() => closeSheet('folder')}>
          <div className={`mobile-sheet${closingSheet === 'folder' ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            {folders.map(folder => (
              <button key={folder.id} className="mobile-sheet-item" onClick={() => folderSheet && addChatToFolder(folderSheet.chatId, folder.id)}>
                <span>{folder.name}</span>
                {folderSheet && folder.chats.includes(folderSheet.chatId) && <span style={{ color: '#13B962' }}>✓</span>}
              </button>
            ))}

          </div>
        </div>
      )}

      {/* ===== BOTTOM SHEET: Folder Actions ===== */}
      {(folderContextMenu || closingSheet === 'folderAction') && (
        <div className={`mobile-sheet-overlay${closingSheet === 'folderAction' ? ' closing' : ''}`} onClick={() => closeSheet('folderAction')}>
          <div className={`mobile-sheet${closingSheet === 'folderAction' ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            {folderContextMenu && (
              <>
                <button className="mobile-sheet-item" onClick={() => { renameFolder(folderContextMenu.folderId); closeSheetImmediate() }}>
                  <Pencil size={18} /><span>{t('rename', settings.language)}</span>
                </button>
                <button className="mobile-sheet-item mobile-sheet-item-danger" onClick={() => { deleteFolder(folderContextMenu.folderId); closeSheetImmediate() }}>
                  <Trash2 size={18} /><span>{t('delete', settings.language)}</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== BOTTOM SHEET: Privacy Picker ===== */}
      {(optionPicker || closingSheet === 'picker') && (
        <div className={`mobile-sheet-overlay${closingSheet === 'picker' ? ' closing' : ''}`} onClick={() => closeSheet('picker')}>
          <div className={`mobile-sheet${closingSheet === 'picker' ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            {(optionPicker ? settingOptions[optionPicker] : []).map(option => (
              <button
                key={option}
                className={`mobile-sheet-item${optionPicker && (settings as any)[optionPicker] === option ? ' mobile-sheet-item-selected' : ''}`}
                onClick={() => { if (optionPicker) { selectSetting(optionPicker, option); closeSheetImmediate() } }}
                style={optionPicker && (settings as any)[optionPicker] === option ? { color: '#ffffff' } : {}}
              >
                <span style={{ flex: 1 }}>{p(option, settings.language)}</span>
                {optionPicker && (settings as any)[optionPicker] === option && <span style={{ color: '#ffffff' }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== BOTTOM SHEET: Folder Menu (from tab bar) ===== */}
      {(folderMenuSheet || closingSheet === 'folderMenu') && (
        <div className={`mobile-sheet-overlay${closingSheet === 'folderMenu' ? ' closing' : ''}`} onClick={() => closeSheet('folderMenu')}>
          <div className={`mobile-sheet${closingSheet === 'folderMenu' ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            <button className="mobile-sheet-item" onClick={() => { setTab('chats'); setActiveFolderId(null); closeSheetImmediate() }}>
              <span style={{ flex: 1 }}>{t('all', settings.language)}</span>
              {activeFolderId === null && <span style={{ color: '#13B962' }}>✓</span>}
            </button>
            {folders.map(folder => (
              <button key={folder.id} className="mobile-sheet-item" onClick={() => { setTab('chats'); setActiveFolderId(folder.id); closeSheetImmediate() }}>
                <span style={{ flex: 1 }}>{folder.name}</span>
                {activeFolderId === folder.id && <span style={{ color: '#13B962' }}>✓</span>}
              </button>
            ))}
            <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '8px 16px' }} />
            <button className="mobile-sheet-item" onClick={() => { setFolderEditOpen(true); closeSheetImmediate() }}>
              <Pencil size={18} /><span>{t('editFolders', settings.language)}</span>
            </button>
          </div>
        </div>
      )}

      {/* ===== BOTTOM SHEET: Opus Menu (from tab bar) ===== */}
      {(opusMenuSheet || closingSheet === 'opusMenu') && (
        <div className={`mobile-sheet-overlay${closingSheet === 'opusMenu' ? ' closing' : ''}`} onClick={() => closeSheet('opusMenu')}>
          <div className={`mobile-sheet${closingSheet === 'opusMenu' ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            <button className="mobile-sheet-item mobile-sheet-item-danger" onClick={() => handleClearOpusChat()}>
              <Trash2 size={18} /><span>{t('clearChat', settings.language)}</span>
            </button>
          </div>
        </div>
      )}

      {/* ===== FULLSCREEN: Folder Edit ===== */}
      {folderEditOpen && (
        <div className="mobile-folder-edit">
          <div className="mobile-edit-header">
            <button className="mobile-edit-back" onClick={() => setFolderEditOpen(false)}>
              <ChevronLeft size={24} />
            </button>
            <div className="mobile-edit-title">{t('editFolders', settings.language)}</div>
            <div />
          </div>
          <div className="mobile-folder-edit-body">
            {folders.length > 0 && (
              <div style={{ padding: '0 16px' }}>
                <div className="mobile-settings-card">
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      className="mobile-settings-row clickable"
                      onClick={() => {
                        setFolderManageView({ folderId: folder.id })
                        setFolderEditNames(prev => ({ ...prev, [folder.id]: folder.name }))
                      }}
                    >
                      <span className="mobile-settings-label">{folder.name}</span>
                      <span className="mobile-settings-value">{folder.chats.length} {t('chats', settings.language).toLowerCase()}</span>
                      <ChevronRight size={16} className="mobile-settings-chevron" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button className="mobile-folder-edit-create" onClick={() => {
              setFolderDialogInput('')
              setFolderDialog({ type: 'create' })
            }}>
              <Plus size={16} /> {t('newFolder', settings.language)}
            </button>
          </div>
        </div>
      )}

      {/* ===== FULLSCREEN: Folder Manage ===== */}
      {folderManageView && (() => {
        const folder = folders.find(f => f.id === folderManageView.folderId)
        if (!folder) return null
        return (
          <div className="mobile-folder-edit">
            <div className="mobile-edit-header">
              <button className="mobile-edit-back" onClick={() => setFolderManageView(null)}>
                <ChevronLeft size={24} />
              </button>
              <div className="mobile-edit-title">{folder.name}</div>
              <button className="mobile-edit-save icon-only" onClick={() => {
                const newName = folderEditNames[folder.id]?.trim()
                if (newName && newName !== folder.name) {
                  api(`/folders/${folder.id}`, { method: 'PUT', body: JSON.stringify({ name: newName }) }).then(() => {
                    setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, name: newName } : f))
                  }).catch(err => alert(err.message))
                }
                setFolderManageView(null)
              }}>
                <Check size={20} />
              </button>
            </div>
            <div className="mobile-folder-edit-body">
              <div className="mobile-edit-field" style={{ padding: '0 16px' }}>
                <label className="mobile-edit-label">{t('name', settings.language)}</label>
                <input
                  className="mobile-edit-input"
                  value={folderEditNames[folder.id] ?? folder.name}
                  onChange={(e) => setFolderEditNames(prev => ({ ...prev, [folder.id]: e.target.value }))}
                  placeholder={t('folderNamePrompt', settings.language)}
                />
              </div>

              <div className="mobile-settings-group" style={{ marginTop: 8 }}>
                <h3 className="mobile-settings-group-title">{t('chats', settings.language)}</h3>
                {folder.chats.length > 0 && (
                  <div className="mobile-settings-card">
                    {chats.filter(c => folder.chats.includes(c.id) && c.name !== 'Opus').map((chat) => (
                      <div key={chat.id} className="mobile-settings-row">
                        <span className="mobile-settings-label">{chat.name}</span>
                        <button
                          className="mobile-folder-edit-chat-remove"
                          onClick={() => toggleChatInFolder(folder.id, chat.id, false)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, padding: '0 16px', marginTop: 'auto', marginBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
                <button
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: '#ffffff',
                    color: '#0F0F0F',
                    border: 'none',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 15,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  onClick={() => setAddChatsSheet({ folderId: folder.id, selected: new Set() })}
                >
                  <Plus size={16} /> {t('addChat', settings.language)}
                </button>
                <button
                  className="mobile-logout-btn"
                  style={{ flex: 1, width: 'auto', margin: 0 }}
                  onClick={() => deleteFolder(folder.id)}
                >
                  <Trash2 size={16} /> {t('deleteFolder', settings.language)}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ===== BOTTOM SHEET: Add Chats to Folder ===== */}
      {(addChatsSheet || closingSheet === 'addChats') && (
        <div className={`mobile-sheet-overlay${closingSheet === 'addChats' ? ' closing' : ''}`} onClick={() => closeSheet('addChats')}>
          <div className={`mobile-sheet${closingSheet === 'addChats' ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            {(() => {
              const folder = folders.find(f => f.id === addChatsSheet?.folderId)
              if (!folder) return null
              const availableChats = chats.filter(c => !folder.chats.includes(c.id) && c.name !== 'Opus')
              if (availableChats.length === 0) return <div className="mobile-sheet-item" style={{ color: '#8c8c88' }}>{t('noChats', settings.language)}</div>
              return availableChats.map(chat => {
                const isSelected = addChatsSheet?.selected.has(chat.id)
                return (
                  <button
                    key={chat.id}
                    className={`mobile-sheet-item${isSelected ? ' mobile-sheet-item-selected' : ''}`}
                    onClick={() => {
                      setAddChatsSheet(prev => {
                        if (!prev) return prev
                        const next = new Set(prev.selected)
                        if (next.has(chat.id)) next.delete(chat.id)
                        else next.add(chat.id)
                        return { ...prev, selected: next }
                      })
                    }}
                  >
                    <span style={{ flex: 1 }}>{chat.name}</span>
                    {isSelected && <span style={{ color: '#13B962' }}>✓</span>}
                  </button>
                )
              })
            })()}
            <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '8px 16px' }} />
            <button
              className="mobile-sheet-item"
              style={{ justifyContent: 'center', fontWeight: 600, opacity: (addChatsSheet?.selected.size ?? 0) > 0 ? 1 : 0.4 }}
              onClick={() => {
                if (!addChatsSheet?.selected.size) return
                const { folderId, selected } = addChatsSheet
                Promise.all(Array.from(selected).map(chatId => api(`/folders/${folderId}/chats/${chatId}`, { method: 'POST' }))).then(() => {
                  setFolders(prev => prev.map(f => f.id === folderId ? { ...f, chats: [...f.chats, ...Array.from(selected)] } : f))
                  closeSheetImmediate()
                }).catch(err => alert(err.message))
              }}
            >
              {t('save', settings.language)}
            </button>
          </div>
        </div>
      )}

      {/* ===== Fullscreen Image ===== */}
      {fullscreenImage && (
        <div className="mobile-fullscreen-overlay" onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} className="mobile-fullscreen-img" alt="Fullscreen" />
        </div>
      )}

      {folderDialog && (
        <div className="dialog-overlay" onClick={() => setFolderDialog(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <div className="dialog-title">
                {folderDialog.type === 'rename' ? t('renameFolderPrompt', settings.language) :
                 folderDialog.type === 'delete' ? t('deleteFolderConfirm', settings.language) :
                 t('newFolder', settings.language)}
              </div>
              <button className="dialog-close" onClick={() => setFolderDialog(null)}>
                <X size={16} />
              </button>
            </div>
            {folderDialog.type === 'rename' || folderDialog.type === 'create' ? (
              <>
                <input
                  className="dialog-input"
                  value={folderDialogInput}
                  onChange={e => setFolderDialogInput(e.target.value)}
                  placeholder={t('folderNamePrompt', settings.language)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleFolderDialogConfirm() }}
                />
                <div className="dialog-actions">
                  <button className="dialog-btn dialog-btn-cancel" onClick={() => setFolderDialog(null)}>
                    {t('cancel', settings.language)}
                  </button>
                  <button className="dialog-btn dialog-btn-primary" onClick={handleFolderDialogConfirm}>
                    {folderDialog.type === 'rename' ? t('rename', settings.language) : t('create', settings.language)}
                  </button>
                </div>
              </>
            ) : (
              <div className="dialog-actions">
                <button className="dialog-btn dialog-btn-cancel" onClick={() => setFolderDialog(null)}>
                  {t('cancel', settings.language)}
                </button>
                <button className="dialog-btn dialog-btn-danger" onClick={handleFolderDialogConfirm}>
                  {t('delete', settings.language)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {pollModalOpen && (
        <div className="poll-modal-overlay" onClick={() => setPollModalOpen(false)}>
          <div className="poll-modal" onClick={e => e.stopPropagation()}>
            <div className="poll-modal-header">
              <h2 className="poll-modal-title">New Poll</h2>
              <button className="poll-modal-close" onClick={() => setPollModalOpen(false)}><X size={18} /></button>
            </div>
            <div className="poll-modal-body">
              <div className="poll-question-wrap">
                <label className="poll-label">Question</label>
                <input
                  className="poll-question-input"
                  placeholder="Ask something..."
                  value={pollQuestion}
                  onChange={e => setPollQuestion(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="poll-options-wrap">
                <label className="poll-label">Options</label>
                <div className="poll-options-list">
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="poll-option-row">
                      <span className="poll-option-badge">{String.fromCharCode(65 + idx)}</span>
                      <input
                        className="poll-option-input"
                        placeholder={`Option ${idx + 1}`}
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
                    <Plus size={16} /><span>Add option</span>
                  </button>
                )}
              </div>
            </div>
            <div className="poll-modal-footer">
              <button className="poll-btn poll-btn-secondary" onClick={() => setPollModalOpen(false)}>Cancel</button>
              <button
                className="poll-btn poll-btn-primary"
                disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                onClick={handleCreatePoll}
              >
                Create Poll
              </button>
            </div>
          </div>
        </div>
      )}

      {proOpen && (
        <div className="mobile-pro-page">
          <button className="mobile-pro-close" onClick={handleClosePro} aria-label={t('close', settings.language)}>
            <X size={20} />
          </button>
          <div className="mobile-pro-content">
            <h1 className="mobile-pro-title">
              {t('upgradeToProLine1', settings.language)}<br />{t('upgradeToProLine2', settings.language)}
            </h1>
            <p className="mobile-pro-subtitle">
              {t('proSubtitleLine1', settings.language)}<br />
              {t('proSubtitleLine2', settings.language)}<br />
              {t('proSubtitleLine3', settings.language)}
            </p>

            <div className="mobile-pro-features">
              <div className="mobile-pro-feature">
                <div className="mobile-pro-feature-icon">
                  <svg width={22} height={20} style={{ display: 'block' }}>
                    <use href="/icons.svg#opus-pro-icon" />
                  </svg>
                </div>
                <div className="mobile-pro-feature-text">
                  <span className="mobile-pro-feature-title">{t('opusInChats', settings.language)}</span>
                  <span className="mobile-pro-feature-desc">{t('opusInChatsDesc', settings.language)}</span>
                </div>
              </div>
              <div className="mobile-pro-feature">
                <div className="mobile-pro-feature-icon">
                  <Cloud size={22} strokeWidth={1.5} />
                </div>
                <div className="mobile-pro-feature-text">
                  <span className="mobile-pro-feature-title">{t('doubledLimits', settings.language)}</span>
                  <span className="mobile-pro-feature-desc">{t('doubledLimitsDesc', settings.language)}</span>
                </div>
              </div>
              <div className="mobile-pro-feature">
                <div className="mobile-pro-feature-icon">
                  <BadgeCheck size={22} strokeWidth={1.5} />
                </div>
                <div className="mobile-pro-feature-text">
                  <span className="mobile-pro-feature-title">{t('profileBadge', settings.language)}</span>
                  <span className="mobile-pro-feature-desc">{t('profileBadgeDesc', settings.language)}</span>
                </div>
              </div>
            </div>

            <button className="mobile-pro-features-link">
              {t('viewAllPlanFeatures', settings.language)}
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="mobile-pro-sheet">
            {proPlans.length > 0 && proPlans.map((plan: Plan) => (
              <label key={plan.id} className="mobile-pro-plan">
                <input
                  type="radio"
                  name="pro-plan"
                  value={plan.id}
                  checked={proPlan === (plan.id === 1 ? 'monthly' : 'annual')}
                  onChange={() => setProPlan(plan.id === 1 ? 'monthly' : 'annual')}
                />
                <span className="mobile-pro-radio" />
                <span className="mobile-pro-plan-text">
                  <span className="mobile-pro-plan-name">
                    {plan.id === 1 ? t('monthByMonth', settings.language) : t('annualSubscription', settings.language)}:{' '}
                    <span className="mobile-pro-plan-price">{plan.price_rub.toLocaleString()} ₽</span>
                  </span>
                  {plan.id === 2 && (
                    <span className="mobile-pro-plan-hint">{t('onlyPerMonth', settings.language)}</span>
                  )}
                </span>
              </label>
            ))}

            <button
              className={`mobile-pro-upgrade-btn${upgradeLoading ? ' loading' : ''}`}
              disabled={upgradeLoading}
              onClick={async () => {
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
                alert(err instanceof Error ? err.message : 'Payment failed')
                } finally {
                  setUpgradeLoading(false)
                }
              }}
            >
              {upgradeLoading ? '...' : t('upgrade', settings.language)}
            </button>

            <div className="mobile-pro-legal">
              <button className="mobile-pro-legal-link" onClick={() => setPageStack(prev => [...prev, 'offer'])}>{t('termsOfService', settings.language)}</button>
              <span>·</span>
              <button className="mobile-pro-legal-link" onClick={() => setPageStack(prev => [...prev, 'contacts'])}>{t('contactsTitle', settings.language)}</button>
            </div>
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

      {toast && <div className={`toast${toastClosing ? ' closing' : ''}`}>{toast}</div>}
    </div>
  )
}

export default MobileApp
