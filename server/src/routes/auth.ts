import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import db from '../db'
import { generateToken } from '../middleware/auth'

function ensureOpusChat(userId: number) {
  const opus = db.prepare('SELECT id FROM users WHERE email = ?').get('opus@ai.local') as any
  if (!opus) return
  const existing = db.prepare(`
    SELECT 1 FROM chat_participants cp1
    JOIN chat_participants cp2 ON cp2.chat_id = cp1.chat_id
    WHERE cp1.user_id = ? AND cp2.user_id = ?
  `).get(userId, opus.id)
  if (!existing) {
    const chat = db.prepare('INSERT INTO chats (name) VALUES (?)').run('Opus')
    db.prepare('INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?)').run(chat.lastInsertRowid, userId)
    db.prepare('INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?)').run(chat.lastInsertRowid, opus.id)
  }
}

const router = Router()

router.post('/register', (req: Request, res: Response) => {
  const { name, surname, email, password } = req.body
  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email and password are required' })
    return
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) {
    res.status(409).json({ error: 'Email already registered' })
    return
  }

  const hash = bcrypt.hashSync(password, 10)
  const username = email.split('@')[0]

  const result = db.prepare(
    'INSERT INTO users (name, surname, email, password, username) VALUES (?, ?, ?, ?, ?)'
  ).run(name, surname || '', email, hash, username)

  const userId = result.lastInsertRowid as number
  ensureOpusChat(userId)

  const token = generateToken(userId)
  res.status(201).json({
    token,
    user: {
      id: userId,
      name,
      surname: surname || '',
      email,
      username,
      phone: '',
      bio: '',
      avatar: ''
    }
  })
})

router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
  if (!user || !bcrypt.compareSync(password, user.password)) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  ensureOpusChat(user.id)

  const token = generateToken(user.id)
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      username: user.username,
      phone: user.phone,
      bio: user.bio,
      avatar: user.avatar || ''
    }
  })
})

export default router
