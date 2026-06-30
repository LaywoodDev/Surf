const API = '/api'

export interface PushSubscriptionKeys {
  p256dh: string
  auth: string
}

export interface PushSubscriptionData {
  endpoint: string
  keys: PushSubscriptionKeys
}

function api(path: string, options?: RequestInit) {
  const token = localStorage.getItem('token')
  const isFormData = options?.body instanceof FormData
  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  }).then(r => r.json().then(d => {
    if (!r.ok) throw new Error(d.error || 'Request failed')
    return d
  }))
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

export async function subscribeToPush(publicKey: string): Promise<PushSubscriptionData | null> {
  if (!('serviceWorker' in navigator)) return null
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
  })
  const json = subscription.toJSON()
  if (!json.keys || !json.endpoint) return null
  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    const json = subscription.toJSON()
    await subscription.unsubscribe()
    if (json.endpoint) {
      await api('/push/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint: json.endpoint }),
      }).catch(() => {})
    }
  }
}

export async function registerPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') return false

  try {
    const { publicKey } = await api('/push/vapid-public-key')
    if (!publicKey) return false

    const subscription = await subscribeToPush(publicKey)
    if (!subscription) return false

    await api('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
    })
    return true
  } catch (err) {
    console.error('Push registration failed:', err)
    return false
  }
}

export async function unregisterPush(): Promise<void> {
  await unsubscribeFromPush()
}
