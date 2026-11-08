// 画面・入力・音・セッション（ソロ／ホスト／参加者）
import {SUB,RXBY,MENU,MKEYS,TG,CATNAME,STAGES,REVIEW,SHELF,CATS,HEAT,route,eqHTML,condText,nameOf,fOf,cellLabel,cellName,stepsOf,fmt} from './chem.js';
import * as E from './engine.js';
import {HostNet,ClientNet,PROTO,normCode} from './net.js';
const {COLORS,FL,STAMPS}=E;

/* ================= 保存 ================= */
// v2：反応式モード。旧版(v1)からは名前・音・対戦成績だけ引き継ぐ
const SAVE_KEY='chem-kitchen-v2';
let SAVE={mastery:{},best:{},mute:false,tut:false,name:'',coBest:{},vs:{win:0,lose:0,draw:0},coef:false};
try{
  const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
  if(s)SAVE=Object.assign(SAVE,s);
  else{const o=JSON.parse(localStorage.getItem('chem-kitchen-v1')||'null');if(o)Object.assign(SAVE,{name:o.name||'',mute:!!o.mute,vs:o.vs||SAVE.vs});}
}catch(e){}
if(!SAVE.coBest)SAVE.coBest={};if(!SAVE.vs)SAVE.vs={win:0,lose:0,draw:0};
function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(SAVE));}catch(e){}}
let persistT=0;function persistSoon(){clearTimeout(persistT);persistT=setTimeout(persist,300);}
function mst(id){return SAVE.mastery[id]||(SAVE.mastery[id]={box:0,seen:0,ok:0,ng:0});}
function applyMastery(m){
  if(!Array.isArray(m)||!MENU[m[0]])return;
  const x=mst(m[0]);
  switch(m[1]){
    case 'seen':x.seen++;break;
    case 'ok':x.box=Math.min(5,x.box+1);x.ok++;break;
    case 'okh':x.ok++;break;
    case 'ng':x.box=0;x.ng++;break;
    case 'exp':x.box=Math.max(0,x.box-1);x.ng++;break;
  }
  persistSoon();
}
function myWeights(){const w={};for(const id in SAVE.mastery){const m=SAVE.mastery[id];if(m&&m.seen&&MENU[id])w[id]=m.box|0;}return w;}
function cleanWeights(w){
  const o={};if(!w||typeof w!=='object')return o;
  for(const id in w)if(MENU[id]&&typeof w[id]==='number')o[id]=Math.max(0,Math.min(5,w[id]|0));
  return o;
}
const cleanName=s=>String(s||'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,10)||'ケミスト';
const myName=()=>cleanName(SAVE.name);
function reviewPool(){return MKEYS.filter(k=>{const m=SAVE.mastery[k];return m&&m.seen&&(m.box<=2||m.ng>m.ok);});}

/* ================= 音 ================= */
let AC=null,MASTER=null,NOISE=null;
function audio(){
  if(AC){if(AC.state==='suspended')AC.resume();return AC;}
  try{
    AC=new (window.AudioContext||window.webkitAudioContext)();
    MASTER=AC.createGain();MASTER.gain.value=SAVE.mute?0:0.5;MASTER.connect(AC.destination);
    NOISE=AC.createBuffer(1,AC.sampleRate*0.5,AC.sampleRate);
    const d=NOISE.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  }catch(e){AC=null;}
  return AC;
}
function tone(freq,dur,type='sine',vol=0.25,when=0,slide=0){
  if(!AC)return;const t=AC.currentTime+when;
  const o=AC.createOscillator(),g=AC.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*slide),t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(g);g.connect(MASTER);o.start(t);o.stop(t+dur+0.02);
}
function noise(dur,vol=0.2,when=0,hp=1000){
  if(!AC)return;const t=AC.currentTime+when;
  const s=AC.createBufferSource(),g=AC.createGain(),f=AC.createBiquadFilter();
  s.buffer=NOISE;f.type='highpass';f.frequency.value=hp;
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  s.connect(f);f.connect(g);g.connect(MASTER);s.start(t);s.stop(t+dur+0.02);
}
const SFX={
  tap(){tone(520+Math.random()*120,0.05,'triangle',0.18);},
  pop(){tone(300,0.06,'sine',0.2,0,0.6);},
  react(){for(let i=0;i<4;i++)tone(300+Math.random()*300,0.06,'sine',0.12,i*0.07,1.5);},
  ready(){tone(880,0.12,'triangle',0.25);tone(1320,0.2,'triangle',0.22,0.1);},
  ok(){[523,659,784,1046].forEach((f,i)=>tone(f,0.14,'square',0.12,i*0.06));},
  ng(){tone(180,0.35,'sawtooth',0.18,0,0.5);},
  expire(){tone(120,0.4,'square',0.15);tone(90,0.4,'square',0.12,0.15);},
  fire(){for(let i=0;i<4;i++)tone(i%2?700:950,0.12,'square',0.1,i*0.13);},
  whoosh(){noise(0.18,0.25,0,800);},
  tick(){tone(1500,0.03,'square',0.08);},
  event(){tone(440,0.15,'sawtooth',0.15);tone(330,0.25,'sawtooth',0.15,0.15);},
  fail(){noise(0.3,0.2,0,200);tone(100,0.3,'sine',0.2,0,0.5);},
  lock(){tone(200,0.08,'square',0.12);},
  req(){tone(1180,0.06,'square',0.1);tone(1480,0.08,'square',0.1,0.08);},
  gift(){tone(990,0.08,'triangle',0.2);tone(1320,0.12,'triangle',0.18,0.07);},
  warn(){for(let i=0;i<3;i++)tone(i%2?620:880,0.1,'sawtooth',0.12,i*0.11);},
  hit(){noise(0.35,0.3,0,300);tone(90,0.4,'sine',0.25,0,0.4);},
  atk(){tone(300,0.18,'sawtooth',0.12,0,3);},
  block(){[660,990,1320].forEach((f,i)=>tone(f,0.1,'triangle',0.2,i*0.06));},
  stamp(){tone(760,0.05,'sine',0.18);tone(1020,0.07,'sine',0.16,0.05);},
  snipe(){tone(220,0.14,'square',0.13);tone(165,0.22,'square',0.13,0.12);},
};
function sfx(n){if(AC&&!SAVE.mute&&SFX[n])SFX[n]();}
// BGM：16ステップの簡単なシーケンサ
const BGM={on:false,next:0,step:0,tempo:124,timer:null};
const BASS=[36,0,36,48,34,0,34,46,31,0,31,43,33,0,35,38];
const ARP=[72,0,76,0,79,0,76,0,70,0,74,0,77,0,74,0];
const mf=m=>440*Math.pow(2,(m-69)/12);
function bgmStart(){
  if(!AC||BGM.on)return;BGM.on=true;BGM.next=AC.currentTime+0.05;BGM.step=0;
  BGM.timer=setInterval(()=>{
    if(!AC)return;
    while(BGM.next<AC.currentTime+0.12){
      const s=BGM.step%16,w=BGM.next-AC.currentTime,dur=60/BGM.tempo/2;
      if(!SAVE.mute){
        if(BASS[s])tone(mf(BASS[s]),dur*0.9,'square',0.05,w);
        if(s%2===1)noise(0.04,0.04,w,6000);
        if(s%4===0)tone(120,0.12,'sine',0.18,w,0.4);
        if(BGM.step%32>=16&&ARP[s])tone(mf(ARP[s]),dur*0.8,'triangle',0.035,w);
      }
      BGM.next+=dur;BGM.step++;
    }
  },25);
}
function bgmStop(){BGM.on=false;clearInterval(BGM.timer);}

/* ================= DOM ================= */
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// 通信で届いたトースト文面は、<small><sub><b> 以外のタグを無効化してから表示する
const safe=h=>esc(h).replace(/&lt;(\/?(?:small|sub|b))&gt;/g,'<$1>');
let CUR='title';
function show(id){CUR=id;document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id===id));if(id!=='game')closeStamps();}
let OVK='';
function overlay(html,kind=''){OVK=kind;$('ovPanel').innerHTML=html;$('ov').classList.add('on');}
function closeOverlay(){OVK='';$('ov').classList.remove('on');}
const stars3=n=>`${'★'.repeat(n)}${'☆'.repeat(5-n)}`;

/* ================= セッション ================= */
// SES.role: 'solo' | 'host' | 'client'
let SES=null;
const UI={active:null,held:null,sig:{},lastTick:-1,raf:0,last:0,cdIv:0,pauseShown:false,incSig:''};
const me=()=>SES?SES.me:'p0';
const view=()=>SES?(SES.role==='client'?SES.V:SES.S):null;
const colorOf=(V,pid)=>{const P=V&&V.players[pid];return COLORS[P?P.slot%4:0];};

/* ================= タイトル ================= */
function starsFor(st,score){if(!st.stars)return 0;return st.stars.filter(t=>score>=t).length;}
function unlocked(i){if(i===0)return true;const p=STAGES[i-1];return starsFor(p,SAVE.best[p.id]||0)>=1;}
function renderTitle(){
  let h='';
  STAGES.forEach((st,i)=>{
    const best=SAVE.best[st.id]||0,s=starsFor(st,best),lock=!unlocked(i);
    h+=`<button class="stage${lock?' locked':''}" data-stage="${i}">
      <div class="no">${lock?'🔒':i+1}</div>
      <div><h3>${esc(st.name)}</h3><p>${esc(st.desc)}${lock?'<br>前のステージで★1を取ると解放':''}</p></div>
      <div class="best"><div class="stars">${'★'.repeat(s)}${'☆'.repeat(3-s)}</div>${best?best+'点':'—'}</div></button>`;
  });
  const weak=reviewPool().length;
  h+=`<button class="stage review" data-stage="rv"><div class="no">復</div>
    <div><h3>${REVIEW.name}</h3><p>${weak?`苦手候補 ${weak} 物質から集中注文。星なし・何度でも`:'一度でも注文された物質が出たら解放'}</p></div>
    <div class="best">${SAVE.best.rv?SAVE.best.rv+'点':'—'}</div></button>`;
  $('stageList').innerHTML=h;
  $('btnMute').textContent='音: '+(SAVE.mute?'OFF':'ON');
  $('btnCoef').textContent='係数判定: '+(SAVE.coef?'ON':'OFF');
  if(document.activeElement!==$('inName'))$('inName').value=SAVE.name||'';
}
$('stageList').addEventListener('click',e=>{
  const b=e.target.closest('.stage');if(!b)return;
  audio();
  const v=b.dataset.stage;
  if(v==='rv'){if(!reviewPool().length&&!Object.keys(myWeights()).length){overlay(`<h2>まだ早い</h2><p>ステージを1回遊ぶと、注文された反応の習熟度が記録され、苦手克服ランが使えるようになる。</p><button class="btn" data-ov="close">閉じる</button>`);return;}startSolo('rv');return;}
  const i=+v;if(!unlocked(i))return;startSolo(STAGES[i].id);
});
$('inName').addEventListener('input',e=>{SAVE.name=e.target.value.trim().slice(0,10);persistSoon();});
$('btnMute').addEventListener('click',()=>{SAVE.mute=!SAVE.mute;persist();audio();if(MASTER)MASTER.gain.value=SAVE.mute?0:0.5;renderTitle();});
$('btnHow').addEventListener('click',()=>tutorial(false));
$('btnCoef').addEventListener('click',()=>{SAVE.coef=!SAVE.coef;persist();renderTitle();});
$('btnDex').addEventListener('click',()=>{renderDex();show('dex');});
$('btnDexBack').addEventListener('click',()=>{renderTitle();show('title');});
$('btnHost').addEventListener('click',()=>{audio();createRoom();});
$('btnJoin').addEventListener('click',()=>{audio();joinDialog('');});

function tutorial(fromGame){
  overlay(`<h2>遊び方</h2><div class="tut">
    <div class="step"><span class="n">1</span><div>伝票の物質を作る<b>反応式</b>を考える。<b>試薬棚</b>をタップしてフラスコへ。同じ試薬をもう一度タップで<b>係数+1</b>（濃・希の違いに注意）。</div></div>
    <div class="step"><span class="n">2</span><div>必要なら<b>触媒</b>（棚の最下段）をタップしてセット。フラスコの<b>🔥ボタン</b>で 常温→加熱→高温・高圧 を切り替え。</div></div>
    <div class="step"><span class="n">3</span><div><b>「反応」</b>。反応物・触媒・温度が合わないと<b>反応しない</b>（序盤は理由が出る）。いらない加熱や触媒は反応するが報酬×0.7。</div></div>
    <div class="step"><span class="n">4</span><div>完成したフラスコをタップして持ち、<b>伝票をタップで提供</b>。<b>空きフラスコをタップすると注ぎ込み</b>、次の反応の原料（中間体）になる＝多段階合成。</div></div>
    <div class="step"><span class="n">5</span><div>完成品を放置すると<b>燃える</b>（連打で消火）。伝票の「ヒント」は反応物→条件の順。使うと報酬が減り習熟★は上がらない。</div></div>
    <div class="step"><span class="n">6</span><div><b>友達と遊ぶ</b>：協力は棚の分担とリクエスト、対戦は注文の奪い合いとおじゃま。</div></div>
  </div><button class="btn go" data-ov="${fromGame?'tutgo':'close'}">${fromGame?'開店する':'わかった'}</button>`);
}

/* ================= 図鑑 ================= */
function renderDex(){
  let h='',seen=0,master=0;
  ['lab','ppt','ind','org'].forEach(c=>{
    const items=MKEYS.filter(k=>MENU[k].c===c);
    h+=`<div class="dex-sec"><h4>${CATNAME[c]}</h4><div class="dex-grid">`;
    items.forEach(k=>{
      const m=SAVE.mastery[k],it=MENU[k];
      if(m&&m.seen){seen++;if(m.box>=5)master++;
        h+=`<button class="dx" data-dx="${esc(k)}"><div class="f">${fmt(fOf(it.t))}</div>${esc(nameOf(it.t))}${it.proc?`<br><small>${esc(it.proc)}</small>`:''}<div class="s">${stars3(m.box)}</div></button>`;}
      else h+=`<div class="dx unseen"><div class="f">？？？</div>未注文</div>`;
    });
    h+='</div></div>';
  });
  $('dexList').innerHTML=h;
  $('dexSum').textContent=`出会った反応 ${seen} / ${MKEYS.length}　習得（★5） ${master}　対戦成績 ${SAVE.vs.win}勝${SAVE.vs.lose}敗${SAVE.vs.draw?SAVE.vs.draw+'分':''}`;
}
function routeHTML(key,usedRx){
  const rs=usedRx&&RXBY[usedRx]?[RXBY[usedRx]]:route(key);
  return rs.map((x,i)=>`<div class="eqline">${rs.length>1?`<span class="stepn">${i+1}</span>`:''}${eqHTML(x,MENU[key]&&MENU[key].t)}<span class="cond">［${condText(x)}］</span>${x.note?`<div class="note2">${esc(x.note)}</div>`:''}</div>`).join('');
}
$('dexList').addEventListener('click',e=>{
  const b=e.target.closest('[data-dx]');if(!b)return;const k=b.dataset.dx,it=MENU[k];if(!it)return;const m=mst(k);
  const alts=Object.values(RXBY).filter(x=>!it.via&&x.main===it.t&&x.id!==route(k).at(-1).id);
  overlay(`<h2>${fmt(fOf(it.t))}</h2><p style="margin:0 0 6px;font-weight:800">${esc(nameOf(it.t))}（${CATNAME[it.c]}${it.proc?'・'+esc(it.proc):''}）</p>
    <div class="sec-h">作り方</div><div class="rev"><div class="it ok">${routeHTML(k)}</div></div>
    ${alts.length?`<div class="sec-h">別の作り方</div><div class="rev">${alts.map(x=>`<div class="it ok"><div class="eqline">${eqHTML(x,it.t)}<span class="cond">［${condText(x)}］</span>${x.note?`<div class="note2">${esc(x.note)}</div>`:''}</div></div>`).join('')}</div>`:''}
    <div class="sec-h">性質</div><div class="rev">${(TG[it.t]?TG[it.t].p:[]).map(x=>`<div class="it ok">${esc(x)}</div>`).join('')}</div>
    <p style="font-size:12px">正解 ${m.ok} 回 / ミス ${m.ng} 回 / 習熟 ${stars3(m.box)}</p>
    <button class="btn" data-ov="close">閉じる</button>`);
});

/* ================= ソロ ================= */
function startSolo(stageId){
  leaveSession(true);
  const st=E.stageById(stageId);
  let pool=null;
  if(st.pool==='review'){const p=reviewPool();pool=p.length?p:Object.keys(myWeights());}
  const cfg={mode:'solo',stageId,players:[{id:'p0',name:myName(),slot:0}],weights:myWeights(),pool,coef:SAVE.coef};
  SES={role:'solo',me:'p0',cfg,S:E.createGame(cfg)};
  enterGame();
  if(!SAVE.tut&&stageId==='s1'){SES.waitTut=true;tutorial(true);}
  else countdown(beginLocal);
}
function beginLocal(){
  if(!SES||!SES.S)return;
  E.begin(SES.S);flushEvents();startHostLoop();
  if(SES.role==='host')sendSnaps();
}

/* ---------- ホスト（ソロ含む）の進行 ---------- */
function startHostLoop(){stopHostLoop();SES.lastT=performance.now();SES.loop=setInterval(hostStep,50);}
function stopHostLoop(){if(SES&&SES.loop){clearInterval(SES.loop);SES.loop=0;}}
function hostStep(){
  const ses=SES;if(!ses||!ses.S)return;
  const now=performance.now(),dt=Math.min(0.25,(now-ses.lastT)/1000);ses.lastT=now;
  E.tick(ses.S,dt);flushEvents();
  if(ses.role==='host'&&((ses.dirty&&now-(ses.lastSnap||0)>=40)||now-(ses.lastSnap||0)>=100))sendSnaps();
  if(ses.S.over&&!ses.ended){ses.ended=true;onGameOver();}
}
function flushEvents(){
  const ses=SES;if(!ses||!ses.S||!ses.S.ev.length)return;
  for(const e of ses.S.ev){
    if(e.to==='*'||e.to===ses.me)handleEvent(e);
    if(ses.role==='host')for(const pid in ses.q)if(e.to==='*'||e.to===pid)ses.q[pid].push(e);
  }
  ses.S.ev.length=0;ses.dirty=true;
}
function sendSnaps(){
  const ses=SES;if(!ses||ses.role!=='host'||!ses.S)return;
  const s=E.snapshot(ses.S);
  for(const [cid,pid] of ses.cids){ses.net.send(cid,{t:'s',s,ack:ses.acks[pid]||0,ev:ses.q[pid]||[]});ses.q[pid]=[];}
  ses.dirty=false;ses.lastSnap=performance.now();
}
function handleEvent(e){
  if(e.m)applyMastery(e.m);
  if(e.s)sfx(e.s);
  if(e.h)toast(safe(e.h),e.k,e.c);
  if(e.s==='hit'){const g=$('game');g.classList.remove('game-flash');void g.offsetWidth;g.classList.add('game-flash');if(navigator.vibrate)try{navigator.vibrate(120);}catch(x){}}
}
function onGameOver(){
  const ses=SES;stopHostLoop();
  const r=E.results(ses.S);
  if(ses.role==='host'){sendSnaps();ses.net.broadcast({t:'end',r});ses.inGame=false;lobbyChanged(false);}
  showResults(r);
}

/* ---------- アクション送信 ---------- */
const PREDICT=new Set(['add','chip','react','dump','ext','hint','claim','focus','serve','pause','resume']);
function act(a){
  const ses=SES;if(!ses)return;
  if(ses.role==='client'){
    const q=++ses.seq;
    if(PREDICT.has(a.t)&&ses.V){ses.pending.push({q,a});E.apply(ses.V,ses.me,a);ses.V.ev=[];ses.V.log=[];}
    ses.net.send({t:'a',q,a});
  }else if(ses.S){E.apply(ses.S,ses.me,a);flushEvents();}
}

/* ================= 部屋を作る（ホスト） ================= */
async function createRoom(){
  leaveSession(true);
  const ses={role:'host',me:'p0',pidN:0,code:'',players:[{id:'p0',name:myName(),slot:0,cid:null}],
    cfg:{mode:'coop',stageId:'s1',split:true,coef:false},cids:new Map(),seen:new Map(),wts:{p0:myWeights()},acks:{},q:{},S:null,inGame:false};
  SES=ses;
  overlay('<h2>部屋を準備中…</h2><p>接続サーバーにつないでいる。</p>','wait');
  const net=new HostNet({onConnect:cid=>hostOnConnect(ses,cid),onMessage:(cid,m)=>hostOnMessage(ses,cid,m),onClose:cid=>hostOnClose(ses,cid)});
  ses.net=net;
  try{ses.code=await net.start();}
  catch(e){
    if(SES===ses)SES=null;net.close();
    overlay(`<h2>部屋を作れなかった</h2><p class="err">${esc(e.message||e)}</p><div class="row-btns"><button class="btn go" data-ov="rehost">もう一度</button><button class="btn sub" data-ov="close">閉じる</button></div>`);
    return;
  }
  if(SES!==ses){net.close();return;}
  ses.hb=setInterval(()=>hostHeartbeat(ses),2000);
  closeOverlay();showLobby();
}
function hostOnConnect(ses,cid){
  ses.seen.set(cid,Date.now());
  setTimeout(()=>{if(SES===ses&&!ses.cids.has(cid)&&ses.seen.has(cid)){ses.seen.delete(cid);ses.net.drop(cid);}},10000);
}
function hostOnMessage(ses,cid,m){
  if(SES!==ses||!m||typeof m!=='object')return;
  ses.seen.set(cid,Date.now());
  if(m.t==='hello'){
    if(ses.cids.has(cid))return;
    let why='';
    if(m.v!==PROTO)why='バージョンが違う。両方ともページを再読み込みして';
    else if(ses.inGame)why='いまゲーム中。終わってから入り直して';
    else if(ses.players.length>=4)why='満員（最大4人）';
    if(why){ses.net.send(cid,{t:'reject',why});setTimeout(()=>ses.net.drop(cid),400);return;}
    const used=new Set(ses.players.map(p=>p.slot));let slot=0;while(used.has(slot))slot++;
    const pid='p'+(++ses.pidN);
    ses.players.push({id:pid,name:cleanName(m.name),slot,cid});
    ses.cids.set(cid,pid);ses.wts[pid]=cleanWeights(m.w);ses.q[pid]=[];ses.acks[pid]=0;
    ses.net.send(cid,{t:'welcome',pid,code:ses.code});
    sfx('pop');toastLobby(`${cleanName(m.name)} が入室`);
    lobbyChanged(true);
    return;
  }
  const pid=ses.cids.get(cid);if(!pid)return;
  if(m.t==='a'){
    if(typeof m.q!=='number'||m.q<=(ses.acks[pid]||0))return;
    ses.acks[pid]=m.q;
    if(ses.S&&ses.inGame){E.apply(ses.S,pid,m.a);flushEvents();}
  }else if(m.t==='w'){ses.wts[pid]=cleanWeights(m.w);}
  else if(m.t==='bye'){ses.net.drop(cid);hostOnClose(ses,cid);}
}
function hostOnClose(ses,cid){
  if(SES!==ses)return;
  ses.seen.delete(cid);
  const pid=ses.cids.get(cid);if(!pid)return;
  ses.cids.delete(cid);
  const p=ses.players.find(x=>x.id===pid);
  ses.players=ses.players.filter(x=>x.id!==pid);delete ses.q[pid];
  if(ses.S&&ses.inGame&&!ses.S.over){E.playerLeft(ses.S,pid);flushEvents();}
  else if(p)toastLobby(`${p.name} が退出`);
  lobbyChanged(true);
}
function hostHeartbeat(ses){
  if(SES!==ses)return;
  const now=Date.now();
  for(const [cid,t] of [...ses.seen])if(now-t>15000){ses.net.drop(cid);if(ses.cids.has(cid))hostOnClose(ses,cid);else ses.seen.delete(cid);}
  if(!ses.inGame)ses.net.broadcast({t:'ping'});
}
function lobbyMsg(ses){return {t:'lobby',code:ses.code,players:ses.players.map(({id,name,slot})=>({id,name,slot})),cfg:ses.cfg,inGame:ses.inGame};}
function lobbyChanged(render){
  const ses=SES;if(!ses||ses.role!=='host')return;
  ses.net.broadcast(lobbyMsg(ses));
  if(render&&CUR==='lobby')renderLobby();
}
function mergeWeights(list){
  const ids=new Set();list.forEach(w=>Object.keys(w).forEach(k=>ids.add(k)));
  const o={};ids.forEach(id=>{o[id]=list.reduce((a,w)=>a+(w[id]||0),0)/list.length;});
  return o;
}
function hostStartGame(){
  const ses=SES;if(!ses||ses.role!=='host')return;
  if(ses.players.length<2){toastLobby('2人以上そろったら開店できる');return;}
  const players=ses.players.map(({id,name,slot})=>({id,name,slot}));
  const ws=players.map(p=>ses.wts[p.id]||{});
  const cfg=Object.assign({},ses.cfg,{players,weights:mergeWeights(ws)});
  if(cfg.stageId==='rv'){
    // 苦手ミックス：誰か1人でも★2以下の物質を集める
    const weak=new Set();ws.forEach(w=>{for(const id in w)if(w[id]<=2)weak.add(id);});
    let pool=[...weak];if(pool.length<8)ws.forEach(w=>Object.keys(w).forEach(id=>{if(!pool.includes(id))pool.push(id);}));
    cfg.pool=pool.length>=4?pool:null;
  }
  stopHostLoop();
  ses.S=E.createGame(cfg);ses.inGame=true;ses.ended=false;
  for(const p of players)if(p.id!==ses.me)ses.q[p.id]=[];
  closeOverlay();
  ses.net.broadcast({t:'start',s:E.snapshot(ses.S)});
  lobbyChanged(false);
  enterGame();
  countdown(()=>{if(SES===ses&&ses.S&&ses.inGame)beginLocal();});
}
function hostToLobby(){
  const ses=SES;if(!ses||ses.role!=='host')return;
  stopHostLoop();ses.S=null;ses.inGame=false;
  ses.net.broadcast({t:'tolobby'});
  stopGameUI();closeOverlay();showLobby();lobbyChanged(false);
}

/* ================= 部屋に入る（参加者） ================= */
function joinDialog(code,err){
  overlay(`<h2>部屋に入る</h2>
    <p class="note" style="color:#3c5560">ホストの画面に出ている4文字のコード</p>
    <input class="codebox" id="inCode" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(code||'')}" aria-label="部屋コード">
    <label class="namebox" style="margin:10px 0">名前<input id="inName2" maxlength="10" value="${esc(SAVE.name||'')}" placeholder="ケミスト"></label>
    <p class="err" id="joinErr">${err?esc(err):''}</p>
    <div class="row-btns"><button class="btn go" data-ov="joingo">入る</button><button class="btn sub" data-ov="close">やめる</button></div>`,'join');
  setTimeout(()=>{const i=$(code?'inName2':'inCode');if(i)i.focus();},60);
}
async function joinRoom(code){
  leaveSession(true);
  const ses={role:'client',me:null,code,pending:[],seq:0,lastMsg:Date.now(),players:[],cfg:null,V:null,inGame:false};
  SES=ses;
  overlay(`<h2>接続中…</h2><p>部屋 <b>${esc(code)}</b> に接続している。</p>`,'wait');
  const net=new ClientNet({onMessage:m=>clientOnMessage(ses,m),onClose:()=>clientOnClose(ses)});
  ses.net=net;
  try{await net.join(code);}
  catch(e){if(SES===ses)SES=null;joinDialog(code,e.message||String(e));return;}
  if(SES!==ses){net.close();return;}
  net.send({t:'hello',v:PROTO,name:myName(),w:myWeights()});
  ses.hb=setInterval(()=>{if(SES!==ses)return;net.send({t:'ping'});if(Date.now()-ses.lastMsg>15000)clientOnClose(ses);},2000);
  ses.joinTO=setTimeout(()=>{if(SES===ses&&!ses.me)clientOnClose(ses);},10000);
}
function clientOnMessage(ses,m){
  if(SES!==ses||!m||typeof m!=='object')return;
  ses.lastMsg=Date.now();
  switch(m.t){
    case 'welcome':
      ses.me=String(m.pid);clearTimeout(ses.joinTO);closeOverlay();stripRoomParam();showLobby();sfx('pop');break;
    case 'reject':
      endSession();overlay(`<h2>入れなかった</h2><p class="err">${esc(m.why||'')}</p><button class="btn" data-ov="menu">トップへ</button>`);break;
    case 'lobby':
      ses.players=Array.isArray(m.players)?m.players:[];ses.cfg=m.cfg||null;ses.inGame=!!m.inGame;
      if(CUR==='lobby')renderLobby();break;
    case 'start':
      if(!m.s||!ses.me)return;
      ses.pending=[];ses.V=prepView(m.s);ses.ended=false;closeOverlay();enterGame();countdown(()=>{});break;
    case 's':
      if(!m.s||!ses.me||ses.ended)return;
      ses.V=reconcile(ses,m.s,m.ack|0);
      if(Array.isArray(m.ev))m.ev.forEach(handleEvent);
      break;
    case 'end':
      if(ses.ended)return;ses.ended=true;
      if(m.r)showResults(m.r);
      ses.net.send({t:'w',w:myWeights()});break;
    case 'tolobby':
      ses.V=null;ses.ended=false;stopGameUI();closeOverlay();showLobby();break;
    case 'closed':
      endSession();overlay(`<h2>部屋が閉じられた</h2><p>ホストが部屋を閉じた。</p><button class="btn" data-ov="menu">トップへ</button>`);break;
  }
}
function clientOnClose(ses){
  if(SES!==ses)return;
  endSession();
  overlay(`<h2>接続が切れた</h2><p>ホストとの通信が途切れた。ホストがアプリを閉じたか、回線が不安定。</p><div class="row-btns"><button class="btn go" data-ov="rejoin" data-code="${esc(ses.code)}">入り直す</button><button class="btn sub" data-ov="menu">トップへ</button></div>`);
}
function prepView(s){s.ev=[];s.log=[];return s;}
function reconcile(ses,s,ack){
  prepView(s);
  ses.pending=ses.pending.filter(p=>p.q>ack);
  for(const p of ses.pending)E.apply(s,ses.me,p.a);
  s.ev=[];s.log=[];
  return s;
}
function stripRoomParam(){
  try{const u=new URL(location.href);if(u.searchParams.has('room')){u.searchParams.delete('room');history.replaceState(null,'',u.toString());}}catch(e){}
}

/* ---------- セッション終了 ---------- */
function endSession(){
  const ses=SES;if(!ses)return;
  SES=null;
  clearInterval(ses.hb);clearInterval(ses.loop);clearTimeout(ses.joinTO);
  if(ses.net){
    try{if(ses.role==='host')ses.net.broadcast({t:'closed'});else ses.net.send({t:'bye'});}catch(e){}
    const n=ses.net;setTimeout(()=>n.close(),150);
  }
  stopGameUI();
}
function leaveSession(silent){
  endSession();
  if(!silent){closeOverlay();renderTitle();show('title');}
}
window.addEventListener('pagehide',()=>{if(SES&&SES.net){try{if(SES.role==='host')SES.net.broadcast({t:'closed'});else SES.net.send({t:'bye'});}catch(e){}}});

/* ================= ロビー ================= */
function inviteLink(code){
  const u=new URL(location.href);const keep=['net','peerhost','peerport','peerpath','peersecure'];
  [...u.searchParams.keys()].forEach(k=>{if(!keep.includes(k))u.searchParams.delete(k);});
  u.searchParams.set('room',code);u.hash='';
  return u.toString();
}
function showLobby(){renderLobby();show('lobby');}
const RULES={
  coop:`<b>協力のルール</b><ul style="margin:4px 0 0;padding-left:18px">
    <li><b>棚の分担</b>：自分の担当の試薬・触媒だけ直接入れられる。色が薄く下線のあるものは仲間の担当（下線の色＝担当者）。</li>
    <li>担当外をタップすると担当者に<b>リクエスト</b>。相手の画面で光り、相手がタップすると<b>あなたのフラスコ</b>に入る（触媒もセットされる）。加熱ボタンは誰でも押せる。</li>
    <li>フラスコ・注文・得点は全員で共有。<b>40秒ごとに棚替え</b>で担当が入れ替わる。</li>
    <li>2人以上で試薬を入れたフラスコを届けると<b>連携ボーナス×1.2</b>。中間体を注いだ人も貢献に数える。</li>
    <li>フラスコを持たずに伝票をタップすると「担当宣言」。💬でスタンプ。人数が多いほど注文も増える。</li></ul>`,
  versus:`<b>対戦のルール</b><ul style="margin:4px 0 0;padding-left:18px">
    <li>注文ボードは全員共通。<b>先に正しく届けた人</b>だけが得点。相手の調合状況は上のバーで見える。</li>
    <li>届けると相手に<b>おじゃま</b>。手順の多い反応（多段階・触媒・高温高圧）・VIP・4連続以上・ラッシュ中ほど強い：1=煙幕 2=在庫切れ 3=引火 4以上=大惨事。狙われるのは首位。</li>
    <li>おじゃまは<b>3.5秒後</b>に着弾。それまでに自分も届ければ<b>相殺</b>、余りは打ち返せる。</li>
    <li>誤配すると答えは見えるが、その注文は<b>出禁</b>。</li></ul>`
};
function renderLobby(){
  const ses=SES;if(!ses)return;
  const host=ses.role==='host';
  const cfg=ses.cfg||{mode:'coop',stageId:'s1',split:true};
  const code=ses.code||'----';
  $('lobCode').textContent=code;
  const qr=$('qr');
  if(qr.dataset.code!==code&&code!=='----'){
    qr.dataset.code=code;
    try{const q=window.qrcode(0,'M');q.addData(inviteLink(code));q.make();qr.innerHTML=q.createSvgTag({cellSize:4,margin:16,scalable:true});}
    catch(e){qr.textContent=code;}
  }
  const ps=ses.players||[];
  let h='';
  for(let s=0;s<4;s++){
    const p=ps.find(x=>x.slot===s);
    if(!p){h+=`<div class="pl empty">空き</div>`;continue;}
    h+=`<div class="pl"><i style="background:${COLORS[p.slot%4]}"></i><span>${p.id==='p0'?'👑':''}${esc(p.name)}</span>${p.id===ses.me?'<small>あなた</small>':''}</div>`;
  }
  $('lobPlayers').innerHTML=h;
  $('lobCount').textContent=`${ps.length} / 4`;
  $('lobMode').querySelectorAll('button').forEach(b=>{b.classList.toggle('on',b.dataset.mode===cfg.mode);b.disabled=!host;});
  $('lobRules').innerHTML=RULES[cfg.mode]||'';
  let sh='';
  [...STAGES,{id:'rv',name:'苦手ミックス',desc:'全員の苦手な反応（★2以下）を集中注文'}].forEach(st=>{
    sh+=`<button class="lst${st.id===cfg.stageId?' on':''}" data-st="${st.id}" ${host?'':'disabled'}><b>${esc(st.name)}</b><span>${esc(st.desc)}</span></button>`;
  });
  $('lobStages').innerHTML=sh;
  $('lobSplitRow').style.display=cfg.mode==='coop'?'':'none';
  $('lobSplit').checked=cfg.split!==false;$('lobSplit').disabled=!host;
  $('lobCoef').checked=!!cfg.coef;$('lobCoef').disabled=!host;
  const st=$('btnStart');
  st.style.display=host?'':'none';
  st.disabled=ps.length<2;
  $('lobWait').textContent=host?(ps.length<2?'友達が入るのを待っている（2〜4人）':`${ps.length}人そろった。開店しよう`):(ses.inGame?'ゲーム中。終わるまで待って':'ホストが開店するのを待っている…');
}
$('lobMode').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(!b||!SES||SES.role!=='host')return;SES.cfg.mode=b.dataset.mode;sfx('tap');lobbyChanged(true);});
$('lobStages').addEventListener('click',e=>{const b=e.target.closest('[data-st]');if(!b||!SES||SES.role!=='host')return;SES.cfg.stageId=b.dataset.st;sfx('tap');lobbyChanged(true);});
$('lobSplit').addEventListener('change',e=>{if(!SES||SES.role!=='host')return;SES.cfg.split=e.target.checked;lobbyChanged(true);});
$('lobCoef').addEventListener('change',e=>{if(!SES||SES.role!=='host')return;SES.cfg.coef=e.target.checked;lobbyChanged(true);});
$('btnStart').addEventListener('click',()=>{audio();hostStartGame();});
$('btnLeave').addEventListener('click',()=>leaveSession(false));
$('btnCopy').addEventListener('click',()=>{if(SES&&SES.code)copyText(inviteLink(SES.code));});
$('btnShare').addEventListener('click',async()=>{
  if(!SES||!SES.code)return;const url=inviteLink(SES.code);
  if(navigator.share){try{await navigator.share({title:'ケミカル・キッチン',text:`部屋コード ${SES.code} で一緒に遊ぼう`,url});return;}catch(e){if(e&&e.name==='AbortError')return;}}
  copyText(url);
});
async function copyText(t){
  let ok=false;
  try{await navigator.clipboard.writeText(t);ok=true;}catch(e){
    const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
    try{ok=document.execCommand('copy');}catch(x){}ta.remove();
  }
  toastLobby(ok?'招待リンクをコピーした':'コピーできなかった：'+t);
}
function toastLobby(msg){
  if(CUR==='game')return;
  const w=$('lobWait');if(!w||CUR!=='lobby')return;
  w.textContent=msg;clearTimeout(toastLobby.t);toastLobby.t=setTimeout(()=>{if(CUR==='lobby')renderLobby();},1800);
}

/* ================= ゲーム画面 ================= */
let WL=null;
async function wake(on){
  try{
    if(on){if(!WL&&navigator.wakeLock){WL=await navigator.wakeLock.request('screen');WL.addEventListener('release',()=>{WL=null;});}}
    else if(WL){const w=WL;WL=null;await w.release();}
  }catch(e){WL=null;}
}
function enterGame(){
  const V=view();if(!V)return;
  UI.active=null;UI.held=null;UI.sig={};UI.lastTick=-1;UI.pauseShown=false;UI.incSig='';
  $('hudStage').textContent=(V.mode==='coop'?'協力・':V.mode==='versus'?'対戦・':'')+E.stageById(V.stageId).name;
  buildTable();
  $('feed').innerHTML='';$('incoming').classList.remove('on');$('game').classList.remove('danger');
  $('mpbar').classList.toggle('on',V.mode!=='solo');
  closeStamps();
  show('game');
  cancelAnimationFrame(UI.raf);UI.last=performance.now();UI.raf=requestAnimationFrame(frame);
  wake(true);
}
function stopGameUI(){
  cancelAnimationFrame(UI.raf);UI.raf=0;clearInterval(UI.cdIv);$('count').classList.remove('on');
  bgmStop();stopHold();wake(false);
  $('ptable').classList.remove('dark');$('incoming').classList.remove('on');$('game').classList.remove('danger');closeStamps();
}
function countdown(cb){
  clearInterval(UI.cdIv);
  const el=$('count');let n=3;el.classList.add('on');el.textContent=n;sfx('tick');
  UI.cdIv=setInterval(()=>{n--;
    if(n>0){el.textContent=n;sfx('tick');}
    else if(n===0){el.textContent='開店！';sfx('ready');}
    else{clearInterval(UI.cdIv);el.classList.remove('on');cb();}
  },650);
}
function frame(now){
  const dt=Math.min(0.1,(now-UI.last)/1000);UI.last=now;
  if(SES&&SES.role==='client'&&SES.V)E.advance(SES.V,dt);
  const V=view();
  if(V&&CUR==='game')render(V);
  UI.raf=requestAnimationFrame(frame);
}
function fmtTime(t){t=Math.max(0,Math.ceil(t));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');}
const myFlasks=V=>V.flasks.filter(f=>E.canUse(V,f,me()));
function ensureActive(V){
  const mine=myFlasks(V);
  let f=mine.find(x=>x.id===UI.active);
  if(!f||f.state!=='idle'){
    const g=mine.find(x=>x.state==='idle');
    const nid=g?g.id:(f?f.id:(mine[0]?mine[0].id:null));
    if(nid!==UI.active){UI.active=nid;if(V.mode==='coop'&&nid!=null&&V.running)act({t:'focus',f:nid});}
  }
  if(UI.held!=null){const h=mine.find(x=>x.id===UI.held);if(!h||h.state!=='ready')UI.held=null;}
}
function setActive(id){UI.active=id;const V=view();if(V&&V.mode==='coop')act({t:'focus',f:id});}

function render(V){
  ensureActive(V);
  const live=V.running&&!V.paused&&!V.over;
  if(live&&!BGM.on&&AC)bgmStart();else if(!live&&BGM.on)bgmStop();
  BGM.tempo=V.rush?150:124;
  if(V.paused&&!UI.pauseShown){UI.pauseShown=true;showPause(V);}
  else if(!V.paused&&UI.pauseShown){UI.pauseShown=false;if(OVK==='pause')closeOverlay();}
  renderHUD(V);
  const so=sigOrders(V);if(so!==UI.sig.o){UI.sig.o=so;renderOrders(V);}
  const sf=sigFlasks(V);if(sf!==UI.sig.f){UI.sig.f=sf;renderFlasks(V);}
  const sc=sigCells(V);if(sc!==UI.sig.c){UI.sig.c=sc;renderCells(V);}
  if(V.mode!=='solo'){const sm=sigMP(V);if(sm!==UI.sig.m){UI.sig.m=sm;renderMP(V);}renderRot(V);}
  renderIncoming(V);
  frameUpdate(V);
  if(live){const sec=Math.ceil(V.t);if(sec<=10&&sec>0&&sec!==UI.lastTick){UI.lastTick=sec;sfx('tick');}}
}
function showPause(V){
  const P=V.players[V.pausedBy];
  const who=P&&V.mode!=='solo'?`<b>${esc(P.name)}</b> が止めた。`:'';
  const canQuit=SES.role!=='client';
  overlay(`<h2>一時停止</h2><p>${who}残り ${fmtTime(V.t)}・${V.mode==='versus'?(V.players[me()].score+'点'):(V.team.score+'点')}</p>
    <div class="row-btns"><button class="btn go" data-ov="resume">再開</button>${canQuit?`<button class="btn sub" data-ov="quit">${SES.role==='host'?'ロビーへ戻る':'店じまい'}</button>`:`<button class="btn sub" data-ov="leave">退出</button>`}</div>`,'pause');
}
function renderHUD(V){
  const P=V.players[me()];
  const C=V.mode==='versus'?P:V.team;
  let sc=String(C?C.score:0);
  if(V.mode==='versus'&&P){
    const rank=1+V.order.filter(q=>q!==me()&&!V.players[q].left&&V.players[q].score>P.score).length;
    sc=`${rank}位 ${sc}`;
  }
  const hs=$('hudScore');if(hs.textContent!==sc)hs.textContent=sc;
  const cb=C&&C.combo>=2?`×${Math.min(4,1+C.combo)} 連続${C.combo}`:'';
  const hc=$('hudCombo');if(hc.textContent!==cb)hc.textContent=cb;
}
function faceFor(r){return r>0.6?'😊':r>0.3?'😐':r>0.15?'😠':'😡';}
function sigOrders(V){
  return V.max+'#'+(UI.held!=null)+'#'+V.coef+'#'+V.orders.map(o=>[o.id,E.hintsOf(V,o,me()),o.claim||'',o.ban&&o.ban[me()]?1:0].join(':')).join('|');
}
// 反応物の表示名（濃・希どちらでもよい場合は「塩酸」のようにまとめる）
function reagentName(e){
  const n=nameOf(e.ids[0]);
  return e.ids.length>1?n.replace(/^[濃希]/,''):n;
}
function hintHTML(V,key,level,mode){
  const it=MENU[key],rs=route(key),last=rs[rs.length-1];
  const chain=rs.length>1?rs.map(x=>fmt(fOf(x.main))).join(' → '):'';
  const lhs=last.r.map(e=>(V.coef&&e.n>1?e.n:'')+esc(reagentName(e))).join('＋');
  const cond=esc(condText(last));
  if(mode==='name'){
    if(level===1)return chain?`手順：${chain}`:`反応物：${lhs}`;
    return `${chain?`最後：${lhs}<br>`:''}条件：${cond}`;
  }
  if(level===1)return `${esc(nameOf(it.t))} ${fmt(fOf(it.t))}${chain?`<br>手順：${chain}`:''}`;
  return `${lhs}／${cond}`;
}
function renderOrders(V){
  const slots=Math.max(4,V.max),three=slots>4;
  const box=$('orders');box.classList.toggle('three',three);
  let h='';
  for(let k=0;k<slots;k++){
    const o=V.orders[k];const it=o&&MENU[o.k];
    if(!it){h+=`<div class="ticket empty"></div>`;continue;}
    const isName=o.mode==='name',tg=TG[it.t]||{p:['?']};
    const clue=isName?`<div class="clue name">${esc(nameOf(it.t))}</div>`:`<div class="clue">${esc(tg.p[o.ci]||tg.p[0])}</div>`;
    const hn=E.hintsOf(V,o,me()),steps=stepsOf(o.k);
    let rev='';
    if(hn>=1)rev+=hintHTML(V,o.k,1,o.mode);
    if(hn>=2)rev+='<br>'+hintHTML(V,o.k,2,o.mode);
    const banned=V.mode==='versus'&&o.ban&&o.ban[me()];
    const cl=V.mode==='coop'&&o.claim&&V.players[o.claim];
    let cls='ticket';if(o.vip)cls+=' vip';if(UI.held!=null&&!banned)cls+=' target';if(cl)cls+=' claimed';if(banned)cls+=' banned';
    h+=`<div class="${cls}" data-o="${o.id}"${cl?` style="--cc:${colorOf(V,o.claim)}"`:''}>
      <div class="t-top"><span class="face" data-face>${faceFor(o.left/o.total)}</span>
        ${o.vip?'<span class="tag vip">VIP×2</span>':''}<span class="tag">${CATNAME[it.c]}</span>${steps>1?`<span class="tag step">${steps}段階</span>`:''}
        <button class="hint" data-act="hint" ${hn>=2?'disabled':''}>ヒント${hn?hn:''}</button></div>
      ${clue}${it.proc?`<div class="proc">${esc(it.proc)}で</div>`:''}${rev?`<div class="reveal">${rev}</div>`:''}
      ${cl?`<span class="claimtag">${esc(cl.name)}</span>`:''}
      <div class="tbar"><i data-bar></i></div></div>`;
  }
  box.innerHTML=h;
}
function sigFlasks(V){
  const foc=V.mode==='coop'?V.order.map(p=>V.players[p].left?'':p+'@'+V.players[p].focus).join(','):'';
  return UI.active+'|'+UI.held+'|'+foc+'|'+myFlasks(V).map(f=>[f.id,f.state,f.items.map(a=>a.join('')).join(','),f.cat,f.heat,f.prod?f.prod.rx+f.prod.over.join(''):'',f.fail?f.fail.why:'',f.taps,f.warned?1:0,Object.keys(f.by).join('')].join(':')).join('/');
}
const HEATBTN=['🌡常温','🔥加熱','🔥高温高圧'],HEATSHORT=['常温','加熱','高圧'];
function itemChip(f,[id,n,poured]){
  const s=SUB[id];if(!s)return '';
  return `<span class="chip${poured?' poured':''}" data-act="chip" data-s="${esc(id)}">${!poured&&n>1?`<b class="co">${n}</b>`:''}${fmt(s.f)}${s.cc?`<small>${s.cc}</small>`:''}</span>`;
}
function renderFlasks(V){
  const mine=myFlasks(V),n=mine.length,coop=V.mode==='coop';
  const box=$('flasks');box.style.gridTemplateColumns=`repeat(${n},minmax(0,1fr))`;box.classList.toggle('four',n>=4);box.classList.toggle('three',n===3);
  const HB=n>=4?['常','熱','高']:n>=3?HEATSHORT:HEATBTN;
  let h='';
  mine.forEach(f=>{
    const lab=FL[f.idx];let cls='flask',st='',body='',btns='';
    if(f.state==='idle'){
      if(f.id===UI.active)cls+=' active'+(coop?' mine':'');
      if(UI.held!=null&&UI.held!==f.id)cls+=' pourable';
      st=UI.held!=null&&UI.held!==f.id?'ここに注げる':f.items.length||f.cat?'調合中':(f.id===UI.active?'ここに投入':'空き');
      body=f.items.map(it=>itemChip(f,it)).join('<i class="plus">+</i>')+(f.cat?`<span class="chip cat" data-act="chip" data-s="@">${fmt(cellLabel('@'+f.cat))}</span>`:'');
      const has=f.items.length>0;
      btns=`<button class="heatb h${f.heat}" data-act="heat" aria-label="温度：${HEAT[f.heat]}">${HB[f.heat]}</button><button data-act="react" ${has?'':'disabled'}>反応</button><button class="dump" data-act="dump" aria-label="捨てる" ${has||f.cat?'':'disabled'}>捨</button>`;
    }else if(f.state==='heat'){
      st=f.heat?'加熱中…':'反応中…';
      body=`<div class="eqp">${f.items.map(([id,n,p])=>`${!p&&n>1?n:''}${fmt(fOf(id))}`).join(' + ')} →${f.cat?`<small>${fmt(cellLabel('@'+f.cat))}</small>`:''}</div>`;btns=`<span class="note">${HEAT[f.heat]}</span>`;
    }else if(f.state==='ready'){
      const x=RXBY[f.prod.rx];
      cls+=UI.held===f.id?' held':' ready';if(f.warned)cls+=' warn';
      st=UI.held===f.id?'伝票へ提供／空きに注ぐ':(f.warned?'焦げそう！':'完成！ タップで持つ');
      body=`<div class="product">${fmt(fOf(x.main))}</div><div class="eq">${eqHTML(x,x.main)}</div>${f.prod.over.length?`<div class="overn">${esc(f.prod.over.join('・'))}（×0.7）</div>`:''}`;
      btns=`<button class="dump" data-act="dump" aria-label="捨てる" style="flex:1">捨てる</button>`;
    }else if(f.state==='fail'){
      cls+=' fail';st='反応しない';body=`<div class="product small">${esc(f.fail?f.fail.why:'反応しない')}</div>`;
      btns=`<button data-act="dump">捨てる</button>`;
    }else if(f.state==='fire'){
      cls+=' fire';st=`消火まで ${4-f.taps} 回`;body=`<div class="fire-ico">🔥</div>`;btns=`<span class="note">連打！</span>`;
    }
    let dots='';
    if(coop){
      dots=V.order.filter(p=>p!==me()&&!V.players[p].left&&V.players[p].focus===f.id).map(p=>`<i style="--dc:${colorOf(V,p)}" title="${esc(V.players[p].name)}"></i>`).join('');
      dots=`<span class="dots">${dots}</span>`;
    }
    h+=`<div class="${cls}" data-f="${f.id}"${coop?` style="--mc:${colorOf(V,me())}"`:''}><div class="f-head"><span class="lab">${lab}</span><span>${st}</span>${dots}</div>
      <div class="f-body">${body}</div><div class="f-bar"><i data-fbar></i></div><div class="f-btns">${btns}</div></div>`;
  });
  box.innerHTML=h;
}
/* ---------- 試薬棚 ---------- */
// ラベル幅（em）の見積もり：セルに収まる文字サイズと改行位置を決める
function labW(t){let w=0;for(const ch of t){w+=/\d/.test(ch)?0.42:/[A-Z]/.test(ch)?0.66:/[a-z]/.test(ch)?0.52:/[()·]/.test(ch)?0.34:1.0;}return w;}
function symHTML(lab){
  if(/[^\x00-\x7f]/.test(lab)&&!/^[濃希]/.test(lab))return {cls:' jp',px:lab.length<=4?11.5:10,html:esc(lab)};
  let cc='';if(/^[濃希]/.test(lab)){cc=lab[0];lab=lab.slice(1);}
  let lines=[lab];
  if(labW(lab)>3.4){
    let best=null;
    let d=0;
    for(let i=0;i<lab.length-1;i++){
      if(i>=2&&d===0&&/[A-Z(]/.test(lab[i])){
        const a=lab.slice(0,i),b=lab.slice(i),m=Math.max(labW(a),labW(b));
        if(!best||m<best.m)best={m,l:[a,b]};
      }
      if(lab[i]==='(')d++;else if(lab[i]===')')d--;
    }
    if(best)lines=best.l;
  }
  const mw=Math.max(...lines.map(labW));
  let px=Math.min(14,Math.floor(34/mw*10)/10);if(cc)px=Math.min(px,12.5);
  return {cls:'',px,html:(cc?`<small class="cc">${cc}</small>`:'')+lines.map(fmt).join('<br>')};
}
function buildTable(){
  let h=`<div class="shelf-cap">試薬棚：タップでフラスコへ／もう一度で係数+1</div>`;
  SHELF.forEach(row=>row.forEach(id=>{h+=cellHTML(id);}));
  h+=`<div class="shelf-cap cat">触媒・脱水剤（矢印の上に書くもの）：タップでセット／もう一度で外す</div>`;
  CATS.forEach(c=>{h+=cellHTML('@'+c);});
  $('ptable').innerHTML=h;$('ptable').classList.remove('dark');
}
function cellHTML(key){
  const y=symHTML(cellLabel(key));
  const kind=key[0]==='@'?'cat':(SUB[key].k||'salt');
  return `<button class="cell r-${kind}" data-el="${esc(key)}" aria-label="${esc(cellName(key))}" title="${esc(cellName(key))}"><span class="sym${y.cls}" style="font-size:${y.px}px">${y.html}</span><span class="bd"></span></button>`;
}
function sigCells(V){
  const own=E.owners(V);
  const rq=V.reqs.filter(r=>r.to===me()||r.from===me()).map(r=>r.s+r.f+r.from).join();
  const lk=E.CELLS_ALL.filter(s=>E.isLocked(V,me(),s)).join();
  return (own?V.rot+V.order.filter(p=>!V.players[p].left).join():'-')+'|'+rq+'|'+lk+'|'+E.isDark(V,me());
}
function renderCells(V){
  const own=E.owners(V),M=me();
  const to={},from={};
  V.reqs.forEach(r=>{if(r.to===M)(to[r.s]=to[r.s]||[]).push(r);if(r.from===M)from[r.s]=(from[r.s]||0)+1;});
  $('ptable').querySelectorAll('.cell').forEach(c=>{
    const s=c.dataset.el,o=own&&own[s],nown=!!o&&o!==M;
    c.classList.toggle('nown',nown);if(nown)c.style.setProperty('--oc',colorOf(V,o));
    c.classList.toggle('locked',E.isLocked(V,M,s));
    const bd=c.querySelector('.bd'),q=to[s];
    c.classList.toggle('req',!!q);
    if(q){
      const r=q[0],f=V.flasks.find(x=>x.id===r.f);
      c.style.setProperty('--rc',colorOf(V,r.from));bd.style.setProperty('--bc',colorOf(V,r.from));
      bd.textContent=`→${f?FL[f.idx]:'?'}${q.length>1?'×'+q.length:''}`;bd.classList.add('on');
    }else if(from[s]){bd.style.setProperty('--bc','#fff');bd.textContent=`依頼${from[s]}`;bd.classList.add('on');}
    else bd.classList.remove('on');
  });
  $('ptable').classList.toggle('dark',E.isDark(V,M));
}
/* ---------- マルチプレイ表示 ---------- */
function miniFlasks(V,pid){
  return V.flasks.filter(f=>f.owner===pid).map(f=>
    f.state==='ready'?`<b class="rd">${fmt(fOf(f.prod.main))}</b>`:
    f.state==='heat'?'<b class="ht">反応中</b>':
    f.state==='fire'?'<b class="fr">🔥</b>':
    f.state==='fail'?'<b>×</b>':
    f.items.length?'<b>…</b>':'').join('');
}
function sigMP(V){
  return V.order.map(p=>{const P=V.players[p];return [p,P.name,P.score,P.left?1:0,V.mode==='versus'?miniFlasks(V,p):''].join(':');}).join('|');
}
function renderMP(V){
  const vs=V.mode==='versus';
  $('mpWho').innerHTML=V.order.map(p=>{
    const P=V.players[p];const isMe=p===me();
    return `<span class="pc${isMe?' me':''}${P.left?' left':''}" style="--pc:${colorOf(V,p)}"><i></i><span class="nm">${esc(isMe?'あなた':P.name)}</span>${vs?`<span class="sc">${P.score}</span>${isMe?'':`<span class="mf">${miniFlasks(V,p)}</span>`}`:''}</span>`;
  }).join('');
}
function renderRot(V){
  const el=$('mpRot');
  if(!V.split||!E.owners(V)){if(el.textContent)el.textContent='';el.style.display='none';return;}
  el.style.display='';
  const s=Math.max(0,Math.ceil(V.rotNext-V.elapsed));
  const t=`棚替え ${s}s`;if(el.textContent!==t)el.textContent=t;
  el.classList.toggle('soon',s<=5&&V.running);
}
function renderIncoming(V){
  const el=$('incoming');
  const P=V.mode==='versus'&&V.players[me()];
  const tot=P?P.inc.reduce((a,x)=>a+x.pow,0):0;
  if(!tot||!V.running){if(UI.incSig){UI.incSig='';el.classList.remove('on');$('game').classList.remove('danger');}return;}
  const t=Math.min(...P.inc.map(x=>x.t));
  const sg=tot+'';
  if(UI.incSig!==sg){
    UI.incSig=sg;
    el.innerHTML=`<span class="big">⚠${tot}</span><span class="lbl">${E.fxName(tot)}</span><span class="bar"><i></i></span>`;
    el.classList.add('on');$('game').classList.add('danger');
  }
  const bar=el.querySelector('.bar i');if(bar)bar.style.transform=`scaleX(${Math.max(0,t/E.WARN_SEC)})`;
}
function frameUpdate(V){
  const tEl=$('hudTime');const tt=fmtTime(V.t);if(tEl.textContent!==tt)tEl.textContent=tt;tEl.classList.toggle('low',V.t<=10&&V.running);
  const tks=$('orders').children;
  V.orders.forEach((o,k)=>{
    const el=tks[k];if(!el)return;const r=Math.max(0,o.left/o.total);
    const bar=el.querySelector('[data-bar]');
    if(bar){bar.style.transform=`scaleX(${r})`;bar.style.background=r>0.5?'var(--cool)':r>0.25?'#f2a900':'var(--hot)';}
    const fc=el.querySelector('[data-face]');if(fc){const f=faceFor(r);if(fc.textContent!==f)fc.textContent=f;}
    el.classList.toggle('low',r<0.2);
  });
  const fls=$('flasks').children;
  myFlasks(V).forEach((f,i)=>{
    const el=fls[i];if(!el)return;const b=el.querySelector('[data-fbar]');if(!b)return;
    if(f.state==='heat'){b.style.width=(f.t/f.dur*100)+'%';b.style.background='#f2a900';}
    else if(f.state==='ready'){b.style.width=(Math.min(1,f.t/11)*100)+'%';b.style.background=f.t>7?'var(--hot)':'var(--cool)';}
    else b.style.width='0';
  });
}
function toast(html,kind,slot){
  const feed=$('feed');const el=document.createElement('div');
  el.className='toast '+(kind||'');el.innerHTML=html;
  if(kind==='st'&&slot!=null)el.style.setProperty('--tc',COLORS[(slot|0)%4]);
  feed.appendChild(el);
  while(feed.children.length>2)feed.removeChild(feed.firstChild);
  setTimeout(()=>{el.remove();},kind==='ng'?2600:1700);
}

/* ---------- 入力 ---------- */
let holdT=0,holdIv=0;
function stopHold(){clearTimeout(holdT);clearInterval(holdIv);holdT=holdIv=0;}
const playable=V=>V&&V.running&&!V.paused&&!V.over;
$('ptable').addEventListener('pointerdown',e=>{
  const c=e.target.closest('.cell');const V=view();if(!c||!playable(V))return;
  e.preventDefault();
  const s=c.dataset.el;
  if(!tryAdd(s,c))return;
  stopHold();
  holdT=setTimeout(()=>{holdIv=setInterval(()=>{if(!tryAdd(s,c))stopHold();},110);},380);
});
['pointerup','pointercancel','pointerleave'].forEach(ev=>$('ptable').addEventListener(ev,stopHold));
$('ptable').addEventListener('contextmenu',e=>e.preventDefault());
function tryAdd(s,cell){
  const V=view();if(!playable(V))return false;const M=me();
  if(E.isLocked(V,M,s)){sfx('lock');toast(`${fmt(cellLabel(s))} は在庫切れ`,'ng');return false;}
  ensureActive(V);
  const own=E.owners(V),req=!!own&&own[s]!==M;
  const pendingToMe=V.reqs.some(r=>r.to===M&&r.s===s);
  const f=V.flasks.find(x=>x.id===UI.active);
  if(!pendingToMe&&(!f||f.state!=='idle'||!E.canUse(V,f,M))){toast('空いているフラスコがない','ng');sfx('lock');return false;}
  if(req&&V.reqs.filter(r=>r.from===M).length>=8){toast('リクエストは8個まで','ng');sfx('lock');return false;}
  if(!req&&!pendingToMe&&f&&s[0]!=='@'){
    const x=f.items.find(y=>y[0]===s);
    if(x&&(x[2]||x[1]>=E.MAX_COEF))return false;
    if(!x&&f.items.length>=E.MAX_SPECIES){toast(`試薬は${E.MAX_SPECIES}種類まで`,'ng');return false;}
  }
  act({t:'add',s,f:f?f.id:null});
  sfx(req?'req':s[0]==='@'?'pop':'tap');
  if(cell){cell.classList.add('hit');setTimeout(()=>cell.classList.remove('hit'),80);}
  return s[0]!=='@';
}
$('flasks').addEventListener('pointerdown',e=>{
  const V=view();if(!playable(V))return;
  const card=e.target.closest('.flask');if(!card)return;
  e.preventDefault();
  const id=+card.dataset.f,f=V.flasks.find(x=>x.id===id);if(!f)return;
  const b=e.target.closest('[data-act]');
  // 完成品を持っているときに空きフラスコをタップ → 注ぎ込む（中間体として使う）
  if(UI.held!=null&&UI.held!==id&&f.state==='idle'&&!(b&&b.dataset.act!=='chip')){
    act({t:'pour',f:UI.held,to:id});UI.held=null;setActive(id);sfx('whoosh');return;
  }
  if(b){
    const a=b.dataset.act;
    if(a==='react'){if(f.state==='idle'&&f.items.length){act({t:'react',f:id});sfx('react');}}
    else if(a==='heat'){if(f.state==='idle'){act({t:'heat',f:id,h:(f.heat+1)%3});sfx('tap');setActive(id);}}
    else if(a==='dump'){act({t:'dump',f:id});sfx('whoosh');if(UI.held===id)UI.held=null;}
    else if(a==='chip'&&f.state==='idle'){act({t:'chip',f:id,s:b.dataset.s});sfx('pop');}
    return;
  }
  if(f.state==='fire'){act({t:'ext',f:id});sfx('whoosh');return;}
  if(f.state==='ready'){UI.held=UI.held===id?null:id;sfx('tap');return;}
  if(f.state==='idle')setActive(id);
});
$('orders').addEventListener('pointerdown',e=>{
  const V=view();if(!playable(V))return;
  const t=e.target.closest('.ticket[data-o]');if(!t)return;
  e.preventDefault();
  const id=+t.dataset.o,o=V.orders.find(x=>x.id===id);if(!o)return;
  if(e.target.closest('[data-act="hint"]')){if(E.hintsOf(V,o,me())<2){act({t:'hint',o:id});sfx('tap');}return;}
  if(UI.held!=null){act({t:'serve',f:UI.held,o:id});UI.held=null;return;}
  if(V.mode==='coop'){act({t:'claim',o:id});sfx('tap');}
});
$('btnPause').addEventListener('click',()=>{const V=view();if(V&&V.running&&!V.paused)act({t:'pause'});});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){const V=view();if(CUR==='game'&&V&&V.running&&!V.paused)act({t:'pause'});}
  if(e.key==='Enter'&&OVK==='join'){e.preventDefault();doJoin();}
});
document.addEventListener('visibilitychange',()=>{
  const V=view();
  if(document.hidden){
    // ホストが裏に回ると進行が止まるので、全員を一時停止にする
    if(SES&&SES.role!=='client'&&V&&V.running&&!V.paused)act({t:'pause'});
  }else if(CUR==='game')wake(true);
});
function closeStamps(){$('stamps').classList.remove('on');}
$('stamps').innerHTML=STAMPS.map((s,i)=>`<button data-k="${i}">${s}</button>`).join('');
$('btnStamp').addEventListener('click',()=>{$('stamps').classList.toggle('on');sfx('tap');});
$('stamps').addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(!b)return;act({t:'stamp',k:+b.dataset.k});closeStamps();});

/* ================= オーバーレイ操作 ================= */
function doJoin(){
  const c=normCode(($('inCode')||{}).value);const n=$('inName2');
  if(n){SAVE.name=n.value.trim().slice(0,10);persist();$('inName').value=SAVE.name;}
  if(c.length!==4){const er=$('joinErr');if(er)er.textContent='4文字のコードを入れて';return;}
  audio();joinRoom(c);
}
$('ov').addEventListener('click',e=>{
  const b=e.target.closest('[data-ov]');if(!b)return;
  const a=b.dataset.ov;
  switch(a){
    case 'close':closeOverlay();break;
    case 'tutgo':SAVE.tut=true;persist();closeOverlay();if(SES&&SES.waitTut){SES.waitTut=false;countdown(beginLocal);}break;
    case 'resume':act({t:'resume'});closeOverlay();UI.pauseShown=false;break;
    case 'quit':
      closeOverlay();
      if(SES&&SES.role==='host')hostToLobby();else leaveSession(false);
      break;
    case 'retry':{const id=SES&&SES.cfg?SES.cfg.stageId:'s1';closeOverlay();startSolo(id);break;}
    case 'next':{const i=STAGES.findIndex(s=>s.id===(SES&&SES.cfg&&SES.cfg.stageId));closeOverlay();if(STAGES[i+1])startSolo(STAGES[i+1].id);break;}
    case 'menu':leaveSession(false);break;
    case 'leave':leaveSession(false);break;
    case 'again':closeOverlay();hostStartGame();break;
    case 'lobby':hostToLobby();break;
    case 'joingo':doJoin();break;
    case 'rejoin':joinRoom(b.dataset.code||'');break;
    case 'rehost':createRoom();break;
  }
});

/* ================= 結果 ================= */
function showResults(r){
  stopHold();bgmStop();wake(false);closeStamps();
  $('ptable').classList.remove('dark');$('incoming').classList.remove('on');$('game').classList.remove('danger');
  sfx('ready');
  if(r.mode==='solo')soloResults(r);
  else if(r.mode==='coop')coopResults(r);
  else versusResults(r);
}
function nightNote(){
  const h=new Date().getHours();
  return (h>=23||h<5)?`<div class="night">🌙 もう${h>=23?h:h+24}時台。今日はここまでにして寝ろ。覚えた物質は眠っている間に記憶として固まる。夜ふかしで睡眠を削るほうが損。</div>`:'';
}
function reviewHTML(r,mode){
  const M=me(),nm=id=>{const p=r.players.find(x=>x.id===id);return p?p.name:'?';};
  const ng=[],ok=[];const seen=new Set();
  (r.log||[]).slice().reverse().forEach(l=>{
    const it=MENU[l.k];if(!it||seen.has(l.k))return;seen.add(l.k);
    const mine=mode!=='versus'||l.by===M;
    if(l.ok&&!l.hinted&&!(l.over&&l.over.length)&&mine)ok.push(l);else ng.push(l);
  });
  const title=it=>`<b>${fmt(fOf(it.t))}</b>　${esc(nameOf(it.t))}${it.proc?`（${esc(it.proc)}）`:''}`;
  let h='';
  if(ng.length){
    h+=`<div class="sec-h">要復習（次回よく注文される）</div><div class="rev">`+ng.map(l=>{
      const it=MENU[l.k];
      let why;
      if(l.ok){
        if(l.by!==M&&mode!=='solo')why=`${esc(nm(l.by))} が提供`;
        else why=[l.hinted?'ヒント使用':'',...(l.over||[])].filter(Boolean).map(esc).join('・');
      }else if(l.given){const g=RXBY[l.given];why=`${g?fmt(fOf(g.main)):'?'} を出した${mode!=='solo'&&l.by!==M?`（${esc(nm(l.by))}）`:''}`;}
      else why=esc(l.why||'');
      return `<div class="it">${title(it)}　<span class="why">${why}</span>${routeHTML(l.k)}</div>`;
    }).join('')+`</div>`;
  }
  if(ok.length){
    h+=`<div class="sec-h">ノーヒントで正解</div><div class="rev">`+ok.map(l=>{
      const it=MENU[l.k],m=mst(l.k);
      return `<div class="it ok">${title(it)}　<span style="color:#e0a100">${stars3(m.box)}</span>${routeHTML(l.k,l.rx)}</div>`;}).join('')+`</div>`;
  }
  return h;
}
function starsRow(stars,score){
  if(!stars)return '';const s=stars.filter(t=>score>=t).length;
  return `<div class="res-stars">${[0,1,2].map(k=>`<span class="${k<s?'on':''}" style="animation-delay:${k*0.25}s">★</span>`).join('')}</div>`;
}
function soloResults(r){
  const st=E.stageById(r.stageId),score=r.team.score;
  const prev=SAVE.best[st.id]||0;if(score>prev)SAVE.best[st.id]=score;persist();
  const idx=STAGES.indexOf(st);
  const canNext=idx>=0&&idx<STAGES.length-1&&unlocked(idx+1);
  let h=`<h2>${score>=(st.stars?st.stars[0]:0)?'営業終了！':'営業終了…'}</h2>
    ${starsRow(st.stars,score)}
    <div class="big-score">${score}<span style="font-size:18px">点</span></div>
    ${st.stars?`<div style="font-size:12px;font-weight:800">★ ${st.stars.join(' / ')} 点　自己ベスト ${SAVE.best[st.id]||0}</div>`:''}
    <div class="stats"><div>提供<b>${r.team.served}</b></div><div>失敗<b>${r.team.failed}</b></div><div>最大連続<b>${r.team.maxCombo}</b></div></div>`;
  h+=nightNote()+reviewHTML(r,'solo');
  h+=`<div class="row-btns">${canNext?'<button class="btn go" data-ov="next">次のステージ</button>':''}<button class="btn" data-ov="retry">もう一回</button><button class="btn sub" data-ov="menu">メニュー</button></div>`;
  overlay(h,'result');
}
function mpButtons(){
  if(SES&&SES.role==='host')return `<div class="row-btns"><button class="btn go" data-ov="again">もう一回</button><button class="btn sub" data-ov="lobby">ロビーへ</button></div>`;
  return `<div class="row-btns"><button class="btn sub" data-ov="leave">退出</button></div><p class="waiting">ホストが「もう一回」を押すと次のゲームが始まる</p>`;
}
function coopResults(r){
  const score=r.team.score,key=r.stageId+':'+r.n;
  const prev=SAVE.coBest[key]||0;if(score>prev)SAVE.coBest[key]=score;persist();
  const ps=r.players.slice().sort((a,b)=>b.pts-a.pts||b.atoms-a.atoms);
  const mvp=ps[0]&&(ps[0].pts>0||ps[0].atoms>0)?ps[0].id:null;
  let h=`<h2>${r.stars&&score>=r.stars[0]?'営業終了！ ナイス連携':'営業終了…'}</h2>
    ${starsRow(r.stars,score)}
    <div class="big-score">${score}<span style="font-size:18px">点</span></div>
    ${r.stars?`<div style="font-size:12px;font-weight:800">${r.n}人の★ ${r.stars.join(' / ')} 点　チームベスト ${SAVE.coBest[key]||0}</div>`:''}
    <div class="stats"><div>提供<b>${r.team.served}</b></div><div>失敗<b>${r.team.failed}</b></div><div>最大連続<b>${r.team.maxCombo}</b></div></div>
    <div class="sec-h">貢献</div><div class="rank">`+ps.map(p=>`<div class="rk" style="--pc:${COLORS[p.slot%4]}"><div class="no">${p.id===mvp?'👑':''}</div>
      <div><div class="nm">${esc(p.name)}${p.id===me()?'（あなた）':''}${p.id===mvp?'<span class="mvp">MVP</span>':''}${p.left?'（退出）':''}</div>
      <div class="sub">提供 ${p.served}・入れた試薬 ${p.atoms}・誤配 ${p.failed}</div></div><div class="sc">${p.pts}</div></div>`).join('')+`</div>`;
  h+=nightNote()+reviewHTML(r,'coop')+mpButtons();
  overlay(h,'result');
}
function versusResults(r){
  const ps=r.players.slice().sort((a,b)=>b.score-a.score);
  const top=ps[0]?ps[0].score:0,winners=ps.filter(p=>p.score===top);
  const M=me(),meWin=winners.some(p=>p.id===M);
  if(SES&&!SES.recorded){
    SES.recorded=true;
    if(winners.length>1&&meWin)SAVE.vs.draw++;else if(meWin)SAVE.vs.win++;else SAVE.vs.lose++;
    persist();
  }
  const title=winners.length>1?'引き分け！':`${esc(winners[0].name)} の勝ち！`;
  let h=`<h2>🏆 ${title}</h2><p style="margin:0;font-weight:800">${meWin?(winners.length>1?'互角だった。':'あなたの勝ち。'):'負け。次は先に作れ。'}　通算 ${SAVE.vs.win}勝${SAVE.vs.lose}敗${SAVE.vs.draw?SAVE.vs.draw+'分':''}</p>
    <div class="rank">`+ps.map(p=>{
      const rank=1+ps.filter(q=>q.score>p.score).length;
      return `<div class="rk${rank===1?' win':''}" style="--pc:${COLORS[p.slot%4]}"><div class="no">${rank}</div>
        <div><div class="nm">${esc(p.name)}${p.id===M?'（あなた）':''}${p.left?'（退出）':''}</div>
        <div class="sub">提供 ${p.served}・誤配 ${p.failed}・最大連続 ${p.maxCombo}<br>おじゃま 送${p.sent}/受${p.recv}・相殺 ${p.offset}</div></div>
        <div class="sc">${p.score}</div></div>`;}).join('')+`</div>`;
  h+=nightNote()+reviewHTML(r,'versus')+mpButtons();
  overlay(h,'result');
}

/* ================= 起動 ================= */
renderTitle();
(()=>{
  const q=new URLSearchParams(location.search);
  const room=normCode(q.get('room'));
  if(room.length===4)joinDialog(room);
})();
// テスト用フック
window.__kk={get SES(){return SES;},view,me,UI};
