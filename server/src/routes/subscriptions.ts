import { Router, Response } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

const YOO_BASE = 'https://api.yookassa.ru/v3'

function yooHeaders() {
  const auth = Buffer.from(`${process.env.YOO_SHOP_ID}:${process.env.YOO_SECRET_KEY}`).toString('base64')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${auth}`,
    'Idempotence-Key': crypto.randomUUID(),
  }
}

router.get('/plans', (_req: AuthRequest, res: Response) => {
  const plans = db.prepare('SELECT * FROM subscription_plans').all()
  res.json({ plans })
})

router.post('/create', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { plan_id } = req.body
    if (!plan_id) {
      res.status(400).json({ error: 'plan_id is required' })
      return
    }

    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(plan_id) as any
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' })
      return
    }

    const existingActive = db.prepare(
      'SELECT id, status FROM user_subscriptions WHERE user_id = ? AND (status = ? OR status = ?) AND end_date > datetime(\'now\')'
    ).get(req.userId, 'active', 'pending') as any
    if (existingActive) {
      if (existingActive.status === 'active') {
        res.status(400).json({ error: 'Already have an active subscription' })
        return
      }
      db.prepare('UPDATE user_subscriptions SET status = ? WHERE id = ?').run('cancelled', existingActive.id)
    }

    const amount = plan.price_rub.toFixed(2)
    const planNames: Record<number, string> = { 1: 'Месяц Pro', 2: 'Год Pro' }

    const body = JSON.stringify({
      amount: { value: amount, currency: 'RUB' },
      confirmation: {
        type: 'redirect',
        return_url: `${process.env.YOO_RETURN_URL || 'http://localhost:5173/pro/success'}?plan_id=${plan_id}`,
      },
      capture: true,
      description: planNames[plan.id] || 'Подписка Pro',
    })

    const resp = await fetch(`${YOO_BASE}/payments`, {
      method: 'POST',
      headers: yooHeaders(),
      body,
    })

    const data = await resp.json()
    if (!resp.ok) {
      console.error('YooKassa error:', data)
      res.status(502).json({ error: 'Payment service error' })
      return
    }

    const subscriptionId = db.prepare(`
      INSERT INTO user_subscriptions (user_id, plan_id, status, yookassa_payment_id, end_date)
      VALUES (?, ?, 'pending', ?, ?)
    `).run(req.userId, plan_id, data.id, new Date(Date.now() + plan.duration_days * 86400000).toISOString()).lastInsertRowid

    res.json({
      confirmation_url: data.confirmation?.confirmation_url,
      payment_id: data.id,
      subscription_id: subscriptionId,
    })
  } catch (err) {
    console.error('Create payment error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/verify', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { payment_id } = req.body
    if (!payment_id) {
      res.status(400).json({ error: 'payment_id is required' })
      return
    }

    const resp = await fetch(`${YOO_BASE}/payments/${payment_id}`, {
      headers: {
        'Authorization': yooHeaders()['Authorization'],
      },
    })

    const data = await resp.json()
    if (!resp.ok) {
      console.error('YooKassa verify error:', data)
      res.status(502).json({ error: 'Payment verification failed' })
      return
    }

    const sub = db.prepare(
      'SELECT * FROM user_subscriptions WHERE yookassa_payment_id = ? AND user_id = ?'
    ).get(payment_id, req.userId) as any

    if (!sub) {
      res.status(404).json({ error: 'Subscription not found' })
      return
    }

    if (data.status === 'succeeded' && sub.status === 'pending') {
      db.prepare('UPDATE user_subscriptions SET status = ? WHERE id = ?').run('active', sub.id)
      res.json({ status: 'active', plan_id: sub.plan_id, end_date: sub.end_date })
    } else if (data.status === 'canceled' || data.status === 'failed') {
      db.prepare('UPDATE user_subscriptions SET status = ? WHERE id = ?').run('cancelled', sub.id)
      res.json({ status: data.status })
    } else {
      res.json({ status: sub.status, payment_status: data.status })
    }
  } catch (err) {
    console.error('Verify payment error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/status', authMiddleware, (req: AuthRequest, res: Response) => {
  const sub = db.prepare(`
    SELECT us.*, sp.name as plan_name, sp.price_rub
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.plan_id
    WHERE us.user_id = ? AND us.status = ? AND us.end_date > datetime('now')
    ORDER BY us.id DESC LIMIT 1
  `).get(req.userId, 'active') as any

  if (sub) {
    res.json({ active: true, plan_id: sub.plan_id, plan_name: sub.plan_name, price_rub: sub.price_rub, end_date: sub.end_date })
  } else {
    const pending = db.prepare(
      "SELECT * FROM user_subscriptions WHERE user_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1"
    ).get(req.userId) as any
    if (pending) {
      res.json({ active: false, pending: true })
    } else {
      res.json({ active: false })
    }
  }
})

router.post('/webhook', async (req: AuthRequest, res: Response) => {
  try {
    const event = req.body
    if (event.object && event.event === 'payment.succeeded') {
      const sub = db.prepare(
        'SELECT * FROM user_subscriptions WHERE yookassa_payment_id = ?'
      ).get(event.object.id) as any
      if (sub && sub.status === 'pending') {
        db.prepare('UPDATE user_subscriptions SET status = ? WHERE id = ?').run('active', sub.id)
      }
    }
    res.status(200).send('OK')
  } catch (err) {
    console.error('Webhook error:', err)
    res.status(200).send('OK')
  }
})

export default router
