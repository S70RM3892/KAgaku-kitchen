// 画像だけのPDF（スキャンした過去問）を読むための文字認識（OCR）。すべてこの端末の中で行う。
// tesseract.js（Apache-2.0）と日本語モデルを vendor/tesseract/ から必要になったときだけ読み込む。
// 認識した文字は、文字入りPDFと同じ「行」の形（ページ上の位置はPDFのポイント単位）にして返すので、
// 問題の切り取りや正解表の読み取りはそのまま同じ処理を使える。
const V=new URL('../vendor/tesseract/',import.meta.url).href;
let W=null;
async function worker(){
  if(W)return W;
  const T=await import(V+'tesseract.esm.min.js');
  const createWorker=T.createWorker||(T.default&&T.default.createWorker);
  W=createWorker('jpn',1,{workerPath:V+'worker.min.js',corePath:V+'core/',langPath:V+'lang',gzip:true,workerBlobURL:false});
  W=await W;
  await W.setParameters({preserve_interword_spaces:'0'});
  return W;
}
// 数字だけを読む用（英語モデルのほうが1文字の数字に強い）
let WD=null;
async function digitWorker(){
  if(WD)return WD;
  const T=await import(V+'tesseract.esm.min.js');
  const createWorker=T.createWorker||(T.default&&T.default.createWorker);
  WD=await createWorker('eng',1,{workerPath:V+'worker.min.js',corePath:V+'core/',langPath:V+'lang',gzip:true,workerBlobURL:false});
  return WD;
}
export async function ocrDone(){for(const w of [W,WD])if(w)await w.terminate();W=null;WD=null;}

// 表の罫線（長い縦線・横線）を消す。正解表の数字が罫線とくっついて読めなくなるのを防ぐ
function eraseRules(c){
  const g=c.getContext('2d',{willReadFrequently:true}),W_=c.width,H=c.height,im=g.getImageData(0,0,W_,H),d=im.data;
  const dark=new Uint8Array(W_*H);for(let i=0;i<W_*H;i++)dark[i]=d[i*4]<140?1:0;
  const kill=new Uint8Array(W_*H),L=Math.max(40,Math.round(W_*0.04));
  for(let y=0;y<H;y++){let run=0;for(let x=0;x<=W_;x++){if(x<W_&&dark[y*W_+x])run++;else{if(run>=L)for(let k=x-run;k<x;k++)kill[y*W_+k]=1;run=0;}}}
  for(let x=0;x<W_;x++){let run=0;for(let y=0;y<=H;y++){if(y<H&&dark[y*W_+x])run++;else{if(run>=L)for(let k=y-run;k<y;k++)kill[k*W_+x]=1;run=0;}}}
  for(let i=0;i<W_*H;i++)if(kill[i]){d[i*4]=d[i*4+1]=d[i*4+2]=255;}
  g.putImageData(im,0,0);return c;
}
const BOX=/[\[\]|｜「」『』()（）【】〔〕Il!]/;
// canvas（scale倍で描いたページ）を読んで、行の配列にする
export async function ocrLines(canvas,scale,{table=false}={}){
  const w=await worker();
  if(table)eraseRules(canvas);
  await w.setParameters({tessedit_pageseg_mode:table?'11':'3',tessedit_char_whitelist:''});
  const {data}=await w.recognize(canvas,{},{blocks:true,text:false,hocr:false,tsv:false});
  const lines=[];
  for(const b of data.blocks||[])for(const p of b.paragraphs||[])for(const l of p.lines||[]){
    const t=[];
    for(const wd of l.words||[]){
      let s=String(wd.text||'').trim();if(!s)continue;
      const box=BOX.test(s);
      // 枠に入った数字（解答番号）は記号を外して数字だけにする
      const m=s.match(/^[^\d]{0,3}(\d{1,2})[^\d]{0,3}$/);if(m&&box)s=m[1];
      t.push({s,x:wd.bbox.x0/scale,w:(wd.bbox.x1-wd.bbox.x0)/scale,y:wd.bbox.y1/scale,h:(wd.bbox.y1-wd.bbox.y0)/scale,box:box&&/^\d{1,2}$/.test(s)});
    }
    if(!t.length)continue;
    const y=l.bbox.y1/scale,h=(l.bbox.y1-l.bbox.y0)/scale;
    lines.push({y,h,n:t.length,t,x:t[0].x,top:y-h,ocr:true,
      // よくある読み違い：「問」を「間」「門」と読む
      text:t.map(x=>x.s).join('').replace(/[間門閉開聞両]\s*(?=[0-9０-９])/g,'問').replace(/(第\s*[0-9０-９]+\s*)[間門閉開聞両]/g,'$1問')});
  }
  lines.sort((a,b)=>a.y-b.y);
  return lines;
}

/* ===== 正解表（罫線で区切られた表）を読む =====
   罫線を見つけてマス目に分け、各列の見出し（「解答番号」「正解」「設問」「問題番号」）を日本語で読み、
   解答番号・正解・設問のマスを数字だけで読む。返すのは
   {rows:[{n:解答番号, ans:正解, dai:第何問, q:設問}], head:[表の上の文字（科目名など）]} */
function darkMap(c,th=205){
  const W_=c.width,H=c.height,d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W_,H).data,m=new Uint8Array(W_*H);
  for(let i=0;i<W_*H;i++)m[i]=d[i*4]<th?1:0;return {m,W:W_,H};   // 罫線はかすれて薄い灰色のこともあるので、薄めでも黒とみなす
}
function runs(D,horiz,minLen){
  // 横線（horiz）または縦線の位置ごとに、minLen 以上つづく黒の区間を集める
  const out=[],{m,W:W_,H}=D,A=horiz?H:W_,B=horiz?W_:H;
  for(let a=0;a<A;a++){let s=-1;for(let b=0;b<=B;b++){const v=b<B&&m[horiz?a*W_+b:b*W_+a];if(v&&s<0)s=b;else if(!v&&s>=0){if(b-s>=minLen)out.push({p:a,s,e:b});s=-1;}}}
  // 隣り合う位置（太い線）をまとめる
  out.sort((x,y)=>x.p-y.p||x.s-y.s);const M=[];
  for(const r of out){const L=M.find(z=>r.p-z.p2<=2&&r.s<z.e&&r.e>z.s);if(L){L.p2=r.p;L.s=Math.min(L.s,r.s);L.e=Math.max(L.e,r.e);}else M.push({p:r.p,p2:r.p,s:r.s,e:r.e});}
  return M.map(z=>({p:(z.p+z.p2)/2,s:z.s,e:z.e}));
}
function crop(c,x0,y0,x1,y1,pad=4,bin=false){
  const w=Math.max(1,Math.round(x1-x0-2*pad)),h=Math.max(1,Math.round(y1-y0-2*pad)),o=document.createElement('canvas');
  // 小さいマスは拡大して読みやすくする（文字の高さを100px くらいに）
  const k=h<100?Math.min(4,100/h):1,M=30;o.width=Math.round(w*k)+2*M;o.height=Math.round(h*k)+2*M;
  const g=o.getContext('2d',{willReadFrequently:true});g.fillStyle='#fff';g.fillRect(0,0,o.width,o.height);g.imageSmoothingEnabled=true;
  g.drawImage(c,x0+pad,y0+pad,w,h,M,M,w*k,h*k);
  if(bin){const im=g.getImageData(0,0,o.width,o.height),d=im.data;
    // 白黒にし、マスの端に残った罫線のかけらを消す
    for(let i=0;i<d.length;i+=4){const v=d[i]<170?0:255;d[i]=d[i+1]=d[i+2]=v;}
    const W_=o.width,H=o.height;for(let y=0;y<H;y++)for(let x=0;x<W_;x++)if(x<M+6||x>W_-M-6||y<M+6||y>H-M-6){const i=(y*W_+x)*4;d[i]=d[i+1]=d[i+2]=255;}
    g.putImageData(im,0,0);}
  return o;
}
// マスの中の字を、縦横を合わせた小さな白黒の図（16x16）にする（同じ表の中の数字どうしを見比べるため）
function glyph(c){
  const g=c.getContext('2d',{willReadFrequently:true}),W_=c.width,H=c.height,d=g.getImageData(0,0,W_,H).data;
  let x0=W_,x1=-1,y0=H,y1=-1;
  for(let y=0;y<H;y++)for(let x=0;x<W_;x++)if(d[(y*W_+x)*4]<128){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  if(x1<0)return null;
  const o=document.createElement('canvas');o.width=o.height=16;const h=o.getContext('2d',{willReadFrequently:true});
  h.fillStyle='#fff';h.fillRect(0,0,16,16);const bw=x1-x0+1,bh=y1-y0+1,k=14/Math.max(bw,bh);
  h.drawImage(c,x0,y0,bw,bh,8-bw*k/2,8-bh*k/2,bw*k,bh*k);
  const e=h.getImageData(0,0,16,16).data,v=new Float32Array(256);for(let i=0;i<256;i++)v[i]=(255-e[i*4])/255;
  return {v,ar:bw/bh};
}
const gdist=(a,b)=>{let s=0;for(let i=0;i<256;i++){const t=a.v[i]-b.v[i];s+=t*t;}return s+20*Math.abs(a.ar-b.ar);};
// 1文字の数字を読む：2つのモデル×3つの読み方で投票し（自信の高さで重みづけ）、はっきり勝った数字だけを採る。
// 1つのモデルが自信満々にまちがえることがあるため（例：7 を 2 と読む）
async function readDigit(ws,c){
  const vote={};
  for(const w of ws)for(const psm of ['10','7','8']){
    await w.setParameters({tessedit_pageseg_mode:psm,tessedit_char_whitelist:'0123456789'});
    const {data}=await w.recognize(c,{},{text:true});const t=String(data.text||'').replace(/[^0-9]/g,'');
    if(/^\d$/.test(t))vote[t]=(vote[t]||0)+(data.confidence||0);
  }
  const r=Object.entries(vote).sort((a,b)=>b[1]-a[1]);
  if(!r.length)return {t:'',conf:0};
  const [t,v]=r[0],v2=r[1]?r[1][1]:0;
  return {t,conf:v>=100&&v>=v2*1.5?90:Math.min(60,v/3),runner:r[1]&&r[1][0]};
}
async function readCell(w,c,digits){
  await w.setParameters(digits?{tessedit_pageseg_mode:digits==='1'?'10':'7',tessedit_char_whitelist:'0123456789'}:{tessedit_pageseg_mode:'6',tessedit_char_whitelist:''});
  const {data}=await w.recognize(c,{},{text:true,blocks:false,hocr:false,tsv:false});
  return String(data.text||'').replace(/\s+/g,'');
}
export async function readTable(canvas,scale,onCell){
  const w=await worker(),wd=await digitWorker(),D=darkMap(canvas,150),DL=darkMap(canvas,205);
  const V_=runs(D,false,Math.round(D.H*0.08)),H_=runs(D,true,Math.round(D.W*0.04));
  if(V_.length<3||H_.length<3)return null;
  const top=Math.min(...H_.map(h=>h.p)),xs=[...new Set(V_.map(v=>Math.round(v.p)))].sort((a,b)=>a-b);
  // 縦線どうしの間（列）ごとに、その列を横切る横線でマスに分ける
  const strips=[];
  for(let i=0;i<xs.length-1;i++){
    const x0=xs[i],x1=xs[i+1];if(x1-x0<12)continue;
    // この列の上下は、この列の縦線の範囲で決める
    const vl=V_.filter(v=>Math.abs(v.p-x0)<4||Math.abs(v.p-x1)<4);
    const y0=Math.max(0,Math.min(...vl.map(v=>v.s))-6),y1=Math.min(D.H-1,Math.max(...vl.map(v=>v.e))+6);
    // 横線を探す：その行で（上下1pxのずれを許して）つながった黒のいちばん長い区間の長さを測る（2pxまでの切れ目は許す）
    const a0=x0+4,a1=x1-4;
    const prof_=MM=>{const M_=MM.m,WW=MM.W,out=[];
      for(let y=Math.max(1,y0);y<=Math.min(MM.H-2,y1);y++){let best=0,run=0,gap=0;
        for(let x=a0;x<a1;x++){if(M_[y*WW+x]|M_[(y-1)*WW+x]|M_[(y+1)*WW+x]){run+=1+gap;gap=0;if(run>best)best=run;}else if(run&&gap<2)gap++;else{run=0;gap=0;}}
        out.push([y,best/(a1-a0)]);}return out;};
    const longest=prof_(D),longestL=prof_(DL);
    const lines_=(k,L=longest)=>{const out=[];for(const [y,f] of L)if(f>=k){if(out.length&&y-out[out.length-1].e<=3)out[out.length-1].e=y;else out.push({s:y,e:y});}return out.map(c=>Math.round((c.s+c.e)/2));};
    // 見出しの下の線は列をほぼ横切る（85%）。本文の行の線は、設問の欄のように一部だけのこともあるので45%で拾う
    const strict=lines_(0.85),loose=lines_(0.45,longestL);   // 本文の行の線は薄くても拾う
    if(strict.length<2)continue;
    const hy0=strict[0],hy1=strict.find(y=>y-hy0>25);if(hy1==null)continue;
    const mk=L=>{const ys=[hy0,hy1,...L.filter(y=>y>hy1+8)],c=[];for(let j=0;j<ys.length-1;j++)if(ys[j+1]-ys[j]>10)c.push({y0:ys[j],y1:ys[j+1]});return c;};
    const cells=mk(strict),cellsLoose=mk(loose),prof=new Map(longest),profL=new Map(longestL);
    if(cells.length)strips.push({x0,x1,cells,cellsLoose,prof,profL});
  }
  if(onCell&&onCell.debug){onCell.debug(strips,V_,H_);}
  // 見出しのマスを読み、列の役割を決める
  for(const s of strips){
    const h=s.cells[0];s.head=await readCell(w,crop(canvas,s.x0,h.y0,s.x1,h.y1),false);
    const t=s.head;
    s.role=/答|解答/.test(t)?'A':/正/.test(t)?'B':/題/.test(t)?'D':/設/.test(t)?'Q':/配|点/.test(t)?'P':/番/.test(t)?'D':'?';
    if(s.role!=='D')s.cells=s.cellsLoose;   // 設問の欄は A・B のような小分けで一部だけの線があり、数字だけの欄はかすれた線も拾う。問題番号の欄は「第4問」の字を線と間違えないよう厳しく
  }
  // 解答番号の列（A）の行の区切りを基準にする（数字だけの欄なので区切りの線を確実に拾える）。
  // 正解はその行の高さで右の列を切り出し、設問・問題番号は「その区切りの位置に、その列でも線が引かれているか」でまとまりを決める
  // （設問がいくつかの解答番号にまたがるときは、その列では線が無い）。解答番号は表の中で上から（左の表 → 右の表）1, 2, 3 … と並ぶ
  const runAt=(S,y,light)=>{let m=0;const P=light?S.profL:S.prof;for(let d=-5;d<=5;d++){const v=P.get(Math.round(y)+d)||0;if(v>m)m=v;}return m;};
  const rows=[];
  for(const a of strips.filter(s=>s.role==='A')){
    const i=strips.indexOf(a),b=strips.slice(i+1).find(s=>s.role==='B'),left=strips.slice(0,i).reverse();
    // 設問は解答番号のすぐ左の欄（A・Bのような小分けの欄があっても、数字の欄は解答番号のとなり）
    const d=left.find(s=>s.role==='D'),q=left[0]&&!['D','A','B','P'].includes(left[0].role)?left[0]:left.find(s=>s.role==='Q');
    if(!b)continue;
    const body=a.cells.slice(1);
    const group=(S,test)=>{if(!S)return body.map(()=>null);let g=0;return body.map((c,j)=>{if(j&&test(S,c.y0))g++;return S.x0+':'+g;});};
    // 設問：はっきりした線が3割以上、または薄い線が7割以上。問題番号：はっきりした線が6割以上（「第4問」の字を線と間違えない）
    const gq=group(q,(S,y)=>runAt(S,y)>=0.3||runAt(S,y,true)>=0.7),gd=group(d,(S,y)=>runAt(S,y)>=0.6);
    for(const [j,c] of body.entries()){
      const cc=crop(canvas,b.x0,c.y0,b.x1,c.y1,4,true);if(onCell&&onCell.cell)onCell.cell(cc,rows.length+1);
      const r=await readDigit([wd,w],cc);
      if(onCell)onCell();
      rows.push({ans:r.t,conf:r.conf,gl:glyph(cc),qcell:gq[j],dcell:gd[j],x:a.x0,y:(c.y0+c.y1)/2});
    }
  }
  rows.sort((p,q)=>p.x-q.x||p.y-q.y).forEach((r,i)=>{r.n=i+1;});
  // 自信の低い正解は、同じ表の中で確実に読めた数字（同じ字体）の形と見比べ、両方の答えが合うときだけ使う。
  // 合わなければ空にする（その問は出題しない）。まちがった正解で出題するより、出さないほうがいい
  const SURE=80,sure=rows.filter(r=>r.ans&&r.gl&&r.conf>=SURE);
  for(const r of rows){
    if(!r.gl||(r.ans&&r.conf>=SURE))continue;
    let best=null,bd=1e9;for(const t of sure){const d=gdist(r.gl,t.gl);if(d<bd){bd=d;best=t;}}
    const tm=best&&bd<18?best.ans:'';
    r.ans=(r.ans&&tm&&r.ans===tm)||(!r.ans&&tm&&bd<6)?tm:'';
  }
  rows.forEach(r=>{delete r.gl;});
  const dOrder=[...new Set(rows.map(r=>r.dcell).filter(Boolean))];
  rows.forEach(r=>{r.dai=r.dcell?dOrder.indexOf(r.dcell)+1:null;});
  for(const dai of new Set(rows.map(r=>r.dai))){const qs=[...new Set(rows.filter(r=>r.dai===dai).map(r=>r.qcell))];rows.filter(r=>r.dai===dai).forEach(r=>{r.q=r.qcell?qs.indexOf(r.qcell)+1:null;});}
  rows.forEach(r=>{delete r.dcell;delete r.qcell;});
  // 表の上にある文字（科目名など）
  const head=[];
  if(top>20){const hc=crop(canvas,0,0,canvas.width,top,0);await w.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:''});
    const {data}=await w.recognize(hc,{},{text:true});head.push(String(data.text||'').replace(/\s+/g,''));}
  return {rows,head,strips:strips.map(s=>s.role+':'+s.head)};
}
