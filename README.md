# Convert2it

**Truly universal online file converter — 100% in your browser.**

Convert2it converts files between 400+ output formats across every medium: images, video,
audio, text, documents, spreadsheets, presentations, archives, fonts, 3D models, databases,
game saves, and plenty of niche formats. There is no backend and no upload. Every conversion
runs locally on the visitor's device via WebAssembly and web workers — your files never leave
the machine.

- **Live site (GitHub Pages):** https://chetanpatel0.github.io/convert2it/
- **Contact:** [Discord](https://discord.com/users/patel_chetan)

## Features

- 100% static site — one `dist/` folder, no server code, no database, no API keys.
- Works on GitHub Pages, Netlify, Cloudflare Pages, Puter, cPanel/Apache, nginx, or any
  plain HTTP file host, at a domain root or in a subdirectory.
- Private by design: conversions happen in-browser, and the bundled CSP blocks all outbound
  network access from the app.
- Cross-origin isolation is handled by `public/mini-coi.js` (a service worker), so
  `SharedArrayBuffer`-backed tools (ffmpeg, sqlite, and friends) work even on hosts that
  cannot set COOP/COEP headers.
- Long-lived hashed assets + a precomputed format cache (`dist/cache.json`) for fast loads.

### Installable PWA

The site ships a web app manifest, generated icons, and a service worker, so it installs as a
real app on Android, Windows, Linux, ChromeOS, and iPadOS/iOS (Safari: Share → Add to Home
Screen). Once installed it opens in its own window, keeps working offline for previously used
tools, and appears in the operating system's share menu:

- **Share files _to_ Convert2it** from any app (Android share sheet, Windows "Share with",
  file manager "Open with"). The `share_target` handler stores the upload in Cache Storage and
  the app opens straight on the conversion screen. `file_handlers` adds "Open with Convert2it"
  on desktop.
- **Share converted files _out_** with the **Share…** button in the completion popup, which
  uses `navigator.share({ files })`. It only appears where the browser supports file sharing;
  otherwise "Download again" is offered.

The app settings panel also has an **Install** section and **Clear cache & site data**, which
wipes caches, IndexedDB, storage, and the service worker registration before reloading.

PWA features need a secure context: use HTTPS (GitHub Pages, Puter, and Netlify all are) or
`localhost` for testing. The manifest and service worker are served relative to the site, so
they work at a domain root or in a subdirectory.

## Building

Requirements: [Bun](https://bun.sh/) (the build system is Bun-only), Node is not used.

```bash
bun install --frozen-lockfile
bun run icons          # optional: regenerate public/icons/*.png from src/ui/img/logo.svg
bun run build          # assembles wasm/toolchain assets, type-checks, builds dist/
bun run cache:build    # optional but recommended: generates dist/cache.json
```

Run `cache:build` **after** `build`, because `vite build` empties `dist/`.

`bun run build` runs three steps:

1. `build:assemble` — downloads the pinned upstream sources and prebuilt WASM tarballs into
   `built/` (verified by SHA-256). This is the slow, network-heavy part (~100 MB).
2. `tsc` — type-checks the project.
3. `vite build` — writes the static site to `dist/`.

Notes:

- The optional **clang** requirement (C/C++ → EXE/WASM) is deliberately not assembled in this
  fork. It adds ~137 MB of WASM, and the site is meant to stay purely browser-based. Vite
  automatically excludes the `clang` handler when `built/clang` is missing.
- `cache:build` drives a headless Chromium through Puppeteer to enumerate the format list. The
  site still works without `cache.json`; first load is just slower.
- `bun test` runs the unit tests plus an end-to-end Puppeteer suite that converts real files
  through the built site. Run `bun run build && bun run cache:build` first; the browser suite
  takes several minutes on a fast machine.
- On a fresh machine, `bun install` may report "Blocked 1 postinstall". That is Bun sandboxing
  `core-js`/`es5-ext` build scripts; they are not needed.

## Deploying

Everything is in `dist/`. Upload its **contents** (not the `dist` folder itself) to your host.
`vite` is configured with `base: "./"`, so the same build works at `/`, `/convert2it/`, or any
other subdirectory.

### Package a zip for upload

```powershell
powershell -ExecutionPolicy Bypass -File deploy/package.ps1
```

This copies `deploy/_headers` and `deploy/.htaccess` into `dist/` and writes `convert-site.zip`
(site root = `index.html`). The current build is ~195 MB / 540 files.

### GitHub Pages

1. Push this repository to GitHub with `main` as the default branch.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. `.github/workflows/pages.yml` builds and deploys on every push to `main`.

The workflow installs Bun, assembles the assets, builds, generates `cache.json`, runs the test
suite, and uploads `dist/` as the Pages artifact. If your repository name is not `convert2it`,
update the URLs in `index.html` (`meta name="url"`, `og:url`, `og:image`) and in
`package.json` (`homepage`, `repository`).

### Netlify

Drag the packaged zip (or the `dist/` folder) into Netlify Drop, or connect the repo with:

- Build command: `bun run build && bun run cache:build`
- Publish directory: `dist`

`deploy/_headers` is picked up automatically and sets COOP/COEP/CSP plus caching.

### Cloudflare Pages

- Build command: `bun run build && bun run cache:build`
- Output directory: `dist`

**Warning:** Cloudflare Pages rejects files above 25 MiB. This build contains
`pandoc-*.wasm` at ~59 MB and `typst_ts_web_compiler_bg-*.wasm` at ~27 MB, so a plain upload
will fail there unless you drop those handlers or host the large WASM files elsewhere.

### cPanel / Apache / nginx

- cPanel/Apache: upload `dist/` contents to `public_html/` (or a subfolder) and keep
  `deploy/.htaccess` next to `index.html`. It adds the `.wasm` MIME type, security headers,
  and cache rules.
- nginx: use `docker/nginx/default.conf` as a starting point. It sets COOP/COEP/CSP for
  `/convert/`; adjust `root` and the location prefix to your path.

## Project layout

```
index.html            page shell, meta tags, manifest links
src/                  app, format graph, handlers, Preact UI
public/               mini-coi.js (isolation + offline + share-target service worker),
                      manifest.webmanifest, icons/
recipe/               pinned upstream sources + build scripts for wasm assets
scripts/build.ts      Bun build orchestrator (assemble, prebuild, check, patch)
scripts/make-pwa-icons.ts  renders the PWA icon set from the logo
buildCache.js         headless-Chromium format cache generator
deploy/               host configs + packaging script
dist/                 build output (generated, git-ignored)
```

## Credits & license

- project: [p2r3/convert](https://github.com/p2r3/convert) ("Convert to it!") by
  PortalRunner / p2r3. Huge thanks to everyone who built the converter and its
  format handlers. I really thanks to you!
- This fork changes branding, the help panel, build defaults, and adds deployment files.
- Licensed under **GPL-2.0-or-later**, same as upstream. `LICENSE` is unchanged. If you
  redistribute this site, keep the license, the copyright notices, and credit to the upstream
  project. The app is provided without warranty.
  
## Why this exists

Most online converters upload your files to a server, which is bad for privacy, and they force
you to stay inside one medium. Convert2it lets you do things like AVI → PDF, PSD → SVG, or
MIDI → WAV without sending a single byte off-device.

[Convert to it!](https://github.com/p2r3/convert) project by p2r3. All conversion handlers come
from upstream. See [Credits & license](#credits--license).
