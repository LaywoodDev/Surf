import { Router, Response } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

router.get('/contacts', (req: AuthRequest, res: Response) => {
  const contacts = db.prepare(`
    SELECT DISTINCT u.id, u.name, u.surname, u.username, u.avatar, u.privacy
    FROM users u
    JOIN chat_participants cp ON cp.user_id = u.id
    JOIN chat_participants cp2 ON cp2.chat_id = cp.chat_id
    WHERE cp2.user_id = ? AND u.id != ?
  `).all(req.userId, req.userId)

  res.json(contacts.map((c: any) => {
    const p = JSON.parse(c.privacy || '{"profilePhoto":"Everyone"}')
    if (p.profilePhoto === 'Nobody') delete c.avatar
    delete c.privacy
    return c
  }))
})

router.get('/search', (req: AuthRequest, res: Response) => {
  const q = (req.query.q as string || '').trim()
  if (!q) {
    res.json([])
    return
  }

  const users = db.prepare(`
    SELECT id, name, surname, email, username, avatar, privacy
    FROM users
    WHERE (name LIKE ? OR surname LIKE ? OR email LIKE ?) AND id != ?
    LIMIT 20
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, req.userId)

  res.json(users.map((u: any) => {
    const p = JSON.parse(u.privacy || '{"profilePhoto":"Everyone"}')
    if (p.profilePhoto === 'Nobody') delete u.avatar
    delete u.privacy
    return u
  }))
})

router.get('/me', (req: AuthRequest, res: Response) => {
  const user = db.prepare('SELECT id, name, surname, email, username, phone, bio, avatar, privacy FROM users WHERE id = ?').get(req.userId) as any
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  user.privacy = JSON.parse(user.privacy || '{"phone":"Everyone","email":"Everyone","bio":"Everyone","profilePhoto":"Everyone","lastSeen":"Everyone"}')
  res.json(user)
})

router.put('/me', (req: AuthRequest, res: Response) => {
  const { name, surname, username, phone, bio } = req.body
  db.prepare('UPDATE users SET name = ?, surname = ?, username = ?, phone = ?, bio = ? WHERE id = ?')
    .run(name || '', surname || '', username || '', phone || '', bio || '', req.userId)
  res.json({ success: true })
})

router.get('/by-username/:username', (req: AuthRequest, res: Response) => {
  const username = req.params.username
  const user = db.prepare('SELECT id, name, surname, email, username, phone, bio, avatar, privacy FROM users WHERE username = ?').get(username) as any
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  const privacy = JSON.parse(user.privacy || '{"phone":"Everyone","email":"Everyone","bio":"Everyone","profilePhoto":"Everyone","lastSeen":"Everyone"}')
  if (privacy.profilePhoto === 'Nobody') delete user.avatar
  if (privacy.phone === 'Nobody') delete user.phone
  if (privacy.email === 'Nobody') delete user.email
  if (privacy.bio === 'Nobody') delete user.bio
  delete user.privacy
  res.json(user)
})

router.post('/ping', (req: AuthRequest, res: Response) => {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN last_seen TEXT DEFAULT ''`)
  } catch {}
  try {
    db.prepare("UPDATE users SET last_seen = datetime('now') WHERE id = ?").run(req.userId)
    res.json({ success: true })
  } catch (err) {
    console.error('Ping error:', err)
    res.status(500).json({ error: String(err) })
  }
})

router.put('/me/privacy', (req: AuthRequest, res: Response) => {
  const { phone, email, bio, profilePhoto, lastSeen } = req.body
  const privacy = JSON.stringify({ phone, email, bio, profilePhoto, lastSeen })
  db.prepare('UPDATE users SET privacy = ? WHERE id = ?').run(privacy, req.userId)
  res.json({ success: true })
})

export default router
