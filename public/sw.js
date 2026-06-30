self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const data = event.data.json()
    event.waitUntil(
      self.registration.showNotification(data.title || 'Surf', {
        body: data.body || 'New message',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: data.tag || 'surf-message',
        data: data.url || '/',
        requireInteraction: false,
      })
    )
  } catch (e) {
    console.error('Push event error:', e)
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})
