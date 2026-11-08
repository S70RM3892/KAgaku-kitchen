// 官能基モードのテスト： node tests/org.test.js
import assert from 'node:assert/strict';
import {createGame,begin,tick,apply,owners,peekPot,RULES,results,snapshot} from '../js/engine.js';
import * as O from '../js/org.js';
import {parseFormula} from '../js/data.js';

/* ---------- データ ---------- */
// 部品の原子の合計が示性式と一致する（打ち間違い防止）
for(const d of O.DB){
  const f=parseFormula(d.f.replace(/（.*）/,'')),a=d.atoms;
  for(const e of new Set([...Object.keys(f),...Object.keys(a)]))assert.equal(a[e]||0,f[e]||0,`${d.id} ${d.f}: ${e}`);
}
// 部品の組み合わせは化合物ごとに1つ（同じ部品で別の化合物にならない）
assert.equal(new Set(O.DB.map(d=>d.key)).size,O.DB.length,'unique part sets');
// 見分けの注文には必ず正解の試薬がある。正解は「両方とも結果が確定していて、陽性・陰性が分かれる」試薬だけ
for(const p of O.PAIRS){
  assert.ok(p.ok.length>0,p.id);
  for(const t of p.ok){const x=O.result(p.a,t),y=O.result(p.b,t);assert.ok(x!=='?'&&y!=='?'&&x!==y,p.id+' '+t);}
}
// 扱いが割れる事実は正解に使わない（ギ酸×フェーリング、エステル×ヨードホルムの一部など）
assert.equal(O.result('HCOOH','Feh'),'?');
assert.deepEqual(O.PAIR['T:HCOOH/AcOH'].ok,['Ag']);
assert.deepEqual(O.PAIR['T:Salicylic/Aspirin'].ok,['FeCl3']);
assert.deepEqual(O.PAIR['T:Acetone/PrOH2'].ok,['Na'],'both iodoform-positive: only Na separates them');
// ステージは基礎→京大の5段階＋復習。性質ヒントはステージ内で重複しない
assert.deepEqual(O.STAGES.map(s=>s.lvl),['基礎','基礎＋','標準','応用','京大']);
for(const st of O.STAGES){
  assert.ok(st.pool.length>=8,st.id);assert.ok(st.pool.every(O.known),st.id);
  const seen=new Set();for(const k of st.pool){const d=O.BYID[k];if(!d)continue;for(const c of d.p){assert.ok(!seen.has(c),`${st.id} dup clue ${c}`);seen.add(c);}}
}
console.log('org data ok',O.DB.length,'compounds',O.PAIRS.length,'pairs');

/* ---------- 判定 ---------- */
const it=m=>Object.entries(m).map(([k,n])=>[k,n,0,{}]);
assert.ok(O.judgeBuild('EtOH',it({C2H5:1,OH:1})).ok);
assert.equal(O.judgeBuild('EtOH',it({CH3:1,CHO:1})).wrong.id,'MeCHO','another compound');
assert.match(O.judgeBuild('Terephthalic',it({oC6H4:1,COOH:2})).wrong.id,/Phthalic/,'o-isomer is phthalic acid');
assert.equal(O.judgeBuild('Cresol',it({pC6H4:1,CH3:1,OH:1})).why,'置換基の位置（o-・m-・p-）が違う');
assert.equal(O.judgeBuild('Salicylic',it({oC6H4:1,OH:1})).generic,'部品が足りない');
assert.ok(O.judgePair('T:MeCHO/Acetone','Ag').ok);
assert.match(O.judgePair('T:MeCHO/Acetone','I2').why,/どちらも陽性/);
assert.match(O.judgePair('T:HCOOH/AcOH','Feh').why,/確実に区別できない/);
console.log('judge ok');

/* ---------- エンジン ---------- */
const P1=[{id:'p0',name:'me'}],P2=[{id:'p0',name:'A',slot:0},{id:'p1',name:'B',slot:1}];
function settle(S,o,pid){for(let i=0;i<200;i++){const p=peekPot(S,o,pid);if(!p||p.state!=='heat'||!S.orders.includes(o))break;tick(S,0.05);}}
function force(S,key){if(!S.orders.length)tick(S,0.01);const o=S.orders[0];o.k=key;o.pots={};o.left=o.total=90;o.mode='name';return o;}
const build=(S,pid,o,k)=>{for(const [x,n] of Object.entries(O.BYID[k].parts))for(let i=0;i<n;i++)apply(S,pid,{t:'add',s:x,o:o.id});};
// 既存モードは今までどおり（g の指定が無い・不明なら反応式）
assert.equal(createGame({mode:'solo',stageId:'s1',players:P1}).g,'rx');
assert.equal(createGame({g:'atom',mode:'solo',stageId:'s1',players:P1}).g,'atom');
assert.equal(createGame({g:'zzz',mode:'solo',stageId:'s1',players:P1}).g,'rx');
assert.ok(!RULES.rx.finish&&!RULES.atom.finish&&!RULES.rx.accept&&!RULES.atom.instant,'hooks exist only for org');
{ // ソロ：自動精製で組み立て → 提供
  const S=createGame({g:'org',mode:'solo',stageId:'s1',players:P1,auto:true});begin(S);
  assert.equal(S.g,'org');assert.ok(S.pool.length>0);
  const o=force(S,'EtOH');build(S,'p0',o,'EtOH');settle(S,o,'p0');
  assert.ok(!S.orders.includes(o),'auto served');assert.ok(S.team.score>0);
  // 別の化合物 → −5、注文は残る
  const o2=force(S,'MeCHO');const sc=S.team.score;
  ['C2H5','OH'].forEach(s=>apply(S,'p0',{t:'add',s,o:o2.id}));settle(S,o2,'p0');
  // 自動精製は「注文どおり」のときだけ動くので、手動で反応
  if(peekPot(S,o2,'p0').state==='idle'){apply(S,'p0',{t:'react',o:o2.id});settle(S,o2,'p0');}
  assert.equal(peekPot(S,o2,'p0').state,'fail');assert.equal(S.team.score,Math.max(0,sc-5));
  assert.match(peekPot(S,o2,'p0').fail.why,/エタノール/);
  // 検出試薬は組み立ての注文に入らない
  apply(S,'p0',{t:'dump',o:o2.id});apply(S,'p0',{t:'add',s:'@Ag',o:o2.id});
  assert.equal(peekPot(S,o2,'p0').cat,null,'test reagent rejected for build orders');
  console.log('org solo build ok',S.team.score);
}
{ // 見分け：試薬を選んだ瞬間に判定（自動精製OFFでも）。間違いは −5 で結果を表示、総当たりできない
  const S=createGame({g:'org',mode:'solo',stageId:'s2',players:P1,auto:false});begin(S);
  const o=force(S,'T:MeCHO/Acetone');
  apply(S,'p0',{t:'add',s:'CH3',o:o.id});assert.ok(!(peekPot(S,o,'p0')&&peekPot(S,o,'p0').items.length),'parts rejected for pair orders');
  apply(S,'p0',{t:'add',s:'@I2',o:o.id});settle(S,o,'p0');
  const p=peekPot(S,o,'p0');assert.equal(p.state,'fail');assert.match(p.fail.why,/どちらも陽性/);
  apply(S,'p0',{t:'add',s:'@Ag',o:o.id});assert.equal(peekPot(S,o,'p0').state,'fail','cannot retry without dumping');
  apply(S,'p0',{t:'dump',o:o.id});apply(S,'p0',{t:'add',s:'@Feh',o:o.id});settle(S,o,'p0');
  assert.ok(!S.orders.includes(o),'served with Fehling');
  const r=results(S);assert.ok(r.log.some(l=>l.k==='T:MeCHO/Acetone'&&!l.ok&&l.given==='I₂+NaOH'));
  console.log('org pair ok');
}
{ // 協力：2人なら骨格と官能基で担当が分かれ、1つの鍋に合わせて組む（リクエストも）
  const S=createGame({g:'org',mode:'coop',stageId:'s3',players:P2,auto:true,split:true});begin(S);
  const own=owners(S);
  assert.ok(O.SK.every(k=>own[k]===own.CH3)&&O.FG.every(k=>own[k]===own.OH)&&own.CH3!==own.OH,'skeleton vs functional groups');
  const o=force(S,'Salicylic');
  const sk=own.oC6H4,fg=own.OH;
  apply(S,sk,{t:'focus',o:o.id});apply(S,fg,{t:'focus',o:o.id});
  apply(S,sk,{t:'add',s:'oC6H4',o:o.id});apply(S,fg,{t:'add',s:'OH',o:o.id});
  // 骨格担当が –COOH をリクエスト → 官能基担当がタップ
  apply(S,sk,{t:'add',s:'COOH',o:o.id});assert.equal(S.reqs.length,1);
  apply(S,fg,{t:'add',s:'COOH',o:o.id});settle(S,o,'*');
  assert.ok(!S.orders.includes(o),'combined pot served');
  assert.ok(results(S).log.at(-1).ok);
  console.log('org coop ok',S.team.score);
}
{ // 対戦：鍋は人ごと。先に作った人だけ得点
  const S=createGame({g:'org',mode:'versus',stageId:'s4',players:P2,auto:true});begin(S);
  const o=force(S,'Terephthalic');
  build(S,'p1',o,'Terephthalic');settle(S,o,'p1');
  assert.ok(!S.orders.includes(o));assert.ok(S.players.p1.score>0&&S.players.p0.score===0);
  assert.ok(snapshot(S).g==='org');
  console.log('org versus ok');
}
{ // 京大ラッシュ：失敗の理由は出ない／応用：位置の違いは理由が出る
  const S=createGame({g:'org',mode:'solo',stageId:'s5',players:P1,auto:false});begin(S);
  const o=force(S,'Cresol');['pC6H4','CH3','OH'].forEach(s=>apply(S,'p0',{t:'add',s,o:o.id}));
  apply(S,'p0',{t:'react',o:o.id});settle(S,o,'p0');assert.equal(peekPot(S,o,'p0').fail.why,'その組み合わせの化合物は無い');
  const S4=createGame({g:'org',mode:'solo',stageId:'s4',players:P1,auto:false});begin(S4);
  const o4=force(S4,'Cresol');['pC6H4','CH3','OH'].forEach(s=>apply(S4,'p0',{t:'add',s,o:o4.id}));
  apply(S4,'p0',{t:'react',o:o4.id});settle(S4,o4,'p0');assert.match(peekPot(S4,o4,'p0').fail.why,/位置/);
  console.log('org feedback levels ok');
}
{ // 全ステージを最後まで回しても落ちない（ランダムに部品を入れる）
  for(const st of [...O.STAGES.map(s=>s.id),'rv'])for(const mode of ['solo','coop','versus']){
    const S=createGame({g:'org',mode,stageId:st,players:mode==='solo'?P1:P2,auto:true,busy:5});begin(S);
    const cells=RULES.org.cells;
    while(!S.over){
      for(const pid of S.order){const o=S.orders[Math.floor(Math.random()*S.orders.length)];if(!o)continue;
        if(Math.random()<0.3){const k=o.k;if(O.isPair(k))apply(S,pid,{t:'add',s:'@'+O.PAIR[k].ok[0],o:o.id});else build(S,pid,o,k);}
        else apply(S,pid,{t:'add',s:cells[Math.floor(Math.random()*cells.length)],o:o.id});
        if(Math.random()<0.1)apply(S,pid,{t:'dump',o:o.id});}
      tick(S,0.25);
    }
    assert.ok(S.team.served+Object.values(S.players).reduce((a,p)=>a+p.served,0)>0,`${st}/${mode} served something`);
  }
  console.log('org sim ok');
}
console.log('ORG PASS');
