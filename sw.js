/* FLS Command Center — service worker.
   Makes the app installable and quick to open, and lets it open with no
   signal (patrols and checkpoint scans made offline are already queued by
   the app itself).
   - The app page is always fetched fresh when there's a connection, so
     every update shows up straight away; the saved copy is only used
     when the phone is offline.
   - Icons and fonts come from the saved copy (they rarely change).
   - The QR scanner and QR label libraries (fixed versions) are saved too,
     so checkpoints can be scanned with no signal.
   - Requests to the Google sheet script and to Drive photos are never
     touched — they always go straight to the network. */
const SHELL_CACHE = "fls-shell-v1";
const FONT_CACHE = "fls-fonts-v1";
const LIB_CACHE = "fls-libs-v1";
const SHELL = ["./", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];
const LIBS = [
  "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js",
  "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL))
      // the libraries are a bonus: if the CDN can't be reached now, the app saves them on first use
      .then(() => caches.open(LIB_CACHE).then(cache => Promise.all(LIBS.map(url =>
        cache.match(url).then(hit => hit || cache.add(new Request(url, { mode: "cors" }))).catch(() => {})))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  const keep = [SHELL_CACHE, FONT_CACHE, LIB_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google Fonts: saved copy first, so the app looks right offline too
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache => cache.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
        return res;
      })))
    );
    return;
  }

  // QR scanner / QR label libraries (versioned files that never change): saved copy first
  if (url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(
      caches.open(LIB_CACHE).then(cache => cache.match(req, { ignoreVary: true }).then(hit => hit || fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })))
    );
    return;
  }

  if (url.origin !== self.location.origin) return; // Google script, Drive photos: straight to the network

  // The app page: fresh from the network, saved copy only when offline
  if (req.mode === "navigate" || url.pathname.endsWith("/index.html")) {
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(SHELL_CACHE).then(cache => cache.put("./", copy)); }
        return res;
      }).catch(() => caches.match("./"))
    );
    return;
  }

  // Icons and the app description: saved copy first
  event.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
