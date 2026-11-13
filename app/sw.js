/* l'app si è spostata su /gestionale/: questo vecchio service worker si toglie da solo */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('gest-')).map(x=>caches.delete(x)))).then(()=>self.registration.unregister())));
