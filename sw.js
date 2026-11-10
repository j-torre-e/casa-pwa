// Service worker "network-first": siempre intenta lo último desplegado en Vercel
// y solo usa la caché si no hay red. Si añades archivos, añádelos a ASSETS y sube la versión.

const CACHE = 'casa-v2';
const ASSETS = [
  '/', '/index.html', '/manifest.json', '/css/app.css',
  '/js/main.js', '/js/store.js', '/js/ui.js', '/js/components/cardlist.js',
  '/js/views/casa.js', '/js/views/tareas.js', '/js/views/batch.js', '/js/views/calendario.js',
  '/js/views/mas.js', '/js/views/compra.js', '/js/views/almacen.js', '/js/views/ajustes.js',
  '/icons/icon.svg', '/icons/icon-180.png', '/icons/icon-192.png', '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('/index.html')))
  );
});
