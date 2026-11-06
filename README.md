# Materialious Companion

Browser request bridge for Materialious. By default, Companion
activates only on `https://app.materialio.us/`. Add another instance from the
toolbar popup to enable it there too.

On enabled instances, the page exposes `window.materialiousCompanionFetch`, a fetch-compatible function
Materialious can call explicitly for CORS-sensitive requests. Companion does
not modify the page's normal `fetch`; the bridge uses the ytc-bridge page script
→ content script → background request pattern.

The popup uses a compact Material Design 3 layout inspired by BeerCSS cards,
fields, rounded buttons, and tonal surfaces. See [BeerCSS](https://www.beercss.com/).

## Install

Build the extension for your browser and load the generated unpacked extension
from the browser's extensions page. Reload Materialious after installing.

```bash
npm install
npm run build
npm run build:firefox
```

The extension requests access to all HTTP and HTTPS hosts so the request bridge
can reach any Invidious instance, YouTube API, or media server. The bridge
activates only on the Materialious sites configured in the popup. Chromium
registers a content script when you add a Materialious instance. Browser-managed headers
and cookies are omitted; other YouTube.js request headers, including
`Content-Type`, are forwarded.

After updating an existing installation, reload the extension and approve the
expanded site access if the browser prompts, then reload Materialious.

## Development

```bash
npm run dev
npm run dev -- --browser=firefox
```

Run the TypeScript check with `npm run check` (Node 22.18 or newer).
