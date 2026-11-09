// 早押しクイズ：条件（ヒント）が少しずつ出て、化合物を当てる。問題は組成・官能基・無機イオンモードのデータから作る
// （元のデータは読むだけで変えない）。ヒントは「ぼんやり → はっきり」の順に並べ、最後は化学式でほぼ答えになる
import * as A from './atoms.js';
import * as O from './org.js';
import * as I from './ion.js';

const Q={};
const add=(k,src,n,cat,clues)=>{if(Object.values(Q).some(q=>q.n===n))return;Q[k]={k,src,n,cat,clues:clues.filter(Boolean).slice(0,7)};};
// 官能基モード：分類 → 検出反応（陽性のもの）→ 性質 → 分子式 → 示性式
O.DB.forEach(d=>add('o:'+d.id,'org',d.n,'org:'+d.k,[
  `分類：${d.k}`,
  ...O.TIDS.filter(t=>O.result(d.id,t)==='+').map(t=>`${O.TEST[t].label}：${O.resultText(d.id,t)}`),
  ...d.p.slice().reverse(),
  `分子式：${d.mf}`,`示性式：${d.f}`,
]));
// 無機イオンモード：分類 → 性質 → 含まれるイオン
I.DB.forEach(d=>add('i:'+d.id,'ion',d.n,'ion:'+d.k,[
  `分類：${d.k}${d.cn?`（配位数${d.cn}）`:''}`,
  ...d.p.slice().reverse(),
  `イオン：${Object.entries(d.parts).map(([x,n])=>I.PART[x].label+(n>1?'×'+n:'')).join(' ')}`,
]));
// 組成モード：分類 → 性質 → 含まれる元素 → 分子式（同じ名前の物質はすでに入っていれば飛ばす）
A.DB.forEach(d=>add('a:'+d.id,'atom',d.n,'atom:'+d.c,[
  `分類：${A.CATNAME[d.c]}`,
  ...d.p,                                  // 組成モードの性質は「製法 → 決め手」の順に並んでいる
  `含まれる元素：${Object.keys(d.m).join('・')}`,`化学式：${d.f}`,
]));
const ALL=Object.keys(Q);
const known=k=>!!Q[k];
// 選択肢：同じ分類 → 同じ出どころ → 全体 の順に、名前の違うものを集める
function choices(k,n,rand=Math.random){
  const q=Q[k],out=[k],pick=list=>{const c=list.filter(x=>!out.includes(x)&&Q[x].n!==q.n);while(c.length&&out.length<n){out.push(c.splice(Math.floor(rand()*c.length),1)[0]);}};
  pick(ALL.filter(x=>Q[x].cat===q.cat));pick(ALL.filter(x=>Q[x].src===q.src));pick(ALL);
  for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
const ids=f=>ALL.filter(k=>f(Q[k]));
const S=(id,lvl,name,desc,pool,o={})=>Object.assign({id,lvl,name,desc,pool,clue:'name',fb:1,time:300,qn:10,reveal:4,nch:4,max:0,spawn:1,life:1,stars:[120,240,360]},o);
const STAGES=[
  S('s1','基礎','気体と沈殿','気体の製法・性質、沈殿の色',ids(q=>q.cat==='atom:gas'||q.cat==='atom:ppt')),
  S('s2','基礎＋','無機の物質','酸・塩基・塩・酸化剤・還元剤',ids(q=>q.src==='ion'&&!/沈殿|錯/.test(q.cat))),
  S('s3','標準','有機化合物','官能基・検出反応・合成のしかた',ids(q=>q.src==='org'||q.cat==='atom:org')),
  S('s4','応用','沈殿と錯イオン','沈殿の色と溶け方、錯イオン、選択肢6つ',ids(q=>/沈殿|錯/.test(q.cat)||q.cat==='atom:ppt'),{nch:6}),
  S('s5','京大','京大ラッシュ（早押し）','全範囲・ヒントが速い・選択肢6つ・15問',ALL.slice(),{reveal:3,nch:6,qn:15,stars:[200,380,560]}),
];
const REVIEW={id:'rv',name:'苦手克服ラン',desc:'間違えた・答えられなかった物質だけで出題',pool:'review',clue:'name',fb:1,time:300,qn:10,reveal:4,nch:4,max:0,spawn:1,life:1,stars:null};
export {Q,ALL,known,choices,STAGES,REVIEW};
