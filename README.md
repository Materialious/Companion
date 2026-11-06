# Materialious Companion

Toolbar popup and browser request bridge for Materialious. By default, Companion
activates only on `https://app.materialio.us/`. Add another instance from the
toolbar popup to enable it there too.

On enabled instances, the page exposes `window.materialiousCompanionPlugin =
true` and `window.materialiousCompanionFetch`, a fetch-compatible function
Materialious can use for CORS-sensitive requests. For compatibility, Companion
also detects Materialious' existing `/api/proxy/<encoded URL>` fetch pattern
and performs the request from the extension background context. The bridge
uses the ytc-bridge page script → content script → background request pattern.

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

The extension requests access to HTTP and HTTPS hosts because each instance may
use different API, image, and media hosts. Requests omit cookies, matching
Materialious' current proxy behavior.

## Development

```bash
npm run dev
npm run dev -- --browser=firefox
```

## Current scope

Fetch responses preserve status, headers, and body, but are buffered in memory.
Very large media segments may use more memory than a streaming proxy. XHR still
uses Materialious' configured proxy.
