/* Rilievo misure: tiene in memoria solo la pagina d'ingresso e le icone. I dati passano sempre dallo script. */
const C='ril-c79d286f01', F=['./','index.html','config.js','manifest.webmanifest','favicon.png','apple-touch-icon.png','icona-192.png','icona-512.png','icona-maskable-512.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{ const u=new URL(e.request.url); if(e.request.method!=='GET'||u.origin!==location.origin) return;
  e.respondWith(fetch(e.request).then(r=>{ const k=r.clone(); caches.open(C).then(c=>c.put(e.request,k)); return r; }).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html')))); });
