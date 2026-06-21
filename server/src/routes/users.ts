import { Router, Response } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

router.get('/contacts', (req: AuthRequest, res: Response) => {
  const contacts = db.prepare(`
    SELECT DISTINCT u.id, u.name, u.surname, u.username, u.avatar
    FROM users u
    JOIN chat_participants cp ON cp.user_id = u.id
    JOIN chat_participants cp2 ON cp2.chat_id = cp.chat_id
    WHERE cp2.user_id = ? AND u.id != ?
  `).all(req.userId, req.userId)

  res.json(contacts)
})

router.get('/search', (req: AuthRequest, res: Response) => {
  const q = (req.query.q as string || '').trim()
  if (!q) {
    res.json([])
    return
  }

  const users = db.prepare(`
    SELECT id, name, surname, email, username, avatar
    FROM users
    WHERE (name LIKE ? OR surname LIKE ? OR email LIKE ?) AND id != ?
    LIMIT 20
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, req.userId)

  res.json(users)
})

router.get('/me', (req: AuthRequest, res: Response) => {
  const user = db.prepare('SELECT id, name, surname, email, username, phone, bio, avatar, privacy FROM users WHERE id = ?').get(req.userId) as any
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  user.privacy = JSON.parse(user.privacy || '{"phone":"Everyone","email":"Everyone","bio":"Everyone"}')
  res.json(user)
})

router.put('/me', (req: AuthRequest, res: Response) => {
  const { username, phone, bio } = req.body
  db.prepare('UPDATE users SET username = ?, phone = ?, bio = ? WHERE id = ?')
    .run(username || '', phone || '', bio || '', req.userId)
  res.json({ success: true })
})

router.get('/by-username/:username', (req: AuthRequest, res: Response) => {
  const username = req.params.username
  const user = db.prepare('SELECT id, name, surname, email, username, phone, bio, avatar FROM users WHERE username = ?').get(username) as any
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json(user)
})

router.put('/me/privacy', (req: AuthRequest, res: Response) => {
  const { phone, email, bio } = req.body
  const privacy = JSON.stringify({ phone, email, bio })
  db.prepare('UPDATE users SET privacy = ? WHERE id = ?').run(privacy, req.userId)
  res.json({ success: true })
})

export default router
