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
  const send = (id, request) => window.postMessage({
    channel: "materialious-companion", id, request,
  }, "*");
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.channel !== "materialious-companion-response") return;
    pending.get(event.data.id)?.(event.data.reply);
  });

  const request = (url, init, signal) => new Promise((resolve, reject) => {
    const id = ++nextId;
    let controller;
    let settled = false;
    let finished = false;
    const cleanup = () => { pending.delete(id); signal.removeEventListener("abort", onAbort); };
    const fail = (error) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (settled) controller?.error(error); else reject(error);
    };
    const onAbort = () => { send(id, {type: "cancel"}); fail(signal.reason); };
    pending.set(id, (reply) => {
      if (reply.type === "headers") {
        settled = true;
        const body = reply.hasBody ? new ReadableStream({
          start(c) { controller = c; },
          pull() { send(id, {type: "pull"}); },
          cancel() { finished = true; cleanup(); send(id, {type: "cancel"}); },
        }) : null;
        if (!body) { finished = true; cleanup(); }
        resolve(new Response(body, {status: reply.status, statusText: reply.statusText, headers: reply.headers}));
      } else if (reply.type === "chunk") controller.enqueue(new Uint8Array(decodeBytes(reply.data)));
      else if (reply.type === "end") { finished = true; cleanup(); controller.close(); }
      else if (reply.type === "error") fail(new TypeError(reply.error));
      else if (reply.type === "disconnect") fail(new TypeError("Companion connection closed"));
    });
    if (signal.aborted) { onAbort(); return; }
    signal.addEventListener("abort", onAbort, {once: true});
    send(id, {type: "start", url, method: init.method, headers: init.headers,
      bodyBase64: init.bodyBase64, redirect: init.redirect});
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
    return request(requestInput.url, {
      method: requestInput.method,
      headers: [...headers.entries()],
      bodyBase64,
      redirect: requestInput.redirect,
    }, requestInput.signal);
  };
})();
