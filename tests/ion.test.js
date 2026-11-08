// 無機イオンモードのテスト： node tests/ion.test.js
import assert from 'node:assert/strict';
import {createGame,begin,tick,apply,owners,peekPot,RULES,results,snapshot} from '../js/engine.js';
import * as I from '../js/ion.js';
import {parseFormula} from '../js/data.js';

/* ---------- データ ---------- */
// イオンの原子の合計が化学式と一致し、電荷の合計が物質（0）・錯イオンの電荷と一致する
for(const d of I.DB){
  const f=parseFormula(d.f),a=d.atoms;
  for(const e of new Set([...Object.keys(f),...Object.keys(a)]))assert.equal(a[e]||0,f[e]||0,`${d.id} ${d.f}: ${e}`);
  assert.equal(I.chargeOf(d.parts),d.q,`${d.id} charge`);
}
assert.equal(new Set(I.DB.map(d=>d.key)).size,I.DB.length,'unique ion sets');
// 半反応式：式の両辺で原子と電荷がつり合い、need の数（e⁻・H⁺・H₂O・OH⁻）が式と一致する
const SUB='₀₁₂₃₄₅₆₇₈₉',SUPD='⁰¹²³⁴⁵⁶⁷⁸⁹';
function species(t){
  t=t.trim().replace(/（.*?）/g,'');
  const m=t.match(/^(\d*)(.*)$/);const coef=m[1]?+m[1]:1;let body=m[2];
  let q=0;const cm=body.match(/([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])$/);
  if(cm){const n=cm[1]?+[...cm[1]].map(c=>SUPD.indexOf(c)).join(''):1;q=cm[2]==='⁺'?n:-n;body=body.slice(0,body.length-cm[0].length);}
  if(body==='e')return {coef,atoms:{},q:-1,name:'e'};
  const ascii=[...body].map(c=>SUB.includes(c)?String(SUB.indexOf(c)):c).join('');
  return {coef,atoms:parseFormula(ascii),q,name:ascii+(q?(q>0?'+':'-'):'')};
}
function side(t){const o={atoms:{},q:0,n:{}};for(const s of t.split(' + ').map(species)){o.q+=s.q*s.coef;for(const [e,c] of Object.entries(s.atoms))o.atoms[e]=(o.atoms[e]||0)+c*s.coef;o.n[s.name]=(o.n[s.name]||0)+s.coef;}return o;}
for(const h of I.HALVES){
  const [l,r]=h.eq.split(' → ').map(side);
  for(const e of new Set([...Object.keys(l.atoms),...Object.keys(r.atoms)]))assert.equal(l.atoms[e]||0,r.atoms[e]||0,`${h.id} atoms ${e}: ${h.eq}`);
  assert.equal(l.q,r.q,`${h.id} charge: ${h.eq}`);
  const cnt=nm=>(l.n[nm]||0)+(r.n[nm]||0);
  assert.equal(cnt('e'),h.need.e||0,h.id+' e');assert.equal(cnt('H+'),h.need.H||0,h.id+' H+');
  assert.equal(cnt('H2O'),h.need.H2O||0,h.id+' H2O');assert.equal(cnt('OH-'),h.need.OH||0,h.id+' OH-');
}
for(const st of I.STAGES){
  assert.ok(st.pool.length>=10,st.id);assert.ok(st.pool.every(I.known),st.id);
  const seen=new Set();for(const k of st.pool){const d=I.BYID[k];if(!d)continue;for(const c of d.p){assert.ok(!seen.has(c),`${st.id} dup clue ${c}`);seen.add(c);}}
}
assert.deepEqual(I.STAGES.map(s=>s.lvl),['基礎','基礎＋','標準','応用','京大']);
console.log('ion data ok',I.DB.length,'substances',I.HALVES.length,'half-reactions');

/* ---------- 判定 ---------- */
const it=m=>Object.entries(m).map(([k,n])=>[k,n,0,{}]);
assert.ok(I.judgeBuild('Al2SO43',it({Al:2,SO4:3})).ok);
assert.match(I.judgeBuild('Al2SO43',it({Al:1,SO4:1})).why,/電荷がつり合わない（＋3／−2）/);
assert.match(I.judgeBuild('Na2SO4',it({Na:4,SO4:2})).why,/比が違う/);
assert.ok(I.judgeBuild('NaHSO4',it({Na:1,H:1,SO4:1})).ok,'acid salt may be built from H+ and SO4 2-');
assert.ok(I.judgeBuild('H3PO4',it({H:1,H2PO4:1})).ok,'H+ + H2PO4- is phosphoric acid too');
assert.equal(I.judgeBuild('ZnOH4',it({Zn:1,OH:2})).wrong.id,'ZnOH2','another substance');
assert.match(I.judgeBuild('AgNH32',it({Ag:1,NH3:4})).why,/配位数/);
assert.equal(I.judgeBuild('FeCN6_4',it({Fe3:1,CN:6})).wrong.id,'FeCN6_3','Fe3+ makes the iron(III) complex instead');
assert.match(I.judgeBuild('FeCN6_4',it({Fe2:1,CN:4})).why,/電荷/,'charge reason for complex ions');
assert.ok(I.judgeHalf('H:Cr2O7',it({e:6,H:14,H2O:7})).ok);
assert.match(I.judgeHalf('H:Cr2O7',it({e:3,H:14,H2O:7})).why,/電子の数.*Cr/);
assert.match(I.judgeHalf('H:MnO4a',it({e:5,OH:8,H2O:4})).why,/酸性では/);
assert.equal(I.accept('H:MnO4a','Na'),'半反応式の注文は e⁻・H⁺・H₂O（・OH⁻）の数を合わせる');
assert.equal(I.accept('NaCl','e'),'e⁻・H₂O は半反応式の注文で使う');
console.log('judge ok');

/* ---------- エンジン ---------- */
const P1=[{id:'p0',name:'me'}],P2=[{id:'p0',name:'A',slot:0},{id:'p1',name:'B',slot:1}];
function settle(S,o,pid){for(let i=0;i<200;i++){const p=peekPot(S,o,pid);if(!p||p.state!=='heat'||!S.orders.includes(o))break;tick(S,0.05);}}
function force(S,key){if(!S.orders.length)tick(S,0.01);const o=S.orders[0];o.k=key;o.pots={};o.left=o.total=90;o.mode='name';return o;}
const need=k=>I.isHalf(k)?I.HALF[k].need:I.BYID[k].parts;
const build=(S,pid,o,k)=>{for(const [x,n] of Object.entries(need(k)))for(let i=0;i<n;i++)apply(S,pid,{t:'add',s:x,o:o.id});};
assert.ok(!RULES.rx.finish&&!RULES.atom.finish,'hooks exist only for parts modes');
{ // ソロ：イオンで組む → 自動精製で提供。半反応式も
  const S=createGame({g:'ion',mode:'solo',stageId:'s3',players:P1,auto:true});begin(S);
  assert.equal(S.g,'ion');
  const o=force(S,'KMnO4');build(S,'p0',o,'KMnO4');settle(S,o,'p0');assert.ok(!S.orders.includes(o),'KMnO4 served');
  const h=force(S,'H:MnO4a');build(S,'p0',h,'H:MnO4a');settle(S,h,'p0');assert.ok(!S.orders.includes(h),'half reaction served');
  // e⁻ が足りない → 手動で反応 → 理由つきで失敗（減点なし）
  const h2=force(S,'H:Cr2O7');const sc=S.team.score;
  for(let i=0;i<14;i++)apply(S,'p0',{t:'add',s:'H',o:h2.id});for(let i=0;i<7;i++)apply(S,'p0',{t:'add',s:'H2O',o:h2.id});apply(S,'p0',{t:'add',s:'e',o:h2.id});
  apply(S,'p0',{t:'react',o:h2.id});settle(S,h2,'p0');
  assert.equal(peekPot(S,h2,'p0').state,'fail');assert.match(peekPot(S,h2,'p0').fail.why,/電子の数/);assert.equal(S.team.score,sc);
  // 半反応式の注文に Na⁺ は入らない
  apply(S,'p0',{t:'dump',o:h2.id});apply(S,'p0',{t:'add',s:'Na',o:h2.id});
  assert.equal(peekPot(S,h2,'p0').items.length,0);
  // 別の物質 → −5
  const o3=force(S,'ZnOH4');const sc3=S.team.score;['Zn','OH','OH'].forEach(s=>apply(S,'p0',{t:'add',s,o:o3.id}));
  apply(S,'p0',{t:'react',o:o3.id});settle(S,o3,'p0');
  assert.equal(S.team.score,Math.max(0,sc3-5));assert.match(peekPot(S,o3,'p0').fail.why,/水酸化亜鉛/);
  console.log('ion solo ok',S.team.score);
}
{ // 協力：2人なら陽イオン担当と陰イオン担当。リクエストで1つの鍋に合わせる
  const S=createGame({g:'ion',mode:'coop',stageId:'s1',players:P2,auto:true,split:true});begin(S);
  const own=owners(S);
  assert.ok(I.CATS.every(k=>own[k]===own.Na)&&I.ANS.every(k=>own[k]===own.Cl)&&own.Na!==own.Cl,'cations vs anions');
  const o=force(S,'Al2SO43');const c=own.Al,a=own.SO4;
  apply(S,c,{t:'focus',o:o.id});apply(S,a,{t:'focus',o:o.id});
  apply(S,c,{t:'add',s:'Al',o:o.id});apply(S,c,{t:'add',s:'Al',o:o.id});
  apply(S,c,{t:'add',s:'SO4',o:o.id});assert.equal(S.reqs.length,1,'request to the anion owner');
  apply(S,a,{t:'add',s:'SO4',o:o.id});apply(S,a,{t:'add',s:'SO4',o:o.id});apply(S,a,{t:'add',s:'SO4',o:o.id});settle(S,o,'*');
  assert.ok(!S.orders.includes(o),'combined pot served');
  console.log('ion coop ok',S.team.score);
}
{ // 対戦・京大：理由は出ない
  const S=createGame({g:'ion',mode:'versus',stageId:'s5',players:P2,auto:false});begin(S);
  const o=force(S,'H:SO2r');['e','H','H','H2O','H2O'].forEach(s=>apply(S,'p1',{t:'add',s,o:o.id}));
  apply(S,'p1',{t:'react',o:o.id});settle(S,o,'p1');assert.equal(peekPot(S,o,'p1').fail.why,'係数が合わない');
  apply(S,'p1',{t:'dump',o:o.id});build(S,'p1',o,'H:SO2r');apply(S,'p1',{t:'react',o:o.id});settle(S,o,'p1');
  assert.ok(!S.orders.includes(o));assert.ok(S.players.p1.score>0);assert.equal(snapshot(S).g,'ion');
  console.log('ion versus ok');
}
{ // 全ステージを最後まで回しても落ちない
  for(const st of [...I.STAGES.map(s=>s.id),'rv'])for(const mode of ['solo','coop','versus']){
    const S=createGame({g:'ion',mode,stageId:st,players:mode==='solo'?P1:P2,auto:true,busy:5});begin(S);
    const cells=RULES.ion.cells;
    while(!S.over){
      for(const pid of S.order){const o=S.orders[Math.floor(Math.random()*S.orders.length)];if(!o)continue;
        if(Math.random()<0.3)build(S,pid,o,o.k);else apply(S,pid,{t:'add',s:cells[Math.floor(Math.random()*cells.length)],o:o.id});
        if(Math.random()<0.15)apply(S,pid,{t:'react',o:o.id});
        if(Math.random()<0.1)apply(S,pid,{t:'dump',o:o.id});}
      tick(S,0.25);
    }
    assert.ok(S.team.served+Object.values(S.players).reduce((a,p)=>a+p.served,0)>0,`${st}/${mode} served something`);
    assert.ok(results(S).log.length>0);
  }
  console.log('ion sim ok');
}
console.log('ION PASS');
