// 理論化学 計算 早押し：物質量・気体・溶液・熱・酸塩基・酸化還元・電池と電気分解・反応速度・平衡・結晶格子・有機と高分子の計算。
// 「分野 → 問題文 → 解き方 → 途中の結果」の順に出るヒントから、なるべく早く答える。
// 問題はすべて自作で、正解は tools/kcalc_build.py で計算して確かめたもの（js/kcalc_data.js）。
// まちがいの選択肢は問題ごとに「よくある間違い」の値を用意してある（ほかの問題の答えは使わない）
import {CCAT,CALC} from './kcalc_data.js';

const Q={},ALL=[];
CALC.forEach(([cat,n,clues,wrong],i)=>{
  const k=cat.split(':')[0]+':'+i;
  Q[k]={k,src:cat.split(':')[0],n,cat,clues:[`分野：${CCAT[cat]}`,...clues],wrong:wrong.map((w,j)=>k+'~'+j)};
  // まちがいの選択肢（出題はされない。表示用）
  wrong.forEach((w,j)=>{Q[k+'~'+j]={k:k+'~'+j,n:w,cat,x:1};});
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
export const KCALC={
  Q,ALL,known:k=>!!Q[k]&&!Q[k].x,choices,CATN:CCAT,tail:60,
  label:k=>Q[k]?Q[k].clues[1]:'',          // 一覧（誤答ノートなど）には、答えではなく問題文を出す
  STAGES:[
    ST('s1','基礎','物質量・濃度・気体','mol・モル濃度・化学反応式の量的関係・気体の法則',ids('mol','gas')),
    ST('s2','基礎＋','溶液と結晶格子','溶解度・凝固点降下・浸透圧・単位格子と密度',ids('sol','cry')),
    ST('s3','標準','熱・速度・平衡','エンタルピー・ヘスの法則・反応速度・平衡定数・溶解度積',ids('thermo','rate','eq')),
    ST('s4','標準＋','酸塩基・酸化還元・電池','pH・中和滴定・酸化還元滴定・電気分解の量的関係',ids('acid','redox','elec')),
    ST('s5','応用','有機・高分子の計算','元素分析・異性体の数・収率・重合度',ids('org','poly')),
    ST('s6','京大','京大ラッシュ（早押し）','全範囲・ヒントが速い・選択肢6つ・12問',ALL.slice(),{reveal:4,nch:6,qn:12,stars:[140,280,420]}),
  ],
  REVIEW:{id:'rv',name:'苦手克服ラン',desc:'間違えた・答えられなかった問題だけで出題',pool:'review',clue:'name',fb:1,time:300,qn:8,reveal:5,nch:4,max:0,spawn:1,life:1,stars:null},
};
