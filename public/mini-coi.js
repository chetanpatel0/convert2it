/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
/*! mini-coi - Andrea Giammarchi and contributors, licensed under MIT */
/* with changes for Convert2it: app-shell caching, Web Share Target inbox and updates */
const scopeURL = () => new URL(self.registration.scope);
const shellURL = () => new URL("./index.html", self.registration.scope).href;
(({ document: d, navigator: { serviceWorker: s } }) => {
  // Keep in sync with src/securityHeaders.cjs
  const CSP =
    "default-src 'none'; script-src 'self' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' blob: data:; img-src 'self' blob: data:; media-src 'self' blob: data:; font-src 'self' blob: data:; connect-src 'self' blob: data:; worker-src 'self' blob:; manifest-src 'self'; frame-src 'self' blob: data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; webrtc 'block'";

  if (d) {
    if (!s || !("crossOriginIsolated" in self)) return;
    const { currentScript: c } = d;
    // Always register: besides isolation this worker provides the offline shell and
    // the Web Share Target inbox. Only reload when isolation came from the worker.
    void s.register(c.src, { scope: c.getAttribute("scope") || "." }).then((r) => {
      s.addEventListener("controllerchange", () => {
        if (!self.crossOriginIsolated) location.reload();
      });
      if (r.active && !s.controller && !self.crossOriginIsolated) location.reload();
    });
    return;
  }

  const VERSION = "4";
  const SHELL_CACHE = `convert2it-shell-${VERSION}`;
  const RUNTIME_CACHE = `convert2it-runtime-${VERSION}`;
  // Stable name: the page reads the inbox from this cache too (src/ui/scripts/fileIntake.ts)
  const SHARE_CACHE = "convert2it-share";
  const SHARE_TARGET = "share-target";
  const SHARE_META_PREFIX = "__shared__/";
  const MAX_CACHED_BYTES = 25 * 1024 * 1024;
  const PRECACHE = [
    "./",
    "./index.html",
    "./manifest.webmanifest",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/icon-maskable-192.png",
    "./icons/icon-maskable-512.png",
    "./icons/apple-touch-icon.png",
  ];
  // Large toolchain payloads (.wasm, .sf2, .data) are intentionally left to the network.
  const CACHEABLE_ASSET =
    /\.(?:js|mjs|css|json|webmanifest|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|ico)$/i;

  function withIsolation(response) {
    if (!response || response.status === 204) return response;
    const headers = new Headers(response.headers);
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("Cross-Origin-Embedder-Policy", "require-corp");
    if (!headers.has("Content-Security-Policy")) headers.set("Content-Security-Policy", CSP);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  async function precache() {
    const cache = await caches.open(SHELL_CACHE);
    for (const path of PRECACHE) {
      try {
        const url = new URL(path, self.registration.scope).href;
        const response = await fetch(new Request(url, { cache: "reload" }));
        if (response.ok) await cache.put(url, response);
      } catch {}
    }
  }

  async function handleNavigate(request) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        caches
          .open(SHELL_CACHE)
          .then((cache) => cache.put(shellURL(), copy))
          .catch(() => {});
      }
      return withIsolation(response);
    } catch (error) {
      const cache = await caches.open(SHELL_CACHE);
      const cached =
        (await cache.match(shellURL())) ||
        (await cache.match(new URL("./", self.registration.scope)));
      if (cached) return withIsolation(cached);
      throw error;
    }
  }

  async function handleWorker(request) {
    try {
      return withIsolation(await fetch(request));
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return withIsolation(cached);
      throw error;
    }
  }

  async function handleManifest(request) {
    try {
      const response = await fetch(request, { cache: "no-cache" });
      if (response.ok) {
        const copy = response.clone();
        caches
          .open(SHELL_CACHE)
          .then((cache) => cache.put(request, copy))
          .catch(() => {});
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw error;
    }
  }

  async function handleAsset(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    const size = Number(response.headers.get("content-length") || 0);
    const cacheable =
      response.ok &&
      response.status === 200 &&
      response.type === "basic" &&
      CACHEABLE_ASSET.test(new URL(request.url).pathname) &&
      size <= MAX_CACHED_BYTES;

    if (cacheable) {
      const copy = response.clone();
      caches
        .open(RUNTIME_CACHE)
        .then((cache) => cache.put(request, copy))
        .catch(() => {});
    }
    return response;
  }

  const shareMetaKey = (id) => new URL(`${SHARE_META_PREFIX}${id}`, self.registration.scope).href;
  const shareFileKey = (id, index) =>
    new URL(`${SHARE_META_PREFIX}${id}/${index}`, self.registration.scope).href;

  async function handleShare(request) {
    const fallback = new URL("./?share-error=1", self.registration.scope).href;
    try {
      const form = await request.formData();
      const files = [];
      for (const value of form.values()) {
        if (value instanceof File && value.size > 0) files.push(value);
      }

      const title = typeof form.get("title") === "string" ? form.get("title") : "";
      const text = typeof form.get("text") === "string" ? form.get("text") : "";
      const url = typeof form.get("url") === "string" ? form.get("url") : "";
      if (!files.length && !text && !url) return Response.redirect(fallback, 303);

      const id = crypto.randomUUID();
      const cache = await caches.open(SHARE_CACHE);
      const meta = { files: [], title, text, url, createdAt: Date.now() };

      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const type = file.type || "application/octet-stream";
        const stored = new Response(file, {
          headers: {
            "content-type": type,
            "x-file-name": encodeURIComponent(file.name),
          },
        });
        await cache.put(shareFileKey(id, index), stored);
        meta.files.push({ name: file.name, type, size: file.size });
      }

      await cache.put(
        shareMetaKey(id),
        new Response(JSON.stringify(meta), { headers: { "content-type": "application/json" } }),
      );
      return Response.redirect(new URL(`./?share=${id}`, self.registration.scope).href, 303);
    } catch (error) {
      console.error("[share-target]", error);
      return Response.redirect(fallback, 303);
    }
  }

  addEventListener("install", (event) => {
    event.waitUntil(precache().catch(() => {}));
    skipWaiting();
  });

  addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const keep = new Set([SHELL_CACHE, RUNTIME_CACHE, SHARE_CACHE]);
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith("convert2it-") && !keep.has(key))
            .map((key) => caches.delete(key)),
        );
        await clients.claim();
      })(),
    );
  });

  addEventListener("message", (event) => {
    if (event.data === "SKIP_WAITING") skipWaiting();
  });

  addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    if (url.origin !== self.location.origin) return;
    if (!url.pathname.startsWith(scopeURL().pathname)) return;

    // Incoming Android / desktop share-sheet uploads
    if (
      request.method === "POST" &&
      url.pathname === new URL(SHARE_TARGET, self.registration.scope).pathname
    ) {
      event.respondWith(handleShare(request));
      return;
    }

    if (request.method !== "GET") return;

    if (request.mode === "navigate") {
      event.respondWith(handleNavigate(request));
      return;
    }

    if ((request.destination || "").endsWith("worker")) {
      event.respondWith(handleWorker(request));
      return;
    }

    // The manifest must never come from a stale cache, or installs break after updates.
    if (url.pathname.endsWith(".webmanifest")) {
      event.respondWith(handleManifest(request));
      return;
    }

    event.respondWith(handleAsset(request));
  });
})(self);
