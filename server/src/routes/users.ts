import { Router, Response } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

export function isInContacts(ownerId: number, contactId: number): boolean {
  return !!db.prepare('SELECT 1 FROM contacts WHERE owner_id = ? AND contact_id = ?').get(ownerId, contactId)
}

export function canShowPrivacy(setting: string, ownerId: number, viewerId?: number): boolean {
  if (viewerId === ownerId) return true
  if (setting === 'Everyone') return true
  if (setting === 'Nobody') return false
  if (setting === 'My Contacts') return viewerId ? isInContacts(ownerId, viewerId) : false
  return true
}

export function canAddToGroup(ownerId: number, viewerId?: number): boolean {
  if (viewerId === ownerId) return true
  const user = db.prepare('SELECT privacy FROM users WHERE id = ?').get(ownerId) as any
  const privacy = JSON.parse(user?.privacy || '{}')
  const setting = privacy.addToGroup || 'Everyone'
  if (setting === 'Everyone') return true
  if (setting === 'Nobody') return false
  if (setting === 'My Contacts') return viewerId ? isInContacts(ownerId, viewerId) : false
  return true
}

function applyPrivacy(u: any, viewerId?: number) {
  const ownerId = Number(u.id)
  const privacy = JSON.parse(u.privacy || '{"phone":"Everyone","email":"Everyone","bio":"Everyone","profilePhoto":"Everyone","lastSeen":"Everyone","addToGroup":"Everyone"}')
  if (!canShowPrivacy(privacy.profilePhoto, ownerId, viewerId)) delete u.avatar
  if (!canShowPrivacy(privacy.phone, ownerId, viewerId)) delete u.phone
  if (!canShowPrivacy(privacy.email, ownerId, viewerId)) delete u.email
  if (!canShowPrivacy(privacy.bio, ownerId, viewerId)) delete u.bio
  const showLastSeen = canShowPrivacy(privacy.lastSeen, ownerId, viewerId)
  const lastSeenVal = u.last_seen
  if ('last_seen' in u) delete u.last_seen
  if (showLastSeen && lastSeenVal) {
    u.online = Date.now() - new Date(lastSeenVal + 'Z').getTime() < 30000
    u.lastSeen = lastSeenVal
  } else {
    u.online = false
    u.lastSeen = null
  }
  delete u.privacy
  return u
}

// Users that can be @mentioned (anyone sharing a chat with current user)
router.get('/mentionable', (req: AuthRequest, res: Response) => {
  const users = db.prepare(`
    SELECT DISTINCT u.id, u.name, u.surname, u.username, u.avatar, u.privacy
    FROM users u
    JOIN chat_participants cp ON cp.user_id = u.id
    JOIN chat_participants cp2 ON cp2.chat_id = cp.chat_id
    WHERE cp2.user_id = ? AND u.id != ?
  `).all(req.userId, req.userId)

  res.json(users.map((u: any) => applyPrivacy({ ...u }, req.userId!)))
})

// Real contacts list
router.get('/contacts', (req: AuthRequest, res: Response) => {
  const contacts = db.prepare(`
    SELECT u.id, u.name, u.surname, u.username, u.avatar, u.privacy, u.last_seen
    FROM users u
    JOIN contacts c ON c.contact_id = u.id
    WHERE c.owner_id = ?
    ORDER BY u.name, u.surname
  `).all(req.userId)

  res.json(contacts.map((c: any) => applyPrivacy({ ...c }, req.userId!)))
})

router.post('/contacts', (req: AuthRequest, res: Response) => {
  const { userId } = req.body
  if (!userId || Number(userId) === req.userId) {
    res.status(400).json({ error: 'Invalid userId' })
    return
  }
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (!target) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  db.prepare('INSERT OR IGNORE INTO contacts (owner_id, contact_id) VALUES (?, ?)').run(req.userId, userId)
  res.json({ success: true })
})

router.delete('/contacts/:id', (req: AuthRequest, res: Response) => {
  const contactId = Number(req.params.id)
  if (!contactId) {
    res.status(400).json({ error: 'Invalid contact id' })
    return
  }
  db.prepare('DELETE FROM contacts WHERE owner_id = ? AND contact_id = ?').run(req.userId, contactId)
  res.json({ success: true })
})

// Blocked users list
router.get('/blocked', (req: AuthRequest, res: Response) => {
  const blocked = db.prepare(`
    SELECT u.id, u.name, u.surname, u.username, u.avatar, u.privacy
    FROM users u
    JOIN blocked_users b ON b.blocked_id = u.id
    WHERE b.owner_id = ?
    ORDER BY u.name, u.surname
  `).all(req.userId)

  res.json(blocked.map((u: any) => applyPrivacy({ ...u }, req.userId!)))
})

router.post('/block', (req: AuthRequest, res: Response) => {
  const { userId } = req.body
  if (!userId || Number(userId) === req.userId) {
    res.status(400).json({ error: 'Invalid userId' })
    return
  }
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (!target) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  db.prepare('INSERT OR IGNORE INTO blocked_users (owner_id, blocked_id) VALUES (?, ?)').run(req.userId, userId)
  res.json({ success: true })
})

router.delete('/block/:id', (req: AuthRequest, res: Response) => {
  const blockedId = Number(req.params.id)
  if (!blockedId) {
    res.status(400).json({ error: 'Invalid blocked id' })
    return
  }
  db.prepare('DELETE FROM blocked_users WHERE owner_id = ? AND blocked_id = ?').run(req.userId, blockedId)
  res.json({ success: true })
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

  res.json(users.map((u: any) => applyPrivacy({ ...u }, req.userId!)))
})

router.get('/me', (req: AuthRequest, res: Response) => {
  const user = db.prepare('SELECT id, name, surname, email, username, phone, bio, avatar, privacy FROM users WHERE id = ?').get(req.userId) as any
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  user.privacy = JSON.parse(user.privacy || '{"phone":"Everyone","email":"Everyone","bio":"Everyone","profilePhoto":"Everyone","lastSeen":"Everyone","addToGroup":"Everyone"}')
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
  res.json(applyPrivacy(user, req.userId!))
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
  const { phone, email, bio, profilePhoto, lastSeen, addToGroup } = req.body
  const existing = db.prepare('SELECT privacy FROM users WHERE id = ?').get(req.userId) as any
  const prev = JSON.parse(existing?.privacy || '{}')
  const privacy = JSON.stringify({
    phone: phone ?? prev.phone ?? 'Everyone',
    email: email ?? prev.email ?? 'Everyone',
    bio: bio ?? prev.bio ?? 'Everyone',
    profilePhoto: profilePhoto ?? prev.profilePhoto ?? 'Everyone',
    lastSeen: lastSeen ?? prev.lastSeen ?? 'Everyone',
    addToGroup: addToGroup ?? prev.addToGroup ?? 'Everyone',
  })
  db.prepare('UPDATE users SET privacy = ? WHERE id = ?').run(privacy, req.userId)
  res.json({ success: true })
})

export default router
