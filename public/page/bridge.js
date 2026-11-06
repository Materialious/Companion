(() => {
  if (window.__materialiousCompanionBridge) return
  Object.defineProperty(window, '__materialiousCompanionBridge', {value: true})

  const pending = new Map()
  let nextId = 0
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.channel !== 'materialious-companion-response') return
    const resolve = pending.get(event.data.id)
    if (!resolve) return
    pending.delete(event.data.id)
    resolve(event.data.reply)
  })

  const request = (url, init = {}) => new Promise((resolve) => {
    const id = ++nextId
    pending.set(id, resolve)
    window.postMessage({
      channel: 'materialious-companion', id,
      request: {
        type: 'materialious-proxy-fetch', url,
        method: init.method || 'GET',
        headers: [...new Headers(init.headers || {}).entries()],
        body: init.body || undefined,
        redirect: init.redirect || 'follow'
      }
    }, '*')
  })

  // Public opt-in API for Materialious. The app can detect the marker and use
  // this fetch-compatible function for CORS-sensitive requests.
  window.materialiousCompanionPlugin = true
  window.materialiousCompanionFetch = (input, init = {}) => {
    const url = input instanceof Request ? input.url : String(input)
    const options = init || (input instanceof Request ? input : {})
    return request(url, options).then((reply) => {
      if (!reply?.ok) throw new TypeError(reply?.error || 'Extension proxy request failed')
      return new Response(reply.body, {
        status: reply.status, statusText: reply.statusText, headers: reply.headers
      })
    })
  }

  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const requestUrl = input instanceof Request ? input.url : String(input)
    // Materialious routes external traffic through /api/proxy/<encoded URL>.
    // Only intercept that signature; unrelated pages and requests are untouched.
    const match = requestUrl.match(/\/api\/proxy\/(https?%3A%2F%2F.*)$/i)
    if (!match) return originalFetch(input, init)
    let target
    try { target = decodeURIComponent(match[1]) } catch { return originalFetch(input, init) }
    const options = init || (input instanceof Request ? input : {})
    return window.materialiousCompanionFetch(target, options)
  }
})()
