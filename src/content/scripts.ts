/**
 * Content-side relay for requests initiated by the page-world bridge.
 * The toolbar popup is the only extension UI; this script adds no page UI.
 */
export default function initial() {
  const ports = new Map<number, chrome.runtime.Port>()
  const relay = (event: MessageEvent) => {
    if (event.source !== window || event.data?.channel !== 'materialious-companion') return
    const {id, request} = event.data
    if (request.type === 'start') {
      const port = chrome.runtime.connect({name: 'materialious-proxy-fetch'})
      ports.set(id, port)
      port.onMessage.addListener((reply) => window.postMessage({channel: 'materialious-companion-response', id, reply}, '*'))
      port.onDisconnect.addListener(() => {
        ports.delete(id)
        window.postMessage({channel: 'materialious-companion-response', id, reply: {type: 'disconnect'}}, '*')
      })
      port.postMessage(request)
    } else {
      ports.get(id)?.postMessage(request)
    }
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

  return () => { window.removeEventListener('message', relay); ports.forEach((port) => port.disconnect()) }
}
