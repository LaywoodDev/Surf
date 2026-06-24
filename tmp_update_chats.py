import re

with open('server/src/routes/chats.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update GET /
old_get = '''router.get('/', (req: AuthRequest, res: Response) => {
  const chats = db.prepare(`
    SELECT c.id, 
      COALESCE(
        (SELECT u.name || ' ' || NULLIF(u.surname, '') 
         FROM users u 
         JOIN chat_participants cp2 ON cp2.user_id = u.id 
         WHERE cp2.chat_id = c.id AND cp2.user_id != ?),
        c.name
      ) as name,
      (SELECT u.id FROM users u JOIN chat_participants cp2 ON cp2.user_id = u.id WHERE cp2.chat_id = c.id AND cp2.user_id != ?) as participantId,
      (SELECT u.avatar FROM users u JOIN chat_participants cp2 ON cp2.user_id = u.id WHERE cp2.chat_id = c.id AND cp2.user_id != ?) as participantAvatar,
      (SELECT u.last_seen FROM users u JOIN chat_participants cp2 ON cp2.user_id = u.id WHERE cp2.chat_id = c.id AND cp2.user_id != ?) as participantLastSeen,
      (SELECT u.privacy FROM users u JOIN chat_participants cp2 ON cp2.user_id = u.id WHERE cp2.chat_id = c.id AND cp2.user_id != ?) as participantPrivacy,
      (SELECT text FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as lastMessage,
      (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as time,
      cp.pinned as pinned
    FROM chats c
    JOIN chat_participants cp ON cp.chat_id = c.id
    WHERE cp.user_id = ?
    ORDER BY cp.pinned DESC, time DESC
  `).all(req.userId, req.userId, req.userId, req.userId, req.userId, req.userId)

  res.json(chats.map((c: any) => {
    const online = c.participantLastSeen ? (Date.now() - new Date(c.participantLastSeen + 'Z').getTime() < 30000) : false
    const pp = JSON.parse(c.participantPrivacy || '{"profilePhoto":"Everyone","lastSeen":"Everyone"}')
    if (pp.profilePhoto === 'Nobody') c.participantAvatar = null
    const showLastSeen = pp.lastSeen !== 'Nobody'
    const { participantPrivacy, ...rest } = c
    return {
      ...rest,
      participantOnline: showLastSeen ? online : false,
      participantLastSeen: showLastSeen ? c.participantLastSeen : null,
      pinned: !!c.pinned,
      time: c.time ? new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
    }
  }))
})'''

new_get = '''router.get('/', (req: AuthRequest, res: Response) => {
  const chats = db.prepare(`
    SELECT c.id, 
      c.name,
      c.is_group as isGroup,
      c.avatar as avatar,
      (SELECT COUNT(*) FROM chat_participants WHERE chat_id = c.id) as participantCount,
      (SELECT u.name || ' ' || NULLIF(u.surname, '') 
       FROM users u 
       JOIN chat_participants cp2 ON cp2.user_id = u.id 
       WHERE cp2.chat_id = c.id AND cp2.user_id != ?) as displayName,
      (SELECT u.id FROM users u JOIN chat_participants cp2 ON cp2.user_id = u.id WHERE cp2.chat_id = c.id AND cp2.user_id != ?) as participantId,
      (SELECT u.avatar FROM users u JOIN chat_participants cp2 ON cp2.user_id = u.id WHERE cp2.chat_id = c.id AND cp2.user_id != ?) as participantAvatar,
      (SELECT u.last_seen FROM users u JOIN chat_participants cp2 ON cp2.user_id = u.id WHERE cp2.chat_id = c.id AND cp2.user_id != ?) as participantLastSeen,
      (SELECT u.privacy FROM users u JOIN chat_participants cp2 ON cp2.user_id = u.id WHERE cp2.chat_id = c.id AND cp2.user_id != ?) as participantPrivacy,
      (SELECT text FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as lastMessage,
      (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as time,
      cp.pinned as pinned
    FROM chats c
    JOIN chat_participants cp ON cp.chat_id = c.id
    WHERE cp.user_id = ?
    ORDER BY cp.pinned DESC, time DESC
  `).all(req.userId, req.userId, req.userId, req.userId, req.userId, req.userId)

  res.json(chats.map((c: any) => {
    const isGroup = c.isGroup === 1
    const name = isGroup ? c.name : (c.displayName || c.name)
    const online = !isGroup && c.participantLastSeen ? (Date.now() - new Date(c.participantLastSeen + 'Z').getTime() < 30000) : false
    const pp = JSON.parse(c.participantPrivacy || '{"profilePhoto":"Everyone","lastSeen":"Everyone"}')
    if (!isGroup && pp.profilePhoto === 'Nobody') c.participantAvatar = null
    const showLastSeen = !isGroup && pp.lastSeen !== 'Nobody'
    const { participantPrivacy, displayName, ...rest } = c
    return {
      ...rest,
      name,
      isGroup,
      participantCount: c.participantCount,
      avatar: isGroup ? c.avatar : undefined,
      participantId: isGroup ? undefined : c.participantId,
      participantAvatar: isGroup ? undefined : c.participantAvatar,
      participantOnline: isGroup ? undefined : (showLastSeen ? online : false),
      participantLastSeen: isGroup ? undefined : (showLastSeen ? c.participantLastSeen : null),
      pinned: !!c.pinned,
      time: c.time ? new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
    }
  }))
})'''

if old_get not in content:
    print('ERROR: GET / block not found')
    exit(1)
content = content.replace(old_get, new_get)

# 2. Update POST / to include is_group=0 and role
old_post = '''router.post('/', (req: AuthRequest, res: Response) => {
  const { name, participantId } = req.body
  if (!name || !participantId) {
    res.status(400).json({ error: 'Chat name and participantId are required' })
    return
  }

  const existingChat = db.prepare(`
    SELECT c.id
    FROM chats c
    JOIN chat_participants cp1 ON cp1.chat_id = c.id
    JOIN chat_participants cp2 ON cp2.chat_id = c.id
    WHERE cp1.user_id = ? AND cp2.user_id = ?
  `).get(req.userId, participantId) as any

  if (existingChat) {
    res.json({ id: existingChat.id, name, participantId, lastMessage: '', time: '' })
    return
  }

  const chat = db.prepare('INSERT INTO chats (name) VALUES (?)').run(name)
  const chatId = chat.lastInsertRowid as number

  db.prepare('INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?)').run(chatId, req.userId)
  db.prepare('INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?)').run(chatId, participantId)

  res.status(201).json({ id: chatId, name, participantId, lastMessage: '', time: '' })
})'''

new_post = '''router.post('/', (req: AuthRequest, res: Response) => {
  const { name, participantId } = req.body
  if (!name || !participantId) {
    res.status(400).json({ error: 'Chat name and participantId are required' })
    return
  }

  const existingChat = db.prepare(`
    SELECT c.id
    FROM chats c
    JOIN chat_participants cp1 ON cp1.chat_id = c.id
    JOIN chat_participants cp2 ON cp2.chat_id = c.id
    WHERE cp1.user_id = ? AND cp2.user_id = ? AND c.is_group = 0
  `).get(req.userId, participantId) as any

  if (existingChat) {
    res.json({ id: existingChat.id, name, participantId, lastMessage: '', time: '' })
    return
  }

  const chat = db.prepare('INSERT INTO chats (name, is_group) VALUES (?, 0)').run(name)
  const chatId = chat.lastInsertRowid as number

  db.prepare('INSERT INTO chat_participants (chat_id, user_id, role) VALUES (?, ?, ?)').run(chatId, req.userId, 'admin')
  db.prepare('INSERT INTO chat_participants (chat_id, user_id, role) VALUES (?, ?, ?)').run(chatId, participantId, 'admin')

  res.status(201).json({ id: chatId, name, participantId, lastMessage: '', time: '' })
})'''

if old_post not in content:
    print('ERROR: POST / block not found')
    exit(1)
content = content.replace(old_post, new_post)

# 3. Update find-or-create
old_find = '''router.post('/find-or-create', (req: AuthRequest, res: Response) => {
  const { username } = req.body
  if (!username) {
    res.status(400).json({ error: 'Username is required' })
    return
  }

  const otherUser = db.prepare('SELECT id, name, surname FROM users WHERE username = ?').get(username) as any
  if (!otherUser) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const existingChat = db.prepare(`
    SELECT c.id 
    FROM chats c
    JOIN chat_participants cp1 ON cp1.chat_id = c.id
    JOIN chat_participants cp2 ON cp2.chat_id = c.id
    WHERE cp1.user_id = ? AND cp2.user_id = ?
  `).get(req.userId, otherUser.id) as any

  if (existingChat) {
    res.json({ id: existingChat.id, name: `${otherUser.name} ${otherUser.surname || ''}`.trim(), participantId: otherUser.id })
    return
  }

  const chatName = `${otherUser.name} ${otherUser.surname || ''}`.trim()
  const chat = db.prepare('INSERT INTO chats (name) VALUES (?)').run(chatName)
  const chatId = chat.lastInsertRowid as number

  db.prepare('INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?)').run(chatId, req.userId)
  db.prepare('INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?)').run(chatId, otherUser.id)

  res.status(201).json({ id: chatId, name: chatName, participantId: otherUser.id })
})'''

new_find = '''router.post('/find-or-create', (req: AuthRequest, res: Response) => {
  const { username } = req.body
  if (!username) {
    res.status(400).json({ error: 'Username is required' })
    return
  }

  const otherUser = db.prepare('SELECT id, name, surname FROM users WHERE username = ?').get(username) as any
  if (!otherUser) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const existingChat = db.prepare(`
    SELECT c.id 
    FROM chats c
    JOIN chat_participants cp1 ON cp1.chat_id = c.id
    JOIN chat_participants cp2 ON cp2.chat_id = c.id
    WHERE cp1.user_id = ? AND cp2.user_id = ? AND c.is_group = 0
  `).get(req.userId, otherUser.id) as any

  if (existingChat) {
    res.json({ id: existingChat.id, name: `${otherUser.name} ${otherUser.surname || ''}`.trim(), participantId: otherUser.id })
    return
  }

  const chatName = `${otherUser.name} ${otherUser.surname || ''}`.trim()
  const chat = db.prepare('INSERT INTO chats (name, is_group) VALUES (?, 0)').run(chatName)
  const chatId = chat.lastInsertRowid as number

  db.prepare('INSERT INTO chat_participants (chat_id, user_id, role) VALUES (?, ?, ?)').run(chatId, req.userId, 'admin')
  db.prepare('INSERT INTO chat_participants (chat_id, user_id, role) VALUES (?, ?, ?)').run(chatId, otherUser.id, 'admin')

  res.status(201).json({ id: chatId, name: chatName, participantId: otherUser.id })
})'''

if old_find not in content:
    print('ERROR: find-or-create block not found')
    exit(1)
content = content.replace(old_find, new_find)

# 4. Update GET /:id/messages to include senderAvatar
old_get_messages = '''  const messages = db.prepare(`
    SELECT m.id, m.text, m.sender_id as senderId, m.created_at as createdAt,
      m.reply_to_id as replyToId,
      m.attachment_url as attachmentUrl,
      m.attachment_type as attachmentType,
      m.poll_id as pollId,
      m.status,
      u.name as senderName,
      ru.text as replyText,
      ru.attachment_url as replyAttachmentUrl,
      ru.attachment_type as replyAttachmentType
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN messages ru ON ru.id = m.reply_to_id
    LEFT JOIN deleted_messages dm ON dm.message_id = m.id AND dm.user_id = ?
    WHERE m.chat_id = ? ${cleared ? 'AND m.created_at > ?' : ''} AND dm.message_id IS NULL
    ORDER BY m.created_at ASC
  `).all(cleared ? [req.userId, id, cleared.cleared_at] : [req.userId, id])'''

new_get_messages = '''  const messages = db.prepare(`
    SELECT m.id, m.text, m.sender_id as senderId, m.created_at as createdAt,
      m.reply_to_id as replyToId,
      m.attachment_url as attachmentUrl,
      m.attachment_type as attachmentType,
      m.poll_id as pollId,
      m.status,
      u.name as senderName,
      u.avatar as senderAvatar,
      ru.text as replyText,
      ru.attachment_url as replyAttachmentUrl,
      ru.attachment_type as replyAttachmentType
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN messages ru ON ru.id = m.reply_to_id
    LEFT JOIN deleted_messages dm ON dm.message_id = m.id AND dm.user_id = ?
    WHERE m.chat_id = ? ${cleared ? 'AND m.created_at > ?' : ''} AND dm.message_id IS NULL
    ORDER BY m.created_at ASC
  `).all(cleared ? [req.userId, id, cleared.cleared_at] : [req.userId, id])'''

if old_get_messages not in content:
    print('ERROR: GET messages block not found')
    exit(1)
content = content.replace(old_get_messages, new_get_messages)

# Update response mapping for messages to include senderAvatar
old_msg_map = '''  res.json(messages.map((m: any) => ({
    id: m.id,
    sender: m.senderId === req.userId ? 'me' : 'them',
    text: m.text,
    time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: m.createdAt,
    senderName: m.senderName,
    replyToId: m.replyToId,
    replyText: m.replyText,
    replyAttachmentUrl: m.replyAttachmentUrl,
    replyAttachmentType: m.replyAttachmentType,
    attachmentUrl: m.attachmentUrl,
    attachmentType: m.attachmentType,
    pollId: m.pollId || undefined,
    status: m.senderId === req.userId ? (m.status || 'sent') : undefined
  })))'''

new_msg_map = '''  res.json(messages.map((m: any) => ({
    id: m.id,
    sender: m.senderId === req.userId ? 'me' : 'them',
    text: m.text,
    time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: m.createdAt,
    senderId: m.senderId,
    senderName: m.senderName,
    senderAvatar: m.senderAvatar,
    replyToId: m.replyToId,
    replyText: m.replyText,
    replyAttachmentUrl: m.replyAttachmentUrl,
    replyAttachmentType: m.replyAttachmentType,
    attachmentUrl: m.attachmentUrl,
    attachmentType: m.attachmentType,
    pollId: m.pollId || undefined,
    status: m.senderId === req.userId ? (m.status || 'sent') : undefined
  })))'''

if old_msg_map not in content:
    print('ERROR: messages response map not found')
    exit(1)
content = content.replace(old_msg_map, new_msg_map)

# 5. Update POST /:id/messages response to include senderName and senderAvatar
old_post_msg_user = '''  const userMsg = {
    id: result.lastInsertRowid,
    sender: 'me',
    text: text?.trim() || '',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: new Date().toISOString(),
    replyToId: replyTo || undefined,
    replyText,
    replyAttachmentUrl,
    replyAttachmentType,
    attachmentUrl: attachmentUrl || undefined,
    attachmentType: attachmentType || undefined,
    status: 'sent'
  }'''

new_post_msg_user = '''  const sender = db.prepare('SELECT name, avatar FROM users WHERE id = ?').get(req.userId) as any
  const userMsg = {
    id: result.lastInsertRowid,
    sender: 'me',
    text: text?.trim() || '',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: new Date().toISOString(),
    senderId: req.userId,
    senderName: sender?.name,
    senderAvatar: sender?.avatar,
    replyToId: replyTo || undefined,
    replyText,
    replyAttachmentUrl,
    replyAttachmentType,
    attachmentUrl: attachmentUrl || undefined,
    attachmentType: attachmentType || undefined,
    status: 'sent'
  }'''

if old_post_msg_user not in content:
    print('ERROR: POST messages userMsg block not found')
    exit(1)
content = content.replace(old_post_msg_user, new_post_msg_user)

# Update aiMsg response too
old_ai_msg = '''      const aiMsg = {
        id: aiResult.lastInsertRowid,
        sender: 'them' as const,
        text: aiResponse,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        replyToId: result.lastInsertRowid,
        replyText: text.trim(),
      }'''

new_ai_msg = '''      const aiMsg = {
        id: aiResult.lastInsertRowid,
        sender: 'them' as const,
        text: aiResponse,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        senderId: opusUserId,
        senderName: 'Opus',
        replyToId: result.lastInsertRowid,
        replyText: text.trim(),
      }'''

if old_ai_msg not in content:
    print('ERROR: aiMsg block not found')
    exit(1)
content = content.replace(old_ai_msg, new_ai_msg)

# 6. Update other-user endpoint for groups
old_other_user = '''router.get('/:id/other-user', (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const user = db.prepare(`
    SELECT u.id, u.name, u.surname, u.email, u.username, u.phone, u.bio, u.privacy, u.last_seen, u.avatar
    FROM users u
    JOIN chat_participants cp ON cp.user_id = u.id
    WHERE cp.chat_id = ? AND u.id != ?
  `).get(id, req.userId) as any

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }'''

new_other_user = '''router.get('/:id/other-user', (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const chat = db.prepare('SELECT is_group FROM chats WHERE id = ?').get(id) as any
  if (chat && chat.is_group === 1) {
    res.status(404).json({ error: 'Group chat' })
    return
  }

  const user = db.prepare(`
    SELECT u.id, u.name, u.surname, u.email, u.username, u.phone, u.bio, u.privacy, u.last_seen, u.avatar
    FROM users u
    JOIN chat_participants cp ON cp.user_id = u.id
    WHERE cp.chat_id = ? AND u.id != ?
  `).get(id, req.userId) as any

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }'''

if old_other_user not in content:
    print('ERROR: other-user block not found')
    exit(1)
content = content.replace(old_other_user, new_other_user)

# 7. Update DELETE /:id to only allow creator/admin for groups
old_delete_chat = '''router.delete('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const participant = db.prepare(
    'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(id, req.userId)

  if (!participant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  db.prepare('DELETE FROM messages WHERE chat_id = ?').run(id)
  db.prepare('DELETE FROM chat_participants WHERE chat_id = ?').run(id)
  db.prepare('DELETE FROM chats WHERE id = ?').run(id)

  res.json({ success: true })
})'''

new_delete_chat = '''router.delete('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const participant = db.prepare(
    'SELECT role FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(id, req.userId) as any

  if (!participant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  const chat = db.prepare('SELECT is_group FROM chats WHERE id = ?').get(id) as any
  if (chat && chat.is_group === 1 && participant.role !== 'admin') {
    res.status(403).json({ error: 'Only admin can delete group' })
    return
  }

  db.prepare('DELETE FROM messages WHERE chat_id = ?').run(id)
  db.prepare('DELETE FROM chat_participants WHERE chat_id = ?').run(id)
  db.prepare('DELETE FROM chats WHERE id = ?').run(id)

  res.json({ success: true })
})'''

if old_delete_chat not in content:
    print('ERROR: DELETE chat block not found')
    exit(1)
content = content.replace(old_delete_chat, new_delete_chat)

# Add new endpoints before export
new_endpoints = '''
router.post('/group', (req: AuthRequest, res: Response) => {
  const { name, participantIds } = req.body
  if (!name?.trim() || !Array.isArray(participantIds) || participantIds.length === 0) {
    res.status(400).json({ error: 'Group name and at least one participant are required' })
    return
  }

  const uniqueIds = Array.from(new Set([...participantIds, req.userId]))
  const chat = db.prepare('INSERT INTO chats (name, is_group) VALUES (?, 1)').run(name.trim())
  const chatId = chat.lastInsertRowid as number

  const insertParticipant = db.prepare('INSERT INTO chat_participants (chat_id, user_id, role) VALUES (?, ?, ?)')
  uniqueIds.forEach((userId: number) => {
    insertParticipant.run(chatId, userId, userId === req.userId ? 'admin' : 'member')
  })

  res.status(201).json({ id: chatId, name: name.trim(), isGroup: true, participantCount: uniqueIds.length, lastMessage: '', time: '' })
})

router.get('/:id/participants', (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const participant = db.prepare(
    'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(id, req.userId)

  if (!participant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  const participants = db.prepare(`
    SELECT u.id, u.name, u.surname, u.username, u.avatar, cp.role
    FROM users u
    JOIN chat_participants cp ON cp.user_id = u.id
    WHERE cp.chat_id = ?
    ORDER BY CASE WHEN cp.role = 'admin' THEN 0 ELSE 1 END, u.name
  `).all(id)

  res.json(participants)
})

router.post('/:id/participants', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { userId } = req.body

  if (!userId) {
    res.status(400).json({ error: 'userId is required' })
    return
  }

  const currentParticipant = db.prepare(
    'SELECT role FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(id, req.userId) as any

  if (!currentParticipant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  const chat = db.prepare('SELECT is_group FROM chats WHERE id = ?').get(id) as any
  if (!chat || chat.is_group !== 1) {
    res.status(400).json({ error: 'Not a group chat' })
    return
  }

  if (currentParticipant.role !== 'admin') {
    res.status(403).json({ error: 'Only admin can add participants' })
    return
  }

  const existing = db.prepare('SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?').get(id, userId)
  if (existing) {
    res.status(409).json({ error: 'User already in group' })
    return
  }

  db.prepare('INSERT INTO chat_participants (chat_id, user_id, role) VALUES (?, ?, ?)').run(id, userId, 'member')
  res.status(201).json({ success: true })
})

router.delete('/:id/participants/:userId', (req: AuthRequest, res: Response) => {
  const { id, userId } = req.params
  const targetUserId = parseInt(userId)

  const currentParticipant = db.prepare(
    'SELECT role FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(id, req.userId) as any

  if (!currentParticipant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  const chat = db.prepare('SELECT is_group FROM chats WHERE id = ?').get(id) as any
  if (!chat || chat.is_group !== 1) {
    res.status(400).json({ error: 'Not a group chat' })
    return
  }

  const isSelf = targetUserId === req.userId
  if (!isSelf && currentParticipant.role !== 'admin') {
    res.status(403).json({ error: 'Only admin can remove participants' })
    return
  }

  if (!isSelf) {
    const target = db.prepare('SELECT role FROM chat_participants WHERE chat_id = ? AND user_id = ?').get(id, targetUserId) as any
    if (!target) {
      res.status(404).json({ error: 'Participant not found' })
      return
    }
  }

  db.prepare('DELETE FROM chat_participants WHERE chat_id = ? AND user_id = ?').run(id, targetUserId)

  const remaining = db.prepare('SELECT COUNT(*) as count FROM chat_participants WHERE chat_id = ?').get(id) as any
  if (remaining.count === 0) {
    db.prepare('DELETE FROM messages WHERE chat_id = ?').run(id)
    db.prepare('DELETE FROM chats WHERE id = ?').run(id)
  }

  res.json({ success: true })
})

router.put('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { name } = req.body

  if (!name?.trim()) {
    res.status(400).json({ error: 'Name is required' })
    return
  }

  const currentParticipant = db.prepare(
    'SELECT role FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(id, req.userId) as any

  if (!currentParticipant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  const chat = db.prepare('SELECT is_group FROM chats WHERE id = ?').get(id) as any
  if (!chat || chat.is_group !== 1) {
    res.status(400).json({ error: 'Not a group chat' })
    return
  }

  if (currentParticipant.role !== 'admin') {
    res.status(403).json({ error: 'Only admin can rename group' })
    return
  }

  db.prepare('UPDATE chats SET name = ? WHERE id = ?').run(name.trim(), id)
  res.json({ success: true, name: name.trim() })
})

'''

export_marker = 'export default router'
if export_marker not in content:
    print('ERROR: export default router not found')
    exit(1)
content = content.replace(export_marker, new_endpoints + export_marker)

with open('server/src/routes/chats.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('OK')
