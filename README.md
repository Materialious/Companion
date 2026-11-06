# Materialious Companion

Toolbar popup and browser request bridge for Materialious. By default, Companion
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

The extension has access to the default Materialious site and asks for
permission per additional instance when you add it. Chromium registers a
content script for that instance after permission is granted. YouTube API and
media hosts are also permitted for the request bridge. Browser-managed headers
and cookies are omitted; other YouTube.js request headers, including
`Content-Type`, are forwarded.

## Development

```bash
npm run dev
npm run dev -- --browser=firefox
```

Run the fetch bridge regression checks with `npm test` (Node 22.18 or newer).
