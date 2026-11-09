// 過去問PDFのありか（URLだけ。PDFそのものはここに置かない）。出どころ：「日本の学校」大学入学共通テスト問題＆解答
// https://school.js88.com/scl_dai/center_data/ に載っているリンク（2021年以降は共同通信 47NEWS の置き場所）。
// ファイル名から年度・科目・問題/正解を見分けるのにも使う（2021年以降はファイル名がランダムな文字のため）
export const SOURCE='https://school.js88.com/scl_dai/center_data/';
export const CATALOG=[
  [2004,'phy','物理IＡ','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2004PhyA.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2004PhyA_Ans.pdf'],
  [2004,'chem','化学IＡ','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2004ChemA.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2004ChemA_Ans.pdf'],
  [2005,'phy','物理IＡ','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2005PhyA.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2005PhyA_Ans.pdf'],
  [2005,'chem','化学IＡ','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2005ChemA.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2005ChemA_Ans.pdf'],
  [2006,'phy','物理I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2006Phy1.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2006Phy1_Ans.pdf'],
  [2006,'chem','化学I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2006Chem1.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2006Chem1_Ans.pdf'],
  [2007,'phy','物理I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2007Phy1.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2007Phy1_Ans.pdf'],
  [2007,'chem','化学I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2007Chem1.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2007Chem1_Ans.pdf'],
  [2008,'phy','物理I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2008Phy1.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2008Phy1_Ans.pdf'],
  [2008,'chem','化学I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2008Chem1.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2008Chem1_Ans.pdf'],
  [2009,'phy','物理I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2009Phy1.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2009Phy1_Ans.pdf'],
  [2009,'chem','化学I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2009Chem1.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2009Chem1_Ans.pdf'],
  [2010,'phy','物理I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2010Phy1.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2010Phy1_Ans.pdf'],
  [2010,'chem','化学I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2010Chem1.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2010Chem1_Ans.pdf'],
  [2011,'phy','物理I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2011buturi1_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2011buturi1_Ans.pdf'],
  [2011,'chem','化学I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2011kagaku1_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2011kagaku1_Ans.pdf'],
  [2012,'phy','物理I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2012buturi1_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2012buturi1_Ans.pdf'],
  [2012,'chem','化学I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2012kagaku1_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2012kagaku1_Ans.pdf'],
  [2013,'phy','物理I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2013buturi1_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2013buturi1_Ans.pdf'],
  [2013,'chem','化学I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2013kagaku1_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2013kagaku1_Ans.pdf'],
  [2014,'phy','物理I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2014buturi1_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2014buturi1_Ans.pdf'],
  [2014,'chem','化学I','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2014kagaku1_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2014kagaku1_Ans.pdf'],
  [2015,'phy','物理','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2015buturi_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2015buturi_Ans.pdf'],
  [2015,'chem','化学','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2015kagaku_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2015kagaku_Ans.pdf'],
  [2016,'phy','物理','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2016buturi_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2016buturi_Ans.pdf'],
  [2016,'chem','化学','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2016kagaku_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2016kagaku_Ans.pdf'],
  [2017,'phy','物理','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2017buturi_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2017buturi_Ans.pdf'],
  [2017,'chem','化学','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2017kagaku_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2017kagaku_Ans.pdf'],
  [2018,'phy','物理','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2018buturi_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2018buturi_Ans.pdf'],
  [2018,'chem','化学','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2018kagaku_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2018kagaku_Ans.pdf'],
  [2019,'phy','物理','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2019buturi_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2019buturi_Ans.pdf'],
  [2019,'chem','化学','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2019kagaku_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2019kagaku_Ans.pdf'],
  [2020,'phy','物理','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2020buturi_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2020buturi_Ans.pdf'],
  [2020,'chem','化学','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2020kagaku_q.pdf','https://school.js88.com/sd_article/dai/dai_center_data/pdf/2020kagaku_Ans.pdf'],
  [2021,'phy','物理','https://img.cf.47news.jp/etc/special/kyotsu-exam/2021/files/5ja4a45jhs63667pcuh2.pdf','https://img.cf.47news.jp/etc/special/kyotsu-exam/2021/files/5ja4a45jhs63667pcuh2-answer.pdf'],
  [2021,'chem','化学','https://img.cf.47news.jp/etc/special/kyotsu-exam/2021/files/7hpr7e5rj8g9cntz6iw7.pdf','https://img.cf.47news.jp/etc/special/kyotsu-exam/2021/files/7hpr7e5rj8g9cntz6iw7-answer.pdf'],
  [2022,'phy','物理','https://img.cf.47news.jp/etc/special/kyotsu-exam/2022/files/gv7d9x7qbulzb7jx.pdf','https://img.cf.47news.jp/etc/special/kyotsu-exam/2022/files/gv7d9x7qbulzb7jx-answer.pdf'],
  [2022,'chem','化学','https://img.cf.47news.jp/etc/special/kyotsu-exam/2022/files/1oqz015p53ufh7yl.pdf','https://img.cf.47news.jp/etc/special/kyotsu-exam/2022/files/1oqz015p53ufh7yl-answer.pdf'],
  [2023,'phy','物理','https://img.cf.47news.jp/static/kyotsu-exam/2023/files/z0yfzivb33.pdf','https://img.cf.47news.jp/static/kyotsu-exam/2023/files/z0yfzivb33-answer.pdf'],
  [2023,'chem','化学','https://img.cf.47news.jp/static/kyotsu-exam/2023/files/sdiyc9lv5g.pdf','https://img.cf.47news.jp/static/kyotsu-exam/2023/files/sdiyc9lv5g-answer.pdf'],
  [2024,'phy','物理','https://img.cf.47news.jp/static/kyotsu-exam/2024/files/fyhslce54h.pdf','https://img.cf.47news.jp/static/kyotsu-exam/2024/files/fyhslce54h-answer.pdf'],
  [2024,'chem','化学','https://img.cf.47news.jp/static/kyotsu-exam/2024/files/664d3wnpzr.pdf','https://img.cf.47news.jp/static/kyotsu-exam/2024/files/664d3wnpzr-answer.pdf'],
  [2025,'phy','物理','https://img.cf.47news.jp/static/kyotsu-exam/2025/files/3hp3a3ybgi.pdf','https://img.cf.47news.jp/static/kyotsu-exam/2025/files/3hp3a3ybgi-answer.pdf'],
  [2025,'chem','化学','https://img.cf.47news.jp/static/kyotsu-exam/2025/files/ufjxgzwck9.pdf','https://img.cf.47news.jp/static/kyotsu-exam/2025/files/ufjxgzwck9-answer.pdf'],
  [2026,'phy','物理','https://img.cf.47news.jp/static/kyotsu-exam/2026/files/b5a8q6n9x1.pdf','https://img.cf.47news.jp/static/kyotsu-exam/2026/files/a9x0m2k6p7-answer.pdf'],
  [2026,'chem','化学','https://img.cf.47news.jp/static/kyotsu-exam/2026/files/m2k9p0x4a7.pdf','https://img.cf.47news.jp/static/kyotsu-exam/2026/files/6p2m7k9x0a-answer.pdf'],
].map(([year,subj,label,q,a])=>({year,subj,label,q,a}));
const base=u=>u.split('/').pop().toLowerCase();
// ダウンロードしたファイル名（「(1)」などが付いていても）から引く
const MAP={};CATALOG.forEach(c=>{MAP[base(c.q)]={year:c.year,subj:c.subj,isAns:false};MAP[base(c.a)]={year:c.year,subj:c.subj,isAns:true};});
export function lookup(name){
  const n=String(name||'').toLowerCase().replace(/\s*\(\d+\)(?=\.pdf$)/,'').replace(/^.*[\\/]/,'');
  return MAP[n]||null;
}
