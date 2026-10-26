export type NotifyState = 'unsupported' | 'default' | 'granted' | 'denied'

export const notifyState = (): NotifyState => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

/** must be called from a tap or click, or the browser will ignore it */
export async function askNotify(): Promise<NotifyState> {
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    await Notification.requestPermission()
  } catch {
    /* older browsers use a callback form; the state below still reflects the outcome */
  }
  return notifyState()
}

/** a system notification; goes through the service worker when there is one, which phones require */
export async function notifyNow(title: string, body: string) {
  if (notifyState() !== 'granted') return
  const opts = { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'timer-done', renotify: true, vibrate: [200, 100, 200, 100, 200] } as NotificationOptions
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, opts)
    else new Notification(title, opts)
  } catch {
    /* notifications unavailable */
  }
}
