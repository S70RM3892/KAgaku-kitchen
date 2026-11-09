// 早押しクイズのテスト： node tests/quiz.test.js
import assert from 'node:assert/strict';
import {createGame,begin,tick,apply,results,snapshot,quizGain,quizLoss} from '../js/engine.js';
import * as QZ from '../js/quiz.js';

// 問題：ヒントは2つ以上、名前は重複しない、選択肢は名前の違うものが指定の数だけ・正解を含む
assert.equal(new Set(QZ.ALL.map(k=>QZ.Q[k].n)).size,QZ.ALL.length,'unique names');
for(const k of QZ.ALL){
  assert.ok(QZ.Q[k].clues.length>=2,k);
  for(const n of [4,6]){const c=QZ.choices(k,n);assert.equal(c.length,n);assert.ok(c.includes(k));assert.equal(new Set(c.map(x=>QZ.Q[x].n)).size,n);}
}
for(const st of QZ.STAGES)assert.ok(st.pool.length>=st.qn||st.pool.length>=10,st.id);
console.log('quiz data ok',QZ.ALL.length,'questions');

const P2=[{id:'p0',name:'A',slot:0},{id:'p1',name:'B',slot:1}];
{ // 対戦：ヒントが時間で増える／早いほど高得点／間違えるとその問題は答えられない
  const S=createGame({g:'quiz',mode:'versus',stageId:'s3',players:P2});begin(S);
  const q=S.qz.q;assert.equal(q.shown,1);
  for(let i=0;i<Math.round(S.qz.reveal/0.1)+1;i++)tick(S,0.1);assert.equal(q.shown,2,'second clue revealed');
  const wrong=q.choices.find(c=>c!==q.k),loss=quizLoss(q);
  apply(S,'p0',{t:'ans',c:wrong});assert.equal(S.players.p0.score,0);assert.ok(q.locked.p0);
  apply(S,'p0',{t:'ans',c:q.k});assert.equal(q.state,'open','locked player cannot answer again');
  const gain=quizGain(q);apply(S,'p1',{t:'ans',c:q.k});
  assert.equal(q.state,'done');assert.equal(q.by,'p1');assert.equal(S.players.p1.score,gain);assert.ok(loss>0);
  for(let i=0;i<50;i++)tick(S,0.1);assert.notEqual(S.qz.q.id,q.id,'next question');assert.equal(S.qz.n,2);
  assert.ok(snapshot(S).qz);
}
{ // 誰も答えなければ最後のヒントのあと終わる／全問で試合終了
  const S=createGame({g:'quiz',mode:'solo',stageId:'s1',players:[{id:'p0',name:'me'}]});begin(S);
  let guard=0;while(!S.over&&guard++<100000)tick(S,0.1);
  assert.ok(S.over);assert.equal(results(S).log.length,S.qz.total);assert.ok(results(S).log.every(l=>!l.ok));
}
{ // 協力：全員が間違えたら次へ。チーム得点
  const S=createGame({g:'quiz',mode:'coop',stageId:'s5',players:P2});begin(S);
  const q=S.qz.q,w=q.choices.filter(c=>c!==q.k);
  apply(S,'p0',{t:'ans',c:w[0]});apply(S,'p1',{t:'ans',c:w[1]});assert.equal(q.state,'done');assert.equal(q.by,null);
  for(let i=0;i<50;i++)tick(S,0.1);const q2=S.qz.q;apply(S,'p1',{t:'ans',c:q2.k});assert.ok(S.team.score>0);
}
// 共テ物理・化学の早押し：同じ仕組みで動く。名前の重複なし・ヒント3つ以上・選択肢は正解を含む
import('../js/kyote.js').then(({KPHY,KCHEM})=>{
  for(const [g,B] of [['kphy',KPHY],['kchem',KCHEM]]){
    assert.equal(new Set(B.ALL.map(k=>B.Q[k].n)).size,B.ALL.length,g+' unique names');
    for(const k of B.ALL){assert.ok(B.Q[k].clues.length>=3,k);const c=B.choices(k,6);assert.ok(c.includes(k)&&c.length===6);}
    for(const st of [...B.STAGES.map(x=>x.id),'rv'])for(const mode of ['solo','coop','versus']){
      const S=createGame({g,mode,stageId:st,players:mode==='solo'?[{id:'p0',name:'me'}]:P2});begin(S);assert.equal(S.g,g);
      let guard=0;while(!S.over&&guard++<100000){const q=S.qz.q;if(q&&q.state==='open'&&Math.random()<0.02)apply(S,S.order[Math.floor(Math.random()*S.order.length)],{t:'ans',c:q.choices[Math.floor(Math.random()*q.choices.length)]});tick(S,0.1);}
      assert.ok(S.over&&results(S).log.length===S.qz.total,`${g}/${st}/${mode}`);
    }
    console.log(g,'ok',B.ALL.length,'questions');
  }
  console.log('QUIZ PASS');
});
