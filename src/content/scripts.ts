/**
 * Content-side relay for requests initiated by the page-world bridge.
 * The toolbar popup is the only extension UI; this script adds no page UI.
 */
export default function initial() {
  const relay = (event: MessageEvent) => {
    if (event.source !== window || event.data?.channel !== 'materialious-companion') return

    chrome.runtime.sendMessage(event.data.request, (reply) => {
      window.postMessage({
        channel: 'materialious-companion-response',
        id: event.data.id,
        reply: chrome.runtime.lastError
          ? {ok: false, error: chrome.runtime.lastError.message}
          : reply
      }, '*')
    })
  }

  window.addEventListener('message', relay)

  chrome.storage.local.get({materialiousInstances: ['https://app.materialio.us']}, (settings) => {
    const enabled = (settings.materialiousInstances as string[]).some((instance) => {
      try { return new URL(instance).origin === location.origin } catch { return false }
    })
    if (!enabled) return

    const bridge = document.createElement('script')
    bridge.src = chrome.runtime.getURL('page/bridge.js')
    bridge.onload = () => bridge.remove()
    ;(document.documentElement || document.head).appendChild(bridge)
  })

  return () => window.removeEventListener('message', relay)
}
