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
Promise.all([import('../js/kyote.js'),import('../js/kmath.js'),import('../js/kcalc.js'),import('../js/chemmap.js')]).then(([{KPHY,KCHEM},{KMATH},{KCALC},{CHEMMAP,pick}])=>{
  // 理論化学 計算：問題ごとに「よくある間違い」の選択肢をもつ。正解は必ず選択肢に入り、同じ表示が2つ並ばない
  assert.ok(KCALC.ALL.length>=110,'kcalc has 110+ questions');
  for(const k of KCALC.ALL){const q=KCALC.Q[k];assert.ok(KCALC.known(k)&&q.clues.length>=4&&q.wrong.length>=3,k);assert.ok(q.wrong.every(w=>!KCALC.known(w)&&KCALC.Q[w].n!==q.n),k+' distractor');
    for(const n of [4,6]){const c=KCALC.choices(k,n);assert.ok(c.includes(k)&&c.length===Math.min(n,q.wrong.length+1));assert.equal(new Set(c.map(x=>KCALC.Q[x].n)).size,c.length,k);}}
  for(const st of KCALC.STAGES){assert.ok(st.pool.length>=8,st.id);const S=createGame({g:'kcalc',mode:'solo',stageId:st.id,players:[{id:'p0',name:'me'}]});begin(S);
    let guard=0;while(!S.over&&guard++<300000){const q=S.qz.q;if(q&&q.state==='open'&&q.t>2&&guard%7===0)apply(S,'p0',{t:'ans',c:guard%3?q.k:q.choices.find(c=>c!==q.k)});tick(S,0.1);}
    assert.equal(results(S).log.length,S.qz.total,'kcalc '+st.id);}
  console.log('kcalc ok',KCALC.ALL.length,'questions');
  // 化学マップ：共テ化学の知識問題と計算問題のすべてが、どれかの単元に入っている（抜けが無い）
  {const inMap=(g,B)=>B.ALL.filter(k=>!k.startsWith('x')).filter(k=>!CHEMMAP.some(S=>S.units.some(u=>u.src.some(([gg,sel])=>gg===g&&pick(sel,B.Q[k].cat,B.Q[k].n))))).map(k=>B.Q[k].n);
   assert.deepEqual(inMap('kchem',KCHEM),[],'every kchem item is on the map');assert.deepEqual(inMap('kcalc',KCALC),[],'every kcalc item is on the map');
   // 名前で指定した項目は実在する（書き間違いが無い）
   const names=new Set(KCHEM.ALL.map(k=>KCHEM.Q[k].n));
   for(const S of CHEMMAP)for(const u of S.units)for(const [g,sel] of u.src)if(g==='kchem'&&sel&&sel.n)for(const n of sel.n)assert.ok(names.has(n),'map names an unknown item: '+n);
   console.log('chem map ok',CHEMMAP.reduce((a,S)=>a+S.units.length,0),'units');}
  // 京大数学：問題文＋ヒント2つ以上・選択肢に同じ値が2つ並ばない・だれも答えなくても制限時間内に全問出る
  assert.ok(KMATH.ALL.length>=120,'kmath has 120+ questions');
  for(const k of KMATH.ALL){const q=KMATH.Q[k];assert.ok(q.clues.length>=4&&/求めよ|何通りか|いくつあるか|何桁|を解け|で表せ/.test(q.clues[1]),k);
    for(let r=0;r<5;r++){const c=KMATH.choices(k,6);assert.ok(c.includes(k));assert.equal(new Set(c.map(x=>KMATH.Q[x].n)).size,c.length,k+' duplicate value in choices');}}
  for(const st of KMATH.STAGES){const S=createGame({g:'kmath',mode:'solo',stageId:st.id,players:[{id:'p0',name:'me'}]});begin(S);
    let guard=0;while(!S.over&&guard++<200000)tick(S,0.1);assert.equal(results(S).log.length,S.qz.total,'kmath '+st.id+' all questions asked before time runs out');}
  console.log('kmath ok',KMATH.ALL.length,'questions');
  // 特訓のルール：タイムアタックは時間で終わる／サバイバルは最初のまちがいで終わる／じっくりはヒントが最初から全部／今日の10問は決まった順
  {const P=[{id:'p0',name:'me'}],play=(cfg,act)=>{const S=createGame({g:'kmath',mode:'solo',stageId:'s1',players:P,...cfg});begin(S);let n=0;while(!S.over&&n++<400000){act(S);tick(S,0.1);}return S;};
   const ta=play({rule:'ta',drill:'t'},S=>{const q=S.qz.q;if(q&&q.state==='open'&&q.t>1)apply(S,'p0',{t:'ans',c:q.k});});
   assert.ok(ta.over&&Math.abs(ta.elapsed-150)<0.2&&results(ta).log.filter(l=>l.ok).length>=10,'time attack ends by time');
   const sv=play({rule:'surv',drill:'s'},S=>{const q=S.qz.q;if(q&&q.state==='open'&&q.t>1)apply(S,'p0',{t:'ans',c:S.qz.n<5?q.k:q.choices.find(c=>c!==q.k)});});
   assert.equal(results(sv).log.filter(l=>l.ok).length,4,'survival: 4 right then ends at the first miss');assert.equal(results(sv).log.length,5);
   const op=createGame({g:'kmath',mode:'solo',stageId:'s1',players:P,rule:'open'});begin(op);assert.equal(op.qz.q.shown,op.qz.q.clues.length,'open shows every hint');
   const ord=KMATH.ALL.slice(5,15),dl=play({rule:'daily',order:ord},S=>{});assert.deepEqual(results(dl).log.map(l=>l.k),ord,'daily asks the fixed 10 in order');
   const nr=play({},S=>{});assert.ok(!results(nr).drill&&results(nr).rule==='std','normal play unchanged');
   console.log('drill rules ok');}
  assert.ok(KCHEM.ALL.filter(k=>!k.startsWith('x')).length>=190,'kchem covers 190+ terms');
  for(const [g,B] of [['kphy',KPHY],['kchem',KCHEM],['kmath',KMATH]]){
    if(g!=='kmath')assert.equal(new Set(B.ALL.map(k=>B.Q[k].n)).size,B.ALL.length,g+' unique names');   // 数学は答えの値が重なってよい
    for(const k of B.ALL){assert.ok(B.Q[k].clues.length>=3,k);const c=B.choices(k,6);assert.ok(c.includes(k)&&c.length===6);}
    for(const st of [...B.STAGES.map(x=>x.id),'rv'])for(const mode of ['solo','coop','versus']){
      const S=createGame({g,mode,stageId:st,players:mode==='solo'?[{id:'p0',name:'me'}]:P2});begin(S);assert.equal(S.g,g);
      let guard=0;while(!S.over&&guard++<100000){const q=S.qz.q;if(q&&q.state==='open'&&Math.random()<0.02)apply(S,S.order[Math.floor(Math.random()*S.order.length)],{t:'ans',c:q.choices[Math.floor(Math.random()*q.choices.length)]});tick(S,0.1);}
      assert.ok(S.over&&results(S).log.length===S.qz.total,`${g}/${st}/${mode}`);
    }
    console.log(g,'ok',B.ALL.length,'questions');
  }
  return import('../js/kakomon.js');
}).then(({KAKO,autoFix,attachAnswers,pickAnswers})=>{
  // 自動の手直し：解答番号の無い区間は前の問につなぐ／正解は年度・科目（基礎でない方）が合う表から選ぶ
  const seg=(a,b)=>({from:{page:1,y:a},to:{page:1,y:b}});
  const its=[{subj:'phy',dai:1,q:1,slots:[1],seg:seg(0,10)},{subj:'phy',dai:1,q:2,slots:[],seg:seg(10,20)},{subj:'phy',dai:1,q:3,slots:[2,3],seg:seg(20,30)}];
  const fixed=autoFix(its);assert.equal(fixed.length,2);assert.deepEqual(fixed[0].seg,seg(0,20));
  const P={meta:{year:2024,subj:'phy'},items:fixed};
  const A=[{meta:{year:2024},secs:[{subj:'phy',base:true,count:3,map:{1:'9',2:'9',3:'9'}},{subj:'phy',base:false,count:3,map:{1:'3',2:'1',3:'4'}},{subj:'chem',base:false,count:3,map:{1:'2',2:'2',3:'2'}}]}];
  attachAnswers(fixed,pickAnswers(P,A));assert.deepEqual(fixed.map(x=>x.ans),['3','14']);
  const none=[{subj:'phy',dai:1,q:1,slots:[1],seg:seg(0,1)}];attachAnswers(none,{});assert.equal(none[0].on,false,'no answer -> not used');
  // 過去問早押し：端末に読み込んだ問題（ここでは架空の4問）。答えはマークの数字、解答番号2つの問は2桁
  const add=(k,subj,ans)=>{KAKO.Q[k]={k,n:k,cat:subj,subj,clues:Array(8).fill(''),ans,slots:ans.length};};
  add('2099-phy-1-1','phy','3');add('2099-phy-1-2','phy','52');add('2099-chem-1-1','chem','0');add('2099-chem-2-1','chem','4');
  KAKO.ALL=Object.keys(KAKO.Q);
  assert.deepEqual(KAKO.STAGES[0].pool,['2099-phy-1-1','2099-phy-1-2'],'pool follows loaded items');
  { const S=createGame({g:'kako',mode:'versus',stageId:'s3',players:P2,pool:['2099-phy-1-2']});begin(S);
    const q=S.qz.q;assert.equal(q.k,'2099-phy-1-2');
    apply(S,'p0',{t:'ans',c:'5'});assert.equal(q.state,'open','1 digit for 2 slots is ignored');
    apply(S,'p0',{t:'ans',c:'25'});assert.ok(q.locked.p0,'wrong order is wrong');
    apply(S,'p0',{t:'ans',c:'52'});assert.equal(q.state,'open','locked player cannot answer');
    apply(S,'p1',{t:'ans',c:'52'});assert.equal(q.state,'done');assert.equal(q.by,'p1');assert.ok(S.players.p1.score>0);
  }
  for(const st of ['s1','s2','s3','rv'])for(const mode of ['solo','coop','versus']){
    const S=createGame({g:'kako',mode,stageId:st,players:mode==='solo'?[{id:'p0',name:'me'}]:P2});begin(S);
    let guard=0;while(!S.over&&guard++<100000){const q=S.qz.q;if(q&&q.state==='open'&&Math.random()<0.02)apply(S,S.order[0],{t:'ans',c:Math.random()<0.5?KAKO.answer(q.k):'9'});tick(S,0.1);}
    assert.ok(S.over,`kako/${st}/${mode}`);
  }
  console.log('kako ok');
  console.log('QUIZ PASS');
});
