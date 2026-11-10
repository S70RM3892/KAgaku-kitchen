// 画面・入力・音・セッション（ソロ／ホスト／参加者）
import {SUB,RXBY,MENU,MKEYS,TG,CATNAME,SHELF,CATS,HEAT,route,eqHTML,condText,nameOf,fOf,cellLabel,cellName,stepsOf,fmt} from './chem.js';
import * as A from './atoms.js';
import * as O from './org.js';
import * as I from './ion.js';
import {ROOTM,SYNM,WORDM} from './eng.js';
import * as QZ from './quiz.js';
import * as KK from './kakomon.js';
import * as RK from './rank.js';
import * as KSRC from './kakosrc.js';
import {CHEMMAP,SRCN,pick as mapPick} from './chemmap.js';
import * as E from './engine.js';
import {HostNet,ClientNet,PROTO,normCode} from './net.js';
const {COLORS,STAMPS}=E;

/* ================= 保存 ================= */
// モードごとに習熟度・ベストを分けて持つ。rx=反応式モード、atom=組成モード（旧版 v1 の記録を引き継ぐ）、org=官能基モード
const SAVE_KEY='chem-kitchen-v2';
const blankRec=()=>({mastery:{},best:{},coBest:{}});
let KKSAVED=[];      // この端末に読み込んだ過去問（IndexedDB）
let SAVE={name:'',mute:false,tut:false,tutA:false,tutO:false,tutI:false,coef:false,g:'rx',busy:2,ui:{},vs:{win:0,lose:0,draw:0},rx:blankRec(),atom:blankRec(),org:blankRec(),ion:blankRec(),eroot:blankRec(),esyn:blankRec(),eword:blankRec(),quiz:blankRec(),kphy:blankRec(),kchem:blankRec(),kako:blankRec(),kmath:blankRec(),kcalc:blankRec()};
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
const GS=['rx','atom','org','ion','quiz','eroot','esyn','eword','kphy','kchem','kako','kmath','kcalc'];
// 科目：化学（4モード）と英語（3モード）
const ENG=['eroot','esyn','eword'],CHEM=['rx','atom','org','ion','quiz','kcalc'],KYO=['kphy','kchem','kako'],MATHS=['kmath'];
const SUBJ={chem:CHEM,eng:ENG,kyo:KYO,math:MATHS};
const subjOf=g=>ENG.includes(g)?'eng':KYO.includes(g)?'kyo':MATHS.includes(g)?'math':'chem';
for(const g of GS){SAVE[g]=Object.assign(blankRec(),SAVE[g]||{});}
if(!SAVE.vs)SAVE.vs={win:0,lose:0,draw:0};
if(!GS.includes(SAVE.g))SAVE.g='rx';
SAVE.busy=Math.min(5,Math.max(1,(SAVE.busy|0)||2));
// 表示・操作の設定（自分で選べる）
const UI_DEF={auto:true,orient:'auto',names:false,colors:true,fs:'m',layout:'split',repeat:true,adv:true,bgm:true,vib:true};
SAVE.ui=Object.assign({},UI_DEF,SAVE.ui||{});
if((SAVE.uiv|0)<2){SAVE.ui.auto=true;SAVE.uiv=2;}
function persist(){SAVE.lastBy=SAVE.lastBy||{};SAVE.lastBy[subjOf(SAVE.g)]=SAVE.g;try{localStorage.setItem(SAVE_KEY,JSON.stringify(SAVE));}catch(e){}}
let persistT=0;function persistSoon(){clearTimeout(persistT);persistT=setTimeout(persist,300);}
const GK=g=>GS.includes(g)?g:'rx';
const SV=g=>SAVE[GK(g)];
const knownKey=(g,k)=>E.isQuiz(g)?E.QBANK[g].known(k):g==='atom'?!!A.BYID[k]:isParts(g)?PM[g].M.known(k):!!MENU[k];
// モードごとの呼び名
const UNIT={rx:'反応',atom:'物質',org:'化合物',ion:'物質',eroot:'単語',esyn:'構文',eword:'語',quiz:'問題',kphy:'問題',kchem:'問題',kako:'問題',kmath:'問題',kcalc:'問題'};
// 部品で組むモード（官能基・無機イオン）の画面まわり：棚の並び・伝票の種類・ヒント・表示
const PM={
  org:{M:O,unit:'部品',cap:'骨格・官能基：タップで選んだ客の鍋へ',stackCols:6,
    shelf:{L:{main:O.SK,cap2:'検出試薬',bottom:O.TIDS.slice(0,4).map(t=>'@'+t)},R:{main:O.FG,cap2:'（見分けの注文で1つ選ぶ）',bottom:O.TIDS.slice(4).map(t=>'@'+t)}},
    cls:k=>k[0]==='@'?'r-cat':'o-'+OCLS[k],
    kind:k=>O.isPair(k)?'pair':'build',
    hint:(k,l,m)=>l===2&&!O.isPair(k)?O.hint(k,l,m):esc(O.hint(k,l,m)),
    disp:k=>O.isPair(k)?'見分け':fmt(O.BYID[k].f)},
  ion:{M:I,unit:'イオン',cap:I.SHELF.L.cap,stackCols:7,
    shelf:{L:I.SHELF.L,R:I.SHELF.R},
    cls:k=>I.cls(k),
    kind:k=>I.isHalf(k)?'half':'build',
    hint:(k,l,m)=>I.hintHTML(k,l,m),
    disp:k=>I.disp(k)},
};
// 英語の3モード（部品で組む仕組みをそのまま使う）
for(const [g,M,unit,kind] of [['eroot',ROOTM,'部品','build'],['esyn',SYNM,'語句','build'],['eword',WORDM,'語','pick']])
  PM[g]={M,unit,cap:M.SHELF.L.cap,stackCols:6,shelf:M.SHELF,cls:k=>M.cls(k),kind:()=>kind,hint:(k,l,m)=>M.hint(k,l,m),disp:k=>M.disp(k),head:M.head,eng:true};
const isParts=g=>Object.prototype.hasOwnProperty.call(PM,g);
const curG=()=>{const V=view();return V&&V.g?V.g:SAVE.g;};
function mst(id,g=curG()){const M=SV(g).mastery;return M[id]||(M[id]={box:0,seen:0,ok:0,ng:0});}
// 学習記録：日ごとの正解・まちがいの数と遊んだ時間、時刻ごとの解いた数（ダッシュボード用。この端末の中だけ）
const dayKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function statsOf(){const S=SAVE.stats||(SAVE.stats={days:{},hours:Array(24).fill(0)});if(!Array.isArray(S.hours)||S.hours.length!==24)S.hours=Array(24).fill(0);S.days=S.days||{};return S;}
function statDay(d=new Date()){const S=statsOf(),k=dayKey(d);return S.days[k]||(S.days[k]={ok:0,ng:0,ms:0,games:0});}
function statAnswer(ok){
  const S=statsOf(),d=new Date(),D=statDay(d);if(ok)D.ok++;else D.ng++;S.hours[d.getHours()]++;
  const ks=Object.keys(S.days);if(ks.length>400)ks.sort().slice(0,ks.length-400).forEach(k=>delete S.days[k]);   // 古い日は捨てる（約1年分を残す）
}
function applyMastery(m,g=curG()){
  if(!Array.isArray(m)||!knownKey(g,m[0]))return;
  if(m[1]==='ok'||m[1]==='okh')statAnswer(true);else if(m[1]==='ng'||m[1]==='exp')statAnswer(false);
  const x=mst(m[0],g);
  switch(m[1]){
    case 'seen':x.seen++;break;
    case 'ok':x.box=Math.min(5,x.box+1);x.ok++;x.t=Date.now();break;
    case 'okh':x.ok++;x.t=Date.now();break;
    case 'ng':x.box=0;x.ng++;x.t=Date.now();break;
    case 'exp':x.box=Math.max(0,x.box-1);x.ng++;x.t=Date.now();break;
  }
  persistSoon();
}
function myWeights(g){const w={},M=SV(g).mastery;for(const id in M){const m=M[id];if(m&&m.seen&&knownKey(g,id))w[id]=m.box|0;}return w;}
const allWeights=()=>Object.fromEntries(GS.map(g=>[g,myWeights(g)]));
function cleanW(w,g){
  const o={};if(!w||typeof w!=='object')return o;
  for(const id in w)if(knownKey(g,id)&&typeof w[id]==='number')o[id]=Math.max(0,Math.min(5,w[id]|0));
  return o;
}
const cleanWeights=w=>Object.fromEntries(GS.map(g=>[g,cleanW(w&&w[g],g)]));
const cleanName=s=>String(s||'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,10)||'ケミスト';
const myName=()=>cleanName(SAVE.name);
function reviewPool(g){const M=SV(g).mastery;return Object.keys(M).filter(k=>{const m=M[k];return knownKey(g,k)&&m&&m.seen&&(m.box<=2||m.ng>m.ok);});}
const stagesOf=g=>E.RULES[GK(g)].stages;
const reviewOf=g=>E.RULES[GK(g)].review;

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
const safe=h=>esc(h).replace(/&lt;(\/?(?:small|sub|sup|b))&gt;/g,'<$1>');
let CUR='title';
function show(id){CUR=id;document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id===id));document.body.classList.toggle('in-game',id==='game');if(id!=='game')closeStamps();}
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
const rankKey=(g,id,b,coef)=>`${id}@${b|0||2}${g==='rx'&&coef?'+c':''}`;
const rankOn=()=>SAVE.ui.rank!==false;
const scaledStars=(st,b)=>st.stars?st.stars.map(x=>Math.round(x*E.busyOf(b).star/10)*10):null;
function unlocked(i,g=SAVE.g){
  if(i===0||isParts(g)||E.isQuiz(g))return true;const p=stagesOf(g)[i-1];
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
      <b>判定は分子式（組成式）</b>：C₂H₆O ならエタノールでもジメチルエーテルでも同じ扱い。`,
  org:`<b>官能基モード</b>：骨格（CH₃–・C₆H₅–・o-C₆H₄ など）と官能基（–OH・–CHO・–COOH など）の<b>部品を組んで有機化合物を作る</b>。「見分け」の注文では、2つの化合物を区別できる<b>検出試薬</b>（銀鏡・ヨードホルム・FeCl₃・NaHCO₃・さらし粉など）を1つ選ぶ。<br>
      <b>段階を選べる</b>：基礎（官能基入門）→基礎＋（検出反応）→標準（芳香族）→応用（異性体・ひっかけ）→京大（全範囲・性質のみ）。最初から全部選べる。<br>
      <b>覚え方の仕組み</b>：間違えると「何ができたか」「各試薬で何が起きるか」がその場で出て、次からよく注文される。教科書や文献で扱いが割れる反応（ギ酸とフェーリング液など）は正解に使わない。`,
  kcalc:`<b>理論化学 計算</b>：物質量・気体・溶液・エンタルピー・酸塩基と pH・酸化還元滴定・電池と電気分解・反応速度・平衡・結晶格子・有機と高分子の<b>計算問題</b>（全117問・すべて自作）。ヒントは「分野 → 問題文 → 解き方 → 途中の結果」の順に出るので、<b>問題文だけで解ければ最高点</b>。最後のヒントのあと60秒考えられる。まちがいの選択肢は「係数の掛け忘れ」などの<b>よくある間違い</b>の値。<br>正解はすべて計算で確かめてある。原子量や定数は問題文に書いてある。`,
  kmath:`<b>京大数学 早押し</b>：極限・微分・定積分・面積体積・数列・確率・複素数平面・ベクトル・整数・三角指数対数の<b>計算問題</b>（全121問・すべて自作）。ヒントは「分野 → 問題文 → 解き方 → 途中の結果」の順に出るので、<b>問題文だけで解ければ最高点</b>。最後のヒントのあと40秒考えられる。<br>正解はすべて数式処理（sympy）と総当たりの計算で確かめてある。段階：極限と微分 → 積分・数列・関数 → 図形と複素数 → 確率と整数 → 京大ラッシュ。`,
  kphy:`<b>共テ物理 早押し</b>：力学・熱・波動・電磁気・原子の<b>法則・現象・力・物理量</b>を、少しずつ出るヒントから当てる早押し（全84問・すべて自作）。ヒントは分野 → 特徴 → 式・数値の順にはっきりしていく。<br>早いほど高得点、間違えると早いほど大きく減点。<b>段階を選べる</b>：力学→熱と波動→電磁気→原子→共テ総合。`,
  kchem:`<b>共テ化学 早押し</b>：基本法則・気体と溶液の法則・コロイドや溶液の現象・濃度と定数・結晶・化学結合・高分子を当てる早押し（法則・用語・反応名など197問＋物質の早押し問題、すべて自作。分離・周期表・電池・無機工業・有機反応・糖やアミノ酸まで高校化学の全範囲）。<br>早いほど高得点、間違えると早いほど大きく減点。<b>段階を選べる</b>：基本法則と結合→気体・溶液・コロイド→量と定数→高分子→共テ総合（物質の問題も混ざる）。`,
  kako:`<b>過去問 早押し</b>：自分で用意した共テ・センターの物理・化学のPDF（問題と正解）を<b>この端末に読み込み</b>、1問ずつ切り取って早押しにする。問題は<b>上から少しずつ見えていく</b>ので、解けた瞬間に解答番号（①〜⑨・⓪）を押す。<br>
      <b>問題と正解はこの端末のブラウザの中だけに保存</b>され、サーバーやGitHubには送られない（過去問には著作権があるため）。友達と遊ぶときは、ホストだけが読み込んでいればいい（参加者には遊んでいる間だけ画像が届く）。PDFを選ぶだけで、切り取り・正解の割り当て・保存まで自動で行う。`,
  quiz:`<b>早押しクイズ</b>：条件（ヒント）が少しずつ出るので、<b>どの物質か分かった瞬間に選択肢をタップ</b>。早いほど高得点、ただし間違えると早いほど大きく減点され、その問題にはもう答えられない（当てずっぽうは損）。<br>
      問題は組成・官能基・無機イオンモードの物質から165問。ヒントは「分類 → 反応・性質 → 化学式」の順にはっきりしていく。<br>
      <b>友達と遊ぶ</b>と全員で同じ問題を早押し（対戦は個人戦、協力はチームの合計点）。<b>段階を選べる</b>：気体と沈殿→無機→有機→沈殿と錯イオン→京大。`,
  eroot:`<b>語根モード</b>：<b>接頭辞・語根・接尾辞</b>を組んで英単語を作る（pre- ＋ dict ＝ predict）。意味から作る注文と、単語を部品に分ける注文がある。初見の単語の意味を推測する力（下線部和訳）を鍛える。<br><b>段階を選べる</b>：基礎→基礎＋→標準（接尾辞で品詞を変える）→応用→京大。最初から全部選べる。`,
  esyn:`<b>構文モード</b>：too…to・not only…but also・It is not until…that・No sooner had…than など、<b>構文の語句を正しい順に並べて</b>組む（①②は中身の入る場所）。和文英訳で英文の骨組みを作る練習。<br><b>段階を選べる</b>：基礎→It の構文→助動詞＋have・仮定法→倒置→京大（例文だけ）。`,
  eword:`<b>見分けモード</b>：borrow/lend・affect/effect・economic/economical など<b>紛らわしい2語</b>から、例文の空所に入る方を選ぶ。選んだ瞬間に判定、間違えると意味の違いが出る。<br><b>段階を選べる</b>：基礎→つづりが似た語→形容詞→応用・京大（日本語ヒントなし）。`,
  ion:`<b>無機イオンモード</b>：<b>陽イオンと陰イオンを電荷がつり合うように組んで</b>、酸・塩基・塩・酸化物・沈殿・酸化剤／還元剤を作る（例：Al₂(SO₄)₃＝Al³⁺×2＋SO₄²⁻×3）。中心の金属イオンと配位子で<b>錯イオン</b>も組む。<br>
      <b>半反応式の注文</b>：MnO₄⁻ → Mn²⁺（硫酸酸性）のように変化が示されるので、<b>e⁻・H⁺・H₂O（・OH⁻）の数</b>を合わせる。酸化還元滴定の計算の土台。<br>
      <b>段階を選べる</b>：基礎（イオンの組み立て）→基礎＋（酸・塩基・塩）→標準（酸化還元）→応用（沈殿と錯イオン）→京大（全範囲）。最初から全部選べる。`
};
// 今日のメニュー：今日やることを一番上に（復習 → 今日の10問 → 化学マップ）
function todayState(){
  const due=DRILL_BANKS.map(g=>({g,ids:dueIds(g)})).filter(x=>x.ids.length).sort((a,b)=>b.ids.length-a.ids.length);
  const day=dayKey(new Date()),left=DRILL_BANKS.filter(g=>!dailyDone(g,day));
  let tot=0,done=0;mapUnits().forEach(S=>S.units.forEach(u=>u.src.forEach(x=>{tot+=x.ids.length;done+=mapDone(x.g,x.ids);})));
  return {due,left,mapPct:pct(done,tot),dueN:due.reduce((a,x)=>a+x.ids.length,0)};
}
function renderToday(){
  if(!$('todayBox'))return;
  const T=todayState(),st=streakDays(),D=statDay();
  $('todayGoal').innerHTML=goalLine();
  $('todayStreak').textContent=st?`連続 ${st}日`:'';
  $('tmReview').textContent=T.dueN?`${T.dueN}問`:'なし';$('btnReview').disabled=!T.dueN;
  $('tmDaily').textContent=T.left.length?`あと${T.left.length}科目`:'✓ 全部済み';$('btnDaily').classList.toggle('done',!T.left.length);
  $('tmMap').textContent=`${T.mapPct}%`;
  const fresh=!T.dueN&&!Object.values(statsOf().days).some(x=>x.ok+x.ng+x.games>0)&&!GS.some(g=>Object.keys(SV(g).mastery).length);
  $('todayHint').textContent=fresh?'はじめてなら、下のステージ1から。慣れたら「化学マップ」で全単元をひととおり回す。'
    :T.dueN?'まず「復習」を空にする。忘れかける頃に出し直すのが一番定着する。'
    :T.left.length?'復習は済み。「今日の10問」を1回やっておく。':(D.ok+D.ng)>=+(SAVE.ui.goal||30)?'今日のぶんは完了。あとは寝ろ。':'復習と今日の10問は済み。化学マップの「まだ」の単元を進める。';
}
function renderTitle(){
  renderToday();
  const g=SAVE.g,R=SV(g),ST=stagesOf(g),RV=reviewOf(g);
  $('titleGame').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.g===g));
  $('titleGame').dataset.subj=subjOf(g);showModes($('titleGame'),g);$('titleSubj').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.subj===subjOf(g)));
  let h='';
  ST.forEach((st,i)=>{
    const best=R.best[busyKey(st.id,SAVE.busy)]||0,s=starsFor({stars:scaledStars(st,SAVE.busy)},best),lock=!unlocked(i,g);
    h+=`<button class="stage${lock?' locked':''}" data-stage="${i}">
      <div class="no">${lock?'🔒':i+1}</div>
      <div><h3>${st.lvl?`<span class="lvl lv${i+1}${i===ST.length-1?' last':''}">${esc(st.lvl)}</span>`:''}${esc(st.name)}</h3><p>${esc(st.desc)}${lock?'<br>前のステージで★1を取ると解放':''}</p></div>
      <div class="best"><div class="stars">${'★'.repeat(s)}${'☆'.repeat(3-s)}</div>${best?best+'点':'—'}</div></button>`;
  });
  const weak=reviewPool(g).length,unit=UNIT[GK(g)];
  h+=`<button class="stage review" data-stage="rv"><div class="no">復</div>
    <div><h3>${RV.name}</h3><p>${weak?`苦手候補 ${weak} ${unit}から集中注文。星なし・何度でも`:`一度でも注文された${unit}が出たら解放`}</p></div>
    <div class="best">${R.best[busyKey('rv',SAVE.busy)]?R.best[busyKey('rv',SAVE.busy)]+'点':'—'}</div></button>`;
  $('stageList').innerHTML=h;
  renderKakoBox(g);
  renderBusy($('titleBusy'),SAVE.busy,false);
  $('btnMute').textContent='音: '+(SAVE.mute?'OFF':'ON');
  $('btnCoef').textContent='係数判定: '+(SAVE.coef?'ON':'OFF');
  $('btnCoef').style.display=g==='rx'?'':'none';
  $('btnDex').textContent=UNIT[GK(g)]+'図鑑';$('btnDex').style.display=E.isQuiz(g)?'none':'';
  $('howto').innerHTML=HOWTO[GK(g)];
  if(document.activeElement!==$('inName'))$('inName').value=SAVE.name||'';
}
$('titleBusy').addEventListener('click',e=>{const b=e.target.closest('[data-b]');if(!b)return;SAVE.busy=+b.dataset.b;persist();sfx('tap');renderTitle();});
// 科目を切り替えると、その科目で最後に選んだモードに戻る
function pickSubj(sj){const L=SUBJ[sj]||CHEM,last=(SAVE.lastBy||{})[sj]||(sj==='eng'?SAVE.lastEng:sj==='chem'?SAVE.lastChem:null);return L.includes(last)?last:L[0];}
// 科目のボタンに合わせて、モードのボタンを出し分ける
function showModes(box,g){box.querySelectorAll('[data-g]').forEach(b=>{b.style.display=subjOf(b.dataset.g)===subjOf(g)?'':'none';});}
$('titleSubj').addEventListener('click',e=>{const b=e.target.closest('[data-subj]');if(!b)return;SAVE.g=pickSubj(b.dataset.subj);persist();sfx('tap');renderTitle();});
$('lobSubj').addEventListener('click',e=>{const b=e.target.closest('[data-subj]');if(!b||!SES||SES.role!=='host')return;const g=pickSubj(b.dataset.subj);if(SES.cfg.g!==g){SES.cfg.g=g;SES.cfg.stageId='s1';SAVE.g=g;persist();}sfx('tap');lobbyChanged(true);});
$('titleGame').addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(!b)return;SAVE.g=GK(b.dataset.g);persist();sfx('tap');renderTitle();});
$('stageList').addEventListener('click',e=>{
  const b=e.target.closest('.stage');if(!b)return;
  audio();
  const v=b.dataset.stage,g=SAVE.g;
  if(v==='rv'){if(!reviewPool(g).length&&!Object.keys(myWeights(g)).length){overlay(`<h2>まだ早い</h2><p>ステージを1回遊ぶと、注文された${UNIT[GK(g)]}の習熟度が記録され、苦手克服ランが使えるようになる。</p><button class="btn" data-ov="close">閉じる</button>`);return;}startSolo('rv');return;}
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
  if(g==='org'){tutorialO(fromGame);return;}
  if(g==='ion'){tutorialI(fromGame);return;}
  if(ENG.includes(g)){tutorialE(fromGame,g);return;}
  if(g==='kako'){overlay(`<h2>遊び方（過去問 早押し）</h2><div class="tut">${[
    '問題の画像が<b>上から少しずつ見えていく</b>（全部見えてから75秒まで解ける）。',
    '解けたら下の<b>①〜⑨・⓪</b>を押す。解答番号が2つ以上ある問は、その数だけ順に押すと送られる（⌫で1つ戻す）。',
    '早く正解するほど高得点。間違えると減点で、<b>その問題にはもう答えられない</b>。',
    '問題と正解はこの端末にだけ保存される。友達と遊ぶときは、ホストが読み込んでいれば参加者はPDF不要（その場で画像が届き、相手の端末には残らない）。'].map((t,i)=>`<div class="step"><span class="n">${i+1}</span><div>${t}</div></div>`).join('')}</div>
    <button class="btn go" data-ov="${fromGame?'tutgo':'close'}">${fromGame?'開始する':'わかった'}</button>`);return;}
  if(E.isQuiz(g)){overlay(`<h2>遊び方（${E.GAMES[g]}）</h2><div class="tut">${[
    '画面の上に<b>ヒント</b>が数秒ごとに1つずつ増え、だんだん答えに近づく（最後は式や化学式でほぼ答えになる）。',
    '分かったら下の<b>選択肢をタップ</b>。いちばん早く正解した人が得点。ヒントが少ないうちに当てるほど高得点。',
    '間違えると<b>減点</b>（早いほど大きい）で、<b>その問題にはもう答えられない</b>。全員が間違えるか、最後のヒントのあと時間切れで次の問題へ。',
    '全問終わったら結果。答えられなかった問題は、次からよく出る。'].map((t,i)=>`<div class="step"><span class="n">${i+1}</span><div>${t}</div></div>`).join('')}</div>
    <button class="btn go" data-ov="${fromGame?'tutgo':'close'}">${fromGame?'開始する':'わかった'}</button>`);return;}
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

function tutorialO(fromGame){
  overlay(`<h2>遊び方（官能基モード）</h2><div class="tut">
    <div class="step"><span class="n">1</span><div>棚は<b>左に骨格</b>（CH₃–・C₂H₅–・C₆H₅–・o/m/p-C₆H₄・CH₂=CH– など）、<b>右に官能基</b>（–OH・–CHO・–CO–・–COOH・–COO–・–O–・–NH₂ など）、<b>最下段に検出試薬</b>。<b>伝票をタップして選ぶ</b>。</div></div>
    <div class="step"><span class="n">2</span><div><b>組み立ての注文</b>：部品をタップして鍋へ。例：酢酸＝CH₃– ＋ –COOH、アセトン＝CH₃– ×2 ＋ –CO–、サリチル酸＝o-C₆H₄ ＋ –OH ＋ –COOH。同じ部品をもう一度で2個目。</div></div>
    <div class="step"><span class="n">3</span><div>部品がそろったら<b>自動で提供</b>（自動精製OFFなら「組む」）。<b>別の化合物</b>になったら−5で、何ができたかが出る。存在しない組み合わせは失敗（段階が低いほど理由が詳しい）。</div></div>
    <div class="step"><span class="n">4</span><div><b>見分けの注文</b>（例：アセトアルデヒドとアセトン）：区別できる<b>検出試薬を1つ選んだ瞬間に判定</b>。正解なら両方の結果が出る。どちらも同じ結果になる試薬は−5（総当たりはできない）。</div></div>
    <div class="step"><span class="n">5</span><div>「ヒント」は 分類→示性式（性質の注文は 名前→示性式、見分けは 着目点→試薬）。報酬が減り、習熟★は上がらない。</div></div>
    <div class="step"><span class="n">6</span><div><b>友達と遊ぶ</b>：協力は2人なら<b>骨格担当と官能基担当</b>に分かれて1つの化合物を組む。対戦は早い者勝ち。</div></div>
  </div><button class="btn go" data-ov="${fromGame?'tutgo':'close'}">${fromGame?'開店する':'わかった'}</button>`);
}

const ENG_TUT={
  eroot:['棚は<b>左に接頭辞</b>（in-・re-・pre-・trans- など20）、<b>右に語根</b>（spect＝見る・port＝運ぶ・dict＝言う・ject＝投げる など20）、<b>最下段に接尾辞</b>（-ion・-ive・-able・-ure など）。<b>伝票をタップして選ぶ</b>。',
    '<b>意味の注文</b>：「予測する」→ pre- ＋ dict。<b>分解の注文</b>：「transport」→ trans- ＋ port。どちらも部品がそろえば自動で提供。',
    '別の単語になったら−5で何ができたか出る（「respect」など）。存在しない組み合わせは失敗で、段階が低いほど「接頭辞が違う」など理由が詳しい。',
    '部品の意味（spect＝見る など）は、タップすると棚の上に出る。初見の単語を推測する力（下線部和訳）につながる。'],
  esyn:['棚は<b>左右に構文の語句</b>（It is・not until・that・so・too・enough・not only・but also・should・have など）、<b>最下段に①②</b>（中身が入る場所）。',
    '<b>型の注文</b>「①すぎて②できない」→ <b>too → ① → to → ②</b> の<b>順番に</b>タップ。順番が答え。',
    '<b>例文の注文</b>（京大ラッシュなど）では日本語の例文から型を思い出す。語順が違う・足りない語句があるときは失敗、別の構文になったら−5。',
    'チップをタップすると1つ戻せる（戻すと後ろに詰まる）。和文英訳の骨組みを作る練習。'],
  eword:['棚には<b>紛らわしい2語</b>（borrow/lend・affect/effect・economic/economical など24組）が左右に分かれて並ぶ。',
    '伝票の<b>例文の空所</b>に入る語を<b>1つ選んだ瞬間に判定</b>。正解なら意味と完成した文が出る。',
    '違う語を選ぶと−5で、選んだ語の意味が出る（総当たりはできない）。応用・京大では日本語のヒントが消える。',
    '協力は2人なら左の棚と右の棚で担当が分かれる。ペアの2語はふつう別々の人の担当になるので、声をかけ合う。'],
};
function tutorialE(fromGame,g){
  overlay(`<h2>遊び方（${E.GAMES[g]}）</h2><div class="tut">${ENG_TUT[g].map((t,i)=>`<div class="step"><span class="n">${i+1}</span><div>${t}</div></div>`).join('')}</div>
    <button class="btn go" data-ov="${fromGame?'tutgo':'close'}">${fromGame?'開店する':'わかった'}</button>`);
}
function tutorialI(fromGame){
  overlay(`<h2>遊び方（無機イオンモード）</h2><div class="tut">
    <div class="step"><span class="n">1</span><div>棚は<b>左に陽イオン</b>（H⁺・Na⁺・NH₄⁺・Ca²⁺・Fe³⁺・Al³⁺ など）、<b>右に陰イオン</b>（OH⁻・Cl⁻・SO₄²⁻・CO₃²⁻・PO₄³⁻・CH₃COO⁻ など、最下段は酸化剤のイオン）、<b>左の最下段</b>に配位子（NH₃・CN⁻）と半反応式の部品（H₂O・e⁻）。<b>伝票をタップして選ぶ</b>。</div></div>
    <div class="step"><span class="n">2</span><div><b>物質の注文</b>：電荷がつり合うようにイオンを入れる。例：CaCl₂＝Ca²⁺＋Cl⁻×2、Fe₂(SO₄)₃＝Fe³⁺×2＋SO₄²⁻×3、硫酸＝H⁺×2＋SO₄²⁻。酸性塩は NaHSO₄＝Na⁺＋HSO₄⁻（Na⁺＋H⁺＋SO₄²⁻ でもよい）。</div></div>
    <div class="step"><span class="n">3</span><div><b>錯イオン</b>：中心の金属イオン＋配位子を配位数ぶん。例：[Cu(NH₃)₄]²⁺＝Cu²⁺＋NH₃×4、[Fe(CN)₆]⁴⁻＝Fe²⁺＋CN⁻×6。</div></div>
    <div class="step"><span class="n">4</span><div><b>半反応式</b>（例：MnO₄⁻ → Mn²⁺、硫酸酸性）：<b>e⁻・H⁺・H₂O の数</b>を入れる（MnO₄⁻ なら e⁻×5・H⁺×8・H₂O×4）。電子の数は酸化数の変化から、O原子はH₂O、H原子はH⁺で合わせる。</div></div>
    <div class="step"><span class="n">5</span><div>そろえば<b>自動で提供</b>。別の物質になったら−5で何ができたかが出る。電荷がつり合わない・電子の数が違うなどは失敗で、段階が低いほど理由が詳しい。</div></div>
    <div class="step"><span class="n">6</span><div><b>友達と遊ぶ</b>：協力は2人なら<b>陽イオン担当と陰イオン担当</b>に分かれ、1つの鍋に合わせて組む。対戦は早い者勝ち。</div></div>
  </div><button class="btn go" data-ov="${fromGame?'tutgo':'close'}">${fromGame?'開店する':'わかった'}</button>`);
}

/* ================= 過去問の読み込み（端末の中だけで処理） ================= */
KK.loadAll().then(items=>{KKSAVED=items;if(CUR==='title')renderTitle();
  // 中継から開かれたとき（?kkauto=1）：過去問の取り込み画面を開き、中継がつながりしだい自動で取り込む
  if(new URLSearchParams(location.search).has('kkauto')){
    history.replaceState(null,'',location.pathname);
    SAVE.g='kako';persist();if(CUR==='title')renderTitle();kakoImportDialog();UI.kkAutoPending=true;relayWatch();
  }
});
function renderKakoBox(g){
  const el=$('kakoBox');if(!el)return;
  if(g!=='kako'){el.innerHTML='';el.style.display='none';return;}
  el.style.display='';
  const by={};KKSAVED.forEach(it=>{const k=it.year+' '+KK.subjName(it.subj);by[k]=by[k]||{n:0,ok:0};by[k].n++;if(it.on&&it.ans)by[k].ok++;});
  el.innerHTML=`<div class="kk-box"><b>この端末の過去問</b>：${KKSAVED.length?Object.entries(by).sort().map(([k,v])=>`${esc(k)} ${v.ok}問`).join('・'):'まだ無い'}
    <p class="note">問題と正解はこの端末の中だけに保存され、サーバーやGitHubには送られない。</p>
    <div class="row-btns"><button class="btn go" data-kk="auto">⚡ 全自動で取り込む</button><button class="btn sub" data-kk="import">📄 PDFを選ぶ</button>${KKSAVED.length?'<button class="btn sub" data-kk="manage">読み込んだ過去問</button>':''}</div></div>`;
}
// PDFを画面のどこにドロップしても読み込む（パソコン向け）
document.addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')&&!(SES&&SES.role!=='solo')){e.preventDefault();}});
document.addEventListener('drop',e=>{
  const fs=[...(e.dataTransfer&&e.dataTransfer.files||[])].filter(f=>/\.pdf$/i.test(f.name)||f.type==='application/pdf');
  if(!fs.length||(SES&&SES.role!=='solo'&&view()&&view().running))return;e.preventDefault();
  kakoImportDialog();kakoReadFiles(fs);
});
function kakoNeedOverlay(){overlay(`<h2>過去問がまだ無い</h2><p>共テ・センターの物理・化学の<b>問題PDFと正解PDF</b>を、この端末に読み込んでから遊ぶ。</p><div class="row-btns"><button class="btn go" data-kk="import">📄 PDFを読み込む</button><button class="btn sub" data-ov="close">閉じる</button></div>`,'kako');}
const KKI={P:[],A:[],items:[]};      // 取り込み中のPDF・正解・問題
function kakoImportDialog(){
  overlay(`<h2>過去問のPDFを読み込む</h2>
    <p>大学入試センターの<b>問題PDFと正解PDF</b>（物理・化学、何年分でも）をまとめて選ぶ。年度・科目・どの正解がどの問題のものかは自動で判断する。</p>
    <div class="kk-auto">
      <div class="kk-auto-h">⚡ 全自動（この端末の中継を使う）：<span id="kkRelaySt">中継を探している…</span></div>
      <div class="kk-range">
        <select data-kr="from">${[...new Set(KSRC.CATALOG.map(c=>c.year))].sort((a,b)=>b-a).map(y=>`<option ${y===2021?'selected':''}>${y}</option>`).join('')}</select>〜
        <select data-kr="to">${[...new Set(KSRC.CATALOG.map(c=>c.year))].sort((a,b)=>b-a).map(y=>`<option>${y}</option>`).join('')}</select>年度
        <label><input type="checkbox" data-kr="phy" checked>物理</label><label><input type="checkbox" data-kr="chem" checked>化学</label>
        <span id="kkCount" class="note"></span>
      </div>
      <div class="row-btns"><button class="btn go" data-kauto disabled>まだ無い年度を全部取り込む</button><button class="btn sub" data-kstop hidden>止める</button></div>
      <p class="note">自分専用の中継（クラウド）を使うなら、⚙設定で合言葉を入れるだけ。下のコマンドは要らない。</p>
      <details class="kk-how"><summary>この端末で中継を動かす（Termux・パソコン）</summary>
        <p class="note">コピーしたコマンドを、Android は「Termux」（F-Droid 版）、Mac は「ターミナル」、Windows は「PowerShell」（Python が必要）に貼り付けて Enter。
        中継が起動するとこのページが開き、<b>まだ無い年度を自動で取り込み始める</b>。中継はこの端末の中だけで動き、配布元の過去問PDFだけを受け取ってこのページに渡す（保存はしない）。
        パソコンは Chrome か Firefox で（Safari は端末の中の中継につながれない）。Chrome は最初に「ローカルネットワークへのアクセス」を聞くので「許可」。</p>
        <div class="row-btns kk-dl"><button class="btn sub mini" data-krelay="android">Android用をコピー</button><button class="btn sub mini" data-krelay="unix">Mac用をコピー</button><button class="btn sub mini" data-krelay="win">Windows用をコピー</button></div>
        <p class="note" id="kkRelayMsg"></p>
        <p class="note">iPhone・iPad は中継を動かせないので、下の「ショートカット」で保存してから選ぶ。</p>
      </details>
    </div>
    <div class="row-btns"><label class="btn go kk-file">ファイルを選ぶ<input type="file" id="kkFiles" accept="application/pdf,.pdf" multiple hidden></label>
    <label class="btn sub kk-file kk-dir">フォルダごと<input type="file" id="kkDir" webkitdirectory multiple hidden></label></div>
    <p class="note">選ぶだけで、切り取り・正解の割り当て・保存まで全部自動で行う。スキャンしたPDF（画像だけのPDF）は文字を読み取るので、1科目1分ほどかかる。</p>
    <details class="kk-get"><summary>📥 過去問のPDFを手に入れる（2004〜2026年度）</summary>
      <p class="note">配布元はブラウザから直接取り込むことを許していないので、<b>自分の端末</b>でまとめて保存してから選ぶ。
      ファイル名や大きさで年度・科目を自動で見分ける。出どころ：<a href="${KSRC.SOURCE}" target="_blank" rel="noopener">日本の学校「大学入学共通テスト問題＆解答」</a></p>
      <div class="row-btns kk-dl">
        <button class="btn sub mini" data-kdl="urls">URL一覧をコピー</button>
        <button class="btn sub mini" data-kdl="android">Android用コマンドをコピー</button>
        <button class="btn sub mini" data-kdl="unix">Mac用コマンドをコピー</button>
        <button class="btn sub mini" data-kdl="win">Windows用コマンドをコピー</button>
      </div>
      <p class="note" id="kkDlMsg"></p>
      <details class="kk-how"><summary>iPhone・iPad：「ショートカット」で一括保存（最初に1回だけ作る）</summary>
        <ol>
          <li>「ショートカット」App で ＋ を押し、次のアクションを上から順に追加する：<br>
            ①「クリップボードを取得」 ②「テキストを分割」（区切り：改行） ③「各項目を繰り返す」<br>
            ④ 繰り返しの中に「URLの内容を取得」（URL：繰り返し項目） ⑤ その下に「ファイルを保存」（保存先を尋ねる：オフ、保存先：「ファイル」の好きなフォルダ）</li>
          <li>名前を「過去問を保存」などにして完了。</li>
          <li>ここで「URL一覧をコピー」→ ショートカットを実行 → 保存したフォルダのPDFを上の「ファイルを選ぶ」でまとめて選ぶ。</li>
        </ol>
        <p class="note">アクションの名前はiOSのバージョンで少し違うことがある。</p>
      </details>
      <details class="kk-how"><summary>Android：「Termux」で一括保存</summary>
        <ol>
          <li>「Termux」を <b>F-Droid</b> か GitHub から入れる（Google Play 版は更新が止まっている）。</li>
          <li>ここで「Android用コマンドをコピー」→ Termux に貼り付けて Enter。初回だけファイルへのアクセスの許可を聞かれるので「許可」。</li>
          <li>「完了」と出たら、上の「ファイルを選ぶ」で「ダウンロード」→「kakomon」のPDFをまとめて選ぶ。</li>
        </ol>
        <p class="note">2回目からは、コピー → 貼り付けだけ。すでにあるファイルも取り直す。</p>
      </details>
      <details class="kk-how"><summary>パソコン：コマンドで一括保存</summary>
        <p class="note">Mac は「ターミナル」、Windows は「PowerShell」を開き、コピーしたコマンドを貼り付けて Enter。
        今いる場所に kakomon フォルダができ、PDFが1秒おきに保存される。終わったら「フォルダごと」でそのフォルダを選ぶ。</p>
      </details>
      <details class="kk-how"><summary>1つずつ開いて保存する</summary>
      <div class="kk-years">${[...new Set(KSRC.CATALOG.map(c=>c.year))].sort((a,b)=>b-a).map(y=>`<div class="kk-yr"><b>${y}</b>${KSRC.CATALOG.filter(c=>c.year===y).map(c=>`<span>${esc(c.label)} <a href="${esc(c.q)}" target="_blank" rel="noopener">問題</a> <a href="${esc(c.a)}" target="_blank" rel="noopener">正解</a></span>`).join('')}</div>`).join('')}</div>
      </details>
    </details>
    <p class="note" id="kkMsg">読み込みはこの端末の中だけで行う。</p>
    <div class="row-btns"><button class="btn sub" data-ov="close">やめる</button></div>`,'kakoimp');
  $('kkFiles').addEventListener('change',e=>kakoReadFiles([...e.target.files]));
  kakoDlCount();relayWatch();
  const dir=$('kkDir');if(!('webkitdirectory' in dir))dir.parentElement.remove();else dir.addEventListener('change',e=>kakoReadFiles([...e.target.files]));
}
// 自分の端末で一括保存するための一覧（年度の範囲・科目を選ぶ）
function kakoDlPick(){
  const v=k=>document.querySelector(`[data-kr="${k}"]`);if(!v('from'))return [];
  let a=+v('from').value,b=+v('to').value;if(a>b)[a,b]=[b,a];
  return KSRC.pick(a,b,['phy','chem'].filter(k=>v(k).checked));
}
function kakoDlCount(){const el=$('kkCount');if(el){const l=kakoDlPick();el.textContent=`${l.length*2}ファイル`;}}
document.addEventListener('change',e=>{if(e.target.closest('[data-kr]'))kakoDlCount();});
document.addEventListener('click',async e=>{
  if(e.target.closest('[data-kauto]')){kakoAutoImport();return;}
  if(e.target.closest('[data-kstop]')){if(AUTO_RUN)AUTO_RUN.stop=true;const m=$('kkMsg');if(m)m.textContent='今の組が終わったら止める…';return;}
  const rb=e.target.closest('[data-krelay]');
  if(rb){const t=relayCmd[rb.dataset.krelay]();let ok=false;try{await navigator.clipboard.writeText(t);ok=true;}catch(err){}
    if(!ok){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{ok=document.execCommand('copy');}catch(err){}ta.remove();}
    const m=$('kkRelayMsg');if(m)m.textContent=ok?'中継の起動コマンドをコピーした':'コピーできなかった';return;}
  const b=e.target.closest('[data-kdl]');if(!b)return;
  const l=kakoDlPick(),msg=$('kkDlMsg');if(!l.length){if(msg)msg.textContent='年度と科目を選ぶ';return;}
  const k=b.dataset.kdl,t=k==='urls'?KSRC.urlList(l):k==='unix'?KSRC.cmdUnix(l):k==='android'?KSRC.cmdAndroid(l):KSRC.cmdWin(l);
  let ok=false;try{await navigator.clipboard.writeText(t);ok=true;}catch(err){}
  if(!ok){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{ok=document.execCommand('copy');}catch(err){}ta.remove();}
  if(msg)msg.textContent=ok?`コピーした（${l.length*2}ファイル分）`:'コピーできなかった。長押しで選んでコピーして';
});
// 選んだPDFを読み込む。年度・科目ごとに分けて1組ずつ読み、保存してからメモリを空ける（何十年分でも重くならない）
async function kakoReadFiles(files,opt={}){
  files=files.filter(f=>/\.pdf$/i.test(f.name)||f.type==='application/pdf');
  const groups=new Map();
  for(const f of files){const L=KSRC.lookup(f.name,f.size),k=L?L.year+'-'+L.subj:'?';(groups.get(k)||groups.set(k,[]).get(k)).push(f);}
  const all=[],bad=[];let gi=0;
  for(const fs of groups.values()){
    gi++;if(opt.stop&&opt.stop())break;
    const r=await kakoReadGroup(fs,groups.size>1?`[${gi}/${groups.size}] `:'',groups.size===1&&!opt.quiet);
    if(r.err)bad.push(r.err);else all.push(...r.recs);
  }
  if(!opt.quiet)import('./ocr.js').then(O=>O.ocrDone()).catch(()=>{});
  if(opt.quiet)return {recs:all,bad};
  kakoSummary(all,bad,groups.size===1);
}
function kakoSummary(all,bad,canReview){
  const msg=$('kkMsg');
  if(!all.length){if(msg)msg.textContent=bad.length?bad.join(' / '):'問題が見つからなかった。問題PDFも選ぶ';return;}
  const by={};all.forEach(r=>{const k=r.year+' '+KK.subjName(r.subj);by[k]=by[k]||{n:0,ok:0};by[k].n++;if(r.on&&r.ans)by[k].ok++;});
  const ng=all.filter(r=>!r.ans).length;
  overlay(`<h2>読み込み完了</h2><p>自動で切り取り・正解の割り当て・保存まで終えた。</p>
    <div class="kk-sum">${Object.entries(by).sort().map(([k,v])=>`<div><b>${esc(k)}</b>　${v.ok}問${v.ok<v.n?`<small>（正解が読めず出題しない ${v.n-v.ok}問）</small>`:''}</div>`).join('')}</div>
    ${bad.length?`<p class="note">読めなかったもの：${esc(bad.join(' / '))}</p>`:''}
    ${ng?`<p class="note">正解が読めなかった問は出題しない（正解PDFも一緒に選ぶと出題できることがある）。</p>`:''}
    <div class="row-btns"><button class="btn go" data-ov="close">遊ぶ</button>${canReview?'<button class="btn sub" data-kk="review">切り取りを確認・手直し</button>':''}</div>`,'kakodone');
}
let KKGEN=0;   // 時間切れであきらめた組の続きが、次の組の邪魔をしないための番号
async function kakoReadGroup(files,tag,keep){
  const msg=$('kkMsg'),gen=++KKGEN,alive=()=>{if(gen!==KKGEN)throw new Error('あきらめた');};
  KKI.P=[];KKI.A=[];KKI.items=[];KKI.drop=[];
  try{
    for(const [i,f] of files.entries()){
      if(msg)msg.textContent=`${tag}読み込み中… ${i+1} / ${files.length}：${f.name}`;
      const prog=t=>{if(msg)msg.textContent=`${tag}${i+1} / ${files.length}　${t}`;};
      const P=await KK.parseProblemPdf(f,prog);alive();
      if(P.meta.isAns||!P.items.length){const A=await KK.parseAnswerPdf(f,prog,P);alive();if(A.count)KKI.A.push(A);}else KKI.P.push(P);
    }
    for(const P of KKI.P){
      KK.assignAll(P,KKI.A);
      P.items.forEach(it=>{it.P=P;it.adj={top:0,bottom:0};KKI.items.push(it);});
    }
    // 同じ年度・科目・大問・問が重なったら枝番を付けて分ける
    const seen={};KKI.items.forEach(it=>{const k=KK.itemId(it);if(seen[k]){it.part=String(++seen[k]);}else seen[k]=1;});
    for(const [i,it] of KKI.items.entries()){
      if(msg&&i%3===0)msg.textContent=`${tag}切り取り中… ${i+1} / ${KKI.items.length}`;
      it.img=await KK.renderSeg(it.P,it.seg,it.adj);
      it.leadImg=it.lead?await KK.renderSeg(it.P,it.lead):null;alive();
    }
  }catch(err){return {err:files.map(f=>f.name).join('・')+'：'+(err&&err.message||err)};}
  if(gen!==KKGEN)return {recs:[]};
  if(!KKI.items.length)return {recs:[]};
  const recs=await kakoSave();
  // 次の組を読む前に、描いたページの絵とPDFを手放す（手直し画面で使う1組だけは残す）
  if(!keep){for(const P of KKI.P){P.pages.forEach(p=>{p.canvas=null;});try{P.doc.destroy();}catch(e){}}KKI.items=[];KKI.P=[];}
  return {recs};
}

/* ===== 全自動：この端末で動かす中継（tools/kk-relay.py）を通して配布元からPDFを受け取る ===== */
const RELAY='http://127.0.0.1:8930';
const RELAY_PY=()=>new URL('tools/kk-relay.py',location.href).href;
const APP_URL=()=>location.origin+location.pathname;
const relayCmd={
  android:()=>`command -v python >/dev/null || pkg install -y python; command -v curl >/dev/null || pkg install -y curl; curl -fsSL '${RELAY_PY()}' -o ~/kk-relay.py && python ~/kk-relay.py '${APP_URL()}'`,
  unix:()=>`curl -fsSL '${RELAY_PY()}' -o ~/kk-relay.py && python3 ~/kk-relay.py '${APP_URL()}'`,
  win:()=>`Invoke-WebRequest '${RELAY_PY()}' -OutFile $HOME\\kk-relay.py; py $HOME\\kk-relay.py '${APP_URL()}'`,
};
// 自分専用の中継（クラウド：あなたの Supabase の Edge Function「kk-relay」）。合言葉はこの端末にだけ保存（書き出しファイルにも入れない）
const CLOUD='https://zcwqgnlcigkieymhbnvh.supabase.co/functions/v1/kk-relay';
const cloudPass=()=>{try{return (localStorage.getItem('kk-relay-pass')||'').trim();}catch(e){return '';}};
let RELAY_MODE=null;   // 'cloud'（自分専用のクラウド中継）・'local'（この端末の中継）・null
async function cloudPing(force){
  const p=cloudPass();if(!p)return false;
  if(!force&&Date.now()-(UI.cloudOkAt||0)<60000)return true;   // 1分以内につながっていれば聞き直さない
  try{const ac=new AbortController();setTimeout(()=>ac.abort(),12000);   // 止まっていたサーバーが起きるのを待つ
    const r=await fetch(CLOUD+'?ping=1',{cache:'no-store',headers:{'x-kk-pass':p},signal:ac.signal});
    let why='';if(!r.ok){try{why=(await r.clone().json()).error||'';}catch(e){}}
    UI.cloudErr=r.ok?'':r.status===401?'合言葉がちがう':r.status===503?(why||'サーバーに合言葉がまだ設定されていない'):'中継の応答 '+r.status;
    if(r.ok)UI.cloudOkAt=Date.now();return r.ok;}catch(e){UI.cloudErr='中継につながらない';return false;}
}
async function localPing(){
  try{const ac=new AbortController();setTimeout(()=>ac.abort(),1500);
    const r=await fetch(RELAY+'/ping',{cache:'no-store',signal:ac.signal});return r.ok&&!!(await r.json()).ok;}catch(e){return false;}
}
async function relayPing(){
  if(await cloudPing()){RELAY_MODE='cloud';return true;}
  if(await localPing()){RELAY_MODE='local';return true;}
  RELAY_MODE=null;return false;
}
async function relayGet(u){
  const cloud=RELAY_MODE==='cloud';
  const r=cloud?await fetch(CLOUD+'?u='+encodeURIComponent(u),{cache:'no-store',headers:{'x-kk-pass':cloudPass()}})
    :await fetch(RELAY+'/get?u='+encodeURIComponent(u),{cache:'no-store'});
  if(cloud&&r.status===401){UI.cloudOkAt=0;throw Object.assign(new Error('合言葉がちがう（⚙設定で入れ直す）'),{refused:true});}
  if(r.status===429){const e=new Error('配布元にことわられた（時間をおいてから。急ぐなら下の「1つずつ開いて保存する」）');e.refused=true;throw e;}
  if(!r.ok)throw new Error('中継から受け取れなかった（'+r.status+'）');
  return new File([await r.blob()],u.split('/').pop(),{type:'application/pdf'});
}
const kakoHave=(y,subj)=>KKSAVED.some(it=>it.year===y&&it.subj===subj);
let AUTO_RUN=null;
const wait=ms=>new Promise(res=>setTimeout(res,ms)),GROUP_LIMIT=6*60*1000;
function relayWatch(){
  clearTimeout(UI.relayIv);
  const tick=async()=>{
    if(OVK!=='kakoimp')return;
    const ok=await relayPing();
    const st=$('kkRelaySt'),b=document.querySelector('[data-kauto]');
    if(st)st.innerHTML=ok?(RELAY_MODE==='cloud'?'<b class="ok">自分専用の中継（クラウド）につながった</b>':'<b class="ok">この端末の中継につながった</b>')
      :cloudPass()?`中継につながらない（${esc(UI.cloudErr||'')}。⚙設定の合言葉を確認）`:'中継が使えない（⚙設定で合言葉を入れるか、下の「中継を起動」）';
    if(b)b.disabled=!ok||!!AUTO_RUN;
    if(ok&&UI.kkAutoPending){UI.kkAutoPending=false;kakoAutoImport();}
    // 見つからない間はゆっくり（5秒おき）、中継から開かれたときは早め（1秒おき）に探す
    clearTimeout(UI.relayIv);UI.relayIv=setTimeout(tick,ok||UI.kkAutoPending?1000:5000);
  };
  tick();
}
// まだこの端末に無い年度・科目を、新しい年度から順に、1組ずつ「受け取る → 読み込む → 保存」していく
async function kakoAutoImport(){
  if(AUTO_RUN)return;
  const list=kakoDlPick().filter(c=>!kakoHave(c.year,c.subj));
  const msg=$('kkMsg');
  if(!list.length){if(msg)msg.textContent='選んだ範囲はもう全部この端末にある。範囲を広げる';return;}
  AUTO_RUN={stop:false};const run=AUTO_RUN;
  const b=document.querySelector('[data-kauto]');if(b)b.disabled=true;
  const sb=document.querySelector('[data-kstop]');if(sb)sb.hidden=false;
  const all=[],bad=[];
  try{
    for(const [i,c] of list.entries()){
      if(run.stop)break;
      const tag=`[${i+1}/${list.length}] ${c.year} ${KK.subjName(c.subj)}：`;
      if(msg)msg.textContent=tag+'配布元から受け取り中…';
      let files;
      try{files=[await relayGet(c.q)];await wait(2000);files.push(await relayGet(c.a));}
      catch(e){bad.push(`${c.year} ${KK.subjName(c.subj)}：${e.message}`);if(e.refused)break;continue;}   // ことわられたら、それ以上は頼まない
      // 1組に時間がかかりすぎたら（読み取りが進まないなど）、その組はあきらめて次へ
      const r=await Promise.race([kakoReadFiles(files,{quiet:true,stop:()=>run.stop}),wait(GROUP_LIMIT).then(()=>null)]);
      if(!r){KKGEN++;bad.push(`${c.year} ${KK.subjName(c.subj)}：時間がかかりすぎたので飛ばした`);await import('./ocr.js').then(O=>O.ocrDone()).catch(()=>{});continue;}
      all.push(...r.recs);bad.push(...r.bad);
      await wait(2000);   // 配布元に負担をかけないよう間をあける
    }
  }finally{AUTO_RUN=null;import('./ocr.js').then(O=>O.ocrDone()).catch(()=>{});}
  kakoSummary(all,bad.concat(run.stop?['途中で止めた']:[]),false);
}
// 取り込み中の問題を端末に保存する（手直しで年度や番号を変えたときは、前のIDのものを消してから入れ直す）
async function kakoSave(){
  const old=KKI.items.map(it=>it.savedId).concat(KKI.drop||[]).filter(Boolean);KKI.drop=[];
  const recs=KKI.items.map(it=>{const r={year:it.year,subj:it.subj,dai:it.dai,q:it.q,part:it.part||'',ans:it.ans||'',img:it.img,lead:it.leadImg||null,useLead:!!it.useLead,on:!!it.on&&!!it.ans};r.id=KK.itemId(r);return r;});
  if(old.length){const ids=new Set(recs.map(r=>r.id));KKSAVED=await KK.deleteWhere(it=>old.includes(it.id)&&!ids.has(it.id));}
  KKSAVED=await KK.saveItems(recs);
  KKI.items.forEach((it,i)=>{it.savedId=recs[i].id;});
  renderTitle();if(SES&&SES.role==='client')SES.net.send({t:'w',w:allWeights(),kk:KK.KAKO.ALL});
  return recs;
}
const urlOf=b=>{if(!b)return '';b._u=b._u||URL.createObjectURL(b);return b._u;};
function kakoEditor(){
  const rows=KKI.items.map((it,i)=>`<div class="kk-row${it.on?'':' off'}" data-i="${i}">
      <div class="kk-img">${it.leadImg&&it.useLead?`<img class="lead" src="${urlOf(it.leadImg)}" alt="">`:''}<img src="${urlOf(it.img)}" alt=""></div>
      <div class="kk-ctl">
        <div class="kk-f"><input data-f="year" value="${it.year}" size="4" inputmode="numeric">年 <select data-f="subj"><option value="phy" ${it.subj==='phy'?'selected':''}>物理</option><option value="chem" ${it.subj==='chem'?'selected':''}>化学</option></select>
          第<input data-f="dai" value="${it.dai}" size="2" inputmode="numeric">問 問<input data-f="q" value="${it.q}" size="2" inputmode="numeric"> 枝<input data-f="part" value="${esc(it.part||'')}" size="2"></div>
        <div class="kk-f">正解<input data-f="ans" value="${esc(it.ans||'')}" size="5" inputmode="numeric" placeholder="例 3 / 31" class="${it.ans?'':'need'}"> <small>解答番号 ${it.slots.join('・')||'?'}</small></div>
        <div class="kk-f"><label><input type="checkbox" data-f="on" ${it.on?'checked':''}>使う</label> ${it.lead?`<label><input type="checkbox" data-f="useLead" ${it.useLead?'checked':''}>大問の前置き文を付ける</label>`:''}</div>
        <div class="kk-f kk-adj">上端<button data-a="t-">▲</button><button data-a="t+">▼</button> 下端<button data-a="b-">▲</button><button data-a="b+">▼</button>${i?'<button data-a="merge">前の問とつなぐ</button>':''}</div>
      </div></div>`).join('');
  const need=KKI.items.filter(it=>it.on&&!it.ans).length;
  overlay(`<h2>切り取りと正解の確認</h2><p class="note">${KKI.items.length}問。切り取りの上端・下端、正解（マークの数字。解答番号が2つなら「31」のように続けて）を確かめる。${need?`<b>正解が空の問が ${need} 問</b>（空のままだと出題されない）。`:''}</p>
    <div class="kk-list">${rows}</div>
    <div class="row-btns"><button class="btn go" data-kk="save">この端末に保存</button><button class="btn sub" data-ov="close">やめる</button></div>`,'kakoedit');
}
$('ov').addEventListener('change',e=>{
  const row=e.target.closest('.kk-row');if(!row||OVK!=='kakoedit'&&OVK!=='kakomanage')return;
  const f=e.target.dataset.f;if(!f)return;
  const list=OVK==='kakoedit'?KKI.items:KKSAVED,it=list[+row.dataset.i];if(!it)return;
  const v=e.target.type==='checkbox'?e.target.checked:e.target.value.trim();
  if(f==='year'||f==='dai'||f==='q')it[f]=parseInt(v,10)||it[f];
  else if(f==='ans')it.ans=String(v).replace(/[^0-9]/g,'');
  else it[f]=v;
  if(OVK==='kakomanage')KK.updateItem(it.id,{ans:it.ans,on:it.on,useLead:it.useLead}).then(items=>{KKSAVED=items;});
  else if(f==='useLead')kakoEditor();
  row.classList.toggle('off',!it.on);
});
$('ov').addEventListener('click',async e=>{
  const b=e.target.closest('[data-kk],[data-a]');if(!b)return;
  if(b.dataset.kk==='import'){kakoImportDialog();return;}
  if(b.dataset.kk==='manage'){kakoManage();return;}
  if(b.dataset.kk==='review'){kakoEditor();return;}
  if(b.dataset.kk==='save'){
    const recs=await kakoSave();
    overlay(`<h2>保存した</h2><p>この端末に ${recs.length} 問を保存した（正解が入っている ${recs.filter(r=>r.on&&r.ans).length} 問が出題される）。</p><button class="btn go" data-ov="close">閉じる</button>`);
    return;
  }
  if(b.dataset.kk==='del'){const k=b.dataset.k;KKSAVED=await KK.deleteWhere(it=>(it.year+'-'+it.subj)===k);kakoManage();renderTitle();return;}
  if(b.dataset.a&&OVK==='kakoedit'){
    const row=b.closest('.kk-row'),i=+row.dataset.i,it=KKI.items[i];if(!it)return;
    const a=b.dataset.a,st=16;
    if(a==='merge'){const pv=KKI.items[i-1];pv.seg={from:pv.seg.from,to:it.seg.to};pv.slots=pv.slots.concat(it.slots);pv.ans=(pv.ans||'')+(it.ans||'');pv.img=await KK.renderSeg(pv.P,pv.seg,pv.adj);if(it.savedId)(KKI.drop=KKI.drop||[]).push(it.savedId);KKI.items.splice(i,1);kakoEditor();return;}
    if(a==='t-')it.adj.top-=st;if(a==='t+')it.adj.top+=st;if(a==='b-')it.adj.bottom-=st;if(a==='b+')it.adj.bottom+=st;
    it.img=await KK.renderSeg(it.P,it.seg,it.adj);
    const im=row.querySelector('.kk-img img:last-child');if(im)im.src=urlOf(it.img);
  }
});
function kakoManage(){
  const by={};KKSAVED.forEach(it=>{const k=it.year+'-'+it.subj;(by[k]=by[k]||[]).push(it);});
  const rows=KKSAVED.map((it,i)=>`<div class="kk-row small${it.on?'':' off'}" data-i="${i}"><img class="kk-thumb" src="${urlOf(it.img)}" alt=""><div class="kk-ctl"><b>${esc(KK.itemId(it))}</b>
      <div class="kk-f">正解<input data-f="ans" value="${esc(it.ans||'')}" size="5" inputmode="numeric" class="${it.ans?'':'need'}"> <label><input type="checkbox" data-f="on" ${it.on?'checked':''}>使う</label>${it.lead?` <label><input type="checkbox" data-f="useLead" ${it.useLead?'checked':''}>前置き文</label>`:''}</div></div></div>`).join('');
  overlay(`<h2>読み込んだ過去問</h2><p class="note">この端末の中だけにある。正解の修正・出題する/しないの切り替えはその場で保存される。</p>
    <div class="row-btns">${Object.keys(by).sort().map(k=>{const [y,sj]=k.split('-');return `<button class="btn sub" data-kk="del" data-k="${esc(k)}">🗑 ${esc(y)} ${KK.subjName(sj)}（${by[k].length}問）を消す</button>`;}).join('')}</div>
    <div class="kk-list">${rows}</div><div class="row-btns"><button class="btn go" data-ov="close">閉じる</button></div>`,'kakomanage');
}
$('kakoBox').addEventListener('click',e=>{const b=e.target.closest('[data-kk]');if(!b)return;
  if(b.dataset.kk==='auto'){if(bedGuard(()=>{kakoImportDialog();UI.kkAutoPending=true;relayWatch();}))return;kakoImportDialog();UI.kkAutoPending=true;relayWatch();}   // ワンボタン：中継がつながりしだい自動で取り込む
  else if(b.dataset.kk==='import')kakoImportDialog();else kakoManage();});

/* ================= 特訓（単元 × ルール）・今日の10問・今日の復習・誤答ノート ================= */
const DRILL_BANKS=['kcalc','kchem','quiz','kmath','kphy'];
const BANKN={kcalc:'化学計算',kchem:'化学知識',quiz:'物質当て',kmath:'京大数学',kphy:'共テ物理'};
const DRULES=[
  {id:'std',name:'通常',d:'10問。ヒントが少しずつ出る'},
  {id:'ta',name:'タイムアタック',d:'90秒（数学は150秒）で何問正解できるか'},
  {id:'surv',name:'サバイバル',d:'1回まちがえる・答えられないまで何問続くか'},
  {id:'open',name:'じっくり',d:'ヒントを全部見て、時間をかけて考える'},
];
const QZMAJOR={org:'有機化合物',ion:'無機物質',atom:'組成（気体・無機・有機）'};
const PMAJOR={mech:'力学',heat:'熱',wave:'波動',em:'電磁気',atom:'原子'};
const CMAJOR={law:'法則（まとめ）',phen:'現象・性質（まとめ）',qty:'量・定数（まとめ）',poly:'高分子（まとめ）',cry:'結晶の構造',bond:'化学結合・分子間力',orgr:'有機反応（まとめ）',bio:'糖・アミノ酸・油脂（まとめ）'};
function catLabel(g,c){
  const B=E.QBANK[g];if(B.CATN&&B.CATN[c])return B.CATN[c];
  const [a,b]=c.split(':');if(a==='atom'&&A.CATNAME[b])return A.CATNAME[b];return b||a;
}
function majorLabel(g,a){
  if(g==='quiz'&&QZMAJOR[a])return QZMAJOR[a];if(g==='kphy'&&PMAJOR[a])return PMAJOR[a];if(g==='kchem'&&CMAJOR[a])return CMAJOR[a];
  const B=E.QBANK[g];if(B.CATN){const c=Object.keys(B.CATN).find(c=>c.split(':')[0]===a);if(c)return B.CATN[c].replace(/（.*$/,'');}
  return QZMAJOR[a]||a;
}
// 単元：分野（大きなまとまり）と細かい分類のうち、5問以上あるもの（同じ問題の組は1つにまとめる）
const UNIT_CACHE={};
function drillUnits(g){
  if(UNIT_CACHE[g])return UNIT_CACHE[g];
  const B=E.QBANK[g],by={},maj={};
  for(const k of B.ALL){const c=B.Q[k].cat,a=c.split(':')[0];(by[c]=by[c]||[]).push(k);(maj[a]=maj[a]||[]).push(k);}
  const units=[{id:'all',name:'全範囲',ids:B.ALL.slice()}];
  const same=(x,y)=>x.length===y.length&&x.every(v=>y.includes(v));
  for(const [a,ids] of Object.entries(maj))if(ids.length>=5&&!units.some(u=>same(u.ids,ids)))units.push({id:'m:'+a,name:majorLabel(g,a),ids});
  for(const [c,ids] of Object.entries(by))if(ids.length>=5&&!units.some(u=>same(u.ids,ids)))units.push({id:'c:'+c,name:catLabel(g,c),ids,sub:true});
  return UNIT_CACHE[g]=units;
}
const drillCount=()=>DRILL_BANKS.reduce((a,g)=>a+drillUnits(g).length*DRULES.length,0);
// 今日の10問：日付と科目で決まる10問（その日はだれがやっても同じ）
function seedRand(str){let h=2166136261;for(const c of str){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function dailyOrder(g,day=dayKey(new Date())){const r=seedRand(day+'|'+g),a=E.QBANK[g].ALL.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a.slice(0,10);}
const dailyDone=(g,day=dayKey(new Date()))=>((SAVE.daily||{})[day]||{})[g]||null;
function dailyStreak(){const d=new Date();const has=x=>Object.keys((SAVE.daily||{})[dayKey(x)]||{}).length>0;if(!has(d))d.setDate(d.getDate()-1);let n=0;while(has(d)){n++;d.setDate(d.getDate()-1);}return n;}
// 今日の復習：覚え具合（0〜5）に合わせて間をあけて出す（0:すぐ 1:1日 2:2日 3:4日 4:7日 5:15日後）
const SRS_DAYS=[0,1,2,4,7,15];
function dueIds(g){
  const M=SV(g).mastery,now=Date.now();
  return Object.keys(M).filter(k=>{const m=M[k];if(!m||!m.seen||!(m.ok+m.ng)||!knownKey(g,k))return false;
    return m.t?(now-m.t)/864e5>=SRS_DAYS[Math.min(5,m.box|0)]:(m.box|0)<=2;});
}
const noteIds=g=>{const M=SV(g).mastery;return Object.keys(M).filter(k=>M[k]&&M[k].ng>0&&knownKey(g,k)).sort((a,b)=>(M[b].ng-M[b].ok)-(M[a].ng-M[a].ok));};
function goalLine(){const D=statDay(),n=D.ok+D.ng,goal=+(SAVE.ui.goal||30);
  return `<div class="goal-line ${n>=goal?'met':''}">${n>=goal?'🎯 今日の目標達成！':'🎯 今日の目標まで あと'+(goal-n)+'問'}<span>${n} / ${goal}問</span><i style="width:${Math.min(100,Math.round(n*100/goal))}%"></i></div>`;}
function drillStart(g,unit,rule){
  const R=DRULES.find(x=>x.id===rule)||DRULES[0];
  startSolo('s1',g,{rule,drill:`${g}|${unit.id}|${rule}`,pool:unit.ids,qn:rule==='std'||rule==='open'?Math.min(10,unit.ids.length):undefined,label:`${BANKN[g]}・${unit.name}・${R.name}`});
}
function drillHub(){
  const H=UI.dh||(UI.dh={g:'kcalc',rule:'std'});const day=dayKey(new Date());
  const units=drillUnits(H.g),D=SAVE.drill||{},R=DRULES.find(x=>x.id===H.rule);
  const best=u=>{const b=D[`${H.g}|${u.id}|${H.rule}`];return b?(H.rule==='ta'?`${b.best}問`:H.rule==='surv'?`${b.best}連続`:`${b.best}点`):'—';};
  overlay(`<h2>🎯 特訓</h2>
    ${goalLine()}
    <div class="dh-sec">📅 今日の10問 <small>連続 ${dailyStreak()}日（毎日同じ10問。だれがやっても同じ）</small></div>
    <div class="dh-grid">${DRILL_BANKS.map(g=>{const d=dailyDone(g,day);return `<button class="dh-card ${d?'done':''}" data-dd="${g}"><span>${BANKN[g]}</span><b>${d?`✓ ${d.ok}/10`:'挑戦'}</b></button>`;}).join('')}</div>
    <div class="dh-sec">🔁 今日の復習 <small>忘れかけた問題を、覚え具合に合わせて間をあけて出す</small></div>
    <div class="dh-grid">${DRILL_BANKS.map(g=>{const n=dueIds(g).length;return `<button class="dh-card" data-dr="${g}" ${n?'':'disabled'}><span>${BANKN[g]}</span><b>${n?n+'問':'なし'}</b></button>`;}).join('')}</div>
    <div class="dh-sec">🧩 単元 × ルール <small>全 ${drillCount()} モード</small></div>
    <div class="seg dh-rules">${DRULES.map(x=>`<button data-hr="${x.id}" class="${x.id===H.rule?'on':''}">${x.name}</button>`).join('')}</div>
    <p class="note dh-rd">${esc(R.d)}</p>
    <div class="seg dh-banks">${DRILL_BANKS.map(g=>`<button data-hb="${g}" class="${g===H.g?'on':''}">${BANKN[g]}</button>`).join('')}</div>
    <div class="dh-units">${units.map((u,i)=>`<button class="dh-unit${u.sub?' sub':''}" data-du="${i}"><span>${esc(u.name)}</span><small>${u.ids.length}問</small><b>${best(u)}</b></button>`).join('')}</div>
    <div class="row-btns"><button class="btn sub" data-ov="note">📒 誤答ノート</button><button class="btn go" data-ov="close">閉じる</button></div>`,'drill');
}
function drillResults(r){
  const ok=r.team.served,ng=r.team.failed,score=r.team.score,rule=r.rule||'std',key=r.drill,cfg=(SES&&SES.cfg)||{};
  const metric=rule==='ta'||rule==='surv'?ok:score;
  SAVE.drill=SAVE.drill||{};const prev=(SAVE.drill[key]||{}).best||0,isBest=metric>prev&&metric>0;
  if(isBest)SAVE.drill[key]={best:metric,at:Date.now()};
  if(rule==='daily'){const day=dayKey(new Date());SAVE.daily=SAVE.daily||{};const D=SAVE.daily[day]||(SAVE.daily[day]={});if(!D[r.g]||ok>D[r.g].ok)D[r.g]={ok,score};
    const ks=Object.keys(SAVE.daily).sort();if(ks.length>400)ks.slice(0,ks.length-400).forEach(k=>delete SAVE.daily[k]);}
  persist();
  const name={std:'特訓',ta:'タイムアタック',surv:'サバイバル',open:'じっくり',daily:'今日の10問'}[rule]||'特訓';
  const big=rule==='ta'?`${ok}<span style="font-size:18px">問正解</span>`:rule==='surv'?`${ok}<span style="font-size:18px">問連続</span>`:rule==='daily'?`${ok}<span style="font-size:18px"> / 10</span>`:`${score}<span style="font-size:18px">点</span>`;
  UI.shareText=`ケミカル・キッチン「${cfg.label||E.GAMES[r.g]}」${name}：${rule==='ta'?ok+'問正解':rule==='surv'?ok+'問連続':rule==='daily'?ok+'/10':score+'点'}！`;
  overlay(`<h2>${name}${isBest?' 🎉':''}</h2><p class="dr-lab">${esc(cfg.label||E.GAMES[r.g])}</p>
    <div class="big-score">${big}</div>
    <div style="font-size:12px;font-weight:800">${isBest?'自己ベスト更新！':`自己ベスト ${Math.max(prev,metric)}${rule==='ta'?'問':rule==='surv'?'連続':rule==='daily'?'':'点'}`}</div>
    <div class="stats"><div>正解<b>${ok}</b></div><div>誤答<b>${ng}</b></div><div>最大連続<b>${r.team.maxCombo}</b></div></div>
    ${goalLine()}${nightNote()}${reviewHTML(r,'solo')}
    <div class="row-btns"><button class="btn sub mini" data-ov="share">📤 結果を共有</button></div>
    <div class="row-btns"><button class="btn go" data-ov="retry">もう一回</button><button class="btn" data-ov="drill">特訓メニュー</button><button class="btn sub" data-ov="menu">メニュー</button></div>`,'result');
}
function noteOverlay(){
  const H=UI.nb||(UI.nb={g:DRILL_BANKS.find(g=>noteIds(g).length)||'kcalc'});
  const ids=noteIds(H.g),B=E.QBANK[H.g],M=SV(H.g).mastery;
  overlay(`<h2>📒 誤答ノート</h2><p class="note">まちがえた・答えられなかった問題（ヒントは全部見られる）。まちがいが多い順。</p>
    <div class="seg dh-banks">${DRILL_BANKS.map(g=>`<button data-nb="${g}" class="${g===H.g?'on':''}">${BANKN[g]} ${noteIds(g).length}</button>`).join('')}</div>
    ${ids.length?`<div class="row-btns"><button class="btn go" data-nplay="${H.g}">ここから ${Math.min(10,ids.length)}問 出題</button></div>`:''}
    <div class="nb-list">${ids.length?ids.slice(0,80).map(k=>{const q=B.Q[k],m=M[k];return `<details class="nb-it"><summary><b>${esc(B.label?B.label(k):q.n)}</b><small>正解 ${m.ok}・まちがい ${m.ng}</small></summary><ol>${q.clues.map(c=>`<li>${esc(c)}</li>`).join('')}</ol>${B.label?`<p class="nb-ans">答え：<b>${esc(q.n)}</b></p>`:''}</details>`;}).join(''):'<p class="note">この科目で、まちがえた問題はまだない</p>'}</div>
    <div class="row-btns"><button class="btn sub" data-ov="drillback">特訓へ</button><button class="btn go" data-ov="close">閉じる</button></div>`,'note');
}
$('ov').addEventListener('click',e=>{
  if(OVK==='drill'){
    const H=UI.dh;let b;
    if((b=e.target.closest('[data-hr]'))){H.rule=b.dataset.hr;drillHub();return;}
    if((b=e.target.closest('[data-hb]'))){H.g=b.dataset.hb;drillHub();return;}
    if((b=e.target.closest('[data-du]'))){const u=drillUnits(H.g)[+b.dataset.du];if(u){closeOverlay();drillStart(H.g,u,H.rule);}return;}
    if((b=e.target.closest('[data-dd]'))){const g=b.dataset.dd;closeOverlay();startSolo('s1',g,{rule:'daily',drill:`${g}|daily|${dayKey(new Date())}`,order:dailyOrder(g),pool:E.QBANK[g].ALL.slice(),label:`${BANKN[g]}・今日の10問`});return;}
    if((b=e.target.closest('[data-dr]'))){const g=b.dataset.dr,ids=dueIds(g);if(!ids.length)return;closeOverlay();startSolo('s1',g,{rule:'std',drill:`${g}|review|std`,pool:ids,qn:Math.min(10,ids.length),label:`${BANKN[g]}・今日の復習`});return;}
  }
  if(OVK==='note'){
    let b;
    if((b=e.target.closest('[data-nb]'))){UI.nb.g=b.dataset.nb;noteOverlay();return;}
    if((b=e.target.closest('[data-nplay]'))){const g=b.dataset.nplay,ids=noteIds(g);closeOverlay();startSolo('s1',g,{rule:'std',drill:`${g}|note|std`,pool:ids,qn:Math.min(10,ids.length),label:`${BANKN[g]}・誤答ノート`});return;}
  }
});
$('btnDrill').addEventListener('click',()=>{audio();drillHub();});
// 復習：出し直す時期が来た問題がいちばん多い科目から始める
$('btnReview').addEventListener('click',()=>{audio();const x=todayState().due[0];if(!x)return;
  startSolo('s1',x.g,{rule:'std',drill:`${x.g}|review|std`,pool:x.ids,qn:Math.min(10,x.ids.length),label:`${BANKN[x.g]}・今日の復習`});});
// 今日の10問：まだやっていない科目を順に（全部済みなら特訓の画面へ）
$('btnDaily').addEventListener('click',()=>{audio();const g=todayState().left[0];if(!g){drillHub();return;}
  startSolo('s1',g,{rule:'daily',drill:`${g}|daily|${dayKey(new Date())}`,order:dailyOrder(g),pool:E.QBANK[g].ALL.slice(),label:`${BANKN[g]}・今日の10問`});});
$('btnNote').addEventListener('click',()=>{audio();noteOverlay();});

// 就寝前ガード：就寝時刻の1時間前〜5時は、ゲームを始める前に止める（「5分だけ」で一時的に解除）
function bedGuard(go){
  const b=SAVE.ui.bed===undefined?'23:30':SAVE.ui.bed;if(!b||b==='off')return false;
  if(Date.now()<(UI.bedOk||0))return false;
  const [hh,mm]=b.split(':').map(Number),B=hh*60+mm,d=new Date(),N=d.getHours()*60+d.getMinutes();
  const since=((N-(B-60))%1440+1440)%1440;   // 就寝1時間前からの経過（分）
  if(since>=60+300)return false;             // 就寝時刻の5時間後（だいたい朝）まで
  UI.bedGo=go;
  overlay(`<h2>🌙 もう寝る時間</h2><p>就寝時刻は <b>${esc(b)}</b>。寝る前の1時間は画面を見ないほうが寝つきがよく、覚えたことも睡眠中に定着する。今日はここまでにしろ。</p>
    <p class="note">就寝時刻は ⚙設定で変えられる（「なし」で止めない）。</p>
    <div class="row-btns"><button class="btn go" data-ov="close">今日はやめる</button><button class="btn sub" data-ov="bed5">5分だけやる</button></div>`,'bed');
  return true;
}
// 結果の共有（共有できない端末ではコピー）
async function shareResult(text){
  const url=location.origin+location.pathname;
  try{if(navigator.share){await navigator.share({title:'ケミカル・キッチン',text,url});return;}}catch(e){if(e&&e.name==='AbortError')return;}
  const b=document.querySelector('[data-ov="share"]');
  try{await navigator.clipboard.writeText(text+' '+url);if(b)b.textContent='📋 コピーした ✓';}catch(e){if(b)b.textContent='共有できなかった';}
}
// 学習データの書き出し・読み込み（機種変更用。過去問の画像は含めない）
function exportSave(){
  const blob=new Blob([JSON.stringify({app:'chem-kitchen',v:2,at:new Date().toISOString(),save:SAVE})],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`kagaku-kitchen-${dayKey(new Date())}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}
document.addEventListener('change',async e=>{
  if(e.target.id!=='impFile'||!e.target.files[0])return;
  let d=null;try{d=JSON.parse(await e.target.files[0].text());}catch(err){}
  if(!d||d.app!=='chem-kitchen'||!d.save||typeof d.save!=='object'||!d.save.rx){overlay(`<h2>読み込めなかった</h2><p>ケミカル・キッチンで書き出したファイルを選ぶ。</p><button class="btn go" data-ov="close">閉じる</button>`);return;}
  UI.impSave=d.save;
  overlay(`<h2>記録を読み込む</h2><p>${esc(String(d.at||'').slice(0,10))} に書き出した記録で、<b>この端末の今の記録を上書きする</b>。よければ「読み込む」。</p>
    <div class="row-btns"><button class="btn go" data-ov="impok">読み込む</button><button class="btn sub" data-ov="close">やめる</button></div>`,'imp');
});

/* ================= 化学マップ（高校化学の全単元と習得状況） ================= */
// 単元の「学びどころ」1つぶんの項目（そのモードの学習記録のキー）を集める
function mapItems(g,sel){
  if(E.isQuiz(g)){const B=E.QBANK[g];return B.ALL.filter(k=>!k.startsWith('x')&&mapPick(sel,B.Q[k].cat,B.Q[k].n));}
  if(g==='rx')return Object.keys(MENU).filter(k=>mapPick(sel,MENU[k].c,''));
  if(g==='atom')return A.DB.filter(d=>mapPick(sel,d.c,d.n)).map(d=>d.id);
  const M=isParts(g)?PM[g].M:null;return M?M.DB.filter(d=>mapPick(sel,d.k,d.n)).map(d=>d.id):[];
}
const MAPC={};
function mapUnits(){
  if(MAPC.u)return MAPC.u;
  // 共テ化学に混ぜてある物質の問題（キーが x で始まる）は、名前で指定されたときだけ拾う
  const xByName={};const KB=E.QBANK.kchem;KB.ALL.forEach(k=>{if(k.startsWith('x'))xByName[KB.Q[k].n]=k;});
  return MAPC.u=CHEMMAP.map(S=>({sec:S.sec,sub:S.sub,units:S.units.map(u=>({n:u.n,src:u.src.map(([g,sel])=>{
    const ids=mapItems(g,sel);if(g==='kchem'&&sel&&sel.n)sel.n.forEach(nm=>{if(xByName[nm]&&!ids.includes(xByName[nm]))ids.push(xByName[nm]);});
    return {g,ids};}).filter(x=>x.ids.length)}))}));
}
const mapDone=(g,ids)=>{const M=SV(g).mastery;return ids.filter(k=>M[k]&&M[k].box>=4).length;};
const mapSeen=(g,ids)=>{const M=SV(g).mastery;return ids.filter(k=>M[k]&&M[k].seen).length;};
function mapOverlay(){
  const U=mapUnits();let tot=0,done=0,seen=0;
  U.forEach(S=>S.units.forEach(u=>u.src.forEach(x=>{tot+=x.ids.length;done+=mapDone(x.g,x.ids);seen+=mapSeen(x.g,x.ids);})));
  let ui=0;
  const body=U.map(S=>`<div class="cm-sec"><b>${esc(S.sec)}</b><small>${esc(S.sub)}</small></div>`+S.units.map(u=>{
    const t=u.src.reduce((a,x)=>a+x.ids.length,0),d=u.src.reduce((a,x)=>a+mapDone(x.g,x.ids),0),sn=u.src.reduce((a,x)=>a+mapSeen(x.g,x.ids),0),id=ui++;
    return `<div class="cm-unit ${d===t?'full':sn?'':'new'}"><div class="cm-h"><b>${esc(u.n)}</b><span>${sn?`覚えた ${d} / ${t}`:'まだ'}</span></div>
      <div class="sm-bar" role="img" aria-label="覚えた割合 ${pct(d,t)}%"><i style="width:${pct(d,t)}%"></i></div>
      <div class="cm-src">${u.src.map((x,j)=>`<button data-cm="${id}:${j}">${SRCN[x.g]} <small>${mapDone(x.g,x.ids)}/${x.ids.length}</small></button>`).join('')}</div></div>`;}).join('')).join('');
  overlay(`<h2>🧭 化学マップ</h2>
    <p class="note cm-lead">高校化学（化学基礎＋化学）の全単元。<b>知識</b>（用語・法則）、<b>計算</b>、<b>つくる</b>（反応式・組成・官能基・無機イオン）のどれで学べるかと、覚えた数。押すとその単元だけを出題する。</p>
    <div class="cm-total"><span>化学全体</span><b>${pct(done,tot)}%</b><small>覚えた ${done} / ${tot} 項目（手をつけた ${seen}）</small><div class="sm-bar"><i style="width:${pct(done,tot)}%"></i></div></div>
    ${body}
    <div class="row-btns"><button class="btn go" data-ov="close">閉じる</button></div>`,'cmap');
}
$('ov').addEventListener('click',e=>{
  if(OVK!=='cmap')return;const b=e.target.closest('[data-cm]');if(!b)return;
  const [ui,j]=b.dataset.cm.split(':').map(Number);let n=0,hit=null;mapUnits().forEach(S=>S.units.forEach(u=>{if(n++===ui)hit=u;}));
  const x=hit&&hit.src[j];if(!x)return;
  closeOverlay();
  if(E.isQuiz(x.g)){
    // まだ覚えていない項目を優先（全部覚えていたら全部から）
    const M=SV(x.g).mastery,todo=x.ids.filter(k=>!(M[k]&&M[k].box>=4)),pool=todo.length>=3?todo:x.ids;
    startSolo('s1',x.g,{rule:'std',drill:`${x.g}|map:${ui}|std`,pool,qn:Math.min(10,pool.length),label:`${hit.n}（${SRCN[x.g]}）`});
  }else{SAVE.g=x.g;persist();renderTitle();show('title');window.scrollTo(0,0);}   // つくるモードは、そのモードの画面へ
});
$('btnMap').addEventListener('click',()=>{audio();mapOverlay();});

/* ================= 学習記録ダッシュボード ================= */
// 項目の名前と分類（苦手の一覧・分類ごとの正答率に使う）
function itemInfo(g,k){
  if(E.isQuiz(g)){const B=E.QBANK[g],q=B.Q[k];return q?{n:B.label?B.label(k):q.n,c:catLabel(g,q.cat)}:null;}
  if(g==='rx'){const it=MENU[k];return it?{n:nameOf(it.t),c:CATNAME[it.c]||''}:null;}
  if(g==='atom'){const d=A.BYID[k];return d?{n:d.n,c:A.CATNAME[d.c]||''}:null;}
  const M=isParts(g)?PM[g].M:null,d=M&&M.BYID&&M.BYID[k];if(!d)return null;
  return {n:d.n||d.w||d.pat||k,c:d.k||(d.lv?`レベル${d.lv}`:'')};
}
function modeTotal(g){
  if(E.isQuiz(g))return E.QBANK[g].ALL.length;if(g==='rx')return Object.keys(MENU).length;if(g==='atom')return A.DB.length;
  const M=isParts(g)?PM[g].M:null;return M?(M.ALL||M.DB||[]).length:0;
}
function modeStats(g){
  const M=SV(g).mastery;let seen=0,master=0,ok=0,ng=0;const cat={};
  for(const k in M){const m=M[k];if(!m||!m.seen||!knownKey(g,k))continue;seen++;if(m.box>=4)master++;ok+=m.ok;ng+=m.ng;
    const inf=itemInfo(g,k),c=inf&&inf.c||'その他';const C=cat[c]||(cat[c]={ok:0,ng:0});C.ok+=m.ok;C.ng+=m.ng;}
  return {seen,master,ok,ng,total:modeTotal(g),cat};
}
function streakDays(){
  const S=statsOf(),has=d=>{const x=S.days[dayKey(d)];return x&&(x.ok+x.ng+x.games)>0;};
  const d=new Date();if(!has(d))d.setDate(d.getDate()-1);   // 今日まだでも、昨日までの連続は数える
  let n=0;while(has(d)){n++;d.setDate(d.getDate()-1);}return n;
}
const pct=(a,b)=>b?Math.round(a*100/b):0;
function statsOverlay(){
  const S=statsOf(),today=statDay(),now=new Date();
  const days=[...Array(14)].map((_,i)=>{const d=new Date(now);d.setDate(d.getDate()-13+i);const x=S.days[dayKey(d)]||{ok:0,ng:0,ms:0,games:0};return {d,k:dayKey(d),...x};});
  const week=days.slice(-7),weekMin=Math.round(week.reduce((a,x)=>a+x.ms,0)/60000);
  const modes=GS.map(g=>({g,...modeStats(g)})),masterAll=modes.reduce((a,m)=>a+m.master,0);
  // 14日の棒（正解・まちがいを積む）
  const mx=Math.max(10,...days.map(x=>x.ok+x.ng)),H=120;
  const bars=days.map((x,i)=>{const hOk=x.ok/mx*H,hNg=x.ng/mx*H;
    return `<div class="sd-col" data-day="${x.k}" tabindex="0" aria-label="${x.d.getMonth()+1}月${x.d.getDate()}日 正解${x.ok} まちがい${x.ng}">
      <div class="sd-stack" style="height:${H}px">${x.ng?`<i class="ng" style="height:${hNg}px"></i>`:''}${x.ok?`<i class="ok" style="height:${hOk}px"></i>`:''}</div>
      <span>${i%2===1||i===13?`${x.d.getMonth()+1}/${x.d.getDate()}`:''}</span></div>`;}).join('');
  // 時刻ごと（夜ふかしの見張り）
  const hs=S.hours,hm=Math.max(1,...hs),tot=hs.reduce((a,b)=>a+b,0),late=[23,0,1,2,3,4].reduce((a,h)=>a+hs[h],0),lateP=pct(late,tot);
  const hbars=hs.map((v,h)=>`<div class="sh-col" title="${h}時台 ${v}問"><i style="height:${v/hm*60}px"></i><span>${h%6===0?h:''}</span></div>`).join('');
  // 苦手（全部のモードから）
  const weak=[];for(const g of GS){const M=SV(g).mastery;for(const k in M){const m=M[k];if(!m||!m.seen||!m.ng||!knownKey(g,k))continue;
    if(m.box<=1||m.ng>m.ok){const inf=itemInfo(g,k);if(inf)weak.push({g,k,n:inf.n,ok:m.ok,ng:m.ng,box:m.box,sc:m.ng*2-m.ok+(5-m.box)});}}}
  weak.sort((a,b)=>b.sc-a.sc);const weakTop=weak.slice(0,10);
  const modeRows=modes.filter(m=>m.total).map(m=>{
    const cats=Object.entries(m.cat).filter(([,v])=>v.ok+v.ng>=3).sort((a,b)=>pct(a[1].ok,a[1].ok+a[1].ng)-pct(b[1].ok,b[1].ok+b[1].ng));
    const worst=cats[0];
    return `<div class="sm-row"><div class="sm-h"><b>${esc(E.GAMES[m.g])}</b><span>${m.seen?`覚えた ${m.master} / ${m.total}${UNIT[GK(m.g)]}・正答率 ${pct(m.ok,m.ok+m.ng)}%`:'まだ'}</span></div>
      ${m.seen?`<div class="sm-bar" role="img" aria-label="覚えた割合 ${pct(m.master,m.total)}%"><i style="width:${Math.max(1,pct(m.master,m.total))}%"></i></div>`:''}
      ${worst&&cats.length>1?`<div class="sm-w">いちばん苦手な分類：<b>${esc(worst[0])}</b>（正答率 ${pct(worst[1].ok,worst[1].ok+worst[1].ng)}%）</div>`:''}</div>`;}).join('');
  overlay(`<h2>📊 学習記録</h2>
    <div class="sd-kpi">
      <div><small>連続</small><b>${streakDays()}</b><small>日</small></div>
      <div><small>今日</small><b>${today.ok+today.ng}</b><small>問・正答率 ${pct(today.ok,today.ok+today.ng)}%</small></div>
      <div><small>この7日</small><b>${weekMin}</b><small>分</small></div>
      <div><small>覚えた</small><b>${masterAll}</b><small>項目</small></div>
    </div>
    <div class="sd-card"><div class="sd-t">この14日に解いた数</div>
      <div class="sd-leg"><span><i class="ok"></i>正解</span><span><i class="ng"></i>まちがい</span><span class="sd-max">上端 ${mx}問</span></div>
      <div class="sd-chart">${bars}</div>
      <p class="sd-tip" id="sdTip">棒を押すと、その日の数が出る</p>
      <details><summary>表で見る</summary><table class="sd-tbl"><tr><th>日</th><th>正解</th><th>まちがい</th><th>時間</th></tr>${days.slice().reverse().map(x=>`<tr><td>${x.d.getMonth()+1}/${x.d.getDate()}</td><td>${x.ok}</td><td>${x.ng}</td><td>${Math.round(x.ms/60000)}分</td></tr>`).join('')}</table></details>
    </div>
    <div class="sd-card"><div class="sd-t">解いた時刻（全期間）</div>
      <div class="sh-chart">${hbars}</div>
      ${tot?(lateP>=15?`<p class="sd-warn">🌙 23時〜5時に解いた分が ${lateP}%。夜ふかしで睡眠を削ると覚えたことが定着しにくい。寝る1時間前には切り上げろ。</p>`:`<p class="note">23時〜5時に解いた分は ${lateP}%。この調子。</p>`):'<p class="note">まだ記録がない</p>'}
    </div>
    <div class="sd-card"><div class="sd-t">モードごと</div>${modeRows}</div>
    <div class="sd-card"><div class="sd-t">苦手トップ10</div>
      ${weakTop.length?weakTop.map(w=>`<div class="sw-row"><div><b>${esc(w.n)}</b><small>${esc(E.GAMES[w.g])}・正解 ${w.ok}・まちがい ${w.ng}</small></div><button class="btn sub mini" data-sdrv="${w.g}">苦手克服ラン</button></div>`).join(''):'<p class="note">まちがえた項目はまだない</p>'}
    </div>
    <p class="sd-foot">記録はこの端末の中だけにある。</p>
    <div class="row-btns"><button class="btn go" data-ov="close">閉じる</button></div>`,'stats');
}
$('ov').addEventListener('click',e=>{
  if(OVK!=='stats')return;
  const c=e.target.closest('[data-day]');
  if(c){const x=statsOf().days[c.dataset.day]||{ok:0,ng:0,ms:0};const [,m,d]=c.dataset.day.split('-');
    document.querySelectorAll('.sd-col.on').forEach(z=>z.classList.remove('on'));c.classList.add('on');
    $('sdTip').textContent=`${+m}/${+d}：正解 ${x.ok}・まちがい ${x.ng}・${Math.round((x.ms||0)/60000)}分`;return;}
  const r=e.target.closest('[data-sdrv]');
  if(r){const g=r.dataset.sdrv;closeOverlay();SAVE.g=g;persist();renderTitle();startSolo('rv',g);}
});
$('ov').addEventListener('mouseover',e=>{if(OVK!=='stats')return;const c=e.target.closest('[data-day]');if(c)c.click();});
$('btnStats').addEventListener('click',()=>{audio();statsOverlay();});

/* ================= 全国ランキング ================= */
const RKV={g:'rx',st:'s1',days:7};
function rankOverlay(g,st,days){
  if(OVK==='result')RKV.back={html:$('ovPanel').innerHTML};else if(OVK!=='rank')RKV.back=null;
  if(g)RKV.g=g;if(st)RKV.st=st;if(days!=null)RKV.days=days;
  if(!RK.ranked(RKV.g,'s1'))RKV.g='rx';
  const ST=stagesOf(RKV.g).filter(x=>RK.ranked(RKV.g,x.id));if(!ST.some(x=>x.id===RKV.st))RKV.st=ST[0].id;
  const key=rankKey(RKV.g,RKV.st,SAVE.busy,SAVE.coef);
  const modes=[...RK.RANKED].map(x=>`<option value="${x}" ${x===RKV.g?'selected':''}>${esc(E.GAMES[x])}</option>`).join('');
  overlay(`<h2>🏆 全国ランキング</h2>
    <div class="rk-ctl"><select data-rk="g">${modes}</select>
      <select data-rk="st">${ST.map(x=>`<option value="${x.id}" ${x.id===RKV.st?'selected':''}>${esc(x.lvl+' '+x.name)}</option>`).join('')}</select></div>
    <div class="seg rk-per"><button data-rkd="7" class="${RKV.days===7?'on':''}">今週</button><button data-rkd="0" class="${RKV.days===0?'on':''}">全期間</button></div>
    <p class="note">忙しさ「${E.busyOf(SAVE.busy).name}」${RKV.g==='rx'&&SAVE.coef?'・係数判定ON':''}のソロの点数（1人1つ、自己ベスト）。忙しさはタイトル画面で切り替え。</p>
    <div class="rank" id="rkList"><p class="note">読み込み中…</p></div>
    <div class="row-btns">${RKV.back?'<button class="btn go" data-rkback="1">結果に戻る</button>':'<button class="btn go" data-ov="close">閉じる</button>'}</div>`,'rank');
  const want=[RKV.g,key,RKV.days].join('|');
  RK.top(RKV.g,key,RKV.days).then(rows=>{
    const el=$('rkList');if(!el||OVK!=='rank'||[RKV.g,rankKey(RKV.g,RKV.st,SAVE.busy,SAVE.coef),RKV.days].join('|')!==want)return;
    if(!Array.isArray(rows)||!rows.length){el.innerHTML='<p class="note">まだ誰もいない。一番乗りしろ。</p>';return;}
    el.innerHTML=rows.map((x,i)=>`${i&&x.rank-rows[i-1].rank>1?'<div class="rk-gap">…</div>':''}<div class="rk${x.me?' me':''}" style="--pc:${x.rank===1?'#e0a100':x.rank===2?'#9aa8ae':x.rank===3?'#b8743a':'#3c5560'}">
      <div class="no">${x.rank<=3?['🥇','🥈','🥉'][x.rank-1]:x.rank}</div><div><div class="nm">${esc(x.name)}${x.me?'（あなた）':''}</div><div class="sub">${new Date(x.at).toLocaleDateString('ja-JP')}</div></div><div class="sc">${x.score}</div></div>`).join('');
  }).catch(err=>{const el=$('rkList');if(el)el.innerHTML=`<p class="note">読み込めなかった（${esc(String(err&&err.message||err).slice(0,60))}）</p>`;});
}
$('ov').addEventListener('change',e=>{const t=e.target.closest('[data-rk]');if(!t||OVK!=='rank')return;
  if(t.dataset.rk==='g')rankOverlay(t.value,null,null);else rankOverlay(null,t.value,null);});
$('ov').addEventListener('click',e=>{
  if(e.target.closest('[data-rkback]')&&RKV.back){overlay(RKV.back.html,'result');RKV.back=null;return;}
  const d=e.target.closest('[data-rkd]');if(d&&OVK==='rank'){rankOverlay(null,null,+d.dataset.rkd);return;}
  const b=e.target.closest('[data-rank]');if(b){const [g,st]=b.dataset.rank.split('|');rankOverlay(g,st,7);}
});
$('btnRank').addEventListener('click',()=>{audio();const g=GK(SAVE.g);rankOverlay(RK.ranked(g,'s1')?g:'rx',null,7);});

/* ================= 図鑑 ================= */
function renderDex(){
  $('dexTitle').textContent=UNIT[GK(SAVE.g)]+'図鑑';
  if(SAVE.g==='atom'){renderDexA();return;}
  if(SAVE.g==='org'){renderDexO();return;}
  if(SAVE.g==='ion'){renderDexI();return;}
  if(ENG.includes(SAVE.g)){renderDexE(SAVE.g);return;}
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
// 官能基モードの図鑑：化合物はレベル別、見分けは別の欄。開くと検出試薬8種の結果の表が出る
const LVNAME=['','基礎','基礎＋','標準（芳香族）','応用（異性体・ひっかけ）'];
function renderDexO(){
  let h='',seen=0,master=0;
  for(let lv=1;lv<=4;lv++){
    const items=O.DB.filter(d=>d.lv===lv);
    h+=`<div class="dex-sec"><h4>${LVNAME[lv]}</h4><div class="dex-grid">`;
    items.forEach(d=>{
      const m=SAVE.org.mastery[d.id];
      if(m&&m.seen){seen++;if(m.box>=5)master++;
        h+=`<button class="dx" data-dxo="${esc(d.id)}"><div class="f">${fmt(d.f)}</div>${esc(d.n)}<div class="s">${stars3(m.box)}</div></button>`;}
      else h+=`<div class="dx unseen"><div class="f">？？？</div>未注文</div>`;
    });
    h+='</div></div>';
  }
  h+=`<div class="dex-sec"><h4>見分け（検出試薬）</h4><div class="dex-grid">`;
  O.PAIRS.forEach(p=>{
    const m=SAVE.org.mastery[p.id];
    if(m&&m.seen){seen++;if(m.box>=5)master++;
      h+=`<button class="dx" data-dxo="${esc(p.id)}"><div class="f" style="font-size:12px">${esc(O.BYID[p.a].n)}<br>／${esc(O.BYID[p.b].n)}</div>${esc(O.answerText(p.id))}<div class="s">${stars3(m.box)}</div></button>`;}
    else h+=`<div class="dx unseen"><div class="f">？？？</div>未注文</div>`;
  });
  h+='</div></div>';
  $('dexList').innerHTML=h;
  $('dexSum').textContent=`出会った化合物・見分け ${seen} / ${O.DB.length+O.PAIRS.length}　習得（★5） ${master}　対戦成績 ${SAVE.vs.win}勝${SAVE.vs.lose}敗${SAVE.vs.draw?SAVE.vs.draw+'分':''}`;
}
// 無機イオンモードの図鑑：レベル別の物質と、半反応式
const LVNAME_I=['','基礎（イオンの組み立て）','基礎＋（酸・塩基・塩）','標準（酸化剤・還元剤）','応用（沈殿・錯イオン）'];
function renderDexI(){
  let h='',seen=0,master=0;
  const cell=(k,top,sub)=>{const m=SAVE.ion.mastery[k];if(m&&m.seen){seen++;if(m.box>=5)master++;
    return `<button class="dx" data-dxi="${esc(k)}"><div class="f">${top}</div>${sub}<div class="s">${stars3(m.box)}</div></button>`;}
    return `<div class="dx unseen"><div class="f">？？？</div>未注文</div>`;};
  for(let lv=1;lv<=4;lv++){
    h+=`<div class="dex-sec"><h4>${LVNAME_I[lv]}</h4><div class="dex-grid">`+I.DB.filter(d=>d.lv===lv).map(d=>cell(d.id,I.disp(d.id),esc(d.n))).join('')+'</div></div>';
  }
  h+=`<div class="dex-sec"><h4>半反応式（酸化剤・還元剤）</h4><div class="dex-grid">`+I.HALVES.map(x=>cell(x.id,`<span style="font-size:12px">${esc(x.core)}</span>`,esc(x.role)+(x.cond?'・'+esc(x.cond):''))).join('')+'</div></div>';
  $('dexList').innerHTML=h;
  $('dexSum').textContent=`出会った物質・半反応式 ${seen} / ${I.DB.length+I.HALVES.length}　習得（★5） ${master}　対戦成績 ${SAVE.vs.win}勝${SAVE.vs.lose}敗${SAVE.vs.draw?SAVE.vs.draw+'分':''}`;
}
// 英語モードの図鑑
function renderDexE(g){
  const M=PM[g].M,R=SV(g);let h='',seen=0,master=0,total=0;
  for(const sec of M.dexSections()){
    h+=`<div class="dex-sec"><h4>${esc(sec.h)}</h4><div class="dex-grid">`;
    for(const k of sec.ids){total++;const m=R.mastery[k];
      if(m&&m.seen){seen++;if(m.box>=5)master++;const c=M.dexCell(k);h+=`<button class="dx" data-dxe="${esc(k)}"><div class="f">${c.top}</div>${c.sub}<div class="s">${stars3(m.box)}</div></button>`;}
      else h+=`<div class="dx unseen"><div class="f">？？？</div>未注文</div>`;}
    h+='</div></div>';
  }
  $('dexList').innerHTML=h;
  $('dexSum').textContent=`出会った${UNIT[g]} ${seen} / ${total}　習得（★5） ${master}　対戦成績 ${SAVE.vs.win}勝${SAVE.vs.lose}敗${SAVE.vs.draw?SAVE.vs.draw+'分':''}`;
}
function ionDexDetail(k){
  if(I.isHalf(k)){const x=I.HALF[k];
    return `<p style="margin:0 0 6px;font-weight:800">${esc(x.role)}${x.cond?'（'+esc(x.cond)+'）':''}</p>
      <div class="rev"><div class="it ok" style="font-size:15px">${esc(x.eq)}</div><div class="it ok">酸化数：${esc(x.ox)}</div>
      <div class="it ok">e⁻ ${x.need.e||0}・H⁺ ${x.need.H||0}・H₂O ${x.need.H2O||0}${x.need.OH?'・OH⁻ '+x.need.OH:''}</div></div>`;}
  const d=I.BYID[k];
  return `<p style="margin:0 0 6px;font-weight:800">${esc(d.n)}（${esc(d.k)}${d.cn?`・配位数${d.cn}`:''}）</p>
    <div class="rev"><div class="it ok">イオン：${esc(Object.entries(d.parts).map(([x,n])=>I.PART[x].label+(n>1?'×'+n:'')).join('　'))}</div>${d.p.map(x=>`<div class="it ok">${esc(x)}</div>`).join('')}</div>`;
}
// 検出試薬の結果の表（化合物1つ、または見分けの2つ）
function testTable(ids,hl){
  const mark=(id,t)=>{const r=O.result(id,t);return r==='+'?`<b class="tp">＋</b><small>${esc(O.resultText(id,t))}</small>`:r==='-'?'<span class="tn">−</span>':'<span class="tq" title="教科書・文献で扱いが割れる、または反応が複雑なのでこのゲームでは使わない">？</span>';};
  return `<table class="ttab"><tr><th></th>${ids.map(id=>`<th>${esc(O.BYID[id].n)}</th>`).join('')}</tr>`+
    O.TESTS.map(t=>`<tr class="${hl&&hl.includes(t.id)?'hl':''}"><td>${esc(t.label)}</td>${ids.map(id=>`<td>${mark(id,t.id)}</td>`).join('')}</tr>`).join('')+'</table>';
}
function orgDetail(k){
  if(O.isPair(k)){
    const p=O.PAIR[k];
    return `<p style="margin:0 0 6px;font-weight:800">見分ける試薬：${esc(O.answerText(k))}</p>${testTable([p.a,p.b],p.ok)}
      <p class="note2">＋＝変化が起きる、−＝変化なし、？＝このゲームでは判定に使わない</p>`;
  }
  const d=O.BYID[k];
  const parts=Object.entries(d.parts).map(([x,n])=>`${O.PART[x].label}${n>1?'×'+n:''}`).join('　');
  return `<p style="margin:0 0 6px;font-weight:800">${esc(d.n)}（${esc(d.k)}）　分子式 ${fmt(d.mf)}</p>
    <div class="rev"><div class="it ok">部品：${esc(parts)}</div>${d.p.map(x=>`<div class="it ok">${esc(x)}</div>`).join('')}${d.note?`<div class="it">${esc(d.note)}</div>`:''}</div>
    ${testTable([d.id])}<p class="note2">＋＝変化が起きる、−＝変化なし、？＝このゲームでは判定に使わない</p>`;
}
$('dexList').addEventListener('click',e=>{
  const be=e.target.closest('[data-dxe]');
  if(be&&ENG.includes(SAVE.g)){const g=SAVE.g,M=PM[g].M,k=be.dataset.dxe;if(!M.known(k))return;const m=mst(k,g);
    overlay(`<h2>${M.dexCell(k).top}</h2>${M.dexDetail(k)}<p style="font-size:12px">正解 ${m.ok} 回 / ミス ${m.ng} 回 / 習熟 ${stars3(m.box)}</p><button class="btn" data-ov="close">閉じる</button>`);return;}
  const bi=e.target.closest('[data-dxi]');
  if(bi){const k=bi.dataset.dxi;if(!I.known(k))return;const m=mst(k,'ion');
    overlay(`<h2>${I.isHalf(k)?'半反応式':I.disp(k)}</h2>${ionDexDetail(k)}
      <p style="font-size:12px">正解 ${m.ok} 回 / ミス ${m.ng} 回 / 習熟 ${stars3(m.box)}</p><button class="btn" data-ov="close">閉じる</button>`);return;}
  const bo=e.target.closest('[data-dxo]');
  if(bo){const k=bo.dataset.dxo;if(!O.known(k))return;const m=mst(k,'org');
    overlay(`<h2>${O.isPair(k)?'見分け':fmt(O.BYID[k].f)}</h2>${orgDetail(k)}
      <p style="font-size:12px">正解 ${m.ok} 回 / ミス ${m.ng} 回 / 習熟 ${stars3(m.box)}</p><button class="btn" data-ov="close">閉じる</button>`);return;}
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
function startSolo(stageId,g=SAVE.g,extra=null){
  if(bedGuard(()=>startSolo(stageId,g,extra)))return;
  if(g==='kako'&&!(stageId==='rv'?reviewPool(g).length:E.stageById(g,stageId).pool.length)){kakoNeedOverlay();return;}
  leaveSession(true);
  const st=E.stageById(g,stageId);
  let pool=null;
  if(st.pool==='review'){const p=reviewPool(g);pool=p.length?p:Object.keys(myWeights(g));}
  const cfg={g,busy:SAVE.busy,auto:SAVE.ui.auto,mode:'solo',stageId,players:[{id:'p0',name:myName(),slot:0}],weights:myWeights(g),pool,coef:g==='rx'&&SAVE.coef};
  if(extra){Object.assign(cfg,{rule:extra.rule,drill:extra.drill,order:extra.order,qn:extra.qn,label:extra.label,extra});if(extra.pool)cfg.pool=extra.pool;}
  SES={role:'solo',me:'p0',cfg,S:E.createGame(cfg)};
  enterGame();
  if(extra){countdown(beginLocal);return;}
  if(!(g==='atom'?SAVE.tutA:g==='org'?SAVE.tutO:g==='ion'?SAVE.tutI:ENG.includes(g)||E.isQuiz(g)?SAVE['tut_'+g]:SAVE.tut)&&stageId==='s1'){SES.waitTut=true;tutorial(true,g);}
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
  if(ses.role==='host'&&ses.S.g==='kako')kakoShare(ses);
  if(ses.role==='host'&&((ses.dirty&&now-(ses.lastSnap||0)>=30)||now-(ses.lastSnap||0)>=250))sendSnaps();
  if(ses.S.over&&!ses.ended){ses.ended=true;onGameOver();}
}
/* 過去問の画像をその場で送る：今の問題（と次に出そうな問題）を、持っていない参加者にだけ小分けにして送る。
   受け取った側は画面に出すだけで、端末には保存しない */
const KCHUNK=48000;
const b64=async blob=>{const u=new Uint8Array(await blob.arrayBuffer());let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s);};
function kakoShare(ses){
  const q=ses.S.qz&&ses.S.qz.q;if(!q)return;
  ses.kSent=ses.kSent||{};ses.kOut=ses.kOut||{};
  for(const [cid,pid] of ses.cids){
    const has=(ses.kk||{})[pid]||[],sent=ses.kSent[pid]||(ses.kSent[pid]=new Set());
    if(!has.includes(q.k)&&!sent.has(q.k)){sent.add(q.k);kakoQueue(ses,cid,q.k);}
    if(q.state==='done'&&sent.has(q.k)&&!(ses.kAns||(ses.kAns=new Set())).has(cid+'|'+q.k)){ses.kAns.add(cid+'|'+q.k);ses.net.send(cid,{t:'kans',k:q.k,ans:KK.KAKO.answer(q.k)});}
    const out=ses.kOut[cid];if(out&&out.length)for(let n=0;n<2&&out.length;n++)ses.net.send(cid,out.shift());   // 1回に2つまで（ゲームの通信を詰まらせない）
  }
}
async function kakoQueue(ses,cid,k){
  const it=KKSAVED.find(x=>x.id===k),Q=KK.KAKO.Q[k];if(!it||!Q)return;
  const meta={n:Q.n,subj:Q.subj,slots:Q.slots};   // 正解は送らない（解き終わってから送る）
  const parts=[['q',it.img]].concat(it.lead&&it.useLead?[['lead',it.lead]]:[]);
  const msgs=[];
  for(const [part,blob] of parts){const d=await b64(blob),n=Math.ceil(d.length/KCHUNK);for(let i=0;i<n;i++)msgs.push({t:'kimg',k,part,i,n,np:parts.length,meta,d:d.slice(i*KCHUNK,(i+1)*KCHUNK)});}
  if(SES!==ses)return;(ses.kOut[cid]=ses.kOut[cid]||[]).push(...msgs);
}
function kakoReceive(ses,m){
  if(typeof m.k!=='string'||typeof m.d!=='string'||!(m.n>0&&m.n<400)||!['q','lead'].includes(m.part))return;
  const box=ses.kin||(ses.kin={}),key=m.k+'|'+m.part,b=box[key]||(box[key]={got:0,c:[]});
  if(b.c[m.i]===undefined){b.c[m.i]=m.d;b.got++;}
  if(b.got<m.n)return;
  const raw=atob(b.c.join('')),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);
  const url=URL.createObjectURL(new Blob([u],{type:'image/jpeg'}));delete box[key];
  const B=KK.KAKO,im=B.img[m.k]||(B.img[m.k]={q:null,lead:null});im[m.part]=url;
  if(!B.Q[m.k]&&m.meta){const sl=Math.min(9,Math.max(1,m.meta.slots|0));B.Q[m.k]={k:m.k,n:String(m.meta.n||''),cat:m.meta.subj,src:m.meta.subj,subj:m.meta.subj,clues:Array(KK.SLICES).fill(''),ans:'',slots:sl,shared:true};}
  UI.qsig='';
}
function flushEvents(){
  const ses=SES;if(!ses||!ses.S||!ses.S.ev.length)return;
  for(const e of ses.S.ev){
    if(e.to==='*'||e.to===ses.me)handleEvent(e);
    if(ses.role==='host')for(const pid in ses.q)if(e.to==='*'||e.to===pid)ses.q[pid].push(e);
  }
  ses.S.ev.length=0;ses.dirty=true;
}
// 送るのは「前回から変わった項目」だけ。残り時間などの刻々と減る値は参加者側で同じように進めているので、
// 比べるときは除き、1秒ごとの全体送信でずれを直す。ホストの判断（ack）やイベントがあるときは必ず送る
const TICKING=new Set(['left','t','burn','wait','spawnT','elapsed']);
const shapeOf=v=>JSON.stringify(v,(k,x)=>TICKING.has(k)?undefined:x);
const FULL_MS=1000;
function sendSnaps(){
  const ses=SES;if(!ses||ses.role!=='host'||!ses.S)return;
  const s=E.snapshot(ses.S),now=performance.now(),sh={};
  for(const k in s)sh[k]=shapeOf(s[k]);
  ses.last=ses.last||{};
  for(const [cid,pid] of ses.cids){
    const L=ses.last[pid]||(ses.last[pid]={sh:{},full:-1e9,ack:-1});
    const full=now-L.full>=FULL_MS,ack=ses.acks[pid]||0,ev=ses.q[pid]||[];
    const d={};let n=0;
    for(const k in s)if(full||L.sh[k]!==sh[k]){d[k]=s[k];L.sh[k]=sh[k];n++;}
    if(!n&&!ev.length&&ack===L.ack)continue;          // 伝えることが無ければ送らない
    if(full)L.full=now;L.ack=ack;
    ses.net.send(cid,{t:'s',d,f:full?1:0,ack,ev});ses.q[pid]=[];
  }
  ses.dirty=false;ses.lastSnap=now;
}
// 操作が届いたら待たずに知らせる（ただし30ms以内の連打はまとめる）
function sendSoon(){
  const ses=SES;if(!ses||ses.role!=='host')return;ses.dirty=true;
  const wait=30-(performance.now()-(ses.lastSnap||0));
  if(wait<=0){clearTimeout(ses.soonT);ses.soonT=0;sendSnaps();}
  else if(!ses.soonT)ses.soonT=setTimeout(()=>{ses.soonT=0;if(SES===ses&&ses.dirty)sendSnaps();},wait);   // 次のループを待たない
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
  }else if(ses.S){E.apply(ses.S,ses.me,a);flushEvents();if(ses.role==='host')sendSoon();}
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
    ses.cids.set(cid,pid);ses.wts[pid]=cleanWeights(m.w);ses.kk=ses.kk||{};ses.kk[pid]=Array.isArray(m.kk)?m.kk.filter(x=>typeof x==='string').slice(0,5000):[];ses.q[pid]=[];ses.acks[pid]=0;
    ses.net.send(cid,{t:'welcome',pid,code:ses.code});
    sfx('pop');toastLobby(`${cleanName(m.name)} が入室`);
    lobbyChanged(true);
    return;
  }
  const pid=ses.cids.get(cid);if(!pid)return;
  if(m.t==='a'){
    if(typeof m.q!=='number'||m.q<=(ses.acks[pid]||0))return;
    ses.acks[pid]=m.q;
    if(ses.S&&ses.inGame){E.apply(ses.S,pid,m.a);flushEvents();sendSoon();}
  }else if(m.t==='w'){ses.wts[pid]=cleanWeights(m.w);if(Array.isArray(m.kk)){ses.kk=ses.kk||{};ses.kk[pid]=m.kk.filter(x=>typeof x==='string').slice(0,5000);}}
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
  if(cfg.g==='kako'){
    const st=E.stageById('kako',cfg.stageId),mine=cfg.stageId==='rv'?KK.KAKO.ALL:st.pool;
    // 問題はホストの端末にあるものを使い、持っていない人にはその場で画像を送る（相手の端末には保存しない）
    if(!mine.length){toastLobby('ホストの端末に過去問が無い。ホストがPDFを読み込んで');return;}
    cfg.pool=mine.slice();ses.kSent={};ses.kOut={};
  }
  if(cfg.stageId==='rv'){
    // 苦手ミックス：誰か1人でも★2以下の物質を集める
    const weak=new Set();ws.forEach(w=>{for(const id in w)if(w[id]<=2)weak.add(id);});
    let pool=[...weak];if(pool.length<8)ws.forEach(w=>Object.keys(w).forEach(id=>{if(!pool.includes(id))pool.push(id);}));
    cfg.pool=pool.length>=4?pool:null;
  }
  stopHostLoop();
  ses.S=E.createGame(cfg);ses.inGame=true;ses.ended=false;ses.last={};
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
  net.send({t:'hello',v:PROTO,name:myName(),w:allWeights(),kk:KK.KAKO.ALL});
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
      ses.pending=[];ses.base=m.s;ses.V=prepView(cloneState(m.s));ses.ended=false;closeOverlay();enterGame();countdown(()=>{});break;
    case 's':
      if(!m.d||!ses.me||ses.ended||!ses.base)return;
      if(m.f)ses.base=m.d;else Object.assign(ses.base,m.d);
      ses.V=reconcile(ses,cloneState(ses.base),m.ack|0);
      if(Array.isArray(m.ev))m.ev.forEach(handleEvent);
      break;
    case 'kimg':kakoReceive(ses,m);break;
    case 'kans':{const Q=KK.KAKO.Q[m.k];if(Q&&Q.shared&&typeof m.ans==='string'){Q.ans=m.ans.replace(/[^0-9]/g,'');UI.qsig='';}break;}
    case 'end':
      if(ses.ended)return;ses.ended=true;
      if(m.r)showResults(m.r);
      ses.net.send({t:'w',w:allWeights(),kk:KK.KAKO.ALL});break;
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
const cloneState=typeof structuredClone==='function'?s=>structuredClone(s):s=>JSON.parse(JSON.stringify(s));
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
    <li><b>客ごとに鍋が1つ</b>。伝票をタップして自分が作る客を選ぶ。入れた材料は人ごとに分けて表示され、<b>精錬は全員分を合わせて判定</b>（自分が Fe・O₃、仲間が H₃ → Fe(OH)₃）。</li>
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
    <li><b>客ごとに鍋が1つ</b>。入れた材料は人ごとに分けて表示され、<b>精錬は全員分を合わせて判定</b>（自分が Fe・O₃、仲間が H₃ → Fe(OH)₃）。</li>
    <li>担当外の元素をタップすると担当者に<b>リクエスト</b>。相手がタップすると<b>あなたが選んでいる客の鍋</b>に入る。</li>
    <li>注文どおりにできたら自動で提供。<b>40秒ごとに棚替え</b>。2人以上で入れた鍋は<b>連携ボーナス×1.2</b>。</li></ul>`,
  versus:`<b>対戦のルール（組成モード）</b><ul style="margin:4px 0 0;padding-left:18px">
    <li>注文ボードは全員共通。<b>先に正しく届けた人</b>だけが得点。</li>
    <li>届けると首位の相手に<b>おじゃま</b>。原子が多い物質・VIP・4連続以上・ラッシュ中ほど強い：1=煙幕 2=在庫切れ 3=引火 4以上=大惨事。</li>
    <li>おじゃまは<b>3.5秒後</b>に着弾。それまでに自分も届ければ<b>相殺</b>、余りは打ち返せる。</li>
    <li>鍋は<b>客ごと×プレイヤーごと</b>。違う物を作ると−5。</li></ul>`
};
const RULES_O={
  coop:`<b>協力のルール（官能基モード）</b><ul style="margin:4px 0 0;padding-left:18px">
    <li><b>棚の分担</b>：2人なら<b>骨格担当</b>と<b>官能基担当</b>に分かれる（検出試薬は半分ずつ）。ほぼ全部の化合物が2人の部品を合わせないと組めない。</li>
    <li><b>客ごとに鍋が1つ</b>。入れた部品は人ごとに分けて表示され、<b>全員分を合わせて判定</b>（自分が o-C₆H₄、仲間が –OH と –COOH → サリチル酸）。</li>
    <li>担当外をタップすると担当者に<b>リクエスト</b>。相手がタップすると<b>あなたが選んでいる客の鍋</b>に入る。</li>
    <li>見分けの注文は試薬を選んだ瞬間に判定。<b>40秒ごとに棚替え</b>。2人以上で入れた鍋は<b>連携ボーナス×1.2</b>。</li></ul>`,
  versus:`<b>対戦のルール（官能基モード）</b><ul style="margin:4px 0 0;padding-left:18px">
    <li>注文ボードは全員共通。<b>先に正しく届けた人</b>だけが得点。</li>
    <li>届けると首位の相手に<b>おじゃま</b>。部品が多い・レベルが高い化合物、VIP、4連続以上、ラッシュ中ほど強い。</li>
    <li>おじゃまは<b>3.5秒後</b>に着弾。それまでに自分も届ければ<b>相殺</b>。</li>
    <li>鍋は<b>客ごと×プレイヤーごと</b>。別の化合物・見分けられない試薬は−5。</li></ul>`
};
const RULES_I={
  coop:`<b>協力のルール（無機イオンモード）</b><ul style="margin:4px 0 0;padding-left:18px">
    <li><b>棚の分担</b>：2人なら<b>陽イオン担当</b>と<b>陰イオン担当</b>に分かれる（配位子・e⁻・H₂O は半分ずつ）。ほぼ全部の物質が2人のイオンを合わせないと組めない。</li>
    <li><b>客ごとに鍋が1つ</b>。入れたイオンは人ごとに分けて表示され、<b>全員分を合わせて判定</b>（自分が Al³⁺×2、仲間が SO₄²⁻×3 → 硫酸アルミニウム）。</li>
    <li>担当外をタップすると担当者に<b>リクエスト</b>。相手がタップすると<b>あなたが選んでいる客の鍋</b>に入る。</li>
    <li>半反応式は e⁻・H⁺・H₂O の数を2人で合わせる。<b>40秒ごとに棚替え</b>。2人以上で入れた鍋は<b>連携ボーナス×1.2</b>。</li></ul>`,
  versus:`<b>対戦のルール（無機イオンモード）</b><ul style="margin:4px 0 0;padding-left:18px">
    <li>注文ボードは全員共通。<b>先に正しく届けた人</b>だけが得点。</li>
    <li>届けると首位の相手に<b>おじゃま</b>。イオンが多い物質・係数の大きい半反応式、VIP、4連続以上、ラッシュ中ほど強い。</li>
    <li>おじゃまは<b>3.5秒後</b>に着弾。それまでに自分も届ければ<b>相殺</b>。</li>
    <li>鍋は<b>客ごと×プレイヤーごと</b>。別の物質を作ると−5。</li></ul>`
};
const RULES_Q={
  coop:`<b>協力のルール（早押しクイズ）</b><ul style="margin:4px 0 0;padding-left:18px"><li>全員で同じ問題。だれかが正解すればチームの得点。間違えた人はその問題に答えられなくなる。</li><li>早く答えるほど高得点・早く間違えるほど大きく減点。分かる人に任せる判断も大事。</li></ul>`,
  versus:`<b>対戦のルール（早押しクイズ）</b><ul style="margin:4px 0 0;padding-left:18px"><li>全員で同じ問題を早押し。いちばん早く正解した人だけが得点。</li><li>間違えるとその問題は答えられなくなり、早いほど大きく減点。当てずっぽうは損。</li></ul>`
};
const RULES_E=g=>({
  coop:`<b>協力のルール（${E.GAMES[g]}）</b><ul style="margin:4px 0 0;padding-left:18px">
    <li><b>棚の分担</b>：2人なら<b>左の棚の担当</b>と<b>右の棚の担当</b>に分かれる${g==='eroot'?'（接頭辞担当と語根担当）':g==='eword'?'（紛らわしい2語はふつう別々の担当）':''}。担当外はタップで<b>リクエスト</b>。</li>
    <li><b>客ごとに鍋が1つ</b>。全員が入れた分を合わせて判定する${g==='esyn'?'（入った順番が語順になる）':''}。</li>
    <li><b>40秒ごとに棚替え</b>。2人以上で入れた鍋は<b>連携ボーナス×1.2</b>。</li></ul>`,
  versus:`<b>対戦のルール（${E.GAMES[g]}）</b><ul style="margin:4px 0 0;padding-left:18px">
    <li>注文ボードは全員共通。<b>先に正しく届けた人</b>だけが得点。届けると首位の相手に<b>おじゃま</b>。</li>
    <li>おじゃまは<b>3.5秒後</b>に着弾。それまでに自分も届ければ<b>相殺</b>。鍋は<b>客ごと×プレイヤーごと</b>。</li></ul>`
});
function renderLobby(){
  const ses=SES;if(!ses)return;
  const host=ses.role==='host';
  const cfg=ses.cfg||{g:'rx',mode:'coop',stageId:'s1',split:true};
  const g=GK(cfg.g);
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
  $('lobRules').innerHTML=(E.isQuiz(g)?RULES_Q:ENG.includes(g)?RULES_E(g):g==='atom'?RULES_A:g==='org'?RULES_O:g==='ion'?RULES_I:RULES)[cfg.mode]||'';
  $('lobGame').dataset.subj=subjOf(g);showModes($('lobGame'),g);$('lobSubj').querySelectorAll('button').forEach(b=>{b.classList.toggle('on',b.dataset.subj===subjOf(g));b.disabled=!host;});
  let sh='';
  [...stagesOf(g),{id:'rv',name:'苦手ミックス',desc:`全員の苦手な${UNIT[g]}（★2以下）を集中注文`}].forEach((st,i)=>{
    sh+=`<button class="lst${st.id===cfg.stageId?' on':''}" data-st="${st.id}" ${host?'':'disabled'}><b>${st.lvl?`<span class="lvl lv${i+1}${i===stagesOf(g).length-1?' last':''}">${esc(st.lvl)}</span>`:''}${esc(st.name)}</b><span>${esc(st.desc)}</span></button>`;
  });
  $('lobStages').innerHTML=sh;
  $('lobSplitRow').style.display=cfg.mode==='coop'&&g!=='quiz'?'':'none';
  $('lobAuto').closest('label').style.display=E.isQuiz(g)?'none':'';
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
$('lobGame').addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(!b||!SES||SES.role!=='host')return;const g=GK(b.dataset.g);if(SES.cfg.g!==g){SES.cfg.g=g;SES.cfg.stageId='s1';SAVE.g=g;persist();}sfx('tap');lobbyChanged(true);});
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
  UI.playT0=Date.now();
  UI.sel=null;UI.sig={};UI.cards=new Map();$('orders').innerHTML='';UI.lastTick=-1;UI.pauseShown=false;UI.incSig='';
  $('hudStage').textContent=(V.mode==='coop'?'協力・':V.mode==='versus'?'対戦・':'')+E.stageById(V.g,V.stageId).name+(V.busy&&V.busy!==2?`・${E.busyOf(V.busy).name}`:'');
  // 早押しクイズは棚と伝票を使わず、問題の画面を重ねる
  document.body.classList.toggle('quiz-on',E.isQuiz(V.g));UI.qsig='';$('quizbox').innerHTML='';
  if(E.isQuiz(V.g)){$('ptL').innerHTML='';$('ptR').innerHTML='';$('ptable').className='ptable';}else buildTable(V.g);
  $('feed').innerHTML='';$('incoming').classList.remove('on');$('game').classList.remove('danger');
  $('mpbar').classList.toggle('on',V.mode!=='solo');
  closeStamps();
  show('game');
  applyOrient();
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
  // 参加者は、ホストの状態の写し（base）と画面用の状態（V）の両方の時間を進める（次の差分が届くまでの補間）
  if(SES&&SES.role==='client'&&SES.V){E.advance(SES.V,dt);if(SES.base)E.advance(SES.base,dt);}
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
  if(E.isQuiz(V.g)){
    renderQuiz(V);
    if(V.mode!=='solo'){const sm=sigMP(V);if(sm!==UI.sig.m){UI.sig.m=sm;renderMP(V);}}
    const tEl=$('hudTime'),tt=V.qz?`${Math.max(1,V.qz.n)}/${V.qz.total}`:'';if(tEl.textContent!==tt)tEl.textContent=tt;tEl.classList.remove('low');
    return;
  }
  const so=sigOrders(V);if(so!==UI.sig.o){UI.sig.o=so;renderOrders(V);}
  const sf=sigTarget(V);if(sf!==UI.sig.f){UI.sig.f=sf;renderTarget(V);}
  const sa=sigAct(V);if(sa!==UI.sig.a){UI.sig.a=sa;renderAct(V);}
  const sc=sigCells(V);if(sc!==UI.sig.c){UI.sig.c=sc;renderCells(V);}
  if(V.mode!=='solo'){const sm=sigMP(V);if(sm!==UI.sig.m){UI.sig.m=sm;renderMP(V);}renderRot(V);}
  renderIncoming(V);
  frameUpdate(V);
  if(live){const sec=Math.ceil(V.t);if(sec<=10&&sec>0&&sec!==UI.lastTick){UI.lastTick=sec;sfx('tick');}}
}
// 早押しクイズの画面：ヒントの列・次のヒントまでのバー・選択肢・正解発表
const clueHTML=c=>{const m=c.match(/^(分子式|示性式|化学式)：(.*)$/);return m?`${m[1]}：${fmt(esc(m[2]))}`:esc(c);};
function renderQuiz(V){
  if(V.g==='kako')return renderKako(V);
  $('quizbox').classList.remove('kk');
  const Z=V.qz,q=Z&&Z.q,box=$('quizbox'),QB=E.QBANK[V.g];if(!q){if(box.innerHTML)box.innerHTML='';return;}
  const mine=q.locked[me()];
  const sig=[q.id,q.shown,q.state,q.by,JSON.stringify(q.locked)].join('|');
  if(UI.qsig!==sig){
    UI.qsig=sig;
    const G=$('game'),gr=G.getBoundingClientRect(),hb=G.querySelector('.hud').getBoundingClientRect(),mb=$('mpbar').getBoundingClientRect();
    G.style.setProperty('--qtop',Math.max(hb.bottom,$('mpbar').classList.contains('on')?mb.bottom:0)-gr.top+6+'px');
    const who=q.by?(q.by===me()?'あなた':esc(V.players[q.by].name)):'';
    box.innerHTML=`<div class="qz-head"><b>第${q.no}問</b><span>／${Z.total}</span><span class="qz-val">${q.state==='open'?(mine?'この問題はもう答えられない':`今答えると <b>+${E.quizGain(q)}</b>　まちがえると −${E.quizLoss(q)}`):''}</span></div>
      <ol class="qz-clues">${q.clues.slice(0,q.shown).map((c,i)=>`<li class="${i===q.shown-1&&q.state==='open'?'new':''}">${clueHTML(c)}</li>`).join('')}${q.state==='open'&&q.shown<q.clues.length?'<li class="next"><i data-qbar></i></li>':''}</ol>
      ${q.state==='done'?`<div class="qz-res ${q.by?'ok':'ng'}">${q.by?`${who} が正解`:'正解者なし'}：<b>${esc(QB.Q[q.k].n)}</b></div>`:''}
      <div class="qz-ch">${q.choices.map(c=>{const bad=Object.values(q.locked).includes(c);const cls=q.state==='done'?(c===q.k?'right':bad?'wrong':''):(mine===c?'wrong':'');
        return `<button data-qc="${esc(c)}" class="${cls}" ${q.state!=='open'||mine?'disabled':''}>${esc(QB.Q[c].n)}</button>`;}).join('')}</div>`;
  }
  const bar=box.querySelector('[data-qbar]');if(bar){const r=(q.t-(q.shown-1)*Z.reveal)/Z.reveal;bar.style.transform=`scaleX(${Math.max(0,Math.min(1,r))})`;}
}
// 過去問早押し：問題の画像を上から少しずつ見せる（シャッター）。答えは解答番号の数字を押す
function setQTop(){const G=$('game'),gr=G.getBoundingClientRect(),hb=G.querySelector('.hud').getBoundingClientRect(),mb=$('mpbar').getBoundingClientRect();
  G.style.setProperty('--qtop',Math.max(hb.bottom,$('mpbar').classList.contains('on')?mb.bottom:0)-gr.top+6+'px');}
function renderKako(V){
  const Z=V.qz,q=Z&&Z.q,box=$('quizbox'),B=KK.KAKO;if(!q){if(box.innerHTML)box.innerHTML='';return;}
  box.classList.add('kk');
  const mine=q.locked[me()],it=B.Q[q.k],im=B.img[q.k]&&B.img[q.k].q?B.img[q.k]:null,slots=it?it.slots:1;
  if(UI.kkq!==q.id){UI.kkq=q.id;UI.kkIn='';UI.kkScrolled=null;}
  const sig=[q.id,q.state,q.by,JSON.stringify(q.locked),UI.kkIn,!!im,im&&im.lead].join('|');
  if(UI.qsig!==sig){
    UI.qsig=sig;setQTop();
    const who=q.by?(q.by===me()?'あなた':esc(V.players[q.by].name)):'';
    const done=q.state==='done',ov=box.querySelector('.kk-view'),keep=ov&&UI.kkScrolled===q.id?ov.scrollTop:null;
    box.innerHTML=`<div class="qz-head"><b>第${q.no}問</b><span>／${Z.total}</span><span class="qz-val">${q.state==='open'?(mine?'この問題はもう答えられない':`今答えると <b>+${E.quizGain(q)}</b>　まちがえると −${E.quizLoss(q)}`):''}</span></div>
      <div class="kk-view">${im?`${im.lead?`<img class="kk-lead" src="${im.lead}" alt="">`:''}<div class="kk-paper"><img src="${im.q}" alt=""><div class="kk-shutter" data-shut></div></div>`:`<p class="kk-miss">${SES&&SES.role==='client'?'ホストから問題を受け取り中…':'この問題の画像がこの端末に無い'}</p>`}</div>
      <div class="kk-label">${it?esc(it.n):''}${slots>1?`　<b>解答番号${slots}つ</b>`:''}</div>
      ${done?`<div class="qz-res ${q.by?'ok':'ng'}">${q.by?`${who} が正解`:'正解者なし'}${B.answer(q.k)?'：':''}<b>${esc(B.answer(q.k).split('').map(d=>'⓪①②③④⑤⑥⑦⑧⑨'[+d]).join(' '))}</b></div>`:''}
      <div class="kk-in">${Array.from({length:slots},(_,i)=>`<span class="${i<UI.kkIn.length?'on':''}">${i<UI.kkIn.length?'⓪①②③④⑤⑥⑦⑧⑨'[+UI.kkIn[i]]:''}</span>`).join('')}${mine&&q.state==='open'?`<em>✗ ${esc(mine)}</em>`:''}</div>
      <div class="kk-pad">${'1234567890'.split('').map(d=>`<button data-kd="${d}" ${done||mine?'disabled':''}>${'⓪①②③④⑤⑥⑦⑧⑨'[+d]}</button>`).join('')}${slots>1?`<button data-kd="bs" ${done||mine||!UI.kkIn?'disabled':''}>⌫</button>`:''}</div>`;
    if(keep!=null&&box.querySelector('.kk-view'))box.querySelector('.kk-view').scrollTop=keep;
    // 前置き文が長いときは、問題の始まりが見えるところまで送る（上に戻せば前置き文も読める）
    const vw=box.querySelector('.kk-view'),pp=box.querySelector('.kk-paper');
    if(vw&&pp&&box.querySelector('.kk-lead')&&q.state==='open'&&!UI.kkScrolled){UI.kkScrolled=q.id;const L=box.querySelector('.kk-lead');const go=()=>{vw.scrollTop=Math.max(0,pp.offsetTop-vw.offsetTop-Math.min(60,vw.clientHeight*0.25));};L.complete?go():L.addEventListener('load',go,{once:true});}
  }
  // シャッター：時間に合わせて滑らかに開く（全部見えたら消える）
  const sh=box.querySelector('[data-shut]');if(sh){const f=q.state==='open'?Math.min(1,q.t/(q.clues.length*Z.reveal)):1;sh.style.top=(f*100)+'%';}
}
$('quizbox').addEventListener('pointerdown',e=>{
  const k=e.target.closest('[data-kd]');if(!k||k.disabled)return;
  const V=view();if(!V||!V.running||V.paused||V.over||V.g!=='kako')return;e.preventDefault();
  const q=V.qz.q,it=KK.KAKO.Q[q.k],n=it?it.slots:1;
  if(k.dataset.kd==='bs'){UI.kkIn=UI.kkIn.slice(0,-1);UI.qsig='';return;}
  UI.kkIn=(UI.kkIn+k.dataset.kd).slice(0,n);UI.qsig='';sfx('tap');
  if(UI.kkIn.length>=n){act({t:'ans',c:UI.kkIn});UI.kkIn='';}
});
$('quizbox').addEventListener('pointerdown',e=>{
  const b=e.target.closest('[data-qc]');if(!b||b.disabled)return;
  const V=view();if(!V||!V.running||V.paused||V.over)return;
  e.preventDefault();act({t:'ans',c:b.dataset.qc});sfx('tap');
});
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
const potSig=p=>p?[p.state,p.items.map(a=>a[0]+a[1]+(a[2]||'')+JSON.stringify(a[3]||{})).join(','),p.cat,p.catBy,p.heat,p.fail?p.fail.why:'',p.taps,p.mid||''].join(':'):'-';
function sigOrders(V){
  const foc=V.mode==='coop'?V.order.map(p=>V.players[p].left?'':p+'@'+V.players[p].focus).join(','):'';
  return V.max+'#'+UI.sel+'#'+V.coef+'#'+foc+'#'+V.orders.map(o=>[o.id,E.hintsOf(V,o,me()),Object.entries(o.pots).map(([k,p])=>k+'='+potSig(p)).join(';')].join(':')).join('|');
}
// 鍋の中身（全員がいつでも見えるように伝票に大きく載せる）
const HEATBTN=['🌡常温','🔥加熱','🔥高温高圧'];
// 部品で組むモード（官能基・無機イオン）のチップ・鍋・ボタン（反応式・組成モードの表示はそのまま）
const busyText=(V,k)=>{const kd=PM[V.g].kind(k);return kd==='pair'||kd==='pick'?'判定中…':kd==='half'?'確かめ中…':'組み立て中…';};
function emptyText(V,o){
  const kd=PM[V.g].kind(o.k),port=isPort();
  if(kd==='pair')return port?'↓ 試薬を1つ選ぶ':'下段の試薬を1つ選ぶ';
  if(kd==='pick')return port?'↓ 語を1つ選ぶ（すぐ判定）':'棚から語を1つ選ぶ（すぐ判定）';
  if(PM[V.g].M.ordered)return port?'↓ 語句を順番にタップ':'語句を順番にタップ';
  if(kd==='half')return port?'↓ e⁻・H⁺・H₂O を入れる':'e⁻・H⁺・H₂O の数を合わせる';
  const u=PM[V.g].unit;return port?`↓ ${u}をタップ`:`← ${u}の棚をタップ →`;
}
function chipP(V,[id,n]){return `<span class="chip" data-act="chip" data-s="${esc(id)}">${esc(PM[V.g].M.label(id))}${n>1?`<sub>×${n}</sub>`:''}</span>`;}
function potInnerP(V,o,p){
  const st=potState(p),items=p?p.items:[],M=PM[V.g].M,pair=PM[V.g].kind(o.k)==='pair';
  if(st==='heat')return `<div class="pin heat"><div class="eqp">${pair?`${esc(M.label('@'+p.cat))} で調べる`:items.map(([id,n])=>esc(M.label(id))+(n>1?'×'+n:'')).join(' ')}</div><div class="pbar"><i data-pbar></i></div><span class="pst">${busyText(V,o.k)}</span></div>`;
  if(st==='fail')return `<div class="pin fail">✗ ${esc(p.fail?p.fail.why:'失敗')}</div>`;
  if(st==='fire')return `<div class="pin fire">🔥 燃えている！ あと${4-p.taps}回</div>`;
  if(!items.length&&!(p&&p.cat))return `<div class="pin empty">${o.id===UI.sel?emptyText(V,o):'空の鍋'}</div>`;
  const coop=V.mode==='coop';
  // 構文モード：順番が答えなので、人ごとに分けず入った順に並べる（入れた人の色の下線つき）
  if(M.ordered){
    const by=it=>Object.keys(it[3]||{}).find(q=>it[3][q]>0);
    return `<div class="pin mix seq">${items.map(it=>{const q=by(it);return `<span class="chip${coop&&q&&q!==me()?' mate':''}" data-act="chip" data-s="${esc(it[0])}" style="${q?`--dc:${colorOf(V,q)}`:''}">${esc(M.label(it[0]))}</span>`;}).join('<i class="arr">›</i>')}</div>`;
  }
  const mine=coop?items.map(it=>[it[0],(it[3]&&it[3][me()])||0]).filter(it=>it[1]>0):items;
  let h=mine.map(it=>chipP(V,it)).join('');
  if(coop)for(const q of V.order){
    if(q===me())continue;
    const part=items.filter(it=>it[3]&&it[3][q]>0).map(it=>`<span class="mc">${esc(M.label(it[0]))}${it[3][q]>1?`<sub>×${it[3][q]}</sub>`:''}</span>`);
    if(part.length){const nm=V.players[q]?V.players[q].name:'?';h+=`<span class="grp" style="--dc:${colorOf(V,q)}" title="${esc(nm)}が入れた"><b>${esc([...nm][0]||'?')}</b>${part.join('')}</span>`;}
  }
  return `<div class="pin mix">${h||'<span class="mine-none">あなたの分はまだない</span>'}</div>`;
}
function cardBtnsP(V,o,p){
  const st=potState(p),has=p&&p.items.length>0;
  if(st==='heat')return '';
  if(st==='fail')return `<button data-act="dump" class="wide">鍋を空にしてやり直す</button>`;
  if(st==='fire')return `<button data-act="ext" class="ext wide">消火！</button>`;
  if(PM[V.g].kind(o.k)==='pair'||PM[V.g].kind(o.k)==='pick')return '';
  const auto=V.auto?'<span class="autob">自動</span>':'';
  return `<button class="go" data-act="react" ${has?'':'disabled'}>組む${auto}</button><button class="dump" data-act="dump" aria-label="鍋を空にする" ${has?'':'disabled'}>捨</button>`;
}
function itemChip(V,[id,n,poured]){
  if(V.g==='atom')return `<span class="chip" data-act="chip" data-s="${esc(id)}">${esc(id)}${n>1?`<sub>${n}</sub>`:''}</span>`;
  const s=SUB[id];if(!s)return '';
  return `<span class="chip${poured?' poured':''}" data-act="chip" data-s="${esc(id)}">${!poured&&n>1?`<b class="co">${n}</b>`:''}${fmt(s.f)}${s.cc?`<small>${s.cc}</small>`:''}</span>`;
}
function potInner(V,o,p){
  if(isParts(V.g))return potInnerP(V,o,p);
  const st=potState(p),atom=V.g==='atom',items=p?p.items:[];
  if(st==='heat')return `<div class="pin heat"><div class="eqp">${items.map(([id,n,x])=>`${!x&&n>1?n:''}${fmt(atom?id:fOf(id))}`).join(atom?' ':' + ')}${atom?'':` →${p.cat?`<small>${fmt(cellLabel('@'+p.cat))}</small>`:''}`}</div><div class="pbar"><i data-pbar></i></div><span class="pst">${atom||p.heat?'加熱中…':'反応中…'}</span></div>`;
  if(st==='fail')return `<div class="pin fail">✗ ${atom&&p.fail&&p.fail.label?fmt(p.fail.label)+' ':''}${esc(p.fail?p.fail.why:'失敗')}</div>`;
  if(st==='fire')return `<div class="pin fire">🔥 燃えている！ あと${4-p.taps}回</div>`;
  if(!items.length&&!(p&&p.cat))return `<div class="pin empty">${o.id===UI.sel?(isPort()?(atom?'↓ 周期表をタップ':'↓ 試薬棚をタップ'):(atom?'← 周期表をタップ →':'← 試薬棚をタップ →')):'空の鍋'}</div>`;
  // 協力：この客の鍋は1つで、中身は「入れた人ごと」に分けて並べる（自分の分を先に大きく、仲間の分は名前タグつき）。
  // 精錬は鍋の全員分を合わせて判定する
  const coop=V.mode==='coop';
  const join=a=>atom?a.join(''):a.join('<i class="plus">+</i>');
  const mid=items.filter(it=>it[2]).map(it=>itemChip(V,it));
  const mineIt=coop?items.filter(it=>!it[2]).map(it=>[it[0],(it[3]&&it[3][me()])||0,0]).filter(it=>it[1]>0):items.filter(it=>!it[2]);
  let h=join(mid.concat(mineIt.map(it=>itemChip(V,it))));
  if(p.cat&&(!coop||!p.catBy||p.catBy===me()))h+=`<span class="chip cat" data-act="chip" data-s="@">${fmt(cellLabel('@'+p.cat))}</span>`;
  if(p.mid)h+=`<span class="midn">中間体</span>`;
  if(coop){
    for(const q of V.order){
      if(q===me())continue;
      const part=items.filter(it=>!it[2]&&it[3]&&it[3][q]>0).map(it=>`<span class="mc">${atom?esc(it[0])+(it[3][q]>1?`<sub>${it[3][q]}</sub>`:''):(it[3][q]>1?it[3][q]:'')+fmt(fOf(it[0]))}</span>`);
      if(p.cat&&p.catBy===q)part.push(`<span class="mc cat">${fmt(cellLabel('@'+p.cat))}</span>`);
      if(part.length){const nm=V.players[q]?V.players[q].name:'?';h+=`<span class="grp" style="--dc:${colorOf(V,q)}" title="${esc(nm)}が入れた"><b>${esc([...nm][0]||'?')}</b>${part.join('')}</span>`;}
    }
  }
  return `<div class="pin mix">${h||'<span class="mine-none">あなたの分はまだない</span>'}</div>`;
}
function cardBtns(V,o,p){
  if(isParts(V.g))return cardBtnsP(V,o,p);
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
function mateRows(){return '';}
function cardClass(V,o){
  let cls='ticket card';if(o.vip)cls+=' vip';if(o.id===UI.sel)cls+=' sel';
  const st=potState(myPot(V,o));if(st==='heat')cls+=' cooking';if(st==='fire')cls+=' burning';if(st==='fail')cls+=' failed';
  return cls;
}
// 伝票は客ごとに1つの要素を使い回し、変わった部分（見出し／鍋）だけ書き換える。
// 毎回作り直すと登場アニメーションが再生されて画面がチカチカし、ボタンの位置もずれるため
function cardHead(V,o,k){
  const isName=o.mode==='name',hn=E.hintsOf(V,o,me()),p=myPot(V,o);
  let clue,tags='',proc='',rev='';
  if(isParts(V.g)){
    const X=PM[V.g],kd=X.kind(o.k);
    if(X.head){const hh=X.head(o,isName);clue=hh.clue;proc=hh.proc||'';tags=hh.tags||'';}
    else if(kd==='pair'){
      const P=O.PAIR[o.k];
      clue=`<div class="clue name pairq">${esc(O.BYID[P.a].n)}<small> と </small>${esc(O.BYID[P.b].n)}</div>`;
      proc='<div class="proc">を見分ける試薬は？</div>';tags='<span class="tag">見分け</span>';
    }else if(kd==='half'){
      const h=I.HALF[o.k];
      clue=`<div class="clue name halfq">${esc(h.core)}<small>${esc(h.role)}${h.cond?'・'+esc(h.cond):''}</small></div>`;
      tags='<span class="tag">半反応式</span>';
    }else{
      const d=X.M.BYID[o.k];
      clue=isName?`<div class="clue name">${esc(d.n)}</div>`:`<div class="clue">${esc(d.p[o.ci]||d.p[0])}</div>`;
      tags=`<span class="tag">${isName?'名前':'性質'}</span>`;
    }
    if(hn>=1)rev+=X.hint(o.k,1,o.mode);
    if(hn>=2)rev+=' / '+X.hint(o.k,2,o.mode);
  }else if(V.g==='atom'){
    const d=A.BYID[o.k];
    clue=isName?`<div class="clue name">${esc(d.n)}</div>`:`<div class="clue">${esc(d.p[o.ci]||d.p[0])}</div>`;
    tags=`<span class="tag">${isName?'名前':'性質'}</span>`;
    if(hn>=1)rev+=isName?`元素：${Object.keys(d.m).join('・')}`:esc(d.n);
    if(hn>=2)rev+=' / '+fmt(d.f);
  }else{
    const it=MENU[o.k],tg=TG[it.t]||{p:['?']},steps=stepsOf(o.k);
    clue=isName?`<div class="clue name">${esc(nameOf(it.t))}</div>`:`<div class="clue">${esc(tg.p[o.ci]||tg.p[0])}</div>`;
    tags=`<span class="tag">${CATNAME[it.c]}</span>${steps>1?`<span class="tag step">${steps}段階</span>`:''}`;
    proc=it.proc?`<div class="proc">${esc(it.proc)}で</div>`:'';
    if(hn>=1)rev+=hintHTML(V,o.k,1,o.mode);
    if(hn>=2)rev+='<br>'+hintHTML(V,o.k,2,o.mode);
  }
  return `<div class="t-top"><span class="num">${k+1}</span><span class="face" data-face>${faceFor(o.left/o.total)}</span>
      ${o.vip?'<span class="tag vip">VIP×2</span>':''}${tags}${cardWho(V,o,p)}
      <button class="hint" data-act="hint" ${hn>=2?'disabled':''}>ヒント${hn?hn:''}</button></div>
    <div class="c-clue">${clue}${proc}</div>${rev?`<div class="reveal">${rev}</div>`:''}`;
}
function headSig(V,o,k){
  const who=V.mode==='coop'?V.order.map(q=>q!==me()&&V.players[q].focus===o.id?q:'').join(','):
    V.mode==='versus'?V.order.map(q=>{const op=o.pots[q];return q===me()||!op?'':potState(op)+op.items.length;}).join(','):'';
  return [k,o.mode,E.hintsOf(V,o,me()),who,V.coef].join('|');
}
function potCardSig(V,o){
  const mates=V.mode==='coop'?V.order.filter(q=>q!==me()).map(q=>(V.players[q].focus===o.id?'f':'')+(V.players[q].left?'x':'')).join(','):'';
  return potSig(myPot(V,o))+'|'+mates+'|'+(o.id===UI.sel)+'|'+V.auto;
}
function renderOrders(V){
  const slots=Math.max(V.mode==='solo'?3:4,V.max);
  const box=$('orders');
  if(+box.style.getPropertyValue('--slots')!==slots){box.style.setProperty('--slots',slots);if(isPort())layoutGame();}
  setOrderCols(box,slots);
  const mc=colorOf(V,me());
  if(!UI.cards)UI.cards=new Map();
  const els=[],keep=new Set();
  for(let k=0;k<slots;k++){
    const o=V.orders[k];
    const ok=o&&knownKey(V.g,o.k);
    const key=ok?'o'+o.id:'e'+k;keep.add(key);
    let c=UI.cards.get(key);
    if(!c){
      const el=document.createElement('div');
      if(ok){
        el.className='ticket card enter';el.dataset.o=o.id;
        el.innerHTML='<div class="c-head"></div><div class="c-pot"></div><div class="tbar"><i data-bar></i></div>';
        el.addEventListener('animationend',e=>{if(e.animationName==='slidein')el.classList.remove('enter');});
      }else el.className='ticket empty';
      c={el,cls:null,head:null,pot:null};UI.cards.set(key,c);
    }
    if(ok){
      const cls=cardClass(V,o);
      if(c.cls!==cls){c.cls=cls;const extra=['enter','low'].filter(x=>c.el.classList.contains(x));c.el.className=cls+(extra.length?' '+extra.join(' '):'');}
      c.el.style.setProperty('--mc',mc);
      const hs=headSig(V,o,k);if(c.head!==hs){c.head=hs;c.el.children[0].innerHTML=cardHead(V,o,k);}
      const ps=potCardSig(V,o);if(c.pot!==ps){c.pot=ps;const p=myPot(V,o);c.el.children[1].innerHTML=potInner(V,o,p)+mateRows(V,o)+`<div class="c-btns">${cardBtns(V,o,p)}</div>`;}
    }
    els.push(c.el);
  }
  for(const key of [...UI.cards.keys()])if(!keep.has(key))UI.cards.delete(key);
  const cur=box.children;let same=cur.length===els.length;
  if(same)for(let i=0;i<els.length;i++)if(cur[i]!==els[i]){same=false;break;}
  if(!same)box.replaceChildren(...els);
}
// 棚の空きに「いまタップすると入る先」を表示
function sigTarget(V){const o=V.orders.find(x=>x.id===UI.sel);return UI.sel+'|'+(o?V.orders.indexOf(o)+'|'+o.mode+E.hintsOf(V,o,me()):'-');}
function sigAct(V){const o=V.orders.find(x=>x.id===UI.sel);return isPort()+'|'+UI.sel+'|'+V.auto+'|'+(o?V.orders.indexOf(o)+potSig(myPot(V,o)):'-');}
function renderAct(V){
  const host=document.body.classList.contains('pt-stack')?$('ptAct'):$('actbar');
  if(!isPort()||!host)return;
  const o=V.orders.find(x=>x.id===UI.sel),p=o&&myPot(V,o);
  if(!o){host.innerHTML='<span class="ab-msg">伝票（客）をタップして選ぶ</span>';return;}
  const st=potState(p);
  const btns=st==='heat'?`<span class="ab-msg">${V.g==='atom'?'加熱中…':isParts(V.g)?busyText(V,o.k):'反応中…'}</span>`:(cardBtns(V,o,p)||`<span class="ab-msg">${PM[V.g]&&PM[V.g].kind(o.k)==='pick'?'語を1つ選ぶ（選んだ瞬間に判定）':'検出試薬（最下段）を1つ選ぶ'}</span>`);
  host.innerHTML=`<b class="num" style="--mc:${colorOf(V,me())}">${V.orders.indexOf(o)+1}</b>${btns}`;
  host.className=host.id==='ptAct'?'pt-act s-'+st:'actbar s-'+st;
}
function renderTarget(V){
  const el=$('ptTarget');if(!el)return;
  const o=V.orders.find(x=>x.id===UI.sel);
  if(!o){el.innerHTML='伝票（客）を選ぶと入れ先が出る';el.style.removeProperty('--mc');return;}
  const T=(E.RULES[V.g]||E.RULES.rx).tgt(o.k);
  const nm=T.pair?'見分け：'+esc(T.n):T.half?'半反応式：'+esc(T.n):T.pick?'空所に入る語':o.mode==='name'||E.hintsOf(V,o,me())>=1?esc(T.n):'性質の注文';
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
  T.classList.toggle('rx',g!=='atom');T.classList.toggle('pt',g==='atom');T.classList.toggle('org',g==='org');T.classList.toggle('ion',g==='ion');T.classList.toggle('parts',isParts(g));T.classList.toggle('eng',ENG.includes(g));T.classList.remove('dark');
  if(g==='atom'){
    // 周期表を 1〜9族（左端）と 10〜18族（右端）に分けて置く
    const stk=document.body.classList.contains('pt-stack');
    const half=(g0,g1,side)=>{
      const off=side==='L'||stk?1:0,lc=side==='L'||stk?1:g1-g0+2;
      let h=`<div class="pt-corner" style="grid-column:${lc};grid-row:1">族</div>`;
      for(let gr=g0;gr<=g1;gr++)h+=`<div class="glab" style="grid-column:${gr-g0+1+off};grid-row:1">${gr}</div>`;
      for(let p=1;p<=7;p++)h+=`<div class="plab" style="grid-column:${lc};grid-row:${p+1}">${p}</div>`;
      A.PT.filter(e=>e.g>=g0&&e.g<=g1).forEach(e=>{h+=cellHTMLA(e,e.g-g0+1+off);});
      return h;
    };
    let hl=half(1,9,'L');
    for(const k of ['*La','*Ac']){
      const P=A.POS[k],nm=k==='*La'?'ランタノイド':'アクチノイド';
      hl+=`<div class="cell c-f ph${P.p===7?' p7':''}" style="grid-column:${P.g+1};grid-row:${P.p+1}" title="${nm}（${P.z0}〜${P.z1}）"><span class="z">${P.z0}-${P.z1}</span><span class="sym">${k==='*La'?'*':'**'}</span></div>`;
    }
    hl+=`<div class="pt-info" id="ptInfo" style="grid-column:3 / 11;grid-row:2">元素をタップすると名前・周期・族が出る</div>`;
    hl+=`<div class="pt-act" id="ptAct" style="grid-column:4 / 11;grid-row:3 / 5"></div>`;
    hl+=`<div class="pt-legend" style="grid-column:4 / 11;grid-row:3 / 5">${Object.entries(A.CATJP).map(([k,v])=>`<span><i class="c-${k}"></i>${v}</span>`).join('')}</div>`;
    let hr=half(10,18,'R');
    const o2=stk?1:0;
    hr+=`<div class="pt-target" id="ptTarget" style="grid-column:${1+o2} / ${9+o2};grid-row:2"></div>`;
    hr+=`<div class="pt-note" style="grid-column:${1+o2} / ${4+o2};grid-row:3 / 5">10〜12族は<br>遷移元素</div>`;
    L.innerHTML=hl;R.innerHTML=hr;
  }else if(isParts(g)){
    // 官能基モード：左に骨格・右に官能基・最下段に検出試薬／無機イオンモード：左に陽イオン・右に陰イオン・最下段に配位子と半反応式の部品
    const X=PM[g],sh=X.shelf,cell=k=>cellHTMLP(k,g);
    L.innerHTML=`<div class="shelf-cap" id="ptInfo">${esc(X.cap)}</div>`+sh.L.main.map(cell).join('')+`<div class="shelf-cap cat">${esc(sh.L.cap2)}</div>`+sh.L.bottom.map(cell).join('');
    R.innerHTML=`<div class="shelf-cap pt-target" id="ptTarget"></div>`+sh.R.main.map(cell).join('')+`<div class="shelf-cap cat">${esc(sh.R.cap2)}</div>`+sh.R.bottom.map(cell).join('');
  }else{
    // 試薬棚も左右に4列ずつ
    const half=(c0,c1)=>SHELF.map(row=>row.slice(c0,c1).map(cellHTML).join('')).join('');
    L.innerHTML=`<div class="shelf-cap" id="ptInfo">試薬棚：タップで選んだ客の鍋へ</div>`+half(0,4)+`<div class="shelf-cap cat">触媒・脱水剤</div>`+CATS.slice(0,4).map(c=>cellHTML('@'+c)).join('');
    R.innerHTML=`<div class="shelf-cap pt-target" id="ptTarget"></div>`+half(4,8)+`<div class="shelf-cap cat">（矢印の上に書く）</div>`+CATS.slice(4).map(c=>cellHTML('@'+c)).join('');
  }
  UI.sig.f=null;UI.sig.a=null;UI.tblKey=g+'|'+document.body.classList.contains('pt-stack');
  requestAnimationFrame(layoutGame);
}
const OCLS={H:'alk',CH3:'alk',C2H5:'alk',C3H7:'alk',C6H5:'aro',oC6H4:'aro',mC6H4:'aro',pC6H4:'aro',CH2CH:'uns',cisCHCH:'uns',trCHCH:'uns',CHC:'uns',
  OH:'oh',CHOH:'oh',CHO:'cho',CO:'co',COOH:'cooh',COO:'coo',O:'eth',NH2:'n',NO2:'n',NHCO:'n',SO3H:'s',Cl:'cl'};
// 部品ラベルの幅の見積もり（em）：全角1、英大文字0.65、ダッシュ・上付き/下付きの数字と符号0.5
const labWO=t=>[...t].reduce((w,ch)=>w+(/[^\x00-\x7f₀-₉⁰-⁹⁺⁻²³¹–]/.test(ch)?1:/[₀-₉⁰-⁹⁺⁻²³¹–]/.test(ch)?0.5:/[A-Z=≡]/.test(ch)?0.65:/[()]/.test(ch)?0.35:0.55),0);
// マスが狭いときに2行に分ける位置（読み違えない所だけ）
const OBRK={'CH₂=CH–':'CH₂=|CH–','–CH=CH–':'–CH=|CH–','HC≡C–':'HC≡|C–','–CH(OH)–':'–CH|(OH)–','–NHCO–':'–NH|CO–',
  'NaHCO₃':'Na|HCO₃','I₂+NaOH':'I₂|+NaOH','o-C₆H₄':'o-|C₆H₄','m-C₆H₄':'m-|C₆H₄','p-C₆H₄':'p-|C₆H₄',
  'CH₃COO⁻':'CH₃|COO⁻','Cr₂O₇²⁻':'Cr₂|O₇²⁻','S₂O₃²⁻':'S₂|O₃²⁻','H₂PO₄⁻':'H₂|PO₄⁻','HPO₄²⁻':'H|PO₄²⁻','C₂O₄²⁻':'C₂|O₄²⁻',
  'MnO₄⁻':'Mn|O₄⁻','CrO₄²⁻':'Cr|O₄²⁻','HSO₄⁻':'H|SO₄⁻','HCO₃⁻':'H|CO₃⁻','ClO₃⁻':'Cl|O₃⁻','SO₄²⁻':'S|O₄²⁻','SO₃²⁻':'S|O₃²⁻','CO₃²⁻':'C|O₃²⁻','PO₄³⁻':'P|O₄³⁻'};
function cellHTMLP(key,g){
  const M=PM[g].M,lab=M.label(key),nm=M.cellName(key);
  const [a,b]=M.noSplit?[lab,'']:lab.split(' ');  // 「–CH=CH– シス」の シス／トランス は下に小さく（英語は分けない）
  const jp=/[^\x00-\x7f₀-₉⁰-⁹⁺⁻²³¹–≡]/.test(a);
  const px=jp?(a.length<=3?13:11.5):Math.max(10,Math.min(16,Math.floor(46/labWO(a)*10)/10));
  const br=OBRK[a]||(M.brk&&M.brk(a))||(M.noSplit&&a.includes(' ')?a.replace(' ','|'):'');   // 英語の2語の語句は狭いとき2行に
  const two=br?`<span class="l2">${br.split('|').map(esc).join('<br>')}</span>`:'';
  return `<button class="cell ${PM[g].cls(key)}" data-el="${esc(key)}" aria-label="${esc(nm)}" title="${esc(nm)}"><span class="sym${jp?' jp':''}" data-px="${px}" style="font-size:${px}px"><span class="l1">${esc(a)}</span>${two}${b?`<small class="cc">${esc(b)}</small>`:''}</span><span class="nm">${esc(nm.replace(/（.*）/,''))}</span><span class="bd"></span></button>`;
}
// 実際の幅を測って、マスに収まるまで文字を小さくする（部品で組むモードの棚）
function fitShelfLabels(){
  const T=$('ptable');if(!T||!T.classList.contains('parts'))return;
  T.querySelectorAll('.cell[data-el] .sym:not(.jp)').forEach(y=>{   // 日本語のラベルは折り返すので縮めない
    const c=y.parentElement,base=+y.dataset.px||14,avail=c.clientWidth-6;if(avail<=0)return;
    y.classList.remove('two');y.style.fontSize=base+'px';
    let w=y.scrollWidth;
    // 1行だと大きく縮むなら、2行に分けたほうを使う
    if(w>avail&&base*avail/w<11&&y.querySelector('.l2')){y.classList.add('two');w=y.scrollWidth;}
    if(w>avail)y.style.fontSize=Math.max(8,Math.floor(base*avail/w*10)/10)+'px';
  });
}
function cellHTMLA(e,col){return `<button class="cell c-${e.c}${e.p===7?' p7':''}" data-el="${e.s}" style="grid-column:${col??e.g+1};grid-row:${e.p+1}" aria-label="${e.s} ${A.ELNAME[e.s]||''}"><span class="z">${e.z}</span><span class="sym">${e.s}</span><span class="nm">${A.ELNAME[e.s]||''}</span><span class="bd"></span></button>`;}
// 伝票の列数と1段の高さ（横持ちは細くなりすぎるとき2段に折り返す）
function setOrderCols(box,slots){
  const W=box.clientWidth||600;
  if(!isPort())box.classList.remove('narrow','big');
  if(isPort()){
    const H=box.clientHeight,cols=portCols(slots,W,H),rows=Math.ceil(slots/cols);
    const rowh=Math.floor(Math.min(W>=600?280:210,(H-(rows-1)*6)/rows));
    box.classList.toggle('narrow',W/cols<170);box.classList.toggle('big',W/cols>=300&&rowh>=200);
    box.style.setProperty('--cols',cols);box.style.setProperty('--rows',rows);
    if(H>0)box.style.setProperty('--rowh',rowh+'px');
    return;
  }
  const cols=Math.max(1,Math.min(slots,Math.floor(W/104)||1,SAVE.ui.layout==='bottom'?3:2));
  const rows=Math.ceil(slots/cols);
  box.style.setProperty('--cols',cols);box.style.setProperty('--rows',rows);
  // カードが縦に伸びすぎないよう、1段の高さは最大230px
  const H=box.clientHeight;
  if(H>0)box.style.setProperty('--rowh',Math.floor(Math.min(230,(H-(rows-1)*6)/rows))+'px');
}
// 周期表のマスが縦長になりすぎないよう、行の高さをマスの幅の1.5倍までにする
function fitTable(){
  if(isPort())return;
  for(const H of [$('ptL'),$('ptR')]){
    if(!H)continue;
    H.style.gridTemplateRows='';H.style.alignContent='';
    if(!$('ptable').classList.contains('pt'))continue;
    const w=H.clientWidth-8,h=H.clientHeight-8;if(w<=0||h<=0)continue;
    const rh=Math.max(18,Math.min((h-12-14)/7,(w-12-16)/9*1.7));
    H.style.gridTemplateRows=`12px repeat(7,${Math.floor(rh)}px)`;H.style.alignContent='center';
  }
}

/* ---------- 画面の向き（横持ち／縦持ち） ---------- */
const scrPort=()=>innerHeight>innerWidth;
const isPort=()=>document.body.classList.contains('ui-port');
// 縦持ちの伝票の段数：3枚までは1段（縦に余裕があれば2×2で幅広に）、4枚は2×2（幅があれば1段）、5〜6枚は3×2
const portRows=(slots,W)=>slots<=3?1:slots===4?(W>=560?1:2):2;
const portCols=(slots,W,H=0)=>slots<=3&&H>=2*118+6?2:Math.ceil(slots/portRows(slots,W));
function wantPort(){const o=SAVE.ui.orient;return o==='port'||(o!=='land'&&scrPort());}
function applyOrient(){
  const b=document.body.classList,port=wantPort(),sp=scrPort();
  if(b.contains('ui-port')!==port&&UI.cards)for(const c of UI.cards.values()){c.pot=null;c.head=null;}
  b.toggle('ui-port',port);b.toggle('ui-land',!port);b.toggle('scr-land',!sp);
  // 向きを固定していて、持ち方が逆のスマホなら案内を出す
  const mis=port!==sp&&Math.min(innerWidth,innerHeight)<600;
  b.toggle('need-rot',mis);
  if(mis){
    const r=$('rotate');
    r.querySelector('b').textContent=port?'スマホを縦向きにして遊ぶ':'スマホを横向きにして遊ぶ';
    r.querySelector('p').textContent=port?'設定で「縦持ち」に固定している。横のまま遊ぶなら「持ち方に合わせる」にする。':'設定で「横持ち」に固定している。縦のまま遊ぶなら「持ち方に合わせる」にする。';
    r.querySelector('.rot-ico').textContent=port?'📱↺':'📱↻';
  }
  // 組成モードの縦持ち：幅が足りなければ周期表を上下2段（1〜9族／10〜18族）にする
  const G=$('game'),gw=Math.min(innerWidth,port&&!sp?innerHeight*0.62:innerWidth);
  b.toggle('pt-stack',port&&$('ptable').classList.contains('pt')&&gw<600);
  // 部品で組むモードの縦持ち（スマホ）：左右の棚を上下に重ね、6列にしてマスを広げる
  b.toggle('shelf-stack',port&&$('ptable').classList.contains('parts')&&gw<600);
  const V=view();
  if(V&&CUR==='game'&&UI.tblKey!==V.g+'|'+b.contains('pt-stack')){UI.sig={};buildTable(V.g);}
  UI.sig.a=null;
  layoutGame();
}
// 縦持ち：上から HUD・伝票・（操作ボタン）・棚。棚の行の高さを画面に合わせて決め、残りを伝票に回す
function layoutGame(){
  const G=$('game'),T=$('ptable');if(!G)return;
  for(const H of [$('ptL'),$('ptR')])if(H){H.style.removeProperty('grid-template-rows');H.style.removeProperty('grid-template-columns');H.style.removeProperty('--cs');}
  T.style.removeProperty('--rxk');
  const ob=$('orders'),slots=+getComputedStyle(ob).getPropertyValue('--slots')||4;
  if(!isPort()){G.style.removeProperty('grid-template-rows');G.style.removeProperty('grid-template-areas');setOrderCols(ob,slots);fitTable();fitShelfLabels();return;}
  if(!G.classList.contains('on'))return;
  const cs=getComputedStyle(G),gap=parseFloat(cs.rowGap)||5;
  const W=G.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
  const H=G.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);
  const atom=T.classList.contains('pt'),stack=document.body.classList.contains('pt-stack');
  const hud=G.querySelector('.hud').offsetHeight,mpOn=$('mpbar').classList.contains('on'),mp=mpOn?$('mpbar').offsetHeight:0;
  const ab=$('actbar'),act=stack?0:(ab.offsetHeight||40);
  const tr=[['hud hud','auto']];if(mpOn)tr.push(['mp mp','auto']);tr.push(['orders orders','minmax(0,1fr)']);if(!stack)tr.push(['act act','auto']);
  const nTbl=stack||document.body.classList.contains('shelf-stack')?2:1;
  const avail=H-hud-mp-act-(tr.length+nTbl-1)*gap;
  const rows=portRows(slots,W);
  const fsk={s:.9,m:1,l:1.15}[SAVE.ui.fs]||1;
  // 部品で組むモードは鍋の中身（チップ）が多いので、伝票を少し高めに取る
  const ordMin=rows*Math.round(((rows>1?82:88)+(T.classList.contains('parts')?14:0))*fsk)+(rows-1)*6;
  let rh,hh,tpl,cw;
  if(atom){
    const fix=6+8+10+7*2,units=6.6;               // 枠・余白・族の行・行間、第7周期は0.6行
    const hw=stack?W:(W-gap)/2;cw=(hw-6-8-12-9*2)/9;
    rh=(avail-ordMin-nTbl*fix)/(nTbl*units);
    // スマホ（上下2段）はほぼ正方形、タブレット（1枚の周期表）は縦長1.5倍まで
    rh=Math.floor(Math.max(22,Math.min(rh,cw*(stack?1.15:1.5),64)));
    const r7=Math.max(14,Math.round(rh*0.6));
    hh=fix+6*rh+r7;tpl=`10px repeat(6,${rh}px) ${r7}px`;
  }else if(document.body.classList.contains('shelf-stack')){
    // 部品で組むモード（縦持ち・スマホ）：上段＝左の棚、下段＝右の棚。官能基は6列、無機イオンは7列
    const X=PM[curG()],sh=X.shelf,nc=X.stackCols||6,mr=Math.max(Math.ceil(sh.L.main.length/nc),Math.ceil(sh.R.main.length/nc));
    const fix=6+8+13+13+(mr+2)*2;
    cw=(W-6-8-(nc-1)*2)/nc;
    for(const h of [$('ptL'),$('ptR')])h.style.gridTemplateColumns=`repeat(${nc},minmax(0,1fr))`;
    rh=(avail-ordMin-2*fix)/(2*(mr+1));
    rh=Math.floor(Math.max(28,Math.min(rh,cw*0.95,56)));
    hh=fix+(mr+1)*rh;tpl=`13px repeat(${mr},${rh}px) 13px ${rh}px`;
  }else{
    const sh=T.classList.contains('parts')&&PM[curG()].shelf;
    const nr=sh?Math.max(Math.ceil(sh.L.main.length/4),Math.ceil(sh.R.main.length/4)):6;    // 試薬棚6段／部品の棚（＋最下段）
    const fix=6+8+13+13+(nr+2)*2;
    cw=((W-gap)/2-6-8-3*2)/4;
    rh=(avail-ordMin-fix)/(nr+1);
    rh=Math.floor(Math.max(30,Math.min(rh,cw*1.25,64)));
    hh=fix+(nr+1)*rh;tpl=`13px repeat(${nr},${rh}px) 13px ${rh}px`;
    T.style.setProperty('--rxk',Math.max(1,Math.min(1.3,(Math.min(cw,rh)-6)/34)).toFixed(2));
  }
  if(stack||document.body.classList.contains('shelf-stack'))tr.push(['tl tl',hh+'px'],['tr tr',hh+'px']);else tr.push(['tl tr',hh+'px']);
  G.style.gridTemplateAreas=tr.map(x=>`"${x[0]}"`).join(' ');
  G.style.gridTemplateRows=tr.map(x=>x[1]).join(' ');
  for(const h of [$('ptL'),$('ptR')]){h.style.gridTemplateRows=tpl;h.style.setProperty('--cs',Math.floor(Math.min(cw,rh*1.3))+'px');}
  setOrderCols(ob,slots);fitShelfLabels();
}
let rzT=0;
function onResize(){cancelAnimationFrame(rzT);rzT=requestAnimationFrame(applyOrient);}
window.addEventListener('resize',onResize);
window.addEventListener('orientationchange',()=>setTimeout(onResize,250));
// タップした元素・試薬の情報を表示（覚えるための手がかり）
let infoT=0;
function showInfo(g,k){
  if(isParts(g)){
    const cap=$('ptInfo'),X=PM[g];if(!cap)return;
    cap.textContent=`${X.M.label(k)}：${X.M.cellName(k)}`;cap.classList.add('info');
    clearTimeout(infoT);infoT=setTimeout(()=>{cap.textContent=X.cap;cap.classList.remove('info');},1800);
    return;
  }
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
  const vs=V.mode==='versus'||E.isQuiz(V.g);
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
  // 官能基モード：組み立ての注文に検出試薬、見分けの注文に部品は入らない
  if(!pendingToMe&&o&&RL.accept){const no=RL.accept(o,s);if(no){toast(no,'ng');sfx('lock');return false;}}
  if(req&&V.reqs.filter(r=>r.from===M).length>=8){toast('リクエストは8個まで','ng');sfx('lock');return false;}
  if(!req&&!pendingToMe&&p&&s[0]!=='@'){
    const x=p.items.find(y=>y[0]===s);
    if(x&&(x[2]||x[1]>=RL.maxCoef))return false;
    if(!x&&p.items.length>=RL.maxSpecies){toast(`${V.g==='atom'?'元素':isParts(V.g)?PM[V.g].unit:'試薬'}は${RL.maxSpecies}種類まで`,'ng');return false;}
  }
  act({t:'add',s,o:o?o.id:null});
  showInfo(V.g,s);
  sfx(req?'req':s[0]==='@'?'pop':'tap');
  if(cell){cell.classList.add('hit');setTimeout(()=>cell.classList.remove('hit'),80);}
  return s[0]!=='@';
}
// 戻り値 true：次の客へ自動で移った
function cardAct(V,o,a,b){
  const id=o.id,p=myPot(V,o);
  if(a==='hint'){if(E.hintsOf(V,o,me())<2){act({t:'hint',o:id});sfx('tap');}}
  else if(a==='react'){
    if(p&&p.state==='idle'&&p.items.length){
      act({t:'react',o:id});sfx('react');
      if(SAVE.ui.adv&&UI.sel===id){const nx=V.orders.find(x=>x.id!==id&&potState(myPot(V,x))==='idle'&&!(myPot(V,x)&&myPot(V,x).items.length));if(nx){pickNext(V,id);return true;}}
    }
  }
  else if(a==='heat'){if(V.g==='rx'&&(!p||p.state==='idle')){act({t:'heat',o:id,h:((p?p.heat:0)+1)%3});sfx('tap');}}
  else if(a==='dump'){act({t:'dump',o:id});sfx('whoosh');}
  else if(a==='ext'){act({t:'ext',o:id});sfx('whoosh');}
  else if(a==='chip'&&p&&p.state==='idle'){act({t:'chip',o:id,s:b.dataset.s});sfx('pop');}
  return false;
}
// 縦持ちの操作ボタン（選んでいる客に対して）
function onActBar(e){
  const b=e.target.closest('[data-act]');if(!b)return;
  const V=view();if(!playable(V))return;
  e.preventDefault();
  const o=V.orders.find(x=>x.id===UI.sel);if(!o)return;
  cardAct(V,o,b.dataset.act,b);
}
$('actbar').addEventListener('pointerdown',onActBar);
$('ptL').addEventListener('pointerdown',e=>{if(e.target.closest('.pt-act'))onActBar(e);});
$('orders').addEventListener('pointerdown',e=>{
  const V=view();if(!playable(V))return;
  const t=e.target.closest('.ticket[data-o]');if(!t)return;
  e.preventDefault();
  const id=+t.dataset.o,o=V.orders.find(x=>x.id===id);if(!o)return;
  const p=myPot(V,o),b=e.target.closest('[data-act]');
  if(b){if(!cardAct(V,o,b.dataset.act,b))setSel(id);return;}
  if(UI.sel===id&&p&&p.state==='fire'){act({t:'ext',o:id});sfx('whoosh');return;}
  setSel(id);sfx('tap');
});
// 全画面＋向きの固定（対応ブラウザのみ。iPhoneのSafariは非対応なのでボタンを隠す）
const fsOK=!!(document.fullscreenEnabled||document.webkitFullscreenEnabled);
const isFS=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
function lockOrient(){if(isFS()&&screen.orientation&&screen.orientation.lock)screen.orientation.lock(wantPort()?'portrait':'landscape').catch(()=>{});}
async function goLandscape(){
  try{
    const el=document.documentElement;
    if(!(document.fullscreenElement||document.webkitFullscreenElement)){
      if(el.requestFullscreen)await el.requestFullscreen({navigationUI:'hide'});else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen();
      if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock(wantPort()?'portrait':'landscape').catch(()=>{});
    }else{
      if(document.exitFullscreen)await document.exitFullscreen();else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
    }
  }catch(e){}
}
document.querySelectorAll('[data-fs]').forEach(b=>{b.style.display=fsOK?'':'none';b.addEventListener('click',()=>{audio();goLandscape();});});
// 向きを固定していて持ち方が逆のとき：「持ち方に合わせる」に戻す
$('btnPortrait').addEventListener('click',()=>{SAVE.ui.orient='auto';persist();applyOrient();lockOrient();});
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
  {k:'goal',t:'1日の目標（問題数）',d:'特訓・結果画面に、今日の達成具合を出す',o:[[20,'20'],[30,'30'],[50,'50'],[100,'100']]},
  {k:'bed',t:'就寝時刻',d:'この1時間前から朝5時ごろまでは、ゲームを始める前に止める（睡眠を守る）',o:[['off','なし'],['22:30','22:30'],['23:00','23:00'],['23:30','23:30'],['0:00','0:00']]},
  {k:'rank',t:'全国ランキングに参加',d:'ソロの点数を、タイトル画面の名前で公開ランキングに送る（本名は避けろ）',o:[[true,'ON'],[false,'OFF']]},
  {k:'auto',t:'自動精製',d:'必要なものがそろったら自動で反応させる（ソロ用。マルチプレイはロビーでホストが決める）',o:[[false,'OFF'],[true,'ON']]},
  {k:'orient',t:'画面の向き',d:'自動：持ち方に合わせて切り替わる。縦持ち：上に客の列、下に棚（周期表は1〜9族／10〜18族の上下2段）、操作ボタンは親指の届く位置',o:[['auto','自動'],['land','横持ち'],['port','縦持ち']]},
  {k:'layout',t:'横持ちの棚の配置',d:'左右に分割：周期表を1〜9族と10〜18族に分けて両端に置き、中央に客の列。下にまとめる：タブレット向け',o:[['split','左右に分割'],['bottom','下にまとめる']]},
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
  applyOrient();
}
function openSettings(back){
  UI.setBack=back||null;if(SAVE.ui.rank===undefined)SAVE.ui.rank=true;if(SAVE.ui.goal===undefined)SAVE.ui.goal=30;if(SAVE.ui.bed===undefined)SAVE.ui.bed='23:30';
  const rows=SETTINGS.map(x=>`<div class="set-row"><div class="set-t"><b>${x.t}</b>${x.d?`<small>${x.d}</small>`:''}</div>
    <div class="seg set-seg">${x.o.map(([v,l])=>`<button data-set="${x.k}" data-v='${JSON.stringify(v)}' class="${SAVE.ui[x.k]===v?'on':''}">${l}</button>`).join('')}</div></div>`).join('');
  overlay(`<h2>⚙ 設定</h2><div class="settings">${rows}</div>
    <div class="set-row"><div class="set-t"><b>過去問の中継の合言葉（自分専用）</b><small>Supabase の Edge Function「kk-relay」に設定した合言葉。入れると、過去問の「⚡ 全自動で取り込む」がボタン1つで動く。この端末にだけ保存し、書き出しファイルにも入れない。<b>ほかの人に教えない</b>（教えると配布元のPDFを他人に送ることになる）</small></div>
      <div class="row-btns rp-row"><input type="password" id="relayPass" autocomplete="off" placeholder="${cloudPass()?'（保存済み）':'合言葉'}"><button class="btn sub mini" data-ov="rpsave">保存して確認</button>${cloudPass()?'<button class="btn sub mini" data-ov="rpclear">消す</button>':''}</div><small id="relayPassSt"></small></div>
    <div class="set-row"><div class="set-t"><b>学習記録の引っ越し</b><small>この端末の記録（習熟度・学習記録・特訓のベスト）をファイルに書き出す／読み込む。過去問の画像は含まない</small></div>
      <div class="row-btns"><button class="btn sub mini" data-ov="export">書き出す</button><label class="btn sub mini">読み込む<input type="file" id="impFile" accept="application/json,.json" hidden></label></div></div>
    <div class="row-btns"><button class="btn go" data-ov="setclose">閉じる</button></div>`,'settings');
}
$('btnSettings').addEventListener('click',()=>{audio();openSettings(null);});
$('ov').addEventListener('click',e=>{
  const b=e.target.closest('[data-set]');if(!b)return;
  const k=b.dataset.set;let v;try{v=JSON.parse(b.dataset.v);}catch(x){return;}
  SAVE.ui[k]=v;persist();sfx('tap');
  if(k==='auto'&&SES&&SES.role==='solo'&&SES.S)SES.S.auto=v;
  if(k==='orient')lockOrient();
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
    case 'tutgo':if(curG()==='atom')SAVE.tutA=true;else if(curG()==='org')SAVE.tutO=true;else if(curG()==='ion')SAVE.tutI=true;else if(ENG.includes(curG())||E.isQuiz(curG()))SAVE['tut_'+curG()]=true;else SAVE.tut=true;persist();closeOverlay();if(SES&&SES.waitTut){SES.waitTut=false;countdown(beginLocal);}break;
    case 'resume':act({t:'resume'});closeOverlay();UI.pauseShown=false;break;
    case 'quit':
      closeOverlay();
      if(SES&&SES.role==='host')hostToLobby();else leaveSession(false);
      break;
    case 'retry':{const id=SES&&SES.cfg?SES.cfg.stageId:'s1',g=SES&&SES.cfg?SES.cfg.g:SAVE.g,ex=SES&&SES.cfg?SES.cfg.extra:null;closeOverlay();startSolo(id,g,ex);break;}
    case 'drill':leaveSession(false);drillHub();break;
    case 'note':noteOverlay();break;
    case 'drillback':drillHub();break;
    case 'bed5':{UI.bedOk=Date.now()+5*60e3;closeOverlay();const go=UI.bedGo;UI.bedGo=null;if(go)go();break;}
    case 'export':exportSave();break;
    case 'rpsave':{const v=(($('relayPass')||{}).value||'').trim();if(v)try{localStorage.setItem('kk-relay-pass',v);}catch(e){}
      const st=$('relayPassSt');if(st)st.textContent='確認中…';cloudPing(true).then(ok=>{const s2=$('relayPassSt');if(s2)s2.textContent=ok?'✓ 自分専用の中継につながった':'× '+(UI.cloudErr||'つながらない');});break;}
    case 'rpclear':{try{localStorage.removeItem('kk-relay-pass');}catch(e){}UI.cloudOkAt=0;openSettings(UI.setBack);break;}
    case 'impok':{try{localStorage.setItem(SAVE_KEY,JSON.stringify(UI.impSave));}catch(e){}location.reload();break;}
    case 'share':shareResult(UI.shareText||'');break;
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
  if(UI.playT0){const D=statDay();D.ms+=Math.min(2*3600e3,Date.now()-UI.playT0);D.games++;UI.playT0=0;persistSoon();}
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
// 無機イオンモード：結果画面の見出しと詳細
const ionTitle=k=>I.isHalf(k)?`<b>半反応式</b>　${esc(I.HALF[k].core)}${I.HALF[k].cond?'（'+esc(I.HALF[k].cond)+'）':''}`:`<b>${I.disp(k)}</b>　${esc(I.BYID[k].n)}`;
const ionDetail=k=>{
  if(I.isHalf(k)){const h=I.HALF[k];return `<div class="note2">${esc(h.eq)}　［${esc(h.ox)}］</div>`;}
  const d=I.BYID[k];return `<br>イオン：${esc(Object.entries(d.parts).map(([x,n])=>I.PART[x].label+(n>1?'×'+n:'')).join(' '))}<br>${esc(d.p.join('／'))}`;
};
function reviewHTMLO(r,mode){
  const M=me(),nm=id=>{const p=r.players.find(x=>x.id===id);return p?p.name:'?';};
  const ion=r.g==='ion',G=PM[r.g].M;
  const ng=[],ok=[];const seen=new Set();
  (r.log||[]).slice().reverse().forEach(l=>{
    if(!G.known(l.k)||seen.has(l.k))return;seen.add(l.k);
    const mine=mode!=='versus'||l.by===M;
    if(l.ok&&!l.hinted&&mine)ok.push(l);else ng.push(l);
  });
  const title=k=>G.reviewTitle?G.reviewTitle(k):ion?ionTitle(k):O.isPair(k)?`<b>見分け</b>　${esc(O.BYID[O.PAIR[k].a].n)}／${esc(O.BYID[O.PAIR[k].b].n)} → <b>${esc(O.answerText(k))}</b>`:`<b>${fmt(O.BYID[k].f)}</b>　${esc(O.BYID[k].n)}`;
  const detail=k=>{
    if(G.reviewDetail)return G.reviewDetail(k);
    if(ion)return ionDetail(k);
    if(O.isPair(k)){const p=O.PAIR[k];return p.ok.map(t=>`<div class="note2">${esc(O.TEST[t].label)}：${esc(O.BYID[p.a].n)} ${esc(O.resultText(p.a,t))}／${esc(O.BYID[p.b].n)} ${esc(O.resultText(p.b,t))}</div>`).join('');}
    const d=O.BYID[k];return `<br>部品：${esc(Object.entries(d.parts).map(([x,n])=>O.PART[x].label+(n>1?'×'+n:'')).join(' '))}<br>${esc(d.p.join('／'))}`;
  };
  let h='';
  if(ng.length){
    h+=`<div class="sec-h">要復習（次回よく注文される）</div><div class="rev">`+ng.map(l=>{
      let why;
      if(l.ok)why=l.by===M||mode==='solo'?'ヒント使用':`${esc(nm(l.by))} が提供`;
      else if(l.given)why=`${esc(l.given)} ${(r.g==='org'&&O.isPair(l.k))||r.g==='eword'?'を選んだ':'を作った'}${mode!=='solo'&&l.by!==M?`（${esc(nm(l.by))}）`:''}`;
      else why=esc(l.why||'');
      return `<div class="it">${title(l.k)}　<span class="why">${why}</span>${detail(l.k)}</div>`;
    }).join('')+`</div>`;
  }
  if(ok.length){
    h+=`<div class="sec-h">ノーヒントで正解</div><div class="rev">`+ok.map(l=>`<div class="it ok">${title(l.k)}　<span style="color:#e0a100">${stars3(mst(l.k,r.g).box)}</span></div>`).join('')+`</div>`;
  }
  return h;
}
// 早押しクイズの振り返り：答えられなかった・取られた問題はヒントを全部見せる
function reviewHTMLQ(r,mode){
  const M=me(),nm=id=>{const p=r.players.find(x=>x.id===id);return p?p.name:'?';};
  if(r.g==='kako'){
    const B=KK.KAKO,mk=k=>B.answer(k).split('').map(d=>'⓪①②③④⑤⑥⑦⑧⑨'[+d]).join(' ');
    return `<div class="sec-h">出題された過去問</div><div class="rev">`+(r.log||[]).filter(l=>B.known(l.k)).map(l=>`<div class="it${l.ok&&(mode!=='versus'||l.by===M)?' ok':''}"><b>${esc(B.Q[l.k].n)}</b>　正解 ${mk(l.k)}　<span class="why">${l.ok?`${mode!=='solo'?esc(nm(l.by))+' が':''}正解`:'正解者なし'}</span>${B.img[l.k]?`<img class="kk-thumb" src="${B.img[l.k].q}" alt="">`:''}</div>`).join('')+'</div>';
  }
  const ng=[],ok=[];
  const QB=E.QBANK[r.g];
  (r.log||[]).forEach(l=>{if(!QB.known(l.k))return;(l.ok&&(mode!=='versus'||l.by===M)?ok:ng).push(l);});
  let h='';
  if(ng.length)h+=`<div class="sec-h">要復習（次回よく出る）</div><div class="rev">`+ng.map(l=>`<div class="it"><b>${esc(QB.label?QB.label(l.k)+' → '+QB.Q[l.k].n:QB.Q[l.k].n)}</b>　<span class="why">${l.ok?`${esc(nm(l.by))} が正解`:'正解者なし'}</span><div class="note2">${QB.Q[l.k].clues.map(clueHTML).join('／')}</div></div>`).join('')+'</div>';
  if(ok.length)h+=`<div class="sec-h">正解した問題</div><div class="rev">`+ok.map(l=>`<div class="it ok"><b>${esc(QB.label?QB.label(l.k)+' → '+QB.Q[l.k].n:QB.Q[l.k].n)}</b>　ヒント${l.ci}つ目で${mode!=='solo'?`（${esc(nm(l.by))}）`:''}　<span style="color:#e0a100">${stars3(mst(l.k,r.g).box)}</span></div>`).join('')+'</div>';
  return h;
}
function reviewHTML(r,mode){
  if(r.g==='atom')return reviewHTMLA(r,mode);
  if(E.isQuiz(r.g))return reviewHTMLQ(r,mode);
  if(isParts(r.g))return reviewHTMLO(r,mode);
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
  if(r.drill)return drillResults(r);
  const g=GK(r.g),B=SV(g).best,ST=stagesOf(g);
  const st=E.stageById(g,r.stageId),score=r.team.score,bk=busyKey(st.id,r.busy),stars=r.stars;
  const prev=B[bk]||0;if(score>prev)B[bk]=score;persist();
  const idx=ST.indexOf(st);
  const canNext=idx>=0&&idx<ST.length-1&&unlocked(idx+1,g);
  let h=`<h2>${score>=(stars?stars[0]:0)?(E.isQuiz(r.g)?'終了！':'営業終了！'):(E.isQuiz(r.g)?'終了…':'営業終了…')}</h2>
    ${starsRow(stars,score)}
    <div class="big-score">${score}<span style="font-size:18px">点</span></div>
    ${stars?`<div style="font-size:12px;font-weight:800">忙しさ「${E.busyOf(r.busy).name}」の★ ${stars.join(' / ')} 点　自己ベスト ${B[bk]||0}</div>`:`<div style="font-size:12px;font-weight:800">忙しさ「${E.busyOf(r.busy).name}」 自己ベスト ${B[bk]||0}</div>`}
    <div class="stats"><div>${E.isQuiz(r.g)?'正解':'提供'}<b>${r.team.served}</b></div><div>${E.isQuiz(r.g)?'誤答':'失敗'}<b>${r.team.failed}</b></div><div>最大連続<b>${r.team.maxCombo}</b></div></div>`;
  const rkOk=RK.ranked(r.g,st.id),rkey=rankKey(r.g,st.id,r.busy,SES&&SES.cfg&&SES.cfg.coef);
  if(rkOk)h+=`<div class="rk-me" id="rkMe">${rankOn()?'🏆 全国ランキングに送信中…':'🏆 全国ランキングに参加していない（⚙設定で変えられる）'}</div>`;
  UI.shareText=`ケミカル・キッチン「${E.GAMES[r.g]}」${st.name}で ${score}点！`;
  h+=goalLine()+nightNote()+reviewHTML(r,'solo');
  h+=`<div class="row-btns"><button class="btn sub mini" data-ov="share">📤 結果を共有</button></div><div class="row-btns">${canNext?'<button class="btn go" data-ov="next">次のステージ</button>':''}<button class="btn" data-ov="retry">もう一回</button><button class="btn sub" data-ov="menu">メニュー</button></div>`;
  overlay(h,'result');
  if(rkOk&&rankOn())RK.submit(r.g,rkey,myName(),score).then(j=>{
    const el=$('rkMe');if(!el||!j)return;
    el.innerHTML=`🏆 今週の全国 <b>${j.rank}</b>位 / ${j.total}人<small>（${esc(RK.cleanName(myName()))}・このステージ・忙しさ「${E.busyOf(r.busy).name}」／自己ベスト ${j.best}）</small><button class="btn sub mini" data-rank="${esc(r.g)}|${esc(st.id)}">ランキングを見る</button>`;
  }).catch(err=>{const el=$('rkMe');if(el)el.textContent='🏆 ランキングに送れなかった（'+(err&&err.name==='AbortError'?'通信が遅い':String(err&&err.message||err).slice(0,60))+'）';});
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
    <div class="stats"><div>${E.isQuiz(r.g)?'正解':'提供'}<b>${r.team.served}</b></div><div>${E.isQuiz(r.g)?'誤答':'失敗'}<b>${r.team.failed}</b></div><div>最大連続<b>${r.team.maxCombo}</b></div></div>
    <div class="sec-h">貢献</div><div class="rank">`+ps.map(p=>`<div class="rk" style="--pc:${COLORS[p.slot%4]}"><div class="no">${p.id===mvp?'👑':''}</div>
      <div><div class="nm">${esc(p.name)}${p.id===me()?'（あなた）':''}${p.id===mvp?'<span class="mvp">MVP</span>':''}${p.left?'（退出）':''}</div>
      <div class="sub">${E.isQuiz(r.g)?`正解 ${p.served}・誤答 ${p.failed}</div></div><div class="sc">${p.pts}</div></div>`:`提供 ${p.served}・入れた${r.g==='atom'?'原子':isParts(r.g)?PM[r.g].unit:'試薬'} ${p.atoms}・誤配 ${p.failed}</div></div><div class="sc">${p.pts}</div></div>`}`).join('')+`</div>`;
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
// オフラインでも開けるように、読み込んだファイルを端末に控える（つながるときは常に新しいものを取りに行く）
if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{});});
