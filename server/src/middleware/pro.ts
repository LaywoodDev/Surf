import { Response, NextFunction } from 'express'
import db from '../db'
import { AuthRequest } from './auth'

export function requirePro(req: AuthRequest, res: Response, next: NextFunction) {
  const sub = db.prepare(
    "SELECT id FROM user_subscriptions WHERE user_id = ? AND status = 'active' AND end_date > datetime('now')"
  ).get(req.userId) as any

  if (!sub) {
    res.status(403).json({ error: 'Pro subscription required' })
    return
  }

  next()
}
