// 反応データの検証： node tests/chem.test.js
import assert from 'node:assert/strict';
import {SUB,RX,TG,TGIDS,MENU,MKEYS,MCOST,route,judge,SHELF,CATS,CATN,SHELF_IDS,stepsOf,STAGES,poolFor,serves} from '../js/chem.js';

// 全物質の式が読める・棚と触媒が実在
for(const id in SUB)assert.ok(Object.keys(SUB[id].m).length,`formula ${id}`);
const flat=SHELF.flat();assert.equal(flat.length,48);assert.equal(new Set(flat).size,48,'shelf unique');
flat.forEach(id=>assert.ok(SUB[id],`shelf ${id}`));
CATS.forEach(c=>assert.ok(CATN[c],`cat ${c}`));
// 全反応が原子保存している（係数が正しい）
for(const x of RX){
  const L={},Rr={};
  x.r.forEach(e=>{for(const id of e.ids){assert.ok(SUB[id],`${x.id}: ${id}`);}const m=SUB[e.ids[0]].m;for(const k in m)L[k]=(L[k]||0)+m[k]*e.n;});
  x.p.forEach(([id,n])=>{assert.ok(SUB[id],`${x.id}: ${id}`);const m=SUB[id].m;for(const k in m)Rr[k]=(Rr[k]||0)+m[k]*n;});
  assert.deepEqual(Object.fromEntries(Object.entries(L).sort()),Object.fromEntries(Object.entries(Rr).sort()),`balance ${x.id}`);
  assert.ok(x.p.some(([p])=>p===x.main),`main ${x.id}`);
  if(x.cat)x.cat.forEach(c=>assert.ok(CATN[c],`${x.id} cat ${c}`));
}
// 全注文が作れる
for(const k of MKEYS){assert.ok(isFinite(MCOST[k]),`reachable ${k}`);assert.ok(route(k).length>=1);assert.ok(TG[MENU[k].t],`clue ${k}`);assert.ok(serves(k,route(k).at(-1).id),`serves ${k}`);}
// 各ルートを順に実行すると judge が通る（係数モード）
for(const t of MKEYS){
  for(const x of route(t)){
    const items=x.r.map(e=>{const id=e.ids.find(i=>SHELF_IDS.has(i))||e.ids[0];return [id,e.n,SHELF_IDS.has(id)?0:1];});
    const j=judge(items,x.cat?x.cat[0]:null,x.h,true);
    assert.ok(j.ok&&j.rx===x.id,`route ${t} step ${x.id}: ${JSON.stringify(j)}`);
    assert.equal(j.over.length,0,`no over ${x.id}`);
  }
}
// 学びのポイントになる失敗理由
const W=(items,cat,heat,coef=false)=>judge(items.map(([a,n,p])=>[a,n||1,p||0]),cat,heat,coef);
assert.equal(W([['MnO2'],['HCl_c',4]],null,0).why,'加熱が必要');
assert.match(W([['MnO2'],['HCl_d',4]],null,1).why,/濃度が違う/);
assert.match(W([['H2O2',2],['MnO2']],null,0).why,/触媒として使う/);
assert.match(W([['HCl_c',4]],'MnO2',1).why,/反応物/);
assert.equal(W([['H2O2',2]],null,0).why,'触媒が必要');
assert.equal(W([['H2O2',2]],'Pt',0).why,'触媒が違う');
assert.match(W([['C6H6'],['HNO3_c'],['H2SO4_c']],null,1).why,/触媒として使う/);
assert.match(W([['C6H6']],'H2SO4_c',1).why,/反応物/);
assert.equal(W([['N2'],['H2',3]],'Fe3O4',1).why,'高温・高圧が必要');
assert.equal(W([['Cu'],['HNO3_d',4]],null,0,true).why,'係数が合わない');
assert.ok(W([['Cu',3],['HNO3_d',8]],null,0,true).ok);
assert.ok(W([['Cu',6],['HNO3_d',16]],null,0,true).ok,'multiples ok');
assert.equal(W([['Zn'],['H2SO4_c']],null,0).why.startsWith('濃度が違う'),true);
// エタノール：分子数で生成物が変わる
assert.equal(W([['C2H5OH',2]],'H2SO4_c',1).rx,'ether');
assert.equal(W([['C2H5OH',1]],'H2SO4_c',1).rx,'ethylene');
assert.equal(W([['C2H5OH',2]],'H2SO4_c',2).rx,'ethylene','too hot -> ethylene');
// 不要な加熱・触媒は成功するが over が付く
const ov=W([['AgNO3'],['NaCl']],'Pt',1);assert.ok(ov.ok);assert.deepEqual(ov.over.sort(),['加熱は不要','触媒は不要'].sort());
// アスピリンは触媒・加熱どちらでも可
assert.ok(W([['salicylic'],['Ac2O']],null,0).ok&&W([['salicylic'],['Ac2O']],'H2SO4_c',1).ok);
// ステージごとの注文数とルート
for(const st of STAGES){const p=poolFor(st);console.log(st.id,p.length,'targets; max steps',Math.max(...p.map(stepsOf)));}
console.log('multi-step:',MKEYS.filter(t=>stepsOf(t)>1).map(t=>`${t}(${stepsOf(t)})`).join(' '));
assert.ok(!serves('NH3@haber','nh3_lab'),'via enforced');assert.ok(serves('NH3','haber'));
console.log('CHEM PASS',RX.length,'reactions',MKEYS.length,'menu items');
