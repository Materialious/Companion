import sodium from "libsodium-wrappers";

console.log(
  "[From the background context] Hello from the background worker/script!",
);

function instanceMatchPattern(origin: string): string {
  const url = new URL(origin);
  return `${url.protocol}//${url.hostname}/*`;
}

function instanceScriptId(origin: string): string {
  return `materialious-${btoa(origin).replace(/[^a-zA-Z0-9]/g, "")}`;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function decodeBase64(value: string): Uint8Array {
  if (typeof value !== "string") {
    throw new TypeError("Companion request body must be a base64 string");
  }
  const normalized = value
    .replace(/\s/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  if (normalized.length % 4 === 1) {
    throw new TypeError("Invalid base64 request body");
  }
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new TypeError("Invalid base64 request body");
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

let nextHeaderRuleId = 1;

async function addYouTubeHeaderRule(url: URL): Promise<number | undefined> {
  if (!chrome.declarativeNetRequest?.updateSessionRules) return undefined;
  const host = url.hostname.toLowerCase();
  if (!(
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtubei.googleapis.com" ||
    host === "googlevideo.com" ||
    host.endsWith(".googlevideo.com") ||
    host === "ytimg.com" ||
    host.endsWith(".ytimg.com") ||
    host === "ggpht.com" ||
    host.endsWith(".ggpht.com")
  ))
    return undefined;

  const id = nextHeaderRuleId++;
  await chrome.declarativeNetRequest.updateSessionRules({
    addRules: [
      {
        id,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [
            {
              header: "origin",
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: "https://www.youtube.com",
            },
            {
              header: "referer",
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: "https://www.youtube.com",
            },
          ],
        },
        // Match by domain instead of the initial URL: fetch follows YouTube's
        // redirects, and the final googlevideo request needs the same headers.
        condition: {
          requestDomains: [
            "youtube.com",
            "youtubei.googleapis.com",
            "googlevideo.com",
            "ytimg.com",
            "ggpht.com",
          ],
          resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST],
        },
      },
    ],
  });
  return id;
}

async function removeHeaderRule(id: number | undefined) {
  if (id !== undefined) {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [id],
    });
  }
}

async function refreshInstanceTabs(origin: string) {
  const match = instanceMatchPattern(origin);
  const tabs = await chrome.tabs.query({ url: match });
  await Promise.all(
    (tabs || []).flatMap((tab) => {
      if (tab.id === undefined || !tab.url) return [];
      try {
        if (new URL(tab.url).origin === origin)
          return [chrome.tabs.reload(tab.id)];
      } catch {
        // Ignore tabs whose URL is not a normal web URL.
      }
      return [];
    }),
  );
}

async function registerInstance(origin: string, refreshOpenTabs = false) {
  if (!chrome.scripting?.registerContentScripts) return;
  const match = instanceMatchPattern(origin);
  const id = instanceScriptId(origin);
  const existing = await chrome.scripting.getRegisteredContentScripts({
    ids: [id],
  });
  if (existing.length)
    await chrome.scripting.unregisterContentScripts({ ids: [id] });
  await chrome.scripting.registerContentScripts([
    {
      id,
      matches: [match],
      js: ["content/scripts.js"],
      runAt: "document_idle",
    },
  ]);
  if (refreshOpenTabs) await refreshInstanceTabs(origin);
}

async function unregisterInstance(origin: string) {
  if (!chrome.scripting?.unregisterContentScripts) return;
  await chrome.scripting.unregisterContentScripts({
    ids: [instanceScriptId(origin)],
  });
  await refreshInstanceTabs(origin);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "registerMaterialiousInstance") {
    registerInstance(message.origin, true).then(
      () => sendResponse({ ok: true }),
      (error) => sendResponse({ ok: false, error: String(error) }),
    );
    return true;
  }
  if (message?.type === "unregisterMaterialiousInstance") {
    unregisterInstance(message.origin).then(
      async () => {
        if (message.revokePermission) {
          await chrome.permissions.remove({
            origins: [instanceMatchPattern(message.origin)],
          });
        }
        sendResponse({ ok: true });
      },
      (error) => sendResponse({ ok: false, error: String(error) }),
    );
    return true;
  }
});

chrome.storage.local.get(
  { materialiousInstances: ["https://app.materialio.us"] },
  (settings) => {
    for (const origin of settings.materialiousInstances as string[]) {
      const pattern = instanceMatchPattern(origin);
      chrome.permissions.contains({ origins: [pattern] }, (granted) => {
        if (granted && origin !== "https://app.materialio.us") {
          registerInstance(origin).catch((error) => console.error(error));
        }
      });
    }
  },
);

// Chrome can close the toolbar popup while its permission prompt is open. Use
// the grant event as the durable signal to register any configured instance.
chrome.permissions.onAdded.addListener((addedPermissions) => {
  chrome.storage.local.get(
    { materialiousInstances: ["https://app.materialio.us"] },
    (settings) => {
      const addedOrigins = new Set(addedPermissions.origins || []);
      for (const origin of settings.materialiousInstances as string[]) {
        if (origin === "https://app.materialio.us") continue;
        const pattern = instanceMatchPattern(origin);
        if (addedOrigins.has(pattern))
          registerInstance(origin, true).catch((error) => console.error(error));
      }
    },
  );
});

// Materialious calls the page bridge's explicit fetch API. Extension-host
// fetches are not subject to page CORS.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "materialious-proxy-fetch") return;

  (async () => {
    try {
      const target = new URL(message.url);
      if (target.protocol !== "https:" && target.protocol !== "http:") {
        throw new Error("Only HTTP(S) requests are supported");
      }
      const headers = new Headers(message.headers);
      await sodium.ready;
      // The page bridge sends one base64 string, reusing Materialious' encoded
      // body when marked. Decode only once before sending the original bytes.
      const body: BodyInit | undefined = message.bodyBase64 !== undefined
        ? asArrayBuffer(decodeBase64(message.bodyBase64))
        : undefined;
      headers.delete("__is_base64_encoded");
      // Keep YouTube.js's request headers intact. Fetch controls browser-managed
      // headers such as Host, Origin, Referer, User-Agent, Cookie, and
      // Content-Length; removing Content-Type here breaks YouTube's JSON API
      // requests and can make them look unlike the requests sent by the web app.
      for (const name of [
        "referer",
        "origin",
        "host",
        "user-agent",
        "cookie",
        "content-length",
      ])
        headers.delete(name);
      // fetch() cannot set Origin or Referer from an extension worker. Apply
      // them at the network layer for YouTube media/API hosts, as YouTube
      // rejects some requests when these identify the extension or are absent.
      const headerRuleId = await addYouTubeHeaderRule(target);
      let response: Response;
      try {
        response = await fetch(target.href, {
          method: message.method,
          headers,
          body:
            message.method === "GET" || message.method === "HEAD"
              ? undefined
              : body,
          credentials: "omit",
          redirect: message.redirect || "follow",
          signal: AbortSignal.timeout(10000),
        });
      } finally {
        await removeHeaderRule(headerRuleId);
      }
      // fetch() may transparently decompress the response body. Do not forward
      // encoding or length metadata that describes the wire representation;
      // preserve Content-Range and the status for byte-range media requests.
      const responseHeaders = new Headers(response.headers);
      responseHeaders.delete("content-encoding");
      responseHeaders.delete("content-length");
      sendResponse({
        ok: true,
        status: response.status,
        statusText: response.statusText,
        headers: [...responseHeaders.entries()],
        bodyBase64: sodium.to_base64(
          new Uint8Array(await response.arrayBuffer()),
        ),
      });
    } catch (error) {
      sendResponse({ ok: false, error: String(error) });
    }
  })();
  return true;
});
