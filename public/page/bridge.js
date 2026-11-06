(() => {
  if (window.__materialiousCompanionBridge) return;
  Object.defineProperty(window, "__materialiousCompanionBridge", {
    value: true,
  });

  const pending = new Map();
  let nextId = 0;
  const encodeBytes = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  };
  const decodeBytes = (base64) => {
    if (typeof base64 !== "string") {
      throw new TypeError("Companion response body must be a base64 string");
    }
    const normalized = base64
      .replace(/\s/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    if (normalized.length % 4 === 1) {
      throw new TypeError("Companion returned invalid base64 response data");
    }
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
      .buffer;
  };
  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      event.data?.channel !== "materialious-companion-response"
    )
      return;
    const resolve = pending.get(event.data.id);
    if (!resolve) return;
    pending.delete(event.data.id);
    resolve(event.data.reply);
  });

  const request = (url, init = {}) =>
    new Promise((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      window.postMessage(
        {
          channel: "materialious-companion",
          id,
          request: {
            type: "materialious-proxy-fetch",
            url,
            method: init.method || "GET",
            headers: [...new Headers(init.headers || {}).entries()],
            bodyBase64: init.bodyBase64,
            redirect: init.redirect || "follow",
          },
        },
        "*",
      );
    });

  // Public opt-in API for Materialious. The app can detect the marker and use
  // this fetch-compatible function for CORS-sensitive requests.
  window.materialiousCompanionFetch = async (input, init = {}) => {
    const requestInput = new Request(input, init);
    const headers = new Headers(requestInput.headers);
    let bodyBase64;
    if (requestInput.body) {
      // Materialious has already encoded marked bodies for its server proxy.
      // Reuse that text; encode other bodies so Chrome's JSON messaging never
      // receives an ArrayBuffer. The worker decodes either case exactly once.
      bodyBase64 = headers.has("__is_base64_encoded")
        ? await requestInput.clone().text()
        : encodeBytes(await requestInput.clone().arrayBuffer());
    }
    const reply = await request(requestInput.url, {
      method: requestInput.method,
      headers: [...headers.entries()],
      bodyBase64,
      redirect: requestInput.redirect,
    });
    if (!reply?.ok)
      throw new TypeError(reply?.error || "Companion request failed");
    const responseBody =
      requestInput.method === "HEAD" || [204, 205, 304].includes(reply.status)
        ? null
        : decodeBytes(reply.bodyBase64);
    return new Response(responseBody, {
      status: reply.status,
      statusText: reply.statusText,
      headers: reply.headers,
    });
  };
})();
