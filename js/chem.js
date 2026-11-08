// 反応データ：試薬棚・触媒・反応式・注文（生成物）・判定
import {parseFormula,fmt} from './data.js';
export {fmt};

/* ================= 物質 ================= */
// f: 化学式  n: 名前  k: 棚の色分類  lab: 棚の表示  cc: 濃/希  b: 濃度違いをまとめる名前
const S=(f,n,o={})=>Object.assign({f,n},o);
export const SUB={
  // 酸・水
  HCl_c:S('HCl','濃塩酸',{k:'acid',lab:'濃HCl',cc:'濃',b:'HCl'}),
  HCl_d:S('HCl','希塩酸',{k:'acid',lab:'希HCl',cc:'希',b:'HCl'}),
  H2SO4_c:S('H2SO4','濃硫酸',{k:'acid',lab:'濃H2SO4',cc:'濃',b:'H2SO4'}),
  H2SO4_d:S('H2SO4','希硫酸',{k:'acid',lab:'希H2SO4',cc:'希',b:'H2SO4'}),
  HNO3_c:S('HNO3','濃硝酸',{k:'acid',lab:'濃HNO3',cc:'濃',b:'HNO3'}),
  HNO3_d:S('HNO3','希硝酸',{k:'acid',lab:'希HNO3',cc:'希',b:'HNO3'}),
  H2O:S('H2O','水',{k:'acid',lab:'H2O'}),
  H2O2:S('H2O2','過酸化水素水',{k:'acid',lab:'H2O2'}),
  // 塩基・塩
  NaOH:S('NaOH','水酸化ナトリウム',{k:'base',lab:'NaOH'}),
  CaOH2:S('Ca(OH)2','水酸化カルシウム',{k:'base',lab:'Ca(OH)2'}),
  NH4Cl:S('NH4Cl','塩化アンモニウム',{k:'salt',lab:'NH4Cl'}),
  NaCl:S('NaCl','塩化ナトリウム',{k:'salt',lab:'NaCl'}),
  KClO3:S('KClO3','塩素酸カリウム',{k:'salt',lab:'KClO3'}),
  CaCO3:S('CaCO3','炭酸カルシウム',{k:'salt',lab:'CaCO3',s:1}),
  Na2SO3:S('Na2SO3','亜硫酸ナトリウム',{k:'salt',lab:'Na2SO3'}),
  CaF2:S('CaF2','フッ化カルシウム（ホタル石）',{k:'salt',lab:'CaF2'}),
  // 金属・固体
  Na:S('Na','ナトリウム',{k:'metal',lab:'Na'}),
  Zn:S('Zn','亜鉛',{k:'metal',lab:'Zn'}),
  Cu:S('Cu','銅',{k:'metal',lab:'Cu'}),
  FeS:S('FeS','硫化鉄(II)',{k:'metal',lab:'FeS'}),
  MnO2:S('MnO2','酸化マンガン(IV)',{k:'metal',lab:'MnO2'}),
  CaC2:S('CaC2','炭化カルシウム（カーバイド）',{k:'metal',lab:'CaC2'}),
  bleach:S('CaCl(ClO)·H2O','さらし粉',{k:'metal',lab:'さらし粉'}),
  S8:S('S','硫黄',{k:'metal',lab:'S'}),
  // 気体ボンベ・熱分解用
  H2:S('H2','水素',{k:'gas',lab:'H2',g:1}),
  O2:S('O2','酸素',{k:'gas',lab:'O2',g:1}),
  N2:S('N2','窒素',{k:'gas',lab:'N2',g:1}),
  Cl2:S('Cl2','塩素',{k:'gas',lab:'Cl2',g:1}),
  CO2:S('CO2','二酸化炭素',{k:'gas',lab:'CO2',g:1}),
  NH4NO2:S('NH4NO2','亜硝酸アンモニウム',{k:'salt',lab:'NH4NO2'}),
  CH3COONa:S('CH3COONa','酢酸ナトリウム',{k:'org',lab:'CH3COONa'}),
  HCOOH:S('HCOOH','ギ酸',{k:'org',lab:'HCOOH'}),
  // 沈殿用のイオン試薬
  AgNO3:S('AgNO3','硝酸銀',{k:'ion',lab:'AgNO3'}),
  BaCl2:S('BaCl2','塩化バリウム',{k:'ion',lab:'BaCl2'}),
  PbNO32:S('Pb(NO3)2','硝酸鉛(II)',{k:'ion',lab:'Pb(NO3)2'}),
  CuSO4:S('CuSO4','硫酸銅(II)',{k:'ion',lab:'CuSO4'}),
  K2CrO4:S('K2CrO4','クロム酸カリウム',{k:'ion',lab:'K2CrO4'}),
  FeCl3:S('FeCl3','塩化鉄(III)',{k:'ion',lab:'FeCl3'}),
  KI:S('KI','ヨウ化カリウム',{k:'ion',lab:'KI'}),
  KBr:S('KBr','臭化カリウム',{k:'ion',lab:'KBr'}),
  // 有機
  CH3OH:S('CH3OH','メタノール',{k:'org',lab:'CH3OH'}),
  C2H5OH:S('C2H5OH','エタノール',{k:'org',lab:'C2H5OH'}),
  CH3COOH:S('CH3COOH','酢酸',{k:'org',lab:'CH3COOH'}),
  C6H6:S('C6H6','ベンゼン',{k:'org',lab:'C6H6'}),
  glucose:S('C6H12O6','グルコース',{k:'org',lab:'グルコース'}),
  Ac2O:S('(CH3CO)2O','無水酢酸',{k:'org',lab:'無水酢酸'}),
  salicylic:S('C6H4(OH)COOH','サリチル酸',{k:'org',lab:'サリチル酸'}),
  PhONa:S('C6H5ONa','ナトリウムフェノキシド',{k:'org',lab:'C6H5ONa'}),
  // 生成物・中間体（棚にはない）
  NH3:S('NH3','アンモニア',{g:1}),HCl:S('HCl','塩化水素',{g:1}),HF:S('HF','フッ化水素',{g:1}),
  H2S:S('H2S','硫化水素',{g:1}),SO2:S('SO2','二酸化硫黄',{g:1}),SO3:S('SO3','三酸化硫黄'),
  NO:S('NO','一酸化窒素',{g:1}),NO2:S('NO2','二酸化窒素',{g:1}),CO:S('CO','一酸化炭素',{g:1}),
  CH4:S('CH4','メタン',{g:1}),C2H2:S('C2H2','アセチレン',{g:1}),C2H4:S('C2H4','エチレン',{g:1}),C2H6:S('C2H6','エタン',{g:1}),
  H2SO4:S('H2SO4','硫酸'),HNO3:S('HNO3','硝酸'),
  NaHCO3:S('NaHCO3','炭酸水素ナトリウム',{s:1}),Na2CO3:S('Na2CO3','炭酸ナトリウム'),CaO:S('CaO','酸化カルシウム'),
  AgCl:S('AgCl','塩化銀',{s:1}),AgBr:S('AgBr','臭化銀',{s:1}),AgI:S('AgI','ヨウ化銀',{s:1}),Ag2O:S('Ag2O','酸化銀',{s:1}),
  Ag2CrO4:S('Ag2CrO4','クロム酸銀',{s:1}),PbCrO4:S('PbCrO4','クロム酸鉛(II)',{s:1}),PbCl2:S('PbCl2','塩化鉛(II)',{s:1}),
  PbI2:S('PbI2','ヨウ化鉛(II)',{s:1}),BaSO4:S('BaSO4','硫酸バリウム',{s:1}),CuOH2:S('Cu(OH)2','水酸化銅(II)',{s:1}),
  FeOH3:S('Fe(OH)3','水酸化鉄(III)',{s:1}),CuS:S('CuS','硫化銅(II)',{s:1}),PbS:S('PbS','硫化鉛(II)',{s:1}),
  CH3COOC2H5:S('CH3COOC2H5','酢酸エチル'),Et2O:S('C2H5OC2H5','ジエチルエーテル'),
  PhNO2:S('C6H5NO2','ニトロベンゼン'),PhSO3H:S('C6H5SO3H','ベンゼンスルホン酸'),PhCl:S('C6H5Cl','クロロベンゼン'),
  EtONa:S('C2H5ONa','ナトリウムエトキシド'),HCHO:S('HCHO','ホルムアルデヒド'),
  salNa:S('C6H4(OH)COONa','サリチル酸ナトリウム'),aspirin:S('C6H4(OCOCH3)COOH','アセチルサリチル酸'),
  MeSal:S('C6H4(OH)COOCH3','サリチル酸メチル'),
  // 副生成物
  MnCl2:S('MnCl2','塩化マンガン(II)'),ZnSO4:S('ZnSO4','硫酸亜鉛'),ZnCl2:S('ZnCl2','塩化亜鉛'),KCl:S('KCl','塩化カリウム'),
  CaCl2:S('CaCl2','塩化カルシウム'),NaHSO4:S('NaHSO4','硫酸水素ナトリウム'),FeSO4:S('FeSO4','硫酸鉄(II)'),
  Na2SO4:S('Na2SO4','硫酸ナトリウム'),CuNO32:S('Cu(NO3)2','硝酸銅(II)'),CaSO4:S('CaSO4','硫酸カルシウム'),
  NaNO3:S('NaNO3','硝酸ナトリウム'),KNO3:S('KNO3','硝酸カリウム'),
};
for(const id in SUB)SUB[id].m=parseFormula(SUB[id].f);

/* ================= 棚 ================= */
// 6段×8列。協力では列ごとに担当が分かれる
// 協力2人で約8割の反応が「2人の担当にまたがる」ように並べてある
export const SHELF=[
  ['HCl_c','HCl_d','H2SO4_c','H2SO4_d','HNO3_c','HNO3_d','H2O','H2O2'],
  ['CaCO3','NaCl','Na2SO3','CaOH2','NH4Cl','NaOH','CaF2','KClO3'],
  ['bleach','Na','Zn','Cu','FeS','CaC2','S8','MnO2'],
  ['HCOOH','Cl2','H2','NH4NO2','CO2','O2','CH3COONa','N2'],
  ['PbNO32','KI','BaCl2','FeCl3','CuSO4','KBr','AgNO3','K2CrO4'],
  ['Ac2O','CH3COOH','glucose','salicylic','CH3OH','PhONa','C2H5OH','C6H6'],
];
export const SHELF_IDS=new Set(SHELF.flat());
// 触媒・脱水剤（矢印の上に書くもの）
export const CATS=['V2O5','Ni','MnO2','Fe3O4','Pt','H2SO4_c','Fe','yeast'];
export const CATN={MnO2:{f:'MnO2',n:'酸化マンガン(IV)'},H2SO4_c:{f:'濃H2SO4',n:'濃硫酸'},Fe3O4:{f:'Fe3O4',n:'四酸化三鉄'},V2O5:{f:'V2O5',n:'酸化バナジウム(V)'},
  Pt:{f:'Pt',n:'白金'},Ni:{f:'Ni',n:'ニッケル'},Fe:{f:'Fe',n:'鉄（FeCl₃）'},yeast:{f:'酵母',n:'酵母（チマーゼ）'}};
export const HEAT=['常温','加熱','高温・高圧'];
// 棚のセルの列番号（協力の担当決め用）。触媒は '@' を付けたキー
export const CELLCOL={};
SHELF.forEach(r=>r.forEach((id,c)=>{CELLCOL[id]=c;}));
CATS.forEach((id,c)=>{CELLCOL['@'+id]=c;});
export const CELLS=Object.keys(CELLCOL);

/* ================= 反応 ================= */
// r: 反応物（'A|B' はどちらでも可）  p: 生成物  cat: 触媒（配列）  h: 必要な温度段階  main: 主生成物
// hx: これより高温だと別の反応になる  catOpt: 触媒なしでも可  hok: この温度も正解扱い
// note: 学びのポイント  t: 温度の目安
const R=(id,c,r,p,o={})=>Object.assign({id,c,r,p,h:0,cat:null},o);
const RAWRX=[
  // ---- 気体の実験室製法 ----
  R('h2_zn','lab',{Zn:1,H2SO4_d:1},{ZnSO4:1,H2:1},{main:'H2',note:'イオン化傾向がHより大きい金属＋希酸'}),
  R('h2_znhcl','lab',{Zn:1,'HCl_d|HCl_c':2},{ZnCl2:1,H2:1},{main:'H2',note:'イオン化傾向がHより大きい金属＋希酸'}),
  R('h2_na','lab',{Na:2,H2O:2},{NaOH:2,H2:1},{main:'H2',note:'アルカリ金属は常温の水と激しく反応'}),
  R('o2_h2o2','lab',{H2O2:2},{H2O:2,O2:1},{cat:['MnO2'],main:'O2',note:'MnO₂は触媒（反応の前後で変化しない）'}),
  R('o2_kclo3','lab',{KClO3:2},{KCl:2,O2:3},{cat:['MnO2'],h:1,main:'O2',note:'MnO₂は触媒。熱分解なので加熱が必要'}),
  R('cl2_mno2','lab',{MnO2:1,HCl_c:4},{MnCl2:1,Cl2:1,H2O:2},{h:1,main:'Cl2',note:'MnO₂は触媒ではなく酸化剤（Mnの酸化数 +4→+2）。濃塩酸＋加熱'}),
  R('cl2_bleach','lab',{bleach:1,'HCl_d|HCl_c':2},{CaCl2:1,H2O:2,Cl2:1},{main:'Cl2',note:'さらし粉なら加熱なしで発生'}),
  R('hcl_nacl','lab',{NaCl:1,H2SO4_c:1},{NaHSO4:1,HCl:1},{h:1,main:'HCl',note:'不揮発性の酸（濃硫酸）で揮発性の酸を追い出す'}),
  R('nh3_lab','lab',{NH4Cl:2,CaOH2:1},{CaCl2:1,H2O:2,NH3:2},{h:1,main:'NH3',note:'弱塩基の塩＋強塩基→弱塩基の遊離。固体どうしを加熱'}),
  R('co2_lab','lab',{CaCO3:1,'HCl_d|HCl_c':2},{CaCl2:1,H2O:1,CO2:1},{main:'CO2',note:'弱酸の塩＋強酸→弱酸（CO₂）の遊離'}),
  R('h2s_lab','lab',{FeS:1,H2SO4_d:1},{FeSO4:1,H2S:1},{main:'H2S',note:'弱酸の塩＋強酸。希硫酸を使う'}),
  R('so2_cu','lab',{Cu:1,H2SO4_c:2},{CuSO4:1,H2O:2,SO2:1},{h:1,main:'SO2',note:'熱濃硫酸の酸化作用。加熱が必要'}),
  R('so2_na2so3','lab',{Na2SO3:1,'H2SO4_d|H2SO4_c':1},{Na2SO4:1,H2O:1,SO2:1},{main:'SO2',note:'弱酸の塩＋強酸→弱酸の遊離'}),
  R('no_cu','lab',{Cu:3,HNO3_d:8},{CuNO32:3,H2O:4,NO:2},{main:'NO',note:'希硝酸→NO、濃硝酸→NO₂'}),
  R('no2_cu','lab',{Cu:1,HNO3_c:4},{CuNO32:1,H2O:2,NO2:2},{main:'NO2',note:'濃硝酸→NO₂、希硝酸→NO'}),
  R('co_hcooh','lab',{HCOOH:1},{H2O:1,CO:1},{cat:['H2SO4_c'],h:1,main:'CO',note:'濃硫酸の脱水作用（矢印の上に書く）'}),
  R('ch4','lab',{CH3COONa:1,NaOH:1},{Na2CO3:1,CH4:1},{h:1,main:'CH4',note:'固体どうしを加熱'}),
  R('hf','lab',{CaF2:1,H2SO4_c:1},{CaSO4:1,HF:2},{h:1,main:'HF',note:'不揮発性の酸で揮発性の酸を追い出す'}),
  R('c2h2','lab',{CaC2:1,H2O:2},{CaOH2:1,C2H2:1},{main:'C2H2',note:'カーバイドに水。加熱不要'}),
  R('n2','lab',{NH4NO2:1},{N2:1,H2O:2},{h:1,main:'N2',note:'亜硝酸アンモニウムの熱分解'}),
  // ---- 沈殿 ----
  R('agcl','ppt',{AgNO3:1,NaCl:1},{AgCl:1,NaNO3:1},{main:'AgCl'}),
  R('agbr','ppt',{AgNO3:1,KBr:1},{AgBr:1,KNO3:1},{main:'AgBr'}),
  R('agi','ppt',{AgNO3:1,KI:1},{AgI:1,KNO3:1},{main:'AgI'}),
  R('ag2o','ppt',{AgNO3:2,NaOH:2},{Ag2O:1,NaNO3:2,H2O:1},{main:'Ag2O',note:'AgOHではなくAg₂Oになる'}),
  R('ag2cro4','ppt',{AgNO3:2,K2CrO4:1},{Ag2CrO4:1,KNO3:2},{main:'Ag2CrO4'}),
  R('pbcro4','ppt',{PbNO32:1,K2CrO4:1},{PbCrO4:1,KNO3:2},{main:'PbCrO4'}),
  R('pbcl2','ppt',{PbNO32:1,NaCl:2},{PbCl2:1,NaNO3:2},{main:'PbCl2'}),
  R('pbi2','ppt',{PbNO32:1,KI:2},{PbI2:1,KNO3:2},{main:'PbI2'}),
  R('baso4','ppt',{BaCl2:1,'H2SO4_d|H2SO4_c':1},{BaSO4:1,HCl:2},{main:'BaSO4'}),
  R('caco3','ppt',{CaOH2:1,CO2:1},{CaCO3:1,H2O:1},{main:'CaCO3',note:'石灰水が白く濁る'}),
  R('cuoh2','ppt',{CuSO4:1,NaOH:2},{CuOH2:1,Na2SO4:1},{main:'CuOH2'}),
  R('feoh3','ppt',{FeCl3:1,NaOH:3},{FeOH3:1,NaCl:3},{main:'FeOH3'}),
  R('cus','ppt',{CuSO4:1,H2S:1},{CuS:1,H2SO4:1},{main:'CuS',note:'CuSは酸性でも沈殿する。H₂Sは先に作って注ぐ'}),
  R('pbs','ppt',{PbNO32:1,H2S:1},{PbS:1,HNO3:2},{main:'PbS',note:'H₂Sは先に作って注ぐ'}),
  // ---- 工業的製法 ----
  R('haber','ind',{N2:1,H2:3},{NH3:2},{proc:'ハーバー・ボッシュ法',cat:['Fe3O4'],h:2,main:'NH3',t:'約400〜500℃・高圧',note:'ハーバー・ボッシュ法。気体分子が減る発熱反応なので高圧が有利'}),
  R('s_burn','ind',{S8:1,O2:1},{SO2:1},{proc:'硫黄の燃焼',h:1,main:'SO2',note:'硫黄の燃焼'}),
  R('contact','ind',{SO2:2,O2:1},{SO3:2},{proc:'接触法',cat:['V2O5'],h:1,main:'SO3',note:'接触法。触媒は酸化バナジウム(V)'}),
  R('h2so4','ind',{SO3:1,H2O:1},{H2SO4:1},{proc:'接触法',main:'H2SO4',note:'実際はSO₃を濃硫酸に吸収させて発煙硫酸にし、希硫酸で薄める'}),
  R('ostwald1','ind',{NH3:4,O2:5},{NO:4,H2O:6},{proc:'オストワルト法',cat:['Pt'],h:1,main:'NO',t:'約800℃',note:'オストワルト法①。白金触媒でアンモニアを酸化'}),
  R('ostwald2','ind',{NO:2,O2:1},{NO2:2},{proc:'オストワルト法',main:'NO2',note:'オストワルト法②。NOは空気中ですぐ酸化される'}),
  R('ostwald3','ind',{NO2:3,H2O:1},{HNO3:2,NO:1},{proc:'オストワルト法',main:'HNO3',note:'オストワルト法③。生じたNOは②に戻して再利用'}),
  R('solvay1','ind',{NaCl:1,H2O:1,NH3:1,CO2:1},{NaHCO3:1,NH4Cl:1},{proc:'アンモニアソーダ法',main:'NaHCO3',note:'アンモニアソーダ法。溶解度の小さいNaHCO₃が沈殿'}),
  R('solvay2','ind',{NaHCO3:2},{Na2CO3:1,H2O:1,CO2:1},{proc:'アンモニアソーダ法',h:1,main:'Na2CO3',note:'NaHCO₃の熱分解'}),
  R('cao','ind',{CaCO3:1},{CaO:1,CO2:1},{proc:'石灰石の熱分解',h:1,main:'CaO',note:'石灰石の熱分解（強熱）'}),
  R('slake','ind',{CaO:1,H2O:1},{CaOH2:1},{proc:'生石灰に水',main:'CaOH2',note:'激しく発熱する'}),
  R('hcl_syn','ind',{H2:1,Cl2:1},{HCl:2},{proc:'H₂とCl₂の燃焼',h:1,main:'HCl',note:'点火（または光）で反応。工業的な塩化水素の製法'}),
  // ---- 有機 ----
  R('ester','org',{CH3COOH:1,C2H5OH:1},{CH3COOC2H5:1,H2O:1},{cat:['H2SO4_c'],h:1,main:'CH3COOC2H5',note:'エステル化。濃硫酸は触媒。可逆反応'}),
  R('ether','org',{C2H5OH:2},{Et2O:1,H2O:1},{cat:['H2SO4_c'],h:1,hx:1,main:'Et2O',t:'130〜140℃',note:'分子間脱水（2分子から1分子のH₂O）。160〜170℃ならエチレン'}),
  R('ethylene','org',{C2H5OH:1},{C2H4:1,H2O:1},{cat:['H2SO4_c'],h:1,main:'C2H4',t:'160〜170℃',note:'分子内脱水。130〜140℃ならジエチルエーテル'}),
  R('nitration','org',{C6H6:1,HNO3_c:1},{PhNO2:1,H2O:1},{cat:['H2SO4_c'],h:1,main:'PhNO2',t:'約60℃',note:'混酸（濃硝酸＋濃硫酸）でニトロ化。濃硫酸は触媒'}),
  R('sulfonation','org',{C6H6:1,H2SO4_c:1},{PhSO3H:1,H2O:1},{h:1,main:'PhSO3H',note:'スルホン化。ここでは濃硫酸は反応物'}),
  R('chlorination','org',{C6H6:1,Cl2:1},{PhCl:1,HCl:1},{cat:['Fe'],main:'PhCl',note:'鉄（塩化鉄(III)）触媒で置換反応。光を当てると付加反応になる'}),
  R('trimer','org',{C2H2:3},{C6H6:1},{cat:['Fe'],h:1,main:'C6H6',note:'アセチレン3分子の重合（加熱した鉄に通す）'}),
  R('hydro','org',{C2H4:1,H2:1},{C2H6:1},{cat:['Ni','Pt'],h:1,main:'C2H6',note:'付加反応。NiやPtが触媒'}),
  R('ferment','org',{glucose:1},{C2H5OH:2,CO2:2},{cat:['yeast'],main:'C2H5OH',note:'アルコール発酵。酵素チマーゼが触媒'}),
  R('ethoxide','org',{C2H5OH:2,Na:2},{EtONa:2,H2:1},{main:'EtONa',note:'ヒドロキシ基の検出（Naを入れるとH₂が出る）'}),
  R('hcho','org',{CH3OH:2,O2:1},{HCHO:2,H2O:2},{cat:['Pt'],h:1,main:'HCHO',note:'メタノールの酸化。加熱した白金や銅を触媒にする'}),
  R('kolbe','org',{PhONa:1,CO2:1},{salNa:1},{h:2,main:'salNa',t:'約125℃・約100気圧',note:'コルベ・シュミット反応'}),
  R('salicylic','org',{salNa:1,'HCl_d|HCl_c':1},{salicylic:1,NaCl:1},{main:'salicylic',note:'弱酸の塩＋強酸→弱酸の遊離'}),
  R('aspirin','org',{salicylic:1,Ac2O:1},{aspirin:1,CH3COOH:1},{cat:['H2SO4_c'],catOpt:1,h:1,hok:[0],main:'aspirin',note:'アセチル化。少量の濃硫酸を触媒にして温めることが多い'}),
  R('mesal','org',{salicylic:1,CH3OH:1},{MeSal:1,H2O:1},{cat:['H2SO4_c'],h:1,main:'MeSal',note:'エステル化。濃硫酸は触媒'}),
];
// 正規化：r=[{ids,n}], p=[[id,n]]
export const RX=RAWRX.map(x=>Object.assign({},x,{
  r:Object.entries(x.r).map(([k,n])=>({ids:k.split('|'),n})),
  p:Object.entries(x.p),
}));
export const RXBY={};RX.forEach(r=>RXBY[r.id]=r);

/* ================= 注文（生成物） ================= */
// c: カテゴリ  p: 性質のヒント（製法そのものは書かない）
export const CATNAME={lab:'気体の製法',ppt:'沈殿',ind:'工業的製法',org:'有機'};
export const TG={
  H2:{c:'lab',p:['最も密度の小さい気体','空気中で燃えて水だけを生じる気体']},
  O2:{c:'lab',p:['空気の体積の約21%を占める気体','ものの燃焼を助ける無色無臭の気体']},
  Cl2:{c:'lab',p:['黄緑色で刺激臭のある有毒な気体','水に溶けると次亜塩素酸を生じ、漂白・殺菌に使われる']},
  HCl:{c:'lab',p:['NH₃と白煙を生じる酸性の気体','水溶液は揮発性の強酸']},
  NH3:{c:'lab',p:['刺激臭のある塩基性の気体。上方置換で集める','HClと白煙を生じる気体']},
  CO2:{c:'lab',p:['石灰水を白く濁らせる気体','固体はドライアイス']},
  H2S:{c:'lab',p:['腐卵臭のある有毒な気体','酢酸鉛(II)紙を黒変させる気体']},
  SO2:{c:'lab',p:['刺激臭のある無色の気体。還元作用で漂白する','H₂Sと反応して硫黄を析出させる気体']},
  NO:{c:'lab',p:['空気に触れるとすぐ赤褐色に変わる無色の気体','水に溶けにくく水上置換で集める窒素酸化物']},
  NO2:{c:'lab',p:['赤褐色の有毒な気体。N₂O₄と平衡にある','水と反応して硝酸を生じる窒素酸化物']},
  CO:{c:'lab',p:['無色無臭の有毒気体。ヘモグロビンと強く結合','青白い炎で燃え、製鉄で還元剤になる気体']},
  CH4:{c:'lab',p:['天然ガスの主成分','最も簡単なアルカン']},
  HF:{c:'lab',p:['ガラスを溶かすのでポリエチレン容器で保存','ハロゲン化水素で唯一、水溶液が弱酸']},
  C2H2:{c:'lab',p:['三重結合をもつ最も簡単な炭化水素','酸素とともに燃やすと高温の炎（溶接・切断）']},
  N2:{c:'lab',p:['空気の体積の約78%を占める気体','常温では反応しにくく、食品の封入ガスに使われる']},
  NaOH:{c:'lab',p:['潮解性をもつ強塩基の白色固体','空気中のCO₂を吸収して炭酸ナトリウムになる']},
  AgCl:{c:'ppt',p:['光で黒変し、アンモニア水によく溶ける白色沈殿']},
  AgBr:{c:'ppt',p:['淡黄色の沈殿。写真フィルムの感光剤']},
  AgI:{c:'ppt',p:['黄色沈殿。アンモニア水に溶けない']},
  Ag2O:{c:'ppt',p:['Ag⁺の水溶液に塩基を加えると生じる褐色沈殿']},
  Ag2CrO4:{c:'ppt',p:['赤褐色の沈殿。モール法の終点の目印']},
  PbCrO4:{c:'ppt',p:['黄色の沈殿。顔料クロムイエロー']},
  PbCl2:{c:'ppt',p:['熱水に溶ける白色沈殿']},
  PbI2:{c:'ppt',p:['黄色沈殿。熱水に溶け、冷やすと金色の結晶になる']},
  BaSO4:{c:'ppt',p:['酸にも溶けない白色沈殿。X線造影剤']},
  CaCO3:{c:'ppt',p:['石灰石・大理石の主成分','CO₂を含む水には炭酸水素カルシウムとなって溶ける']},
  CuOH2:{c:'ppt',p:['青白色の沈殿。過剰のアンモニア水で深青色の溶液になる']},
  FeOH3:{c:'ppt',p:['Fe³⁺に塩基を加えると生じる赤褐色沈殿']},
  CuS:{c:'ppt',p:['黒色沈殿。酸性の水溶液でも生じる硫化物']},
  PbS:{c:'ppt',p:['黒色沈殿。鉛イオンの検出に使う硫化物']},
  SO3:{c:'ind',p:['接触法の中間体。水と激しく反応する酸化物']},
  H2SO4:{c:'ind',p:['不揮発性で、吸湿性・脱水作用をもつ強酸','肥料や鉛蓄電池に使われる、生産量最大級の酸']},
  HNO3:{c:'ind',p:['光で分解するので褐色びんで保存する強酸','Al・Fe・Niを不動態にする強い酸化力の酸']},
  NaHCO3:{c:'ind',p:['重曹。加熱するとCO₂を出す','水への溶解度が比較的小さい炭酸塩']},
  Na2CO3:{c:'ind',p:['ガラスの原料。水溶液は塩基性','十水和物は風解する']},
  CaO:{c:'ind',p:['生石灰。水を加えると激しく発熱','乾燥剤に使われる塩基性酸化物']},
  CaOH2:{c:'ind',p:['消石灰。水溶液が石灰水','しっくいの材料']},
  CH3COOC2H5:{c:'org',p:['果実のような芳香をもつエステル','マニキュアの除光液などに使われる溶媒']},
  Et2O:{c:'org',p:['麻酔作用をもつ揮発性・引火性の液体','水に溶けにくく、抽出の溶媒に使われる']},
  C2H4:{c:'org',p:['果実の成熟を促す植物ホルモン','臭素水を脱色する最も簡単なアルケン']},
  PhNO2:{c:'org',p:['水より重い淡黄色の油状物質','還元するとアニリンになる']},
  PhSO3H:{c:'org',p:['水に溶けて強い酸性を示す芳香族化合物','アルカリ融解を経てフェノールの原料になる']},
  PhCl:{c:'org',p:['ベンゼンの水素1個を塩素で置換した無色の液体']},
  C6H6:{c:'org',p:['正六角形の平面構造をもつ芳香族炭化水素','すすの多い炎を出して燃える無色の液体']},
  C2H6:{c:'org',p:['炭素数2のアルカン','光を当てると塩素と置換反応する気体']},
  C2H5OH:{c:'org',p:['酒類に含まれるアルコール','酸化するとアセトアルデヒドになる']},
  EtONa:{c:'org',p:['強い塩基性を示すアルコキシド','アルコールの検出（Na投入）で水素とともに生じる']},
  HCHO:{c:'org',p:['水溶液はホルマリン','銀鏡反応陽性の最も簡単なアルデヒド']},
  salNa:{c:'org',p:['強酸を加えるとサリチル酸が遊離する塩','フェノール性OHとカルボン酸の塩をもつ']},
  salicylic:{c:'org',p:['FeCl₃で呈色するカルボン酸','解熱鎮痛剤・湿布薬の原料']},
  aspirin:{c:'org',p:['解熱鎮痛剤','FeCl₃で呈色しない（フェノール性OHがない）']},
  MeSal:{c:'org',p:['消炎鎮痛の湿布薬','特有の芳香をもつ油状液体。FeCl₃で呈色']},
};
export const TGIDS=Object.keys(TG);

/* ================= 最短ルート（多段階合成） ================= */
const rcost=x=>x.r.length+(x.cat?1:0)+x.h;
export const COST={},VIA={};          // 反応物として手に入れるコスト（棚=0）
SHELF_IDS.forEach(id=>{COST[id]=0;});
for(let it=0;it<20;it++){
  let ch=false;
  for(const x of RX){
    let c=rcost(x),ok=true;
    for(const e of x.r){const m=Math.min(...e.ids.map(id=>COST[id]??Infinity));if(m===Infinity){ok=false;break;}c+=m;}
    if(!ok)continue;
    for(const [pid] of x.p){if(SHELF_IDS.has(pid))continue;if(COST[pid]===undefined||c<COST[pid]){COST[pid]=c;VIA[pid]=x.id;ch=true;}}
  }
  if(!ch)break;
}
// 注文メニュー：工業的製法は「その製法で作れ」という注文になる（via）
export const MENU={};
for(const t of TGIDS)if(TG[t].c!=='ind')MENU[t]={key:t,t,via:null,c:TG[t].c};
for(const x of RX)if(x.c==='ind')MENU[x.main+'@'+x.id]={key:x.main+'@'+x.id,t:x.main,via:x.id,c:'ind',proc:x.proc};
export const MKEYS=Object.keys(MENU);
function viaCost(x){
  let c=rcost(x);
  for(const e of x.r){const m=Math.min(...e.ids.map(id=>COST[id]??Infinity));if(m===Infinity)return Infinity;c+=m;}
  return c;
}
// 注文としてのコスト：棚にある物でも「反応で作る」必要がある。主生成物として作る反応を優先
export const MCOST={},MVIA={};
for(const k of MKEYS){
  const it=MENU[k];
  if(it.via){MCOST[k]=viaCost(RXBY[it.via]);MVIA[k]=it.via;continue;}
  for(const mainOnly of [true,false]){
    let best=Infinity,via=null;
    for(const x of RX){
      if(!x.p.some(([p])=>p===it.t)||(mainOnly&&x.main!==it.t))continue;
      const c=viaCost(x);if(c<best){best=c;via=x.id;}
    }
    if(via){MCOST[k]=best;MVIA[k]=via;break;}
  }
}
// 注文 key を作る手順（最初の段から順に）
export function route(key){
  const out=[],seen=new Set();
  const walk=(rid)=>{
    if(seen.has(rid))return;seen.add(rid);
    const x=RXBY[rid];
    for(const e of x.r){
      const id=e.ids.reduce((a,b)=>(COST[b]??Infinity)<(COST[a]??Infinity)?b:a);
      if(!SHELF_IDS.has(id)&&VIA[id])walk(VIA[id]);
    }
    out.push(x);
  };
  if(MVIA[key])walk(MVIA[key]);
  return out;
}
export const stepsOf=key=>route(key).length;
// 注文の行程で使う棚の試薬（在庫切れの対象選び用）
export function routeReagents(key){
  const s=new Set();
  route(key).forEach(x=>{x.r.forEach(e=>e.ids.forEach(id=>{if(SHELF_IDS.has(id))s.add(id);}));if(x.cat)s.add('@'+x.cat[0]);});
  return [...s];
}
// 注文に出せるか：via 指定なら最後の反応がそれであること
export function serves(key,rx){
  const it=MENU[key],x=RXBY[rx];if(!it||!x)return false;
  if(it.via)return rx===it.via;
  return x.p.some(([p])=>p===it.t);
}
// その注文を作る途中で出てくる中間体（棚にない物）の集合。客の鍋の中でこれができたら次の反応に進める
const USEFUL={};
export function usefulFor(key){
  if(USEFUL[key])return USEFUL[key];
  const it=MENU[key],set=new Set();if(!it)return set;
  const stack=it.via?[RXBY[it.via]]:RX.filter(x=>x.p.some(([p])=>p===it.t));
  const seen=new Set();
  while(stack.length){
    const x=stack.pop();if(seen.has(x.id))continue;seen.add(x.id);
    for(const e of x.r)for(const id of e.ids){
      if(SHELF_IDS.has(id)||set.has(id))continue;
      set.add(id);RX.filter(y=>y.main===id).forEach(y=>stack.push(y));
    }
  }
  return USEFUL[key]=set;
}
export const menuName=key=>{const it=MENU[key];return it?SUB[it.t].n:key;};

/* ================= 判定 ================= */
// items: [[id, 係数, 注いだ中間体なら1]]  cat: 触媒id|null  heat: 0..2  coef: 係数も判定
function mapSpecies(x,items){
  if(items.length!==x.r.length)return null;
  const used=new Array(x.r.length).fill(false),map=[];
  for(const it of items){
    const j=x.r.findIndex((e,k)=>!used[k]&&e.ids.includes(it[0]));
    if(j<0)return null;used[j]=true;map.push(j);
  }
  return map;
}
function ratioOk(x,items,map){
  let k=null;
  for(let i=0;i<items.length;i++){
    if(items[i][2])continue;
    const n=items[i][1],e=x.r[map[i]].n;
    if(n%e!==0)return false;const q=n/e;
    if(k===null)k=q;else if(k!==q)return false;
  }
  return true;
}
const baseOf=id=>(SUB[id]&&SUB[id].b)||id;
function condCheck(x,cat,heat){
  const hx=x.hx??2;
  if(heat<x.h&&!(x.hok&&x.hok.includes(heat)))return {why:x.h===2?'高温・高圧が必要':'加熱が必要',lv:1};
  if(heat>hx)return {why:'温度が高すぎる',lv:1};
  if(x.cat){
    if(cat==null){if(!x.catOpt)return {why:'触媒が必要',lv:1};}
    else if(!x.cat.includes(cat))return {why:'触媒が違う',lv:1};
  }
  const over=[];
  if(heat>x.h&&!(x.hok&&x.hok.includes(heat)))over.push(x.h===0?'加熱は不要':'高温・高圧は不要');
  if(!x.cat&&cat!=null)over.push('触媒は不要');
  return {over};
}
const catLabel=id=>CATN[id]?CATN[id].n:id;
export function judge(items,cat,heat,coef){
  if(!items.length)return {ok:false,why:'試薬が入っていない',lv:1};
  // 1) 反応物の種類が完全一致する反応
  const cands=[];
  for(const x of RX){const map=mapSpecies(x,items);if(map)cands.push({x,map});}
  if(cands.length){
    let fail=null;const good=[];
    for(const c of cands){
      const e=condCheck(c.x,cat,heat);
      const rok=ratioOk(c.x,items,c.map);
      if(e.why){if(!fail)fail={why:e.why,lv:1,rx:c.x.id};continue;}
      if(coef&&!rok){if(!fail)fail={why:'係数が合わない',lv:1,rx:c.x.id};continue;}
      good.push({x:c.x,over:e.over,rok});
    }
    if(good.length){
      const g=good.find(q=>q.rok)||good[0];
      return {ok:true,rx:g.x.id,over:g.over};
    }
    return {ok:false,...fail};
  }
  // 2) 濃度だけ違う
  for(const x of RX){
    if(items.length!==x.r.length)continue;
    const used=new Array(x.r.length).fill(false);let ok=true;const need=[];
    for(const it of items){
      let j=x.r.findIndex((e,k)=>!used[k]&&e.ids.includes(it[0]));
      if(j<0){j=x.r.findIndex((e,k)=>!used[k]&&e.ids.some(id=>baseOf(id)===baseOf(it[0])));if(j>=0)need.push(x.r[j].ids.map(id=>SUB[id].n).join('か'));}
      if(j<0){ok=false;break;}used[j]=true;
    }
    if(ok&&need.length)return {ok:false,why:`濃度が違う（${need.join('・')}を使う）`,lv:1,rx:x.id};
  }
  // 3) 触媒と反応物の取り違え（MnO₂・濃硫酸）
  for(const x of RX){
    if(x.cat){
      for(const c of x.cat){
        const it=items.find(i=>i[0]===c);
        if(it&&mapSpecies(x,items.filter(i=>i!==it)))return {ok:false,why:`${SUB[c].n}は触媒として使う（下の段の触媒から）`,lv:1,rx:x.id};
      }
    }
    if(cat&&x.r.some(e=>e.ids.includes(cat))&&!(x.cat&&x.cat.includes(cat))){
      if(mapSpecies(x,items.concat([[cat,1,1]])))return {ok:false,why:`ここでは${SUB[cat].n}は反応物（棚から入れる）`,lv:1,rx:x.id};
    }
  }
  // 4) 足りない／余計
  const ids=new Set(items.map(i=>i[0]));
  let best=null;
  for(const x of RX){
    const rs=x.r.map(e=>e.ids);
    const hit=rs.filter(a=>a.some(id=>ids.has(id))).length;
    const extra=[...ids].filter(id=>!rs.some(a=>a.includes(id))).length;
    const miss=rs.length-hit;
    if(hit===0)continue;
    const sc=hit*2-extra-miss;
    if(!best||sc>best.sc)best={x,miss,extra,sc};
  }
  if(best&&best.miss&&!best.extra)return {ok:false,why:`試薬が足りない（あと${best.miss}種類）`,lv:2,rx:best.x.id};
  if(best&&best.extra&&!best.miss)return {ok:false,why:'余計な試薬が入っている',lv:2,rx:best.x.id};
  return {ok:false,why:'この組み合わせでは反応しない',lv:1};
}
export const durOf=(items,heat,cat)=>{
  const n=items.reduce((a,i)=>a+(i[2]?1:i[1]),0);
  return (0.8+0.7*heat+0.06*n)*(cat?0.75:1);
};

/* ================= 表示 ================= */
function lhsTerm(e){
  const id=e.ids[0],s=SUB[id];
  const cc=e.ids.length===1&&s.cc?`<small>(${s.cc})</small>`:'';
  return `${e.n>1?e.n:''}${fmt(s.f)}${cc}`;
}
export function condText(x){
  const a=[];
  a.push(x.hok&&x.hok.length?`${HEAT[x.h]}（常温でも可）`:HEAT[x.h]);
  if(x.cat)a.push(`触媒 ${x.cat.map(catLabel).join('/')}${x.catOpt?'（なくても可）':''}`);
  if(x.t)a.push(x.t);
  return a.join('・');
}
export function eqHTML(x,mark){
  const l=x.r.map(lhsTerm).join(' + ');
  const r=x.p.map(([id,n])=>{const s=SUB[id];const up=(x.c==='lab'&&s.g&&id===x.main)?'↑':(x.c==='ppt'&&s.s&&id===x.main)?'↓':'';
    const t=`${n>1?n:''}${fmt(s.f)}${up}`;return mark&&id===mark?`<b>${t}</b>`:t;}).join(' + ');
  return `${l} → ${r}`;
}
export const nameOf=id=>(SUB[id]?SUB[id].n:id);
export const fOf=id=>(SUB[id]?SUB[id].f:id);
export function cellLabel(key){
  if(key[0]==='@'){const c=CATN[key.slice(1)];return c?c.f:key;}
  const s=SUB[key];return s?(s.lab||s.f):key;
}
export function cellName(key){
  if(key[0]==='@'){const c=CATN[key.slice(1)];return c?c.n+'（触媒）':key;}
  return nameOf(key);
}

/* ================= ステージ ================= */
export const STAGES=[
 {id:'s1',name:'ガス屋の朝',desc:'気体の実験室製法。条件が違うと理由を教えてくれる',pool:['lab'],clue:'name',flasks:2,time:180,spawn:16,max:3,life:1.25,fb:2,stars:[220,650,1150]},
 {id:'s2',name:'沈殿亭',desc:'沈殿反応と気体。加熱がいるかを見極めろ。VIP客（報酬2倍・短気）',pool:['ppt','lab'],clue:'name',flasks:2,time:180,spawn:14,max:4,life:1.2,vip:true,fb:2,stars:[250,750,1350]},
 {id:'s3',name:'工業ライン',desc:'触媒・高温高圧・多段階合成。完成品を空きフラスコに注いで次の原料に。在庫切れあり',pool:['ind'],clue:'name',flasks:3,time:210,spawn:18,max:4,life:1.3,stockout:true,fb:1,stars:[150,380,700]},
 {id:'s4',name:'有機の夜',desc:'有機反応。触媒と温度と分子数で生成物が変わる。停電あり',pool:['org'],clue:'mix',flasks:3,time:210,spawn:16,max:4,life:1.05,blackout:true,vip:true,fb:1,stars:[250,800,1450]},
 {id:'s5',name:'京大ラッシュ',desc:'全範囲・性質のみ・係数も判定・失敗の理由は出ない。停電・在庫切れ・延焼',pool:['lab','ppt','ind','org'],clue:'prop',flasks:3,time:210,spawn:14,max:4,life:1.15,vip:true,blackout:true,stockout:true,spread:true,coef:true,fb:0,stars:[120,300,600]},
];
export const REVIEW={id:'rv',name:'苦手克服ラン',desc:'習熟度の低い反応だけを集中注文',pool:'review',clue:'mix',flasks:3,time:150,spawn:13,max:4,life:1.15,fb:1,stars:null};
export const poolFor=st=>MKEYS.filter(k=>st.pool==='review'||st.pool.includes(MENU[k].c));
