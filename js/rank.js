// 全国ランキング：ソロの点数を Supabase に送り、ステージごと・忙しさごとの順位を見る。
// 送るのは「名前・モード・ステージ・点数・端末ごとのランダムなID」だけ。
// 表は外から直接さわれない場所にあり、ブラウザからは「送る（kk_submit）」と「見る（kk_top）」の2つの関数しか呼べない。
const URL_='https://zcwqgnlcigkieymhbnvh.supabase.co';
const KEY='sb_publishable_yBcqMAsyfCvk53G52A47ww_ElQPayBU';   // 公開用のキー（公開してよい種類）

// ランキングに載せるモード（各自の読み込んだ過去問で問題が違う「過去問 早押し」と、苦手克服ランは載せない）
export const RANKED=new Set(['rx','atom','org','ion','quiz','eroot','esyn','eword','kphy','kchem','kmath']);
export const ranked=(g,stageId)=>RANKED.has(g)&&stageId!=='rv';

export function deviceId(){
  let d=null;try{d=localStorage.getItem('kk-dev');}catch(e){}
  if(!d||!/^[0-9a-f]{16}$/.test(d)){
    const u=new Uint8Array(8);crypto.getRandomValues(u);d=[...u].map(x=>x.toString(16).padStart(2,'0')).join('');
    try{localStorage.setItem('kk-dev',d);}catch(e){}
  }
  return d;
}
async function rpc(fn,args,ms=8000){
  const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);
  try{
    const r=await fetch(`${URL_}/rest/v1/rpc/${fn}`,{method:'POST',signal:ac.signal,
      headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(args)});
    const j=await r.json().catch(()=>null);
    if(!r.ok)throw new Error((j&&(j.message||j.hint))||('HTTP '+r.status));
    return j;
  }finally{clearTimeout(t);}
}
// 点数を送る → {rank, total, best}（この期間で何位か・何人中か・自己ベスト）
export function submit(g,st,name,score){
  return rpc('kk_submit',{p_g:g,p_st:st,p_name:cleanName(name),p_dev:deviceId(),p_score:Math.max(0,Math.round(score))});
}
// 上位を見る（days=7 なら今週、0 なら全期間）。自分が圏外でも自分の行は付いてくる
export function top(g,st,days=7,limit=50){
  return rpc('kk_top',{p_g:g,p_st:st,p_days:days,p_dev:deviceId(),p_limit:limit});
}
export const cleanName=n=>(String(n||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,12))||'名無し';
