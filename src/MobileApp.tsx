import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageSquare, User, Plus, Search, ArrowUp,
  Copy, Trash2, Settings, Pencil, Phone,
  ChevronLeft, MoreVertical, Camera, Image, File, X,
  ChevronRight, Mail, AtSign,
  Globe, Eye, Volume2, HardDrive, Download, AlignLeft, Clock,
  Pin, Folder, Check
} from 'lucide-react'
import { t, langName, p } from './i18n'
import './MobileApp.css'

interface Chat {
  id: number
  name: string
  lastMessage: string
  time: string
  pinned?: boolean
}

interface Folder {
  id: number
  name: string
  icon: string
  sortOrder: number
  chats: number[]
}

interface Message {
  id: number
  sender: 'me' | 'them'
  text: string
  time: string
  senderName?: string
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

function api(path: string, options?: RequestInit) {
  const token = localStorage.getItem('token')
  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  }).then(r => r.json().then(d => {
    if (!r.ok) throw new Error(d.error || 'Request failed')
    return d
  }))
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

function MobileApp() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<UserData | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(!!token)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authForm, setAuthForm] = useState({ name: '', surname: '', email: '', password: '' })

  const [tab, setTab] = useState<'chats' | 'opus' | 'profile'>('chats')
  const [chatView, setChatView] = useState<'list' | 'thread' | 'contact'>('list')

  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [chatInputTexts, setChatInputTexts] = useState<Record<number, string>>({})
  const [contactProfile, setContactProfile] = useState<UserData | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null)
  const [folderSheet, setFolderSheet] = useState<{ chatId: number } | null>(null)
  const [folderContextMenu, setFolderContextMenu] = useState<{ folderId: number } | null>(null)
  const [folderMenuSheet, setFolderMenuSheet] = useState(false)
  const [folderEditOpen, setFolderEditOpen] = useState(false)
  const [folderEditNames, setFolderEditNames] = useState<Record<number, string>>({})
  const [folderManageView, setFolderManageView] = useState<{ folderId: number } | null>(null)
  const [addChatsSheet, setAddChatsSheet] = useState<{ folderId: number; selected: Set<number> } | null>(null)
  const [folderDialog, setFolderDialog] = useState<{ type: 'rename' | 'delete' | 'create'; folderId?: number } | null>(null)
  const [folderDialogInput, setFolderDialogInput] = useState('')

  const [inputText, setInputText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiConversation, setAiConversation] = useState<{ role: 'user' | 'ai'; text: string }[]>([])

  const handleRefresh = () => {
    api('/chats').then(setChats)
    api('/folders').then(setFolders)
    api('/users/me').then(u => {
      setUser(u)
      setEditProfile({ username: u.username || '', phone: u.phone || '', bio: u.bio || '' })
    })
  }

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
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [closingThread, setClosingThread] = useState(false)
  const [closingContact, setClosingContact] = useState(false)
  const [closingSheet, setClosingSheet] = useState<string | null>(null)

  const closeSheet = (type: string) => {
    if (closingSheet) return
    setClosingSheet(type)
    setTimeout(() => {
      setAttachMenu(false)
      setContextMenu(null)
      setChatContextMenu(null)
      setFolderSheet(null)
      setFolderContextMenu(null)
      setOptionPicker(null)
      setFolderMenuSheet(false)
      setAddChatsSheet(null)
      setClosingSheet(null)
    }, 200)
  }

  const closeSheetImmediate = () => {
    setAttachMenu(false)
    setContextMenu(null)
    setChatContextMenu(null)
    setFolderSheet(null)
    setFolderContextMenu(null)
    setOptionPicker(null)
    setFolderMenuSheet(false)
    setAddChatsSheet(null)
    setClosingSheet(null)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
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
  }, [tab, updateIndicator])
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const aiMessagesRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [firstOpusEntry, setFirstOpusEntry] = useState(true)

  const [editProfile, setEditProfile] = useState({ username: '', phone: '', bio: '' })
  const [profileView, setProfileView] = useState<'profile' | 'edit' | 'settings'>('profile')
  const [optionPicker, setOptionPicker] = useState<string | null>(null)
  const [settings, setSettings] = useState({
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
  })

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
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (activeChatId) {
      api(`/chats/${activeChatId}/messages`).then(setMessages)
      api(`/chats/${activeChatId}/other-user`).then(setContactProfile).catch(() => setContactProfile(null))
    }
  }, [activeChatId])

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
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    } else {
      setSearchQuery('')
      setSearchResults([])
    }
  }, [searchOpen])

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

  const activeChat = chats.find(c => c.id === activeChatId)

  const handleOpenChat = (chatId: number) => {
    setActiveChatId(chatId)
    setChatView('thread')
    setTab('chats')
  }

  const handleCloseChat = () => {
    if (closingThread) return
    setClosingThread(true)
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
    }, 280)
  }

  const handleSendMessage = (chatId: number) => {
    const text = chatInputTexts[chatId]?.trim()
    if (!text) return

    api(`/chats/${chatId}/messages`, { method: 'POST', body: JSON.stringify({ text }) }).then((msg) => {
      setMessages(prev => [...prev, msg])
      setChatInputTexts(prev => ({ ...prev, [chatId]: '' }))
      setChats(prev => prev.map(c =>
        c.id === chatId ? { ...c, lastMessage: text, time: msg.time } : c
      ))
    })
  }

  const handleChatInputChange = (chatId: number, value: string) => {
    setChatInputTexts(prev => ({ ...prev, [chatId]: value }))
  }

  const handleAiSend = async () => {
    const text = inputText.trim()
    if (!text || aiLoading) return
    setInputText('')
    setAiConversation(prev => [...prev, { role: 'user', text }])
    setAiLoading(true)
    try {
      const result = await api('/ai/process', {
        method: 'POST',
        body: JSON.stringify({ text, history: aiConversation })
      })
      setAiConversation(prev => [...prev, { role: 'ai', text: result.response }])
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

  const deleteMessage = () => {
    if (!contextMenu) return
    setMessages(prev => prev.filter(m => m.id !== contextMenu.messageId))
    setContextMenu(null)
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

  const handleTabLongPress = () => {
    tabLongPressed.current = true
    touchDrag.current = null
    setFolderMenuSheet(true)
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
    return (
      <div className="mobile-auth-page">
        <div className="mobile-auth-container">
          <div className="mobile-auth-header">
            <div className="mobile-auth-logo">
              <svg width="36" height="21" viewBox="0 0 24 14" fill="none">
                <mask id="mobile_auth_mask" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="14">
                  <path d="M0.188963 1.7392L6.82464 11.9946C7.16161 12.5153 7.85613 12.664 8.37683 12.327L14.5238 8.34973C14.7617 8.19573 15.0697 8.2003 15.303 8.36116L22.2314 13.1397C23.2423 13.8365 24.4781 12.6373 23.811 11.6066L17.1746 1.35116C16.8376 0.830456 16.1431 0.681795 15.6232 1.01876L9.47465 4.99682C9.23679 5.15082 8.92879 5.14624 8.6955 4.98538L1.7686 0.2076C0.757692 -0.489971 -0.478113 0.710003 0.188963 1.74073V1.7392Z" fill="url(#mobile_auth_grad)"/>
                </mask>
                <g mask="url(#mobile_auth_mask)">
                  <g filter="url(#mobile_auth_f0)"><circle cx="23.25" cy="9.75" r="9.75" fill="#3287FE"/></g>
                  <g filter="url(#mobile_auth_f1)"><circle cx="10.5" cy="14.25" r="9.75" fill="#13B962"/></g>
                  <g filter="url(#mobile_auth_f2)"><circle cx="-1.5" cy="2.25" r="9.75" fill="#F6BE11"/></g>
                  <g filter="url(#mobile_auth_f3)"><circle cx="12.75" cy="-1.5" r="9.75" fill="#FA4442"/></g>
                </g>
                <defs>
                  <filter id="mobile_auth_f0" x="6.15" y="-7.35" width="34.2" height="34.2" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                    <feGaussianBlur stdDeviation="3.675" result="effect1_foregroundBlur_1173_79"/>
                  </filter>
                  <filter id="mobile_auth_f1" x="-6.6" y="-2.85" width="34.2" height="34.2" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                    <feGaussianBlur stdDeviation="3.675" result="effect1_foregroundBlur_1173_79"/>
                  </filter>
                  <filter id="mobile_auth_f2" x="-18.6" y="-14.85" width="34.2" height="34.2" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                    <feGaussianBlur stdDeviation="3.675" result="effect1_foregroundBlur_1173_79"/>
                  </filter>
                  <filter id="mobile_auth_f3" x="-4.35" y="-18.6" width="34.2" height="34.2" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                    <feGaussianBlur stdDeviation="3.675" result="effect1_foregroundBlur_1173_79"/>
                  </filter>
                  <linearGradient id="mobile_auth_grad" x1="12" y1="0" x2="12" y2="13.347" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#E20736"/><stop offset="1" stopColor="#BEE000"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="mobile-auth-title">Surf</h1>
            <p className="mobile-auth-subtitle">{authMode === 'login' ? t('welcomeBack', settings.language) : t('createAccount', settings.language)}</p>
          </div>
          <form className="mobile-auth-form" onSubmit={(e) => {
            e.preventDefault()
            const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register'
            api(endpoint, { method: 'POST', body: JSON.stringify(authForm) }).then(data => {
              localStorage.setItem('token', data.token)
              setToken(data.token)
              setUser(data.user)
              setIsLoggedIn(true)
              setEditProfile({ username: data.user.username || '', phone: data.user.phone || '', bio: data.user.bio || '' })
            }).catch(err => alert(err.message))
          }}>
            {authMode === 'register' && (
              <>
                <div className="mobile-auth-field">
                  <label className="mobile-auth-label">{t('name', settings.language)}</label>
                  <input className="mobile-auth-input" placeholder={t('name', settings.language)} value={authForm.name} onChange={(e) => setAuthForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="mobile-auth-field">
                  <label className="mobile-auth-label">{t('surname', settings.language)}</label>
                  <input className="mobile-auth-input" placeholder={t('surname', settings.language)} value={authForm.surname} onChange={(e) => setAuthForm(f => ({ ...f, surname: e.target.value }))} required />
                </div>
              </>
            )}
            <div className="mobile-auth-field">
              <label className="mobile-auth-label">{t('email', settings.language)}</label>
              <input className="mobile-auth-input" type="email" placeholder={t('email', settings.language)} value={authForm.email} onChange={(e) => setAuthForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="mobile-auth-field">
              <label className="mobile-auth-label">{t('password', settings.language)}</label>
              <input className="mobile-auth-input" type="password" placeholder="••••••••" value={authForm.password} onChange={(e) => setAuthForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            <button className="mobile-auth-submit" type="submit">{authMode === 'login' ? t('logIn', settings.language) : t('createAccount', settings.language)}</button>
          </form>
          <p className="mobile-auth-switch">
            {authMode === 'login' ? (
              <>{t('dontHaveAccount', settings.language)} <button className="mobile-auth-link" onClick={() => { setAuthMode('register'); setAuthForm({ name: '', surname: '', email: '', password: '' }) }}>{t('register', settings.language)}</button></>
            ) : (
              <>{t('alreadyHaveAccount', settings.language)} <button className="mobile-auth-link" onClick={() => { setAuthMode('login'); setAuthForm({ name: '', surname: '', email: '', password: '' }) }}>{t('logIn', settings.language)}</button></>
            )}
          </p>
        </div>
      </div>
    )
  }

  const isInChat = tab === 'chats' && (chatView === 'thread' || chatView === 'contact')

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
                    const displayChats = activeFolderId
                      ? chats.filter(c => folders.find(f => f.id === activeFolderId)?.chats.includes(c.id))
                      : chats
                    if (displayChats.length === 0) {
                      return (
                        <div className="mobile-chats-empty">
                          <div className="mobile-chats-empty-text">{t('noChats', settings.language)}</div>
                        </div>
                      )
                    }
                    return displayChats.map(chat => (
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
                          <div className="mobile-chat-preview">{chat.lastMessage}</div>
                        </div>
                        <div className="mobile-chat-time">{chat.time}</div>
                        {chat.pinned && <div className="mobile-chat-pin" />}
                      </div>
                    ))
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
                <button className="mobile-thread-action" title={t('call', settings.language)}><Phone size={20} /></button>
                <button className="mobile-thread-action" title={t('more', settings.language)}><MoreVertical size={20} /></button>
              </div>
            </div>

            <div className="mobile-thread-messages" onContextMenu={(e) => e.preventDefault()}>
              {messages.map(msg => (
                <div
                  key={msg.id}
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
                    <div className="mobile-msg-text">{msg.text}</div>
                    <div className="mobile-msg-time">{msg.time}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mobile-thread-input">
              <div className="mobile-input-wrapper">
                <button className="mobile-input-attach" onClick={() => setAttachMenu(true)}>
                  <Plus size={22} />
                </button>
                <input
                  type="text"
                  className="mobile-input"
                  placeholder={t('writeMessage', settings.language)}
                  value={chatInputTexts[activeChat.id] || ''}
                  onChange={(e) => handleChatInputChange(activeChat.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(activeChat.id) }}
                />
                <button
                  className={`mobile-send-btn${(chatInputTexts[activeChat.id] || '').trim() ? ' active' : ''}`}
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
              <div className="mobile-thread-name" style={{ marginLeft: 4 }}>{t('contact', settings.language)}</div>
            </div>
            <div className="mobile-profile-top">
              <div className="mobile-profile-avatar" style={contactProfile?.avatar ? { backgroundImage: `url(${contactProfile.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                {!contactProfile?.avatar && <User size={40} strokeWidth={1.5} />}
              </div>
              <div className="mobile-profile-name">{contactProfile ? `${contactProfile.name} ${contactProfile.surname}` : activeChat?.name || ''}</div>
              {contactProfile?.bio && <div className="mobile-profile-bio">{contactProfile.bio}</div>}
            </div>
            {contactProfile && (
              <div className="mobile-profile-section" style={{ paddingTop: 8 }}>
                <div className="mobile-profile-card">
                  <div className="mobile-profile-row"><span className="mobile-profile-label">{t('email', settings.language)}</span><span className="mobile-profile-value">{contactProfile.email || '—'}</span></div>
                  {contactProfile.phone && <div className="mobile-profile-row"><span className="mobile-profile-label">{t('phone', settings.language)}</span><span className="mobile-profile-value">{contactProfile.phone}</span></div>}
                  {contactProfile.username && <div className="mobile-profile-row"><span className="mobile-profile-label">{t('username', settings.language)}</span><span className="mobile-profile-value">@{contactProfile.username}</span></div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== OPUS TAB ===== */}
        {tab === 'opus' && (
          <div className={`mobile-opus${aiConversation.length > 0 ? ' has-messages' : ''}${firstOpusEntry && aiConversation.length === 0 ? ' mobile-opus-entry' : ''}`}>
            {aiConversation.length === 0 ? (
              <div className="mobile-opus-welcome">
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
            ) : (
              <>
                <div className="mobile-thread-messages" ref={aiMessagesRef}>
                  {aiConversation.map((msg, i) => (
                    <div key={i} className={`mobile-msg-row ${msg.role === 'user' ? 'sender-me' : 'sender-them'}`}>
                      <div className="mobile-msg-bubble">
                        <div className="mobile-msg-text">{msg.text}</div>
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="mobile-msg-row sender-them">
                      <div className="mobile-msg-bubble mobile-ai-typing">
                        <span className="ai-typing">...</span>
                      </div>
                    </div>
                  )}
                </div>
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
              </>
            )}
          </div>
        )}

        {/* ===== PROFILE TAB ===== */}
        {tab === 'profile' && profileView === 'profile' && (
          <div className="mobile-profile">
            <div className="mobile-profile-header-bg" />
            <div className="mobile-profile-hero">
              <div className="mobile-profile-avatar-wrap">
                <div className="mobile-profile-avatar-ring">
                  <div
                    className="mobile-profile-avatar-inner"
                    style={user?.avatar ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer' } : {}}
                    onClick={() => user?.avatar && setFullscreenImage(user.avatar)}
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
              <button className="mobile-edit-save" onClick={() => {
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

              <div className="mobile-settings-group">
                <h3 className="mobile-settings-group-title">{t('data', settings.language)}</h3>
                <div className="mobile-settings-card">
                  <div className="mobile-settings-row">
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#3287FE' }}>
                      <HardDrive size={18} />
                    </div>
                    <span className="mobile-settings-label">{t('storage', settings.language)}</span>
                    <span className="mobile-settings-value">12.4 MB</span>
                  </div>
                  <div className="mobile-settings-row clickable" onClick={() => cycleSetting('autoDownload', ['Wi-Fi only', 'Always', 'Never'])}>
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#13B962' }}>
                      <Download size={18} />
                    </div>
                    <span className="mobile-settings-label">{t('autoDownload', settings.language)}</span>
                    <span className="mobile-settings-value">{settings.autoDownload}</span>
                    <ChevronRight size={16} className="mobile-settings-chevron" />
                  </div>
                </div>
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
              handleTabLongPress()
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
          onContextMenu={(e) => { e.preventDefault(); handleTabLongPress() }}
        >
          <span className="mobile-tab-icon"><MessageSquare size={20} /></span>
        </button>
        <button
          ref={el => void (tabRefs.current['opus'] = el)}
          className={`mobile-tab ${tab === 'opus' ? 'active' : ''}`}
          onClick={() => setTab('opus')}
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
          onClick={() => { setTab('profile'); setProfileView('profile') }}
        >
          <span className="mobile-tab-icon"><User size={20} /></span>
        </button>
      </div>

      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) alert(`Selected: ${f.name}`); e.target.value = '' }} />

      {/* ===== BOTTOM SHEET: Attach Menu ===== */}
      {(attachMenu || closingSheet === 'attach') && (
        <div className={`mobile-sheet-overlay${closingSheet === 'attach' ? ' closing' : ''}`} onClick={() => closeSheet('attach')}>
          <div className={`mobile-sheet${closingSheet === 'attach' ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            <button className="mobile-sheet-item" onClick={() => { fileInputRef.current?.click(); closeSheetImmediate() }}>
              <Image size={18} /><span>{t('photoOrVideo', settings.language)}</span>
            </button>
            <button className="mobile-sheet-item" onClick={() => { fileInputRef.current?.click(); closeSheetImmediate() }}>
              <File size={18} /><span>{t('document', settings.language)}</span>
            </button>
          </div>
        </div>
      )}

      {/* ===== BOTTOM SHEET: Context Menu ===== */}
      {(contextMenu || closingSheet === 'context') && (
        <div className={`mobile-sheet-overlay${closingSheet === 'context' ? ' closing' : ''}`} onClick={() => closeSheet('context')}>
          <div className={`mobile-sheet${closingSheet === 'context' ? ' closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
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
                    {chats.filter(c => folder.chats.includes(c.id)).map((chat) => (
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
              const availableChats = chats.filter(c => !folder.chats.includes(c.id))
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
    </div>
  )
}

export default MobileApp
