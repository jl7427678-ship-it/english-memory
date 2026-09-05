const CACHE='english-memory-lab-v5-ui-20260905-18';
const CORE=['./','./index.html','./manifest.webmanifest','./icon.svg','./styles.css','./theme.css','./boot.js','./ui.html','./app.js','./app-1.js','./app-2.js','./app-3.js','./app-4.js','./app-5.js','./app-6.js','./app-7.js','./app-8.js','./app-9.js','./app-10.js','./app-11.js','./app-12.js','./app-13.js','./app-14.js','./assets/mascot/wanwang-hello.webp','./assets/mascot/wanwang-celebrate.webp','./assets/mascot/wanwang-reading.webp','./data/toeic-manifest.json','./data/toeic-core.json','./data/preqin-literature.json','./data/exam-practice.json'];
const ALLOWED_REMOTE=['https://raw.githubusercontent.com','https://cdn.jsdelivr.net'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url),sameOrigin=url.origin===self.location.origin,cacheableRemote=ALLOWED_REMOTE.some(origin=>url.origin===origin);
  if(!sameOrigin&&!cacheableRemote)return;
  if(sameOrigin){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
      if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{})}
      return response;
    }).catch(()=>caches.match(event.request,{ignoreSearch:true}).then(hit=>hit||caches.match('./index.html'))));
    return;
  }
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
    if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{})}
    return response;
  }).catch(()=>caches.match(event.request,{ignoreSearch:true})));
});
