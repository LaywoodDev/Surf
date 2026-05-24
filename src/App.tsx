import { useState, useEffect, useRef } from 'react'
import { Plus, Search, ArrowUp, User, Copy, Trash2, Image, File, Camera, MapPin, Link2, Mic, Users } from 'lucide-react'
import './App.css'

interface SearchItem {
  id: number
  name: string
  subtext: string
}

const MOCK_SEARCH_ITEMS: SearchItem[] = [
  { id: 1, name: 'Mom', subtext: 'I have geometry exam issues' },
  { id: 2, name: 'Dad', subtext: 'https://t.me/OpusAssistantBot' },
  { id: 3, name: 'Igor', subtext: 'Which one?' },
  { id: 4, name: 'Egor', subtext: 'Hello' },
  { id: 5, name: 'Mom', subtext: 'I have geometry exam issues' },
  { id: 6, name: 'Dad', subtext: 'https://t.me/OpusAssistantBot' },
  { id: 7, name: 'Igor', subtext: 'Which one?' },
  { id: 8, name: 'Egor', subtext: 'Hello' },
]

interface Message {
  id: number
  sender: 'me' | 'them'
  text: string
  time: string
}

interface Chat {
  id: number
  name: string
  lastMessage: string
  time: string
  messages: Message[]
  bio?: string
  phone?: string
  username?: string
  media: {
    photos: number
    videos: number
    files: number
    links: number
    voice: number
    groups: number
  }
}

const INITIAL_CHATS: Chat[] = [
  {
    id: 1,
    name: 'Mom',
    lastMessage: 'I have geometry exam issues',
    time: '12:30',
    bio: 'The best mom in the world 💕',
    phone: '+7 (912) 345-67-89',
    username: '@mamochka',
    media: { photos: 12, videos: 3, files: 5, links: 2, voice: 8, groups: 1 },
    messages: [
      { id: 1, sender: 'them', text: 'Where are you?', time: '12:25' },
      { id: 2, sender: 'them', text: 'I have geometry exam issues', time: '12:26' },
      { id: 3, sender: 'me', text: 'Im at school, be there soon', time: '12:28' },
      { id: 4, sender: 'them', text: 'Okay, waiting at home', time: '12:30' }
    ]
  },
  {
    id: 2,
    name: 'Dad',
    lastMessage: 'https://t.me/OpusAssistantBot',
    time: 'Yesterday',
    bio: 'Businessman, traveler',
    phone: '+7 (903) 123-45-67',
    username: '@papa_boss',
    media: { photos: 24, videos: 7, files: 15, links: 10, voice: 2, groups: 3 },
    messages: [
      { id: 1, sender: 'them', text: 'Hey, heres the bot link:', time: 'Yesterday 18:15' },
      { id: 2, sender: 'them', text: 'https://t.me/OpusAssistantBot', time: 'Yesterday 18:16' }
    ]
  },
  {
    id: 3,
    name: 'Igor',
    lastMessage: 'Which one?',
    time: 'Mon',
    bio: 'Classmate',
    phone: '+7 (995) 555-12-34',
    username: '@igor_chan',
    media: { photos: 5, videos: 1, files: 3, links: 6, voice: 0, groups: 2 },
    messages: [
      { id: 1, sender: 'them', text: 'Hey! Meeting tomorrow?', time: 'Mon 14:02' },
      { id: 2, sender: 'me', text: 'Yeah, sure. What time?', time: 'Mon 14:10' },
      { id: 3, sender: 'them', text: 'Which one?', time: 'Mon 14:15' }
    ]
  },
  {
    id: 4,
    name: 'Egor',
    lastMessage: 'Hello',
    time: 'Fri',
    bio: 'Old friend',
    phone: '+7 (916) 777-88-99',
    username: '@egor_egorov',
    media: { photos: 0, videos: 0, files: 1, links: 0, voice: 0, groups: 0 },
    messages: [
      { id: 1, sender: 'them', text: 'Hello', time: 'Fri 11:30' }
    ]
  }
]

function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'chat' | 'profile'>('home')
  const [activeChatId, setActiveChatId] = useState<number | null>(null)
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS)
  const [chatInputTexts, setChatInputTexts] = useState<Record<number, string>>({})
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
  
  const [inputText, setInputText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachMenu, setAttachMenu] = useState<{ x: number; y: number; dir: 'up' | 'down' } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; messageId: number } | null>(null)


  // Filter search items based on search query
  const filteredItems = MOCK_SEARCH_ITEMS.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.subtext.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeChat = chats.find(chat => chat.id === activeChatId)

  const handleSendMessage = (chatId: number) => {
    const text = chatInputTexts[chatId]?.trim()
    if (!text) return

    const newMessage: Message = {
      id: Date.now(),
      sender: 'me',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setChats(prevChats => prevChats.map(chat => {
      if (chat.id === chatId) {
        return {
          ...chat,
          lastMessage: text,
          time: newMessage.time,
          messages: [...chat.messages, newMessage]
        }
      }
      return chat
    }))

    setChatInputTexts(prev => ({
      ...prev,
      [chatId]: ''
    }))
  }

  const handleChatInputChange = (chatId: number, value: string) => {
    setChatInputTexts(prev => ({
      ...prev,
      [chatId]: value
    }))
  }

  const handleContextMenu = (e: React.MouseEvent, messageId: number) => {
    e.preventDefault()
    if (contextMenu) {
      closeContextMenu()
      return
    }
    setContextMenu({ x: e.clientX, y: e.clientY, messageId })
  }

  const closeContextMenu = () => {
    setContextMenu(null)
  }

  const closeAttachMenu = () => {
    setAttachMenu(null)
  }

  const copyMessage = () => {
    if (!contextMenu) return
    const chat = chats.find(c => c.id === activeChatId)
    if (!chat) return
    const msg = chat.messages.find(m => m.id === contextMenu.messageId)
    if (msg) navigator.clipboard.writeText(msg.text)
    closeContextMenu()
  }

  const deleteMessage = () => {
    if (!contextMenu) return
    setChats(prevChats => prevChats.map(chat => {
      if (chat.id === activeChatId) {
        return {
          ...chat,
          messages: chat.messages.filter(m => m.id !== contextMenu.messageId)
        }
      }
      return chat
    }))
    closeContextMenu()
  }

  useEffect(() => {
    const handleClick = () => {
      closeContextMenu()
      closeAttachMenu()
    }
    const handleScroll = () => {
      closeContextMenu()
      closeAttachMenu()
    }
    if (contextMenu || attachMenu) {
      document.addEventListener('click', handleClick)
      document.addEventListener('scroll', handleScroll, true)
    }
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [contextMenu, attachMenu])

  return (
    <div className="app-container">
      {/* SIDEBAR */}
      <aside 
        className={`sidebar ${isSidebarExpanded ? 'expanded' : 'collapsed'}`}
      >
        <div className="sidebar-top-section">
          {/* Logo */}
          <div className="sidebar-logo" onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}>
            <svg width="24" height="14" viewBox="0 0 24 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <mask id="mask0_1173_79" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="14">
                <path d="M0.188963 1.7392L6.82464 11.9946C7.16161 12.5153 7.85613 12.664 8.37683 12.327L14.5238 8.34973C14.7617 8.19573 15.0697 8.2003 15.303 8.36116L22.2314 13.1397C23.2423 13.8365 24.4781 12.6373 23.811 11.6066L17.1746 1.35116C16.8376 0.830456 16.1431 0.681795 15.6232 1.01876L9.47465 4.99682C9.23679 5.15082 8.92879 5.14624 8.6955 4.98538L1.7686 0.2076C0.757692 -0.489971 -0.478113 0.710003 0.188963 1.74073V1.7392Z" fill="url(#paint0_linear_1173_79)"/>
              </mask>
              <g mask="url(#mask0_1173_79)">
                <g filter="url(#filter0_f_1173_79)">
                  <circle cx="23.25" cy="9.74999" r="9.74999" fill="#3287FE"/>
                </g>
                <g filter="url(#filter1_f_1173_79)">
                  <circle cx="10.5" cy="14.25" r="9.74999" fill="#13B962"/>
                </g>
                <g filter="url(#filter2_f_1173_79)">
                  <circle cx="-1.50001" cy="2.24999" r="9.74999" fill="#F6BE11"/>
                </g>
                <g filter="url(#filter3_f_1173_79)">
                  <circle cx="12.75" cy="-1.50001" r="9.74999" fill="#FA4442"/>
                </g>
              </g>
              <defs>
                <filter id="filter0_f_1173_79" x="6.15" y="-7.35" width="34.2" height="34.2" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
                  <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                  <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                  <feGaussianBlur stdDeviation="3.675" result="effect1_foregroundBlur_1173_79"/>
                </filter>
                <filter id="filter1_f_1173_79" x="-6.6" y="-2.85" width="34.2" height="34.2" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
                  <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                  <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                  <feGaussianBlur stdDeviation="3.675" result="effect1_foregroundBlur_1173_79"/>
                </filter>
                <filter id="filter2_f_1173_79" x="-18.6" y="-14.85" width="34.2" height="34.2" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
                  <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                  <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                  <feGaussianBlur stdDeviation="3.675" result="effect1_foregroundBlur_1173_79"/>
                </filter>
                <filter id="filter3_f_1173_79" x="-4.35" y="-18.6" width="34.2" height="34.2" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
                  <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                  <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                  <feGaussianBlur stdDeviation="3.675" result="effect1_foregroundBlur_1173_79"/>
                </filter>
                <linearGradient id="paint0_linear_1173_79" x1="12" y1="0" x2="12" y2="13.347" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#E20736"/>
                  <stop offset="1" stopColor="#BEE000"/>
                </linearGradient>
              </defs>
            </svg>
            <span className="sidebar-logo-text">Surf</span>
          </div>
          {/* Sidebar Main Navigation */}
          <nav className="sidebar-navigation">
            {/* New Chat Button */}
            <button 
              className={`sidebar-nav-btn ${activeTab === 'home' && activeChatId === null ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setActiveTab('home')
                setActiveChatId(null)
              }}
              title="New chat"
            >
              <Plus size={18} />
              <span className="sidebar-text">New chat</span>
            </button>

            {/* Search Button */}
            <button 
              className={`sidebar-nav-btn ${activeTab === 'search' && activeChatId === null ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setActiveTab('search')
                setActiveChatId(null)
              }}
              title="Search"
            >
              <Search size={18} />
              <span className="sidebar-text">Search</span>
            </button>
          </nav>

          {/* Chats List */}
          <div className="sidebar-chat-list">
            {chats.map(chat => (
              <div 
                key={chat.id} 
                className={`sidebar-chat-item ${activeTab === 'chat' && activeChatId === chat.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveChatId(chat.id)
                  setActiveTab('chat')
                }}
                title={chat.name}
              >
                <div className="chat-item-avatar">
                  <User size={18} strokeWidth={1.5} />
                </div>
                <div className="chat-item-info">
                  <span className="chat-item-name">{chat.name}</span>
                  <span className="chat-item-message">{chat.lastMessage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Profile Footer */}
        <div className="sidebar-profile-footer" onClick={(e) => e.stopPropagation()}>
          <div className="profile-footer-content">
            <div className="sidebar-avatar" title="Profile" />
            <span className="profile-username">User</span>
          </div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <main className="main-area">
        <input 
          ref={fileInputRef}
          type="file" 
          style={{ display: 'none' }} 
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) alert(`Выбран файл: ${file.name}`)
            e.target.value = ''
          }}
        />

        {/* Attachment Menu */}
        {attachMenu && (
          <div 
            className="context-menu attach-menu-popup"
            style={{ left: attachMenu.x, top: attachMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="context-menu-item" onClick={() => { fileInputRef.current?.click(); closeAttachMenu() }}>
              <File size={14} />
              <span>File</span>
            </button>
            <button className="context-menu-item" onClick={() => { fileInputRef.current?.click(); setAttachMenu(null) }}>
              <Image size={14} />
              <span>Photo</span>
            </button>
            <button className="context-menu-item" onClick={() => { fileInputRef.current?.click(); setAttachMenu(null) }}>
              <Camera size={14} />
              <span>Camera</span>
            </button>
            <button className="context-menu-item" onClick={() => { fileInputRef.current?.click(); setAttachMenu(null) }}>
              <MapPin size={14} />
              <span>Location</span>
            </button>
            <button className="context-menu-item" onClick={() => { fileInputRef.current?.click(); closeAttachMenu() }}>
              <Camera size={14} />
              <span>Камера</span>
            </button>
            <button className="context-menu-item" onClick={() => { fileInputRef.current?.click(); closeAttachMenu() }}>
              <MapPin size={14} />
              <span>Локация</span>
            </button>
          </div>
        )}

        {activeTab === 'home' ? (
          /* HOME LANDING SCREEN (Home.jpg style with radial glow) */
          <div className="landing-content">
            <h1 className="landing-header">Let's text someone</h1>
            
            <div className="chat-input-container">
              <div className="chat-input-wrapper">
                {/* Plus Button inside input */}
                <button className="input-icon-btn" title="Add file" onClick={(e) => {
                  e.stopPropagation()
                  if (attachMenu) { closeAttachMenu(); return }
                  const rect = e.currentTarget.getBoundingClientRect()
                  setAttachMenu({ x: rect.left, y: rect.bottom + 4, dir: 'down' })
                }}>
                  <Plus size={18} />
                </button>
                
                {/* Text Input */}
                <input 
                  type="text" 
                  className="chat-input" 
                  placeholder="Ask Opus" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                
                {/* Send Button */}
                <button className={`send-btn${inputText.trim() ? ' active' : ''}`} title="Send">
                  <ArrowUp size={18} />
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'search' ? (
          /* SEARCH SCREEN (Search.png style) */
          <div className="search-content">
            {/* Search Input Bar */}
            <div className="search-bar-container">
              <div className="search-bar-wrapper">
                <Search size={18} className="search-bar-icon" />
                <input 
                  type="text" 
                  className="search-bar-input" 
                  placeholder="Search chats or people" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Recent Searches Section */}
            <div className="recent-section">
              <h2 className="recent-title">Recent</h2>
              
              <div className="recent-grid">
                {filteredItems.length > 0 ? (
                  filteredItems.map(item => (
                    <div key={item.id} className="recent-item">
                      <div className="item-avatar">
                        <User size={18} strokeWidth={1.5} />
                      </div>
                      <div className="item-content">
                        <div className="item-name">{item.name}</div>
                        <div className="item-subtext">{item.subtext}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="recent-empty">No results found</div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'chat' && activeChat ? (
          /* ACTIVE CHAT SCREEN */
          <div className="chat-thread-container">
            {/* Chat Thread Header */}
            <div className="chat-thread-header" onClick={() => setActiveTab('profile')} style={{ cursor: 'pointer' }}>
              <div className="chat-header-left">
                <div className="chat-header-avatar">
                  <User size={20} strokeWidth={1.5} />
                  <span className="online-dot" />
                </div>
                <div className="chat-header-info">
                  <div className="chat-header-name">{activeChat.name}</div>
                </div>
              </div>
            </div>

            {/* Chat Messages Body */}
            <div className="chat-thread-messages" onContextMenu={(e) => e.preventDefault()}>
              {activeChat.messages.map(msg => (
                <div 
                  key={msg.id} 
                  className={`message-row ${msg.sender === 'me' ? 'sender-me' : 'sender-them'}`}
                  onContextMenu={(e) => handleContextMenu(e, msg.id)}
                >
                  <div className="message-bubble">
                    <div className="message-text">{msg.text}</div>
                    <div className="message-time">{msg.time}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Context Menu */}
            {contextMenu && (
              <div 
                className="context-menu"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <button className="context-menu-item" onClick={copyMessage}>
                  <Copy size={14} />
                  <span>Copy</span>
                </button>
                <button className="context-menu-item context-menu-item-danger" onClick={deleteMessage}>
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            )}

            {/* Fixed Chat Input Box at Bottom */}
            <div className="chat-thread-input-container">
              <div className="chat-input-wrapper">
                {/* Plus Button inside input */}
                <button className="input-icon-btn" title="Add file" onClick={(e) => {
                  e.stopPropagation()
                  if (attachMenu) { closeAttachMenu(); return }
                  const rect = e.currentTarget.getBoundingClientRect()
                  setAttachMenu({ x: rect.left, y: rect.top - 176, dir: 'up' })
                }}>
                  <Plus size={18} />
                </button>
                
                {/* Text Input */}
                <input 
                  type="text" 
                  className="chat-input" 
                  placeholder="Write a message..." 
                  value={chatInputTexts[activeChat.id] || ''}
                  onChange={(e) => handleChatInputChange(activeChat.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSendMessage(activeChat.id)
                    }
                  }}
                />
                
                {/* Send Button */}
                <button 
                  className={`send-btn${(chatInputTexts[activeChat.id] || '').trim() ? ' active' : ''}`} 
                  title="Send"
                  onClick={() => handleSendMessage(activeChat.id)}
                >
                  <ArrowUp size={18} />
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'profile' && activeChat ? (
          <div className="profile-container">
            <div className="profile-top">
              <div className="profile-avatar-large">
                <User size={36} strokeWidth={1.5} />
                <span className="online-dot online-dot-lg" />
              </div>
              <div className="profile-info-header">
                <div className="profile-name">{activeChat.name}</div>
              </div>
              {activeChat.bio && <div className="profile-bio">{activeChat.bio}</div>}
            </div>
            <div className="profile-content">
              <div className="profile-section">
                <h3 className="profile-section-title">Contact</h3>
                <div className="profile-card">
                  {activeChat.phone && (
                    <div className="profile-info-row" onClick={() => navigator.clipboard.writeText(activeChat.phone!)} style={{ cursor: 'pointer' }}>
                      <span className="profile-info-label">Phone</span>
                      <span className="profile-info-value">{activeChat.phone}</span>
                    </div>
                  )}
                  {activeChat.username && (
                    <div className="profile-info-row" onClick={() => navigator.clipboard.writeText(activeChat.username!)} style={{ cursor: 'pointer' }}>
                      <span className="profile-info-label">Username</span>
                      <span className="profile-info-value">{activeChat.username}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="profile-section">
                <h3 className="profile-section-title">Media</h3>
                <div className="profile-card">
                  <div className="profile-media-grid">
                    <div className="profile-media-item">
                      <div className="profile-media-icon media-icon-photo"><Image size={16} /></div>
                      <span className="profile-media-label">Photos</span>
                      <span className="profile-media-count">{activeChat.media.photos}</span>
                    </div>
                    <div className="profile-media-item">
                      <div className="profile-media-icon media-icon-video"><Camera size={16} /></div>
                      <span className="profile-media-label">Video</span>
                      <span className="profile-media-count">{activeChat.media.videos}</span>
                    </div>
                    <div className="profile-media-item">
                      <div className="profile-media-icon media-icon-file"><File size={16} /></div>
                      <span className="profile-media-label">Files</span>
                      <span className="profile-media-count">{activeChat.media.files}</span>
                    </div>
                    <div className="profile-media-item">
                      <div className="profile-media-icon media-icon-link"><Link2 size={16} /></div>
                      <span className="profile-media-label">Links</span>
                      <span className="profile-media-count">{activeChat.media.links}</span>
                    </div>
                    <div className="profile-media-item">
                      <div className="profile-media-icon media-icon-voice"><Mic size={16} /></div>
                      <span className="profile-media-label">Voice</span>
                      <span className="profile-media-count">{activeChat.media.voice}</span>
                    </div>
                    <div className="profile-media-item">
                      <div className="profile-media-icon media-icon-groups"><Users size={16} /></div>
                      <span className="profile-media-label">Groups</span>
                      <span className="profile-media-count">{activeChat.media.groups}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="landing-empty">Select a chat or open search</div>
        )}
      </main>
    </div>
  )
}

export default App
