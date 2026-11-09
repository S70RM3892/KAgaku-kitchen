// 京大数学 早押し：極限・微分・積分・数列・確率・複素数平面・ベクトル・整数・三角指数対数などの計算問題を、
// 「分野 → 問題文 → 解き方 → 途中の結果」の順に出るヒントから、なるべく早く答える。
// 問題はすべて自作で、正解は tools/kmath_build.py で sympy・総当たりの計算により確かめたもの（js/kmath_data.js）
import {makeBank} from './kyote.js';
import {MCAT,MATH} from './kmath_data.js';

const ST=(id,lvl,name,desc,pool,o={})=>Object.assign({id,lvl,name,desc,pool,clue:'name',fb:1,time:300,qn:8,reveal:5,nch:4,max:0,spawn:1,life:1,stars:[90,180,280]},o);
const RV={id:'rv',name:'苦手克服ラン',desc:'間違えた・答えられなかった問題だけで出題',pool:'review',clue:'name',fb:1,time:300,qn:8,reveal:5,nch:4,max:0,spawn:1,life:1,stars:null};
const has=(...c)=>q=>c.some(x=>q.cat.startsWith(x+':'));
export const KMATH=makeBank(MATH,MCAT,ids=>[
  ST('s1','基礎','極限と微分','極限値・導関数・極値・接線',ids(has('lim','diff'))),
  ST('s2','基礎＋','積分・数列・関数','定積分・数列と級数・三角／指数／対数',ids(has('int','seq','func'))),
  ST('s3','標準','図形と複素数','面積・体積・長さ、ベクトル、複素数平面',ids(has('area','vec','cplx'))),
  ST('s4','応用','確率と整数','確率・場合の数・整数の性質',ids(has('prob','num'))),
  ST('s5','京大','京大ラッシュ（早押し）','全範囲・ヒントが速い・選択肢6つ・12問',ids(()=>true),{reveal:4,nch:6,qn:12,stars:[140,280,420]}),
],RV);
KMATH.tail=40;   // 最後のヒントが出てから計算して答えられる秒数
