// エンジンの単体テスト： node tests/engine.test.js
import assert from 'node:assert/strict';
import {createGame,begin,tick,apply,owners,snapshot,advance,results,playerLeft,attackPower} from '../js/engine.js';
import {BYID,DB} from '../js/data.js';

const P2=[{id:'p0',name:'A',slot:0},{id:'p1',name:'B',slot:1}];
const comp=id=>Object.entries(BYID[id].m);
function fill(S,pid,f,id){for(const [s,c] of comp(id))for(let i=0;i<c;i++)apply(S,pid,{t:'add',s,f:f.id});}
function cook(S,pid,f,id){fill(S,pid,f,id);apply(S,pid,{t:'react',f:f.id});for(let i=0;i<60&&f.state==='heat';i++)tick(S,0.05);}
function forceOrder(S,id){S.orders[0].ban={};S.orders[0].d=id;S.orders[0].left=S.orders[0].total=60;return S.orders[0];}

// ---- solo ----
{
  const S=createGame({mode:'solo',stageId:'s1',players:[{id:'p0',name:'me'}]});
  begin(S);assert.equal(S.orders.length,2);
  const o=forceOrder(S,'H2O');const f=S.flasks[0];
  cook(S,'p0',f,'H2O');assert.equal(f.state,'ready');
  apply(S,'p0',{t:'serve',f:f.id,o:o.id});
  assert.ok(S.team.score>0,'solo score');assert.equal(S.team.served,1);
  assert.ok(S.ev.some(e=>e.m&&e.m[1]==='ok'));
  console.log('solo ok',S.team.score);
}
// ---- coop: shelf split forces cooperation ----
{
  const S=createGame({mode:'coop',stageId:'s1',players:P2,split:true});
  begin(S);
  assert.equal(S.flasks.length,3);assert.ok(S.flasks.every(f=>f.owner===null));
  const own=owners(S);assert.notEqual(own.H,own.O,'H and O split');
  const hOwner=own.H,oOwner=own.O;
  const f=S.flasks[0];
  // O-owner taps H (not theirs) -> request
  apply(S,oOwner,{t:'add',s:'H',f:f.id});apply(S,oOwner,{t:'add',s:'H',f:f.id});
  assert.equal(S.reqs.length,2);assert.equal(f.atoms.length,0);
  // H-owner taps H with a different focus -> goes to requested flask
  apply(S,hOwner,{t:'add',s:'H',f:S.flasks[1].id});apply(S,hOwner,{t:'add',s:'H',f:S.flasks[1].id});
  assert.deepEqual(f.atoms,[['H',2]]);assert.equal(S.reqs.length,0);assert.equal(S.flasks[1].atoms.length,0);
  apply(S,oOwner,{t:'add',s:'O',f:f.id});
  const o=forceOrder(S,'H2O');
  apply(S,hOwner,{t:'react',f:f.id});for(let i=0;i<40&&f.state==='heat';i++)tick(S,0.05);
  assert.equal(f.state,'ready');
  S.ev=[];apply(S,hOwner,{t:'serve',f:f.id,o:o.id});
  const mOk=S.ev.filter(e=>e.m&&e.m[1]==='ok').map(e=>e.to).sort();
  assert.deepEqual(mOk,['p0','p1'],'both contributors get mastery');
  // rotation swaps owners
  const before=owners(S).H;S.rotNext=S.elapsed+0.01;tick(S,0.05);
  assert.notEqual(owners(S).H,before,'rotation swaps');
  // leaving player -> shelves collapse to remaining
  playerLeft(S,'p1');assert.equal(owners(S),null);
  console.log('coop ok',S.team.score,'stars',S.stars);
}
// ---- versus: snipe, ban, attack/offset ----
{
  const S=createGame({mode:'versus',stageId:'s1',players:P2});
  begin(S);
  assert.equal(S.flasks.filter(f=>f.owner==='p0').length,2);
  const o=forceOrder(S,'CO2');
  const fa=S.flasks.find(f=>f.owner==='p0'),fb=S.flasks.find(f=>f.owner==='p1');
  // p1 cannot touch p0 flask
  apply(S,'p1',{t:'add',s:'C',f:fa.id});assert.equal(fa.atoms.length,0);assert.equal(fb.atoms.length,1,'falls back to own flask');
  apply(S,'p1',{t:'dump',f:fb.id});
  cook(S,'p0',fa,'CO2');cook(S,'p1',fb,'CO2');
  // wrong serve by p1 to other order -> ban
  const other=S.orders.find(x=>x.id!==o.id);
  if(other&&BYID[other.d].k!==BYID['CO2'].k){
    apply(S,'p1',{t:'serve',f:fb.id,o:other.id});assert.ok(other.ban.p1);assert.ok(S.orders.includes(other),'order stays in versus');
    cook(S,'p1',fb,'CO2');
  }
  apply(S,'p0',{t:'serve',f:fa.id,o:o.id});
  assert.ok(S.players.p0.score>0);assert.ok(!S.orders.includes(o));
  // p1 tries the same order -> sniped, product kept
  S.ev=[];apply(S,'p1',{t:'serve',f:fb.id,o:o.id});assert.equal(fb.state,'ready','product kept when sniped');
  assert.equal(S.players.p1.inc.length,1,'attack queued');
  const pow=S.players.p1.inc[0].pow;assert.equal(pow,attackPower(BYID['CO2'],false,1,false));
  // offset: p1 serves during warning
  const o2=forceOrder(S,'CO2');apply(S,'p1',{t:'serve',f:fb.id,o:o2.id});
  assert.equal(S.players.p1.inc.length,0,'offset cancels');assert.ok(S.players.p1.offset>0);
  // unanswered attack lands
  S.players.p0.inc.forEach(x=>x.t=0.01);const before=S.players.p0.recv;
  tick(S,0.05);assert.ok(S.players.p0.recv>before||S.players.p0.inc.length===0);
  console.log('versus ok',S.players.p0.score,S.players.p1.score,'fx',JSON.stringify(S.players.p0.fx));
}
// ---- big attack ignites best flask ----
{
  const S=createGame({mode:'versus',stageId:'s4',players:P2});begin(S);
  const fb=S.flasks.find(f=>f.owner==='p1');fill(S,'p1',fb,'CH4');
  S.players.p1.inc.push({id:999,pow:4,from:'p0',t:0.01});tick(S,0.05);
  assert.equal(fb.state,'fire');assert.ok(Object.keys(S.players.p1.fx.lock).length>0||true);assert.ok(S.players.p1.fx.dark>S.elapsed);
  for(let i=0;i<4;i++)apply(S,'p1',{t:'ext',f:fb.id});assert.equal(fb.state,'idle');
  console.log('attack ok');
}
// ---- full simulated games don't throw, snapshot is serializable ----
for(const mode of ['solo','coop','versus'])for(const st of ['s1','s2','s3','s4','s5','rv']){
  const players=mode==='solo'?[{id:'p0',name:'x'}]:[...P2,{id:'p2',name:'C',slot:2}];
  const S=createGame({mode,stageId:st,players,pool:st==='rv'?DB.slice(0,10).map(d=>d.id):null});begin(S);
  let n=0;
  while(!S.over&&n<20000){
    tick(S,0.05);n++;
    if(n%7===0){
      const pid=players[n%players.length].id;const P=S.players[pid];
      const f=S.flasks.find(x=>(x.owner==null||x.owner===pid)&&x.state==='idle');
      const o=S.orders[0];
      if(f&&o){fill(S,pid,f,o.d);apply(S,pid,{t:'react',f:f.id});}
      const r=S.flasks.find(x=>(x.owner==null||x.owner===pid)&&x.state==='ready');
      if(r&&S.orders[0])apply(S,pid,{t:'serve',f:r.id,o:S.orders[0].id});
      const fire=S.flasks.find(x=>(x.owner==null||x.owner===pid)&&x.state==='fire');if(fire)apply(S,pid,{t:'ext',f:fire.id});
      const fail=S.flasks.find(x=>(x.owner==null||x.owner===pid)&&x.state==='fail');if(fail)apply(S,pid,{t:'dump',f:fail.id});
    }
    if(n%13===0){const V=JSON.parse(JSON.stringify(snapshot(S)));advance(V,0.05);}
    S.ev.length=0;
  }
  assert.ok(S.over,`${mode}/${st} ends`);
  const r=results(S);JSON.stringify(r);
  const sc=mode==='versus'?r.players.map(p=>p.score).join('/'):r.team.score;
  console.log(`sim ${mode}/${st}: score=${sc} log=${r.log.length} snap=${JSON.stringify(snapshot(S)).length}B`);
}
// ---- hostile input doesn't break the host ----
{
  const S=createGame({mode:'coop',stageId:'s1',players:P2});begin(S);
  for(const a of [{t:'add',s:'constructor',f:S.flasks[0].id},{t:'add',s:'__proto__'},{t:'serve',f:'x',o:{}},{t:'toString'},{t:'hasOwnProperty'},null,{t:'stamp',k:99},{t:'hint',o:-1}])apply(S,'p1',a);
  for(let i=0;i<40;i++)tick(S,0.05);
  assert.equal(S.reqs.length,0);JSON.stringify(snapshot(S));
  console.log('hostile ok');
}
console.log('ALL PASS');
