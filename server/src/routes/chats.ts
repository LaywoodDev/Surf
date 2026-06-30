import crypto from 'crypto'
import { Router, Response } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { callAI, KIMI_API_KEY } from './ai'
import { canShowPrivacy, canAddToGroup } from './users'
import { sendPushNotification } from '../push'

const router = Router()
router.use(authMiddleware)

const TYPING_TTL_MS = 5000
const typingState = new Map<string, number>()

function typingKey(chatId: string | number, userId: string | number) {
  return `${chatId}:${userId}`
}

function pruneTypingState() {
  const now = Date.now()
  for (const [key, expiresAt] of typingState.entries()) {
    if (expiresAt <= now) typingState.delete(key)
  }
}

function getPrivateChatOtherUser(chatId: string | number, userId: number): number | null {
  const chat = db.prepare('SELECT is_group FROM chats WHERE id = ?').get(chatId) as { is_group: number } | undefined
  if (!chat || chat.is_group === 1) return null
  const other = db.prepare('SELECT user_id FROM chat_participants WHERE chat_id = ? AND user_id != ?').get(chatId, userId) as { user_id: number } | undefined
  return other?.user_id || null
}

function isBlocked(ownerId: number, blockedId: number): boolean {
  return !!db.prepare('SELECT 1 FROM blocked_users WHERE owner_id = ? AND blocked_id = ?').get(ownerId, blockedId)
}

function isChatE2EE(chatId: string | number, senderId: number, otherUserId: number | null): boolean {
  if (!otherUserId) return false
  const senderKey = db.prepare('SELECT 1 FROM public_keys WHERE user_id = ?').get(senderId)
  const otherKey = db.prepare('SELECT 1 FROM public_keys WHERE user_id = ?').get(otherUserId)
  return Boolean(senderKey && otherKey)
}

router.get('/', (req: AuthRequest, res: Response) => {
  const chats = db.prepare(`
    SELECT c.id, 
      c.name,
      c.is_group as isGroup,
      c.avatar as avatar,
      c.disable_copying as disableCopying,
      (SELECT COUNT(*) FROM chat_participants WHERE chat_id = c.id) as participantCount,
      (SELECT u.name || ' ' || NULLIF(u.surname, '') 
       FROM users u 
       JOIN chat_participants cp2 ON cp2.user_id = u.id 
       WHERE cp2.chat_id = c.id AND cp2.user_id != ?) as displayName,
      (SELECT u.id FROM users u JOIN chat_participants cp2 ON cp2.user_id = u.id WHERE cp2.chat_id = c.id AND cp2.user_id != ?) as participantId,
      (SELECT u.avatar FROM users u JOIN chat_participants cp2 ON cp2.user_id = u.id WHERE cp2.chat_id = c.id AND cp2.user_id != ?) as participantAvatar,
      (SELECT u.last_seen FROM users u JOIN chat_participants cp2 ON cp2.user_id = u.id WHERE cp2.chat_id = c.id AND cp2.user_id != ?) as participantLastSeen,
      (SELECT u.privacy FROM users u JOIN chat_participants cp2 ON cp2.user_id = u.id WHERE cp2.chat_id = c.id AND cp2.user_id != ?) as participantPrivacy,
      (SELECT user_id FROM chat_participants WHERE chat_id = c.id AND user_id != ?) as participantIdRaw,
      (SELECT text FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as lastMessage,
      (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as time,
      cp.pinned as pinned,
      cp.role as role
    FROM chats c
    JOIN chat_participants cp ON cp.chat_id = c.id
    WHERE cp.user_id = ?
    ORDER BY cp.pinned DESC, time DESC
  `).all(req.userId, req.userId, req.userId, req.userId, req.userId, req.userId, req.userId)

  res.json(chats.map((c: any) => {
    const isGroup = c.isGroup === 1
    const name = isGroup ? c.name : (c.displayName || c.name)
    const online = !isGroup && c.participantLastSeen ? (Date.now() - new Date(c.participantLastSeen + 'Z').getTime() < 30000) : false
    const pp = JSON.parse(c.participantPrivacy || '{"profilePhoto":"Everyone","lastSeen":"Everyone"}')
    const otherUserId: number | null = isGroup ? null : c.participantIdRaw
    const showAvatar = otherUserId ? canShowPrivacy(pp.profilePhoto, otherUserId, req.userId!) : true
    const showLastSeen = otherUserId ? canShowPrivacy(pp.lastSeen, otherUserId, req.userId!) : true
    if (!isGroup && !showAvatar) c.participantAvatar = null
    const blocked = otherUserId ? (isBlocked(req.userId!, otherUserId) || isBlocked(otherUserId, req.userId!)) : false
    const { participantPrivacy, displayName, participantIdRaw, ...rest } = c
    return {
      ...rest,
      name,
      isGroup,
      participantCount: c.participantCount,
      avatar: isGroup ? c.avatar : undefined,
      participantId: isGroup ? undefined : c.participantId,
      participantAvatar: isGroup ? undefined : c.participantAvatar,
      participantOnline: isGroup ? undefined : (blocked ? false : (showLastSeen ? online : false)),
      participantLastSeen: isGroup ? undefined : (blocked ? null : (showLastSeen ? c.participantLastSeen : null)),
      blocked,
      pinned: !!c.pinned,
      time: c.time ? new Date(c.time).toISOString() : '',
      disableCopying: !!c.disableCopying,
    }
  }))
})

router.post('/', (req: AuthRequest, res: Response) => {
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
})

router.post('/find-or-create', (req: AuthRequest, res: Response) => {
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
})

router.get('/:id/messages', (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const participant = db.prepare(
    'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(id, req.userId)

  if (!participant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  const cleared = db.prepare('SELECT cleared_at FROM cleared_chats WHERE chat_id = ? AND user_id = ?').get(id, req.userId) as any

  const messages = db.prepare(`
    SELECT m.id, m.text, m.sender_id as senderId, m.created_at as createdAt,
      m.reply_to_id as replyToId,
      m.attachment_url as attachmentUrl,
      m.attachment_type as attachmentType,
      m.poll_id as pollId,
      m.status,
      m.forward_from_id as forwardFromId,
      m.forward_from_name as forwardFromName,
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
      AND m.sender_id NOT IN (SELECT blocked_id FROM blocked_users WHERE owner_id = ?)
    ORDER BY m.created_at ASC
  `).all(cleared ? [req.userId, id, cleared.cleared_at, req.userId] : [req.userId, id, req.userId])

  const ownIds: number[] = []
  messages.forEach((m: any) => {
    if (m.senderId !== req.userId && m.status === 'sent') {
      ownIds.push(m.id)
    }
  })
  if (ownIds.length > 0) {
    db.prepare(`UPDATE messages SET status = 'delivered' WHERE id IN (${ownIds.map(() => '?').join(',')})`).run(...ownIds)
    ownIds.forEach(id => {
      const m = messages.find((mm: any) => mm.id === id)
      if (m) (m as any).status = 'delivered'
    })
  }

  res.json(messages.map((m: any) => ({
    id: m.id,
    sender: m.senderId === req.userId ? 'me' : 'them',
    text: m.text,
    time: new Date(m.createdAt).toISOString(),
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
    forwardFromId: m.forwardFromId || undefined,
    forwardFromName: m.forwardFromName || undefined,
    status: m.senderId === req.userId ? (m.status || 'sent') : undefined
  })))
})

router.post('/:id/read', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { messageId } = req.body

  const participant = db.prepare(
    'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(id, req.userId)

  if (!participant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  if (messageId) {
    db.prepare(`
      UPDATE messages SET status = 'read'
      WHERE chat_id = ? AND sender_id != ? AND id <= ? AND status IN ('sent', 'delivered')
    `).run(id, req.userId, messageId)
  }

  res.json({ success: true })
})

router.post('/:id/typing', (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const { typing } = req.body

  const participant = db.prepare(
    'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(id, req.userId)

  if (!participant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  pruneTypingState()
  const key = typingKey(id, req.userId!)
  if (typing) {
    typingState.set(key, Date.now() + TYPING_TTL_MS)
  } else {
    typingState.delete(key)
  }

  res.json({ success: true })
})

router.get('/:id/typing', (req: AuthRequest, res: Response) => {
  const id = req.params.id as string

  const participant = db.prepare(
    'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(id, req.userId)

  if (!participant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  pruneTypingState()
  const others = db.prepare(
    'SELECT user_id as userId FROM chat_participants WHERE chat_id = ? AND user_id != ?'
  ).all(id, req.userId) as { userId: number }[]

  const typing = others.some(other => {
    const expiresAt = typingState.get(typingKey(id, other.userId))
    return typeof expiresAt === 'number' && expiresAt > Date.now()
  })

  res.json({ typing })
})

router.post('/:id/messages', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const { text, replyTo, attachmentUrl, attachmentType, forwardFrom } = req.body

  if (!text?.trim() && !attachmentUrl) {
    res.status(400).json({ error: 'Message text or attachment is required' })
    return
  }

  const participant = db.prepare(
    'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(id, req.userId)

  if (!participant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  const otherUserId = getPrivateChatOtherUser(id, req.userId!)
  if (otherUserId) {
    if (isBlocked(otherUserId, req.userId!)) {
      res.status(403).json({ error: 'You are blocked by this user' })
      return
    }
    if (isBlocked(req.userId!, otherUserId)) {
      res.status(403).json({ error: 'You have blocked this user' })
      return
    }
  }

  const forwardFromId = forwardFrom?.id || null
  const forwardFromName = forwardFrom?.name || null

  const result = db.prepare(
    'INSERT INTO messages (chat_id, sender_id, text, reply_to_id, attachment_url, attachment_type, forward_from_id, forward_from_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.userId, text?.trim() || '', replyTo || null, attachmentUrl || null, attachmentType || null, forwardFromId, forwardFromName)

  let replyText, replyAttachmentUrl, replyAttachmentType
  if (replyTo) {
    const replied = db.prepare('SELECT text, attachment_url, attachment_type FROM messages WHERE id = ?').get(replyTo) as any
    if (replied) {
      replyText = replied.text
      replyAttachmentUrl = replied.attachment_url
      replyAttachmentType = replied.attachment_type
    }
  }

  const sender = db.prepare('SELECT name, avatar FROM users WHERE id = ?').get(req.userId) as any
  const userMsg = {
    id: result.lastInsertRowid,
    sender: 'me',
    text: text?.trim() || '',
    time: new Date().toISOString(),
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
    forwardFromId: forwardFromId || undefined,
    forwardFromName: forwardFromName || undefined,
    status: 'sent'
  }

  // Send push notifications to other participants
  try {
    const recipients = db.prepare('SELECT user_id FROM chat_participants WHERE chat_id = ? AND user_id != ?').all(id, req.userId) as { user_id: number }[]
    const isE2EE = isChatE2EE(id, req.userId!, otherUserId)
    const e2eeBody = 'New message'
    const plainBody = attachmentUrl && !text?.trim()
      ? 'Sent an attachment'
      : text?.trim() || 'New message'

    for (const recipient of recipients) {
      if (isBlocked(recipient.user_id, req.userId!)) continue
      sendPushNotification(recipient.user_id, {
        title: sender?.name || 'Surf',
        body: isE2EE ? e2eeBody : plainBody,
        url: '/'
      }).catch(err => console.error('Push notification error:', err))
    }
  } catch (err) {
    console.error('Failed to send push notifications:', err)
  }

  const hasOpusMention = text?.trim().toLowerCase().includes('@opus') || false
  if (!hasOpusMention || !KIMI_API_KEY) {
    res.status(201).json(userMsg)
    return
  }

  try {
    const chatMessages = db.prepare(`
      SELECT m.text, u.name as senderName
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.chat_id = ?
      ORDER BY m.created_at DESC
      LIMIT 15
    `).all(id) as { text: string; senderName: string }[]

    const history = chatMessages.reverse().map(m => ({
      role: m.senderName === 'Opus' ? 'assistant' : 'user' as string,
      content: m.text
    }))

    const aiMessages = [
      { role: 'system', content: 'Ты — Opus, AI-ассистент в мессенджере. Отвечай кратко, по делу и дружелюбно.' },
      ...history,
    ]

    const aiResponse = await callAI(aiMessages)

    const opusUser = db.prepare('SELECT id FROM users WHERE email = ?').get('opus@ai.local') as { id: number } | undefined
    const opusUserId = opusUser?.id

    if (opusUserId) {
      const aiResult = db.prepare(
        'INSERT INTO messages (chat_id, sender_id, text, reply_to_id) VALUES (?, ?, ?, ?)'
      ).run(id, opusUserId, aiResponse, result.lastInsertRowid)

      const aiMsg = {
        id: aiResult.lastInsertRowid,
        sender: 'them' as const,
        text: aiResponse,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        senderId: opusUserId,
        senderName: 'Opus',
        replyToId: result.lastInsertRowid,
        replyText: text.trim(),
      }

      res.status(201).json({ messages: [userMsg, aiMsg] })
      return
    }
  } catch (e) {
    console.error('AI error:', e)
  }

  res.status(201).json(userMsg)
})

router.delete('/:id/messages/:messageId', (req: AuthRequest, res: Response) => {
  const { id, messageId } = req.params
  const { forBoth } = req.body || {}

  const participant = db.prepare(
    'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(id, req.userId)

  if (!participant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  const message = db.prepare(
    'SELECT id, chat_id as chatId, sender_id as senderId FROM messages WHERE id = ? AND chat_id = ?'
  ).get(messageId, id) as { id: number; chatId: number; senderId: number } | undefined

  if (!message) {
    res.status(404).json({ error: 'Message not found' })
    return
  }

  if (forBoth) {
    if (message.senderId !== req.userId) {
      res.status(403).json({ error: 'Only sender can delete for everyone' })
      return
    }
    db.prepare('DELETE FROM messages WHERE id = ?').run(messageId)
    res.json({ success: true, mode: 'everyone' })
    return
  }

  db.prepare(`
    INSERT INTO deleted_messages (message_id, user_id)
    VALUES (?, ?)
    ON CONFLICT(message_id, user_id) DO NOTHING
  `).run(messageId, req.userId)

  res.json({ success: true, mode: 'me' })
})


router.get('/:id/other-user', (req: AuthRequest, res: Response) => {
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
  }

  const privacy = JSON.parse(user.privacy || '{"phone":"Everyone","email":"Everyone","bio":"Everyone","profilePhoto":"Everyone","lastSeen":"Everyone"}')
  const ownerId = Number(user.id)
  const viewerId = req.userId!

  if (!canShowPrivacy(privacy.email, ownerId, viewerId)) delete user.email
  if (!canShowPrivacy(privacy.phone, ownerId, viewerId)) delete user.phone
  if (!canShowPrivacy(privacy.bio, ownerId, viewerId)) delete user.bio
  if (!canShowPrivacy(privacy.profilePhoto, ownerId, viewerId)) delete user.avatar
  delete user.privacy

  const lastSeenVal = user.last_seen
  delete user.last_seen

  const online = lastSeenVal ? (Date.now() - new Date(lastSeenVal + 'Z').getTime() < 30000) : false
  const showLastSeen = canShowPrivacy(privacy.lastSeen, ownerId, viewerId)
  const blocked = isBlocked(req.userId!, user.id) || isBlocked(user.id, req.userId!)
  res.json({ ...user, online: blocked ? false : (showLastSeen ? online : false), lastSeen: blocked ? null : (showLastSeen ? lastSeenVal : null) })
})

router.delete('/:id/messages', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { forBoth } = req.body

  const participant = db.prepare(
    'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(id, req.userId)

  if (!participant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  if (forBoth) {
    db.prepare('DELETE FROM messages WHERE chat_id = ?').run(id)
    db.prepare('DELETE FROM cleared_chats WHERE chat_id = ?').run(id)
  } else {
    db.prepare(`
      INSERT INTO cleared_chats (chat_id, user_id, cleared_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(chat_id, user_id) DO UPDATE SET cleared_at = datetime('now')
    `).run(id, req.userId)
  }

  res.json({ success: true })
})

router.delete('/:id', (req: AuthRequest, res: Response) => {
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
})

router.put('/:id/pin', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { pinned } = req.body

  const participant = db.prepare(
    'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(id, req.userId)

  if (!participant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  db.prepare('UPDATE chat_participants SET pinned = ? WHERE chat_id = ? AND user_id = ?').run(pinned ? 1 : 0, id, req.userId)
  res.json({ success: true, pinned: !!pinned })
})


router.post('/group', (req: AuthRequest, res: Response) => {
  const { name, participantIds, disableCopying } = req.body
  if (!name?.trim() || !Array.isArray(participantIds) || participantIds.length === 0) {
    res.status(400).json({ error: 'Group name and at least one participant are required' })
    return
  }

  const uniqueIds = Array.from(new Set([...participantIds, req.userId]))
  const chat = db.prepare('INSERT INTO chats (name, is_group, disable_copying) VALUES (?, 1, ?)').run(name.trim(), disableCopying ? 1 : 0)
  const chatId = chat.lastInsertRowid as number

  const insertParticipant = db.prepare('INSERT INTO chat_participants (chat_id, user_id, role) VALUES (?, ?, ?)')
  uniqueIds.forEach((userId: number) => {
    insertParticipant.run(chatId, userId, userId === req.userId ? 'admin' : 'member')
  })

  res.status(201).json({ id: chatId, name: name.trim(), isGroup: true, participantCount: uniqueIds.length, role: 'admin', lastMessage: '', time: '' })
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

  if (!canAddToGroup(Number(userId), req.userId!)) {
    res.status(403).json({ error: 'This user does not allow being added to groups' })
    return
  }

  db.prepare('INSERT INTO chat_participants (chat_id, user_id, role) VALUES (?, ?, ?)').run(id, userId, 'member')
  res.status(201).json({ success: true })
})

router.delete('/:id/participants/:userId', (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const userId = req.params.userId as string
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
  const { name, disableCopying } = req.body

  if (name !== undefined && !name?.trim()) {
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
    res.status(403).json({ error: 'Only admin can edit group' })
    return
  }

  if (name?.trim()) {
    db.prepare('UPDATE chats SET name = ? WHERE id = ?').run(name.trim(), id)
  }
  if (typeof disableCopying === 'boolean') {
    db.prepare('UPDATE chats SET disable_copying = ? WHERE id = ?').run(disableCopying ? 1 : 0, id)
  }

  const updated = db.prepare('SELECT disable_copying as disableCopying FROM chats WHERE id = ?').get(id) as any
  res.json({ success: true, name: name?.trim(), disableCopying: !!updated?.disableCopying })
})

function generateInviteCode(): string {
  return crypto.randomBytes(6).toString('base64url').slice(0, 8)
}

router.post('/:id/invite-link', (req: AuthRequest, res: Response) => {
  const { id } = req.params

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
    res.status(403).json({ error: 'Only admin can create invite links' })
    return
  }

  const existing = db.prepare(
    `SELECT code, expires_at as expiresAt FROM chat_invite_links WHERE chat_id = ? AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1`
  ).get(id) as { code: string; expiresAt: string } | undefined

  if (existing) {
    res.json({ code: existing.code, expiresAt: existing.expiresAt })
    return
  }

  const code = generateInviteCode()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  db.prepare(
    `INSERT INTO chat_invite_links (chat_id, code, expires_at, created_by) VALUES (?, ?, ?, ?)`
  ).run(id, code, expiresAt, req.userId)

  res.json({ code, expiresAt })
})

router.post('/join/:code', (req: AuthRequest, res: Response) => {
  const { code } = req.params

  const link = db.prepare(
    `SELECT chat_id as chatId, expires_at as expiresAt FROM chat_invite_links WHERE code = ?`
  ).get(code) as { chatId: number; expiresAt: string } | undefined

  if (!link) {
    res.status(404).json({ error: 'Invalid invite link' })
    return
  }

  const now = new Date().toISOString()
  if (link.expiresAt < now) {
    res.status(410).json({ error: 'Invite link expired' })
    return
  }

  const existing = db.prepare('SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?').get(link.chatId, req.userId)
  if (existing) {
    res.status(409).json({ error: 'Already a member' })
    return
  }

  db.prepare('INSERT INTO chat_participants (chat_id, user_id, role) VALUES (?, ?, ?)').run(link.chatId, req.userId, 'member')

  const chat = db.prepare('SELECT id, name, is_group as isGroup, avatar, disable_copying as disableCopying FROM chats WHERE id = ?').get(link.chatId) as any
  const participantCount = (db.prepare('SELECT COUNT(*) as count FROM chat_participants WHERE chat_id = ?').get(link.chatId) as any).count

  res.json({
    id: chat.id,
    name: chat.name,
    isGroup: chat.isGroup === 1,
    avatar: chat.avatar,
    disableCopying: !!chat.disableCopying,
    participantCount,
    role: 'member',
    lastMessage: '',
    time: '',
  })
})

router.get('/join/:code', (req: AuthRequest, res: Response) => {
  const { code } = req.params

  const link = db.prepare(
    `SELECT chat_id as chatId, expires_at as expiresAt FROM chat_invite_links WHERE code = ?`
  ).get(code) as { chatId: number; expiresAt: string } | undefined

  if (!link) {
    res.status(404).json({ error: 'Invalid invite link' })
    return
  }

  const now = new Date().toISOString()
  if (link.expiresAt < now) {
    res.status(410).json({ error: 'Invite link expired' })
    return
  }

  const existing = db.prepare('SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?').get(link.chatId, req.userId)
  if (existing) {
    res.status(409).json({ error: 'Already a member', chatId: link.chatId })
    return
  }

  const chat = db.prepare('SELECT id, name, avatar, is_group as isGroup FROM chats WHERE id = ?').get(link.chatId) as any
  const participantCount = (db.prepare('SELECT COUNT(*) as count FROM chat_participants WHERE chat_id = ?').get(link.chatId) as any).count
  const admin = db.prepare(`
    SELECT u.name, u.surname, u.avatar FROM users u
    JOIN chat_participants cp ON cp.user_id = u.id
    WHERE cp.chat_id = ? AND cp.role = 'admin'
    LIMIT 1
  `).get(link.chatId) as any

  res.json({
    id: chat.id,
    name: chat.name,
    avatar: chat.avatar,
    participantCount,
    adminName: admin ? `${admin.name} ${admin.surname || ''}`.trim() : null,
    adminAvatar: admin?.avatar || null,
  })
})

export default router
