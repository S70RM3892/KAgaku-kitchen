// 画面・入力・音・セッション（ソロ／ホスト／参加者）
import {SUB,RXBY,MENU,MKEYS,TG,CATNAME,SHELF,CATS,HEAT,route,eqHTML,condText,nameOf,fOf,cellLabel,cellName,stepsOf,fmt} from './chem.js';
import * as A from './atoms.js';
import * as E from './engine.js';
import {HostNet,ClientNet,PROTO,normCode} from './net.js';
const {COLORS,STAMPS}=E;

/* ================= 保存 ================= */
// モードごとに習熟度・ベストを分けて持つ。rx=反応式モード、atom=組成モード（旧版 v1 の記録を引き継ぐ）
const SAVE_KEY='chem-kitchen-v2';
const blankRec=()=>({mastery:{},best:{},coBest:{}});
let SAVE={name:'',mute:false,tut:false,tutA:false,coef:false,g:'rx',busy:2,ui:{},vs:{win:0,lose:0,draw:0},rx:blankRec(),atom:blankRec()};
try{
  const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
  if(s&&(s.rx||s.atom))Object.assign(SAVE,s);
  else if(s)Object.assign(SAVE,{name:s.name||'',mute:!!s.mute,tut:!!s.tut,coef:!!s.coef,vs:s.vs||SAVE.vs,rx:{mastery:s.mastery||{},best:s.best||{},coBest:s.coBest||{}}});
  const o=JSON.parse(localStorage.getItem('chem-kitchen-v1')||'null');
  if(o&&!SAVE.migratedV1){
    SAVE.migratedV1=true;
    if(!Object.keys(SAVE.atom.mastery||{}).length)SAVE.atom={mastery:o.mastery||{},best:o.best||{},coBest:o.coBest||{}};
    SAVE.tutA=SAVE.tutA||!!o.tut;if(!SAVE.name)SAVE.name=o.name||'';
    if(o.vs&&!(SAVE.vs.win+SAVE.vs.lose+SAVE.vs.draw))SAVE.vs=o.vs;
  }
}catch(e){}
for(const g of ['rx','atom']){SAVE[g]=Object.assign(blankRec(),SAVE[g]||{});}
if(!SAVE.vs)SAVE.vs={win:0,lose:0,draw:0};
if(SAVE.g!=='atom')SAVE.g='rx';
SAVE.busy=Math.min(5,Math.max(1,(SAVE.busy|0)||2));
// 表示・操作の設定（自分で選べる）
const UI_DEF={auto:false,names:false,colors:true,fs:'m',layout:'split',repeat:true,adv:true,bgm:true,vib:true};
SAVE.ui=Object.assign({},UI_DEF,SAVE.ui||{});
function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(SAVE));}catch(e){}}
let persistT=0;function persistSoon(){clearTimeout(persistT);persistT=setTimeout(persist,300);}
const SV=g=>SAVE[g==='atom'?'atom':'rx'];
const knownKey=(g,k)=>g==='atom'?!!A.BYID[k]:!!MENU[k];
const curG=()=>{const V=view();return V&&V.g?V.g:SAVE.g;};
function mst(id,g=curG()){const M=SV(g).mastery;return M[id]||(M[id]={box:0,seen:0,ok:0,ng:0});}
function applyMastery(m,g=curG()){
  if(!Array.isArray(m)||!knownKey(g,m[0]))return;
  const x=mst(m[0],g);
  switch(m[1]){
    case 'seen':x.seen++;break;
    case 'ok':x.box=Math.min(5,x.box+1);x.ok++;break;
    case 'okh':x.ok++;break;
    case 'ng':x.box=0;x.ng++;break;
    case 'exp':x.box=Math.max(0,x.box-1);x.ng++;break;
  }
  persistSoon();
}
function myWeights(g){const w={},M=SV(g).mastery;for(const id in M){const m=M[id];if(m&&m.seen&&knownKey(g,id))w[id]=m.box|0;}return w;}
const allWeights=()=>({rx:myWeights('rx'),atom:myWeights('atom')});
function cleanW(w,g){
  const o={};if(!w||typeof w!=='object')return o;
  for(const id in w)if(knownKey(g,id)&&typeof w[id]==='number')o[id]=Math.max(0,Math.min(5,w[id]|0));
  return o;
}
const cleanWeights=w=>({rx:cleanW(w&&w.rx,'rx'),atom:cleanW(w&&w.atom,'atom')});
const cleanName=s=>String(s||'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,10)||'ケミスト';
const myName=()=>cleanName(SAVE.name);
function reviewPool(g){const M=SV(g).mastery;return Object.keys(M).filter(k=>{const m=M[k];return knownKey(g,k)&&m&&m.seen&&(m.box<=2||m.ng>m.ok);});}
const stagesOf=g=>E.RULES[g==='atom'?'atom':'rx'].stages;
const reviewOf=g=>E.RULES[g==='atom'?'atom':'rx'].review;

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
const UI={sel:null,sig:{},lastTick:-1,raf:0,last:0,cdIv:0,pauseShown:false,incSig:''};
const me=()=>SES?SES.me:'p0';
const view=()=>SES?(SES.role==='client'?SES.V:SES.S):null;
const colorOf=(V,pid)=>{const P=V&&V.players[pid];return COLORS[P?P.slot%4:0];};

/* ================= タイトル ================= */
function starsFor(st,score){if(!st.stars)return 0;return st.stars.filter(t=>score>=t).length;}
// 忙しさごとにベストを分けて記録（ふつうは従来どおりステージIDそのまま）
const busyKey=(id,b)=>(b|0)===2||!b?id:`${id}@${b}`;
const scaledStars=(st,b)=>st.stars?st.stars.map(x=>Math.round(x*E.busyOf(b).star/10)*10):null;
function unlocked(i,g=SAVE.g){
  if(i===0)return true;const p=stagesOf(g)[i-1];
  for(let b=1;b<=5;b++)if(starsFor({stars:scaledStars(p,b)},SV(g).best[busyKey(p.id,b)]||0)>=1)return true;
  return false;
}
function renderBusy(el,cur,disabled){
  el.innerHTML=E.BUSY.slice(1).map((b,i)=>`<button data-b="${i+1}" class="${i+1===cur?'on':''}" ${disabled?'disabled':''}>${['☕','🔥','🔥🔥','🔥🔥🔥','∞'][i]}<small>${b.name}</small></button>`).join('');
  const d=el.nextElementSibling;if(d&&d.classList.contains('busydesc'))d.textContent=E.busyOf(cur).desc;
}
const HOWTO={
  rx:`<b>反応式モード</b>：試薬・<b>触媒</b>・<b>加熱の有無</b>を選んで反応式を組む。MnO₂や濃硫酸は「触媒のとき」と「反応物のとき」があるので要注意。工業的製法は製法名つきで注文される。<br>
      <b>覚え方の仕組み</b>：間違えた・時間切れの反応は結果画面に反応式と条件が出て、次からよく注文される（協力・対戦でも全員の苦手を反映）。ヒント・余計な加熱/触媒では習熟★は上がらない。<br>
      <b>係数判定</b>：ONにすると係数まで合わせないと反応しない（京大ラッシュは常にON）。`,
  atom:`<b>組成モード</b>：本物の周期表（1〜18族×第1〜7周期）から元素を選んで、注文の物質の<b>分子式</b>を組み立てる。タップした元素の名前・周期・族も表示されるので、周期表の位置ごと覚えられる。<br>
      <b>覚え方の仕組み</b>：間違えた・時間切れの物質は答えが表示され、次からよく注文される。ヒントを使うと報酬は減り、習熟（★）は上がらない。★5で習得。<br>
      <b>判定は分子式（組成式）</b>：C₂H₆O ならエタノールでもジメチルエーテルでも同じ扱い。`
};
function renderTitle(){
  const g=SAVE.g,R=SV(g),ST=stagesOf(g),RV=reviewOf(g);
  $('titleGame').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.g===g));
  let h='';
  ST.forEach((st,i)=>{
    const best=R.best[busyKey(st.id,SAVE.busy)]||0,s=starsFor({stars:scaledStars(st,SAVE.busy)},best),lock=!unlocked(i,g);
    h+=`<button class="stage${lock?' locked':''}" data-stage="${i}">
      <div class="no">${lock?'🔒':i+1}</div>
      <div><h3>${esc(st.name)}</h3><p>${esc(st.desc)}${lock?'<br>前のステージで★1を取ると解放':''}</p></div>
      <div class="best"><div class="stars">${'★'.repeat(s)}${'☆'.repeat(3-s)}</div>${best?best+'点':'—'}</div></button>`;
  });
  const weak=reviewPool(g).length,unit=g==='atom'?'物質':'反応';
  h+=`<button class="stage review" data-stage="rv"><div class="no">復</div>
    <div><h3>${RV.name}</h3><p>${weak?`苦手候補 ${weak} ${unit}から集中注文。星なし・何度でも`:`一度でも注文された${unit}が出たら解放`}</p></div>
    <div class="best">${R.best[busyKey('rv',SAVE.busy)]?R.best[busyKey('rv',SAVE.busy)]+'点':'—'}</div></button>`;
  $('stageList').innerHTML=h;
  renderBusy($('titleBusy'),SAVE.busy,false);
  $('btnMute').textContent='音: '+(SAVE.mute?'OFF':'ON');
  $('btnCoef').textContent='係数判定: '+(SAVE.coef?'ON':'OFF');
  $('btnCoef').style.display=g==='rx'?'':'none';
  $('btnDex').textContent=g==='atom'?'物質図鑑':'反応図鑑';
  $('howto').innerHTML=HOWTO[g];
  if(document.activeElement!==$('inName'))$('inName').value=SAVE.name||'';
}
$('titleBusy').addEventListener('click',e=>{const b=e.target.closest('[data-b]');if(!b)return;SAVE.busy=+b.dataset.b;persist();sfx('tap');renderTitle();});
$('titleGame').addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(!b)return;SAVE.g=b.dataset.g==='atom'?'atom':'rx';persist();sfx('tap');renderTitle();});
$('stageList').addEventListener('click',e=>{
  const b=e.target.closest('.stage');if(!b)return;
  audio();
  const v=b.dataset.stage,g=SAVE.g;
  if(v==='rv'){if(!reviewPool(g).length&&!Object.keys(myWeights(g)).length){overlay(`<h2>まだ早い</h2><p>ステージを1回遊ぶと、注文された${g==='atom'?'物質':'反応'}の習熟度が記録され、苦手克服ランが使えるようになる。</p><button class="btn" data-ov="close">閉じる</button>`);return;}startSolo('rv');return;}
  const i=+v;if(!unlocked(i,g))return;startSolo(stagesOf(g)[i].id);
});
$('inName').addEventListener('input',e=>{SAVE.name=e.target.value.trim().slice(0,10);persistSoon();});
$('btnMute').addEventListener('click',()=>{SAVE.mute=!SAVE.mute;persist();audio();if(MASTER)MASTER.gain.value=SAVE.mute?0:0.5;renderTitle();});
$('btnHow').addEventListener('click',()=>tutorial(false));
$('btnCoef').addEventListener('click',()=>{SAVE.coef=!SAVE.coef;persist();renderTitle();});
$('btnDex').addEventListener('click',()=>{renderDex();show('dex');});
$('btnDexBack').addEventListener('click',()=>{renderTitle();show('title');});
$('btnHost').addEventListener('click',()=>{audio();createRoom();});
$('btnJoin').addEventListener('click',()=>{audio();joinDialog('');});

function tutorial(fromGame,g=SAVE.g){
  if(g==='atom'){tutorialA(fromGame);return;}
  overlay(`<h2>遊び方（反応式モード）</h2><div class="tut">
    <div class="step"><span class="n">1</span><div>画面は<b>左右の端に試薬棚</b>、<b>中央に客（伝票）の列</b>。客ごとに専用の鍋があり、中身はいつでも伝票に見える。<b>伝票をタップして選ぶ</b>と、棚の上に「入れ先」が出る。</div></div>
    <div class="step"><span class="n">2</span><div><b>試薬棚</b>をタップして鍋へ。同じ試薬をもう一度で<b>係数+1</b>（濃・希に注意）。必要なら<b>触媒</b>（棚の最下段）、<b>🔥ボタン</b>で 常温→加熱→高温・高圧。</div></div>
    <div class="step"><span class="n">3</span><div>伝票の<b>「反応」</b>。注文どおりの物質ができたら<b>自動で提供</b>（⚙設定の「自動精製」をONにすると、そろった瞬間に反応する）。途中の<b>中間体</b>（SO₂など）ができたら鍋に残るので、続けて次の反応へ＝多段階合成。</div></div>
    <div class="step"><span class="n">4</span><div>条件が合わないと<b>反応しない</b>（序盤は理由が出る）。<b>違う物</b>ができたら−5。失敗した鍋は放置すると<b>燃える</b>（同じ伝票をもう一度タップで消火）。いらない加熱・触媒は報酬×0.7。</div></div>
    <div class="step"><span class="n">5</span><div>反応中は次の客に自動で切り替わるので、何人分も並行して作れる。伝票の「ヒント」は反応物→条件の順（報酬が減り習熟★は上がらない）。</div></div>
    <div class="step"><span class="n">6</span><div><b>友達と遊ぶ</b>：協力は棚の分担とリクエスト、対戦は注文の奪い合いとおじゃま。</div></div>
  </div><button class="btn go" data-ov="${fromGame?'tutgo':'close'}">${fromGame?'開店する':'わかった'}</button>`);
}

function tutorialA(fromGame){
  overlay(`<h2>遊び方（組成モード）</h2><div class="tut">
    <div class="step"><span class="n">1</span><div>周期表は<b>左端に1〜9族、右端に10〜18族</b>。中央が客（伝票）の列で、客ごとの鍋の中身はいつでも見える。<b>伝票をタップして選ぶ</b>。</div></div>
    <div class="step"><span class="n">2</span><div><b>周期表をタップ</b>して選んだ客の鍋に原子を入れる。長押しで連続投入。チップをタップで1個戻す。タップした元素の<b>名前・周期・族・分類</b>が表の上に出る。</div></div>
    <div class="step"><span class="n">3</span><div>伝票の<b>「加熱」</b>。注文どおりの分子式なら<b>自動で提供</b>（⚙設定の「自動精製」ONなら、そろった瞬間に反応）。レシピに無い組成は失敗、別の物質ができたら−5。</div></div>
    <div class="step"><span class="n">4</span><div>失敗した鍋は放置すると<b>燃える</b>（同じ伝票をもう一度タップで消火）。停電中は元素記号が消えるので<b>位置</b>で探す。</div></div>
    <div class="step"><span class="n">5</span><div>伝票の「ヒント」で元素→化学式の順に表示。ただし報酬が減り、習熟★は上がらない。</div></div>
    <div class="step"><span class="n">6</span><div><b>友達と遊ぶ</b>：協力は族ごとの分担（2人なら奇数族と偶数族）とリクエスト、対戦は注文の奪い合いとおじゃま。</div></div>
  </div><button class="btn go" data-ov="${fromGame?'tutgo':'close'}">${fromGame?'開店する':'わかった'}</button>`);
}

/* ================= 図鑑 ================= */
function renderDex(){
  $('dexTitle').textContent=SAVE.g==='atom'?'物質図鑑':'反応図鑑';
  if(SAVE.g==='atom'){renderDexA();return;}
  let h='',seen=0,master=0;
  ['lab','ppt','ind','org'].forEach(c=>{
    const items=MKEYS.filter(k=>MENU[k].c===c);
    h+=`<div class="dex-sec"><h4>${CATNAME[c]}</h4><div class="dex-grid">`;
    items.forEach(k=>{
      const m=SAVE.rx.mastery[k],it=MENU[k];
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
function renderDexA(){
  let h='',seen=0,master=0;
  ['gas','ppt','inorg','org'].forEach(c=>{
    const items=A.DB.filter(d=>d.c===c);
    h+=`<div class="dex-sec"><h4>${A.CATNAME[c]}</h4><div class="dex-grid">`;
    items.forEach(d=>{
      const m=SAVE.atom.mastery[d.id];
      if(m&&m.seen){seen++;if(m.box>=5)master++;
        h+=`<button class="dx" data-dxa="${esc(d.id)}"><div class="f">${fmt(d.f)}</div>${esc(d.n)}<div class="s">${stars3(m.box)}</div></button>`;}
      else h+=`<div class="dx unseen"><div class="f">？？？</div>未注文</div>`;
    });
    h+='</div></div>';
  });
  $('dexList').innerHTML=h;
  $('dexSum').textContent=`出会った物質 ${seen} / ${A.DB.length}　習得（★5） ${master}　対戦成績 ${SAVE.vs.win}勝${SAVE.vs.lose}敗${SAVE.vs.draw?SAVE.vs.draw+'分':''}`;
}
$('dexList').addEventListener('click',e=>{
  const ba=e.target.closest('[data-dxa]');
  if(ba){const d=A.BYID[ba.dataset.dxa];if(!d)return;const m=mst(d.id,'atom');
    overlay(`<h2>${fmt(d.f)}</h2><p style="margin:0 0 6px;font-weight:800">${esc(d.n)}（${A.CATNAME[d.c]}）　分子式 ${fmt(A.hill(d.m))}</p>
      <div class="rev">${d.p.map(x=>`<div class="it ok">${esc(x)}</div>`).join('')}</div>
      <p style="font-size:12px">正解 ${m.ok} 回 / ミス ${m.ng} 回 / 習熟 ${stars3(m.box)}</p>
      <button class="btn" data-ov="close">閉じる</button>`);return;}
  const b=e.target.closest('[data-dx]');if(!b)return;const k=b.dataset.dx,it=MENU[k];if(!it)return;const m=mst(k,'rx');
  const alts=Object.values(RXBY).filter(x=>!it.via&&x.main===it.t&&x.id!==route(k).at(-1).id);
  overlay(`<h2>${fmt(fOf(it.t))}</h2><p style="margin:0 0 6px;font-weight:800">${esc(nameOf(it.t))}（${CATNAME[it.c]}${it.proc?'・'+esc(it.proc):''}）</p>
    <div class="sec-h">作り方</div><div class="rev"><div class="it ok">${routeHTML(k)}</div></div>
    ${alts.length?`<div class="sec-h">別の作り方</div><div class="rev">${alts.map(x=>`<div class="it ok"><div class="eqline">${eqHTML(x,it.t)}<span class="cond">［${condText(x)}］</span>${x.note?`<div class="note2">${esc(x.note)}</div>`:''}</div></div>`).join('')}</div>`:''}
    <div class="sec-h">性質</div><div class="rev">${(TG[it.t]?TG[it.t].p:[]).map(x=>`<div class="it ok">${esc(x)}</div>`).join('')}</div>
    <p style="font-size:12px">正解 ${m.ok} 回 / ミス ${m.ng} 回 / 習熟 ${stars3(m.box)}</p>
    <button class="btn" data-ov="close">閉じる</button>`);
});

/* ================= ソロ ================= */
function startSolo(stageId,g=SAVE.g){
  leaveSession(true);
  const st=E.stageById(g,stageId);
  let pool=null;
  if(st.pool==='review'){const p=reviewPool(g);pool=p.length?p:Object.keys(myWeights(g));}
  const cfg={g,busy:SAVE.busy,auto:SAVE.ui.auto,mode:'solo',stageId,players:[{id:'p0',name:myName(),slot:0}],weights:myWeights(g),pool,coef:g==='rx'&&SAVE.coef};
  SES={role:'solo',me:'p0',cfg,S:E.createGame(cfg)};
  enterGame();
  if(!(g==='atom'?SAVE.tutA:SAVE.tut)&&stageId==='s1'){SES.waitTut=true;tutorial(true,g);}
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
  if(e.s==='hit'){const g=$('game');g.classList.remove('game-flash');void g.offsetWidth;g.classList.add('game-flash');if(SAVE.ui.vib&&navigator.vibrate)try{navigator.vibrate(120);}catch(x){}}
}
function onGameOver(){
  const ses=SES;stopHostLoop();
  const r=E.results(ses.S);
  if(ses.role==='host'){sendSnaps();ses.net.broadcast({t:'end',r});ses.inGame=false;lobbyChanged(false);}
  showResults(r);
}

/* ---------- アクション送信 ---------- */
const PREDICT=new Set(['add','chip','heat','react','dump','ext','hint','focus','pause','resume']);
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
    cfg:{g:SAVE.g,busy:SAVE.busy,auto:SAVE.ui.auto,mode:'coop',stageId:'s1',split:true,coef:false},cids:new Map(),seen:new Map(),wts:{p0:allWeights()},acks:{},q:{},S:null,inGame:false};
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
  const ws=players.map(p=>(ses.wts[p.id]||{})[ses.cfg.g]||{});
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
  net.send({t:'hello',v:PROTO,name:myName(),w:allWeights()});
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
      ses.net.send({t:'w',w:allWeights()});break;
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
    <li><b>鍋は1人ずつ</b>（客ごとに自分の鍋）。伝票をタップして自分が作る客を選ぶ。同じ客を2人で別々に作っても、別々の客を作ってもいい。仲間の鍋の中身は伝票に名前つきで並んで見える。</li>
    <li>担当外をタップすると担当者に<b>リクエスト</b>。相手の画面で光り、相手がタップすると<b>あなたが選んでいる客の鍋</b>に入る（触媒もセットされる）。</li>
    <li>注文どおりにできたら自動で提供。<b>40秒ごとに棚替え</b>。2人以上で入れた鍋は<b>連携ボーナス×1.2</b>。💬でスタンプ。</li></ul>`,
  versus:`<b>対戦のルール</b><ul style="margin:4px 0 0;padding-left:18px">
    <li>注文ボードは全員共通。<b>先に正しく届けた人</b>だけが得点。相手の調合状況は上のバーで見える。</li>
    <li>届けると相手に<b>おじゃま</b>。手順の多い反応（多段階・触媒・高温高圧）・VIP・4連続以上・ラッシュ中ほど強い：1=煙幕 2=在庫切れ 3=引火 4以上=大惨事。狙われるのは首位。</li>
    <li>おじゃまは<b>3.5秒後</b>に着弾。それまでに自分も届ければ<b>相殺</b>、余りは打ち返せる。</li>
    <li>鍋は<b>客ごと×プレイヤーごと</b>。相手がどの客を作っているかは伝票の色の点で見える。違う物を作ると−5。</li></ul>`
};
const RULES_A={
  coop:`<b>協力のルール（組成モード）</b><ul style="margin:4px 0 0;padding-left:18px">
    <li><b>棚の分担</b>：周期表の族ごとに担当が決まる（2人なら奇数族と偶数族）。H（1族）とO（16族）は必ず別担当なので、水・酸・有機物は連携しないと作れない。</li>
    <li><b>鍋は1人ずつ</b>（客ごとに自分の鍋）。伝票をタップして自分が作る客を選ぶ。仲間の鍋の中身も伝票に並んで見える。</li>
    <li>担当外の元素をタップすると担当者に<b>リクエスト</b>。相手がタップすると<b>あなたが選んでいる客の鍋</b>に入る。</li>
    <li>注文どおりにできたら自動で提供。<b>40秒ごとに棚替え</b>。2人以上で入れた鍋は<b>連携ボーナス×1.2</b>。</li></ul>`,
  versus:`<b>対戦のルール（組成モード）</b><ul style="margin:4px 0 0;padding-left:18px">
    <li>注文ボードは全員共通。<b>先に正しく届けた人</b>だけが得点。</li>
    <li>届けると首位の相手に<b>おじゃま</b>。原子が多い物質・VIP・4連続以上・ラッシュ中ほど強い：1=煙幕 2=在庫切れ 3=引火 4以上=大惨事。</li>
    <li>おじゃまは<b>3.5秒後</b>に着弾。それまでに自分も届ければ<b>相殺</b>、余りは打ち返せる。</li>
    <li>鍋は<b>客ごと×プレイヤーごと</b>。違う物を作ると−5。</li></ul>`
};
function renderLobby(){
  const ses=SES;if(!ses)return;
  const host=ses.role==='host';
  const cfg=ses.cfg||{g:'rx',mode:'coop',stageId:'s1',split:true};
  const g=cfg.g==='atom'?'atom':'rx';
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
  $('lobGame').querySelectorAll('button').forEach(b=>{b.classList.toggle('on',b.dataset.g===g);b.disabled=!host;});
  $('lobRules').innerHTML=(g==='atom'?RULES_A:RULES)[cfg.mode]||'';
  let sh='';
  [...stagesOf(g),{id:'rv',name:'苦手ミックス',desc:`全員の苦手な${g==='atom'?'物質':'反応'}（★2以下）を集中注文`}].forEach(st=>{
    sh+=`<button class="lst${st.id===cfg.stageId?' on':''}" data-st="${st.id}" ${host?'':'disabled'}><b>${esc(st.name)}</b><span>${esc(st.desc)}</span></button>`;
  });
  $('lobStages').innerHTML=sh;
  $('lobSplitRow').style.display=cfg.mode==='coop'?'':'none';
  $('lobSplit').checked=cfg.split!==false;$('lobSplit').disabled=!host;
  renderBusy($('lobBusy'),cfg.busy||2,!host);
  $('lobAuto').checked=!!cfg.auto;$('lobAuto').disabled=!host;
  $('lobCoef').checked=!!cfg.coef;$('lobCoef').disabled=!host;$('lobCoefRow').style.display=g==='rx'?'':'none';
  const st=$('btnStart');
  st.style.display=host?'':'none';
  st.disabled=ps.length<2;
  $('lobWait').textContent=host?(ps.length<2?'友達が入るのを待っている（2〜4人）':`${ps.length}人そろった。開店しよう`):(ses.inGame?'ゲーム中。終わるまで待って':'ホストが開店するのを待っている…');
}
$('lobBusy').addEventListener('click',e=>{const b=e.target.closest('[data-b]');if(!b||!SES||SES.role!=='host')return;SES.cfg.busy=+b.dataset.b;SAVE.busy=SES.cfg.busy;persist();sfx('tap');lobbyChanged(true);});
$('lobAuto').addEventListener('change',e=>{if(!SES||SES.role!=='host')return;SES.cfg.auto=e.target.checked;lobbyChanged(true);});
$('lobGame').addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(!b||!SES||SES.role!=='host')return;const g=b.dataset.g==='atom'?'atom':'rx';if(SES.cfg.g!==g){SES.cfg.g=g;SES.cfg.stageId='s1';SAVE.g=g;persist();}sfx('tap');lobbyChanged(true);});
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
  UI.sel=null;UI.sig={};UI.lastTick=-1;UI.pauseShown=false;UI.incSig='';
  $('hudStage').textContent=(V.mode==='coop'?'協力・':V.mode==='versus'?'対戦・':'')+E.stageById(V.g,V.stageId).name+(V.busy&&V.busy!==2?`・${E.busyOf(V.busy).name}`:'');
  buildTable(V.g);
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
// 自分の鍋（協力・ソロは共有、対戦は自分専用）
const myPot=(V,o)=>E.peekPot(V,o,me());
const potState=p=>p?p.state:'idle';
// 選んでいる客がいなくなったら、空いている客のうち一番急ぐ客を選ぶ（協力では他の人が選んでいない客を優先）
function ensureSel(V){
  if(V.orders.some(o=>o.id===UI.sel))return;
  pickNext(V,null);
}
function pickNext(V,skip){
  const others=V.mode==='coop'?new Set(V.order.filter(p=>p!==me()&&!V.players[p].left).map(p=>V.players[p].focus)):new Set();
  const rank=o=>{const p=myPot(V,o),st=potState(p);let r=0;if(st!=='idle')r+=100;if(p&&p.items.length)r+=0;if(others.has(o.id))r+=50;return r+o.left/100;};
  const c=V.orders.filter(o=>o.id!==skip).sort((a,b)=>rank(a)-rank(b))[0]||V.orders[0];
  setSel(c?c.id:null);
}
function setSel(id){
  if(UI.sel===id)return;UI.sel=id;
  const V=view();if(V&&id!=null&&V.running&&V.mode==='coop')act({t:'focus',o:id});
}

function render(V){
  ensureSel(V);
  const live=V.running&&!V.paused&&!V.over;
  const bgmOn=live&&SAVE.ui.bgm;
  if(bgmOn&&!BGM.on&&AC)bgmStart();else if(!bgmOn&&BGM.on)bgmStop();
  BGM.tempo=V.rush?150:124;
  if(V.paused&&!UI.pauseShown){UI.pauseShown=true;showPause(V);}
  else if(!V.paused&&UI.pauseShown){UI.pauseShown=false;if(OVK==='pause')closeOverlay();}
  renderHUD(V);
  const so=sigOrders(V);if(so!==UI.sig.o){UI.sig.o=so;renderOrders(V);}
  const sf=sigTarget(V);if(sf!==UI.sig.f){UI.sig.f=sf;renderTarget(V);}
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
    <div class="row-btns"><button class="btn go" data-ov="resume">再開</button><button class="btn sub" data-ov="settings">⚙ 設定</button>${canQuit?`<button class="btn sub" data-ov="quit">${SES.role==='host'?'ロビーへ戻る':'店じまい'}</button>`:`<button class="btn sub" data-ov="leave">退出</button>`}</div>`,'pause');
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
const potSig=p=>p?[p.state,p.items.map(a=>a.join('')).join(','),p.cat,p.heat,p.fail?p.fail.why:'',p.taps,p.mid||''].join(':'):'-';
function sigOrders(V){
  const foc=V.mode==='coop'?V.order.map(p=>V.players[p].left?'':p+'@'+V.players[p].focus).join(','):'';
  return V.max+'#'+UI.sel+'#'+V.coef+'#'+foc+'#'+V.orders.map(o=>[o.id,E.hintsOf(V,o,me()),Object.entries(o.pots).map(([k,p])=>k+'='+potSig(p)).join(';')].join(':')).join('|');
}
// 鍋の中身（全員がいつでも見えるように伝票に大きく載せる）
const HEATBTN=['🌡常温','🔥加熱','🔥高温高圧'];
function itemChip(V,[id,n,poured]){
  if(V.g==='atom')return `<span class="chip" data-act="chip" data-s="${esc(id)}">${esc(id)}${n>1?`<sub>${n}</sub>`:''}</span>`;
  const s=SUB[id];if(!s)return '';
  return `<span class="chip${poured?' poured':''}" data-act="chip" data-s="${esc(id)}">${!poured&&n>1?`<b class="co">${n}</b>`:''}${fmt(s.f)}${s.cc?`<small>${s.cc}</small>`:''}</span>`;
}
function potInner(V,o,p){
  const st=potState(p),atom=V.g==='atom',items=p?p.items:[];
  if(st==='heat')return `<div class="pin heat"><div class="eqp">${items.map(([id,n,x])=>`${!x&&n>1?n:''}${fmt(atom?id:fOf(id))}`).join(atom?' ':' + ')}${atom?'':` →${p.cat?`<small>${fmt(cellLabel('@'+p.cat))}</small>`:''}`}</div><div class="pbar"><i data-pbar></i></div><span class="pst">${atom||p.heat?'加熱中…':'反応中…'}</span></div>`;
  if(st==='fail')return `<div class="pin fail">✗ ${atom&&p.fail&&p.fail.label?fmt(p.fail.label)+' ':''}${esc(p.fail?p.fail.why:'失敗')}</div>`;
  if(st==='fire')return `<div class="pin fire">🔥 燃えている！ あと${4-p.taps}回</div>`;
  if(!items.length&&!(p&&p.cat))return `<div class="pin empty">${o.id===UI.sel?(atom?'← 周期表をタップ →':'← 試薬棚をタップ →'):'空の鍋'}</div>`;
  const chips=atom?items.map(it=>itemChip(V,it)).join(''):items.map(it=>itemChip(V,it)).join('<i class="plus">+</i>');
  const cat=p.cat?`<span class="chip cat" data-act="chip" data-s="@">${fmt(cellLabel('@'+p.cat))}</span>`:'';
  const mid=p.mid?`<span class="midn">中間体</span>`:'';
  return `<div class="pin mix">${chips}${cat}${mid}</div>`;
}
function cardBtns(V,o,p){
  const st=potState(p),atom=V.g==='atom',has=p&&p.items.length>0;
  if(st==='heat')return '';
  if(st==='fail')return `<button data-act="dump" class="wide">鍋を空にしてやり直す</button>`;
  if(st==='fire')return `<button data-act="ext" class="ext wide">消火！</button>`;
  const h=p?p.heat:0;
  const hb=atom?'':`<button class="heatb h${h}" data-act="heat" aria-label="温度：${HEAT[h]}">${HEATBTN[h]}</button>`;
  const auto=V.auto?'<span class="autob">自動</span>':'';
  return `${hb}<button class="go" data-act="react" ${has?'':'disabled'}>${atom?'加熱':'反応'}${auto}</button><button class="dump" data-act="dump" aria-label="鍋を空にする" ${has||(p&&p.cat)?'':'disabled'}>捨</button>`;
}
function cardWho(V,o,p){
  // 協力：この客を選んでいる仲間、対戦：この客を作っている相手
  if(V.mode==='coop'){
    const foc=V.order.filter(q=>q!==me()&&!V.players[q].left&&V.players[q].focus===o.id);
    return `<span class="who">${foc.map(q=>`<i class="foc" style="--dc:${colorOf(V,q)}" title="${esc(V.players[q].name)}が選択中"></i>`).join('')}</span>`;
  }
  if(V.mode==='versus'){
    return `<span class="who">${V.order.filter(q=>q!==me()&&!V.players[q].left).map(q=>{const op=o.pots[q],s2=potState(op);if(!op||(!op.items.length&&s2==='idle'))return '';return `<i class="foc${s2==='heat'?' hot':''}" style="--dc:${colorOf(V,q)}" title="${esc(V.players[q].name)}"></i>`;}).join('')}</span>`;
  }
  return '';
}
// 協力：仲間それぞれの鍋（この客のぶん）を小さく並べる。選んでいる人・中身がある人だけ
function mateRows(V,o){
  if(V.mode!=='coop')return '';
  const atom=V.g==='atom';
  const rows=V.order.filter(q=>q!==me()&&!V.players[q].left).map(q=>{
    const P=V.players[q],mp=o.pots[q],st=potState(mp),foc=P.focus===o.id;
    const has=mp&&(mp.items.length||mp.cat);
    if(!foc&&!has&&st==='idle')return '';
    let body;
    if(st==='heat')body='<span class="ms heat">反応中…</span>';
    else if(st==='fail')body='<span class="ms fail">✗ 失敗</span>';
    else if(st==='fire')body='<span class="ms fire">🔥</span>';
    else if(has)body=mp.items.map(([id,n,x])=>`<span class="mc">${atom?esc(id)+(n>1?`<sub>${n}</sub>`:''):(!x&&n>1?n:'')+fmt(fOf(id))}</span>`).join('')+(mp.cat?`<span class="mc cat">${fmt(cellLabel('@'+mp.cat))}</span>`:'');
    else body='<span class="ms">空</span>';
    return `<div class="mate${foc?' foc':''}" style="--dc:${colorOf(V,q)}"><b>${esc(P.name)}${foc?' ▶':''}</b>${body}</div>`;
  }).join('');
  return rows?`<div class="mates">${rows}</div>`:'';
}
function cardClass(V,o){
  let cls='ticket card';if(o.vip)cls+=' vip';if(o.id===UI.sel)cls+=' sel';
  const st=potState(myPot(V,o));if(st==='heat')cls+=' cooking';if(st==='fire')cls+=' burning';if(st==='fail')cls+=' failed';
  return cls;
}
function renderOrders(V){
  const slots=Math.max(V.mode==='solo'?3:4,V.max);
  const box=$('orders');box.style.setProperty('--slots',slots);setOrderCols(box,slots);
  const mc=colorOf(V,me());
  let h='';
  for(let k=0;k<slots;k++){
    const o=V.orders[k];
    if(!o){h+=`<div class="ticket empty"></div>`;continue;}
    const isName=o.mode==='name',hn=E.hintsOf(V,o,me()),p=myPot(V,o);
    let clue,tags='',proc='',rev='';
    if(V.g==='atom'){
      const d=A.BYID[o.k];if(!d){h+=`<div class="ticket empty"></div>`;continue;}
      clue=isName?`<div class="clue name">${esc(d.n)}</div>`:`<div class="clue">${esc(d.p[o.ci]||d.p[0])}</div>`;
      tags=`<span class="tag">${isName?'名前':'性質'}</span>`;
      if(hn>=1)rev+=isName?`元素：${Object.keys(d.m).join('・')}`:esc(d.n);
      if(hn>=2)rev+=' / '+fmt(d.f);
    }else{
      const it=MENU[o.k];if(!it){h+=`<div class="ticket empty"></div>`;continue;}
      const tg=TG[it.t]||{p:['?']},steps=stepsOf(o.k);
      clue=isName?`<div class="clue name">${esc(nameOf(it.t))}</div>`:`<div class="clue">${esc(tg.p[o.ci]||tg.p[0])}</div>`;
      tags=`<span class="tag">${CATNAME[it.c]}</span>${steps>1?`<span class="tag step">${steps}段階</span>`:''}`;
      proc=it.proc?`<div class="proc">${esc(it.proc)}で</div>`:'';
      if(hn>=1)rev+=hintHTML(V,o.k,1,o.mode);
      if(hn>=2)rev+='<br>'+hintHTML(V,o.k,2,o.mode);
    }
    h+=`<div class="${cardClass(V,o)}" data-o="${o.id}" style="--mc:${mc}">
      <div class="t-top"><span class="num">${k+1}</span><span class="face" data-face>${faceFor(o.left/o.total)}</span>
        ${o.vip?'<span class="tag vip">VIP×2</span>':''}${tags}${cardWho(V,o,p)}
        <button class="hint" data-act="hint" ${hn>=2?'disabled':''}>ヒント${hn?hn:''}</button></div>
      <div class="c-clue">${clue}${proc}</div>${rev?`<div class="reveal">${rev}</div>`:''}
      ${potInner(V,o,p)}
      ${mateRows(V,o)}
      <div class="c-btns">${cardBtns(V,o,p)}</div>
      <div class="tbar"><i data-bar></i></div></div>`;
  }
  box.innerHTML=h;
}
// 棚の空きに「いまタップすると入る先」を表示
function sigTarget(V){const o=V.orders.find(x=>x.id===UI.sel);return UI.sel+'|'+(o?V.orders.indexOf(o)+'|'+o.mode+E.hintsOf(V,o,me()):'-');}
function renderTarget(V){
  const el=$('ptTarget');if(!el)return;
  const o=V.orders.find(x=>x.id===UI.sel);
  if(!o){el.innerHTML='伝票（客）を選ぶと入れ先が出る';el.style.removeProperty('--mc');return;}
  const T=(E.RULES[V.g]||E.RULES.rx).tgt(o.k);
  const nm=o.mode==='name'||E.hintsOf(V,o,me())>=1?esc(T.n):'性質の注文';
  el.innerHTML=`入れ先 → <b class="num">${V.orders.indexOf(o)+1}</b> ${nm}`;el.style.setProperty('--mc',colorOf(V,me()));
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
function buildTable(g){
  const T=$('ptable'),L=$('ptL'),R=$('ptR');
  T.classList.toggle('rx',g!=='atom');T.classList.toggle('pt',g==='atom');T.classList.remove('dark');
  if(g==='atom'){
    // 周期表を 1〜9族（左端）と 10〜18族（右端）に分けて置く
    const half=(g0,g1,side)=>{
      const off=side==='L'?1:0,lc=side==='L'?1:g1-g0+2;
      let h=`<div class="pt-corner" style="grid-column:${lc};grid-row:1">族</div>`;
      for(let gr=g0;gr<=g1;gr++)h+=`<div class="glab" style="grid-column:${gr-g0+1+off};grid-row:1">${gr}</div>`;
      for(let p=1;p<=7;p++)h+=`<div class="plab" style="grid-column:${lc};grid-row:${p+1}">${p}</div>`;
      A.PT.filter(e=>e.g>=g0&&e.g<=g1).forEach(e=>{h+=cellHTMLA(e,e.g-g0+1+off);});
      return h;
    };
    let hl=half(1,9,'L');
    for(const k of ['*La','*Ac']){
      const P=A.POS[k],nm=k==='*La'?'ランタノイド':'アクチノイド';
      hl+=`<div class="cell c-f ph" style="grid-column:${P.g+1};grid-row:${P.p+1}" title="${nm}（${P.z0}〜${P.z1}）"><span class="z">${P.z0}-${P.z1}</span><span class="sym">${k==='*La'?'*':'**'}</span></div>`;
    }
    hl+=`<div class="pt-info" id="ptInfo" style="grid-column:3 / 11;grid-row:2">元素をタップすると名前・周期・族が出る</div>`;
    hl+=`<div class="pt-legend" style="grid-column:4 / 11;grid-row:3 / 5">${Object.entries(A.CATJP).map(([k,v])=>`<span><i class="c-${k}"></i>${v}</span>`).join('')}</div>`;
    let hr=half(10,18,'R');
    hr+=`<div class="pt-target" id="ptTarget" style="grid-column:1 / 9;grid-row:2"></div>`;
    hr+=`<div class="pt-note" style="grid-column:1 / 4;grid-row:3 / 5">10〜12族は<br>遷移元素</div>`;
    L.innerHTML=hl;R.innerHTML=hr;
  }else{
    // 試薬棚も左右に4列ずつ
    const half=(c0,c1)=>SHELF.map(row=>row.slice(c0,c1).map(cellHTML).join('')).join('');
    L.innerHTML=`<div class="shelf-cap" id="ptInfo">試薬棚：タップで選んだ客の鍋へ</div>`+half(0,4)+`<div class="shelf-cap cat">触媒・脱水剤</div>`+CATS.slice(0,4).map(c=>cellHTML('@'+c)).join('');
    R.innerHTML=`<div class="shelf-cap pt-target" id="ptTarget"></div>`+half(4,8)+`<div class="shelf-cap cat">（矢印の上に書く）</div>`+CATS.slice(4).map(c=>cellHTML('@'+c)).join('');
  }
  UI.sig.f=null;
  requestAnimationFrame(fitTable);
}
function cellHTMLA(e,col){return `<button class="cell c-${e.c}" data-el="${e.s}" style="grid-column:${col??e.g+1};grid-row:${e.p+1}" aria-label="${e.s} ${A.ELNAME[e.s]||''}"><span class="z">${e.z}</span><span class="sym">${e.s}</span><span class="nm">${A.ELNAME[e.s]||''}</span><span class="bd"></span></button>`;}
// 横画面で伝票が細くなりすぎるときは2段に折り返す
function setOrderCols(box,slots){
  const W=box.clientWidth||600;
  const cols=Math.max(1,Math.min(slots,Math.floor(W/104)||1,SAVE.ui.layout==='bottom'?3:2));
  const rows=Math.ceil(slots/cols);
  box.style.setProperty('--cols',cols);box.style.setProperty('--rows',rows);
  // カードが縦に伸びすぎないよう、1段の高さは最大230px
  const H=box.clientHeight;
  if(H>0)box.style.setProperty('--rowh',Math.floor(Math.min(230,(H-(rows-1)*6)/rows))+'px');
}
window.addEventListener('resize',()=>{const b=$('orders');if(b)setOrderCols(b,+getComputedStyle(b).getPropertyValue('--slots')||4);});
// 周期表のマスが縦長になりすぎないよう、行の高さをマスの幅の1.5倍までにする
function fitTable(){
  for(const H of [$('ptL'),$('ptR')]){
    if(!H)continue;
    H.style.gridTemplateRows='';H.style.alignContent='';
    if(!$('ptable').classList.contains('pt'))continue;
    const w=H.clientWidth-8,h=H.clientHeight-8;if(w<=0||h<=0)continue;
    const rh=Math.max(18,Math.min((h-12-14)/7,(w-12-16)/9*1.7));
    H.style.gridTemplateRows=`12px repeat(7,${Math.floor(rh)}px)`;H.style.alignContent='center';
  }
}
window.addEventListener('resize',()=>requestAnimationFrame(fitTable));
window.addEventListener('orientationchange',()=>setTimeout(fitTable,300));
// タップした元素・試薬の情報を表示（覚えるための手がかり）
let infoT=0;
function showInfo(g,k){
  if(g==='atom'){
    const el=$('ptInfo'),e=A.PT.find(x=>x.s===k);if(!el||!e)return;
    el.innerHTML=`<span><b>${e.z} ${esc(e.s)}</b> ${esc(A.ELNAME[e.s]||'')}</span><span>第${e.p}周期・${e.g}族・<i class="c-${e.c}"></i>${esc(A.CATJP[e.c])}</span>`;
    return;
  }
  const cap=$('ptInfo');if(!cap)return;
  cap.textContent=`${cellLabel(k).replace(/\d/g,d=>'₀₁₂₃₄₅₆₇₈₉'[d])}：${cellName(k)}`;cap.classList.add('info');
  clearTimeout(infoT);infoT=setTimeout(()=>{cap.textContent='試薬棚：タップで選んだ客の鍋へ';cap.classList.remove('info');},1800);
}
function cellHTML(key){
  const y=symHTML(cellLabel(key));
  const kind=key[0]==='@'?'cat':(SUB[key].k||'salt');
  return `<button class="cell r-${kind}" data-el="${esc(key)}" aria-label="${esc(cellName(key))}" title="${esc(cellName(key))}"><span class="sym${y.cls}" style="font-size:${y.px}px">${y.html}</span><span class="nm">${esc(cellName(key).replace(/（.*）/,''))}</span><span class="bd"></span></button>`;
}
function sigCells(V){
  const own=E.owners(V);
  const rq=V.reqs.filter(r=>r.to===me()||r.from===me()).map(r=>r.s+r.o+r.from+V.orders.findIndex(x=>x.id===r.o)).join();
  const lk=E.cellsOf(V.g).filter(s=>E.isLocked(V,me(),s)).join();
  return (own?V.rot+V.order.filter(p=>!V.players[p].left).join():'-')+'|'+rq+'|'+lk+'|'+E.isDark(V,me());
}
function renderCells(V){
  const own=E.owners(V),M=me();
  const to={},from={};
  V.reqs.forEach(r=>{if(r.to===M)(to[r.s]=to[r.s]||[]).push(r);if(r.from===M)from[r.s]=(from[r.s]||0)+1;});
  $('ptable').querySelectorAll('.cell[data-el]').forEach(c=>{
    const s=c.dataset.el,o=own&&own[s],nown=!!o&&o!==M;
    c.classList.toggle('nown',nown);if(nown)c.style.setProperty('--oc',colorOf(V,o));
    c.classList.toggle('locked',E.isLocked(V,M,s));
    const bd=c.querySelector('.bd'),q=to[s];
    c.classList.toggle('req',!!q);
    if(q){
      const r=q[0],oi=V.orders.findIndex(x=>x.id===r.o);
      c.style.setProperty('--rc',colorOf(V,r.from));bd.style.setProperty('--bc',colorOf(V,r.from));
      bd.textContent=`→${oi>=0?oi+1:'?'}${q.length>1?'×'+q.length:''}`;bd.classList.add('on');
    }else if(from[s]){bd.style.setProperty('--bc','#fff');bd.textContent=`依頼${from[s]}`;bd.classList.add('on');}
    else bd.classList.remove('on');
  });
  $('ptable').classList.toggle('dark',E.isDark(V,M));
}
/* ---------- マルチプレイ表示 ---------- */
function sigMP(V){
  return V.order.map(p=>{const P=V.players[p];return [p,P.name,P.score,P.left?1:0,V.mode==='coop'?V.orders.findIndex(o=>o.id===(p===me()?UI.sel:P.focus)):''].join(':');}).join('|');
}
function renderMP(V){
  const vs=V.mode==='versus';
  $('mpWho').innerHTML=V.order.map(p=>{
    const P=V.players[p];const isMe=p===me();
    const si=V.mode==='coop'?V.orders.findIndex(o=>o.id===(isMe?UI.sel:P.focus)):-1;
    return `<span class="pc${isMe?' me':''}${P.left?' left':''}" style="--pc:${colorOf(V,p)}"><i></i><span class="nm">${esc(isMe?'あなた':P.name)}</span>${vs?`<span class="sc">${P.score}</span>`:''}${si>=0?`<span class="sel">→${si+1}</span>`:''}</span>`;
  }).join('');
}
function renderRot(V){
  for(const el of [$('mpRot'),$('hudRot')]){
    if(!V.split||!E.owners(V)){if(el.textContent)el.textContent='';el.style.display='none';continue;}
    el.style.display='';
    const s=Math.max(0,Math.ceil(V.rotNext-V.elapsed));
    const t=`棚替え ${s}s`;if(el.textContent!==t)el.textContent=t;
    el.classList.toggle('soon',s<=5&&V.running);
  }
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
  V.orders.forEach((o,k)=>{
    const el=tks[k];if(!el)return;const pb=el.querySelector('[data-pbar]');const p=myPot(V,o);
    if(pb&&p&&p.state==='heat')pb.style.width=(p.t/p.dur*100)+'%';
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
  const c=e.target.closest('.cell[data-el]');const V=view();if(!c||!playable(V))return;
  e.preventDefault();
  const s=c.dataset.el;
  if(!tryAdd(s,c))return;
  stopHold();
  if(SAVE.ui.repeat)holdT=setTimeout(()=>{holdIv=setInterval(()=>{if(!tryAdd(s,c))stopHold();},110);},380);
});
['pointerup','pointercancel','pointerleave'].forEach(ev=>$('ptable').addEventListener(ev,stopHold));
$('ptable').addEventListener('contextmenu',e=>e.preventDefault());
function tryAdd(s,cell){
  const V=view();if(!playable(V))return false;const M=me();
  const RL=E.RULES[V.g]||E.RULES.rx;
  if(E.isLocked(V,M,s)){sfx('lock');toast(`${fmt(RL.label(s))} は在庫切れ`,'ng');return false;}
  ensureSel(V);
  const own=E.owners(V),req=!!own&&own[s]!==M;
  const pendingToMe=V.reqs.some(r=>r.to===M&&r.s===s);
  const o=V.orders.find(x=>x.id===UI.sel),p=o&&myPot(V,o);
  if(!pendingToMe){
    if(!o){toast('伝票（客）を選んでから入れよう','ng');sfx('lock');return false;}
    if(p&&p.state!=='idle'){toast(p.state==='heat'?'この鍋は反応中。別の客を選ぼう':'先に鍋を空けよう','ng');sfx('lock');return false;}
  }
  if(req&&V.reqs.filter(r=>r.from===M).length>=8){toast('リクエストは8個まで','ng');sfx('lock');return false;}
  if(!req&&!pendingToMe&&p&&s[0]!=='@'){
    const x=p.items.find(y=>y[0]===s);
    if(x&&(x[2]||x[1]>=RL.maxCoef))return false;
    if(!x&&p.items.length>=RL.maxSpecies){toast(`${V.g==='atom'?'元素':'試薬'}は${RL.maxSpecies}種類まで`,'ng');return false;}
  }
  act({t:'add',s,o:o?o.id:null});
  showInfo(V.g,s);
  sfx(req?'req':s[0]==='@'?'pop':'tap');
  if(cell){cell.classList.add('hit');setTimeout(()=>cell.classList.remove('hit'),80);}
  return s[0]!=='@';
}
$('orders').addEventListener('pointerdown',e=>{
  const V=view();if(!playable(V))return;
  const t=e.target.closest('.ticket[data-o]');if(!t)return;
  e.preventDefault();
  const id=+t.dataset.o,o=V.orders.find(x=>x.id===id);if(!o)return;
  const p=myPot(V,o),b=e.target.closest('[data-act]');
  if(b){
    const a=b.dataset.act;
    if(a==='hint'){if(E.hintsOf(V,o,me())<2){act({t:'hint',o:id});sfx('tap');}}
    else if(a==='react'){
      if(p&&p.state==='idle'&&p.items.length){
        act({t:'react',o:id});sfx('react');
        if(SAVE.ui.adv&&UI.sel===id){const nx=V.orders.find(x=>x.id!==id&&potState(myPot(V,x))==='idle'&&!(myPot(V,x)&&myPot(V,x).items.length));if(nx){pickNext(V,id);return;}}
      }
    }
    else if(a==='heat'){if(V.g==='rx'&&(!p||p.state==='idle')){act({t:'heat',o:id,h:((p?p.heat:0)+1)%3});sfx('tap');}}
    else if(a==='dump'){act({t:'dump',o:id});sfx('whoosh');}
    else if(a==='ext'){act({t:'ext',o:id});sfx('whoosh');}
    else if(a==='chip'&&p&&p.state==='idle'){act({t:'chip',o:id,s:b.dataset.s});sfx('pop');}
    setSel(id);return;
  }
  if(UI.sel===id&&p&&p.state==='fire'){act({t:'ext',o:id});sfx('whoosh');return;}
  setSel(id);sfx('tap');
});
// 全画面＋横向き固定（対応ブラウザのみ。iPhoneのSafariは非対応なのでボタンを隠す）
const fsOK=!!(document.fullscreenEnabled||document.webkitFullscreenEnabled);
async function goLandscape(){
  try{
    const el=document.documentElement;
    if(!(document.fullscreenElement||document.webkitFullscreenElement)){
      if(el.requestFullscreen)await el.requestFullscreen({navigationUI:'hide'});else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen();
      if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock('landscape').catch(()=>{});
    }else{
      if(document.exitFullscreen)await document.exitFullscreen();else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
    }
  }catch(e){}
}
document.querySelectorAll('[data-fs]').forEach(b=>{b.style.display=fsOK?'':'none';b.addEventListener('click',()=>{audio();goLandscape();});});
document.body.classList.toggle('allow-portrait',!!SAVE.portrait);
$('btnPortrait').addEventListener('click',()=>{SAVE.portrait=true;persist();document.body.classList.add('allow-portrait');});
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

/* ================= 設定（自分で選べるUI） ================= */
const SETTINGS=[
  {k:'auto',t:'自動精製',d:'必要なものがそろったら自動で反応させる（ソロ用。マルチプレイはロビーでホストが決める）',o:[[false,'OFF'],[true,'ON']]},
  {k:'layout',t:'棚の配置',d:'左右に分割：周期表を1〜9族と10〜18族に分けて両端に置き、中央に客の列。下にまとめる：タブレットや縦画面向け',o:[['split','左右に分割'],['bottom','下にまとめる']]},
  {k:'adv',t:'反応後は次の客へ',d:'反応を押したら、空いている客を自動で選ぶ',o:[[true,'ON'],[false,'OFF']]},
  {k:'names',t:'元素名・試薬名',d:'棚のマスに名前も出す（覚え始め向け）',o:[[false,'出さない'],[true,'出す']]},
  {k:'colors',t:'分類の色分け',d:'OFFにすると全部同じ色。位置だけで覚える上級者向け',o:[[true,'ON'],[false,'OFF']]},
  {k:'fs',t:'鍋・伝票の文字',d:'',o:[['s','小'],['m','中'],['l','大']]},
  {k:'repeat',t:'長押しで連続投入',d:'',o:[[true,'ON'],[false,'OFF']]},
  {k:'bgm',t:'BGM',d:'効果音はタイトルの「音」で切り替え',o:[[true,'ON'],[false,'OFF']]},
  {k:'vib',t:'振動',d:'おじゃまが当たったときに振動（対応端末のみ）',o:[[true,'ON'],[false,'OFF']]},
];
function applyUI(){
  const b=document.body.classList,u=SAVE.ui;
  b.toggle('names',!!u.names);b.toggle('mono',!u.colors);b.toggle('lay-bottom',u.layout==='bottom');
  ['s','m','l'].forEach(x=>b.toggle('fs-'+x,u.fs===x));
  UI.sig={};
  const o=$('orders');if(o)setOrderCols(o,+getComputedStyle(o).getPropertyValue('--slots')||4);
  requestAnimationFrame(fitTable);
}
function openSettings(back){
  UI.setBack=back||null;
  const rows=SETTINGS.map(x=>`<div class="set-row"><div class="set-t"><b>${x.t}</b>${x.d?`<small>${x.d}</small>`:''}</div>
    <div class="seg set-seg">${x.o.map(([v,l])=>`<button data-set="${x.k}" data-v='${JSON.stringify(v)}' class="${SAVE.ui[x.k]===v?'on':''}">${l}</button>`).join('')}</div></div>`).join('');
  overlay(`<h2>⚙ 設定</h2><div class="settings">${rows}</div><div class="row-btns"><button class="btn go" data-ov="setclose">閉じる</button></div>`,'settings');
}
$('btnSettings').addEventListener('click',()=>{audio();openSettings(null);});
$('ov').addEventListener('click',e=>{
  const b=e.target.closest('[data-set]');if(!b)return;
  const k=b.dataset.set;let v;try{v=JSON.parse(b.dataset.v);}catch(x){return;}
  SAVE.ui[k]=v;persist();sfx('tap');
  if(k==='auto'&&SES&&SES.role==='solo'&&SES.S)SES.S.auto=v;
  applyUI();openSettings(UI.setBack);
});
applyUI();

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
    case 'tutgo':if(curG()==='atom')SAVE.tutA=true;else SAVE.tut=true;persist();closeOverlay();if(SES&&SES.waitTut){SES.waitTut=false;countdown(beginLocal);}break;
    case 'resume':act({t:'resume'});closeOverlay();UI.pauseShown=false;break;
    case 'quit':
      closeOverlay();
      if(SES&&SES.role==='host')hostToLobby();else leaveSession(false);
      break;
    case 'retry':{const id=SES&&SES.cfg?SES.cfg.stageId:'s1',g=SES&&SES.cfg?SES.cfg.g:SAVE.g;closeOverlay();startSolo(id,g);break;}
    case 'next':{const g=SES&&SES.cfg?SES.cfg.g:SAVE.g,ST=stagesOf(g),i=ST.findIndex(s=>s.id===(SES&&SES.cfg&&SES.cfg.stageId));closeOverlay();if(ST[i+1])startSolo(ST[i+1].id,g);break;}
    case 'menu':leaveSession(false);break;
    case 'leave':leaveSession(false);break;
    case 'again':closeOverlay();hostStartGame();break;
    case 'lobby':hostToLobby();break;
    case 'joingo':doJoin();break;
    case 'rejoin':joinRoom(b.dataset.code||'');break;
    case 'rehost':createRoom();break;
    case 'settings':openSettings('pause');break;
    case 'setclose':{const V=view();if(UI.setBack==='pause'&&V&&V.paused){showPause(V);}else closeOverlay();break;}
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
function reviewHTMLA(r,mode){
  const M=me(),nm=id=>{const p=r.players.find(x=>x.id===id);return p?p.name:'?';};
  const ng=[],ok=[];const seen=new Set();
  (r.log||[]).slice().reverse().forEach(l=>{
    const d=A.BYID[l.k];if(!d||seen.has(l.k))return;seen.add(l.k);
    const mine=mode!=='versus'||l.by===M;
    if(l.ok&&!l.hinted&&mine)ok.push(l);else ng.push(l);
  });
  let h='';
  if(ng.length){
    h+=`<div class="sec-h">要復習（次回よく注文される）</div><div class="rev">`+ng.map(l=>{
      const d=A.BYID[l.k];
      let why;
      if(l.ok)why=l.by===M||mode==='solo'?'ヒント使用':`${esc(nm(l.by))} が提供`;
      else if(l.given)why=`${fmt(esc(l.given))} を出した${mode!=='solo'&&l.by!==M?`（${esc(nm(l.by))}）`:''}`;
      else why=esc(l.why||'');
      return `<div class="it"><b>${fmt(d.f)}</b>　${esc(d.n)}　<span class="why">${why}</span><br>${esc(d.p.join('／'))}</div>`;
    }).join('')+`</div>`;
  }
  if(ok.length){
    h+=`<div class="sec-h">ノーヒントで正解</div><div class="rev">`+ok.map(l=>{
      const d=A.BYID[l.k],m=mst(d.id,'atom');return `<div class="it ok"><b>${fmt(d.f)}</b>　${esc(d.n)}　<span style="color:#e0a100">${stars3(m.box)}</span></div>`;}).join('')+`</div>`;
  }
  return h;
}
function reviewHTML(r,mode){
  if(r.g==='atom')return reviewHTMLA(r,mode);
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
      const it=MENU[l.k],m=mst(l.k,'rx');
      return `<div class="it ok">${title(it)}　<span style="color:#e0a100">${stars3(m.box)}</span>${routeHTML(l.k,l.rx)}</div>`;}).join('')+`</div>`;
  }
  return h;
}
function starsRow(stars,score){
  if(!stars)return '';const s=stars.filter(t=>score>=t).length;
  return `<div class="res-stars">${[0,1,2].map(k=>`<span class="${k<s?'on':''}" style="animation-delay:${k*0.25}s">★</span>`).join('')}</div>`;
}
function soloResults(r){
  const g=r.g==='atom'?'atom':'rx',B=SV(g).best,ST=stagesOf(g);
  const st=E.stageById(g,r.stageId),score=r.team.score,bk=busyKey(st.id,r.busy),stars=r.stars;
  const prev=B[bk]||0;if(score>prev)B[bk]=score;persist();
  const idx=ST.indexOf(st);
  const canNext=idx>=0&&idx<ST.length-1&&unlocked(idx+1,g);
  let h=`<h2>${score>=(stars?stars[0]:0)?'営業終了！':'営業終了…'}</h2>
    ${starsRow(stars,score)}
    <div class="big-score">${score}<span style="font-size:18px">点</span></div>
    ${stars?`<div style="font-size:12px;font-weight:800">忙しさ「${E.busyOf(r.busy).name}」の★ ${stars.join(' / ')} 点　自己ベスト ${B[bk]||0}</div>`:`<div style="font-size:12px;font-weight:800">忙しさ「${E.busyOf(r.busy).name}」 自己ベスト ${B[bk]||0}</div>`}
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
  const score=r.team.score,key=busyKey(r.stageId+':'+r.n,r.busy);
  const CB=SV(r.g).coBest;const prev=CB[key]||0;if(score>prev)CB[key]=score;persist();
  const ps=r.players.slice().sort((a,b)=>b.pts-a.pts||b.atoms-a.atoms);
  const mvp=ps[0]&&(ps[0].pts>0||ps[0].atoms>0)?ps[0].id:null;
  let h=`<h2>${r.stars&&score>=r.stars[0]?'営業終了！ ナイス連携':'営業終了…'}</h2>
    ${starsRow(r.stars,score)}
    <div class="big-score">${score}<span style="font-size:18px">点</span></div>
    ${r.stars?`<div style="font-size:12px;font-weight:800">${r.n}人・${E.busyOf(r.busy).name}の★ ${r.stars.join(' / ')} 点　チームベスト ${CB[key]||0}</div>`:''}
    <div class="stats"><div>提供<b>${r.team.served}</b></div><div>失敗<b>${r.team.failed}</b></div><div>最大連続<b>${r.team.maxCombo}</b></div></div>
    <div class="sec-h">貢献</div><div class="rank">`+ps.map(p=>`<div class="rk" style="--pc:${COLORS[p.slot%4]}"><div class="no">${p.id===mvp?'👑':''}</div>
      <div><div class="nm">${esc(p.name)}${p.id===me()?'（あなた）':''}${p.id===mvp?'<span class="mvp">MVP</span>':''}${p.left?'（退出）':''}</div>
      <div class="sub">提供 ${p.served}・入れた${r.g==='atom'?'原子':'試薬'} ${p.atoms}・誤配 ${p.failed}</div></div><div class="sc">${p.pts}</div></div>`).join('')+`</div>`;
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
