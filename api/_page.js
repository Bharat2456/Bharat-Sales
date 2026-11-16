'use strict';
// HTML -> readable text, plus emails and phone numbers found on the page.
const ENT={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
function decode(s){return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi,(m,e)=>{
  if(e[0]==='#'){const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10);try{return Number.isFinite(n)?String.fromCodePoint(n):m}catch(x){return m}}
  return ENT[e.toLowerCase()]??m})}
function htmlToText(html){
  let h=String(html||'');
  const mails=[];for(const m of h.matchAll(/href\s*=\s*["']mailto:([^"'?>\s]+)/gi))mails.push(decode(m[1]).trim());
  h=h.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi,' ')
     .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/footer|\/header)\b[^>]*>/gi,'\n').replace(/<[^>]+>/g,' ');
  const text=decode(h).replace(/[ \t\f\v ]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  const emails=[...new Set([...mails,...(text.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g)||[])]
    .map(e=>e.toLowerCase()).filter(e=>!/\.(png|jpe?g|gif|webp|svg|css|js)$/.test(e)))].slice(0,10);
  const phones=[...new Set((text.match(/(?:\+\d{1,3}[\s\-]?)?(?:\(?\d{2,5}\)?[\s\-]?)\d{3,5}[\s\-]?\d{3,5}/g)||[]).map(p=>p.trim()).filter(p=>p.replace(/\D/g,'').length>=9&&p.replace(/\D/g,'').length<=13))].slice(0,5);
  return {text,emails,phones};
}
module.exports={htmlToText,decode};
