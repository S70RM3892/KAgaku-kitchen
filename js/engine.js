// ゲームエンジン：状態(S)とアクションと時間経過だけを扱う。DOMには触らない。
// ソロ・協力・対戦すべて同じエンジンで動き、マルチプレイではホストだけが tick() を回す。
import {RXBY,CELLS,CELLCOL,SHELF_IDS,CATS,MENU,MCOST,TG,stepsOf,routeReagents,serves,judge,durOf,usefulFor,
  fmt,fOf,nameOf,STAGES,REVIEW,poolFor,cellLabel} from './chem.js';
import * as A from './atoms.js';
import * as O from './org.js';
export const COLORS=['#ff7a45','#2fd6a3','#5ab0ff','#d39bff'];
export const ROT_SEC=40;      // 協力：棚替えの間隔
export const REQ_LIFE=15;     // 協力：リクエストの寿命
export const WARN_SEC=3.5;    // 対戦：おじゃまが着弾するまでの猶予
export const STAMPS=['まかせて！','手伝って！','ナイス！','ごめん！','急いで！','あと少し！'];
export const FX_NAME=['','煙幕','在庫切れ','引火','大惨事'];
export const fxName=p=>FX_NAME[Math.min(4,Math.max(1,p))];

/* ---------- ルールセット：反応式モード(rx)／組成モード(atom)／官能基モード(org) ---------- */
// 協力・対戦・通信の仕組みは共通で、棚・判定・得点だけをモードごとに切り替える
// 組成モードの棚は本物の周期表（18族）。協力の担当は族ごと（2人なら奇数族と偶数族）
const AEL={};A.PT.forEach(e=>{AEL[e.s]=e.g-1;});
// 官能基モードの棚：骨格（左）・官能基（右）・検出試薬（最下段）。協力の担当は2人なら「骨格」と「官能基」に分かれる
const OCELLS=[...O.SK,...O.FG,...O.TIDS.map(t=>'@'+t)],OCOL={};
O.SK.forEach((k,i)=>OCOL[k]=(i%2)*2);O.FG.forEach((k,i)=>OCOL[k]=1+(i%2)*2);O.TIDS.forEach((t,i)=>OCOL['@'+t]=i%4);
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
    maxCoef:40,maxSpecies:12,label:k=>k,dark:'停電！ 周期表の位置で元素を探せ',rot:'担当の族が入れ替わった',
  },
  org:{
    stages:O.STAGES,review:O.REVIEW,cells:OCELLS,col:OCOL,
    pool:st=>st.pool==='review'?O.ALL.slice():st.pool.slice(),
    valid:k=>typeof k==='string'&&(k[0]==='@'?has(O.TEST,k.slice(1)):has(O.PART,k)),
    known:O.known,tgt:O.tgt,
    nclue:k=>O.isPair(k)?1:O.BYID[k].p.length,
    base:k=>O.isPair(k)?10+2*O.PAIR[k].lv:6+3*O.BYID[k].np+2*(O.BYID[k].lv-1),
    life:(k,m)=>O.isPair(k)?32:Math.min(70,Math.max(30,24+5*O.BYID[k].np+(m==='prop'?10:0))),
    power:k=>O.isPair(k)?Math.floor(O.PAIR[k].lv/3):Math.floor((O.BYID[k].np+O.BYID[k].lv)/4),
    lockPool:k=>O.isPair(k)?[]:Object.keys(O.BYID[k].parts),lockSkip:[],lockFill:()=>O.PARTS.map(p=>p.id),
    maxCoef:3,maxSpecies:6,label:O.label,dark:'停電！ 棚の位置で部品を探せ',rot:'担当の部品が入れ替わった',
    // 官能基モードだけが使うフック（他のモードには無いので従来どおり動く）
    accept:(o,k)=>O.accept(o.k,k),                       // この注文に入れられる物か（理由の文字列を返すと拒否）
    would:(S,o,p)=>O.exact(o.k,p.items),                 // 自動精製：部品がちょうどそろった
    instant:(S,o,p)=>O.isPair(o.k)&&!!p.cat,             // 見分けの注文は試薬を選んだ瞬間に判定（総当たり防止）
    start:(S,o,p)=>{
      if(O.isPair(o.k)){p.res={pair:O.judgePair(o.k,p.cat)};p.dur=0.8;}
      else{p.res={build:O.judgeBuild(o.k,p.items)};p.dur=0.5+0.12*p.items.reduce((a,x)=>a+x[1],0);}
    },
    finish:(S,o,key,p)=>finishOrg(S,o,key,p),
    tail:(k,note)=>O.isPair(k)?`<small>${note||'正解：'+O.answerText(k)}</small>`:null,
  },
};
export const GAMES={rx:'反応式モード',atom:'組成モード',org:'官能基モード'};
// 忙しさ：注文の出る間隔・同時に並ぶ数・制限時間を変える。5（無限オーダー）は伝票が空いたらすぐ次が来る
export const BUSY=[null,
  {name:'ひま',desc:'注文はゆっくり。じっくり覚える（得点×0.8）',spawn:1.6,max:-1,life:1.3,pts:0.8,exp:10,star:0.85},
  {name:'ふつう',desc:'標準の忙しさ',spawn:1,max:0,life:1,pts:1,exp:10,star:1},
  {name:'いそがしい',desc:'注文が速く1枚多く並ぶ（得点×1.15）',spawn:0.7,max:1,life:1,pts:1.15,exp:10,star:1},
  {name:'てんてこまい',desc:'注文がかなり速く2枚多く並ぶ（得点×1.3）',spawn:0.5,max:2,life:0.95,pts:1.3,exp:10,star:0.9},
  {name:'無限オーダー',desc:'伝票が空いた瞬間に次の注文が来て常に満席。時間切れは−5でコンボは切れない（得点×1.5）',spawn:0,max:2,life:0.95,pts:1.5,exp:5,keep:true,star:0.75,refill:true},
];
export const busyOf=b=>BUSY[Math.min(5,Math.max(1,b|0))]||BUSY[2];
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
// 客（注文）ごとに鍋を持つ。協力・ソロは客ごとに1つの鍋を全員で使い、中身は「誰が入れたか」を記録して人ごとに分けて見せる
// （精錬は全員分を合わせて判定）。対戦は客ごと×プレイヤーごとに別々の鍋
const blankPot=()=>({items:[],cat:null,catBy:null,heat:0,state:'idle',t:0,dur:0,res:null,fail:null,mid:null,taps:0,burn:0,by:{},rb:null});
const potKey=(S,pid)=>S.mode==='versus'?pid:'*';
export function potOf(S,o,pid){const k=potKey(S,pid);return o.pots[k]||(o.pots[k]=blankPot());}
export const peekPot=(S,o,pid)=>o&&o.pots[potKey(S,pid)]||null;
function resetPot(p){Object.assign(p,blankPot());}
const orderById=(S,id)=>S.orders.find(o=>o.id===id);

// cfg: {g:'rx'|'atom', mode:'solo'|'coop'|'versus', stageId, players:[{id,name,slot}], split, coef, busy, weights:{key:box}, pool:[key]}
export function createGame(cfg){
  const g=has(RULES,cfg.g)?cfg.g:'rx',R=RULES[g];
  const busy=Math.min(5,Math.max(1,(cfg.busy|0)||2)),B=BUSY[busy];
  const st=stageById(g,cfg.stageId);
  const mode=cfg.mode,pids=cfg.players.map(p=>p.id),n=pids.length;
  const coop=mode==='coop',vs=mode==='versus';
  const split=coop&&n>1&&cfg.split!==false;
  const S={
    g,busy,refill:!!B.refill,bpts:B.pts,bexp:B.exp,bkeep:!!B.keep,mode,stageId:st.id,n,t:st.time,total:st.time,elapsed:0,spawnT:0,
    running:false,paused:false,pausedBy:null,over:false,
    max:Math.min(6,Math.max(2,(mode==='solo'?st.max:st.max+Math.max(0,n-2))+B.max)),
    spawn:st.spawn/(1+(coop?0.45:vs?0.5:0)*(n-1))*B.spawn,
    life:st.life*(split?1.12:1)*B.life,
    clue:st.clue,vip:!!st.vip,blackout:!!st.blackout,stockout:!!st.stockout,spread:!!st.spread,
    coef:g==='rx'&&!!(st.coef||cfg.coef),fb:st.fb??1,auto:!!cfg.auto,
    stars:st.stars?st.stars.map(x=>Math.round(x*(coop?1+0.55*(n-1):1)*B.star/10)*10):null,
    order:pids,players:{},orders:[],reqs:[],
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
  return S;
}

export function begin(S){S.running=true;spawnOrder(S);spawnOrder(S);}

function emit(S,to,e){S.ev.push(Object.assign({to},e));}
// 鍋に関わる人へ（共有鍋なら全員、対戦なら持ち主）
function emitPot(S,key,e){emit(S,key==='*'?'*':key,e);}
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
  S.orders.push({id:++S.uid,k,mode,ci:Math.floor(Math.random()*nclue),total:life,left:life,vip,hints:0,ph:{},pots:{}});
  S.spawnT=0;
  emit(S,'*',{s:'pop',m:[k,'seen']});
}
function removeOrder(S,o){const i=S.orders.indexOf(o);if(i>=0)S.orders.splice(i,1);S.reqs=S.reqs.filter(r=>r.o!==o.id);}

/* ---------- 時間経過（ホストのみ） ---------- */
export function tick(S,dt){
  if(!S.running||S.paused||S.over)return;
  S.t-=dt;S.elapsed+=dt;S.spawnT+=dt;
  const vs=S.mode==='versus';
  if(!S.rush&&S.t<=30){S.rush=true;emit(S,'*',{h:'ラッシュタイム！',k:'ev',s:'event'});}
  if(S.refill){
    // 無限オーダー：空きがあれば0.4秒ごとに補充して常に満席にする
    if(S.orders.length<S.max&&(S.orders.length===0||S.spawnT>=0.4))spawnOrder(S);
  }else{
    const interval=S.spawn*(S.rush?0.6:1);
    if(S.orders.length===0||(S.spawnT>=interval&&S.orders.length<S.max))spawnOrder(S);
  }
  // 注文の時間切れ
  for(let i=S.orders.length-1;i>=0;i--){
    const o=S.orders[i];o.left-=dt;
    if(o.left>0)continue;
    removeOrder(S,o);const R=RU(S),T=R.tgt(o.k);
    const tail=(R.tail&&R.tail(o.k,null))||`<small>${T.n} = ${fmt(T.f)}</small>`;
    if(vs)emit(S,'*',{h:`時間切れ${tail}`,k:'ng',s:'expire',m:[o.k,'exp']});
    else{
      const pen=S.bexp??10;
      S.team.score=Math.max(0,S.team.score-pen);if(!S.bkeep)S.team.combo=0;S.team.failed++;
      emit(S,'*',{h:`時間切れ −${pen}${tail}`,k:'ng',s:'expire',m:[o.k,'exp']});
    }
    S.log.push({k:o.k,ok:false,why:'時間切れ',ci:o.ci,mode:o.mode,by:null});
  }
  // 鍋：加熱→判定、失敗作の放置で発火、延焼
  for(const o of S.orders.slice()){
    for(const key of Object.keys(o.pots)){
      const p=o.pots[key];if(!p)continue;
      if(p.state==='heat'){p.t+=dt;if(p.t>=p.dur)finishPot(S,o,key,p);}
      else if(p.state==='fail'){p.t+=dt;if(p.t>=10)ignite(S,o,key,p);}
      else if(p.state==='fire'){
        p.burn+=dt;
        if(S.spread&&p.burn>=6){
          p.burn=0;const i=S.orders.indexOf(o);
          [S.orders[i-1],S.orders[i+1]].forEach(n=>{if(!n)return;const q=n.pots[key];if(q&&q.state!=='fire'&&q.items.length)ignite(S,n,key,q);});
        }
      }
      if(!S.orders.includes(o))break;
    }
  }
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
    S.reqs=S.reqs.filter(r=>{const o=orderById(S,r.o),p=o&&peekPot(S,o,r.from),T=S.players[r.to];return S.elapsed-r.t<REQ_LIFE&&(!p||p.state==='idle')&&o&&T&&!T.left;});
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
// 反応が終わったら判定。客の注文どおりなら自動で提供、途中の中間体なら鍋に残して次へ、違う物なら −5
function finishPot(S,o,key,p){
  p.t=0;
  if(RU(S).finish){RU(S).finish(S,o,key,p);return;}
  const T=RU(S).tgt(o.k);
  if(S.g==='atom'){
    const m=(p.res&&p.res.comp)||{},k=A.keyOf(m),hits=A.BYKEY[k];
    if(!hits){p.state='fail';p.fail={why:`${A.hill(m)} はレシピに無い`,label:A.hill(m)};emitPot(S,key,{s:'fail'});return;}
    if(A.BYID[o.k]&&A.BYID[o.k].k===k){autoServe(S,o,key,p,[],null);return;}
    const d=hits[0];
    mistake(S,o,key,p,hits.length===1?d.f:A.hill(m),d.f,`正解：${T.n} = ${fmt(T.f)}`);return;
  }
  const res=p.res||{ok:false,why:'反応しない',lv:1};
  if(!res.ok){
    p.state='fail';p.fail={why:failText(S,res)};
    emitPot(S,key,{h:`反応しない<small>${S.fb?p.fail.why:'条件か試薬が違う'}</small>`,k:'ng',s:'fail'});
    return;
  }
  const x=RXBY[res.rx];
  if(serves(o.k,x.id)){autoServe(S,o,key,p,res.over||[],x.id);return;}
  if(usefulFor(o.k).has(x.main)){
    // 中間体：鍋に残る。続けて次の反応へ
    const by=p.by,rb=p.rb;resetPot(p);p.items=[[x.main,1,1,{}]];p.by=by;p.rb=rb;p.mid=x.id;
    emitPot(S,key,{h:`中間体 ${fmt(fOf(x.main))} ができた<small>続けて次の反応へ</small>`,k:'ok',s:'ready'});
    return;
  }
  const it=MENU[o.k];
  const why=it.via&&x.main===it.t?`製法が違う（${it.proc}で作る）`:`正解：${T.n} = ${fmt(T.f)}`;
  mistake(S,o,key,p,x.main,fOf(x.main),why,x.id);
}
// 官能基モード：組み立て（部品がそろえば提供・別の化合物なら −5・存在しない組み合わせは失敗）／見分け（試薬で結果が分かれれば提供）
function finishOrg(S,o,key,p){
  const r=p.res||{},T=RU(S).tgt(o.k);
  if(r.pair){
    const j=r.pair,t=O.TEST[p.cat];
    if(j.ok){autoServe(S,o,key,p,[],null,j.line);return;}
    mistake(S,o,key,p,t?t.label:'?','',j.why,null,{head:'見分けられない',fail:`${j.why}（${j.line}）`,
      small:`${j.line}｜正解例：${O.answerText(o.k)}`,logWhy:'見分け失敗'});
    return;
  }
  const j=r.build||{};
  if(j.ok){autoServe(S,o,key,p,[],null);return;}
  if(j.wrong){mistake(S,o,key,p,j.wrong.n,j.wrong.f,`正解：${T.n} = ${fmt(T.f)}`);return;}
  const why=j.lv<=S.fb?j.why:(S.fb>=1&&j.generic?j.generic:'その組み合わせの化合物は無い');
  p.state='fail';p.fail={why};
  emitPot(S,key,{h:`組めない<small>${why}</small>`,k:'ng',s:'fail'});
}
function creditOf(S,key,p){if(key!=='*')return S.players[key]?key:S.order[0];return p.rb&&S.players[p.rb]?p.rb:S.order[0];}
function autoServe(S,o,key,p,overList,rx,note){
  const vs=S.mode==='versus',pid=creditOf(S,key,p),P=S.players[pid],R=RU(S),T=R.tgt(o.k);
  const C=vs?P:S.team,contrib=Object.keys(p.by);
  const hints=hintsOf(S,o,pid),over=overList.length>0;
  const base=R.base(o.k),ratio=Math.max(0,o.left/o.total);
  const mult=Math.min(4,1+C.combo),tip=Math.round(base*0.8*ratio);
  // 協力：2人以上が入れた鍋は連携ボーナス×1.2
  const team=S.mode==='coop'&&contrib.length>=2;
  const pts=Math.round((base+tip*mult)*(1-0.35*hints)*(o.vip?2:1)*(team?1.2:1)*(over?0.7:1)*(S.bpts??1));
  C.score+=pts;C.combo++;C.maxCombo=Math.max(C.maxCombo,C.combo);C.served++;
  if(!vs){P.served++;P.pts+=pts;}
  removeOrder(S,o);
  S.log.push({k:o.k,ok:true,hinted:hints>0,over:overList,rx,ci:o.ci,mode:o.mode,by:pid});
  const mk=hints||over?'okh':'ok';
  (S.mode==='coop'?[...new Set([pid,...contrib])]:[pid]).forEach(q=>emit(S,q,{m:[o.k,mk]}));
  const tail=(R.tail&&R.tail(o.k,note))||`<small>${fmt(T.f)} ${T.n}${T.proc?`（${T.proc}）`:''}</small>`;
  const extra=(team?' 連携！':'')+(over?`（${overList.join('・')}：×0.7）`:'');
  emit(S,pid,{h:`提供 +${pts}${mult>1?`（チップ×${mult}）`:''}${extra}${tail}`,k:'ok',s:'ok'});
  S.order.filter(q=>q!==pid).forEach(q=>{
    if(vs){const mine=o.pots[q];emit(S,q,{h:`<b>${P.name}</b> に取られた +${pts}${tail}`,k:'ng',s:mine&&mine.items.length?'snipe':'pop'});}
    else{const mine=o.pots[q];emit(S,q,{h:`<b>${P.name}</b> +${pts}${mult>1?`（×${mult}）`:''}${extra}${tail}${mine&&mine.items.length?'<small>この客は仲間が提供した</small>':''}`,k:'ok',s:'ok'});}
  });
  if(vs)sendAttack(S,P,attackPower(S,o.k,o.vip,P.combo,S.rush));
}
function mistake(S,o,key,p,madeLabel,madeF,why,rx,opt){
  const vs=S.mode==='versus',pid=creditOf(S,key,p),P=S.players[pid],C=vs?P:S.team;
  C.score=Math.max(0,C.score-5);C.combo=0;C.failed++;if(!vs)P.failed++;
  const contrib=Object.keys(p.by);
  (S.mode==='coop'?[...new Set([pid,...contrib])]:[pid]).forEach(q=>emit(S,q,{m:[o.k,'ng']}));
  S.log.push({k:o.k,ok:false,why:(opt&&opt.logWhy)||'ちがう物',given:S.g==='rx'?rx:madeLabel,ci:o.ci,mode:o.mode,by:pid});
  p.state='fail';p.fail={why:(opt&&opt.fail)||`${S.g==='rx'?fOf(madeLabel):madeLabel} ができた（注文とちがう）`,made:madeF,label:madeLabel};
  const small=opt&&opt.small!=null?opt.small:`${fmt(S.g==='atom'?madeLabel:madeF)}｜${why}`;
  emitPot(S,key,{h:`${(opt&&opt.head)||'ちがう物ができた'} −5<small>${small}</small>`,k:'ng',s:'ng'});
}
function ignite(S,o,key,p){
  resetPot(p);p.state='fire';
  emitPot(S,key,{h:`${RU(S).tgt(o.k).n}の鍋が燃えた！ 連打で消火`,k:'ng',s:'fire'});
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
  const T=S.players[pid],A2=S.players[x.from],pow=x.pow,fx=[];
  if(pow<=0)return;
  T.recv+=pow;
  if(pow>=3){
    const rank=p=>p.state==='heat'?3:p.items.length?2:1;
    const cands=S.orders.map(o=>({o,p:o.pots[pid]})).filter(c=>c.p&&c.p.state!=='fire').sort((a,b)=>rank(b.p)-rank(a.p));
    if(cands.length){ignite(S,cands[0].o,pid,cands[0].p);fx.push('引火');}
  }
  if(pow===2||pow>=4){pickLocks(S,3).forEach(s=>T.fx.lock[s]=S.elapsed+7);fx.push('在庫切れ');}
  if(pow===1||pow>=4){T.fx.dark=S.elapsed+(pow>=4?3:4.5);fx.push('煙幕');}
  if(!fx.length)fx.push('不発');
  emit(S,pid,{h:`💥 ${fx.join('＋')}！<small>${A2?A2.name:'?'} の攻撃</small>`,k:'ng',s:'hit'});
  if(A2)emit(S,A2.id,{h:`命中：${fx.join('＋')} → <b>${T.name}</b>`,k:'ok',s:'atk'});
}

/* ---------- アクション ---------- */
function putIn(S,p,k,pid){
  const R=RU(S);
  if(k[0]==='@'){const c=k.slice(1);p.cat=p.cat===c?null:c;p.catBy=p.cat?pid:null;if(p.cat)p.by[pid]=(p.by[pid]||0)+1;return true;}
  // items: [記号, 合計の数, 中間体なら1, {入れた人: 数}]
  const x=p.items.find(y=>y[0]===k);
  if(x){if(x[2]||x[1]>=R.maxCoef)return false;x[1]++;x[3]=x[3]||{};x[3][pid]=(x[3][pid]||0)+1;}
  else{if(p.items.length>=R.maxSpecies)return false;p.items.push([k,1,0,{[pid]:1}]);}
  p.by[pid]=(p.by[pid]||0)+1;
  return true;
}
// 自動精製：材料と条件がそろって「この客に出せる物（または途中の中間体）」ができる状態になったら自動で反応させる
function wouldWork(S,o,p){
  if(!p.items.length)return false;
  if(RU(S).would)return RU(S).would(S,o,p);
  if(S.g==='atom'){const m={};p.items.forEach(([s,c])=>m[s]=c);return !!A.BYID[o.k]&&A.keyOf(m)===A.BYID[o.k].k;}
  const r=judge(p.items,p.cat,p.heat,S.coef);if(!r.ok)return false;
  return serves(o.k,r.rx)||usefulFor(o.k).has(RXBY[r.rx].main);
}
function startReact(S,p,pid,o){
  if(RU(S).start&&o)RU(S).start(S,o,p);
  else if(S.g==='atom'){const m={};p.items.forEach(([s,c])=>m[s]=c);p.res={comp:m};p.dur=0.9+0.05*A.atomCount(m);}
  else{p.res=judge(p.items,p.cat,p.heat,S.coef);p.dur=durOf(p.items,p.heat,p.cat);}
  p.state='heat';p.t=0;p.rb=pid;
}
function maybeAuto(S,o,p,pid){
  if(!o||!p||p.state!=='idle')return;
  const R=RU(S);
  // 見分けの注文：試薬を選んだ瞬間に判定（自動精製の設定に関係なく）
  if(R.instant&&R.instant(S,o,p)){startReact(S,p,pid,o);emit(S,pid,{s:'react'});return;}
  if(S.auto&&wouldWork(S,o,p)){startReact(S,p,pid,o);emit(S,pid,{s:'react'});}
}
// 操作対象の鍋（a.o = 注文ID）
function myPot(S,pid,a,need){
  const o=orderById(S,a.o);if(!o)return null;
  const p=need?potOf(S,o,pid):peekPot(S,o,pid);
  return p?{o,p}:null;
}
const ACT={
  add(S,pid,P,a){
    const k=a.s,R=RU(S);if(!R.valid(k))return;
    if(isLocked(S,pid,k)){emit(S,pid,{h:`${fmt(RU(S).label(k))} は在庫切れ`,k:'ng',s:'lock'});return;}
    const own=owners(S);
    if(own&&own[k]!==pid){
      // 自分の担当外 → 担当者にリクエスト（入れ先は自分が選んでいる客の鍋）
      const t=myPot(S,pid,a,true);
      if(!t||t.p.state!=='idle'){emit(S,pid,{h:'客を選んでから頼もう',k:'ng',s:'lock'});return;}
      const no=R.accept&&R.accept(t.o,k);if(no){emit(S,pid,{h:no,k:'ng',s:'lock'});return;}
      if(S.reqs.filter(r=>r.from===pid).length>=8){emit(S,pid,{h:'リクエストは8個まで',k:'ng',s:'lock'});return;}
      S.reqs.push({id:++S.uid,from:pid,to:own[k],s:k,o:t.o.id,t:S.elapsed});
      emit(S,own[k],{s:'req'});
      return;
    }
    // 自分宛てのリクエストがあれば、頼んだ人が選んだ客の鍋へ
    let tgt=null,rq=null;
    if(S.reqs.length){
      rq=S.reqs.find(r=>{if(r.to!==pid||r.s!==k)return false;const o=orderById(S,r.o);const p=o&&potOf(S,o,r.from);return p&&p.state==='idle';})||null;
      if(rq){const o=orderById(S,rq.o);tgt={o,p:potOf(S,o,rq.from)};}
    }
    if(!tgt){tgt=myPot(S,pid,a,true);if(!tgt){emit(S,pid,{h:'客（伝票）を選んでから入れよう',k:'ng',s:'lock'});return;}}
    if(tgt.p.state!=='idle'){emit(S,pid,{h:tgt.p.state==='heat'?'その鍋は反応中':'先に鍋を空けよう',k:'ng',s:'lock'});return;}
    const no=R.accept&&R.accept(tgt.o,k);if(no){emit(S,pid,{h:no,k:'ng',s:'lock'});return;}
    if(!putIn(S,tgt.p,k,pid))return;
    P.atoms++;
    if(rq){S.reqs.splice(S.reqs.indexOf(rq),1);emit(S,rq.from,{s:'gift'});}
    maybeAuto(S,tgt.o,tgt.p,rq?rq.from:pid);
  },
  chip(S,pid,P,a){
    const t=myPot(S,pid,a,false);if(!t||t.p.state!=='idle')return;
    if(a.s==='@'){t.p.cat=null;maybeAuto(S,t.o,t.p,pid);return;}
    const x=t.p.items.find(y=>y[0]===a.s);if(!x)return;
    // 自分が入れた分から1個戻す（なければ一番多く入れた人の分）
    const w=x[3]||{},q=w[pid]>0?pid:Object.keys(w).sort((m,n)=>w[n]-w[m])[0];
    if(q){w[q]--;if(w[q]<=0)delete w[q];}
    x[1]--;if(x[1]<=0||x[2])t.p.items=t.p.items.filter(y=>y!==x);
    maybeAuto(S,t.o,t.p,pid);
  },
  heat(S,pid,P,a){
    if(S.g!=='rx')return;
    const t=myPot(S,pid,a,true);if(!t||t.p.state!=='idle')return;
    const h=a.h|0;if(h<0||h>2)return;t.p.heat=h;
    maybeAuto(S,t.o,t.p,pid);
  },
  react(S,pid,P,a){
    const t=myPot(S,pid,a,false);if(!t)return;const p=t.p;
    if(p.state!=='idle'||!p.items.length)return;
    startReact(S,p,pid,t.o);
  },
  dump(S,pid,P,a){
    const t=myPot(S,pid,a,false);if(!t||t.p.state==='fire'||t.p.state==='heat')return;
    resetPot(t.p);
  },
  ext(S,pid,P,a){
    const t=myPot(S,pid,a,false);if(!t||t.p.state!=='fire')return;
    t.p.taps++;
    if(t.p.taps>=4){resetPot(t.p);emitPot(S,potKey(S,pid),{h:'消火した',k:'ok'});}
  },
  hint(S,pid,P,a){
    const o=orderById(S,a.o);if(!o)return;
    if(S.mode==='versus'){if((o.ph[pid]||0)<2){o.ph[pid]=(o.ph[pid]||0)+1;P.hints++;}}
    else if(o.hints<2){o.hints++;P.hints++;}
  },
  focus(S,pid,P,a){if(orderById(S,a.o))P.focus=a.o;},
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
  emit(S,'*',{h:`<b>${P.name}</b> が退出した`,k:'ng',s:'lock'});
}

/* ---------- 通信用 ---------- */
export function snapshot(S){
  const o={};
  for(const k in S)if(k!=='ev'&&k!=='log'&&k!=='pool'&&k!=='w')o[k]=S[k];
  return o;
}
// クライアント側の見た目用の時間補間（状態遷移は起こさない）
export function advance(V,dt){
  if(!V.running||V.paused||V.over)return;
  V.t=Math.max(0,V.t-dt);V.elapsed+=dt;
  V.orders.forEach(o=>{
    o.left=Math.max(0,o.left-dt);
    for(const k in o.pots){const p=o.pots[k];if(p&&p.state==='heat')p.t=Math.min(p.dur,p.t+dt);else if(p&&p.state==='fail')p.t+=dt;}
  });
  if(V.mode==='versus')for(const id in V.players)V.players[id].inc.forEach(x=>{x.t=Math.max(0,x.t-dt);});
}
export function results(S){
  return {
    g:S.g,busy:S.busy,mode:S.mode,stageId:S.stageId,n:S.n,stars:S.stars,team:S.team,coef:S.coef,
    players:S.order.map(id=>{const P=S.players[id];return {id,name:P.name,slot:P.slot,score:P.score,served:P.served,failed:P.failed,
      maxCombo:P.maxCombo,atoms:P.atoms,sent:P.sent,recv:P.recv,offset:P.offset,pts:P.pts,hints:P.hints,left:P.left};}),
    log:S.log
  };
}
