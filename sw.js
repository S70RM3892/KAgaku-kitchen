// ケミカル・キッチンの Service Worker：オフラインでも開けるようにする。
// 方針は「つながるときは必ずネットから（新しい版を使う）、だめなら控えから」。4秒待っても返事が無ければ控えを使う。
// 控えるのはこのサイト自身のファイルと Web フォントだけ。ランキング・中継・過去問の配布元への通信には手を出さない。
const CACHE='kk-v1';
const FONT=/^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET')return;
  const own=u.origin===self.location.origin;
  if(!own&&!FONT.test(r.url))return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const net=fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque'))cache.put(r,res.clone()).catch(()=>{});return res;});
    try{
      // 4秒以内にネットから取れればそれを使う
      return await Promise.race([net,new Promise((_,rej)=>setTimeout(()=>rej(new Error('slow')),4000))]);
    }catch(err){
      const hit=await cache.match(r,{ignoreSearch:own&&r.mode==='navigate'});
      if(hit)return hit;
      return net;   // 控えも無ければ、ネットの結果（または失敗）をそのまま返す
    }
  })());
});
