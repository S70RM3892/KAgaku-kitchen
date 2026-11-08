// 英語の3モードのデータと判定。化学のモードとは独立していて、エンジンは RULES.eroot / esyn / eword から呼ぶだけ。
//  語根モード(eroot)：接頭辞・語根・接尾辞を組んで単語を作る（意味から作る／単語を部品に分ける）
//  構文モード(esyn)：構文の型を、語句を正しい順に並べて組む（①②は中身の入る場所）
//  見分けモード(eword)：紛らわしい語のうち、例文の空所に入る方を選ぶ
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keyOf=m=>Object.keys(m).filter(k=>m[k]>0).sort().map(k=>k+'*'+m[k]).join(',');
const itemsMap=items=>{const m={};(items||[]).forEach(([k,n])=>{m[k]=(m[k]||0)+n;});return m;};
const mk=(PART,id,label,name,side)=>{const p={id,label,name,side};PART[id]=p;return p;};

/* =============================== 語根モード =============================== */
const RP={};
const PRE=[['in','中へ／否定'],['re','再び・元へ'],['pro','前へ'],['trans','越えて'],['im','中へ（inの変形）'],['ex','外へ'],['de','下へ・離れて'],['pre','前もって'],['contra','反対に'],['ob','向かって・逆らって'],
  ['e','外へ（exの変形）'],['sub','下に'],['con','共に・完全に'],['com','共に（conの変形）'],['per','通して・完全に'],['ad','〜へ'],['dis','離れて'],['intro','中へ'],['super','上に・超えて'],['uni','1つ']]
  .map(([id,m])=>mk(RP,'p_'+id,id+'-','接頭辞 '+id+'-：'+m,'pre'));
const ROOT=[['spect','見る'],['port','運ぶ'],['dict','言う'],['ject','投げる'],['duce','導く'],['duct','導く'],['mit','送る'],['miss','送る'],['vert','向ける・回す'],['verse','向ける・回す'],
  ['tract','引く'],['scribe','書く'],['script','書く'],['press','押す'],['struct','築く'],['vis','見る'],['vent','来る'],['fer','運ぶ'],['pend','ぶら下がる'],['cept','取る']]
  .map(([id,m])=>mk(RP,'r_'+id,id,'語根 '+id+'：'+m,'root'));
const SUF=[['ion','名詞（〜すること）'],['able','〜できる'],['ible','〜できる'],['ive','〜の性質がある'],['ent','〜している（形容詞）'],['ure','名詞（結果・状態）'],['or','〜する人・物'],['ary','〜に関するもの']]
  .map(([id,m])=>mk(RP,'s_'+id,'-'+id,'接尾辞 -'+id+'：'+m,'suf'));
// [単語, 部品（順番どおり）, 意味, レベル]
const RW=[
  // レベル1：接頭辞＋語根（動詞が中心）
  ['inspect','in spect','調べる・検査する',1],['respect','re spect','尊敬する',1],['prospect','pro spect','見込み・展望',1],
  ['transport','trans port','輸送する',1],['import','im port','輸入する',1],['export','ex port','輸出する',1],['report','re port','報告する',1],['deport','de port','国外へ追放する',1],
  ['predict','pre dict','予測する',1],['contradict','contra dict','矛盾する・反論する',1],
  ['inject','in ject','注射する・注入する',1],['reject','re ject','拒絶する',1],['project','pro ject','計画・投影する',1],['object','ob ject','反対する・物体',1],['eject','e ject','追い出す・排出する',1],['subject','sub ject','主題・従属させる',1],
  ['prevent','pre vent','防ぐ',1],['invent','in vent','発明する',1],['event','e vent','出来事',1],
  ['transfer','trans fer','移す・乗り換える',1],['refer','re fer','言及する・参照する',1],['prefer','pre fer','〜の方を好む',1],['infer','in fer','推論する',1],['confer','con fer','与える・協議する',1],
  ['depend','de pend','頼る・〜次第である',1],['express','ex press','表現する',1],['impress','im press','感銘を与える',1],['compress','com press','圧縮する',1],['depress','de press','落胆させる・押し下げる',1],
  // レベル2：語根を増やす
  ['produce','pro duce','生産する',2],['reduce','re duce','減らす',2],['introduce','intro duce','紹介する・導入する',2],['induce','in duce','引き起こす・説得する',2],
  ['product','pro duct','製品・産物',2],['conduct','con duct','行う・指揮する',2],
  ['transmit','trans mit','伝える・送る',2],['submit','sub mit','提出する・服従する',2],['emit','e mit','放出する',2],['permit','per mit','許可する',2],['admit','ad mit','認める・入場を許す',2],
  ['construct','con struct','建設する・組み立てる',2],['instruct','in struct','指示する・教える',2],
  ['extract','ex tract','抽出する・引き抜く',2],['contract','con tract','契約・縮む',2],['subtract','sub tract','引く（引き算）',2],['distract','dis tract','気をそらす',2],
  ['describe','de scribe','描写する',2],['prescribe','pre scribe','処方する・規定する',2],['subscribe','sub scribe','定期購読する・同意する',2],['inscribe','in scribe','刻む・記す',2],
  ['convert','con vert','変える・転換する',2],['invert','in vert','逆さにする',2],['revert','re vert','元に戻る',2],['reverse','re verse','逆にする・逆の',2],['universe','uni verse','宇宙・全世界',2],['converse','con verse','逆の・会話する',2],
  // レベル3：接尾辞で名詞・形容詞に
  ['inspection','in spect ion','検査',3],['respective','re spect ive','それぞれの',3],['portable','port able','持ち運べる',3],['predictable','pre dict able','予測できる',3],['prediction','pre dict ion','予測',3],
  ['dictionary','dict ion ary','辞書',3],['injection','in ject ion','注射',3],['projector','pro ject or','映写機',3],['objective','ob ject ive','客観的な・目的',3],['rejection','re ject ion','拒絶',3],
  ['production','pro duct ion','生産',3],['reduction','re duct ion','削減',3],['productive','pro duct ive','生産的な',3],
  ['mission','miss ion','使命・任務',3],['transmission','trans miss ion','伝達・送信',3],['permission','per miss ion','許可',3],['admission','ad miss ion','入場・入学・承認',3],['submission','sub miss ion','提出・服従',3],['emission','e miss ion','排出・放出',3],
  ['tractor','tract or','トラクター（引く物）',3],['extraction','ex tract ion','抽出',3],['contractor','con tract or','請負業者',3],
  ['description','de script ion','描写・説明',3],['prescription','pre script ion','処方箋',3],['subscription','sub script ion','定期購読',3],['inscription','in script ion','碑文・銘',3],
  ['pressure','press ure','圧力',3],['expressive','ex press ive','表現力豊かな',3],['impression','im press ion','印象',3],['depression','de press ion','不況・憂うつ',3],
  ['structure','struct ure','構造',3],['construction','con struct ion','建設',3],['instructive','in struct ive','ためになる・有益な',3],['destruction','de struct ion','破壊',3],
  ['visible','vis ible','目に見える',3],['vision','vis ion','視覚・展望',3],['revision','re vis ion','修正・改訂',3],
  ['convention','con vent ion','慣習・大会',3],['prevention','pre vent ion','予防',3],['invention','in vent ion','発明',3],['inventor','in vent or','発明者',3],['preventive','pre vent ive','予防の',3],
  ['dependent','de pend ent','依存している',3],['reception','re cept ion','受付・歓迎会',3],['exception','ex cept ion','例外',3],
  // レベル4：否定の in-・接頭辞2つ・-ible/-able・語根の言い換え
  ['invisible','in vis ible','目に見えない',4],['independent','in de pend ent','独立した',4],['supervision','super vis ion','監督',4],['introduction','intro duct ion','導入・紹介',4],
  ['contradiction','contra dict ion','矛盾',4],['convertible','con vert ible','変換できる・オープンカー',4],['transferable','trans fer able','譲渡できる・移せる',4],
  ['perception','per cept ion','知覚・認識',4],['conception','con cept ion','概念・構想',4],['receptive','re cept ive','受け入れやすい',4],['perceptible','per cept ible','知覚できる',4],
];
const RDB=RW.map(([w,ps,m,lv])=>{
  const parts=ps.split(' ').map(x=>RP['p_'+x]?'p_'+x:RP['r_'+x]?'r_'+x:'s_'+x);
  const cnt={};parts.forEach(p=>cnt[p]=(cnt[p]||0)+1);
  return {id:w,w,seq:parts,parts:cnt,m,lv,np:parts.length,key:keyOf(cnt)};
});
const RBY={},RKEY={};RDB.forEach(d=>{RBY[d.id]=d;RKEY[d.key]=d;});
const plabel=k=>(RP[k]||{label:k}).label;
const pmean=k=>(RP[k]||{name:k}).name.replace(/^.*：/,'');
const rStage=(id,lvl,name,desc,pool,clue,fb,extra={})=>Object.assign({id,lvl,name,desc,pool,clue,fb,time:150,spawn:13,max:3,life:1.15,stars:[150,300,450]},extra);
const rIds=f=>RDB.filter(f).map(d=>d.id);
const ROOTM={
  NONE:'その組み合わせの単語は無い',noSplit:true,
  PART:RP,PARTS:[...PRE,...ROOT,...SUF],
  SHELF:{L:{cap:'接頭辞：タップで選んだ客の鍋へ',main:PRE.map(p=>p.id),cap2:'接尾辞',bottom:SUF.slice(0,4).map(p=>p.id)},
    R:{cap:'',main:ROOT.map(p=>p.id),cap2:'接尾辞',bottom:SUF.slice(4).map(p=>p.id)}},
  BYID:RBY,DB:RDB,
  STAGES:[
    rStage('s1','基礎','接頭辞と語根','in-・re-・pre-・trans- などと spect・port・dict・ject を組む動詞',rIds(d=>d.lv===1),'mix',2),
    rStage('s2','基礎＋','語根を増やす','duce/duct・mit/miss・struct・tract・scribe・vert/verse',rIds(d=>d.lv===2),'mix',2),
    rStage('s3','標準','名詞・形容詞にする','-ion・-ive・-able・-ure・-or などの接尾辞で品詞を変える',rIds(d=>d.lv===3),'mix',1,{max:4,vip:true,stars:[180,360,540]}),
    rStage('s4','応用','見えない部品','否定の in-、接頭辞2つ、-ible と -able、cept の仲間',rIds(d=>d.lv===4),'mix',1,{max:4,vip:true,stars:[180,360,540]}),
    rStage('s5','京大','京大ラッシュ（語根）','全範囲・意味だけで注文。失敗の理由は出ない',rIds(()=>true),'name',0,{time:180,spawn:11,max:4,vip:true,blackout:true,stars:[200,420,640]}),
  ],
  REVIEW:{id:'rv',name:'苦手克服ラン',desc:'習熟度の低い単語だけを集中注文',pool:'review',clue:'mix',fb:1,time:120,spawn:12,max:4,life:1.1,stars:null},
  known:k=>!!RBY[k],
  tgt:k=>({n:RBY[k].m,f:'',proc:null,group:k}),     // 入れ先の表示で答えが見えないよう、名前は意味にする
  nclue:()=>1,
  accept:()=>'',
  exact:(k,items)=>!!RBY[k]&&keyOf(itemsMap(items))===RBY[k].key,
  judgeBuild(k,items){
    const d=RBY[k],m=itemsMap(items),key=keyOf(m);
    if(key===d.key)return {ok:true};
    if(RKEY[key])return {wrong:{id:RKEY[key].id,n:RKEY[key].w,f:''}};
    const side=x=>RP[x].side,ks=new Set([...Object.keys(m),...Object.keys(d.parts)]);
    const miss=[...ks].filter(x=>(m[x]||0)<(d.parts[x]||0)),extra=[...ks].filter(x=>(m[x]||0)>(d.parts[x]||0));
    const SJ={pre:'接頭辞',root:'語根',suf:'接尾辞'};
    const sides=[...new Set([...miss,...extra].map(side))].map(s=>SJ[s]);
    return {why:`${extra.map(plabel).join('・')||'（なし）'} ではなく ${miss.map(plabel).join('・')||'（なし）'}`,lv:2,generic:`${sides.join('・')}が違う`};
  },
  answerText:k=>RBY[k].seq.map(plabel).join(' + '),
  disp:k=>esc(RBY[k].w),
  head(o,isName){
    const d=RBY[o.k];
    return isName?{clue:`<div class="clue name">${esc(d.m)}</div>`,tags:'<span class="tag">意味</span>'}
      :{clue:`<div class="clue name">${esc(d.w)}</div>`,proc:'<div class="proc">を部品に分ける</div>',tags:'<span class="tag">分解</span>'};
  },
  hint(k,l,mode){const d=RBY[k];return l===1?esc(mode==='name'?d.seq.map(x=>`${plabel(x)}（${pmean(x)}）`).slice(0,-1).join('＋')+'＋…':d.m):esc(d.seq.map(plabel).join(' + '));},
  tail:k=>`<small>${esc(RBY[k].w)}（${esc(RBY[k].seq.map(plabel).join(' + '))}）：${esc(RBY[k].m)}</small>`,
  label:plabel,cellName:k=>(RP[k]||{name:k}).name,
  cls:k=>({pre:'e-pre',root:'e-root',suf:'e-suf'})[RP[k]&&RP[k].side]||'',
  reviewTitle:k=>`<b>${esc(RBY[k].w)}</b>　${esc(RBY[k].m)}`,
  reviewDetail:k=>`<div class="note2">${esc(RBY[k].seq.map(x=>`${plabel(x)}（${pmean(x)}）`).join(' + '))}</div>`,
  dexSections:()=>[1,2,3,4].map(lv=>({h:['','基礎（接頭辞＋語根）','基礎＋（語根を増やす）','標準（接尾辞）','応用'][lv],ids:rIds(d=>d.lv===lv)})),
  dexCell:k=>({top:esc(RBY[k].w),sub:esc(RBY[k].m)}),
  dexDetail:k=>{const d=RBY[k];return `<p style="margin:0 0 6px;font-weight:800">${esc(d.m)}</p><div class="rev">${d.seq.map(x=>`<div class="it ok"><b>${esc(plabel(x))}</b>　${esc(pmean(x))}</div>`).join('')}</div>`;},
};
ROOTM.ALL=RDB.map(d=>d.id);

/* =============================== 構文モード =============================== */
const YP={};
const CH=['It is','not until','that','No sooner','had','than','Hardly','when','so','such','a','too','to','enough','not only','but also','not','but',
  'It takes','The','the','said','whether','or not','I wish','I','If it were','not for','should','have','must','cannot','so that','can','is','worth','help','as well as',
  'what','which'];
const cid=t=>'c_'+t.replace(/[^A-Za-z]/g,'_');
CH.forEach(t=>mk(YP,cid(t),t,'語句「'+t+'」','w'));
mk(YP,'s1','①','中身①（主語と動詞など）','slot');mk(YP,'s2','②','中身②（主語と動詞など）','slot');
// [id, 型（①②つき）, 例（日本語）, 例（英語）, 並び, レベル]
const YR=[
  ['so_that','とても①なので②','とても①疲れていたので②すぐに寝た','He was so tired that he went to bed at once.','so ① that ②',1],
  ['such','とても①な（名詞）なので②','①とても良い本だったので②一晩で読んだ','It was such a good book that I read it in one night.','such a ① that ②',1],
  ['too','①すぎて②できない','①熱すぎて②飲めない','The tea is too hot to drink.','too ① to ②',1],
  ['enough','②するのに十分①','①十分年をとっているので②運転できる','She is old enough to drive.','① enough to ②',1],
  ['notonly','①だけでなく②も（not only）','①英語だけでなく②フランス語も話す','He speaks not only English but also French.','not only ① but also ②',1],
  ['notbut','①ではなく②','①お金ではなく②時間が問題だ','The problem is not money but time.','not ① but ②',1],
  ['aswell','①だけでなく②も（as well as）','①英語だけでなく②フランス語も話す（②を先に書く）','He speaks French as well as English.','② as well as ①',2],
  ['takes','②するのに①（時間）かかる','②駅まで歩くのに①10分かかる','It takes ten minutes to walk to the station.','It takes ① to ②',1],
  ['formal','①することは②だ（形式主語 It）','①毎日運動することは②大切だ','It is important to exercise every day.','It is ② to ①',2],
  ['cleft','①なのは②だ（強調）','①窓を割ったのは②トムだ','It is Tom that broke the window.','It is ② that ①',2],
  ['said','①と言われている','①彼は天才だと言われている','It is said that he is a genius.','It is said that ①',2],
  ['whether','①かどうか','①彼が来るかどうか分からない','I don\'t know whether he will come or not.','whether ① or not',2],
  ['themore','①すればするほど②','①高く登るほど②寒くなる','The higher you climb, the colder it gets.','The ① the ②',2],
  ['shouldhave','①すべきだったのに（しなかった）','もっと早く①出発すべきだった','You should have left earlier.','should have ①',3],
  ['musthave','①したにちがいない','彼は①疲れていたにちがいない','He must have been tired.','must have ①',3],
  ['cannothave','①したはずがない','彼が①それを言ったはずがない','He cannot have said that.','cannot have ①',3],
  ['wish','①しなければよかった（I wish）','あんなことを①言わなければよかった','I wish I had not said that.','I wish I had not ①',3],
  ['ifitwere','もし①がなければ②','①水がなければ②生き物は生きられない','If it were not for water, no living things could live.','If it were not for ① ②',3],
  ['sothat','①が②できるように','①みんなが②聞こえるように大きな声で話して','Speak louder so that everyone can hear you.','so that ① can ②',3],
  ['worth','②は①する価値がある','②この本は①読む価値がある','This book is worth reading.','② is worth ①',3],
  ['cannothelp','①せずにはいられない','彼の冗談に①笑わずにはいられない','I cannot help laughing at his jokes.','cannot help ①',3],
  ['notuntil','①してはじめて②（not until）','①病気になってはじめて②健康のありがたさが分かる','It is not until we lose our health that we realize its value.','It is not until ① that ②',4],
  ['nosooner','①するとすぐ②した（No sooner）','①家に着くとすぐに②雨が降り出した','No sooner had I got home than it began to rain.','No sooner had ① than ②',4],
  ['hardly','①するとすぐ②した（Hardly）','①家に着くとすぐに②雨が降り出した','Hardly had I got home when it began to rain.','Hardly had ① when ②',4],
];
// 並びの文字列を部品の列にする（長い語句から先に当てる）
const CHL=CH.slice().sort((a,b)=>b.length-a.length);
function toSeq(s){
  const out=[];let r=s.trim();
  while(r){
    if(r.startsWith('①')){out.push('s1');r=r.slice(1).trim();continue;}
    if(r.startsWith('②')){out.push('s2');r=r.slice(1).trim();continue;}
    const t=CHL.find(c=>r===c||r.startsWith(c+' ')||r.startsWith(c+'①')||r.startsWith(c+'②'));
    if(!t)throw new Error('unknown chunk in: '+s);
    out.push(cid(t));r=r.slice(t.length).trim();
  }
  return out;
}
const YDB=YR.map(([id,pat,ja,en,seq,lv])=>{const sq=toSeq(seq);return {id:'y_'+id,pat,ja,en,seq:sq,lv,np:sq.length,key:sq.join('>')};});
const YBY={},YKEY={};YDB.forEach(d=>{YBY[d.id]=d;YKEY[d.key]=d;});
const ylabel=k=>(YP[k]||{label:k}).label;
const yIds=f=>YDB.filter(f).map(d=>d.id);
const seqOf=items=>(items||[]).map(it=>it[0]);
const SYNM={
  NONE:'その並びの構文は無い',noSplit:true,ordered:true,
  PART:YP,PARTS:Object.values(YP),
  SHELF:{L:{cap:'語句：選んだ客の鍋へ順番に入れる',main:CH.slice(0,20).map(cid),cap2:'中身の入る場所',bottom:['s1','s2']},
    R:{cap:'',main:CH.slice(20,40).map(cid),cap2:'',bottom:[]}},
  BYID:YBY,DB:YDB,
  STAGES:[
    rStage('s1','基礎','基本の構文','so…that・too…to・enough to・not only…but also・It takes',yIds(d=>d.lv===1),'name',2),
    rStage('s2','基礎＋','It の構文','形式主語・強調構文・It is said that・whether・the 比較級',yIds(d=>d.lv<=2),'mix',2),
    rStage('s3','標準','助動詞＋have・仮定法','should have・must have・I wish・If it were not for・cannot help',yIds(d=>d.lv===3),'mix',1,{max:4,vip:true,stars:[180,360,540]}),
    rStage('s4','応用','倒置と強調','It is not until・No sooner・Hardly',yIds(d=>d.lv>=3),'mix',1,{max:4,vip:true,stars:[180,360,540]}),
    rStage('s5','京大','京大ラッシュ（構文）','全範囲・例文だけで注文。失敗の理由は出ない',yIds(()=>true),'prop',0,{time:180,spawn:11,max:4,vip:true,blackout:true,stars:[200,420,640]}),
  ],
  REVIEW:{id:'rv',name:'苦手克服ラン',desc:'習熟度の低い構文だけを集中注文',pool:'review',clue:'mix',fb:1,time:120,spawn:12,max:4,life:1.1,stars:null},
  known:k=>!!YBY[k],
  tgt:k=>({n:YBY[k].pat,f:'',proc:null,group:k}),
  nclue:()=>1,
  accept:()=>'',
  exact:(k,items)=>!!YBY[k]&&seqOf(items).join('>')===YBY[k].key,
  judgeBuild(k,items){
    const d=YBY[k],sq=seqOf(items),key=sq.join('>');
    if(key===d.key)return {ok:true};
    if(YKEY[key])return {wrong:{id:YKEY[key].id,n:YKEY[key].pat,f:''}};
    const need=new Set(d.seq),have=new Set(sq);
    const miss=d.seq.filter(x=>!have.has(x)),extra=sq.filter(x=>!need.has(x));
    if(!miss.length&&!extra.length)return {why:`語順が違う（${d.seq.map(ylabel).join(' ')}）`,lv:2,generic:'語順が違う'};
    if(!extra.length)return {why:`足りない語句がある（${miss.map(ylabel).join('・')}）`,lv:2,generic:'足りない語句がある'};
    return {why:`${extra.map(ylabel).join('・')} は使わない${miss.length?`（必要なのは ${miss.map(ylabel).join('・')}）`:''}`,lv:2,generic:'使わない語句がある'};
  },
  answerText:k=>YBY[k].seq.map(ylabel).join(' '),
  disp:k=>esc(YBY[k].seq.map(ylabel).join(' ')),
  head(o,isName){
    const d=YBY[o.k];
    return isName?{clue:`<div class="clue name pairq">${esc(d.pat)}</div>`,tags:'<span class="tag">型</span>'}
      :{clue:`<div class="clue">${esc(d.ja)}</div>`,tags:'<span class="tag">例文</span>'};
  },
  hint(k,l,mode){const d=YBY[k];return esc(l===1?(mode==='name'?d.ja:d.pat):d.seq.map(ylabel).join(' '));},
  tail:k=>`<small>${esc(YBY[k].en)}</small>`,
  label:ylabel,cellName:k=>(YP[k]||{name:k}).name,
  cls:k=>YP[k]&&YP[k].side==='slot'?'e-slot':/^c_(It|The|No|Hardly|If|I_wish)/.test(k)?'e-head':'e-word',
  reviewTitle:k=>`<b>${esc(YBY[k].pat)}</b>`,
  reviewDetail:k=>`<div class="note2">${esc(YBY[k].seq.map(ylabel).join(' '))}　例：${esc(YBY[k].en)}</div>`,
  dexSections:()=>[1,2,3,4].map(lv=>({h:['','基礎','基礎＋（It の構文など）','標準（助動詞＋have・仮定法）','応用（倒置・強調）'][lv],ids:yIds(d=>d.lv===lv)})),
  dexCell:k=>({top:`<span style="font-size:12px">${esc(YBY[k].seq.map(ylabel).join(' '))}</span>`,sub:esc(YBY[k].pat)}),
  dexDetail:k=>{const d=YBY[k];return `<p style="margin:0 0 6px;font-weight:800">${esc(d.pat)}</p><div class="rev"><div class="it ok" style="font-size:15px">${esc(d.seq.map(ylabel).join(' '))}</div><div class="it ok">${esc(d.ja)}</div><div class="it ok">${esc(d.en)}</div></div>`;},
};
SYNM.ALL=YDB.map(d=>d.id);

/* =============================== 見分けモード =============================== */
const WP={};
// [語, 意味, 例文（___ が空所）] を2つずつ（紛らわしいペア）、レベル
const WPAIRS=[
  [1,['borrow','借りる','Can I ___ your pen for a minute?'],['lend','貸す','Could you ___ me some money?']],
  [1,['rise','上がる（自動詞）','Prices continue to ___ every year.'],['raise','上げる（他動詞）','Please ___ your hand if you have a question.']],
  [1,['lie','横になる（自動詞）','I want to ___ on the bed for a while.'],['lay','置く・横たえる（他動詞）','Please ___ the book on the desk.']],
  [1,['lose','なくす・負ける','Don\'t ___ your ticket.'],['loose','ゆるい','These shoes are too ___ for me.']],
  [1,['alone','ひとりで','He lives ___ in a small house.'],['lonely','寂しい','She felt ___ after her friends moved away.']],
  [1,['advice','助言（名詞）','Let me give you some ___.'],['advise','助言する（動詞）','I ___ you to see a doctor.']],
  [1,['accept','受け入れる','I ___ your apology.'],['except','〜を除いて','Everyone came ___ Tom.']],
  [1,['later','後で','I\'ll call you ___.'],['latter','（2つのうち）後者','Of tea and coffee, I prefer the ___.']],
  [1,['quiet','静かな','Please be ___ in the library.'],['quite','かなり','The test was ___ difficult.']],
  [1,['beside','〜のそばに','She sat ___ me at dinner.'],['besides','〜に加えて','___ English, he speaks French and German.']],
  [2,['affect','影響を与える（動詞）','Lack of sleep can ___ your memory.'],['effect','影響・効果（名詞）','The new law had a strong ___ on prices.']],
  [2,['adapt','適応する','Animals must ___ to their environment.'],['adopt','採用する・養子にする','The company decided to ___ a new policy.']],
  [2,['principal','校長・主要な','The ___ of our school gave a speech.'],['principle','原則・主義','Honesty is my guiding ___.']],
  [2,['stationary','静止した','The car remained ___ at the red light.'],['stationery','文房具','The shop sells pens, paper, and other ___.']],
  [2,['complement','補完する・補うもの','The wine will ___ the meal perfectly.'],['compliment','ほめ言葉','He paid her a ___ on her speech.']],
  [3,['economic','経済の','The country is facing serious ___ problems.'],['economical','経済的な（安上がりな）','This small car is more ___ than a large one.']],
  [3,['historic','歴史的に重要な','The signing of the treaty was a ___ moment.'],['historical','歴史の・史実の','The museum displays ___ documents from the 18th century.']],
  [3,['sensible','分別のある・賢明な','It would be ___ to leave early to avoid traffic.'],['sensitive','敏感な','My skin is very ___ to sunlight.']],
  [3,['industrial','産業の','Osaka is a major ___ city.'],['industrious','勤勉な','She is an ___ student who studies every day.']],
  [3,['respectable','立派な・ちゃんとした','He comes from a ___ family.'],['respectful','敬意を表す・礼儀正しい','Students should be ___ to their teachers.']],
  [3,['imaginary','想像上の','Unicorns are ___ animals.'],['imaginative','想像力豊かな','The child wrote an ___ story.']],
  [3,['considerable','かなりの','The project cost a ___ amount of money.'],['considerate','思いやりのある','It was ___ of you to call me.']],
  [3,['successful','成功した','Her business was very ___.'],['successive','連続する','The team won three ___ games.']],
  [3,['continual','繰り返し起こる','I\'m tired of his ___ complaints.'],['continuous','途切れなく続く','The machine makes a ___ noise all night.']],
];
const WDB=[];
WPAIRS.forEach(([lv,a,b],i)=>{
  for(const [w,m,s] of [a,b]){const other=w===a[0]?b[0]:a[0];mk(WP,'w_'+w,w,`${w}：${m}`,'word');WDB.push({id:'w_'+w,w,m,s,lv,other:'w_'+other,pair:i,np:1});}
});
const WBY={};WDB.forEach(d=>WBY[d.id]=d);
const wIds=f=>WDB.filter(f).map(d=>d.id);
const blank=s=>esc(s).replace('___','<u class="blank">　　　</u>');
const WORDM={
  NONE:'',noSplit:true,
  PART:WP,PARTS:Object.values(WP),
  SHELF:{L:{cap:'語：選ぶとすぐ判定',main:WPAIRS.slice(0,20).map(p=>'w_'+p[1][0]),cap2:'',bottom:WPAIRS.slice(20).map(p=>'w_'+p[1][0])},
    R:{cap:'',main:WPAIRS.slice(0,20).map(p=>'w_'+p[2][0]),cap2:'',bottom:WPAIRS.slice(20).map(p=>'w_'+p[2][0])}},
  BYID:WBY,DB:WDB,
  STAGES:[
    rStage('s1','基礎','よく出る取り違え','borrow/lend・rise/raise・lie/lay・lose/loose・advice/advise など',wIds(d=>d.lv===1),'name',2),
    rStage('s2','基礎＋','つづりが似た語','affect/effect・adapt/adopt・principal/principle・stationary/stationery',wIds(d=>d.lv<=2),'name',2),
    rStage('s3','標準','意味が分かれる形容詞','economic/economical・sensible/sensitive・industrial/industrious など',wIds(d=>d.lv===3),'name',1,{max:4,vip:true,stars:[180,360,540]}),
    rStage('s4','応用','例文だけで選ぶ','全範囲・日本語のヒントなし',wIds(()=>true),'prop',1,{max:4,vip:true,stars:[180,360,540]}),
    rStage('s5','京大','京大ラッシュ（語の見分け）','全範囲・例文だけ。停電・延焼あり',wIds(()=>true),'prop',0,{time:180,spawn:10,max:4,vip:true,blackout:true,stars:[200,420,640]}),
  ],
  REVIEW:{id:'rv',name:'苦手克服ラン',desc:'間違えやすい語だけを集中注文',pool:'review',clue:'mix',fb:1,time:120,spawn:12,max:4,life:1.1,stars:null},
  known:k=>!!WBY[k],
  tgt:k=>({n:WBY[k].s,f:'',proc:null,group:'g'+WBY[k].pair,pick:true}),   // 同じペアの2語は同時に並べない
  nclue:()=>1,
  accept:()=>'',
  exact:()=>false,
  instant:items=>items.length>0,
  judgePick(k,items){
    const d=WBY[k],g=items&&items[0]?items[0][0]:null,x=WBY[g];
    const line=`正解 ${d.w}：${d.m}`;
    if(g===k)return {ok:true,line:`${d.w}：${d.m}`};
    return {ok:false,given:x?x.w:'?',line,why:x?`${x.w} は「${x.m}」`:'ちがう語'};
  },
  answerText:k=>WBY[k].w,
  disp:k=>esc(WBY[k].w),
  head(o,isName){const d=WBY[o.k];return {clue:`<div class="clue">${blank(d.s)}</div>`,proc:isName?`<div class="proc">${esc(d.m)}</div>`:'',tags:'<span class="tag">空所</span>'};},
  hint(k,l){const d=WBY[k];return esc(l===1?`候補：${d.w} / ${WBY[d.other].w}（どちらか）`:`${d.w}：${d.m}`);},
  tail:(k,note)=>`<small>${esc(note||WBY[k].w+'：'+WBY[k].m)}｜${esc(WBY[k].s.replace('___',WBY[k].w))}</small>`,
  label:k=>(WP[k]||{label:k}).label,cellName:k=>(WP[k]||{name:k}).name,
  brk:w=>w.length>=9?w.slice(0,-4)+'-|'+w.slice(-4):'',   // 長い語は狭いマスで2行に（consider-／able）
  cls:k=>WBY[k]&&WBY[k].pair%2?'e-w1':'e-w2',
  reviewTitle:k=>`<b>${esc(WBY[k].w)}</b>　${esc(WBY[k].m)}`,
  reviewDetail:k=>{const d=WBY[k],o=WBY[d.other];return `<div class="note2">${esc(d.s.replace('___',d.w))}<br>↔ ${esc(o.w)}：${esc(o.m)}</div>`;},
  dexSections:()=>[1,2,3].map(lv=>({h:['','基礎（よく出る取り違え）','基礎＋（つづりが似た語）','標準（意味が分かれる形容詞）'][lv],ids:wIds(d=>d.lv===lv)})),
  dexCell:k=>({top:esc(WBY[k].w),sub:esc(WBY[k].m)}),
  dexDetail:k=>{const d=WBY[k],o=WBY[d.other];return `<p style="margin:0 0 6px;font-weight:800">${esc(d.m)}</p><div class="rev"><div class="it ok">${esc(d.s.replace('___',d.w))}</div><div class="it">↔ <b>${esc(o.w)}</b>：${esc(o.m)}<br>${esc(o.s.replace('___',o.w))}</div></div>`;},
};
WORDM.ALL=WDB.map(d=>d.id);

export {ROOTM,SYNM,WORDM,toSeq,RP,YP,WP,keyOf,itemsMap,esc};
