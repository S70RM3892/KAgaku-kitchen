// 自分専用の中継（supabase/functions/kk-relay）のテスト： node --experimental-strip-types tests/relay.test.mjs
import assert from 'node:assert/strict';
const {handle}=await import('../supabase/functions/kk-relay/index.ts');
const PASS='correct-horse-battery';
const env=k=>k==='KK_RELAY_PASS'?PASS:undefined;
const calls=[];
const fake=async(u,o)=>{calls.push([u,o]);if(u.includes('blocked'))return new Response('no',{status:403});return new Response(new Uint8Array([37,80,68,70]),{status:200,headers:{'content-length':'4'}});};
const req=(q,pass,origin='https://s70rm3892.github.io',method='GET')=>new Request('https://x.supabase.co/functions/v1/kk-relay'+q,{method,headers:{...(pass!=null?{'x-kk-pass':pass}:{}),origin}});
const PDF='https://img.cf.47news.jp/static/kyotsu-exam/2025/files/3hp3a3ybgi.pdf';
let r=await handle(req('',null,undefined,'OPTIONS'),env,fake);assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),'https://s70rm3892.github.io');
r=await handle(req('?ping=1',null),k=>undefined,fake);assert.equal(r.status,503,'no passphrase configured');
r=await handle(req('?ping=1','wrong'),env,fake);assert.equal(r.status,401,'wrong passphrase');
r=await handle(req('?u='+encodeURIComponent(PDF),null),env,fake);assert.equal(r.status,401,'missing passphrase');
r=await handle(req('?ping=1',PASS),env,fake);assert.equal(r.status,200);assert.equal((await r.json()).ok,true);
for(const bad of ['https://example.com/a.pdf','http://img.cf.47news.jp/a.pdf','https://school.js88.com/scl_dai/center_data/','not a url']){
  r=await handle(req('?u='+encodeURIComponent(bad),PASS),env,fake);assert.ok([400,403].includes(r.status),bad);}
assert.equal(calls.length,0,'nothing fetched for rejected requests');
r=await handle(req('?u='+encodeURIComponent(PDF),PASS),env,fake);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/pdf');
assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[37,80,68,70]);assert.match(calls[0][1].headers['User-Agent'],/kk-relay/);
r=await handle(req('?u='+encodeURIComponent('https://img.cf.47news.jp/blocked.pdf'),PASS),env,fake);assert.equal(r.status,429,'refusal is passed on');
r=await handle(req('?health=1',null),env,fake);assert.equal(r.status,200);assert.equal((await r.json()).upstream,200);assert.equal(calls.at(-1)[1].headers.Range,'bytes=0-0');
r=await handle(req('?health=1',null),env,fake);assert.equal(r.status,429,'health limited to once a minute');
r=await handle(req('?ping=1',PASS,'https://evil.example'),env,fake);assert.equal(r.headers.get('access-control-allow-origin'),'https://s70rm3892.github.io','other origins are not echoed');
console.log('RELAY PASS');
