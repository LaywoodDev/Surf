import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { getVapidPublicKey, saveSubscription, deleteSubscription, PushSubscription } from '../push'

const router = Router()

router.get('/vapid-public-key', (req, res) => {
  const key = getVapidPublicKey()
  if (!key) {
    res.status(500).json({ error: 'Push not configured' })
    return
  }
  res.json({ publicKey: key })
})

router.post('/subscribe', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  const sub = req.body as PushSubscription
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    res.status(400).json({ error: 'Invalid subscription' })
    return
  }
  saveSubscription(userId, sub)
  res.json({ success: true })
})

router.post('/unsubscribe', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  const { endpoint } = req.body as { endpoint?: string }
  if (!endpoint) {
    res.status(400).json({ error: 'Endpoint required' })
    return
  }
  deleteSubscription(userId, endpoint)
  res.json({ success: true })
})

export default router
