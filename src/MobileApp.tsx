import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageSquare, User, Plus, Search, ArrowUp,
  Copy, Trash2, Settings, Pencil, Phone,
  ChevronLeft, MoreVertical, Camera, Image, File, X,
  ChevronRight, Mail, AtSign, Smartphone,
  Globe, Palette, Eye, Volume2, HardDrive, Download, AlignLeft, Clock
} from 'lucide-react'
import './MobileApp.css'

interface Chat {
  id: number
  name: string
  lastMessage: string
  time: string
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

  const [inputText, setInputText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiConversation, setAiConversation] = useState<{ role: 'user' | 'ai'; text: string }[]>([])

  const handleRefresh = () => {
    api('/chats').then(setChats)
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
      setOptionPicker(null)
      setClosingSheet(null)
    }, 200)
  }

  const closeSheetImmediate = () => {
    setAttachMenu(false)
    setContextMenu(null)
    setOptionPicker(null)
    setClosingSheet(null)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const tabBarRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 })
  const touchDrag = useRef<{ startX: number; startTab: string } | null>(null)

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

  const settingOptions: Record<string, string[]> = {
    lastSeen: ['Everyone', 'My Contacts', 'Nobody'],
    profilePhoto: ['Everyone', 'My Contacts', 'Nobody'],
    phonePrivacy: ['Everyone', 'My Contacts', 'Nobody'],
    emailPrivacy: ['Everyone', 'My Contacts', 'Nobody'],
    bioPrivacy: ['Everyone', 'My Contacts', 'Nobody'],
    autoDownload: ['Wi-Fi only', 'Always', 'Never'],
    theme: ['Dark', 'Light'],
    language: ['English', 'Russian', 'Spanish'],
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
            <p className="mobile-auth-subtitle">{authMode === 'login' ? 'Welcome back' : 'Create account'}</p>
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
                  <label className="mobile-auth-label">Name</label>
                  <input className="mobile-auth-input" placeholder="Your name" value={authForm.name} onChange={(e) => setAuthForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="mobile-auth-field">
                  <label className="mobile-auth-label">Surname</label>
                  <input className="mobile-auth-input" placeholder="Your surname" value={authForm.surname} onChange={(e) => setAuthForm(f => ({ ...f, surname: e.target.value }))} required />
                </div>
              </>
            )}
            <div className="mobile-auth-field">
              <label className="mobile-auth-label">Email</label>
              <input className="mobile-auth-input" type="email" placeholder="your@email.com" value={authForm.email} onChange={(e) => setAuthForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="mobile-auth-field">
              <label className="mobile-auth-label">Password</label>
              <input className="mobile-auth-input" type="password" placeholder="••••••••" value={authForm.password} onChange={(e) => setAuthForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            <button className="mobile-auth-submit" type="submit">{authMode === 'login' ? 'Log in' : 'Create account'}</button>
          </form>
          <p className="mobile-auth-switch">
            {authMode === 'login' ? (
              <>Don't have an account? <button className="mobile-auth-link" onClick={() => { setAuthMode('register'); setAuthForm({ name: '', surname: '', email: '', password: '' }) }}>Register</button></>
            ) : (
              <>Already have an account? <button className="mobile-auth-link" onClick={() => { setAuthMode('login'); setAuthForm({ name: '', surname: '', email: '', password: '' }) }}>Log in</button></>
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
                    placeholder="Search users..."
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
                  <div className="mobile-search-empty">No users found</div>
                ) : (
                  <div className="mobile-search-hint">Type to search users</div>
                )}
              </div>
            ) : (
              <div className="mobile-chat-list">
                {chats.length === 0 ? (
                  <div className="mobile-chats-empty">
                    <div className="mobile-chats-empty-text">No chats yet</div>
                    <div className="mobile-chats-empty-hint">Search users to start chatting</div>
                  </div>
                ) : (
                  chats.map(chat => (
                    <div key={chat.id} className="mobile-chat-item" onClick={() => handleOpenChat(chat.id)}>
                      <div className="mobile-chat-avatar"><User size={20} strokeWidth={1.5} /></div>
                      <div className="mobile-chat-info">
                        <div className="mobile-chat-name">{chat.name}</div>
                        <div className="mobile-chat-preview">{chat.lastMessage}</div>
                      </div>
                      <div className="mobile-chat-time">{chat.time}</div>
                    </div>
                  ))
                )}
              </div>
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
                <button className="mobile-thread-action" title="Call"><Phone size={20} /></button>
                <button className="mobile-thread-action" title="More"><MoreVertical size={20} /></button>
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
                  placeholder="Write a message..."
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
              <div className="mobile-thread-name" style={{ marginLeft: 4 }}>Contact</div>
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
                  <div className="mobile-profile-row"><span className="mobile-profile-label">Email</span><span className="mobile-profile-value">{contactProfile.email || '—'}</span></div>
                  {contactProfile.phone && <div className="mobile-profile-row"><span className="mobile-profile-label">Phone</span><span className="mobile-profile-value">{contactProfile.phone}</span></div>}
                  {contactProfile.username && <div className="mobile-profile-row"><span className="mobile-profile-label">Username</span><span className="mobile-profile-value">@{contactProfile.username}</span></div>}
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
                <h1 className="mobile-opus-header">Let's text someone</h1>
                <div className="mobile-opus-input-wrapper">
                  <input
                    type="text"
                    className="mobile-opus-input"
                    placeholder="Ask Opus"
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
                      placeholder="Ask Opus"
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
                <Pencil size={16} /> Edit Profile
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
              <div className="mobile-edit-title">Edit Profile</div>
              <button className="mobile-edit-save" onClick={() => {
                api('/users/me', { method: 'PUT', body: JSON.stringify(editProfile) }).then(() => {
                  setUser(prev => prev ? { ...prev, ...editProfile } : prev)
                  setProfileView('profile')
                }).catch(err => alert(err.message))
              }}>Save</button>
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
                <label className="mobile-edit-label">Username</label>
                <input className="mobile-edit-input" value={editProfile.username}
                  onChange={(e) => setEditProfile(p => ({ ...p, username: e.target.value }))} placeholder="@username" />
              </div>
              <div className="mobile-edit-field">
                <label className="mobile-edit-label">Phone</label>
                <input className="mobile-edit-input" value={editProfile.phone}
                  onChange={(e) => setEditProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
              </div>
              <div className="mobile-edit-field">
                <label className="mobile-edit-label">Bio</label>
                <textarea className="mobile-edit-textarea" rows={3} placeholder="Write something..."
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
              <div className="mobile-edit-title">Settings</div>
            </div>
            <div className="mobile-settings-scroll">
              <div className="mobile-settings-group">
                <h3 className="mobile-settings-group-title">General</h3>
                <div className="mobile-settings-card">
                  <div className="mobile-settings-row clickable" onClick={() => setOptionPicker('language')}>
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#3287FE' }}>
                      <Globe size={18} />
                    </div>
                    <span className="mobile-settings-label">Language</span>
                    <span className="mobile-settings-value">{settings.language}</span>
                    <ChevronRight size={16} className="mobile-settings-chevron" />
                  </div>
                  <div className="mobile-settings-row clickable" onClick={() => setOptionPicker('theme')}>
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#FA4442' }}>
                      <Palette size={18} />
                    </div>
                    <span className="mobile-settings-label">Theme</span>
                    <span className="mobile-settings-value">{settings.theme}</span>
                    <ChevronRight size={16} className="mobile-settings-chevron" />
                  </div>
                </div>
              </div>

              <div className="mobile-settings-group">
                <h3 className="mobile-settings-group-title">Notifications</h3>
                <div className="mobile-settings-card">
                  <div className="mobile-settings-row">
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#13B962' }}>
                      <Eye size={18} />
                    </div>
                    <span className="mobile-settings-label">Message previews</span>
                    <ToggleSwitch checked={settings.previews === 'On'} onChange={() => cycleSetting('previews', ['On', 'Off'])} />
                  </div>
                  <div className="mobile-settings-row">
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#F6BE11' }}>
                      <Volume2 size={18} />
                    </div>
                    <span className="mobile-settings-label">Sounds</span>
                    <ToggleSwitch checked={settings.sounds === 'On'} onChange={() => cycleSetting('sounds', ['On', 'Off'])} />
                  </div>
                </div>
              </div>

              <div className="mobile-settings-group">
                <h3 className="mobile-settings-group-title">Account</h3>
                <div className="mobile-settings-card">
                  <div className="mobile-settings-row">
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#3287FE' }}>
                      <User size={18} />
                    </div>
                    <span className="mobile-settings-label">Name</span>
                    <span className="mobile-settings-value">{user?.name || ''}</span>
                  </div>
                  <div className="mobile-settings-row">
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#FA4442' }}>
                      <Mail size={18} />
                    </div>
                    <span className="mobile-settings-label">Email</span>
                    <span className="mobile-settings-value">{user?.email || ''}</span>
                  </div>
                </div>
              </div>

              <div className="mobile-settings-group">
                <h3 className="mobile-settings-group-title">Privacy</h3>
                <div className="mobile-settings-card">
                  <div className="mobile-settings-row clickable" onClick={() => setOptionPicker('lastSeen')}>
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#13B962' }}>
                      <Clock size={18} />
                    </div>
                    <span className="mobile-settings-label">Last seen</span>
                    <span className="mobile-settings-value">{settings.lastSeen}</span>
                    <ChevronRight size={16} className="mobile-settings-chevron" />
                  </div>
                  <div className="mobile-settings-row clickable" onClick={() => setOptionPicker('profilePhoto')}>
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#3287FE' }}>
                      <Image size={18} />
                    </div>
                    <span className="mobile-settings-label">Profile photo</span>
                    <span className="mobile-settings-value">{settings.profilePhoto}</span>
                    <ChevronRight size={16} className="mobile-settings-chevron" />
                  </div>
                  <div className="mobile-settings-row clickable" onClick={() => setOptionPicker('phonePrivacy')}>
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#F6BE11' }}>
                      <Phone size={18} />
                    </div>
                    <span className="mobile-settings-label">Phone</span>
                    <span className="mobile-settings-value">{settings.phonePrivacy}</span>
                    <ChevronRight size={16} className="mobile-settings-chevron" />
                  </div>
                  <div className="mobile-settings-row clickable" onClick={() => setOptionPicker('emailPrivacy')}>
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#FA4442' }}>
                      <AtSign size={18} />
                    </div>
                    <span className="mobile-settings-label">Email</span>
                    <span className="mobile-settings-value">{settings.emailPrivacy}</span>
                    <ChevronRight size={16} className="mobile-settings-chevron" />
                  </div>
                  <div className="mobile-settings-row clickable" onClick={() => setOptionPicker('bioPrivacy')}>
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#8c8c88' }}>
                      <AlignLeft size={18} />
                    </div>
                    <span className="mobile-settings-label">Bio</span>
                    <span className="mobile-settings-value">{settings.bioPrivacy}</span>
                    <ChevronRight size={16} className="mobile-settings-chevron" />
                  </div>
                </div>
              </div>

              <div className="mobile-settings-group">
                <h3 className="mobile-settings-group-title">Data</h3>
                <div className="mobile-settings-card">
                  <div className="mobile-settings-row">
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#3287FE' }}>
                      <HardDrive size={18} />
                    </div>
                    <span className="mobile-settings-label">Storage</span>
                    <span className="mobile-settings-value">12.4 MB</span>
                  </div>
                  <div className="mobile-settings-row clickable" onClick={() => cycleSetting('autoDownload', ['Wi-Fi only', 'Always', 'Never'])}>
                    <div className="mobile-settings-icon-wrap" style={{ backgroundColor: '#13B962' }}>
                      <Download size={18} />
                    </div>
                    <span className="mobile-settings-label">Auto-download</span>
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
          onClick={() => setTab('chats')}
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
              <Image size={18} /><span>Photo or video</span>
            </button>
            <button className="mobile-sheet-item" onClick={() => { fileInputRef.current?.click(); closeSheetImmediate() }}>
              <File size={18} /><span>Document</span>
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
              <Copy size={18} /><span>Copy</span>
            </button>
            <button className="mobile-sheet-item mobile-sheet-item-danger" onClick={() => { deleteMessage(); closeSheetImmediate() }}>
              <Trash2 size={18} /><span>Delete</span>
            </button>
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
                <span style={{ flex: 1 }}>{option}</span>
                {optionPicker && (settings as any)[optionPicker] === option && <span style={{ color: '#ffffff' }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== Fullscreen Image ===== */}
      {fullscreenImage && (
        <div className="mobile-fullscreen-overlay" onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} className="mobile-fullscreen-img" alt="Fullscreen" />
        </div>
      )}
    </div>
  )
}

export default MobileApp
