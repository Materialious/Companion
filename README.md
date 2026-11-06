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

Run the TypeScript check with `npm run check` (Node 22.18 or newer).

## CI and releases

Pull requests run the TypeScript check and build, package, and inspect the Chrome,
Firefox, and Edge extensions. A push to `main` repeats those checks, then submits
the same ZIP files to the three browser stores. Update both `package.json` and
`src/manifest.json` to a new version before merging a release; stores reject a
version that has already been submitted.

Create a GitHub Actions `production` environment with these secrets before the
first deployment:

| Store            | Secrets                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| Chrome Web Store | `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, `CHROME_PUBLISHER_ID`, `CHROME_EXTENSION_ID` |
| Firefox Add-ons  | `FIREFOX_API_KEY`, `FIREFOX_API_SECRET`                                                                          |
| Edge Add-ons     | `EDGE_API_KEY`, `EDGE_CLIENT_ID`, `EDGE_PRODUCT_ID`                                                              |

See the [publisher action's store setup guide](https://github.com/creeperkatze/extension-publish#-store-setup)
for where to obtain each credential.

The stores also need existing listings and their one-time dashboard setup. The
Firefox add-on ID is already set in the manifest. Store submission starts review;
the stores decide when an update becomes available to users. Keep the reviewer
information in [STORE.md](STORE.md) current for each release.
