// 英語の3モードのテスト： node tests/eng.test.js
import assert from 'node:assert/strict';
import {createGame,begin,tick,apply,owners,peekPot,RULES,results} from '../js/engine.js';
import {ROOTM,SYNM,WORDM} from '../js/eng.js';

/* ---------- データ ---------- */
// 語根：部品をつなげると単語のつづりになる。部品の組み合わせは単語ごとに1つ
for(const d of ROOTM.DB){
  assert.equal(d.seq.map(k=>ROOTM.PART[k].label.replace(/-/g,'')).join(''),d.w,'spelling '+d.w);
  assert.equal(ROOTM.PART[d.seq[0]].side==='suf',false,d.w+' starts with a suffix');
}
assert.equal(new Set(ROOTM.DB.map(d=>d.key)).size,ROOTM.DB.length,'unique root sets');
// 構文：並びは棚の語句だけ・同じ語句は1回だけ・並びは構文ごとに1つ
for(const d of SYNM.DB){assert.ok(d.seq.every(k=>SYNM.PART[k]),d.id);assert.equal(new Set(d.seq).size,d.seq.length,d.id+' repeats a chunk');}
assert.equal(new Set(SYNM.DB.map(d=>d.key)).size,SYNM.DB.length,'unique sequences');
// 見分け：2語ずつのペア、例文に空所が1つ
for(const d of WORDM.DB){assert.equal(d.s.split('___').length,2,d.w);assert.equal(WORDM.BYID[d.other].other,d.id);}
for(const M of [ROOTM,SYNM,WORDM]){
  const cells=[...M.SHELF.L.main,...M.SHELF.L.bottom,...M.SHELF.R.main,...M.SHELF.R.bottom];
  assert.equal(new Set(cells).size,cells.length);assert.ok(cells.every(c=>M.PART[c]));
  assert.deepEqual(M.STAGES.map(s=>s.lvl),['基礎','基礎＋','標準','応用','京大']);
  for(const st of M.STAGES)assert.ok(st.pool.length>=5&&st.pool.every(M.known),st.id);
}
console.log('eng data ok',ROOTM.DB.length,'words',SYNM.DB.length,'patterns',WORDM.DB.length,'confusables');

/* ---------- 判定 ---------- */
const it=a=>a.map(k=>[k,1,0,{}]);
assert.ok(ROOTM.judgeBuild('inspect',it(['p_in','r_spect'])).ok);
assert.equal(ROOTM.judgeBuild('inspect',it(['p_re','r_spect'])).wrong.id,'respect');
assert.match(ROOTM.judgeBuild('inspection',it(['p_in','r_spect','s_ive'])).generic,/接尾辞/);
assert.ok(SYNM.judgeBuild('y_too',it(['c_too','s1','c_to','s2'])).ok);
assert.match(SYNM.judgeBuild('y_too',it(['c_too','c_to','s1','s2'])).why,/語順/);
assert.equal(SYNM.judgeBuild('y_notbut',it(['c_not_only','s1','c_but_also','s2'])).wrong.id,'y_notonly');
assert.ok(WORDM.judgePick('w_affect',it(['w_affect'])).ok);
assert.match(WORDM.judgePick('w_affect',it(['w_effect'])).why,/effect/);
console.log('judge ok');

/* ---------- エンジン ---------- */
const P1=[{id:'p0',name:'me'}],P2=[{id:'p0',name:'A',slot:0},{id:'p1',name:'B',slot:1}];
function settle(S,o,pid){for(let i=0;i<200;i++){const p=peekPot(S,o,pid);if(!p||p.state!=='heat'||!S.orders.includes(o))break;tick(S,0.05);}}
function force(S,key){if(!S.orders.length)tick(S,0.01);const o=S.orders[0];o.k=key;o.pots={};o.left=o.total=90;o.mode='name';return o;}
const seqFor=(g,k)=>g==='eroot'?ROOTM.BYID[k].seq:g==='esyn'?SYNM.BYID[k].seq:[k];
const make=(S,pid,o)=>{for(const x of seqFor(S.g,o.k))apply(S,pid,{t:'add',s:x,o:o.id});};
assert.ok(!RULES.rx.finish&&!RULES.atom.finish,'chemistry rules unchanged');
for(const [g,key] of [['eroot','introduction'],['esyn','y_nosooner'],['eword','w_stationery']]){
  const S=createGame({g,mode:'solo',stageId:'s4',players:P1,auto:true});begin(S);assert.equal(S.g,g);
  const o=force(S,key);make(S,'p0',o);settle(S,o,'p0');assert.ok(!S.orders.includes(o),g+' served');
  console.log(g,'solo ok',S.team.score);
}
{ // 見分け：選んだ瞬間に判定、違えば −5
  const S=createGame({g:'eword',mode:'solo',stageId:'s1',players:P1,auto:false});begin(S);
  const o=force(S,'w_lend');const sc=S.team.score;apply(S,'p0',{t:'add',s:'w_borrow',o:o.id});settle(S,o,'p0');
  assert.equal(peekPot(S,o,'p0').state,'fail');assert.match(peekPot(S,o,'p0').fail.why,/借りる/);assert.equal(S.team.score,Math.max(0,sc-5));
}
{ // 構文：語順が違えば失敗（減点なし）。協力は左右の棚で担当が分かれ、順番どおりに合わせる
  const S=createGame({g:'esyn',mode:'coop',stageId:'s1',players:P2,auto:true,split:true});begin(S);
  const own=owners(S);assert.notEqual(own.c_It_is,own.c_the,'left and right shelves have different owners');
  const o=force(S,'y_so_that');
  for(const x of ['c_so','s1','c_that','s2'])apply(S,own[x],{t:'add',s:x,o:o.id});
  settle(S,o,'*');assert.ok(!S.orders.includes(o),'coop sequence served');
  const o2=force(S,'y_too');for(const x of ['s1','c_too','c_to','s2'])apply(S,own[x],{t:'add',s:x,o:o2.id});
  apply(S,'p0',{t:'react',o:o2.id});settle(S,o2,'*');assert.equal(peekPot(S,o2,'*').state,'fail');assert.match(peekPot(S,o2,'*').fail.why,/語順/);
  console.log('esyn coop ok');
}
for(const g of ['eroot','esyn','eword'])for(const st of ['s1','s2','s3','s4','s5','rv'])for(const mode of ['solo','coop','versus']){
  const S=createGame({g,mode,stageId:st,players:mode==='solo'?P1:P2,auto:true,busy:5});begin(S);
  const cells=RULES[g].cells;
  while(!S.over){
    for(const pid of S.order){const o=S.orders[Math.floor(Math.random()*S.orders.length)];if(!o)continue;
      if(Math.random()<0.35){apply(S,pid,{t:'dump',o:o.id});make(S,pid,o);}else apply(S,pid,{t:'add',s:cells[Math.floor(Math.random()*cells.length)],o:o.id});
      if(Math.random()<0.15)apply(S,pid,{t:'react',o:o.id});if(Math.random()<0.1)apply(S,pid,{t:'dump',o:o.id});}
    tick(S,0.25);
  }
  assert.ok(results(S).log.length>0,`${g}/${st}/${mode}`);
}
console.log('eng sim ok');
console.log('ENG PASS');
