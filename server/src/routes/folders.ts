import { Router, Response } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

router.get('/', (req: AuthRequest, res: Response) => {
  const folders = db.prepare(`
    SELECT f.id, f.name, f.icon, f.sort_order as sortOrder
    FROM folders f
    WHERE f.user_id = ?
    ORDER BY f.sort_order ASC
  `).all(req.userId)

  const folderChats = db.prepare(`
    SELECT folder_id, chat_id FROM folder_chats
    WHERE folder_id IN (SELECT id FROM folders WHERE user_id = ?)
  `).all(req.userId) as { folder_id: number; chat_id: number }[]

  const chatsByFolder: Record<number, number[]> = {}
  for (const fc of folderChats) {
    if (!chatsByFolder[fc.folder_id]) chatsByFolder[fc.folder_id] = []
    chatsByFolder[fc.folder_id].push(fc.chat_id)
  }

  res.json(folders.map((f: any) => ({
    id: f.id,
    name: f.name,
    icon: f.icon,
    sortOrder: f.sortOrder,
    chats: chatsByFolder[f.id] || [],
  })))
})

router.post('/', (req: AuthRequest, res: Response) => {
  const { name, icon } = req.body
  if (!name?.trim()) {
    res.status(400).json({ error: 'Folder name is required' })
    return
  }

  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM folders WHERE user_id = ?').get(req.userId) as any
  const sortOrder = (maxOrder?.max || 0) + 1

  const result = db.prepare('INSERT INTO folders (user_id, name, icon, sort_order) VALUES (?, ?, ?, ?)').run(
    req.userId, name.trim(), icon || 'folder', sortOrder
  )

  res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), icon: icon || 'folder', sortOrder, chats: [] })
})

router.put('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { name, icon, sortOrder } = req.body

  const folder = db.prepare('SELECT 1 FROM folders WHERE id = ? AND user_id = ?').get(id, req.userId)
  if (!folder) {
    res.status(404).json({ error: 'Folder not found' })
    return
  }

  if (name !== undefined) db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name.trim(), id)
  if (icon !== undefined) db.prepare('UPDATE folders SET icon = ? WHERE id = ?').run(icon, id)
  if (sortOrder !== undefined) db.prepare('UPDATE folders SET sort_order = ? WHERE id = ?').run(sortOrder, id)

  res.json({ success: true })
})

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const folder = db.prepare('SELECT 1 FROM folders WHERE id = ? AND user_id = ?').get(id, req.userId)
  if (!folder) {
    res.status(404).json({ error: 'Folder not found' })
    return
  }

  db.prepare('DELETE FROM folder_chats WHERE folder_id = ?').run(id)
  db.prepare('DELETE FROM folders WHERE id = ?').run(id)

  res.json({ success: true })
})

router.post('/:id/chats/:chatId', (req: AuthRequest, res: Response) => {
  const { id, chatId } = req.params

  const folder = db.prepare('SELECT 1 FROM folders WHERE id = ? AND user_id = ?').get(id, req.userId)
  if (!folder) {
    res.status(404).json({ error: 'Folder not found' })
    return
  }

  try {
    db.prepare('INSERT INTO folder_chats (folder_id, chat_id) VALUES (?, ?)').run(id, chatId)
  } catch {
    // already exists, ignore
  }

  res.json({ success: true })
})

router.delete('/:id/chats/:chatId', (req: AuthRequest, res: Response) => {
  const { id, chatId } = req.params

  const folder = db.prepare('SELECT 1 FROM folders WHERE id = ? AND user_id = ?').get(id, req.userId)
  if (!folder) {
    res.status(404).json({ error: 'Folder not found' })
    return
  }

  db.prepare('DELETE FROM folder_chats WHERE folder_id = ? AND chat_id = ?').run(id, chatId)

  res.json({ success: true })
})

export default router
