/* Service worker Kasir Struk.
   Setiap kali ada update, naikkan VERSION di sini DAN APP_VERSION di js/tools.js. */
const VERSION = '1.0.0';
const CACHE = 'ks-' + VERSION;
const CORE = [
  './', 'index.html', 'manifest.webmanifest',
  'css/app.css', 'js/core.js', 'js/ocr.js', 'js/tools.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('ks-') && k !== CACHE && k !== 'ks-fonts').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open('ks-fonts').then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit =>
      hit || (req.mode === 'navigate' ? caches.match('index.html') : fetch(req))
    )
  );
});
