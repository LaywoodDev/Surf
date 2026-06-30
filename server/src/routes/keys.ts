import { Router, Response } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

router.post('/', (req: AuthRequest, res: Response) => {
  const { publicKey } = req.body
  if (!publicKey) {
    res.status(400).json({ error: 'publicKey is required' })
    return
  }
  db.prepare(
    `INSERT INTO public_keys (user_id, public_key) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET public_key = ?`
  ).run(req.userId, JSON.stringify(publicKey), JSON.stringify(publicKey))
  res.json({ success: true })
})

router.get('/:userId', (req: AuthRequest, res: Response) => {
  const row = db.prepare('SELECT public_key FROM public_keys WHERE user_id = ?').get(req.params.userId) as any
  if (!row) {
    res.json({ publicKey: null })
    return
  }
  res.json({ publicKey: JSON.parse(row.public_key) })
})

export default router
