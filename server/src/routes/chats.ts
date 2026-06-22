import { Router, Response } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { callAI, PROXYAPI_KEY } from './ai'

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

router.get('/', (req: AuthRequest, res: Response) => {
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
      (SELECT text FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as lastMessage,
      (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as time,
      cp.pinned as pinned
    FROM chats c
    JOIN chat_participants cp ON cp.chat_id = c.id
    WHERE cp.user_id = ?
    ORDER BY cp.pinned DESC, time DESC
  `).all(req.userId, req.userId, req.userId)

  res.json(chats.map((c: any) => ({
    ...c,
    pinned: !!c.pinned,
    time: c.time ? new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  })))
})

router.post('/', (req: AuthRequest, res: Response) => {
  const { name, participantId } = req.body
  if (!name || !participantId) {
    res.status(400).json({ error: 'Chat name and participantId are required' })
    return
  }

  const chat = db.prepare('INSERT INTO chats (name) VALUES (?)').run(name)
  const chatId = chat.lastInsertRowid as number

  db.prepare('INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?)').run(chatId, req.userId)
  db.prepare('INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?)').run(chatId, participantId)

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
      u.name as senderName,
      ru.text as replyText,
      ru.attachment_url as replyAttachmentUrl,
      ru.attachment_type as replyAttachmentType
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN messages ru ON ru.id = m.reply_to_id
    WHERE m.chat_id = ? ${cleared ? 'AND m.created_at > ?' : ''}
    ORDER BY m.created_at ASC
  `).all(cleared ? [id, cleared.cleared_at] : [id])

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
      if (m) m.status = 'delivered'
    })
  }

  res.json(messages.map((m: any) => ({
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
  const { id } = req.params
  const { typing } = req.body

  const participant = db.prepare(
    'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(id, req.userId)

  if (!participant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  pruneTypingState()
  const key = typingKey(id, req.userId)
  if (typing) {
    typingState.set(key, Date.now() + TYPING_TTL_MS)
  } else {
    typingState.delete(key)
  }

  res.json({ success: true })
})

router.get('/:id/typing', (req: AuthRequest, res: Response) => {
  const { id } = req.params

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
  const { id } = req.params
  const { text, replyTo, attachmentUrl, attachmentType } = req.body

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

  const result = db.prepare(
    'INSERT INTO messages (chat_id, sender_id, text, reply_to_id, attachment_url, attachment_type) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, req.userId, text?.trim() || '', replyTo || null, attachmentUrl || null, attachmentType || null)

  let replyText, replyAttachmentUrl, replyAttachmentType
  if (replyTo) {
    const replied = db.prepare('SELECT text, attachment_url, attachment_type FROM messages WHERE id = ?').get(replyTo) as any
    if (replied) {
      replyText = replied.text
      replyAttachmentUrl = replied.attachment_url
      replyAttachmentType = replied.attachment_type
    }
  }

  const userMsg = {
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
  }

  const hasOpusMention = text?.trim().toLowerCase().includes('@opus') || false
  if (!hasOpusMention || !PROXYAPI_KEY) {
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
        replyToId: result.lastInsertRowid,
        replyText: text.trim(),
        viaOpus: true
      }

      res.status(201).json({ messages: [userMsg, aiMsg] })
    } else {
      res.status(201).json(userMsg)
    }
  } catch (err) {
    console.error('Opus mention error:', err)
    res.status(201).json(userMsg)
  }
})

router.get('/:id/other-user', (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const user = db.prepare(`
    SELECT u.id, u.name, u.surname, u.email, u.username, u.phone, u.bio, u.privacy
    FROM users u
    JOIN chat_participants cp ON cp.user_id = u.id
    WHERE cp.chat_id = ? AND u.id != ?
  `).get(id, req.userId) as any

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const privacy = JSON.parse(user.privacy || '{"phone":"Everyone","email":"Everyone","bio":"Everyone"}')

  const canShow = (setting: string) => {
    if (setting === 'Everyone') return true
    if (setting === 'Nobody') return false
    return true
  }

  if (!canShow(privacy.email)) delete user.email
  if (!canShow(privacy.phone)) delete user.phone
  if (!canShow(privacy.bio)) delete user.bio
  delete user.privacy

  res.json(user)
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

export default router
