import { useState, useEffect, useRef } from 'react'
import { Plus, Search, ArrowUp, User, Copy, Trash2, Image, File, Camera, Settings, LogOut, Shield, Pencil, Phone, MoreVertical, Pin, Folder } from 'lucide-react'
import './App.css'

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

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<UserData | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authForm, setAuthForm] = useState({ name: '', surname: '', email: '', password: '' })
  const [isLoggedIn, setIsLoggedIn] = useState(!!token)

  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'chat' | 'profile' | 'settings' | 'edit-profile'>('home')
  const [activeChatId, setActiveChatId] = useState<number | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [chatInputTexts, setChatInputTexts] = useState<Record<number, string>>({})
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)

  const [inputText, setInputText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiConversation, setAiConversation] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserData[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const aiMessagesRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [attachMenu, setAttachMenu] = useState<{ x: number; y: number; dir: 'up' | 'down' } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; messageId: number } | null>(null)
  const [chatContextMenu, setChatContextMenu] = useState<{ x: number; y: number; chatId: number } | null>(null)
  const [profileMenu, setProfileMenu] = useState<{ x: number; y: number } | null>(null)
  const [settingDropdown, setSettingDropdown] = useState<{ key: string; x: number; y: number } | null>(null)
  const [settingsSection, setSettingsSection] = useState<'general' | 'account' | 'privacy'>('general')
  const [editProfile, setEditProfile] = useState({ username: '', phone: '', bio: '' })
  const [contactProfile, setContactProfile] = useState<UserData | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null)
  const [folderDropdown, setFolderDropdown] = useState<{ chatId: number; x: number; y: number } | null>(null)
  const [folderContextMenu, setFolderContextMenu] = useState<{ x: number; y: number; folderId: number } | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
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

  const handleContextMenu = (e: React.MouseEvent, messageId: number) => {
    e.preventDefault()
    if (contextMenu) { closeContextMenu(); return }
    setContextMenu({ x: e.clientX, y: e.clientY, messageId })
  }

  const closeContextMenu = () => setContextMenu(null)

  const copyMessage = () => {
    if (!contextMenu) return
    const msg = messages.find(m => m.id === contextMenu.messageId)
    if (msg) navigator.clipboard.writeText(msg.text)
    closeContextMenu()
  }

  const deleteMessage = () => {
    if (!contextMenu) return
    setMessages(prev => prev.filter(m => m.id !== contextMenu.messageId))
    closeContextMenu()
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
    const name = prompt('Rename folder', folder?.name || '')
    if (!name?.trim()) return
    api(`/folders/${folderId}`, { method: 'PUT', body: JSON.stringify({ name: name.trim() }) }).then(() => {
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: name.trim() } : f))
      setFolderContextMenu(null)
    }).catch(err => alert(err.message))
  }

  const deleteFolder = (folderId: number) => {
    if (!confirm('Delete this folder?')) return
    api(`/folders/${folderId}`, { method: 'DELETE' }).then(() => {
      setFolders(prev => prev.filter(f => f.id !== folderId))
      if (activeFolderId === folderId) setActiveFolderId(null)
      setFolderContextMenu(null)
    }).catch(err => alert(err.message))
  }

  const closeAttachMenu = () => setAttachMenu(null)
  const closeProfileMenu = () => setProfileMenu(null)
  const closeChatContextMenu = () => setChatContextMenu(null)
  const closeFolderDropdown = () => setFolderDropdown(null)
  const closeFolderContextMenu = () => setFolderContextMenu(null)
  const closeSettingDropdown = () => setSettingDropdown(null)

  const settingOptions: Record<string, string[]> = {
    lastSeen: ['Everyone', 'My Contacts', 'Nobody'],
    profilePhoto: ['Everyone', 'My Contacts', 'Nobody'],
    phonePrivacy: ['Everyone', 'My Contacts', 'Nobody'],
    emailPrivacy: ['Everyone', 'My Contacts', 'Nobody'],
    bioPrivacy: ['Everyone', 'My Contacts', 'Nobody'],
    autoDownload: ['Wi-Fi only', 'Always', 'Never'],
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
    closeSettingDropdown()
  }

  useEffect(() => {
    const handleClick = () => { closeContextMenu(); closeAttachMenu(); closeProfileMenu(); closeChatContextMenu(); closeFolderDropdown(); closeFolderContextMenu(); closeSettingDropdown() }
    const handleScroll = () => { closeContextMenu(); closeAttachMenu(); closeProfileMenu(); closeChatContextMenu(); closeFolderDropdown(); closeFolderContextMenu(); closeSettingDropdown() }
    if (contextMenu || attachMenu || profileMenu || chatContextMenu || folderDropdown || folderContextMenu || settingDropdown) {
      document.addEventListener('click', handleClick)
      document.addEventListener('scroll', handleScroll, true)
    }
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [contextMenu, attachMenu, profileMenu, settingDropdown])

  useEffect(() => {
    if (!fullscreenImage) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreenImage(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [fullscreenImage])

  if (!isLoggedIn) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <div className="auth-logo">
              <svg width="36" height="21" viewBox="0 0 24 14" fill="none">
                <mask id="auth_mask" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="14">
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
            <p className="auth-subtitle">{authMode === 'login' ? 'Welcome back' : 'Create account'}</p>
          </div>
          <form className="auth-form" onSubmit={(e) => {
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
                <div className="auth-field">
                  <label className="auth-label">Name</label>
                  <input className="auth-input" placeholder="Your name" value={authForm.name} onChange={(e) => setAuthForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="auth-field">
                  <label className="auth-label">Surname</label>
                  <input className="auth-input" placeholder="Your surname" value={authForm.surname} onChange={(e) => setAuthForm(f => ({ ...f, surname: e.target.value }))} required />
                </div>
              </>
            )}
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input className="auth-input" type="email" placeholder="your@email.com" value={authForm.email} onChange={(e) => setAuthForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input className="auth-input" type="password" placeholder="••••••••" value={authForm.password} onChange={(e) => setAuthForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            <button className="auth-submit" type="submit">{authMode === 'login' ? 'Log in' : 'Create account'}</button>
          </form>
          <p className="auth-switch">
            {authMode === 'login' ? (
              <>Don't have an account? <button className="auth-link" onClick={() => { setAuthMode('register'); setAuthForm({ name: '', surname: '', email: '', password: '' }) }}>Register</button></>
            ) : (
              <>Already have an account? <button className="auth-link" onClick={() => { setAuthMode('login'); setAuthForm({ name: '', surname: '', email: '', password: '' }) }}>Log in</button></>
            )}
          </p>
        </div>
      </div>
    )
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
              onClick={(e) => { e.stopPropagation(); setActiveTab('home'); setActiveChatId(null) }} title="New chat">
              <Plus size={18} />
              <span className="sidebar-text">New chat</span>
            </button>
            <button className={`sidebar-nav-btn ${activeTab === 'search' && activeChatId === null ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setActiveTab('search'); setActiveChatId(null) }} title="Search">
              <Search size={18} />
              <span className="sidebar-text">Search</span>
            </button>
          </nav>

          {folders.length > 0 && (
            <div className="sidebar-folder-list">
              <button className={`sidebar-folder-btn ${activeFolderId === null ? 'active' : ''}`} onClick={() => setActiveFolderId(null)}>All</button>
              {folders.map(folder => (
                <button key={folder.id} className={`sidebar-folder-btn ${activeFolderId === folder.id ? 'active' : ''}`}
                  onClick={() => setActiveFolderId(folder.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setFolderContextMenu({ x: e.clientX, y: e.clientY, folderId: folder.id })
                  }}
                >
                  {folder.name}
                </button>
              ))}
            </div>
          )}

          <div className="sidebar-chat-list">
            {(activeFolderId
              ? chats.filter(c => folders.find(f => f.id === activeFolderId)?.chats.includes(c.id))
              : chats
            ).map(chat => (
              <div key={chat.id}
                className={`sidebar-chat-item ${activeTab === 'chat' && activeChatId === chat.id ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setActiveChatId(chat.id); setActiveTab('chat') }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setChatContextMenu({ x: e.clientX, y: e.clientY, chatId: chat.id })
                }}
                title={chat.name}
              >
                <div className="chat-item-avatar"><User size={18} strokeWidth={1.5} /></div>
                <div className="chat-item-info">
                  <span className="chat-item-name">{chat.name}</span>
                  <span className="chat-item-message">{chat.lastMessage}</span>
                </div>
                {chat.pinned && <div className="chat-item-pin" />}
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-profile-footer">
          <div className="profile-footer-content" onClick={(e) => {
            e.stopPropagation()
            if (profileMenu) { closeProfileMenu(); return }
            const el = avatarRef.current
            if (!el) return
            const r = el.getBoundingClientRect()
            setProfileMenu({ x: r.left - 10, y: Math.max(8, r.top - 130) })
          }}>
            <div className="sidebar-avatar" title="Profile" ref={avatarRef} style={user?.avatar ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent' } : {}}>
              {!user?.avatar && <User size={18} strokeWidth={1.5} />}
            </div>
            <span className="profile-username">{user?.name || 'User'}</span>
          </div>
          {profileMenu && (
            <div className="context-menu" style={{ position: 'fixed', left: profileMenu.x, top: profileMenu.y, zIndex: 300 }} onClick={(e) => e.stopPropagation()}>
              <button className="context-menu-item" onClick={() => { setActiveTab('profile'); setActiveChatId(null); closeProfileMenu() }}>
                <User size={14} /><span>Profile</span>
              </button>
              <button className="context-menu-item" onClick={() => { setActiveTab('settings'); closeProfileMenu() }}>
                <Settings size={14} /><span>Settings</span>
              </button>
              <button className="context-menu-item" onClick={() => { localStorage.removeItem('token'); setToken(null); setUser(null); setIsLoggedIn(false); closeProfileMenu() }}>
                <LogOut size={14} /><span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="main-area">
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) alert(`Selected: ${f.name}`); e.target.value = '' }} />

        {attachMenu && (
          <div className="context-menu" style={{ left: attachMenu.x, top: attachMenu.y }} onClick={(e) => e.stopPropagation()}>
            <button className="context-menu-item" onClick={() => { fileInputRef.current?.click(); closeAttachMenu() }}>
              <Image size={14} /><span>Photo or video</span>
            </button>
            <button className="context-menu-item" onClick={() => { fileInputRef.current?.click(); closeAttachMenu() }}>
              <File size={14} /><span>Document</span>
            </button>
          </div>
        )}

        {activeTab === 'home' ? (
          <div className={`chat-thread-container ai-chat ${aiConversation.length > 0 ? 'has-messages' : ''} ${firstHomeEntry ? 'home-entry' : ''}`}>
            {aiConversation.length === 0 ? (
              <div className="chat-thread-messages">
                <div className="ai-welcome">
                  <h1 className="landing-header">Let's text someone</h1>
                  <div className="chat-input-wrapper">
                    <input type="text" className="chat-input" placeholder="Ask Opus" value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAiSend() }} />
                    <button className={`send-btn${inputText.trim() ? ' active' : ''}`} title="Send" onClick={handleAiSend}><ArrowUp size={18} /></button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="chat-thread-messages" ref={aiMessagesRef}>
                  {aiConversation.map((msg, i) => (
                    <div key={i} className={`message-row ${msg.role === 'user' ? 'sender-me' : 'sender-them'}`}>
                      <div className="message-bubble">
                        <div className="message-text">{msg.text}</div>
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="message-row sender-them">
                      <div className="message-bubble ai-typing-bubble">
                        <span className="ai-typing">...</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="chat-thread-input-container">
                  <div className="chat-input-wrapper">
                    <input type="text" className="chat-input" placeholder="Ask Opus" value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAiSend() }} />
                    <button className={`send-btn${inputText.trim() ? ' active' : ''}`} title="Send" onClick={handleAiSend}><ArrowUp size={18} /></button>
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
                <input ref={searchInputRef} type="text" className="search-bar-input" placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
            <div className="recent-section">
              <div className="recent-title">Recent</div>
              <div className="recent-grid">
                {searchResults.length > 0 ? (
                  searchResults.map(u => (
                    <div key={u.id} className="recent-item" onClick={() => {
                      api('/chats', { method: 'POST', body: JSON.stringify({ name: `${u.name} ${u.surname}`, participantId: u.id }) }).then(newChat => {
                        setChats(prev => [newChat, ...prev])
                        setActiveChatId(newChat.id)
                        setActiveTab('chat')
                      }).catch(err => alert(err.message))
                    }}>
                      <div className="item-avatar"><User size={18} strokeWidth={1.5} /></div>
                      <div className="item-content">
                        <div className="item-name">{u.name} {u.surname}</div>
                        <div className="item-subtext">{u.email}</div>
                      </div>
                    </div>
                  ))
                ) : searchQuery.trim() ? (
                  <div className="recent-empty">No users found</div>
                ) : null}
              </div>
            </div>
          </div>
        ) : activeTab === 'chat' && activeChat ? (
          <div className="chat-thread-container">
            <div className="chat-thread-header">
              <div className="chat-header-left" onClick={() => setActiveTab('profile')} style={{ cursor: 'pointer' }}>
                <div className="chat-header-avatar">
                  <User size={20} strokeWidth={1.5} />
                  <span className="online-dot" />
                </div>
                <div className="chat-header-info">
                  <div className="chat-header-name">{activeChat.name}</div>
                </div>
              </div>
              <div className="chat-header-actions">
                <button className="chat-header-action-btn" title="Call"><Phone size={18} /></button>
                <button className="chat-header-action-btn" title="More"><MoreVertical size={18} /></button>
              </div>
            </div>

            <div className="chat-thread-messages" onContextMenu={(e) => e.preventDefault()}>
              {messages.map(msg => (
                <div key={msg.id} className={`message-row ${msg.sender === 'me' ? 'sender-me' : 'sender-them'}`}
                  onContextMenu={(e) => handleContextMenu(e, msg.id)}>
                  <div className="message-bubble">
                    <div className="message-text">{msg.text}</div>
                    <div className="message-time">{msg.time}</div>
                  </div>
                </div>
              ))}
            </div>

            {contextMenu && (
              <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
                <button className="context-menu-item" onClick={copyMessage}><Copy size={14} /><span>Copy</span></button>
                <button className="context-menu-item context-menu-item-danger" onClick={deleteMessage}><Trash2 size={14} /><span>Delete</span></button>
              </div>
            )}

            {chatContextMenu && (
              <div className="context-menu" style={{ left: chatContextMenu.x, top: chatContextMenu.y }} onClick={(e) => e.stopPropagation()}>
                <button className="context-menu-item" onClick={() => chatContextMenu && togglePinChat(chatContextMenu.chatId)}>
                  <Pin size={14} /><span>{chats.find(c => c.id === chatContextMenu.chatId)?.pinned ? 'Unpin' : 'Pin'}</span>
                </button>
                <button className="context-menu-item" onClick={() => chatContextMenu && setFolderDropdown({ chatId: chatContextMenu.chatId, x: chatContextMenu.x, y: chatContextMenu.y + 40 })}>
                  <Folder size={14} /><span>Folder</span>
                </button>
                <button className="context-menu-item context-menu-item-danger" onClick={deleteChat}><Trash2 size={14} /><span>Delete chat</span></button>
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
                <button className="context-menu-item" onClick={() => { const name = prompt('Folder name'); if (name) createFolder(name) }}>
                  <span>+ New folder</span>
                </button>
              </div>
            )}

            {folderContextMenu && (
              <div className="context-menu" style={{ left: folderContextMenu.x, top: folderContextMenu.y }} onClick={(e) => e.stopPropagation()}>
                <button className="context-menu-item" onClick={() => folderContextMenu && renameFolder(folderContextMenu.folderId)}>
                  <Pencil size={14} /><span>Rename</span>
                </button>
                <button className="context-menu-item context-menu-item-danger" onClick={() => folderContextMenu && deleteFolder(folderContextMenu.folderId)}>
                  <Trash2 size={14} /><span>Delete</span>
                </button>
              </div>
            )}

            <div className="chat-thread-input-container">
              <div className="chat-input-wrapper">
                <button className="input-icon-btn" title="Add file" onClick={(e) => {
                  e.stopPropagation()
                  if (attachMenu) { closeAttachMenu(); return }
                  const rect = e.currentTarget.getBoundingClientRect()
                  setAttachMenu({ x: rect.left, y: rect.top - 90, dir: 'up' })
                }}>
                  <Plus size={18} />
                </button>
                <input type="text" className="chat-input" placeholder="Write a message..."
                  value={chatInputTexts[activeChat.id] || ''}
                  onChange={(e) => handleChatInputChange(activeChat.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(activeChat.id) }} />
                <button className={`send-btn${(chatInputTexts[activeChat.id] || '').trim() ? ' active' : ''}`} title="Send"
                  onClick={() => handleSendMessage(activeChat.id)}>
                  <ArrowUp size={18} />
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'profile' && activeChatId === null ? (
          <div className="profile-container">
            <div className="profile-top">
              <div className="profile-avatar-large" style={user?.avatar ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent', cursor: 'pointer' } : { backgroundColor: 'var(--accent-color)' }}
                onClick={() => user?.avatar && setFullscreenImage(user.avatar)}>
                {!user?.avatar && <User size={36} strokeWidth={1.5} />}
                {user?.avatar && <span className="online-dot online-dot-lg online" />}
              </div>
              <div className="profile-info-header">
                <div className="profile-name">{user?.name || 'User'}</div>
              </div>
            </div>
            <div className="profile-content">
              <div className="profile-section">
                <div className="profile-card">
                  <div className="profile-info-row" onClick={() => { setActiveTab('edit-profile'); setEditProfile({ username: user?.username || '', phone: user?.phone || '', bio: user?.bio || '' }) }}
                    style={{ cursor: 'pointer' }}>
                    <span className="profile-info-label" style={{ color: 'var(--accent-color)' }}>Edit profile</span>
                    <Pencil size={14} style={{ color: 'var(--accent-color)' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'edit-profile' ? (
          <div className="edit-profile-container">
            <div className="edit-profile-header">
              <h2 className="edit-profile-title">Edit profile</h2>
              <button className="edit-profile-save" onClick={() => {
                api('/users/me', { method: 'PUT', body: JSON.stringify(editProfile) }).then(() => {
                  setUser(prev => prev ? { ...prev, ...editProfile } : prev)
                  setActiveTab('profile')
                }).catch(err => alert(err.message))
              }}>Save</button>
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
                <label className="edit-profile-label">Username</label>
                <input className="edit-profile-input" value={editProfile.username}
                  onChange={(e) => setEditProfile(p => ({ ...p, username: e.target.value }))} placeholder="@username" />
              </div>
              <div className="edit-profile-field">
                <label className="edit-profile-label">Phone</label>
                <input className="edit-profile-input" value={editProfile.phone}
                  onChange={(e) => setEditProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
              </div>
              <div className="edit-profile-field">
                <label className="edit-profile-label">Bio</label>
                <textarea className="edit-profile-textarea" rows={3} placeholder="Write something about yourself..."
                  value={editProfile.bio} onChange={(e) => setEditProfile(p => ({ ...p, bio: e.target.value }))} />
              </div>
            </div>
          </div>
        ) : activeTab === 'profile' && activeChat ? (
          <div className="profile-container">
            <div className="profile-top">
              <div className="profile-avatar-large" style={contactProfile?.avatar ? { backgroundImage: `url(${contactProfile.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent', cursor: 'pointer' } : {}}
                onClick={() => contactProfile?.avatar && setFullscreenImage(contactProfile.avatar)}>
                {!contactProfile?.avatar && <User size={36} strokeWidth={1.5} />}
                <span className="online-dot online-dot-lg" />
              </div>
              <div className="profile-info-header">
                <div className="profile-name">{contactProfile ? `${contactProfile.name} ${contactProfile.surname}` : activeChat.name}</div>
              </div>
              {contactProfile?.bio && <div className="profile-bio">{contactProfile.bio}</div>}
            </div>
            <div className="profile-content">
              <div className="profile-section">
                <h3 className="profile-section-title">Contact</h3>
                <div className="profile-card">
                  <div className="profile-info-row"><span className="profile-info-label">Email</span><span className="profile-info-value">{contactProfile?.email || '—'}</span></div>
                  {contactProfile?.phone && <div className="profile-info-row"><span className="profile-info-label">Phone</span><span className="profile-info-value">{contactProfile.phone}</span></div>}
                  {contactProfile?.username && <div className="profile-info-row"><span className="profile-info-label">Username</span><span className="profile-info-value">@{contactProfile.username}</span></div>}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'settings' ? (
          <div className="settings-container">
            <div className="settings-sidebar">
              <button className={`settings-nav-btn ${settingsSection === 'general' ? 'active' : ''}`} onClick={() => setSettingsSection('general')}>
                <Settings size={16} /><span>General</span>
              </button>
              <button className={`settings-nav-btn ${settingsSection === 'account' ? 'active' : ''}`} onClick={() => setSettingsSection('account')}>
                <User size={16} /><span>Account</span>
              </button>
              <button className={`settings-nav-btn ${settingsSection === 'privacy' ? 'active' : ''}`} onClick={() => setSettingsSection('privacy')}>
                <Shield size={16} /><span>Privacy</span>
              </button>
            </div>
            <div className="settings-content">
              {settingsSection === 'general' && (
                <>
                  <div className="profile-section">
                    <h3 className="profile-section-title">Appearance</h3>
                    <div className="profile-card">
                      <div className="profile-info-row" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'language', x: r.left, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">Language</span><span className="profile-info-value">{settings.language}</span>
                      </div>
                    </div>
                  </div>
                  <div className="profile-section">
                    <h3 className="profile-section-title">Notifications</h3>
                    <div className="profile-card">
                      <div className="profile-info-row" onClick={() => cycleSetting('previews', ['On', 'Off'])} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">Message previews</span><span className="profile-info-value">{settings.previews}</span>
                      </div>
                      <div className="profile-info-row" onClick={() => cycleSetting('sounds', ['On', 'Off'])} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">Sounds</span><span className="profile-info-value">{settings.sounds}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {settingsSection === 'account' && (
                <div className="profile-section">
                  <h3 className="profile-section-title">Profile</h3>
                  <div className="profile-card">
                    <div className="profile-info-row"><span className="profile-info-label">Name</span><span className="profile-info-value">{user?.name || ''}</span></div>
                    <div className="profile-info-row"><span className="profile-info-label">Email</span><span className="profile-info-value">{user?.email || ''}</span></div>
                  </div>
                </div>
              )}
              {settingsSection === 'privacy' && (
                <>
                  <div className="profile-section">
                    <h3 className="profile-section-title">Privacy</h3>
                    <div className="profile-card">
                      <div className="profile-info-row" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'lastSeen', x: r.left, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">Last seen</span><span className="profile-info-value">{settings.lastSeen}</span>
                      </div>
                      <div className="profile-info-row" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'profilePhoto', x: r.left, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">Profile photo</span><span className="profile-info-value">{settings.profilePhoto}</span>
                      </div>
                      <div className="profile-info-row" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'phonePrivacy', x: r.left, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">Phone</span><span className="profile-info-value">{settings.phonePrivacy}</span>
                      </div>
                      <div className="profile-info-row" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'emailPrivacy', x: r.left, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">Email</span><span className="profile-info-value">{settings.emailPrivacy}</span>
                      </div>
                      <div className="profile-info-row" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'bioPrivacy', x: r.left, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">Bio</span><span className="profile-info-value">{settings.bioPrivacy}</span>
                      </div>
                    </div>
                  </div>
                  <div className="profile-section">
                    <h3 className="profile-section-title">Data</h3>
                    <div className="profile-card">
                      <div className="profile-info-row"><span className="profile-info-label">Storage</span><span className="profile-info-value">12.4 MB</span></div>
                      <div className="profile-info-row" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'autoDownload', x: r.left, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">Auto-download</span><span className="profile-info-value">{settings.autoDownload}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="landing-empty">Select a chat or open search</div>
        )}
      </main>
    </div>

    {settingDropdown && (
      <div className="context-menu" style={{ left: settingDropdown.x, top: settingDropdown.y }} onClick={e => e.stopPropagation()}>
        {settingOptions[settingDropdown.key]?.map(option => (
          <button
            key={option}
            className={`context-menu-item${(settings as any)[settingDropdown.key] === option ? ' context-menu-item-active' : ''}`}
            onClick={() => selectSetting(settingDropdown.key, option)}
          >
            {option}
            {(settings as any)[settingDropdown.key] === option && <span style={{ marginLeft: 'auto', color: '#ffffff' }}>✓</span>}
          </button>
        ))}
      </div>
    )}

    {fullscreenImage && (
      <div className="fullscreen-overlay" onClick={() => setFullscreenImage(null)}>
        <img src={fullscreenImage} className="fullscreen-image" alt="Fullscreen" />
      </div>
    )}
  </>
  )
}

export default App
