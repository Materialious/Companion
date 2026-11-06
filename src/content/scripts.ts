// Extension.js content script template (JavaScript)
// - Export a default function (required in v3) that mounts your UI
// - Wrapper handles Shadow DOM isolation, CSS injection, HMR and cleanup
// - Avoid adding your own HMR code; dev warnings will be shown if detected
// Docs: https://extension.js.org/docs/content-scripts
import {mount} from 'svelte'
import ContentApp from './ContentApp.svelte'
import './styles.css'

console.log('[From the page context] Hello from content_scripts!')

/**
 * Extension.js content_script entrypoint. The framework calls this on
 * injection and calls the returned function on HMR/teardown to clean up.
 * Do not invoke it yourself.
 */
export default function initial() {
  const relay = (event: MessageEvent) => {
    if (event.source !== window || event.data?.channel !== 'materialious-companion') return
    chrome.runtime.sendMessage(event.data.request, (reply) => {
      window.postMessage({
        channel: 'materialious-companion-response',
        id: event.data.id,
        reply: chrome.runtime.lastError ? {ok: false, error: chrome.runtime.lastError.message} : reply
      }, '*')
    })
  }
  window.addEventListener('message', relay)

  const activateBridge = () => {
    const bridge = document.createElement('script')
    bridge.src = chrome.runtime.getURL('page/bridge.js')
    bridge.onload = () => bridge.remove()
    ;(document.documentElement || document.head).appendChild(bridge)
  }

  chrome.storage.local.get({materialiousInstances: ['https://app.materialio.us']}, (settings) => {
    const currentOrigin = location.origin
    const allowed = (settings.materialiousInstances as string[]).some((instance) => {
      try { return new URL(instance).origin === currentOrigin } catch { return false }
    })
    if (allowed) activateBridge()
  })
  const rootDiv = document.createElement('div')
  rootDiv.setAttribute('data-extension-root', 'true')
  // Isolate the host from page styles (e.g. example.com ships div{opacity:.8},
  // which would otherwise fade the whole widget): the shadow DOM only protects
  // descendants; the host element itself still takes page CSS.
  rootDiv.style.cssText = 'all: initial !important'
  document.body.appendChild(rootDiv)

  // Injecting content_scripts inside a shadow dom
  // prevents conflicts with the host page's styles.
  // This way, styles from the extension won't leak into the host page.
  const shadowRoot = rootDiv.attachShadow({mode: 'open'})

  const styleElement = document.createElement('style')
  shadowRoot.appendChild(styleElement)

  fetchCSS().then((response) => (styleElement.textContent = response))

  // Create container for Svelte app
  const contentDiv = document.createElement('div')
  contentDiv.className = 'content_script'
  shadowRoot.appendChild(contentDiv)

  // Mount Svelte app using Svelte 5's mount function
  mount(ContentApp, {
    target: contentDiv
  })

  // The sidebar asks this page for its title over runtime messaging, and the
  // answer leaves with the UI on teardown so a reload never answers twice.
  chrome.runtime.onMessage.addListener(answerPageTitle)

  return () => {
    window.removeEventListener('message', relay)
    chrome.runtime.onMessage.removeListener(answerPageTitle)
    rootDiv.remove()
  }
}

function answerPageTitle(
  message: {type?: string} | undefined,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (answer: {title: string; url: string}) => void
) {
  if (!message || message.type !== 'getPageTitle') return

  sendResponse({title: document.title, url: location.href})
}

async function fetchCSS() {
  const cssUrl = new URL('./styles.css', import.meta.url)
  const response = await fetch(cssUrl)
  const text = await response.text()

  return response.ok ? text : Promise.reject(text)
}
