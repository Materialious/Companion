console.log(
  '[From the background context] Hello from the background worker/script!'
)

// Requests arrive only from the content bridge, which relays calls made to a
// Materialious /api/proxy/ URL. Extension-host fetches are not subject to page
// CORS, so the server-side proxy can be skipped.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'materialious-proxy-fetch') return

  ;(async () => {
    try {
      const target = new URL(message.url)
      if (target.protocol !== 'https:' && target.protocol !== 'http:') {
        throw new Error('Only HTTP(S) requests are supported')
      }
      const response = await fetch(target.href, {
        method: message.method,
        headers: message.headers,
        body: message.body,
        credentials: 'omit',
        redirect: message.redirect || 'follow'
      })
      sendResponse({
        ok: true,
        status: response.status,
        statusText: response.statusText,
        headers: [...response.headers.entries()],
        body: await response.arrayBuffer()
      })
    } catch (error) {
      sendResponse({ok: false, error: String(error)})
    }
  })()
  return true
})

