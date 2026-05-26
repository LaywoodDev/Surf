import { Router, Response } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const PROXYAPI_KEY = process.env.PROXYAPI_KEY || ''
const PROXYAPI_BASE = 'https://api.proxyapi.ru/openai/v1'

async function callAI(messages: { role: string; content: string }[]) {
  const response = await fetch(`${PROXYAPI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PROXYAPI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'gpt-4o', messages, temperature: 0.1 }),
  })
  if (!response.ok) throw new Error(`AI request failed: ${await response.text()}`)
  const data = await response.json()
  return data.choices[0].message.content
}

const router = Router()
router.use(authMiddleware)

router.get('/', (req: AuthRequest, res: Response) => {
  const chats = db.prepare(`
    SELECT c.id, c.name, 
      (SELECT text FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as lastMessage,
      (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as time,
      cp.pinned as pinned
    FROM chats c
    JOIN chat_participants cp ON cp.chat_id = c.id
    WHERE cp.user_id = ?
    ORDER BY cp.pinned DESC, time DESC
  `).all(req.userId)

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

  res.status(201).json({ id: chatId, name, lastMessage: '', time: '' })
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

  const messages = db.prepare(`
    SELECT m.id, m.text, m.sender_id as senderId, m.created_at as createdAt,
      u.name as senderName
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.chat_id = ?
    ORDER BY m.created_at ASC
  `).all(id)

  res.json(messages.map((m: any) => ({
    id: m.id,
    sender: m.senderId === req.userId ? 'me' : 'them',
    text: m.text,
    time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    senderName: m.senderName
  })))
})

router.post('/:id/messages', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { text } = req.body

  if (!text?.trim()) {
    res.status(400).json({ error: 'Message text is required' })
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
    'INSERT INTO messages (chat_id, sender_id, text) VALUES (?, ?, ?)'
  ).run(id, req.userId, text.trim())

  res.status(201).json({
    id: result.lastInsertRowid,
    sender: 'me',
    text: text.trim(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })
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
