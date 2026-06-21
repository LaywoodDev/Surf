import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Search, ArrowUp, User, Users, Copy, Trash2, Image, File, Camera, Settings, LogOut, Shield, Pencil, Phone, MoreVertical, Pin, Folder, X, Reply, ChevronDown, BarChart3 } from 'lucide-react'
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
  const [clearChatSubmenu, setClearChatSubmenu] = useState(false)
  const [settingsSection, setSettingsSection] = useState<'general' | 'account' | 'privacy'>('general')
  const [editProfile, setEditProfile] = useState({ username: '', phone: '', bio: '' })
  const [contactProfile, setContactProfile] = useState<UserData | null>(null)
  const [viewedUser, setViewedUser] = useState<UserData | null>(null)
  const [contacts, setContacts] = useState<UserData[]>([])
  const [mentionMenu, setMentionMenu] = useState<{ chatId: number; query: string } | null>(null)
  const [replyTo, setReplyTo] = useState<{ messageId: number; text: string; attachmentUrl?: string; attachmentType?: string } | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<{ url: string; type: string; name: string }[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null)
  const [folderDropdown, setFolderDropdown] = useState<{ chatId: number; x: number; y: number } | null>(null)
  const [folderContextMenu, setFolderContextMenu] = useState<{ x: number; y: number; folderId: number } | null>(null)
  const [newChatCtxMenu, setNewChatCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [folderEditOpen, setFolderEditOpen] = useState(false)
  const [folderEditInput, setFolderEditInput] = useState('')
  const [expandedFolderId, setExpandedFolderId] = useState<number | null>(null)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [toastClosing, setToastClosing] = useState(false)

  const [pollModalOpen, setPollModalOpen] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [pollsCache, setPollsCache] = useState<Record<number, Poll>>({})
  const profileAvatarRef = useRef<HTMLDivElement>(null)
  const avatarCloneRef = useRef<{ clone: HTMLElement; original: HTMLElement; overlay: HTMLDivElement } | null>(null)
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
      api('/users/contacts').then(setContacts)
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (activeChatId) {
      api(`/chats/${activeChatId}/messages`).then(setMessages)
      api(`/chats/${activeChatId}/other-user`).then(setContactProfile).catch(() => setContactProfile(null))
      api(`/polls/chat/${activeChatId}`).then((polls: Poll[]) => {
        const cacheUpdate: Record<number, Poll> = {}
        polls.forEach(p => { cacheUpdate[p.id] = p })
        setPollsCache(prev => ({ ...prev, ...cacheUpdate }))
      }).catch(() => {})
    }
    setMentionMenu(null)
    setViewedUser(null)
  }, [activeChatId])

  const opusLoadedRef = useRef(false)
  useEffect(() => {
    if (activeTab === 'home' && chats.length > 0 && !opusLoadedRef.current) {
      opusLoadedRef.current = true
      const opusChatId = chats.find(c => c.name === 'Opus')?.id
      if (opusChatId) {
        api(`/chats/${opusChatId}/messages`).then((msgs: any[]) => {
          setAiConversation(msgs.map(m => ({
            role: (m.sender === 'me' ? 'user' : 'ai') as 'user' | 'ai',
            text: m.text,
            time: m.time
          })))
          initialMsgCount.current = msgs.length
        }).catch(() => {})
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
      if (activeChatId === chatId) {
        setMessages([])
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, lastMessage: '', time: '' } : c))
      }
      closeChatMenu()
    }).catch(() => {})
  }

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

  const closeContextMenu = () => setContextMenu(null)

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
    setToast(`${label} copied`)
    setTimeout(() => setToastClosing(true), 1200)
    setTimeout(() => { setToast(null); setToastClosing(false) }, 1500)
  }

  const replyMessage = () => {
    if (!contextMenu) return
    const msg = messages.find(m => m.id === contextMenu.messageId)
    if (msg) setReplyTo({ messageId: msg.id, text: msg.text, attachmentUrl: msg.attachmentUrl, attachmentType: msg.attachmentType })
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
  const closeChatMenu = () => setChatMenu(null)
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
    const handleClick = () => { closeContextMenu(); closeAiContextMenu(); closeAttachMenu(); closeProfileMenu(); closeChatContextMenu(); closeFolderDropdown(); closeFolderContextMenu(); closeNewChatCtxMenu(); closeSettingDropdown(); closeChatMenu(); setClearChatSubmenu(false); setFolderEditOpen(false); setPollModalOpen(false) }
    const handleScroll = () => { closeContextMenu(); closeAiContextMenu(); closeAttachMenu(); closeProfileMenu(); closeChatContextMenu(); closeFolderDropdown(); closeFolderContextMenu(); closeNewChatCtxMenu(); closeSettingDropdown(); closeChatMenu(); setClearChatSubmenu(false); setFolderEditOpen(false); setPollModalOpen(false) }
    if (contextMenu || aiContextMenu || attachMenu || profileMenu || chatContextMenu || folderDropdown || folderContextMenu || newChatCtxMenu || folderEditOpen || settingDropdown || chatMenu || clearChatSubmenu || pollModalOpen) {
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
    if (!avatarOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAvatarAnim() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [avatarOpen, closeAvatarAnim])

  if (!isLoggedIn) {
    return (
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
              onClick={(e) => { e.stopPropagation(); setActiveTab('home'); setActiveChatId(null) }}
              onContextMenu={(e) => { e.preventDefault(); setNewChatCtxMenu({ x: e.clientX, y: e.clientY }) }} title="New chat">
              <Plus size={18} />
              <span className="sidebar-text">New chat</span>
            </button>
            <button className={`sidebar-nav-btn ${activeTab === 'search' && activeChatId === null ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setActiveTab('search'); setActiveChatId(null) }} title="Search">
              <Search size={18} />
              <span className="sidebar-text">Search</span>
            </button>
          </nav>

          <div className="sidebar-chat-list">
            {(activeFolderId
              ? chats.filter(c => folders.find(f => f.id === activeFolderId)?.chats.includes(c.id))
              : chats
            ).filter(c => c.name !== 'Opus').map(chat => (
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
              <Image size={14} /><span>Photo or video</span>
            </button>
            <button className="context-menu-item" onClick={() => { fileInputRef.current?.click(); closeAttachMenu() }}>
              <File size={14} /><span>Document</span>
            </button>
            <button className="context-menu-item" onClick={() => { closeAttachMenu(); setPollModalOpen(true) }}>
              <BarChart3 size={14} /><span>Poll</span>
            </button>
          </div>
        )}

        {activeTab === 'home' ? (
          <div className={`chat-thread-container ai-chat ${aiConversation.length > 0 ? 'has-messages' : ''} ${firstHomeEntry ? 'home-entry' : ''}`}>
            {aiConversation.length === 0 ? (
              <div className="chat-thread-messages">
                <div className="ai-welcome">
                  <h1 className="landing-header">Let's text someone</h1>
                  <div className={`chat-input-wrapper${replyTo ? ' has-reply' : ''}`}>
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
                        <span className="ai-thinking">thinking...</span>
                      </div>
                    </div>
                  )}
                </div>
                {aiContextMenu && (
                  <div className="context-menu" style={{ left: aiContextMenu.x, top: aiContextMenu.y }} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => { e.preventDefault(); closeAiContextMenu() }}>
                    <button className="context-menu-item" onClick={copyAiMessage}><Copy size={14} /><span>Copy</span></button>
                  </div>
                )}
                <div className="chat-thread-input-container">
              <div className={`chat-input-wrapper${replyTo ? ' has-reply' : ''}${pendingAttachments.length > 0 ? ' has-attachment' : ''}`}>
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
                <button className="chat-header-action-btn" title="More" onClick={(e) => {
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
                  <button className="context-menu-item" onClick={() => setClearChatSubmenu(true)}><Trash2 size={14} /><span>Clear chat</span></button>
                ) : (
                  <>
                    <button className="context-menu-item" onClick={() => { if (activeChatId) clearChat(activeChatId, false); setClearChatSubmenu(false) }}><User size={14} /><span>Clear for me</span></button>
                    <button className="context-menu-item" onClick={() => { if (activeChatId) clearChat(activeChatId, true); setClearChatSubmenu(false) }}><Users size={14} /><span>Clear for everyone</span></button>
                  </>
                )}
              </div>
            )}

            <div className="chat-thread-messages" onContextMenu={(e) => e.preventDefault()}>
              {messages.map(msg => (
                <div key={msg.id} id={`msg-${msg.id}`} className={`message-row ${msg.sender === 'me' ? 'sender-me' : 'sender-them'}`}
                  onContextMenu={(e) => handleContextMenu(e, msg.id)}>
                  <div className="message-bubble">
                    {msg.replyToId && (msg.replyText || msg.replyAttachmentUrl) && (
                      <div className="message-reply" onClick={() => { const el = document.getElementById(`msg-${msg.replyToId}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                        <div className="message-reply-line" />
                        <div className="message-reply-text">{msg.replyAttachmentUrl && !msg.replyText ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{msg.replyAttachmentType === 'image' ? <><Image size={14} /> Photo</> : <><File size={14} /> File</>}</span> : msg.replyText}</div>
                      </div>
                    )}
                    {msg.attachmentUrl && (
                      <div className="message-attachment">
                        {msg.attachmentType === 'image' ? (
                          <img src={`http://localhost:3001${msg.attachmentUrl}`} alt="" className="message-attachment-image" onClick={() => setFullscreenImage(`http://localhost:3001${msg.attachmentUrl}`)} />
                        ) : (
                          <a href={`http://localhost:3001${msg.attachmentUrl}`} target="_blank" rel="noopener noreferrer" className="message-attachment-file">
                            <File size={18} /><span>Document</span>
                          </a>
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
                    {msg.text && <div className="message-text">{renderMessageText(msg.text)}</div>}
                    <div className="message-meta">
                      <span className="message-time">{msg.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {contextMenu && (
              <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
                <button className="context-menu-item" onClick={replyMessage}><Reply size={14} /><span>Reply</span></button>
                <button className="context-menu-item" onClick={copyMessage}><Copy size={14} /><span>Copy</span></button>
                <button className="context-menu-item context-menu-item-danger" onClick={deleteMessage}><Trash2 size={14} /><span>Delete</span></button>
              </div>
            )}

            <div className="chat-thread-input-container">
              {replyTo && (
                <div className="reply-bar">
                  <div className="reply-line" />
                  <div className="reply-info">
                    <div className="reply-label">Reply</div>
                    <div className="reply-text">{replyTo.attachmentUrl && !replyTo.text ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{replyTo.attachmentType === 'image' ? <><Image size={14} /> Photo</> : <><File size={14} /> File</>}</span> : replyTo.text}</div>
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
                        <span className="pending-attachment-hint">{att.type === 'image' ? 'Photo' : 'Document'}</span>
                      </div>
                      <button className="pending-attachment-remove" onClick={() => setPendingAttachments(prev => prev.filter((_, i) => i !== idx))}><X size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="chat-input-wrapper">
                <button className="input-icon-btn" title="Add file" onClick={(e) => {
                  e.stopPropagation()
                  if (attachMenu) { closeAttachMenu(); return }
                  const rect = e.currentTarget.getBoundingClientRect()
                  setAttachMenu({ x: rect.left, y: rect.top - 90, dir: 'up' })
                }}>
                  <Plus size={18} />
                </button>
                <input
                  ref={el => void (chatInputRefs.current[activeChat.id] = el)}
                  type="text" className="chat-input" placeholder="Write a message..."
                  value={chatInputTexts[activeChat.id] || ''}
                  onChange={(e) => handleChatInputChange(activeChat.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(activeChat.id) }} />
                <button className={`send-btn${(chatInputTexts[activeChat.id] || '').trim() || pendingAttachments.length > 0 ? ' active' : ''}`} title="Send"
                  onClick={() => handleSendMessage(activeChat.id)}>
                  <ArrowUp size={18} />
                </button>
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
              <button className={`edit-profile-save${!hasEditChanges ? ' disabled' : ''}`} disabled={!hasEditChanges} onClick={() => {
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
        ) : activeTab === 'profile' && (activeChat || viewedUser) ? (
          <div className="profile-container">
            <div className="profile-top">
              <div className="profile-avatar-large" style={(viewedUser || contactProfile)?.avatar ? { backgroundImage: `url(${(viewedUser || contactProfile)?.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'transparent', cursor: 'pointer' } : {}}
                onClick={() => (viewedUser || contactProfile)?.avatar && setFullscreenImage((viewedUser || contactProfile)?.avatar!)}>
                {!(viewedUser || contactProfile)?.avatar && <User size={36} strokeWidth={1.5} />}
                <span className="online-dot online-dot-lg" />
              </div>
              <div className="profile-info-header">
                <div className="profile-name">{(viewedUser || contactProfile) ? `${(viewedUser || contactProfile)!.name} ${(viewedUser || contactProfile)!.surname}` : activeChat?.name}</div>
              </div>
              {(viewedUser || contactProfile)?.bio && <div className="profile-bio">{(viewedUser || contactProfile)?.bio}</div>}
            </div>
            <div className="profile-content">
              <div className="profile-section">
                <div className="profile-card">
                  <div className="profile-info-row"><span className="profile-info-label">Email</span><span className="profile-info-value click-to-copy" onClick={() => (viewedUser || contactProfile)?.email && copyField('Email', (viewedUser || contactProfile)!.email!)}>{(viewedUser || contactProfile)?.email || '—'}</span></div>
                  {(viewedUser || contactProfile)?.phone && <div className="profile-info-row"><span className="profile-info-label">Phone</span><span className="profile-info-value click-to-copy" onClick={() => copyField('Phone', (viewedUser || contactProfile)!.phone!)}>{(viewedUser || contactProfile)?.phone}</span></div>}
                  {(viewedUser || contactProfile)?.username && <div className="profile-info-row"><span className="profile-info-label">Username</span><span className="profile-info-value click-to-copy" onClick={() => copyField('Username', (viewedUser || contactProfile)!.username!)}>@{(viewedUser || contactProfile)?.username}</span></div>}
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
                      <div className="profile-info-row" onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'language', x: r.right - 180, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">Language</span><span className="profile-info-value">{settings.language}</span>
                      </div>
                    </div>
                  </div>
                  <div className="profile-section">
                    <h3 className="profile-section-title">Notifications</h3>
                    <div className="profile-card">
                      <div className="profile-info-row">
                        <span className="profile-info-label">Message previews</span>
                        <ToggleSwitch checked={settings.previews === 'On'} onChange={() => cycleSetting('previews', ['On', 'Off'])} />
                      </div>
                      <div className="profile-info-row">
                        <span className="profile-info-label">Sounds</span>
                        <ToggleSwitch checked={settings.sounds === 'On'} onChange={() => cycleSetting('sounds', ['On', 'Off'])} />
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
                      <div className="profile-info-row" onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'lastSeen', x: r.right - 180, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">Last seen</span><span className="profile-info-value">{settings.lastSeen}</span>
                      </div>
                      <div className="profile-info-row" onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'profilePhoto', x: r.right - 180, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">Profile photo</span><span className="profile-info-value">{settings.profilePhoto}</span>
                      </div>
                      <div className="profile-info-row" onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'phonePrivacy', x: r.right - 180, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">Phone</span><span className="profile-info-value">{settings.phonePrivacy}</span>
                      </div>
                      <div className="profile-info-row" onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'emailPrivacy', x: r.right - 180, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">Email</span><span className="profile-info-value">{settings.emailPrivacy}</span>
                      </div>
                      <div className="profile-info-row" onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setSettingDropdown({ key: 'bioPrivacy', x: r.right - 180, y: r.bottom }) }} style={{ cursor: 'pointer' }}>
                        <span className="profile-info-label">Bio</span><span className="profile-info-value">{settings.bioPrivacy}</span>
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

    {chatContextMenu && (
      <div className="context-menu" style={{ left: chatContextMenu.x, top: chatContextMenu.y }} onClick={(e) => e.stopPropagation()}>
        <button className="context-menu-item" onClick={() => chatContextMenu && togglePinChat(chatContextMenu.chatId)}>
          <Pin size={14} /><span>{chats.find(c => c.id === chatContextMenu.chatId)?.pinned ? 'Unpin' : 'Pin'}</span>
        </button>
        <button className="context-menu-item" onClick={() => chatContextMenu && setFolderDropdown({ chatId: chatContextMenu.chatId, x: chatContextMenu.x + 190, y: chatContextMenu.y })}>
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
          <Plus size={14} /><span>New folder</span>
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

    {newChatCtxMenu && (
      <div className="context-menu" style={{ left: newChatCtxMenu.x, top: newChatCtxMenu.y }} onClick={(e) => e.stopPropagation()}>
        <button className="context-menu-item" onClick={() => { setNewChatCtxMenu(null); setFolderEditOpen(true) }}>
          <Folder size={14} /><span>Edit folders</span>
        </button>
        {(activeTab === 'home' ? aiConversation.length > 0 : messages.length > 0) && (
          <button className="context-menu-item" onClick={handleClearActiveChat}>
            <Trash2 size={14} /><span>Clear chat</span>
          </button>
        )}
      </div>
    )}

    {folderEditOpen && (
      <div className="dialog-overlay" onClick={() => setFolderEditOpen(false)}>
        <div className="dialog dialog-ef" onClick={e => e.stopPropagation()}>
          <div className="dialog-header">
            <div className="dialog-title">Edit folders</div>
            <button className="dialog-close" onClick={() => setFolderEditOpen(false)}><X size={16} /></button>
          </div>

          <div className="dialog-ef-list">
            {folders.map(folder => (
              <div key={folder.id} className="dialog-ef-card">
                <div className="dialog-ef-card-header" onClick={() => setExpandedFolderId(expandedFolderId === folder.id ? null : folder.id)}>
                  <Folder size={16} />
                  <span className="dialog-ef-card-name">{folder.name}</span>
                  <span className="dialog-ef-card-count">{folder.chats.length}</span>
                  <ChevronDown size={14} className={`dialog-ef-card-arrow${expandedFolderId === folder.id ? ' open' : ''}`} />
                </div>

                {expandedFolderId === folder.id && (
                  <div className="dialog-ef-card-body">
                    {folder.chats.length > 0 && (
                      <div className="dialog-ef-chats">
                        {chats.filter(c => folder.chats.includes(c.id)).map(chat => (
                          <div key={chat.id} className="dialog-ef-chat-row">
                            <User size={13} />
                            <span className="dialog-ef-chat-name">{chat.name}</span>
                            <button className="dialog-ef-chat-remove" onClick={() => {
                              api(`/folders/${folder.id}/chats/${chat.id}`, { method: 'DELETE' }).then(() => {
                                setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, chats: f.chats.filter(c => c !== chat.id) } : f))
                              })
                            }}><X size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="dialog-ef-add-area">
                      {chats.filter(c => !folder.chats.includes(c.id) && c.name !== 'Opus').length > 0 ? (
                        <select className="dialog-ef-select" defaultValue="" onChange={e => {
                          if (!e.target.value) return
                          const chatId = parseInt(e.target.value)
                          api(`/folders/${folder.id}/chats/${chatId}`, { method: 'POST' }).then(() => {
                            setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, chats: [...f.chats, chatId] } : f))
                          })
                          e.target.value = ''
                        }}>
                          <option value="" disabled>Add chat...</option>
                          {chats.filter(c => !folder.chats.includes(c.id) && c.name !== 'Opus').map(chat => (
                            <option key={chat.id} value={chat.id}>{chat.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="dialog-ef-no-chats">All chats are in this folder</span>
                      )}
                    </div>

                    <div className="dialog-ef-actions">
                      <button className="dialog-ef-action" onClick={() => renameFolder(folder.id)}><Pencil size={12} /> Rename</button>
                      <button className="dialog-ef-action dialog-ef-action-danger" onClick={() => deleteFolder(folder.id)}><Trash2 size={12} /> Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="dialog-row">
            <input className="dialog-input" placeholder="New folder name" value={folderEditInput}
              onChange={e => setFolderEditInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && folderEditInput.trim()) { createFolder(folderEditInput.trim()); setFolderEditInput('') } }} />
            <button className="dialog-btn dialog-btn-primary" onClick={() => { if (folderEditInput.trim()) { createFolder(folderEditInput.trim()); setFolderEditInput('') } }}>Create</button>
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
