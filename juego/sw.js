// Mayoría · caché sin conexión para la versión web. Sube la versión al publicar cambios.
const CACHE = 'mayoria-turnos-v2';
const ARCHIVOS = ['index.html', 'manifest.webmanifest', 'icono.svg', 'src/data/characters.js', 'src/game/turnos.js', 'src/audio/sfx.js', 'src/i18n/i18n.js', 'src/i18n/textos.js', 'src/i18n/textos2.js', 'src/i18n/textos3.js',
  'assets/images/title-bg.webp', 'assets/images/characters/populista.png', 'assets/images/characters/camarada_bio.png', 'assets/images/characters/el_general.png', 'assets/images/characters/tecno_baron.png', 'assets/images/characters/baronesa_lobby.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
