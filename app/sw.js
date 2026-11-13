/* Gestionale: tiene in memoria solo le pagine d'ingresso. Pagine vere e dati arrivano dallo script (dietro PIN). */
const C='gest-f460618a50', F=["Dashboard_Clienti.html", "Configuratore_Preventivi_Completo.html", "index.html", "gest_app.js", "app_mobile.css", "config.js", "manifest.webmanifest", "icona-192.png", "icona-512.png", "icona-maskable-512.png", "apple-touch-icon.png", "favicon.png"];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('gest-')&&x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{ const u=new URL(e.request.url); if(e.request.method!=='GET'||u.origin!==location.origin) return;
  e.respondWith(fetch(e.request).then(r=>{ const k=r.clone(); caches.open(C).then(c=>c.put(e.request,k)); return r; }).catch(()=>caches.match(e.request,{ignoreSearch:true}))); });
