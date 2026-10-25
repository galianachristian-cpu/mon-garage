/* Mon Garage : service worker pour l'installation et l'usage hors ligne */
const CACHE = 'mon-garage-app-v9';
const CORE = ['./', './index.html', './app.js', './data.js', './plus.js', './fx.js', './fx.css', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './img/auris.webp', './img/express.webp', './img/z750s.webp'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('mon-garage-app-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // fichiers de l'appli : réseau d'abord (toujours la dernière version), sinon la copie gardée
  if (url.origin === location.origin){
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  // scripts Firebase, lecteur de tickets et police : copie gardée d'abord (versions figées)
  if (['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'].includes(url.hostname)){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); return r; })));
  }
  // le reste (base Firestore, API Claude) passe directement au réseau
});

// clic sur une notification de rappel : on rouvre l'appli
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(cs => {
    const c = cs.find(x => 'focus' in x);
    return c ? c.focus() : self.clients.openWindow((e.notification.data && e.notification.data.url) || './');
  }));
});
