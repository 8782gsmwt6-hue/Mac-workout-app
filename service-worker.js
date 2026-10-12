// v3.1.1 - app shell updates prefer network, with offline fallback.
const CACHE="mac-workout-smart-coach-v311";
const ASSETS=["./","index.html","styles.css?v=3.1.1","app.js?v=3.1.1","manifest.json","icon-180.png","icon-192.png","icon-512.png"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("mac-workout-smart-coach-")&&key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()]));});
self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET")return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 const shell=req.mode==="navigate"||/\.(?:html|js|css)$/.test(url.pathname)||url.pathname.endsWith("/");
 if(!shell)return;
 event.respondWith(fetch(req,{cache:"no-store"}).then(response=>{
   if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));}
   return response;
 }).catch(async()=>await caches.match(req)||await caches.match("index.html")||Response.error()));
});
