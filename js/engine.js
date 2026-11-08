// ゲームエンジン：状態(S)とアクションと時間経過だけを扱う。DOMには触らない。
// ソロ・協力・対戦すべて同じエンジンで動き、マルチプレイではホストだけが tick() を回す。
import {RXBY,CELLS,CELLCOL,SHELF_IDS,CATS,MENU,MCOST,TG,stepsOf,routeReagents,serves,judge,durOf,
  fmt,fOf,nameOf,STAGES,REVIEW,poolFor,cellLabel} from './chem.js';
import * as A from './atoms.js';
export const COLORS=['#ff7a45','#2fd6a3','#5ab0ff','#d39bff'];
export const FL='ABCDEFGH';
export const ROT_SEC=40;      // 協力：棚替えの間隔
export const REQ_LIFE=15;     // 協力：リクエストの寿命
export const WARN_SEC=3.5;    // 対戦：おじゃまが着弾するまでの猶予
export const STAMPS=['まかせて！','手伝って！','ナイス！','ごめん！','急いで！','あと少し！'];
export const FX_NAME=['','煙幕','在庫切れ','引火','大惨事'];
export const fxName=p=>FX_NAME[Math.min(4,Math.max(1,p))];

/* ---------- ルールセット：反応式モード(rx)／組成モード(atom) ---------- */
// 協力・対戦・通信の仕組みは共通で、棚・判定・得点だけをモードごとに切り替える
const AEL={};A.MAIN.forEach(r=>r.forEach((s,c)=>{if(s)AEL[s]=c;}));A.DROW.forEach((s,c)=>{AEL[s]=c;});
const has=(o,k)=>typeof k==='string'&&Object.prototype.hasOwnProperty.call(o,k);
export const costOf=k=>MCOST[k]||3;
export function orderLife(k,mode){
  const c=costOf(k),st=stepsOf(k);
  return Math.min(100,Math.max(30,22+5*c+(st-1)*8+(mode==='prop'?8:0)));
}
export const RULES={
  rx:{
    stages:STAGES,review:REVIEW,cells:CELLS,col:CELLCOL,pool:poolFor,
    valid:k=>typeof k==='string'&&(k[0]==='@'?CATS.includes(k.slice(1)):SHELF_IDS.has(k)),
    known:k=>has(MENU,k),
    tgt:k=>{const t=MENU[k].t;return {n:nameOf(t),f:fOf(t),proc:MENU[k].proc,group:t};},
    nclue:k=>(TG[MENU[k].t]||{p:[0]}).p.length,
    base:k=>8+4*costOf(k),life:orderLife,power:k=>Math.floor(costOf(k)/4),
    lockPool:k=>routeReagents(k),lockSkip:['H2O','O2'],lockFill:()=>[...SHELF_IDS],
    maxCoef:16,maxSpecies:6,label:cellLabel,dark:'停電！ 棚の位置で試薬を探せ',rot:'担当の試薬が入れ替わった',
  },
  atom:{
    stages:A.STAGES,review:A.REVIEW,cells:Object.keys(AEL),col:AEL,
    pool:st=>A.DB.filter(d=>st.pool==='review'||st.pool.includes(d.c)).map(d=>d.id),
    valid:k=>has(A.ZN,k),known:k=>has(A.BYID,k),
    tgt:k=>{const d=A.BYID[k];return {n:d.n,f:d.f,proc:null,group:d.k};},
    nclue:k=>A.BYID[k].p.length,
    base:k=>10+2*A.BYID[k].atoms,
    life:(k,m)=>Math.min(80,Math.max(28,26+A.BYID[k].atoms*1.6+(m==='prop'?8:0))),
    power:k=>Math.floor(A.BYID[k].atoms/6),
    lockPool:k=>Object.keys(A.BYID[k].m),lockSkip:['H','O','C'],lockFill:()=>['N','S','Cl','Na','K','Ca'],
    maxCoef:40,maxSpecies:12,label:k=>k,dark:'停電！ 位置で元素を探せ',rot:'担当の元素が入れ替わった',
  },
};
export const GAMES={rx:'反応式モード',atom:'組成モード'};
export const RU=S=>RULES[S.g]||RULES.rx;
export function stageById(g,id){const R=RULES[g]||RULES.rx;return id==='rv'?R.review:(R.stages.find(s=>s.id===id)||R.stages[0]);}
export const cellsOf=g=>(RULES[g]||RULES.rx).cells;

/* ---------- 協力：棚の分担 ---------- */
// 棚の列ごとに担当を割り振る。担当外は担当者にリクエストして入れてもらう
export function shelfOwners(g,active,rot){
  const own={},n=active.length,R=RULES[g]||RULES.rx;if(!n)return own;
  for(const k of R.cells)own[k]=active[(R.col[k]+rot)%n];
  return own;
}
const OWN_CACHE={key:'',own:null};
export function owners(S){
  if(!S.split)return null;
  const act=S.order.filter(p=>!S.players[p].left);
  if(act.length<2)return null;
  const key=S.g+'|'+S.rot+'|'+act.join(',');
  if(OWN_CACHE.key!==key){OWN_CACHE.key=key;OWN_CACHE.own=shelfOwners(S.g,act,S.rot);}
  return OWN_CACHE.own;
}

/* ---------- 生成 ---------- */
const blank=()=>({items:[],cat:null,heat:0,state:'idle',t:0,dur:0,res:null,prod:null,fail:null,taps:0,burn:0,warned:false,by:{}});
function newFlask(id,owner,idx){return Object.assign({id,owner,idx},blank());}
function resetFlask(f){Object.assign(f,blank());}
// cfg: {g:'rx'|'atom', mode:'solo'|'coop'|'versus', stageId, players:[{id,name,slot}], split, coef, weights:{key:box}, pool:[key]}
export function createGame(cfg){
  const g=cfg.g==='atom'?'atom':'rx',R=RULES[g];
  const st=stageById(g,cfg.stageId);
  const mode=cfg.mode,pids=cfg.players.map(p=>p.id),n=pids.length;
  const coop=mode==='coop',vs=mode==='versus';
  const split=coop&&n>1&&cfg.split!==false;
  const S={
    g,mode,stageId:st.id,n,t:st.time,total:st.time,elapsed:0,spawnT:0,
    running:false,paused:false,pausedBy:null,over:false,
    max:mode==='solo'?st.max:Math.min(6,st.max+Math.max(0,n-2)),
    spawn:st.spawn/(1+(coop?0.45:vs?0.5:0)*(n-1)),
    life:st.life*(split?1.12:1),
    clue:st.clue,vip:!!st.vip,blackout:!!st.blackout,stockout:!!st.stockout,spread:!!st.spread,
    coef:g==='rx'&&!!(st.coef||cfg.coef),fb:st.fb??1,
    stars:st.stars?st.stars.map(x=>Math.round(x*(coop?1+0.55*(n-1):1)/10)*10):null,
    order:pids,players:{},orders:[],flasks:[],reqs:[],
    team:{score:0,combo:0,maxCombo:0,served:0,failed:0},
    bo:{next:24,until:0,on:false},so:{next:18,until:0,on:false,locked:[]},rush:false,
    split,rot:0,rotNext:ROT_SEC,
    uid:0,ev:[],log:[],
    pool:(cfg.pool&&cfg.pool.length?cfg.pool:R.pool(st)).filter(R.known),
    w:cfg.weights||{},rv:st.pool==='review'
  };
  if(!S.pool.length)S.pool=R.pool(R.stages[0]);
  cfg.players.forEach((p,i)=>{
    S.players[p.id]={id:p.id,name:String(p.name||'ケミスト').slice(0,10),slot:p.slot??i,
      score:0,combo:0,maxCombo:0,served:0,failed:0,pts:0,atoms:0,hints:0,
      sent:0,recv:0,offset:0,inc:[],fx:{dark:0,lock:{}},focus:null,left:false,stampAt:0};
  });
  if(vs)pids.forEach(pid=>{for(let i=0;i<st.flasks;i++)S.flasks.push(newFlask(++S.uid,pid,i));});
  else{
    const nf=coop?Math.min(4,st.flasks+n-1):st.flasks;
    for(let i=0;i<nf;i++)S.flasks.push(newFlask(++S.uid,mode==='solo'?pids[0]:null,i));
  }
  return S;
}

export function begin(S){S.running=true;spawnOrder(S);spawnOrder(S);}

function emit(S,to,e){S.ev.push(Object.assign({to},e));}
function emitFlask(S,f,e){emit(S,f.owner==null?'*':f.owner,e);}
const flaskById=(S,id)=>S.flasks.find(f=>f.id===id);
export const canUse=(S,f,pid)=>f.owner==null||f.owner===pid;
export function isLocked(S,pid,k){
  if(S.so.on&&S.so.locked.includes(k))return true;
  const P=S.players[pid];return !!(P&&P.fx.lock[k]>S.elapsed);
}
export function isDark(S,pid){const P=S.players[pid];return S.bo.on||!!(P&&P.fx.dark>S.elapsed);}
export const hintsOf=(S,o,pid)=>S.mode==='versus'?(o.ph[pid]||0):o.hints;

/* ---------- 注文 ---------- */
function pickMenu(S){
  const R=RU(S),onBoard=new Set(S.orders.map(o=>R.tgt(o.k).group));
  let cand=S.pool.filter(k=>!onBoard.has(R.tgt(k).group));
  if(!cand.length)cand=S.pool.slice();
  const ws=cand.map(k=>{const b=S.w[k]||0;return S.rv?Math.pow(6-b,2):1+(5-b)*1.2;});
  let r=Math.random()*ws.reduce((a,b)=>a+b,0);
  for(let i=0;i<cand.length;i++){r-=ws[i];if(r<=0)return cand[i];}
  return cand[cand.length-1];
}
function spawnOrder(S){
  if(S.orders.length>=S.max||!S.pool.length)return;
  const R=RU(S),k=pickMenu(S);
  let mode=S.clue;if(mode==='mix')mode=Math.random()<0.5?'prop':'name';
  const vip=S.vip&&S.elapsed>20&&Math.random()<0.18;
  const life=R.life(k,mode)*S.life*(vip?0.65:1);
  const nclue=R.nclue(k)||1;
  S.orders.push({id:++S.uid,k,mode,ci:Math.floor(Math.random()*nclue),total:life,left:life,vip,hints:0,ph:{},ban:{},claim:null});
  S.spawnT=0;
  emit(S,'*',{s:'pop',m:[k,'seen']});
}

/* ---------- 時間経過（ホストのみ） ---------- */
export function tick(S,dt){
  if(!S.running||S.paused||S.over)return;
  S.t-=dt;S.elapsed+=dt;S.spawnT+=dt;
  const vs=S.mode==='versus';
  if(!S.rush&&S.t<=30){S.rush=true;emit(S,'*',{h:'ラッシュタイム！',k:'ev',s:'event'});}
  const interval=S.spawn*(S.rush?0.6:1);
  if(S.orders.length===0||(S.spawnT>=interval&&S.orders.length<S.max))spawnOrder(S);
  // 注文の時間切れ
  for(let i=S.orders.length-1;i>=0;i--){
    const o=S.orders[i];o.left-=dt;
    if(o.left>0)continue;
    S.orders.splice(i,1);const T=RU(S).tgt(o.k);
    const tail=`<small>${T.n} = ${fmt(T.f)}</small>`;
    if(vs)emit(S,'*',{h:`時間切れ${tail}`,k:'ng',s:'expire',m:[o.k,'exp']});
    else{
      S.team.score=Math.max(0,S.team.score-10);S.team.combo=0;S.team.failed++;
      emit(S,'*',{h:`時間切れ −10${tail}`,k:'ng',s:'expire',m:[o.k,'exp']});
    }
    S.log.push({k:o.k,ok:false,why:'時間切れ',ci:o.ci,mode:o.mode,by:null});
  }
  // フラスコ
  S.flasks.forEach(f=>{
    if(f.state==='heat'){f.t+=dt;if(f.t>=f.dur)finishReaction(S,f);}
    else if(f.state==='ready'){f.t+=dt;if(f.t>=7)f.warned=true;if(f.t>=11)ignite(S,f);}
    else if(f.state==='fire'){
      f.burn+=dt;
      if(S.spread&&f.burn>=6){
        f.burn=0;
        S.flasks.filter(g=>g.owner===f.owner&&Math.abs(g.idx-f.idx)===1&&g.state!=='fire').forEach(g=>ignite(S,g));
      }
    }
  });
  // 停電（全員）：棚のラベルが消える
  if(S.blackout){
    if(S.elapsed>=S.bo.next&&!S.bo.on){S.bo.on=true;S.bo.until=S.elapsed+7;S.bo.next=S.elapsed+30;emit(S,'*',{h:RU(S).dark,k:'ev',s:'event'});}
    if(S.bo.on&&S.elapsed>=S.bo.until)S.bo.on=false;
  }
  // 在庫切れ（全員）
  if(S.stockout){
    if(S.elapsed>=S.so.next&&!S.so.on){
      S.so.locked=pickLocks(S,3);S.so.on=true;S.so.until=S.elapsed+9;S.so.next=S.elapsed+24;
      emit(S,'*',{h:`在庫切れ：${S.so.locked.map(RU(S).label).map(fmt).join('・')}${S.g==='rx'?'<small>別のルートで作れ</small>':''}`,k:'ev',s:'event'});
    }
    if(S.so.on&&S.elapsed>=S.so.until){S.so.on=false;S.so.locked=[];}
  }
  // 協力：棚替え・リクエスト整理
  if(S.split){
    if(S.elapsed>=S.rotNext){
      S.rot++;S.rotNext+=ROT_SEC;S.reqs=[];
      emit(S,'*',{h:`棚替え！<small>${RU(S).rot}</small>`,k:'ev',s:'event'});
    }
    S.reqs=S.reqs.filter(r=>{const f=flaskById(S,r.f);const T=S.players[r.to];return S.elapsed-r.t<REQ_LIFE&&f&&f.state==='idle'&&T&&!T.left;});
  }
  // 対戦：おじゃまの着弾
  if(vs){
    for(const id of S.order){
      const P=S.players[id];if(!P.inc.length)continue;
      P.inc.forEach(x=>x.t-=dt);
      const due=P.inc.filter(x=>x.t<=0);P.inc=P.inc.filter(x=>x.t>0);
      if(!P.left)due.forEach(x=>applyAttack(S,id,x));
      for(const s in P.fx.lock)if(P.fx.lock[s]<=S.elapsed)delete P.fx.lock[s];
    }
  }
  if(S.t<=0){S.t=0;S.running=false;S.over=true;}
}
function pickLocks(S,k){
  const R=RU(S),need=new Set();S.orders.forEach(o=>R.lockPool(o.k).forEach(c=>need.add(c)));
  R.lockSkip.forEach(s=>need.delete(s));
  let c=[...need];
  if(c.length<k)c=c.concat(R.lockFill().filter(s=>!need.has(s)&&!R.lockSkip.includes(s)).sort(()=>Math.random()-0.5).slice(0,k));
  c.sort(()=>Math.random()-0.5);return c.slice(0,k);
}
function failText(S,res){return res.lv<=S.fb?res.why:'反応しない';}
function finishReaction(S,f){
  f.t=0;f.warned=false;
  if(S.g==='atom'){
    // 組成モード：分子式（組成式）がレシピにあれば完成
    const m=(f.res&&f.res.comp)||{},k=A.keyOf(m),hits=A.BYKEY[k];
    if(!hits){f.state='fail';f.fail={why:`${A.hill(m)} はレシピに無い`,label:A.hill(m)};emitFlask(S,f,{s:'fail'});return;}
    const want=S.orders.find(o=>A.BYID[o.k]&&A.BYID[o.k].k===k);
    const d=want?A.BYID[want.k]:hits[0];
    f.state='ready';f.prod={k,id:d.id,label:hits.length===1?d.f:A.hill(m),over:[]};
    emitFlask(S,f,{s:'ready'});return;
  }
  const res=f.res||{ok:false,why:'反応しない',lv:1};
  if(!res.ok){
    f.state='fail';f.fail={why:failText(S,res)};
    emitFlask(S,f,{h:`フラスコ${FL[f.idx]}：反応しない<small>${S.fb?f.fail.why:'条件か試薬が違う'}</small>`,k:'ng',s:'fail'});
    return;
  }
  const x=RXBY[res.rx];
  f.state='ready';f.prod={rx:x.id,main:x.main,over:res.over||[]};
  emitFlask(S,f,{s:'ready'});
}
function ignite(S,f){
  resetFlask(f);f.state='fire';
  emitFlask(S,f,{h:`フラスコ${FL[f.idx]}が燃えた！ 連打で消火`,k:'ng',s:'fire'});
}

/* ---------- 対戦：おじゃま ---------- */
export function attackPower(S,k,vip,combo,rush){return 1+RU(S).power(k)+(vip?1:0)+(combo>=4?1:0)+(rush?1:0);}
function sendAttack(S,P,pow){
  let off=0;
  while(pow>0&&P.inc.length){const x=P.inc[0],c=Math.min(pow,x.pow);x.pow-=c;pow-=c;off+=c;if(x.pow<=0)P.inc.shift();}
  if(off){P.offset+=off;emit(S,P.id,{h:`相殺！ おじゃま −${off}`,k:'ok',s:'block'});}
  if(pow<=0)return;
  const ts=S.order.filter(q=>q!==P.id&&!S.players[q].left).map(q=>S.players[q]);
  if(!ts.length)return;
  ts.sort((a,b)=>b.score-a.score||a.slot-b.slot);
  const T=ts[0];P.sent+=pow;
  const ex=T.inc.find(x=>x.t>1);
  if(ex){ex.pow+=pow;ex.from=P.id;}else T.inc.push({id:++S.uid,pow,from:P.id,t:WARN_SEC});
  const tot=T.inc.reduce((a,x)=>a+x.pow,0);
  emit(S,T.id,{s:'warn'});
  emit(S,P.id,{h:`おじゃま${pow}（${fxName(tot)}）→ <b>${T.name}</b>`,k:'ok',s:'atk'});
}
function applyAttack(S,pid,x){
  const T=S.players[pid],A=S.players[x.from],pow=x.pow,fx=[];
  if(pow<=0)return;
  T.recv+=pow;
  if(pow>=3){
    const rank=f=>f.state==='ready'?3:f.state==='heat'?2:f.items.length?1:0;
    const fl=S.flasks.filter(f=>f.owner===pid&&f.state!=='fire').sort((a,b)=>rank(b)-rank(a));
    if(fl.length){ignite(S,fl[0]);fx.push('引火');}
  }
  if(pow===2||pow>=4){pickLocks(S,3).forEach(s=>T.fx.lock[s]=S.elapsed+7);fx.push('在庫切れ');}
  if(pow===1||pow>=4){T.fx.dark=S.elapsed+(pow>=4?3:4.5);fx.push('煙幕');}
  if(!fx.length)fx.push('不発');
  emit(S,pid,{h:`💥 ${fx.join('＋')}！<small>${A?A.name:'?'} の攻撃</small>`,k:'ng',s:'hit'});
  if(A)emit(S,A.id,{h:`命中：${fx.join('＋')} → <b>${T.name}</b>`,k:'ok',s:'atk'});
}

/* ---------- アクション ---------- */
function putIn(S,f,k,pid){
  const R=RU(S);
  if(k[0]==='@'){const c=k.slice(1);f.cat=f.cat===c?null:c;if(f.cat)f.by[pid]=(f.by[pid]||0)+1;return true;}
  const x=f.items.find(y=>y[0]===k);
  if(x){if(x[2]||x[1]>=R.maxCoef)return false;x[1]++;}
  else{if(f.items.length>=R.maxSpecies)return false;f.items.push([k,1,0]);}
  f.by[pid]=(f.by[pid]||0)+1;
  return true;
}
const ACT={
  add(S,pid,P,a){
    const k=a.s;if(!RU(S).valid(k))return;
    if(isLocked(S,pid,k)){emit(S,pid,{h:`${fmt(RU(S).label(k))} は在庫切れ`,k:'ng',s:'lock'});return;}
    const own=owners(S);
    if(own&&own[k]!==pid){
      // 自分の担当外 → 担当者にリクエスト
      const f=flaskById(S,a.f);
      if(!f||f.state!=='idle'||!canUse(S,f,pid)){emit(S,pid,{h:'空いているフラスコを選んでから頼もう',k:'ng',s:'lock'});return;}
      if(S.reqs.filter(r=>r.from===pid).length>=8){emit(S,pid,{h:'リクエストは8個まで',k:'ng',s:'lock'});return;}
      S.reqs.push({id:++S.uid,from:pid,to:own[k],s:k,f:f.id,t:S.elapsed});
      emit(S,own[k],{s:'req'});
      return;
    }
    let f=null,rq=null;
    if(S.reqs.length){
      rq=S.reqs.find(r=>{if(r.to!==pid||r.s!==k)return false;const g=flaskById(S,r.f);return g&&g.state==='idle';})||null;
      if(rq)f=flaskById(S,rq.f);
    }
    if(!f){
      f=flaskById(S,a.f);
      if(!f||!canUse(S,f,pid)||f.state!=='idle')f=S.flasks.find(x=>x.owner===pid&&x.state==='idle')||null;
    }
    if(!f){emit(S,pid,{h:'空いているフラスコがない',k:'ng',s:'lock'});return;}
    if(!putIn(S,f,k,pid))return;
    P.atoms++;
    if(rq){S.reqs.splice(S.reqs.indexOf(rq),1);emit(S,rq.from,{s:'gift'});}
  },
  chip(S,pid,P,a){
    const f=flaskById(S,a.f);if(!f||!canUse(S,f,pid)||f.state!=='idle')return;
    if(a.s==='@'){f.cat=null;return;}
    const x=f.items.find(y=>y[0]===a.s);if(!x)return;
    x[1]--;if(x[1]<=0||x[2])f.items=f.items.filter(y=>y!==x);
  },
  heat(S,pid,P,a){
    if(S.g!=='rx')return;
    const f=flaskById(S,a.f);if(!f||!canUse(S,f,pid)||f.state!=='idle')return;
    const h=a.h|0;if(h<0||h>2)return;f.heat=h;
  },
  react(S,pid,P,a){
    const f=flaskById(S,a.f);if(!f||!canUse(S,f,pid)||f.state!=='idle'||!f.items.length)return;
    if(S.g==='atom'){
      const m={};f.items.forEach(([s,c])=>m[s]=c);
      f.res={comp:m};f.dur=0.9+0.05*A.atomCount(m);
    }else{f.res=judge(f.items,f.cat,f.heat,S.coef);f.dur=durOf(f.items,f.heat,f.cat);}
    f.state='heat';f.t=0;
  },
  pour(S,pid,P,a){
    if(S.g!=='rx')return;
    const from=flaskById(S,a.f),to=flaskById(S,a.to);
    if(!from||!to||from===to||!canUse(S,from,pid)||!canUse(S,to,pid)||from.state!=='ready'||to.state!=='idle')return;
    const m=from.prod.main;
    if(!to.items.some(y=>y[0]===m)){if(to.items.length>=RU(S).maxSpecies)return;to.items.push([m,1,1]);}
    for(const q in from.by)to.by[q]=(to.by[q]||0)+from.by[q];
    resetFlask(from);
  },
  dump(S,pid,P,a){
    const f=flaskById(S,a.f);if(!f||!canUse(S,f,pid)||f.state==='fire'||f.state==='heat')return;
    resetFlask(f);
  },
  ext(S,pid,P,a){
    const f=flaskById(S,a.f);if(!f||!canUse(S,f,pid)||f.state!=='fire')return;
    f.taps++;
    if(f.taps>=4){resetFlask(f);emitFlask(S,f,{h:'消火した',k:'ok'});}
  },
  hint(S,pid,P,a){
    const o=S.orders.find(x=>x.id===a.o);if(!o)return;
    if(S.mode==='versus'){if((o.ph[pid]||0)<2){o.ph[pid]=(o.ph[pid]||0)+1;P.hints++;}}
    else if(o.hints<2){o.hints++;P.hints++;}
  },
  claim(S,pid,P,a){
    if(S.mode!=='coop')return;
    const o=S.orders.find(x=>x.id===a.o);if(!o)return;
    o.claim=o.claim===pid?null:pid;
  },
  focus(S,pid,P,a){if(S.mode==='coop'&&flaskById(S,a.f))P.focus=a.f;},
  serve(S,pid,P,a){
    const f=flaskById(S,a.f);if(!f||!canUse(S,f,pid)||f.state!=='ready')return;
    const o=S.orders.find(x=>x.id===a.o);
    if(!o){emit(S,pid,{h:'その注文はもう無い',k:'ng',s:'lock'});return;}
    const vs=S.mode==='versus';
    if(vs&&o.ban[pid]){emit(S,pid,{h:'この注文には一度誤配したので出せない',k:'ng',s:'lock'});return;}
    const R=RU(S),T=R.tgt(o.k),p=f.prod,C=vs?P:S.team;
    const contrib=Object.keys(f.by);
    const tail=`<small>${fmt(T.f)} ${T.n}${T.proc?`（${T.proc}）`:''}</small>`;
    const ok=S.g==='atom'?(A.BYID[o.k]&&p.k===A.BYID[o.k].k):serves(o.k,p.rx);
    if(ok){
      const hints=hintsOf(S,o,pid),over=p.over.length>0;
      const base=R.base(o.k),ratio=Math.max(0,o.left/o.total);
      const mult=Math.min(4,1+C.combo),tip=Math.round(base*0.8*ratio);
      // 協力：2人以上が入れたフラスコは連携ボーナス×1.2
      const team=S.mode==='coop'&&contrib.length>=2;
      const pts=Math.round((base+tip*mult)*(1-0.35*hints)*(o.vip?2:1)*(team?1.2:1)*(over?0.7:1));
      C.score+=pts;C.combo++;C.maxCombo=Math.max(C.maxCombo,C.combo);C.served++;
      if(!vs){P.served++;P.pts+=pts;}
      S.orders.splice(S.orders.indexOf(o),1);resetFlask(f);
      S.log.push({k:o.k,ok:true,hinted:hints>0,over:p.over,rx:p.rx||null,ci:o.ci,mode:o.mode,by:pid});
      const mk=hints||over?'okh':'ok';
      (S.mode==='coop'?[...new Set([pid,...contrib])]:[pid]).forEach(q=>emit(S,q,{m:[o.k,mk]}));
      const extra=(team?' 連携！':'')+(over?`（${p.over.join('・')}：×0.7）`:'');
      emit(S,pid,{h:`+${pts}${mult>1?`（チップ×${mult}）`:''}${extra}${tail}`,k:'ok',s:'ok'});
      S.order.filter(q=>q!==pid).forEach(q=>emit(S,q,vs?{h:`<b>${P.name}</b> に取られた +${pts}${tail}`,k:'ng',s:'snipe'}:{h:`<b>${P.name}</b> +${pts}${mult>1?`（×${mult}）`:''}${extra}${tail}`,k:'ok',s:'ok'}));
      if(vs)sendAttack(S,P,attackPower(S,o.k,o.vip,P.combo,S.rush));
    }else{
      C.score=Math.max(0,C.score-10);C.combo=0;C.failed++;
      if(!vs)P.failed++;
      resetFlask(f);
      if(vs)o.ban[pid]=true;else S.orders.splice(S.orders.indexOf(o),1);
      S.log.push({k:o.k,ok:false,why:'誤配',given:S.g==='atom'?p.label:p.rx,ci:o.ci,mode:o.mode,by:pid});
      const who=S.mode==='coop'?[...new Set([pid,...contrib])]:[pid];
      who.forEach(q=>emit(S,q,{m:[o.k,'ng']}));
      const gv=p.rx&&RXBY[p.rx],it=MENU[o.k];
      const wrong=S.g==='rx'&&it.via&&gv&&gv.main===it.t?`製法が違う（${it.proc}で作る）`:`正解：${T.n} = ${fmt(T.f)}`;
      emit(S,pid,{h:`ちがう！ −10<small>${wrong}${vs?'（この注文には出禁）':''}</small>`,k:'ng',s:'ng'});
      if(S.mode==='coop')S.order.filter(q=>q!==pid).forEach(q=>emit(S,q,{h:`<b>${P.name}</b> が誤配 −10<small>${wrong}</small>`,k:'ng',s:'ng'}));
    }
  },
};

export function apply(S,pid,a){
  const P=S.players[pid];
  if(!P||P.left||!a||typeof a!=='object'||typeof a.t!=='string')return;
  if(a.t==='pause'){if(S.running&&!S.paused&&!S.over){S.paused=true;S.pausedBy=pid;}return;}
  if(a.t==='resume'){if(S.paused){S.paused=false;S.pausedBy=null;}return;}
  if(a.t==='stamp'){
    const k=a.k|0,now=Date.now();
    if(k<0||k>=STAMPS.length||now-P.stampAt<900)return;
    P.stampAt=now;emit(S,'*',{h:`<b>${P.name}</b>「${STAMPS[k]}」`,k:'st',c:P.slot,s:'stamp'});
    return;
  }
  if(!S.running||S.paused||S.over)return;
  if(Object.prototype.hasOwnProperty.call(ACT,a.t))ACT[a.t](S,pid,P,a);
}

export function playerLeft(S,pid){
  const P=S.players[pid];if(!P||P.left)return;
  P.left=true;P.inc=[];
  S.reqs=S.reqs.filter(r=>r.from!==pid&&r.to!==pid);
  S.orders.forEach(o=>{if(o.claim===pid)o.claim=null;});
  emit(S,'*',{h:`<b>${P.name}</b> が退出した`,k:'ng',s:'lock'});
}

/* ---------- 通信用 ---------- */
// 判定結果(res)はホストだけが持てばよいが、予測用にクライアントにも送る
export function snapshot(S){
  const o={};
  for(const k in S)if(k!=='ev'&&k!=='log'&&k!=='pool'&&k!=='w')o[k]=S[k];
  return o;
}
// クライアント側の見た目用の時間補間（状態遷移は起こさない）
export function advance(V,dt){
  if(!V.running||V.paused||V.over)return;
  V.t=Math.max(0,V.t-dt);V.elapsed+=dt;
  V.orders.forEach(o=>{o.left=Math.max(0,o.left-dt);});
  V.flasks.forEach(f=>{if(f.state==='heat')f.t=Math.min(f.dur,f.t+dt);else if(f.state==='ready')f.t+=dt;});
  if(V.mode==='versus')for(const id in V.players)V.players[id].inc.forEach(x=>{x.t=Math.max(0,x.t-dt);});
}
export function results(S){
  return {
    g:S.g,mode:S.mode,stageId:S.stageId,n:S.n,stars:S.stars,team:S.team,coef:S.coef,
    players:S.order.map(id=>{const P=S.players[id];return {id,name:P.name,slot:P.slot,score:P.score,served:P.served,failed:P.failed,
      maxCombo:P.maxCombo,atoms:P.atoms,sent:P.sent,recv:P.recv,offset:P.offset,pts:P.pts,hints:P.hints,left:P.left};}),
    log:S.log
  };
}
