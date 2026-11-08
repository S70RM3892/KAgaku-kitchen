// 化学式の共通ヘルパー
export function parseFormula(f){
  let i=0;
  const num=()=>{let s='';while(i<f.length&&/[0-9]/.test(f[i]))s+=f[i++];return s?parseInt(s,10):1;};
  const group=()=>{
    const m={};
    while(i<f.length){
      const ch=f[i];
      if(ch==='('){i++;const sub=group();i++;const n=num();for(const k in sub)m[k]=(m[k]||0)+sub[k]*n;}
      else if(ch===')'){return m;}
      else if(/[A-Z]/.test(ch)){let s=ch;i++;while(i<f.length&&/[a-z]/.test(f[i]))s+=f[i++];const n=num();m[s]=(m[s]||0)+n;}
      else i++;
    }
    return m;
  };
  return group();
}
export const atomCount=m=>Object.values(m).reduce((a,b)=>a+b,0);
export const fmt=f=>String(f).replace(/(\d+)/g,'<sub>$1</sub>');
