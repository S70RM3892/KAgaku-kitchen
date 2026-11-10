// 酸化還元・電池 早押し：酸化数・半反応式・イオン反応式・化学反応式・イオン化傾向・電池・電気分解。
// ヒントは「分野 → 問題文 → 組み立ての手順（O を H₂O で → H を H⁺ で → e⁻ で電荷）」の順に出るので、手順を追いながら覚えられる。
// 問題はすべて自作で、正解は tools/kredox_build.py が「手で書いた式」と「機械的に組み立てた式・規則で決めた答え」の一致を確かめたもの（js/kredox_data.js）。
import {RCAT,REDOX,HALFS} from './kredox_data.js';
export {HALFS};

const Q={},ALL=[];
REDOX.forEach(([cat,n,clues,wrong],i)=>{
  const k=cat.split(':')[0]+':'+i;
  Q[k]={k,src:cat.slice(0,-1),n,cat,clues:[`分野：${RCAT[cat]}`,...clues],wrong:wrong.map((w,j)=>k+'~'+j)};
  wrong.forEach((w,j)=>{Q[k+'~'+j]={k:k+'~'+j,n:w,cat,x:1};});   // まちがいの選択肢（出題はされない。表示用）
  ALL.push(k);
});
function choices(k,n,rand=Math.random){
  const w=Q[k].wrong.slice();for(let i=w.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[w[i],w[j]]=[w[j],w[i]];}
  const out=[k,...w.slice(0,n-1)];
  for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
const ST=(id,lvl,name,desc,pool,o={})=>Object.assign({id,lvl,name,desc,pool,clue:'name',fb:1,time:300,qn:8,reveal:5,nch:4,max:0,spawn:1,life:1,stars:[90,180,280]},o);
const ids=(...c)=>ALL.filter(k=>c.includes(Q[k].src));
export const KREDOX={
  Q,ALL,known:k=>!!Q[k]&&!Q[k].x,choices,CATN:RCAT,tail:45,
  label:k=>Q[k]?Q[k].clues[1]:'',          // 一覧（誤答ノートなど）には、答えではなく問題文を出す
  STAGES:[
    ST('s1','基礎','酸化数とはたらき','酸化数の求め方・酸化剤か還元剤か・滴定と色の変化',ids('ox','role','know')),
    ST('s2','基礎＋','半反応式（酸化剤）','KMnO₄・K₂Cr₂O₇・H₂O₂・HNO₃・熱濃硫酸…を手順で組み立てる',ids('half:o')),
    ST('s3','標準','半反応式（還元剤）','H₂O₂・SO₂・H₂S・シュウ酸・Fe²⁺・I⁻・S₂O₃²⁻…',ids('half:r')),
    ST('s4','標準＋','反応式を組み立てる','e⁻ をそろえてイオン反応式に・K⁺ や SO₄²⁻ を補って化学反応式に',ids('ionic','full')),
    ST('s5','標準＋','イオン化傾向と電池','金属の析出・金属と酸や水・ダニエル・鉛蓄電池・燃料電池・酸化銀電池',ids('metal','cell')),
    ST('s6','応用','電気分解','電極の材料とイオンの種類から、陽極・陰極の反応を決める',ids('elec')),
    ST('s7','京大','京大ラッシュ（早押し）','全範囲・ヒントが速い・選択肢6つ・12問',ALL.slice(),{reveal:4,nch:6,qn:12,stars:[140,280,420]}),
  ],
  REVIEW:{id:'rv',name:'苦手克服ラン',desc:'間違えた・答えられなかった問題だけで出題',pool:'review',clue:'name',fb:1,time:300,qn:8,reveal:5,nch:4,max:0,spawn:1,life:1,stars:null},
};
