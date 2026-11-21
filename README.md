# Convert2it — files for your GitHub repository

Everything in **this folder** is the finished, static website. Upload the *contents* of this
folder to the root of your GitHub repository `chetanpatel0/convert2it` (do not upload the
`github-upload` folder itself).

After pushing, enable hosting:

1. Open the repository on GitHub → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose branch **main** and folder **/ (root)**, then **Save**.
4. Wait 1–2 minutes; the site is published at:
   **https://chetanpatel0.github.io/convert2it/**

## How to upload

Use **GitHub Desktop** (recommended, handles the large files):

1. Create an empty repository named `convert2it` on GitHub (no README, no .gitignore).
2. In GitHub Desktop: **File → Clone repository → chetanpatel0/convert2it**.
3. Copy everything from this folder into the cloned folder.
4. Commit ("Initial Convert2it site") and push.

Or with Git in a terminal:

```bash
git clone https://github.com/chetanpatel0/convert2it.git
# copy the contents of this folder into the convert2it folder
cd convert2it
git add .
git commit -m "Initial Convert2it site"
git push origin main
```

## Important

- **Do not use GitHub's drag-and-drop web uploader.** It rejects files over 25 MB and this
  site contains large WebAssembly tools (up to ~59 MB). Use GitHub Desktop or `git push`.
- The pack is about 195 MB / 547 files. GitHub allows individual files up to 100 MB.
- `index.html` must be at the repository root, next to `assets/`, `external/`, `icons/`,
  `mini-coi.js`, `manifest.webmanifest`, and `cache.json`.
- `.nojekyll` is included so GitHub Pages serves the files exactly as built.
- The same folder also works on Puter, Netlify, cPanel, or any static host — just upload its
  contents. For Apache/cPanel add the `.htaccess` from the repo's `deploy/` folder; for
  Netlify/Cloudflare add `deploy/_headers`.
- Serve over HTTPS. The service worker, PWA installation, and file sharing need a secure
  context (GitHub Pages provides it automatically).
