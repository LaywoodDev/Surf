import webpush from 'web-push'
import db from './db'

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

export function getVapidPublicKey(): string | undefined {
  return vapidPublicKey
}

export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export function saveSubscription(userId: number, sub: PushSubscription) {
  db.prepare(
    'INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)'
  ).run(userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth)
}

export function deleteSubscription(userId: number, endpoint: string) {
  db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(userId, endpoint)
}

export async function sendPushNotification(
  userId: number,
  payload: { title: string; body: string; url?: string }
) {
  if (!vapidPublicKey || !vapidPrivateKey) return

  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId) as Array<{
    endpoint: string
    p256dh: string
    auth: string
  }>

  const data = JSON.stringify(payload)

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          data
        )
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          deleteSubscription(userId, sub.endpoint)
        } else {
          console.error('Push send error:', err.message)
        }
      }
    })
  )
}

export function isPushConfigured(): boolean {
  return Boolean(vapidPublicKey && vapidPrivateKey)
}
