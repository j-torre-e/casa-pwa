// Service worker "caché primero": la app se abre al instante desde el móvil y,
// en segundo plano, descarga lo último de Vercel. Si algo ha cambiado, avisa a la
// app ("Pendiente de actualizar") y la versión nueva se ve al reiniciar.
// No hace falta cambiar nada aquí en cada push; solo si añades archivos nuevos (ASSETS).

const CACHE = 'casa-v3';
const SHELL = '/';
const MARK = '/__update-pending';
const ASSETS = [
  '/', '/manifest.json', '/css/app.css',
  '/js/vendor/mqtt.min.js',
  '/js/main.js', '/js/store.js', '/js/sync.js', '/js/ui.js', '/js/version.js',
  '/js/components/cardlist.js', '/js/components/conflicts.js',
  '/js/views/casa.js', '/js/views/tareas.js', '/js/views/batch.js', '/js/views/calendario.js',
  '/js/views/mas.js', '/js/views/compra.js', '/js/views/almacen.js', '/js/views/ajustes.js',
  '/js/views/mejoras.js', '/js/views/menu.js',
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

async function differs(a, b) {
  const ea = a.headers.get('etag');
  const eb = b.headers.get('etag');
  if (ea && eb) return ea !== eb;
  return (await a.text()) !== (await b.text());
}

async function notifyUpdate(cache) {
  await cache.put(MARK, new Response('1'));
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((c) => c.postMessage({ type: 'update-ready' }));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // funciones de Vercel: siempre a la red

  const isNav = req.mode === 'navigate';
  const key = isNav ? SHELL : req;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (isNav) await cache.delete(MARK); // al reiniciar la app se limpia el aviso
    const cached = await cache.match(key, { ignoreSearch: true });
    const cachedCopy = cached ? cached.clone() : null;

    const network = fetch(req).then(async (res) => {
      if (res.ok && res.type === 'basic') {
        if (cachedCopy && await differs(cachedCopy, res.clone())) await notifyUpdate(cache);
        await cache.put(key, res.clone());
      }
      return res;
    }).catch(() => null);

    if (cached) {
      e.waitUntil(network);
      return cached;
    }
    return (await network) || (await cache.match(SHELL)) || Response.error();
  })());
});
