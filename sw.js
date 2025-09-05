const CACHE_NAME = 'vnwqi-cache-v1';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  if (e.request.method!=='GET') return;
  e.respondWith(
    caches.match(e.request).then(res=>res || fetch(e.request).then(net=>{
      if (new URL(e.request.url).origin===location.origin){
        const clone=net.clone(); caches.open(CACHE_NAME).then(c=>c.put(e.request, clone));
      }
      return net;
    }).catch(()=>caches.match('./index.html')))
  );
});
