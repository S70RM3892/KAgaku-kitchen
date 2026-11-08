// エンジンの単体テスト： node tests/engine.test.js
import assert from 'node:assert/strict';
import {createGame,begin,tick,apply,owners,snapshot,advance,results,playerLeft,attackPower} from '../js/engine.js';
import {MENU,MKEYS,route,SHELF_IDS,RXBY} from '../js/chem.js';
import {BYID,DB} from '../js/atoms.js';

const P2=[{id:'p0',name:'A',slot:0},{id:'p1',name:'B',slot:1}];
const settle=(S,f)=>{for(let i=0;i<200&&f.state==='heat';i++)tick(S,0.05);};
// 1段の反応を f で行う（中間体は pourFrom から注ぐ）
function step(S,pid,f,x,{coefOk=true,pourFrom=null}={}){
  for(const e of x.r){
    const id=e.ids.find(i=>SHELF_IDS.has(i));
    if(!id){apply(S,pid,{t:'pour',f:pourFrom.id,to:f.id});continue;}
    for(let i=0;i<(coefOk?e.n:1);i++)apply(S,pid,{t:'add',s:id,f:f.id});
  }
  if(x.cat)apply(S,pid,{t:'add',s:'@'+x.cat[0],f:f.id});
  apply(S,pid,{t:'heat',f:f.id,h:x.h});
  apply(S,pid,{t:'react',f:f.id});settle(S,f);
}
// 注文 key をルート通りに作る（フラスコを交互に使う）
function make(S,pid,key,fl){
  const rs=route(key);let prev=null,i=0;
  for(const x of rs){const f=fl[i++%fl.length];step(S,pid,f,x,{pourFrom:prev});assert.equal(f.state,'ready',`${key}:${x.id} -> ${JSON.stringify(f.res)}`);prev=f;}
  return prev;
}
function force(S,key){if(!S.orders.length)tick(S,0.01);const o=S.orders[0];o.k=key;o.ban={};o.left=o.total=90;return o;}

// ---- solo：単段 ----
{
  const S=createGame({mode:'solo',stageId:'s1',players:[{id:'p0',name:'me'}]});begin(S);
  const o=force(S,'Cl2');const f=make(S,'p0','Cl2',S.flasks);
  assert.equal(f.prod.rx,'cl2_bleach');
  apply(S,'p0',{t:'serve',f:f.id,o:o.id});
  assert.ok(S.team.score>0);assert.equal(S.team.served,1);
  // 加熱し忘れ→失敗（理由つき）
  const g=S.flasks[1];['MnO2','HCl_c','HCl_c','HCl_c','HCl_c'].forEach(s=>apply(S,'p0',{t:'add',s,f:g.id}));
  apply(S,'p0',{t:'react',f:g.id});settle(S,g);
  assert.equal(g.state,'fail');assert.equal(g.fail.why,'加熱が必要');
  console.log('solo ok',S.team.score);
}
// ---- solo：多段（注ぐ）と via 指定 ----
{
  const S=createGame({mode:'solo',stageId:'s3',players:[{id:'p0',name:'me'}]});begin(S);
  for(const key of ['H2SO4@h2so4','Na2CO3@solvay2','HNO3@ostwald3','NH3@haber']){
    const o=force(S,key);const f=make(S,'p0',key,S.flasks);
    const before=S.team.served;apply(S,'p0',{t:'serve',f:f.id,o:o.id});
    assert.equal(S.team.served,before+1,`served ${key}`);
    S.flasks.forEach(x=>apply(S,'p0',{t:'dump',f:x.id}));
  }
  // ハーバー指定の注文に実験室製法のNH3を出すと誤配
  const o=force(S,'NH3@haber');const f=S.flasks[0];step(S,'p0',f,RXBY.nh3_lab);
  const sc=S.team.score;apply(S,'p0',{t:'serve',f:f.id,o:o.id});assert.equal(S.team.score,sc-10>0?sc-10:0);
  console.log('chain+via ok',S.team.score);
}
// ---- 係数モード（京大ラッシュ）----
{
  const S=createGame({mode:'solo',stageId:'s5',players:[{id:'p0',name:'me'}]});begin(S);
  const f=S.flasks[0];step(S,'p0',f,RXBY.no_cu,{coefOk:false});
  assert.equal(f.state,'fail');assert.equal(f.fail.why,'反応しない','fb0 hides reason');
  apply(S,'p0',{t:'dump',f:f.id});step(S,'p0',f,RXBY.no_cu);assert.equal(f.state,'ready');
  console.log('coef ok');
}
// ---- 不要な加熱は成功するが減点・習熟なし ----
{
  const S=createGame({mode:'solo',stageId:'s2',players:[{id:'p0',name:'me'}]});begin(S);
  const o=force(S,'AgCl');const f=S.flasks[0];
  apply(S,'p0',{t:'add',s:'AgNO3',f:f.id});apply(S,'p0',{t:'add',s:'NaCl',f:f.id});apply(S,'p0',{t:'heat',f:f.id,h:1});
  apply(S,'p0',{t:'react',f:f.id});settle(S,f);assert.deepEqual(f.prod.over,['加熱は不要']);
  S.ev=[];apply(S,'p0',{t:'serve',f:f.id,o:o.id});
  assert.ok(S.ev.some(e=>e.m&&e.m[1]==='okh'),'no mastery gain');
  console.log('over ok');
}
// ---- coop：棚分担・リクエスト・触媒もリクエスト ----
{
  const S=createGame({mode:'coop',stageId:'s1',players:P2,split:true});begin(S);
  assert.equal(S.flasks.length,3);
  const own=owners(S);const f=S.flasks[0];
  const a=own['H2O2'],b=own['@MnO2'];
  assert.notEqual(a,b,'H2O2 and MnO2 catalyst split');
  // a が MnO₂ 触媒を頼む → b がタップ → a のフラスコに触媒がセット
  apply(S,a,{t:'add',s:'H2O2',f:f.id});apply(S,a,{t:'add',s:'H2O2',f:f.id});
  apply(S,a,{t:'add',s:'@MnO2',f:f.id});assert.equal(S.reqs.length,1);assert.equal(f.cat,null);
  apply(S,b,{t:'add',s:'@MnO2',f:S.flasks[1].id});assert.equal(f.cat,'MnO2');assert.equal(S.reqs.length,0);
  const o=force(S,'O2');apply(S,a,{t:'react',f:f.id});settle(S,f);assert.equal(f.state,'ready');
  S.ev=[];apply(S,a,{t:'serve',f:f.id,o:o.id});
  assert.deepEqual(S.ev.filter(e=>e.m&&e.m[1]==='ok').map(e=>e.to).sort(),['p0','p1']);
  const r0=owners(S)['H2O2'];S.rotNext=S.elapsed+0.01;tick(S,0.05);assert.notEqual(owners(S)['H2O2'],r0);
  playerLeft(S,'p1');assert.equal(owners(S),null);
  console.log('coop ok',S.team.score);
}
// ---- versus：先取・出禁・おじゃま・相殺 ----
{
  const S=createGame({mode:'versus',stageId:'s1',players:P2});begin(S);
  const fa=S.flasks.find(f=>f.owner==='p0'),fb=S.flasks.find(f=>f.owner==='p1');
  apply(S,'p1',{t:'add',s:'Zn',f:fa.id});assert.equal(fa.items.length,0);assert.equal(fb.items.length,1,'falls back to own flask');
  apply(S,'p1',{t:'dump',f:fb.id});
  const o=force(S,'CO2');
  step(S,'p0',fa,RXBY.co2_lab);step(S,'p1',fb,RXBY.co2_lab);
  const other=S.orders.find(x=>x.id!==o.id);
  if(other&&MENU[other.k].t!=='CO2'){apply(S,'p1',{t:'serve',f:fb.id,o:other.id});assert.ok(other.ban.p1);step(S,'p1',fb,RXBY.co2_lab);}
  apply(S,'p0',{t:'serve',f:fa.id,o:o.id});assert.ok(S.players.p0.score>0);
  apply(S,'p1',{t:'serve',f:fb.id,o:o.id});assert.equal(fb.state,'ready','kept after snipe');
  assert.equal(S.players.p1.inc.length,1);assert.equal(S.players.p1.inc[0].pow,attackPower(S,'CO2',false,1,false));
  const o2=force(S,'CO2');apply(S,'p1',{t:'serve',f:fb.id,o:o2.id});
  assert.equal(S.players.p1.inc.length,0,'offset');
  console.log('versus ok',S.players.p0.score,S.players.p1.score);
}
// ---- 大きなおじゃまは引火 ----
{
  const S=createGame({mode:'versus',stageId:'s3',players:P2});begin(S);
  const fb=S.flasks.find(f=>f.owner==='p1');apply(S,'p1',{t:'add',s:'NaCl',f:fb.id});
  S.players.p1.inc.push({id:999,pow:4,from:'p0',t:0.01});tick(S,0.05);
  assert.equal(fb.state,'fire');assert.ok(S.players.p1.fx.dark>S.elapsed);
  for(let i=0;i<4;i++)apply(S,'p1',{t:'ext',f:fb.id});assert.equal(fb.state,'idle');
  console.log('attack ok');
}
// ---- 悪意ある入力でホストが壊れない ----
{
  const S=createGame({mode:'coop',stageId:'s1',players:P2});begin(S);
  for(const a of [{t:'add',s:'constructor',f:S.flasks[0].id},{t:'add',s:'@toString'},{t:'add',s:'__proto__'},{t:'serve',f:'x',o:{}},{t:'toString'},null,{t:'stamp',k:99},{t:'heat',f:S.flasks[0].id,h:9},{t:'pour',f:1,to:1}])apply(S,'p1',a);
  for(let i=0;i<40;i++)tick(S,0.05);
  assert.equal(S.reqs.length,0);JSON.stringify(snapshot(S));
  console.log('hostile ok');
}
// ---- 全モード×全ステージを最後まで回す（ルート通りに作るボット）----
for(const mode of ['solo','coop','versus'])for(const st of ['s1','s2','s3','s4','s5','rv']){
  const players=mode==='solo'?[{id:'p0',name:'x'}]:[...P2,{id:'p2',name:'C',slot:2}];
  const S=createGame({mode,stageId:st,players,split:false,pool:st==='rv'?MKEYS.slice(0,10):null});begin(S);
  let n=0;
  while(!S.over&&n<20000){
    tick(S,0.05);n++;
    if(n%40===0&&S.orders.length){
      const pid=players[n%players.length].id;
      const fl=S.flasks.filter(x=>(x.owner==null||x.owner===pid));
      fl.forEach(x=>{if(x.state==='fire')for(let i=0;i<4;i++)apply(S,pid,{t:'ext',f:x.id});if(x.state!=='heat')apply(S,pid,{t:'dump',f:x.id});});
      const o=S.orders[0];
      try{const rs=route(o.k);let prev=null,i=0;
        for(const x of rs){const f=fl[i++%fl.length];if(f.state!=='idle')break;step(S,pid,f,x,{pourFrom:prev});prev=f;}
        if(prev&&prev.state==='ready')apply(S,pid,{t:'serve',f:prev.id,o:o.id});
      }catch(e){}
    }
    if(n%13===0){const V=JSON.parse(JSON.stringify(snapshot(S)));advance(V,0.05);}
    S.ev.length=0;
  }
  assert.ok(S.over,`${mode}/${st} ends`);
  const r=results(S);JSON.stringify(r);
  const sc=mode==='versus'?r.players.map(p=>p.score).join('/'):r.team.score;
  console.log(`sim ${mode}/${st}: score=${sc} served=${mode==='versus'?r.players.map(p=>p.served).join('/'):r.team.served} snap=${JSON.stringify(snapshot(S)).length}B`);
}
// ================= 組成モード =================
const comp=id=>Object.entries(BYID[id].m);
function fillA(S,pid,f,id){for(const [s,c] of comp(id))for(let i=0;i<c;i++)apply(S,pid,{t:'add',s,f:f.id});}
function cookA(S,pid,f,id){fillA(S,pid,f,id);apply(S,pid,{t:'react',f:f.id});settle(S,f);}
{
  const S=createGame({g:'atom',mode:'solo',stageId:'s1',players:[{id:'p0',name:'me'}]});begin(S);
  assert.equal(S.g,'atom');
  const o=force(S,'H2O');const f=S.flasks[0];
  apply(S,'p0',{t:'add',s:'H2O',f:f.id});assert.equal(f.items.length,0,'reagent keys invalid in atom mode');
  apply(S,'p0',{t:'heat',f:f.id,h:1});assert.equal(f.heat,0,'no heat dial in atom mode');
  cookA(S,'p0',f,'H2O');assert.equal(f.state,'ready');
  apply(S,'p0',{t:'serve',f:f.id,o:o.id});assert.ok(S.team.score>0);
  // レシピに無い組成は失敗作
  const g=S.flasks[1];['H','H','H'].forEach(s=>apply(S,'p0',{t:'add',s,f:g.id}));apply(S,'p0',{t:'react',f:g.id});settle(S,g);
  assert.equal(g.state,'fail');assert.match(g.fail.why,/レシピに無い/);
  console.log('atom solo ok',S.team.score);
}
{
  const S=createGame({g:'atom',mode:'coop',stageId:'s1',players:P2,split:true});begin(S);
  const own=owners(S);assert.notEqual(own.H,own.O,'H and O split');
  const f=S.flasks[0];
  apply(S,own.O,{t:'add',s:'H',f:f.id});apply(S,own.O,{t:'add',s:'H',f:f.id});assert.equal(S.reqs.length,2);
  apply(S,own.H,{t:'add',s:'H',f:S.flasks[1].id});apply(S,own.H,{t:'add',s:'H',f:S.flasks[1].id});
  assert.deepEqual(f.items,[['H',2,0]]);
  console.log('atom coop ok');
}
{
  const S=createGame({g:'atom',mode:'versus',stageId:'s1',players:P2});begin(S);
  const o=force(S,'CO2');const fa=S.flasks.find(f=>f.owner==='p0'),fb=S.flasks.find(f=>f.owner==='p1');
  cookA(S,'p0',fa,'CO2');cookA(S,'p1',fb,'CO2');
  apply(S,'p0',{t:'serve',f:fa.id,o:o.id});assert.ok(S.players.p0.score>0);
  assert.equal(S.players.p1.inc[0].pow,attackPower(S,'CO2',false,1,false));
  console.log('atom versus ok');
}
for(const mode of ['solo','coop','versus'])for(const st of ['s1','s3','s5','rv']){
  const players=mode==='solo'?[{id:'p0',name:'x'}]:[...P2];
  const S=createGame({g:'atom',mode,stageId:st,players,pool:st==='rv'?DB.slice(0,10).map(d=>d.id):null});begin(S);
  let n=0;
  while(!S.over&&n<20000){
    tick(S,0.05);n++;
    if(n%30===0&&S.orders.length){
      const pid=players[n%players.length].id;
      const f=S.flasks.find(x=>(x.owner==null||x.owner===pid)&&x.state==='idle');
      if(f){cookA(S,pid,f,S.orders[0].d||S.orders[0].k);if(f.state==='ready')apply(S,pid,{t:'serve',f:f.id,o:S.orders[0].id});}
      S.flasks.forEach(x=>{if(x.state==='fire')for(let i=0;i<4;i++)apply(S,pid,{t:'ext',f:x.id});else if(x.state==='fail')apply(S,pid,{t:'dump',f:x.id});});
    }
    S.ev.length=0;
  }
  assert.ok(S.over);
  console.log(`atom sim ${mode}/${st}: served=${S.team.served+Object.values(S.players).reduce((a,p)=>a+(mode==='versus'?p.served:0),0)}`);
}
console.log('ALL PASS');
