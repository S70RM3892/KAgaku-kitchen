// 官能基モードのデータ：骨格・官能基の部品を組んで有機化合物を作る／検出試薬で2つの化合物を見分ける
// 反応式・組成モードとは別のデータ。判定もここで行い、エンジンは RULES.org から呼ぶだけ
import {parseFormula,fmt} from './data.js';

/* ================= 部品（棚） ================= */
// a: 部品に含まれる原子（化合物の示性式と原子数が一致するかをテストで確かめる）
const P=(id,label,name,side,a)=>({id,label,name,side,a});
const PARTS=[
  // 骨格（左の棚）
  P('H','H–','水素原子','sk',{H:1}),
  P('CH3','CH₃–','メチル基','sk',{C:1,H:3}),
  P('C2H5','C₂H₅–','エチル基','sk',{C:2,H:5}),
  P('C3H7','C₃H₇–','プロピル基（直鎖）','sk',{C:3,H:7}),
  P('C6H5','C₆H₅–','フェニル基','sk',{C:6,H:5}),
  P('oC6H4','o-C₆H₄','ベンゼン環（オルト位に2つ）','sk',{C:6,H:4}),
  P('mC6H4','m-C₆H₄','ベンゼン環（メタ位に2つ）','sk',{C:6,H:4}),
  P('pC6H4','p-C₆H₄','ベンゼン環（パラ位に2つ）','sk',{C:6,H:4}),
  P('CH2CH','CH₂=CH–','ビニル基','sk',{C:2,H:3}),
  P('cisCHCH','–CH=CH– シス','シス形の二重結合（両端に置換基）','sk',{C:2,H:2}),
  P('trCHCH','–CH=CH– トランス','トランス形の二重結合（両端に置換基）','sk',{C:2,H:2}),
  P('CHC','HC≡C–','エチニル基（三重結合）','sk',{C:2,H:1}),
  // 官能基（右の棚）
  P('OH','–OH','ヒドロキシ基','fg',{O:1,H:1}),
  P('CHO','–CHO','ホルミル基（アルデヒド基）','fg',{C:1,H:1,O:1}),
  P('CO','–CO–','カルボニル基（ケトン）','fg',{C:1,O:1}),
  P('COOH','–COOH','カルボキシ基','fg',{C:1,O:2,H:1}),
  P('COO','–COO–','エステル結合','fg',{C:1,O:2}),
  P('O','–O–','エーテル結合','fg',{O:1}),
  P('NH2','–NH₂','アミノ基','fg',{N:1,H:2}),
  P('NO2','–NO₂','ニトロ基','fg',{N:1,O:2}),
  P('SO3H','–SO₃H','スルホ基','fg',{S:1,O:3,H:1}),
  P('NHCO','–NHCO–','アミド結合','fg',{N:1,H:1,C:1,O:1}),
  P('CHOH','–CH(OH)–','第二級アルコールの炭素','fg',{C:1,H:2,O:1}),
  P('Cl','–Cl','クロロ基','fg',{Cl:1}),
];
const PART={};PARTS.forEach(p=>PART[p.id]=p);
const SK=PARTS.filter(p=>p.side==='sk').map(p=>p.id);
const FG=PARTS.filter(p=>p.side==='fg').map(p=>p.id);

/* ================= 検出試薬（棚の最下段） ================= */
// pos: 陽性のときの見た目、det: 何を調べる試薬か
const TESTS=[
  {id:'Ag',label:'銀鏡',name:'アンモニア性硝酸銀水溶液（銀鏡反応）',pos:'銀が析出（銀鏡）',det:'ホルミル基（–CHO）'},
  {id:'Feh',label:'フェーリング',name:'フェーリング液（加熱）',pos:'赤色沈殿（Cu₂O）',det:'ホルミル基（–CHO）'},
  {id:'I2',label:'I₂+NaOH',name:'ヨウ素とNaOH水溶液（ヨードホルム反応）',pos:'黄色沈殿（CHI₃）',det:'CH₃CO–／CH₃CH(OH)– の構造'},
  {id:'FeCl3',label:'FeCl₃',name:'塩化鉄(III)水溶液',pos:'紫系に呈色',det:'フェノール性ヒドロキシ基'},
  {id:'NaHCO3',label:'NaHCO₃',name:'炭酸水素ナトリウム水溶液',pos:'CO₂が発生',det:'炭酸より強い酸（–COOH・–SO₃H）'},
  {id:'Na',label:'Na',name:'金属ナトリウム',pos:'H₂が発生',det:'–OH・–COOH などのH'},
  {id:'CaClO',label:'さらし粉',name:'さらし粉水溶液',pos:'赤紫色に呈色',det:'アニリン（ベンゼン環に直結した–NH₂）'},
  {id:'Br2',label:'臭素水',name:'臭素水',pos:'赤褐色が消える',det:'C=C・C≡C（不飽和結合）'},
];
const TEST={};TESTS.forEach(t=>TEST[t.id]=t);
const TIDS=TESTS.map(t=>t.id);

/* ================= 化合物 ================= */
// [id, 名前, 示性式, 部品, 分類, レベル(1基礎〜4応用), 陽性の試薬, 判定に使わない試薬（扱いが割れる・反応が複雑）, 性質ヒント, 特別な見た目, 注記]
const C=(id,n,f,parts,k,lv,pos,unk,p,tx={},note='')=>({id,n,f,parts,k,lv,pos:pos?pos.split(' '):[],unk:unk?unk.split(' '):[],p,tx,note});
const ESTER_I2='教科書ではエステルのヨードホルム反応は陰性として扱う';
const RAW=[
  // ---- レベル1：脂肪族の基本 ----
  C('MeOH','メタノール','CH3OH',{CH3:1,OH:1},'アルコール',1,'Na','',['最も簡単なアルコール。酸化するとホルムアルデヒドになる','Naと反応してH₂を出すが、ヨードホルム反応は示さないC₁のアルコール']),
  C('EtOH','エタノール','C2H5OH',{C2H5:1,OH:1},'アルコール',1,'Na I2','',['酒に含まれるアルコール。ヨードホルム反応を示す','酸化するとアセトアルデヒドを経て酢酸になるアルコール','濃硫酸と130℃でジエチルエーテル、160〜170℃でエチレンを生じるアルコール']),
  C('HCHO','ホルムアルデヒド','HCHO',{H:1,CHO:1},'アルデヒド',1,'Ag Feh','Br2',['メタノールを酸化して得られる気体。水溶液はホルマリン','銀鏡反応を示すが、ヨードホルム反応は示さないC₁のアルデヒド']),
  C('MeCHO','アセトアルデヒド','CH3CHO',{CH3:1,CHO:1},'アルデヒド',1,'Ag Feh I2','Br2',['エタノールを酸化して得られるアルデヒド','銀鏡反応もヨードホルム反応も示すC₂の化合物','工業的にはエチレンの酸化（ヘキスト・ワッカー法）で作られる']),
  C('Acetone','アセトン','CH3COCH3',{CH3:2,CO:1},'ケトン',1,'I2','Br2',['2-プロパノールを酸化して得られるケトン','ヨードホルム反応は示すが、銀鏡反応は示さない','酢酸カルシウムを乾留すると得られる']),
  C('HCOOH','ギ酸','HCOOH',{H:1,COOH:1},'カルボン酸',1,'Ag NaHCO3 Na','Feh Br2',['カルボン酸なのに銀鏡反応を示す（ホルミル基をもつ）','最も簡単なカルボン酸。濃硫酸で脱水するとCOが発生する'],{},'フェーリング液を還元するかは文献・教科書で扱いが分かれる'),
  C('AcOH','酢酸','CH3COOH',{CH3:1,COOH:1},'カルボン酸',1,'NaHCO3 Na','',['食酢の主成分のカルボン酸','CH₃CO–をもつのにヨードホルム反応を示さない','純粋なものは冬に凍るので氷酢酸とよばれる']),
  C('AcOEt','酢酸エチル','CH3COOC2H5',{CH3:1,COO:1,C2H5:1},'エステル',1,'','',['酢酸とエタノールから得られるエステル。果実のような香り','NaOH水溶液と加熱するとけん化され、酢酸ナトリウムとエタノールになる'],{},ESTER_I2),
  C('Et2O','ジエチルエーテル','C2H5OC2H5',{C2H5:2,O:1},'エーテル',1,'','',['エタノールを濃硫酸と130℃で加熱すると得られる（分子間脱水）','揮発性・引火性が高く、かつて麻酔に使われた。Naと反応しない']),
  C('Ethylene','エチレン','CH2=CH2',{CH2CH:1,H:1},'アルケン',1,'Br2','',['エタノールを濃硫酸と160〜170℃で加熱すると得られる気体（分子内脱水）','臭素水を脱色する、果実の成熟を促す植物ホルモン']),
  C('Acetylene','アセチレン','CH≡CH',{CHC:1,H:1},'アルキン',1,'Br2','Ag',['炭化カルシウム（カーバイド）に水を加えると発生する気体','三重結合をもつ。3分子が重合するとベンゼンになる']),
  // ---- レベル2：アルコールの級数・異性体の入口 ----
  C('PrOH1','1-プロパノール','CH3CH2CH2OH',{C3H7:1,OH:1},'アルコール',2,'Na','',['第一級アルコール。酸化するとアルデヒド（プロピオンアルデヒド）になる','2-プロパノールの異性体で、ヨードホルム反応を示さない']),
  C('PrOH2','2-プロパノール','CH3CH(OH)CH3',{CH3:2,CHOH:1},'アルコール',2,'Na I2','',['第二級アルコール。酸化するとアセトンになる','ヨードホルム反応を示すC₃のアルコール']),
  C('Me2O','ジメチルエーテル','CH3OCH3',{CH3:2,O:1},'エーテル',2,'','',['エタノールと分子式が同じで、Naと反応しない','メタノールの分子間脱水で得られるエーテル']),
  C('VinylCl','塩化ビニル','CH2=CHCl',{CH2CH:1,Cl:1},'ハロゲン化物',2,'Br2','',['アセチレンにHClを付加して得られる。ポリ塩化ビニルの単量体']),
  C('Oxalic','シュウ酸','(COOH)2',{COOH:2},'カルボン酸',2,'NaHCO3 Na','Br2',['最も簡単なジカルボン酸。KMnO₄の酸化還元滴定で還元剤として使う']),
  // ---- レベル3：芳香族 ----
  C('Benzene','ベンゼン','C6H6',{C6H5:1,H:1},'芳香族炭化水素',3,'','',['付加反応より置換反応を起こしやすい芳香族炭化水素','アセチレン3分子の重合で得られる']),
  C('Toluene','トルエン','C6H5CH3',{C6H5:1,CH3:1},'芳香族炭化水素',3,'','',['KMnO₄で酸化すると安息香酸になる芳香族炭化水素']),
  C('Styrene','スチレン','C6H5CH=CH2',{C6H5:1,CH2CH:1},'芳香族炭化水素',3,'Br2','',['ポリスチレンの単量体。臭素水を脱色する芳香族化合物']),
  C('Phenol','フェノール','C6H5OH',{C6H5:1,OH:1},'フェノール類',3,'FeCl3 Na Br2','',['FeCl₃水溶液で紫色に呈色する。炭酸より弱い酸','クメン法でアセトンとともに得られる','NaHCO₃とは反応しないが、NaOH水溶液には溶ける'],{Br2:'白色沈殿（2,4,6-トリブロモフェノール）'}),
  C('Cresol','o-クレゾール','o-C6H4(CH3)OH',{oC6H4:1,CH3:1,OH:1},'フェノール類',3,'FeCl3 Na','Br2',['トルエンのベンゼン環のHを1つ（オルト位）OHに置き換えた構造。FeCl₃で呈色する','消毒薬に使われるフェノール類（o-・m-・p-の異性体がある）']),
  C('Benzoic','安息香酸','C6H5COOH',{C6H5:1,COOH:1},'芳香族カルボン酸',3,'NaHCO3 Na','',['トルエンをKMnO₄で酸化して得られる芳香族カルボン酸','NaHCO₃水溶液にCO₂を出して溶けるが、FeCl₃では呈色しない']),
  C('Salicylic','サリチル酸','o-C6H4(OH)COOH',{oC6H4:1,OH:1,COOH:1},'芳香族カルボン酸',3,'FeCl3 NaHCO3 Na','Br2',['ナトリウムフェノキシドにCO₂を高温高圧で反応させ（コルベ・シュミット反応）、酸で処理すると得られる','FeCl₃で呈色し、NaHCO₃でCO₂も発生させる']),
  C('MeSal','サリチル酸メチル','o-C6H4(OH)COOCH3',{oC6H4:1,OH:1,COO:1,CH3:1},'エステル',3,'FeCl3 Na','Br2',['サリチル酸とメタノールのエステル。湿布薬（消炎鎮痛剤）に使う','FeCl₃で呈色するが、NaHCO₃とは反応しない'],{},ESTER_I2),
  C('Aspirin','アセチルサリチル酸','o-C6H4(OCOCH3)COOH',{oC6H4:1,COOH:1,COO:1,CH3:1},'エステル',3,'NaHCO3 Na','Br2 I2',['サリチル酸を無水酢酸でアセチル化した解熱鎮痛剤','NaHCO₃でCO₂を出すが、FeCl₃では呈色しない']),
  C('Nitrobenzene','ニトロベンゼン','C6H5NO2',{C6H5:1,NO2:1},'ニトロ化合物',3,'','',['ベンゼンを濃硝酸と濃硫酸（混酸）でニトロ化して得られる淡黄色の油状物質','スズと塩酸で還元するとアニリンになる']),
  C('Aniline','アニリン','C6H5NH2',{C6H5:1,NH2:1},'芳香族アミン',3,'CaClO','Br2 Na',['ニトロベンゼンをスズと塩酸で還元し、塩基で処理すると得られる','さらし粉水溶液で赤紫色に呈色する芳香族アミン']),
  C('Acetanilide','アセトアニリド','C6H5NHCOCH3',{C6H5:1,NHCO:1,CH3:1},'アミド',3,'','Br2 I2 Na',['アニリンを無水酢酸でアセチル化して得られるアミド','かつて解熱剤に使われた。さらし粉で呈色しない']),
  C('BSA','ベンゼンスルホン酸','C6H5SO3H',{C6H5:1,SO3H:1},'スルホン酸',3,'NaHCO3 Na','',['ベンゼンを濃硫酸でスルホン化して得られる強い酸']),
  C('ClBenzene','クロロベンゼン','C6H5Cl',{C6H5:1,Cl:1},'ハロゲン化物',3,'','',['鉄（または塩化鉄(III)）を触媒にして、ベンゼンと塩素を反応させて得られる']),
  // ---- レベル4：異性体・位置・シス-トランス ----
  C('Phthalic','フタル酸','o-C6H4(COOH)2',{oC6H4:1,COOH:2},'芳香族カルボン酸',4,'NaHCO3 Na','',['o-キシレン（またはナフタレン）の酸化で得られ、加熱すると酸無水物になる']),
  C('Isophthalic','イソフタル酸','m-C6H4(COOH)2',{mC6H4:1,COOH:2},'芳香族カルボン酸',4,'NaHCO3 Na','',['m-キシレンの酸化で得られるジカルボン酸']),
  C('Terephthalic','テレフタル酸','p-C6H4(COOH)2',{pC6H4:1,COOH:2},'芳香族カルボン酸',4,'NaHCO3 Na','',['p-キシレンの酸化で得られ、エチレングリコールと縮合重合してPETになる']),
  C('oXylene','o-キシレン','o-C6H4(CH3)2',{oC6H4:1,CH3:2},'芳香族炭化水素',4,'','',['酸化するとフタル酸になる芳香族炭化水素']),
  C('mXylene','m-キシレン','m-C6H4(CH3)2',{mC6H4:1,CH3:2},'芳香族炭化水素',4,'','',['酸化するとイソフタル酸になる芳香族炭化水素']),
  C('pXylene','p-キシレン','p-C6H4(CH3)2',{pC6H4:1,CH3:2},'芳香族炭化水素',4,'','',['酸化するとテレフタル酸になる芳香族炭化水素']),
  C('Maleic','マレイン酸','HOOC-CH=CH-COOH（シス）',{cisCHCH:1,COOH:2},'カルボン酸',4,'NaHCO3 Na','Br2',['加熱すると分子内で脱水して酸無水物になる、シス形のジカルボン酸','フマル酸のシス-トランス異性体（シス形）']),
  C('Fumaric','フマル酸','HOOC-CH=CH-COOH（トランス）',{trCHCH:1,COOH:2},'カルボン酸',4,'NaHCO3 Na','Br2',['マレイン酸のトランス異性体。加熱しても分子内で脱水しない']),
  C('Lactic','乳酸','CH3CH(OH)COOH',{CH3:1,CHOH:1,COOH:1},'カルボン酸',4,'NaHCO3 Na','I2',['不斉炭素原子をもつヒドロキシ酸。ヨーグルトや筋肉中に生じる','鏡像異性体（光学異性体）が存在するC₃のカルボン酸']),
  C('Butanol2','2-ブタノール','CH3CH(OH)C2H5',{CH3:1,CHOH:1,C2H5:1},'アルコール',4,'Na I2','',['不斉炭素原子をもち、ヨードホルム反応を示すC₄のアルコール','酸化するとエチルメチルケトンになる第二級アルコール']),
  C('MEK','エチルメチルケトン','CH3COC2H5',{CH3:1,CO:1,C2H5:1},'ケトン',4,'I2','Br2',['2-ブタノールの酸化で得られる、ヨードホルム反応を示すケトン']),
  C('Propionic','プロピオン酸','C2H5COOH',{C2H5:1,COOH:1},'カルボン酸',4,'NaHCO3 Na','',['C₃H₆O₂の異性体のうち、NaHCO₃でCO₂を出すもの']),
  C('FormEt','ギ酸エチル','HCOOC2H5',{H:1,COO:1,C2H5:1},'エステル',4,'Ag','Feh I2',['C₃H₆O₂の異性体のうち、銀鏡反応を示すエステル','ギ酸とエタノールのエステル']),
  C('AcOMe','酢酸メチル','CH3COOCH3',{CH3:2,COO:1},'エステル',4,'','',['C₃H₆O₂の異性体のうち、銀鏡反応もNaHCO₃との反応も示さないもの','酢酸とメタノールのエステル'],{},ESTER_I2),
  C('FormMe','ギ酸メチル','HCOOCH3',{H:1,COO:1,CH3:1},'エステル',4,'Ag','Feh',['酢酸と分子式が同じ（C₂H₄O₂）で、NaHCO₃とは反応しないが銀鏡反応を示す']),
  C('VinylAc','酢酸ビニル','CH3COOCH=CH2',{CH3:1,COO:1,CH2CH:1},'エステル',4,'Br2','I2 Ag Feh',['アセチレンに酢酸を付加して得られる。ポリ酢酸ビニルを経てビニロンの原料になる']),
  C('Acetophenone','アセトフェノン','C6H5COCH3',{C6H5:1,CO:1,CH3:1},'ケトン',4,'I2','Br2',['ヨードホルム反応を示す芳香族ケトン','ベンゼン環にアセチル基（CH₃CO–）が付いた構造']),
  C('Benzaldehyde','ベンズアルデヒド','C6H5CHO',{C6H5:1,CHO:1},'アルデヒド',4,'Ag','Feh Br2',['銀鏡反応を示す芳香族アルデヒド。空気中で酸化されて安息香酸になる']),
];
const DB=RAW;
const BYID={};DB.forEach(d=>BYID[d.id]=d);
// 部品の組み合わせ（多重集合）を文字列キーにする
const keyOf=m=>Object.keys(m).filter(k=>m[k]>0).sort().map(k=>k+'*'+m[k]).join(',');
const itemsMap=items=>{const m={};(items||[]).forEach(([k,n])=>{if(PART[k])m[k]=(m[k]||0)+n;});return m;};
DB.forEach(d=>{d.key=keyOf(d.parts);d.np=Object.values(d.parts).reduce((a,b)=>a+b,0);d.atoms=atomsOf(d.parts);d.mf=hill(parseFormula(d.f.replace(/（.*）/,'')));});
const BYKEY={};DB.forEach(d=>{BYKEY[d.key]=d;});
function atomsOf(parts){const m={};for(const k in parts)for(const [e,n] of Object.entries(PART[k].a))m[e]=(m[e]||0)+n*parts[k];return m;}
function hill(m){
  const ks=Object.keys(m).filter(k=>m[k]>0);
  const order=m.C?['C'].concat(m.H?['H']:[],ks.filter(k=>k!=='C'&&k!=='H').sort()):ks.sort();
  return order.map(k=>k+(m[k]>1?m[k]:'')).join('');
}
// 試薬 t に対する結果：'+'（陽性）／'-'（変化なし）／'?'（判定に使わない）
function result(id,t){const d=BYID[id];if(!d)return '?';if(d.unk.includes(t))return '?';return d.pos.includes(t)?'+':'-';}
function resultText(id,t){const r=result(id,t),d=BYID[id];return r==='+'?(d.tx[t]||TEST[t].pos):r==='-'?'変化なし':'判定に使わない';}

/* ================= 見分けの注文（2つの化合物を検出試薬で区別する） ================= */
const T=(a,b,lv)=>({id:`T:${a}/${b}`,a,b,lv});
const PAIRS=[
  // 脂肪族
  T('EtOH','Et2O',2),T('MeOH','EtOH',2),T('PrOH1','PrOH2',2),T('MeCHO','Acetone',2),T('HCHO','MeCHO',2),
  T('HCOOH','AcOH',2),T('AcOH','EtOH',2),T('AcOH','AcOEt',2),T('EtOH','MeCHO',2),
  // 芳香族
  T('Phenol','Benzoic',3),T('Phenol','Benzene',3),T('Salicylic','Aspirin',3),T('Salicylic','MeSal',3),T('MeSal','Aspirin',3),
  T('Aniline','Nitrobenzene',3),T('Aniline','Phenol',3),T('Benzene','Styrene',3),T('Aniline','Acetanilide',3),T('Toluene','Benzoic',3),
  // 異性体・ひっかけ
  T('Propionic','FormEt',4),T('AcOMe','FormEt',4),T('Acetone','PrOH2',4),T('AcOH','FormMe',4),T('Butanol2','MEK',4),
  T('EtOH','Me2O',4),T('Acetophenone','Benzaldehyde',4),T('Benzaldehyde','Benzoic',4),
];
const PAIR={};PAIRS.forEach(p=>{p.ok=TIDS.filter(t=>{const x=result(p.a,t),y=result(p.b,t);return x!=='?'&&y!=='?'&&x!==y;});PAIR[p.id]=p;});
const isPair=k=>typeof k==='string'&&k.startsWith('T:');

/* ================= ステージ（基礎→京大） ================= */
const ids=f=>DB.filter(f).map(d=>d.id);
const pairs=f=>PAIRS.filter(f).map(p=>p.id);
const STAGES=[
  {id:'s1',lvl:'基礎',name:'官能基入門',desc:'アルコール・アルデヒド・ケトン・カルボン酸・エステル・エーテル。名前を見て部品で組む',
    pool:ids(d=>d.lv===1),clue:'name',fb:2,time:150,spawn:14,max:3,life:1.2,stars:[150,300,450]},
  {id:'s2',lvl:'基礎＋',name:'検出反応ラボ',desc:'銀鏡・ヨードホルム・NaHCO₃・Na で2つを見分ける注文が入る。性質だけの注文も',
    pool:ids(d=>d.lv<=2).concat(pairs(p=>p.lv===2)),clue:'mix',fb:2,time:150,spawn:14,max:3,life:1.15,stars:[160,320,480]},
  {id:'s3',lvl:'標準',name:'芳香族の店',desc:'フェノール類・サリチル酸の仲間・アニリン。FeCl₃とさらし粉が加わる。VIP客あり',
    pool:ids(d=>d.lv===3).concat(pairs(p=>p.lv===3)),clue:'mix',fb:1,time:150,spawn:14,max:4,life:1.1,vip:true,stars:[180,360,540]},
  {id:'s4',lvl:'応用',name:'異性体の迷宮',desc:'o-/m-/p-、シス-トランス、C₃H₆O₂の異性体、ヨードホルムのひっかけ',
    pool:ids(d=>d.lv===4).concat(pairs(p=>p.lv===4)),clue:'mix',fb:1,time:165,spawn:15,max:4,life:1.05,vip:true,stars:[180,360,540]},
  {id:'s5',lvl:'京大',name:'京大ラッシュ（有機）',desc:'全範囲・性質のみの注文。失敗の理由は出ない。停電・延焼あり',
    pool:ids(()=>true).concat(pairs(()=>true)),clue:'prop',fb:0,time:180,spawn:12,max:4,life:1.0,vip:true,blackout:true,spread:true,stars:[200,420,640]},
];
const REVIEW={id:'rv',name:'苦手克服ラン',desc:'習熟度の低い化合物・見分けだけを集中注文',pool:'review',clue:'mix',fb:1,time:120,spawn:12,max:4,life:1.1,stars:null};
const ALL=DB.map(d=>d.id).concat(PAIRS.map(p=>p.id));

/* ================= 判定 ================= */
const known=k=>!!BYID[k]||!!PAIR[k];
function tgt(k){
  if(isPair(k)){const p=PAIR[k];return {n:`${BYID[p.a].n}と${BYID[p.b].n}`,f:'',proc:null,group:k,pair:true};}
  const d=BYID[k];return {n:d.n,f:d.f,proc:null,group:k};
}
// 注文ごとに入れられる物：組み立ての注文は部品だけ、見分けの注文は検出試薬だけ
function accept(k,item){
  if(isPair(k))return item[0]==='@'?'':'この注文は検出試薬（棚の最下段）を1つ選ぶ';
  return item[0]==='@'?'検出試薬は「見分け」の注文で使う':'';
}
const exact=(k,items)=>!isPair(k)&&!!BYID[k]&&keyOf(itemsMap(items))===BYID[k].key;
// 組み立ての判定。ok / wrong（別の化合物ができた）/ fail（そんな化合物は無い）。fail の理由は lv が小さいほど一般的
function judgeBuild(k,items){
  const d=BYID[k],m=itemsMap(items),key=keyOf(m);
  if(key===d.key)return {ok:true};
  const other=BYKEY[key];
  if(other)return {wrong:other};
  const need=d.parts;
  const diff={};for(const x of new Set([...Object.keys(need),...Object.keys(m)]))diff[x]=(m[x]||0)-(need[x]||0);
  const miss=Object.keys(diff).filter(x=>diff[x]<0),extra=Object.keys(diff).filter(x=>diff[x]>0);
  const ring=x=>/C6H4$/.test(x),cis=x=>/CHCH$/.test(x);
  if(miss.length===1&&extra.length===1&&diff[miss[0]]===-1&&diff[extra[0]]===1){
    if(ring(miss[0])&&ring(extra[0]))return {why:'置換基の位置（o-・m-・p-）が違う',lv:1};
    if(cis(miss[0])&&cis(extra[0]))return {why:'シス形とトランス形が違う',lv:1};
  }
  const nm=x=>PART[x].label;
  if(!extra.length)return {why:`部品が足りない（${miss.map(nm).join('・')}）`,lv:2,generic:'部品が足りない'};
  if(!miss.length)return {why:`余計な部品がある（${extra.map(nm).join('・')}）`,lv:2,generic:'余計な部品がある'};
  return {why:`${extra.map(nm).join('・')} ではなく ${miss.map(nm).join('・')}`,lv:2,generic:'部品の組み合わせが違う'};
}
// 見分けの判定：選んだ試薬で2つの結果が分かれれば正解
function judgePair(k,t){
  const p=PAIR[k];if(!p||!TEST[t])return {ok:false,why:'試薬を選ぶ'};
  const x=result(p.a,t),y=result(p.b,t);
  const line=`${BYID[p.a].n}：${resultText(p.a,t)}／${BYID[p.b].n}：${resultText(p.b,t)}`;
  if(p.ok.includes(t))return {ok:true,line};
  if(x==='?'||y==='?')return {ok:false,line,why:`${TEST[t].label}では確実に区別できない`};
  return {ok:false,line,why:x==='+'?`${TEST[t].label}ではどちらも陽性`:`${TEST[t].label}ではどちらも変化なし`};
}
const answerText=k=>isPair(k)?PAIR[k].ok.map(t=>TEST[t].label).join('・'):fmt(BYID[k].f);
// ヒント：名前の注文は 分類→示性式、性質の注文は 名前→示性式、見分けは 着目点→試薬
function hint(k,level,mode){
  if(isPair(k)){const p=PAIR[k],t=TEST[p.ok[0]];return level===1?`注目：${t.det}の有無`:`試薬：${p.ok.map(x=>TEST[x].label).join('・')}`;}
  const d=BYID[k];
  if(level===1)return mode==='name'?`分類：${d.k}（${Object.keys(d.parts).filter(x=>PART[x].side==='fg').map(x=>PART[x].name).join('・')||'官能基なし'}）`:d.n;
  return fmt(d.f);
}
const label=k=>k[0]==='@'?(TEST[k.slice(1)]||{label:k}).label:(PART[k]||{label:k}).label;
const cellName=k=>k[0]==='@'?(TEST[k.slice(1)]||{name:k}).name:(PART[k]||{name:k}).name;

export {PARTS,PART,SK,FG,TESTS,TEST,TIDS,DB,BYID,BYKEY,PAIRS,PAIR,STAGES,REVIEW,ALL,
  keyOf,itemsMap,atomsOf,hill,result,resultText,isPair,known,tgt,accept,exact,judgeBuild,judgePair,answerText,hint,label,cellName};
