// エンジンの単体テスト： node tests/engine.test.js
import assert from 'node:assert/strict';
import {createGame,begin,tick,apply,owners,snapshot,advance,results,playerLeft,attackPower,potOf,peekPot,BUSY} from '../js/engine.js';
import {MENU,MKEYS,route,SHELF_IDS,RXBY} from '../js/chem.js';
import {BYID,DB} from '../js/atoms.js';

const P2=[{id:'p0',name:'A',slot:0},{id:'p1',name:'B',slot:1}];
const potIdle=p=>p&&p.state!=='heat';
function settle(S,o,pid){for(let i=0;i<200;i++){const p=peekPot(S,o,pid);if(!p||p.state!=='heat'||!S.orders.includes(o))break;tick(S,0.05);}}
// 注文 o の鍋で反応 x を1段行う
function step(S,pid,o,x,{coefOk=true}={}){
  for(const e of x.r){
    const id=e.ids.find(i=>SHELF_IDS.has(i));if(!id)continue;   // 中間体はすでに鍋の中
    for(let i=0;i<(coefOk?e.n:1);i++)apply(S,pid,{t:'add',s:id,o:o.id});
  }
  if(x.cat)apply(S,pid,{t:'add',s:'@'+x.cat[0],o:o.id});
  apply(S,pid,{t:'heat',o:o.id,h:x.h});
  apply(S,pid,{t:'react',o:o.id});settle(S,o,pid);
}
// ルートどおりに作る（同じ鍋で多段階）。自動提供されれば true
function make(S,pid,o){for(const x of route(o.k)){if(!S.orders.includes(o))break;step(S,pid,o,x);}return !S.orders.includes(o);}
function force(S,key){if(!S.orders.length)tick(S,0.01);const o=S.orders[0];o.k=key;o.pots={};o.left=o.total=90;return o;}

// ---- solo：作ったら自動で提供 ----
{
  const S=createGame({mode:'solo',stageId:'s1',players:[{id:'p0',name:'me'}]});begin(S);
  const o=force(S,'Cl2');
  assert.ok(make(S,'p0',o),'auto served');assert.ok(S.team.score>0);assert.equal(S.team.served,1);
  // 加熱し忘れ → 反応しない（理由つき）、減点なし
  const o2=force(S,'O2');['MnO2','HCl_c','HCl_c','HCl_c','HCl_c'].forEach(s=>apply(S,'p0',{t:'add',s,o:o2.id}));
  apply(S,'p0',{t:'react',o:o2.id});settle(S,o2,'p0');
  const p=peekPot(S,o2,'p0');assert.equal(p.state,'fail');assert.equal(p.fail.why,'加熱が必要');
  // 違う物（Cl2）ができた → −5、鍋は失敗、注文は残る
  apply(S,'p0',{t:'dump',o:o2.id});const sc=S.team.score;
  step(S,'p0',o2,RXBY.cl2_mno2);
  assert.ok(S.orders.includes(o2),'order stays');assert.equal(S.team.score,sc-5);assert.equal(peekPot(S,o2,'p0').state,'fail');
  // 放置した失敗作は発火→消火
  for(let i=0;i<220;i++)tick(S,0.05);
  if(S.orders.includes(o2)){assert.equal(peekPot(S,o2,'p0').state,'fire');for(let i=0;i<4;i++)apply(S,'p0',{t:'ext',o:o2.id});assert.equal(peekPot(S,o2,'p0').state,'idle');}
  console.log('solo ok',S.team.score);
}
// ---- 多段階：中間体は鍋に残る／製法指定 ----
{
  const S=createGame({mode:'solo',stageId:'s3',players:[{id:'p0',name:'me'}]});begin(S);
  for(const key of ['H2SO4@h2so4','Na2CO3@solvay2','HNO3@ostwald3','NH3@haber']){
    const o=force(S,key);const before=S.team.served;
    assert.ok(make(S,'p0',o),`made ${key}`);assert.equal(S.team.served,before+1);
  }
  const o=force(S,'NH3@haber');step(S,'p0',o,RXBY.nh3_lab);
  assert.equal(peekPot(S,o,'p0').state,'fail');assert.match(peekPot(S,o,'p0').fail.why,/ちがう/);
  console.log('chain+via ok',S.team.score);
}
// ---- 係数モード ----
{
  const S=createGame({mode:'solo',stageId:'s5',players:[{id:'p0',name:'me'}]});begin(S);
  const o=force(S,'NO');step(S,'p0',o,RXBY.no_cu,{coefOk:false});
  assert.equal(peekPot(S,o,'p0').fail.why,'反応しない','fb0 hides reason');
  apply(S,'p0',{t:'dump',o:o.id});step(S,'p0',o,RXBY.no_cu);assert.ok(!S.orders.includes(o));
  console.log('coef ok');
}
// ---- 不要な加熱：提供はされるが習熟なし ----
{
  const S=createGame({mode:'solo',stageId:'s2',players:[{id:'p0',name:'me'}]});begin(S);
  const o=force(S,'AgCl');
  apply(S,'p0',{t:'add',s:'AgNO3',o:o.id});apply(S,'p0',{t:'add',s:'NaCl',o:o.id});apply(S,'p0',{t:'heat',o:o.id,h:1});
  S.ev=[];apply(S,'p0',{t:'react',o:o.id});settle(S,o,'p0');
  assert.ok(!S.orders.includes(o));assert.ok(S.ev.some(e=>e.m&&e.m[1]==='okh'));
  console.log('over ok');
}
// ---- coop：共有鍋、触媒のリクエスト、連携 ----
{
  const S=createGame({mode:'coop',stageId:'s1',players:P2,split:true});begin(S);
  const own=owners(S);const a=own['H2O2'],b=own['@MnO2'];assert.notEqual(a,b);
  const o=force(S,'O2');
  apply(S,a,{t:'add',s:'H2O2',o:o.id});apply(S,a,{t:'add',s:'H2O2',o:o.id});
  apply(S,a,{t:'add',s:'@MnO2',o:o.id});assert.equal(S.reqs.length,1);
  const other=S.orders.find(x=>x!==o);
  apply(S,b,{t:'add',s:'@MnO2',o:other?other.id:o.id});
  assert.equal(potOf(S,o,a).cat,'MnO2','request lands in requester-selected pot');assert.equal(potOf(S,o,b),potOf(S,o,a),'shared pot');
  S.ev=[];apply(S,b,{t:'react',o:o.id});settle(S,o,b);
  assert.ok(!S.orders.includes(o));
  assert.deepEqual(S.ev.filter(e=>e.m&&e.m[1]==='ok').map(e=>e.to).sort(),['p0','p1']);
  const r0=owners(S)['H2O2'];S.rotNext=S.elapsed+0.01;tick(S,0.05);assert.notEqual(owners(S)['H2O2'],r0);
  playerLeft(S,'p1');assert.equal(owners(S),null);
  console.log('coop ok',S.team.score);
}
// ---- versus：客ごと×プレイヤーごとの鍋、先取、おじゃま、相殺 ----
{
  const S=createGame({mode:'versus',stageId:'s1',players:P2});begin(S);
  const o=force(S,'CO2');
  apply(S,'p1',{t:'add',s:'CaCO3',o:o.id});
  assert.notEqual(potOf(S,o,'p0'),potOf(S,o,'p1'));assert.equal(potOf(S,o,'p0').items.length,0);
  apply(S,'p1',{t:'dump',o:o.id});
  assert.ok(make(S,'p0',o));assert.ok(S.players.p0.score>0);
  assert.equal(S.players.p1.inc.length,1);assert.equal(S.players.p1.inc[0].pow,attackPower(S,'CO2',false,1,false));
  const o2=force(S,'CO2');assert.ok(make(S,'p1',o2));
  assert.equal(S.players.p1.inc.length,0,'offset');
  console.log('versus ok',S.players.p0.score,S.players.p1.score);
}
// ---- 大きなおじゃまは引火 ----
{
  const S=createGame({mode:'versus',stageId:'s3',players:P2});begin(S);
  const o=force(S,'CaO@cao');apply(S,'p1',{t:'add',s:'CaCO3',o:o.id});
  S.players.p1.inc.push({id:999,pow:4,from:'p0',t:0.01});tick(S,0.05);
  assert.equal(peekPot(S,o,'p1').state,'fire');assert.ok(S.players.p1.fx.dark>S.elapsed);
  for(let i=0;i<4;i++)apply(S,'p1',{t:'ext',o:o.id});assert.equal(peekPot(S,o,'p1').state,'idle');
  console.log('attack ok');
}
// ---- 悪意ある入力でホストが壊れない ----
{
  const S=createGame({mode:'coop',stageId:'s1',players:P2});begin(S);
  for(const a of [{t:'add',s:'constructor',o:S.orders[0].id},{t:'add',s:'@toString'},{t:'add',s:'__proto__'},{t:'react',o:{}},{t:'toString'},null,{t:'stamp',k:99},{t:'heat',o:S.orders[0].id,h:9},{t:'add',s:'H2O',o:'x'}])apply(S,'p1',a);
  for(let i=0;i<40;i++)tick(S,0.05);
  assert.equal(S.reqs.length,0);JSON.stringify(snapshot(S));
  console.log('hostile ok');
}
// ---- 全モード×全ステージを最後まで回す ----
for(const mode of ['solo','coop','versus'])for(const st of ['s1','s2','s3','s4','s5','rv']){
  const players=mode==='solo'?[{id:'p0',name:'x'}]:[...P2,{id:'p2',name:'C',slot:2}];
  const S=createGame({mode,stageId:st,players,split:false,pool:st==='rv'?MKEYS.slice(0,10):null});begin(S);
  let n=0;
  while(!S.over&&n<20000){
    tick(S,0.05);n++;
    if(n%40===0&&S.orders.length){
      const pid=players[n%players.length].id,o=S.orders[0];
      const p=peekPot(S,o,pid);if(p&&p.state==='fire')for(let i=0;i<4;i++)apply(S,pid,{t:'ext',o:o.id});
      apply(S,pid,{t:'dump',o:o.id});make(S,pid,o);
    }
    if(n%13===0){const V=JSON.parse(JSON.stringify(snapshot(S)));advance(V,0.05);}
    S.ev.length=0;
  }
  assert.ok(S.over,`${mode}/${st} ends`);
  const r=results(S);JSON.stringify(r);
  console.log(`sim ${mode}/${st}: served=${mode==='versus'?r.players.map(p=>p.served).join('/'):r.team.served} snap=${JSON.stringify(snapshot(S)).length}B`);
}
// ================= 組成モード =================
const comp=id=>Object.entries(BYID[id].m);
function cookA(S,pid,o,id){for(const [s,c] of comp(id))for(let i=0;i<c;i++)apply(S,pid,{t:'add',s,o:o.id});apply(S,pid,{t:'react',o:o.id});settle(S,o,pid);}
{
  const S=createGame({g:'atom',mode:'solo',stageId:'s1',players:[{id:'p0',name:'me'}]});begin(S);
  const o=force(S,'H2O');
  apply(S,'p0',{t:'add',s:'H2O',o:o.id});assert.equal(peekPot(S,o,'p0'),null,'reagent keys invalid in atom mode');
  cookA(S,'p0',o,'H2O');assert.ok(!S.orders.includes(o),'auto served');assert.ok(S.team.score>0);
  const o2=force(S,'CO2');['H','H','H'].forEach(s=>apply(S,'p0',{t:'add',s,o:o2.id}));apply(S,'p0',{t:'react',o:o2.id});settle(S,o2,'p0');
  assert.match(peekPot(S,o2,'p0').fail.why,/レシピに無い/);
  apply(S,'p0',{t:'dump',o:o2.id});const sc=S.team.score;cookA(S,'p0',o2,'H2O');
  assert.equal(S.team.score,Math.max(0,sc-5),'wrong compound -5');assert.ok(S.orders.includes(o2));
  console.log('atom solo ok');
}
{
  const S=createGame({g:'atom',mode:'coop',stageId:'s1',players:P2,split:true});begin(S);
  const own=owners(S);assert.notEqual(own.H,own.O);
  const o=force(S,'H2O');
  apply(S,own.O,{t:'add',s:'H',o:o.id});apply(S,own.O,{t:'add',s:'H',o:o.id});assert.equal(S.reqs.length,2);
  apply(S,own.H,{t:'add',s:'H',o:o.id});apply(S,own.H,{t:'add',s:'H',o:o.id});
  assert.deepEqual(potOf(S,o,'p0').items,[['H',2,0]]);
  console.log('atom coop ok');
}
for(const mode of ['solo','versus'])for(const st of ['s1','s5']){
  const players=mode==='solo'?[{id:'p0',name:'x'}]:[...P2];
  const S=createGame({g:'atom',mode,stageId:st,players});begin(S);let n=0;
  while(!S.over&&n<20000){tick(S,0.05);n++;if(n%30===0&&S.orders.length){const pid=players[n%players.length].id,o=S.orders[0];apply(S,pid,{t:'dump',o:o.id});cookA(S,pid,o,o.k);}S.ev.length=0;}
  assert.ok(S.over);console.log(`atom sim ${mode}/${st}: served=${S.team.served+Object.values(S.players).reduce((a,p)=>a+(mode==='versus'?p.served:0),0)}`);
}
// ---- 忙しさ ----
{
  const S1=createGame({mode:'solo',stageId:'s1',players:[{id:'p0',name:'x'}],busy:1});
  const S2=createGame({mode:'solo',stageId:'s1',players:[{id:'p0',name:'x'}]});
  const S5=createGame({mode:'solo',stageId:'s1',players:[{id:'p0',name:'x'}],busy:5});
  assert.ok(S1.max<S2.max&&S5.max>S2.max);assert.ok(S1.spawn>S2.spawn);
  begin(S5);for(let i=0;i<40;i++)tick(S5,0.05);assert.equal(S5.orders.length,S5.max);
  S5.orders.splice(0,1);for(let i=0;i<10;i++)tick(S5,0.05);assert.equal(S5.orders.length,S5.max);
  console.log('busy ok',BUSY.slice(1).map(b=>b.name).join('/'));
}
console.log('ALL PASS');
// ---- 自動精製 ----
{
  const S=createGame({mode:'solo',stageId:'s1',players:[{id:'p0',name:'x'}],auto:true});begin(S);
  const o=force(S,'O2');
  apply(S,'p0',{t:'add',s:'H2O2',o:o.id});assert.equal(potOf(S,o,'p0').state,'idle','not yet (no catalyst)');
  apply(S,'p0',{t:'add',s:'@MnO2',o:o.id});assert.equal(potOf(S,o,'p0').state,'heat','auto react when complete');
  settle(S,o,'p0');assert.ok(!S.orders.includes(o),'auto refined and served');
  // 間違った組み合わせでは勝手に反応しない
  const o2=force(S,'CO2');apply(S,'p0',{t:'add',s:'CaCO3',o:o2.id});apply(S,'p0',{t:'add',s:'H2SO4_d',o:o2.id});
  assert.equal(potOf(S,o2,'p0').state,'idle');
  // 多段階：中間体まで自動
  const S3=createGame({mode:'solo',stageId:'s3',players:[{id:'p0',name:'x'}],auto:true});begin(S3);
  const o3=force(S3,'H2SO4@h2so4');
  ['S8','O2'].forEach(s=>apply(S3,'p0',{t:'add',s,o:o3.id}));apply(S3,'p0',{t:'heat',o:o3.id,h:1});
  assert.equal(potOf(S3,o3,'p0').state,'heat');settle(S3,o3,'p0');assert.equal(potOf(S3,o3,'p0').items[0][0],'SO2');
  // 組成モード
  const SA=createGame({g:'atom',mode:'solo',stageId:'s1',players:[{id:'p0',name:'x'}],auto:true});begin(SA);
  const oa=force(SA,'H2O');['H','O'].forEach(s=>apply(SA,'p0',{t:'add',s,o:oa.id}));assert.equal(potOf(SA,oa,'p0').state,'idle');
  apply(SA,'p0',{t:'add',s:'H',o:oa.id});assert.equal(potOf(SA,oa,'p0').state,'heat');
  console.log('auto refine ok');
}
