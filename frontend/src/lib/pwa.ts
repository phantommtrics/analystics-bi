async function unregisterServiceWorkersInDev() {
  if (!('serviceWorker' in navigator)) return

  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((registration) => registration.unregister()))

  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  // Stale SWs from preview/prod hijack localhost:5173 and serve old HTML (e.g. main.tsx).
  if (import.meta.env.DEV) {
    void unregisterServiceWorkersInDev()
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed', error)
    })
  })
}
