// 過去問早押し：各自が自分の端末にPDF（問題・正解）を読み込み、1問ずつ切り取って早押しにする。
// 問題の画像と正解はこの端末のブラウザ（IndexedDB）にだけ保存し、サーバーやGitHubには一切送らない
// （過去問には著作権があるため。公開サイトに置くのは仕組みだけ）。
// 早押しのエンジンからは「問題の束（bank）」として見える：Q[id] = {k,n,cat,clues,ans,slots}

/* ================= 問題の束 ================= */
export const SLICES=8;                 // シャッターが開く段数（ヒントの数の代わり）
const Q={};
const BANK={
  Q,ALL:[],known:k=>!!Q[k],
  // 選択肢はマークの数字（①〜⑨・⓪）
  choices:()=>['1','2','3','4','5','6','7','8','9','0'],
  answer:k=>Q[k]?Q[k].ans:'',
  tail:75,                             // 全部見えてから解く時間（秒）
  img:{},                              // id → {q:objectURL, lead:objectURL}
  STAGES:[],REVIEW:null,
};
const ids=f=>BANK.ALL.filter(k=>f(Q[k]));
const ST=(id,lvl,name,desc,f)=>({id,lvl,name,desc,get pool(){return ids(f);},clue:'name',fb:1,time:600,qn:8,reveal:2.5,nch:10,max:0,spawn:1,life:1,stars:null});
BANK.STAGES=[
  ST('s1','物理','物理（読み込んだ年度すべて）','読み込んだ物理の問題から8問',q=>q.subj==='phy'),
  ST('s2','化学','化学（読み込んだ年度すべて）','読み込んだ化学の問題から8問',q=>q.subj==='chem'),
  ST('s3','総合','物理＋化学','読み込んだすべての問題から8問',()=>true),
];
BANK.REVIEW={id:'rv',name:'苦手克服ラン',desc:'間違えた・答えられなかった過去問だけで出題',pool:'review',clue:'name',fb:1,time:600,qn:8,reveal:2.5,nch:10,max:0,spawn:1,life:1,stars:null};
export {BANK as KAKO};
const SUBJ={phy:'物理',chem:'化学'};
export const subjName=s=>SUBJ[s]||s;
export const itemLabel=it=>`${it.year} ${SUBJ[it.subj]||it.subj} 第${it.dai}問 問${it.q}${it.part?'（'+it.part+'）':''}`;
// 端末間で同じ問題を同じIDにする（年度・科目・大問・問・枝番から作る）
export const itemId=it=>`${it.year}-${it.subj}-${it.dai}-${it.q}${it.part?'-'+it.part:''}`;
function setBank(items){
  for(const k in Q)delete Q[k];
  for(const k in BANK.img){const u=BANK.img[k];if(u.q)URL.revokeObjectURL(u.q);if(u.lead)URL.revokeObjectURL(u.lead);delete BANK.img[k];}
  for(const it of items){
    if(!it.on||!it.ans)continue;
    Q[it.id]={k:it.id,n:itemLabel(it),cat:it.subj,src:it.subj,subj:it.subj,year:it.year,clues:Array(SLICES).fill(''),ans:it.ans,slots:it.ans.length};
    BANK.img[it.id]={q:URL.createObjectURL(it.img),lead:it.lead&&it.useLead?URL.createObjectURL(it.lead):null};
  }
  BANK.ALL=Object.keys(Q);
}

/* ================= 端末内の保存（IndexedDB） ================= */
const DB='kk-kakomon',STORE='items';
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function tx(mode,fn){const d=await idb();return new Promise((res,rej)=>{const t=d.transaction(STORE,mode),s=t.objectStore(STORE);const out=fn(s);t.oncomplete=()=>res(out&&out.result!==undefined?out.result:out);t.onerror=()=>rej(t.error);});}
export async function loadAll(){
  if(typeof indexedDB==='undefined')return [];
  try{const items=await tx('readonly',s=>s.getAll());setBank(items||[]);return items||[];}catch(e){return [];}
}
export async function saveItems(items){await tx('readwrite',s=>{items.forEach(it=>s.put(it));});return loadAll();}
export async function deleteWhere(f){const all=await tx('readonly',s=>s.getAll());await tx('readwrite',s=>{all.filter(f).forEach(it=>s.delete(it.id));});return loadAll();}
export async function updateItem(id,patch){const all=await tx('readonly',s=>s.getAll());const it=all.find(x=>x.id===id);if(!it)return loadAll();Object.assign(it,patch);await tx('readwrite',s=>s.put(it));return loadAll();}

/* ================= PDF の読み込みと切り取り ================= */
let PDFJS=null;
async function pdfjs(){
  if(PDFJS)return PDFJS;
  PDFJS=await import('../vendor/pdfjs/pdf.min.mjs');
  PDFJS.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
  return PDFJS;
}
const Z2H=s=>String(s).replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/　/g,' ');
const CIRC='⓪①②③④⑤⑥⑦⑧⑨';
// ページの文字を「行」にまとめる（y は上からの位置、単位はPDFのポイント）
async function pageLines(page){
  const vp=page.getViewport({scale:1}),tc=await page.getTextContent();
  const toks=tc.items.filter(t=>t.str&&t.str.trim()).map(t=>({s:t.str,x:t.transform[4],y:vp.height-t.transform[5],h:Math.abs(t.transform[3])||10,w:t.width||0}));
  toks.sort((a,b)=>a.y-b.y||a.x-b.x);
  const lines=[];
  for(const t of toks){const L=lines.find(l=>Math.abs(l.y-t.y)<Math.max(2.5,t.h*0.35));if(L){L.t.push(t);L.y=(L.y*L.n+t.y)/(L.n+1);L.n++;L.h=Math.max(L.h,t.h);}else lines.push({y:t.y,h:t.h,n:1,t:[t]});}
  lines.forEach(l=>{l.t.sort((a,b)=>a.x-b.x);l.x=l.t[0].x;l.text=Z2H(l.t.map(t=>t.s).join(''));l.top=l.y-l.h;});
  lines.sort((a,b)=>a.y-b.y);
  return {lines,w:vp.width,h:vp.height};
}
// 年度・科目をファイル名や1ページ目の文字から推測する（違っていたら手直し画面で直す）
function guessMeta(name,text){
  const s=Z2H(name+' '+text);
  let year=null;
  const m1=s.match(/(19[89]\d|20[0-4]\d)/);if(m1)year=+m1[1];
  // ファイル名の「r6」「R05」「h30」などの略記（令和・平成）
  const fn=Z2H(name).match(/(?:^|[^a-z])([rh])0?(\d{1,2})(?!\d)/i);
  if(!year&&fn)year=(fn[1].toLowerCase()==='r'?2018:1988)+ +fn[2];
  const m2=s.match(/令和\s*(\d+|元)\s*年/);if(!year&&m2)year=2018+(m2[1]==='元'?1:+m2[1]);
  const m3=s.match(/平成\s*(\d+)\s*年/);if(!year&&m3)year=1988+ +m3[1];
  const subj=/化学/.test(s)?'chem':/物理/.test(s)?'phy':'phy';
  const isAns=/正解|解答\s*(用紙|例|表)|配点/.test(name)||/正\s*解/.test(text.slice(0,400))&&/配\s*点/.test(text.slice(0,600));
  return {year:year||new Date().getFullYear(),subj,isAns};
}
// 問題のPDFを解析：「第n問」「問n」の見出しで区切り、解答番号（本文中に順に現れる小さな数字）を拾う
export async function parseProblemPdf(file){
  const lib=await pdfjs();
  const buf=await file.arrayBuffer();
  const doc=await lib.getDocument({data:new Uint8Array(buf),cMapUrl:new URL('../vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true}).promise;
  const pages=[];
  for(let i=1;i<=doc.numPages;i++){const p=await doc.getPage(i);pages.push(Object.assign(await pageLines(p),{page:p,no:i}));}
  const first=pages.slice(0,2).map(p=>p.lines.map(l=>l.text).join(' ')).join(' ');
  const meta=guessMeta(file.name,first);
  // 本文の上下の余白（ページ番号などのヘッダ・フッタ）を除く
  pages.forEach(p=>{
    const body=p.lines.filter(l=>l.y>p.h*0.05&&l.y<p.h*0.95&&!/^[-−–ー―‐－\s]*\d+[-−–ー―‐－\s]*$/.test(l.text.trim()));
    p.body=body;p.top=body.length?Math.max(0,body[0].top-6):p.h*0.05;p.bottom=body.length?Math.min(p.h,body[body.length-1].y+8):p.h*0.95;
  });
  // 見出しを順に拾う
  const marks=[];
  for(const p of pages)for(const l of p.body){
    const t=l.text.trim();
    let m=t.match(/^第\s*(\d+)\s*問/);if(m){marks.push({kind:'dai',n:+m[1],page:p.no,y:l.top-4});continue;}
    m=t.match(/^問\s*(\d+)/);if(m&&l.x<p.w*0.35){marks.push({kind:'q',n:+m[1],page:p.no,y:l.top-4});}
  }
  // 解答番号：独立した1〜2桁の数字で、次に来るはずの番号と一致するものを順に拾う
  const slots=[];let next=1;
  for(const p of pages)for(const l of p.body)for(const t of l.t){const s=Z2H(t.s).trim();if(/^\d{1,2}$/.test(s)&&+s===next){slots.push({n:next,page:p.no,y:t.y});next++;}}
  // 区間を作る
  const pos=(pg,y)=>pg*100000+y;
  const items=[],leads={};let dai=0;
  marks.forEach((mk,i)=>{
    const end=marks[i+1]||{page:pages.length,y:pages[pages.length-1].bottom,end:true};
    const seg={from:{page:mk.page,y:mk.y},to:{page:end.page,y:end.y}};
    if(mk.kind==='dai'){
      dai=mk.n;
      if(marks[i+1]&&marks[i+1].kind==='q'){leads[dai]=seg;return;}
      // 「問」の見出しが無い大問は、大問全体を1問として扱う
    }
    if(!dai)dai=1;
    const sl=slots.filter(s=>pos(s.page,s.y)>=pos(seg.from.page,seg.from.y)&&pos(s.page,s.y)<pos(seg.to.page,seg.to.y)).map(s=>s.n);
    items.push({year:meta.year,subj:meta.subj,dai,q:mk.kind==='dai'?1:mk.n,part:'',seg,slots:sl,lead:mk.kind==='dai'?null:leads[dai]||null,useLead:true,on:true,ans:''});
  });
  return {doc,pages,meta,items,file:file.name};
}
// 正解のPDFを解析：行の中で「解答番号 → 正解」の並びを拾う（解答番号は1から順に増える）
export async function parseAnswerPdf(file){
  const lib=await pdfjs();
  const buf=await file.arrayBuffer();
  const doc=await lib.getDocument({data:new Uint8Array(buf),cMapUrl:new URL('../vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true}).promise;
  let text='';
  // 1つのPDFに複数の科目（物理基礎・物理・化学基礎・化学…）の表が入っていることがあるので、
  // 解答番号が1に戻るたびに「区切り」を作り、すぐ上にある科目名をその区切りの科目にする
  const secs=[];let cur=null,lastHead=null;
  const startSec=head=>{cur={name:head||(cur&&cur.name)||'',map:{},next:1};secs.push(cur);};
  const put=(a,v)=>{if(!cur||(+a===1&&cur.next>1))startSec(null);if(+a!==cur.next)return false;cur.map[a]=v;cur.next++;return true;};
  const num=s=>{s=Z2H(s).trim();if(CIRC.includes(s))return String(CIRC.indexOf(s));return /^\d{1,2}$/.test(s)?s:null;};
  const cx=t=>t.x+t.w/2;
  const SUBJRE=/(物理|化学|生物|地学)(基礎)?/;
  for(let i=1;i<=doc.numPages;i++){
    const {lines}=await pageLines(await doc.getPage(i));
    lines.forEach(l=>{text+=l.text+'\n';});
    const heads=[];for(const l of lines)for(const t of l.t){const m=t.s.replace(/\s/g,'').match(SUBJRE);if(m)heads.push({y:l.y,x:cx(t),name:m[0]});}
    const headFor=(y,x0,x1)=>{const h=heads.filter(h=>h.y<y&&h.x>x0-160&&h.x<x1+160).sort((p,q)=>q.y-p.y)[0];return h?h.name:null;};
    // 表の見出し「解答番号」「正解」の列の位置（横に表が並んでいれば複数組）を探し、列ごとに読む
    const hA=[],hB=[];let hy=-1;
    // 見出しが1つの文字列にまとまっていることもあるので、文字の位置から列の中心を見積もる
    const at=(t,i,n)=>t.x+t.w*(i+n/2)/Math.max(1,t.s.length);
    for(const l of lines)for(const t of l.t){
      const ia=t.s.search(/解\s*答/);if(ia>=0){const m=t.s.slice(ia).match(/^解\s*答\s*(番\s*号)?/)[0];hA.push({x:at(t,ia,m.length),y:l.y});hy=Math.max(hy,l.y);}
      const re=/正\s*解|^\s*正\s*$/g;let m;while((m=re.exec(t.s))){if(/解答/.test(t.s.slice(Math.max(0,m.index-1),m.index+3)))continue;
        if(/正解(と|及び|および)/.test(t.s.slice(m.index,m.index+5)))continue;hB.push({x:at(t,m.index,m[0].length),y:l.y});hy=Math.max(hy,l.y);}
    }
    // 同じ列が縦に何度も出てくる（科目ごとの表）こともあるので、x の近い見出しは1つにまとめる
    const uniq=arr=>arr.sort((p,q)=>p.x-q.x).filter((h,j,A)=>!j||h.x-A[j-1].x>12);
    const cols=uniq(hA.slice()).map(a=>{const b=uniq(hB.slice()).filter(x=>x.x>a.x)[0];return b?{a:a.x,b:b.x}:null;}).filter(Boolean);
    const hTop=Math.min(...hA.map(h=>h.y),Infinity);
    if(cols.length){
      const tol=c=>Math.max(14,(c.b-c.a)*0.6);
      for(const c of cols)for(const l of lines){if(l.y<=hTop)continue;
        const near=x=>l.t.map(t=>({t,v:num(t.s),d:Math.abs(cx(t)-x)})).filter(o=>o.v!==null&&o.d<tol(c)).sort((p,q)=>p.d-q.d)[0];
        const A=near(c.a),B=near(c.b);
        if(!(A&&B&&A.t!==B.t&&/^\d$/.test(B.v)))continue;
        if(+A.v===1){startSec(headFor(l.y,c.a,c.b));}
        put(A.v,B.v);
      }
      continue;
    }
    // 見出しが読めないとき：行の中で「解答番号 → 正解」の並びを拾う
    for(const l of lines){
      const h=l.text.replace(/\s/g,'').match(SUBJRE);if(h)lastHead=h[0];
      const nums=l.t.flatMap(t=>Z2H(t.s).trim().split(/\s+/)).map(num).filter(v=>v!==null);
      for(let j=0;j<nums.length-1;j++){
        const want=cur?cur.next:1;
        if(+nums[j]===1&&/^\d$/.test(nums[j+1])&&(!cur||cur.next>2)){startSec(lastHead);put(nums[j],nums[j+1]);j++;continue;}
        if(+nums[j]===want&&/^\d$/.test(nums[j+1])){put(nums[j],nums[j+1]);j++;}
      }
    }
  }
  secs.forEach(x=>{const m=x.name.match(SUBJRE);x.subj=m?(m[1]==='物理'?'phy':m[1]==='化学'?'chem':m[1]):null;x.base=!!(m&&m[2]);x.count=x.next-1;});
  const good=secs.filter(x=>x.count>=2);
  return {meta:guessMeta(file.name,text.slice(0,600)),secs:good,map:(good[0]||{map:{}}).map,count:good.reduce((a,x)=>a+x.count,0),file:file.name};
}
// 問題のPDFに合う正解を選ぶ：年度と科目（「基礎」でない方）が合う区切り → 科目だけ合う → 1つしかなければそれ
export function pickAnswers(P,answers){
  const cand=[];
  for(const A of answers)for(const sc of A.secs){
    let sc0=0;
    if(A.meta.year===P.meta.year)sc0+=4;
    if(sc.subj===P.meta.subj)sc0+=3;else if(sc.subj)sc0-=5;
    if(sc.base)sc0-=2;
    // 解答番号の数が問題PDFで見つかった数と合えば、それらしい
    const need=Math.max(0,...P.items.flatMap(it=>it.slots));if(need&&sc.count===need)sc0+=3;
    cand.push({sc:sc0,map:sc.map});
  }
  cand.sort((a,b)=>b.sc-a.sc);
  return cand.length&&cand[0].sc>=0?cand[0].map:{};
}
// 解答番号の割り当てを2通り試し、正解表と数が合う方を使う
// A：本文中に見つけた解答番号のとおり　B：問ごとに1つずつ順番に（本文の番号が読めないPDF向け）
export function bestAssign(items,map){
  const count=Object.keys(map).length,orig=items.map(it=>it.slots.slice());
  const score=()=>{const mx=Math.max(0,...items.flatMap(it=>it.slots));return items.filter(it=>it.ans).length*2-Math.abs(mx-count)*3;};
  const run=reset=>{items.forEach((it,i)=>{it.slots=reset?[]:orig[i].slice();it.ans='';it.on=true;});attachAnswers(items,map);return score();};
  const a=run(false);if(!count)return items;
  const b=run(true);if(b>a)return items;
  run(false);return items;
}
// 自動の手直し：解答番号が1つも入っていない区間は前の問の続き（図や選択肢）とみなしてつなぐ
export function autoFix(items){
  const any=items.some(it=>it.slots.length);
  if(!any)return items;
  const out=[];
  for(const it of items){
    const pv=out[out.length-1];
    if(!it.slots.length&&pv&&pv.subj===it.subj&&pv.dai===it.dai){pv.seg={from:pv.seg.from,to:it.seg.to};continue;}
    out.push(it);
  }
  return out;
}
// 解答番号の割り当てができていない問には、順番どおりに1つずつ割り当てる
export function attachAnswers(items,map){
  let n=1;
  for(const it of items){
    if(!it.slots.length)it.slots=[n];
    n=Math.max(...it.slots)+1;
    const a=it.slots.map(s=>map[s]||'').join('');
    if(a.length===it.slots.length)it.ans=a;
    if(!it.ans)it.on=false;
  }
}
// 区間を画像にする（ページをまたぐときは縦につなぐ）。adj は上端・下端の手直し（ポイント）
const SCALE=1.6;
// 範囲の中で文字や図（白でない画素）がある上下左右の端
function inkBox(c,y0,y1){
  y1=Math.min(c.height,y1);if(y1-y0<2)return null;
  const W=c.width,d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,y0,W,y1-y0).data,H=y1-y0;
  let top=-1,bot=-1,x0=W,x1=0;
  for(let r=0;r<H;r++){let ink=false;const o=r*W*4;
    for(let x=0;x<W;x+=2){const i=o+x*4;if(d[i]<215||d[i+1]<215||d[i+2]<215){ink=true;if(x<x0)x0=x;if(x>x1)x1=x;}}
    if(ink){if(top<0)top=r;bot=r;}}
  if(top<0)return null;
  return {y0:y0+Math.max(0,top-4),y1:y0+Math.min(H,bot+5),x0,x1};
}
export async function renderSeg(P,seg,adj={top:0,bottom:0}){
  const parts=[];
  for(let pg=seg.from.page;pg<=seg.to.page;pg++){
    const p=P.pages[pg-1];
    let y0=pg===seg.from.page?seg.from.y:p.top,y1=pg===seg.to.page?seg.to.y:p.bottom;
    if(pg===seg.from.page)y0+=adj.top||0;if(pg===seg.to.page)y1+=adj.bottom||0;
    y0=Math.max(0,y0);y1=Math.min(p.h,y1);if(y1-y0<4)continue;
    if(!p.canvas){const vp=p.page.getViewport({scale:SCALE});const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await p.page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;p.canvas=c;
      const pb=inkBox(c,Math.round(p.top*SCALE),Math.round(p.bottom*SCALE));p.ix0=pb?pb.x0:0;p.ix1=pb?pb.x1:c.width;}
    const b=inkBox(p.canvas,Math.round(y0*SCALE),Math.round(y1*SCALE));if(b)parts.push({c:p.canvas,...b,px0:p.ix0,px1:p.ix1});
  }
  // 上下の白い余白は詰め、左右はページ本文の幅で切り出す（前置き文と問題が同じ縮尺になり、スマホでも字が大きく見える）
  const pad=8*SCALE,X0=Math.max(0,Math.min(...parts.map(x=>Math.min(x.px0,x.x0)))-pad),X1=Math.min(parts.length?parts[0].c.width:10,Math.max(...parts.map(x=>Math.max(x.px1,x.x1)))+pad);
  const W=parts.length?Math.round(X1-X0):10,gap=6*SCALE,H=parts.reduce((a,x)=>a+(x.y1-x.y0)+gap,0)+gap||10;
  const out=document.createElement('canvas');out.width=W;out.height=H;const g=out.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,H);
  let y=gap;for(const x of parts){g.drawImage(x.c,X0,x.y0,W,x.y1-x.y0,0,y,W,x.y1-x.y0);y+=x.y1-x.y0+gap;}
  return new Promise(res=>out.toBlob(b=>res(b),'image/jpeg',0.82));
}
