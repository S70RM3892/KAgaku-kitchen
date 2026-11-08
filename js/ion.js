// 無機イオンモードのデータ：陽イオンと陰イオンを組んで酸・塩基・塩・酸化物・沈殿・酸化剤／還元剤を作る。
// 中心の金属イオンと配位子で錯イオンを組む。酸化還元の半反応式は e⁻・H⁺・H₂O（・OH⁻）の数を合わせる。
// 反応式・組成・官能基モードとは別のデータ。判定もここで行い、エンジンは RULES.ion から呼ぶだけ
import {parseFormula,fmt} from './data.js';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SUP={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻'};
const chargeText=q=>q===0?'':(Math.abs(q)>1?String(Math.abs(q)):'')+(q>0?'+':'-');
const supText=q=>[...chargeText(q)].map(c=>SUP[c]).join('');
// 化学式（ASCII）＋電荷 → 表示用HTML
const show=(f,q=0)=>fmt(f)+(q?`<sup>${chargeText(q)}</sup>`:'');

/* ================= 棚（イオン・配位子・半反応式の部品） ================= */
// side: cat（陽イオン）/ an（陰イオン）/ sp（配位子・半反応式用）。a: 原子、q: 電荷、dec: 酸性塩のイオンを H⁺ と分けて比べるため
const P=(id,label,name,side,q,a,dec)=>({id,label,name,side,q,a,dec});
const PARTS=[
  // 陽イオン（左の棚）
  P('H','H⁺','水素イオン','cat',1,{H:1}),
  P('Li','Li⁺','リチウムイオン','cat',1,{Li:1}),
  P('Na','Na⁺','ナトリウムイオン','cat',1,{Na:1}),
  P('K','K⁺','カリウムイオン','cat',1,{K:1}),
  P('NH4','NH₄⁺','アンモニウムイオン','cat',1,{N:1,H:4}),
  P('Ag','Ag⁺','銀イオン','cat',1,{Ag:1}),
  P('Cu1','Cu⁺','銅(I)イオン','cat',1,{Cu:1}),
  P('Mg','Mg²⁺','マグネシウムイオン','cat',2,{Mg:1}),
  P('Ca','Ca²⁺','カルシウムイオン','cat',2,{Ca:1}),
  P('Ba','Ba²⁺','バリウムイオン','cat',2,{Ba:1}),
  P('Zn','Zn²⁺','亜鉛イオン','cat',2,{Zn:1}),
  P('Cu2','Cu²⁺','銅(II)イオン','cat',2,{Cu:1}),
  P('Fe2','Fe²⁺','鉄(II)イオン','cat',2,{Fe:1}),
  P('Fe3','Fe³⁺','鉄(III)イオン','cat',3,{Fe:1}),
  P('Al','Al³⁺','アルミニウムイオン','cat',3,{Al:1}),
  P('Pb','Pb²⁺','鉛(II)イオン','cat',2,{Pb:1}),
  P('Sn','Sn²⁺','スズ(II)イオン','cat',2,{Sn:1}),
  P('Mn','Mn²⁺','マンガン(II)イオン','cat',2,{Mn:1}),
  P('Ni','Ni²⁺','ニッケル(II)イオン','cat',2,{Ni:1}),
  P('Cr','Cr³⁺','クロム(III)イオン','cat',3,{Cr:1}),
  // 配位子・半反応式用（左の最下段）
  P('NH3','NH₃','アンモニア（配位子）','sp',0,{N:1,H:3}),
  P('CN','CN⁻','シアン化物イオン（配位子）','sp',-1,{C:1,N:1}),
  P('H2O','H₂O','水（半反応式）','sp',0,{H:2,O:1}),
  P('e','e⁻','電子（半反応式）','sp',-1,{}),
  // 陰イオン（右の棚）
  P('OH','OH⁻','水酸化物イオン','an',-1,{O:1,H:1}),
  P('O','O²⁻','酸化物イオン','an',-2,{O:1}),
  P('F','F⁻','フッ化物イオン','an',-1,{F:1}),
  P('Cl','Cl⁻','塩化物イオン','an',-1,{Cl:1}),
  P('Br','Br⁻','臭化物イオン','an',-1,{Br:1}),
  P('I','I⁻','ヨウ化物イオン','an',-1,{I:1}),
  P('NO3','NO₃⁻','硝酸イオン','an',-1,{N:1,O:3}),
  P('SO4','SO₄²⁻','硫酸イオン','an',-2,{S:1,O:4}),
  P('HSO4','HSO₄⁻','硫酸水素イオン','an',-1,{H:1,S:1,O:4},{H:1,SO4:1}),
  P('SO3','SO₃²⁻','亜硫酸イオン','an',-2,{S:1,O:3}),
  P('S','S²⁻','硫化物イオン','an',-2,{S:1}),
  P('S2O3','S₂O₃²⁻','チオ硫酸イオン','an',-2,{S:2,O:3}),
  P('CO3','CO₃²⁻','炭酸イオン','an',-2,{C:1,O:3}),
  P('HCO3','HCO₃⁻','炭酸水素イオン','an',-1,{H:1,C:1,O:3},{H:1,CO3:1}),
  P('PO4','PO₄³⁻','リン酸イオン','an',-3,{P:1,O:4}),
  P('HPO4','HPO₄²⁻','リン酸水素イオン','an',-2,{H:1,P:1,O:4},{H:1,PO4:1}),
  P('H2PO4','H₂PO₄⁻','リン酸二水素イオン','an',-1,{H:2,P:1,O:4},{H:2,PO4:1}),
  P('AcO','CH₃COO⁻','酢酸イオン','an',-1,{C:2,H:3,O:2}),
  P('C2O4','C₂O₄²⁻','シュウ酸イオン','an',-2,{C:2,O:4}),
  P('ClO3','ClO₃⁻','塩素酸イオン','an',-1,{Cl:1,O:3}),
  // 酸化剤のイオン（右の最下段）
  P('MnO4','MnO₄⁻','過マンガン酸イオン','an',-1,{Mn:1,O:4}),
  P('Cr2O7','Cr₂O₇²⁻','二クロム酸イオン','an',-2,{Cr:2,O:7}),
  P('CrO4','CrO₄²⁻','クロム酸イオン','an',-2,{Cr:1,O:4}),
  P('ClO','ClO⁻','次亜塩素酸イオン','an',-1,{Cl:1,O:1}),
];
const PART={};PARTS.forEach(p=>PART[p.id]=p);
const CATS=PARTS.filter(p=>p.side==='cat').map(p=>p.id);
const SPS=PARTS.filter(p=>p.side==='sp').map(p=>p.id);
const ANS=PARTS.filter(p=>p.side==='an').map(p=>p.id);
// 棚の並び：左＝陽イオン20＋配位子・半反応式4、右＝陰イオン20＋酸化剤のイオン4
const SHELF={
  L:{cap:'陽イオン：タップで選んだ客の鍋へ',main:CATS,cap2:'配位子・半反応式',bottom:SPS},
  R:{cap:'',main:ANS.slice(0,20),cap2:'酸化剤のイオン',bottom:ANS.slice(20)},
};
const HALF_PARTS=['e','H','H2O','OH'];       // 半反応式の注文で使う部品

/* ================= 物質・錯イオン ================= */
// [id, 名前, 化学式(ASCII), 電荷, イオン, 分類, レベル(1〜4), 性質ヒント, 配位数（錯イオン）]
const C=(id,n,f,q,parts,k,lv,p,cn=0)=>({id,n,f,q,parts,k,lv,p,cn});
const RAW=[
  // ---- レベル1：イオン式・組成式の基本 ----
  C('NaCl','塩化ナトリウム','NaCl',0,{Na:1,Cl:1},'塩',1,['食塩の主成分。Na⁺とCl⁻が1:1で結びつく','水溶液を電気分解すると陽極でCl₂、陰極でH₂が生じる（陽イオン交換膜法）']),
  C('KNO3','硝酸カリウム','KNO3',0,{K:1,NO3:1},'塩',1,['黒色火薬の成分。強酸と強塩基からなる正塩']),
  C('CaCl2','塩化カルシウム','CaCl2',0,{Ca:1,Cl:2},'塩',1,['乾燥剤に使う（ただしNH₃の乾燥には使えない）','アンモニアソーダ法の副生成物']),
  C('MgCl2','塩化マグネシウム','MgCl2',0,{Mg:1,Cl:2},'塩',1,['にがりの主成分']),
  C('AlCl3','塩化アルミニウム','AlCl3',0,{Al:1,Cl:3},'塩',1,['Al³⁺1個にCl⁻3個で電荷がつり合う塩化物']),
  C('Na2SO4','硫酸ナトリウム','Na2SO4',0,{Na:2,SO4:1},'塩',1,['強酸と強塩基の正塩。水溶液は中性','Na⁺2個とSO₄²⁻1個で電荷がつり合う']),
  C('CuSO4','硫酸銅(II)','CuSO4',0,{Cu2:1,SO4:1},'塩',1,['水溶液は青色。無水物は白色で、水を吸うと青くなる']),
  C('Al2SO43','硫酸アルミニウム','Al2(SO4)3',0,{Al:2,SO4:3},'塩',1,['Al³⁺2個とSO₄²⁻3個で電荷がつり合う','ミョウバンの成分の一つ']),
  C('CaCO3','炭酸カルシウム','CaCO3',0,{Ca:1,CO3:1},'塩',1,['石灰石・大理石の主成分','石灰水にCO₂を通すと生じる白色沈殿']),
  C('NaOH','水酸化ナトリウム','NaOH',0,{Na:1,OH:1},'塩基',1,['潮解性のある一価の強塩基','NaCl水溶液の電気分解（陽イオン交換膜法）で作られる']),
  C('CaOH2','水酸化カルシウム','Ca(OH)2',0,{Ca:1,OH:2},'塩基',1,['消石灰。飽和水溶液が石灰水','二価の強塩基']),
  C('HCl','塩化水素（塩酸）','HCl',0,{H:1,Cl:1},'酸',1,['水溶液は塩酸。代表的な一価の強酸']),
  C('HNO3','硝酸','HNO3',0,{H:1,NO3:1},'酸',1,['一価の強酸で、強い酸化力をもつ','オストワルト法で作られる']),
  C('H2SO4','硫酸','H2SO4',0,{H:2,SO4:1},'酸',1,['二価の強酸。熱濃硫酸は酸化力、濃硫酸は脱水作用・吸湿性をもつ','接触法で作られる']),
  C('NH4Cl','塩化アンモニウム','NH4Cl',0,{NH4:1,Cl:1},'塩',1,['水酸化カルシウムと混ぜて加熱するとNH₃が発生する','強酸と弱塩基の塩。水溶液は弱酸性']),
  C('AgNO3','硝酸銀','AgNO3',0,{Ag:1,NO3:1},'塩',1,['水溶液にCl⁻を加えると白色沈殿を生じる。感光性がある']),
  C('MgO','酸化マグネシウム','MgO',0,{Mg:1,O:1},'酸化物',1,['マグネシウムの燃焼で生じる白色の塩基性酸化物']),
  C('CaO','酸化カルシウム','CaO',0,{Ca:1,O:1},'酸化物',1,['生石灰。水と反応して発熱し、水酸化カルシウムになる']),
  C('Na2O','酸化ナトリウム','Na2O',0,{Na:2,O:1},'酸化物',1,['水と反応してNaOHになる塩基性酸化物']),
  C('Al2O3','酸化アルミニウム','Al2O3',0,{Al:2,O:3},'酸化物',1,['ボーキサイトから得られ、氷晶石とともに融解塩電解してAlを得る原料','酸にも強塩基にも溶ける両性酸化物']),
  C('Fe2O3','酸化鉄(III)','Fe2O3',0,{Fe3:2,O:3},'酸化物',1,['赤さびの主成分。赤褐色','溶鉱炉でCOにより還元される鉄鉱石（赤鉄鉱）の主成分']),
  C('CuO','酸化銅(II)','CuO',0,{Cu2:1,O:1},'酸化物',1,['銅を空気中で加熱すると生じる黒色の酸化物']),
  // ---- レベル2：酸・塩基・塩（電離・中和・加水分解・緩衝液） ----
  C('AcOH','酢酸','CH3COOH',0,{H:1,AcO:1},'酸',2,['電離度が小さい一価の弱酸','酢酸ナトリウムと混ぜると緩衝液になる弱酸']),
  C('H3PO4','リン酸','H3PO4',0,{H:3,PO4:1},'酸',2,['3段階で電離する三価の酸（中程度の強さ）','十酸化四リンを水に溶かすと得られる']),
  C('H2CO3','炭酸','H2CO3',0,{H:2,CO3:1},'酸',2,['CO₂が水に溶けて生じる二価の弱酸']),
  C('H2S','硫化水素','H2S',0,{H:2,S:1},'酸',2,['水溶液は二価の弱酸。腐卵臭のある有毒な気体','還元剤として働き、自身は硫黄になる']),
  C('H2C2O4','シュウ酸','H2C2O4',0,{H:2,C2O4:1},'酸',2,['二価の弱酸。二水和物を量り取って、中和滴定の標準溶液をつくる','KMnO₄と反応してCO₂になる還元剤']),
  C('HF','フッ化水素','HF',0,{H:1,F:1},'酸',2,['ハロゲン化水素で唯一の弱酸。ガラス（SiO₂）を溶かす']),
  C('KOH','水酸化カリウム','KOH',0,{K:1,OH:1},'塩基',2,['一価の強塩基。潮解性がありCO₂も吸収する']),
  C('BaOH2','水酸化バリウム','Ba(OH)2',0,{Ba:1,OH:2},'塩基',2,['二価の強塩基。CO₂を吸収するとBaCO₃が沈殿する']),
  C('AcONa','酢酸ナトリウム','CH3COONa',0,{Na:1,AcO:1},'塩',2,['弱酸と強塩基の塩。水溶液は加水分解で弱塩基性','酢酸と混ぜると緩衝液になる塩']),
  C('Na2CO3','炭酸ナトリウム','Na2CO3',0,{Na:2,CO3:1},'塩',2,['塩酸で滴定すると2段階で中和される（フェノールフタレインとメチルオレンジで2つの終点）','アンモニアソーダ法で作られる']),
  C('NaHCO3','炭酸水素ナトリウム','NaHCO3',0,{Na:1,HCO3:1},'塩',2,['重曹。加熱するとCO₂を出して炭酸ナトリウムになる酸性塩','炭酸ナトリウムを塩酸で滴定したとき、第一中和点で生じる塩']),
  C('NaHSO4','硫酸水素ナトリウム','NaHSO4',0,{Na:1,HSO4:1},'塩',2,['水溶液が酸性を示す酸性塩']),
  C('NaH2PO4','リン酸二水素ナトリウム','NaH2PO4',0,{Na:1,H2PO4:1},'塩',2,['リン酸をNaOHで1段階だけ中和した酸性塩']),
  C('Na2HPO4','リン酸水素二ナトリウム','Na2HPO4',0,{Na:2,HPO4:1},'塩',2,['リン酸をNaOHで2段階まで中和した塩。NaH₂PO₄と混ぜると緩衝液']),
  C('Na3PO4','リン酸ナトリウム','Na3PO4',0,{Na:3,PO4:1},'塩',2,['リン酸を完全に中和した正塩。水溶液は塩基性']),
  C('NH42SO4','硫酸アンモニウム','(NH4)2SO4',0,{NH4:2,SO4:1},'塩',2,['硫安。窒素肥料。水溶液は弱酸性']),
  C('NH4NO3','硝酸アンモニウム','NH4NO3',0,{NH4:1,NO3:1},'塩',2,['水に溶かすと吸熱する（冷却パック）。窒素肥料']),
  C('AcONH4','酢酸アンモニウム','CH3COONH4',0,{NH4:1,AcO:1},'塩',2,['弱酸と弱塩基の塩。水溶液はほぼ中性']),
  // ---- レベル3：酸化剤・還元剤 ----
  C('KMnO4','過マンガン酸カリウム','KMnO4',0,{K:1,MnO4:1},'酸化剤',3,['赤紫色の酸化剤。硫酸酸性ではMn²⁺になり色が消える','滴定で自身が指示薬になる酸化剤（COD測定にも使う）']),
  C('K2Cr2O7','二クロム酸カリウム','K2Cr2O7',0,{K:2,Cr2O7:1},'酸化剤',3,['赤橙色の酸化剤。硫酸酸性でCr³⁺（緑色）になる']),
  C('K2CrO4','クロム酸カリウム','K2CrO4',0,{K:2,CrO4:1},'塩',3,['黄色。酸性にすると二クロム酸イオン（赤橙色）に変わる','モール法（Cl⁻の沈殿滴定）の指示薬']),
  C('KClO3','塩素酸カリウム','KClO3',0,{K:1,ClO3:1},'酸化剤',3,['MnO₂を触媒にして加熱するとO₂が発生する']),
  C('NaClO','次亜塩素酸ナトリウム','NaClO',0,{Na:1,ClO:1},'酸化剤',3,['塩素系漂白剤の主成分。酸化作用で漂白・殺菌する']),
  C('CaClO2','次亜塩素酸カルシウム','Ca(ClO)2',0,{Ca:1,ClO:2},'酸化剤',3,['高度さらし粉の主成分。塩酸を加えるとCl₂が発生する']),
  C('KI','ヨウ化カリウム','KI',0,{K:1,I:1},'還元剤',3,['酸化剤と反応してI₂を生じる（ヨウ素滴定の前段）','I₂を溶かして三ヨウ化物イオンをつくる']),
  C('Na2S2O3','チオ硫酸ナトリウム','Na2S2O3',0,{Na:2,S2O3:1},'還元剤',3,['ヨウ素滴定でI₂を還元する（デンプンの青紫色が消えたら終点）','写真の定着液。AgBrを錯イオンにして溶かす']),
  C('Na2SO3','亜硫酸ナトリウム','Na2SO3',0,{Na:2,SO3:1},'還元剤',3,['希硫酸を加えるとSO₂が発生する還元剤']),
  C('SnCl2','塩化スズ(II)','SnCl2',0,{Sn:1,Cl:2},'還元剤',3,['還元剤。Sn²⁺はSn⁴⁺になりやすい（ニトロベンゼンの還元にも使うスズの塩）']),
  C('FeSO4','硫酸鉄(II)','FeSO4',0,{Fe2:1,SO4:1},'還元剤',3,['淡緑色の水溶液。還元剤として働きFe³⁺になる']),
  C('Fe2SO43','硫酸鉄(III)','Fe2(SO4)3',0,{Fe3:2,SO4:3},'塩',3,['Fe³⁺を含む黄褐色の水溶液をつくる硫酸塩']),
  C('FeCl3','塩化鉄(III)','FeCl3',0,{Fe3:1,Cl:3},'塩',3,['黄褐色の水溶液。フェノール類の呈色に使う','沸騰水に加えると水酸化鉄(III)のコロイドになる']),
  C('Na2C2O4','シュウ酸ナトリウム','Na2C2O4',0,{Na:2,C2O4:1},'還元剤',3,['KMnO₄水溶液の濃度を決める標準物質（還元剤）']),
  C('MnSO4','硫酸マンガン(II)','MnSO4',0,{Mn:1,SO4:1},'塩',3,['KMnO₄が硫酸酸性で還元されたときに生じる塩。水溶液はほぼ無色']),
  C('Cr2SO43','硫酸クロム(III)','Cr2(SO4)3',0,{Cr:2,SO4:3},'塩',3,['二クロム酸カリウムが硫酸酸性で還元されたときに生じる緑色の塩']),
  // ---- レベル4：沈殿・錯イオン ----
  C('AgCl','塩化銀','AgCl',0,{Ag:1,Cl:1},'沈殿',4,['Ag⁺とCl⁻で生じる白色沈殿。光で分解し、アンモニア水に溶ける','モール法の滴定中に生じる白色沈殿']),
  C('AgBr','臭化銀','AgBr',0,{Ag:1,Br:1},'沈殿',4,['淡黄色の沈殿。写真の感光剤']),
  C('AgI','ヨウ化銀','AgI',0,{Ag:1,I:1},'沈殿',4,['黄色の沈殿。アンモニア水にほとんど溶けない']),
  C('Ag2O','酸化銀','Ag2O',0,{Ag:2,O:1},'沈殿',4,['Ag⁺に少量のNaOH水溶液やアンモニア水を加えると生じる褐色沈殿']),
  C('Ag2CrO4','クロム酸銀','Ag2CrO4',0,{Ag:2,CrO4:1},'沈殿',4,['モール法の終点で生じる赤褐色の沈殿']),
  C('Ag2S','硫化銀','Ag2S',0,{Ag:2,S:1},'沈殿',4,['Ag⁺にH₂Sを通じると生じる黒色沈殿']),
  C('PbCl2','塩化鉛(II)','PbCl2',0,{Pb:1,Cl:2},'沈殿',4,['熱水に溶ける白色沈殿（AgClとの区別に使う）']),
  C('PbI2','ヨウ化鉛(II)','PbI2',0,{Pb:1,I:2},'沈殿',4,['Pb²⁺とI⁻で生じる黄色沈殿']),
  C('PbSO4','硫酸鉛(II)','PbSO4',0,{Pb:1,SO4:1},'沈殿',4,['鉛蓄電池の放電で両極に生じる白色の物質']),
  C('PbCrO4','クロム酸鉛(II)','PbCrO4',0,{Pb:1,CrO4:1},'沈殿',4,['Pb²⁺の検出に使う黄色沈殿']),
  C('PbS','硫化鉛(II)','PbS',0,{Pb:1,S:1},'沈殿',4,['酢酸鉛(II)紙がH₂Sで黒くなるときに生じる黒色の硫化物']),
  C('BaSO4','硫酸バリウム','BaSO4',0,{Ba:1,SO4:1},'沈殿',4,['酸にも溶けない白色沈殿。X線造影剤に使う']),
  C('BaCO3','炭酸バリウム','BaCO3',0,{Ba:1,CO3:1},'沈殿',4,['Ba²⁺とCO₃²⁻の白色沈殿。塩酸にはCO₂を出して溶ける']),
  C('CaC2O4','シュウ酸カルシウム','CaC2O4',0,{Ca:1,C2O4:1},'沈殿',4,['Ca²⁺の検出に使う白色沈殿']),
  C('CaF2','フッ化カルシウム','CaF2',0,{Ca:1,F:2},'沈殿',4,['蛍石の主成分。濃硫酸を加えて加熱するとHFが発生する']),
  C('CuS','硫化銅(II)','CuS',0,{Cu2:1,S:1},'沈殿',4,['酸性の水溶液でもH₂Sで沈殿する黒色の硫化物']),
  C('ZnS','硫化亜鉛','ZnS',0,{Zn:1,S:1},'沈殿',4,['中性・塩基性でH₂Sを通じると生じる白色の硫化物']),
  C('FeS','硫化鉄(II)','FeS',0,{Fe2:1,S:1},'沈殿',4,['希硫酸を加えるとH₂Sが発生する黒色固体']),
  C('CuOH2','水酸化銅(II)','Cu(OH)2',0,{Cu2:1,OH:2},'沈殿',4,['Cu²⁺にNaOH水溶液を加えると生じる青白色沈殿。加熱すると黒色のCuOになる']),
  C('FeOH2','水酸化鉄(II)','Fe(OH)2',0,{Fe2:1,OH:2},'沈殿',4,['Fe²⁺に塩基を加えると生じる緑白色沈殿']),
  C('FeOH3','水酸化鉄(III)','Fe(OH)3',0,{Fe3:1,OH:3},'沈殿',4,['Fe³⁺に塩基を加えると生じる赤褐色沈殿']),
  C('AlOH3','水酸化アルミニウム','Al(OH)3',0,{Al:1,OH:3},'沈殿',4,['白色ゲル状沈殿。過剰のNaOH水溶液には溶けるが、過剰のアンモニア水には溶けない']),
  C('ZnOH2','水酸化亜鉛','Zn(OH)2',0,{Zn:1,OH:2},'沈殿',4,['過剰のNaOH水溶液にも、過剰のアンモニア水にも溶ける白色沈殿']),
  C('MgOH2','水酸化マグネシウム','Mg(OH)2',0,{Mg:1,OH:2},'沈殿',4,['白色沈殿。過剰のNaOH水溶液にも溶けない']),
  C('NiOH2','水酸化ニッケル(II)','Ni(OH)2',0,{Ni:1,OH:2},'沈殿',4,['Ni²⁺に塩基を加えると生じる緑色沈殿']),
  C('CrOH3','水酸化クロム(III)','Cr(OH)3',0,{Cr:1,OH:3},'沈殿',4,['Cr³⁺に塩基を加えると生じる灰緑色の沈殿（両性）']),
  C('Cu2O','酸化銅(I)','Cu2O',0,{Cu1:2,O:1},'沈殿',4,['フェーリング液が還元されて生じる赤色沈殿']),
  C('ZnO','酸化亜鉛','ZnO',0,{Zn:1,O:1},'酸化物',4,['白色の両性酸化物。亜鉛華とよばれる顔料']),
  C('AgNH32','ジアンミン銀(I)イオン','[Ag(NH3)2]',1,{Ag:1,NH3:2},'錯イオン',4,['AgClやAg₂Oが過剰のアンモニア水に溶けて生じる直線形の錯イオン','銀鏡反応に使う錯イオン'],2),
  C('CuNH34','テトラアンミン銅(II)イオン','[Cu(NH3)4]',2,{Cu2:1,NH3:4},'錯イオン',4,['Cu(OH)₂が過剰のアンモニア水に溶けて生じる深青色の錯イオン（正方形）'],4),
  C('ZnNH34','テトラアンミン亜鉛(II)イオン','[Zn(NH3)4]',2,{Zn:1,NH3:4},'錯イオン',4,['Zn(OH)₂が過剰のアンモニア水に溶けて生じる無色の錯イオン（正四面体形）'],4),
  C('ZnOH4','テトラヒドロキシド亜鉛(II)酸イオン','[Zn(OH)4]',-2,{Zn:1,OH:4},'錯イオン',4,['Zn(OH)₂が過剰のNaOH水溶液に溶けて生じる錯イオン'],4),
  C('AlOH4','テトラヒドロキシドアルミン酸イオン','[Al(OH)4]',-1,{Al:1,OH:4},'錯イオン',4,['Al(OH)₃が過剰のNaOH水溶液に溶けて生じる錯イオン'],4),
  C('FeCN6_4','ヘキサシアニド鉄(II)酸イオン','[Fe(CN)6]',-4,{Fe2:1,CN:6},'錯イオン',4,['Fe³⁺と反応して濃青色沈殿を生じる（Fe³⁺の検出）'],6),
  C('FeCN6_3','ヘキサシアニド鉄(III)酸イオン','[Fe(CN)6]',-3,{Fe3:1,CN:6},'錯イオン',4,['Fe²⁺と反応して濃青色沈殿を生じる（Fe²⁺の検出）'],6),
  C('AgS2O32','ビス(チオスルファト)銀(I)酸イオン','[Ag(S2O3)2]',-3,{Ag:1,S2O3:2},'錯イオン',4,['AgBrがチオ硫酸ナトリウム水溶液に溶けて生じる錯イオン（写真の定着）'],2),
  C('K4FeCN6','ヘキサシアニド鉄(II)酸カリウム','K4[Fe(CN)6]',0,{K:4,Fe2:1,CN:6},'錯塩',4,['黄色の結晶（黄血塩）。Fe³⁺の検出試薬'],6),
  C('K3FeCN6','ヘキサシアニド鉄(III)酸カリウム','K3[Fe(CN)6]',0,{K:3,Fe3:1,CN:6},'錯塩',4,['赤色の結晶（赤血塩）。Fe²⁺の検出試薬'],6),
  C('NaAlOH4','テトラヒドロキシドアルミン酸ナトリウム','Na[Al(OH)4]',0,{Na:1,Al:1,OH:4},'錯塩',4,['AlやAl₂O₃をNaOH水溶液に溶かすと生じる塩'],4),
];
const DB=RAW;
const BYID={};DB.forEach(d=>BYID[d.id]=d);

/* ================= 半反応式（酸化剤・還元剤） ================= */
// core: 変化する物質、cond: 条件、role: 酸化剤/還元剤、need: e⁻・H⁺・H₂O・OH⁻ の数、eq: 完成した式、ox: 酸化数の変化
const HR=(id,core,cond,role,need,eq,ox,lv)=>({id:'H:'+id,core,cond,role,need,eq,ox,lv});
const HALVES=[
  HR('MnO4a','MnO₄⁻ → Mn²⁺','硫酸酸性','酸化剤',{e:5,H:8,H2O:4},'MnO₄⁻ + 8H⁺ + 5e⁻ → Mn²⁺ + 4H₂O','Mn：+7 → +2',3),
  HR('Cr2O7','Cr₂O₇²⁻ → 2Cr³⁺','硫酸酸性','酸化剤',{e:6,H:14,H2O:7},'Cr₂O₇²⁻ + 14H⁺ + 6e⁻ → 2Cr³⁺ + 7H₂O','Cr：+6 → +3（2個）',3),
  HR('H2O2o','H₂O₂ → 2H₂O','酸性','酸化剤',{e:2,H:2,H2O:2},'H₂O₂ + 2H⁺ + 2e⁻ → 2H₂O','O：−1 → −2（2個）',3),
  HR('H2O2r','H₂O₂ → O₂','','還元剤',{e:2,H:2},'H₂O₂ → O₂ + 2H⁺ + 2e⁻','O：−1 → 0（2個）',3),
  HR('O3','O₃ → O₂','酸性','酸化剤',{e:2,H:2,H2O:1},'O₃ + 2H⁺ + 2e⁻ → O₂ + H₂O','O：0 → −2（1個）',3),
  HR('HNO3d','HNO₃（希）→ NO','','酸化剤',{e:3,H:3,H2O:2},'HNO₃ + 3H⁺ + 3e⁻ → NO + 2H₂O','N：+5 → +2',3),
  HR('HNO3c','HNO₃（濃）→ NO₂','','酸化剤',{e:1,H:1,H2O:1},'HNO₃ + H⁺ + e⁻ → NO₂ + H₂O','N：+5 → +4',3),
  HR('H2SO4h','H₂SO₄（熱濃）→ SO₂','','酸化剤',{e:2,H:2,H2O:2},'H₂SO₄ + 2H⁺ + 2e⁻ → SO₂ + 2H₂O','S：+6 → +4',3),
  HR('Cl2','Cl₂ → 2Cl⁻','','酸化剤',{e:2},'Cl₂ + 2e⁻ → 2Cl⁻','Cl：0 → −1（2個）',3),
  HR('I2','I₂ → 2I⁻','','酸化剤',{e:2},'I₂ + 2e⁻ → 2I⁻','I：0 → −1（2個）',3),
  HR('Fe3','Fe³⁺ → Fe²⁺','','酸化剤',{e:1},'Fe³⁺ + e⁻ → Fe²⁺','Fe：+3 → +2',3),
  HR('C2O4','H₂C₂O₄ → 2CO₂','','還元剤',{e:2,H:2},'H₂C₂O₄ → 2CO₂ + 2H⁺ + 2e⁻','C：+3 → +4（2個）',3),
  HR('SO2r','SO₂ → SO₄²⁻','','還元剤',{e:2,H:4,H2O:2},'SO₂ + 2H₂O → SO₄²⁻ + 4H⁺ + 2e⁻','S：+4 → +6',3),
  HR('H2S','H₂S → S','','還元剤',{e:2,H:2},'H₂S → S + 2H⁺ + 2e⁻','S：−2 → 0',3),
  HR('Fe2','Fe²⁺ → Fe³⁺','','還元剤',{e:1},'Fe²⁺ → Fe³⁺ + e⁻','Fe：+2 → +3',3),
  HR('Sn2','Sn²⁺ → Sn⁴⁺','','還元剤',{e:2},'Sn²⁺ → Sn⁴⁺ + 2e⁻','Sn：+2 → +4',3),
  HR('Ir','2I⁻ → I₂','','還元剤',{e:2},'2I⁻ → I₂ + 2e⁻','I：−1 → 0（2個）',3),
  HR('S2O3','2S₂O₃²⁻ → S₄O₆²⁻','','還元剤',{e:2},'2S₂O₃²⁻ → S₄O₆²⁻ + 2e⁻','S：+2 → +2.5（4個）',3),
  HR('SO2o','SO₂ → S','','酸化剤',{e:4,H:4,H2O:2},'SO₂ + 4H⁺ + 4e⁻ → S + 2H₂O','S：+4 → 0',4),
  HR('MnO4n','MnO₄⁻ → MnO₂','中性・塩基性','酸化剤',{e:3,H2O:2,OH:4},'MnO₄⁻ + 2H₂O + 3e⁻ → MnO₂ + 4OH⁻','Mn：+7 → +4',4),
];
const HALF={};HALVES.forEach(h=>HALF[h.id]=h);
const isHalf=k=>typeof k==='string'&&k.startsWith('H:');

/* ================= 比べ方 ================= */
// 酸性塩のイオン（HSO₄⁻ など）は H⁺ と元の陰イオンに分けてから比べる（NaHSO₄ は Na⁺＋HSO₄⁻ でも Na⁺＋H⁺＋SO₄²⁻ でもよい）
function canon(m){
  const o={};
  for(const [k,n] of Object.entries(m)){if(!n)continue;const d=PART[k]&&PART[k].dec;
    if(d)for(const [x,c] of Object.entries(d))o[x]=(o[x]||0)+c*n;else o[k]=(o[k]||0)+n;}
  return o;
}
const keyOf=m=>Object.keys(m).filter(k=>m[k]>0).sort().map(k=>k+'*'+m[k]).join(',');
const itemsMap=items=>{const m={};(items||[]).forEach(([k,n])=>{if(PART[k])m[k]=(m[k]||0)+n;});return m;};
const chargeOf=m=>Object.entries(m).reduce((a,[k,n])=>a+PART[k].q*n,0);
function atomsOf(m){const o={};for(const k in m)for(const [e,n] of Object.entries(PART[k].a))o[e]=(o[e]||0)+n*m[k];return o;}
DB.forEach(d=>{d.key=keyOf(canon(d.parts));d.np=Object.values(d.parts).reduce((a,b)=>a+b,0);d.atoms=atomsOf(d.parts);});
const BYKEY={};DB.forEach(d=>{BYKEY[d.key]=d;});

/* ================= ステージ（基礎→京大） ================= */
const ids=f=>DB.filter(f).map(d=>d.id);
const halves=f=>HALVES.filter(f).map(h=>h.id);
const STAGES=[
  {id:'s1',lvl:'基礎',name:'イオンの組み立て',desc:'塩化物・硫酸塩・酸化物・強酸・強塩基。電荷がつり合うようにイオンの数を合わせる',
    pool:ids(d=>d.lv===1),clue:'name',fb:2,time:150,spawn:14,max:3,life:1.2,stars:[150,300,450]},
  {id:'s2',lvl:'基礎＋',name:'酸・塩基・塩',desc:'弱酸・多価の酸・酸性塩・リン酸塩・緩衝液の成分。中和滴定と加水分解でよく出るもの',
    pool:ids(d=>d.lv===2||(d.lv===1&&/酸|塩基/.test(d.k))),clue:'mix',fb:2,time:150,spawn:14,max:3,life:1.15,stars:[160,320,480]},
  {id:'s3',lvl:'標準',name:'酸化還元',desc:'酸化剤・還元剤の物質と、半反応式（e⁻・H⁺・H₂O の数を合わせる）',
    pool:ids(d=>d.lv===3).concat(halves(h=>h.lv===3)),clue:'mix',fb:1,time:165,spawn:15,max:4,life:1.1,vip:true,stars:[180,360,540]},
  {id:'s4',lvl:'応用',name:'沈殿と錯イオン',desc:'沈殿の色・溶け方、錯イオンの配位数、錯塩。系統分析とモール法で出るもの',
    pool:ids(d=>d.lv===4),clue:'mix',fb:1,time:165,spawn:15,max:4,life:1.05,vip:true,stars:[180,360,540]},
  {id:'s5',lvl:'京大',name:'京大ラッシュ（無機・理論）',desc:'全範囲・性質のみの注文と、中性・塩基性を含む半反応式。失敗の理由は出ない。停電・延焼あり',
    pool:ids(()=>true).concat(halves(()=>true)),clue:'prop',fb:0,time:180,spawn:12,max:4,life:1.0,vip:true,blackout:true,spread:true,stars:[200,420,640]},
];
const REVIEW={id:'rv',name:'苦手克服ラン',desc:'習熟度の低い物質・半反応式だけを集中注文',pool:'review',clue:'mix',fb:1,time:120,spawn:12,max:4,life:1.1,stars:null};
const ALL=DB.map(d=>d.id).concat(HALVES.map(h=>h.id));

/* ================= 判定 ================= */
const known=k=>!!BYID[k]||!!HALF[k];
const disp=k=>isHalf(k)?esc(HALF[k].core):show(BYID[k].f,BYID[k].q);
function tgt(k){
  if(isHalf(k)){const h=HALF[k];return {n:`${h.core}${h.cond?'（'+h.cond+'）':''}`,f:'',proc:null,group:k,half:true};}
  const d=BYID[k];return {n:d.n,f:d.f,proc:null,group:k};
}
// 物質の注文には e⁻・H₂O は入らない。半反応式の注文は e⁻・H⁺・H₂O・OH⁻ だけ
function accept(k,item){
  if(isHalf(k))return HALF_PARTS.includes(item)?'':'半反応式の注文は e⁻・H⁺・H₂O（・OH⁻）の数を合わせる';
  return item==='e'||item==='H2O'?'e⁻・H₂O は半反応式の注文で使う':'';
}
const exact=(k,items)=>{
  const m=itemsMap(items);
  if(isHalf(k)){const n=HALF[k].need;return keyOf(m)===keyOf(n);}
  return !!BYID[k]&&keyOf(canon(m))===BYID[k].key;
};
const pm=q=>(q>0?'＋':q<0?'−':'±')+Math.abs(q);
// 物質・錯イオンの判定：ok / wrong（別の物質）/ 理由つきの失敗（lv が小さいほど一般的な理由）
function judgeBuild(k,items){
  const d=BYID[k],m=itemsMap(items),c=canon(m),key=keyOf(c);
  if(key===d.key)return {ok:true};
  const other=BYKEY[key];
  if(other)return {wrong:other};
  const q=chargeOf(m);
  if(q!==d.q){
    const pos=Object.entries(m).reduce((a,[x,n])=>a+Math.max(0,PART[x].q)*n,0),neg=Object.entries(m).reduce((a,[x,n])=>a+Math.max(0,-PART[x].q)*n,0);
    return {why:d.q?`電荷が合わない（${pm(q)}。この錯イオンは ${pm(d.q)}）`:`電荷がつり合わない（＋${pos}／−${neg}）`,lv:1,generic:'電荷がつり合わない'};
  }
  // 電荷は合っている：比が違う／配位数が違う／イオンが違う
  const need=canon(d.parts),ks=new Set([...Object.keys(need),...Object.keys(c)]);
  const same=[...ks].every(x=>(need[x]>0)===(c[x]>0));
  if(same){
    if(d.cn){const lig=Object.keys(d.parts).find(x=>PART[x].side==='sp'||x==='OH'||x==='S2O3');if(lig&&c[lig]!==need[lig])return {why:`配位数が違う（${d.n}の配位数は${d.cn}）`,lv:1,generic:'配位数が違う'};}
    return {why:'イオンの数の比が違う（最も簡単な整数比にする）',lv:1,generic:'イオンの数の比が違う'};
  }
  const nm=x=>PART[x].label;
  const miss=[...ks].filter(x=>(c[x]||0)<(need[x]||0)&&!(c[x]>0)),extra=[...ks].filter(x=>(c[x]||0)>0&&!(need[x]>0));
  return {why:`${extra.map(nm).join('・')||'?'} ではなく ${miss.map(nm).join('・')||'?'}`,lv:2,generic:'イオンの組み合わせが違う'};
}
// 半反応式の判定：e⁻ の数（酸化数の変化）→ H⁺・H₂O・OH⁻ の数（原子と電荷のつり合い）の順に見る
function judgeHalf(k,items){
  const h=HALF[k],m=itemsMap(items),n=h.need;
  if(keyOf(m)===keyOf(n))return {ok:true};
  if((m.e||0)!==(n.e||0))return {why:`電子の数が違う（${h.ox}）`,lv:1,generic:'電子の数が違う'};
  if((m.OH||0)&&!(n.OH||0))return {why:'酸性ではOH⁻ではなくH⁺とH₂Oで合わせる',lv:1,generic:'H⁺・H₂O・OH⁻の数が違う'};
  return {why:'H⁺・H₂O（・OH⁻）の数が違う（O原子→H₂O、H原子→H⁺、最後に電荷を確かめる）',lv:1,generic:'H⁺・H₂O・OH⁻の数が違う'};
}
const answerText=k=>isHalf(k)?HALF[k].eq:'';
// ヒント：名前の注文は 分類と含まれるイオン→化学式、性質の注文は 名前→化学式、半反応式は 酸化数の変化→完成した式
function hint(k,level,mode){
  if(isHalf(k)){const h=HALF[k];return level===1?`酸化数：${h.ox}`:h.eq;}
  const d=BYID[k];
  if(level===1)return mode==='name'?`${d.k}：${Object.keys(d.parts).map(x=>PART[x].label).join('・')}`:d.n;
  return d.f+(d.q?chargeText(d.q):'');
}
const hintHTML=(k,level,mode)=>level===2&&!isHalf(k)?disp(k):esc(hint(k,level,mode));
const label=k=>(PART[k]||{label:k}).label;
const cellName=k=>(PART[k]||{name:k}).name;
const CLS={cat:'i-cat',an:'i-an',sp:'i-sp'};
const cls=k=>{const p=PART[k];if(!p)return '';if(/^(MnO4|Cr2O7|CrO4|ClO|ClO3)$/.test(k))return 'i-ox';if(p.dec)return 'i-acid';if(k==='H')return 'i-h';if(k==='OH')return 'i-oh';return CLS[p.side];};

const NONE='その組み合わせの物質は無い';
export {NONE,PARTS,PART,CATS,SPS,ANS,SHELF,HALF_PARTS,DB,BYID,BYKEY,HALVES,HALF,STAGES,REVIEW,ALL,
  canon,keyOf,itemsMap,chargeOf,atomsOf,chargeText,supText,show,disp,isHalf,known,tgt,accept,exact,judgeBuild,judgeHalf,answerText,hint,hintHTML,label,cellName,cls,esc};
