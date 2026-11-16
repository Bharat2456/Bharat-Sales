/* Bharat Sales dashboard. AGPL-3.0. Logic adapted from Sellbird (https://github.com/ethanplusai/sellbird). */

const theme=()=>window.currentTheme();

/* ═══════ Pure logic: ported from Sellbird (discover.py, fit.py, gate.py, people.py) plus scheduling ═══════ */
const DAYS=['sun','mon','tue','wed','thu','fri','sat'], DAYN={sun:'Sunday',mon:'Monday',tue:'Tuesday',wed:'Wednesday',thu:'Thursday',fri:'Friday',sat:'Saturday'};
const localTz=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}catch(e){return 'UTC'}};
function defCfg(){return JSON.parse(JSON.stringify({
  senderName:'',company:'',product:'',description:'',benefits:[],offer:'',industries:[],titles:[],geography:'',hiringSignals:[],
  language:'English',optOut:"Not interested? Just let me know and I won't email you again.",address:'',dnc:[],maxWords:120,minScore:0,
  website:'',tz:localTz(),duration:30,buffer:10,notice:24,horizon:14,meetMode:'Call',meetDetail:'',
  avail:Object.fromEntries(DAYS.map(d=>[d,{on:false,start:'10:00',end:'17:00'}])),
  followUps:2,gaps:[3,5]}))}
function mergeCfg(x){const d=defCfg(),o={...d,...(x||{})};o.avail={...d.avail,...((x&&x.avail)||{})};return o}
const JUNK_DOMAIN=[
  /(^|\.)(yelp|yellowpages|superpages|manta|bbb|angi|angieslist|homeadvisor)\./i,/(^|\.)(thumbtack|houzz|porch|buildzoom|networx|modernize|nextdoor)\./i,
  /(^|\.)(facebook|instagram|twitter|x|linkedin|youtube|tiktok|pinterest)\./i,/(^|\.)(meetup|eventbrite)\./i,
  /(^|\.)(indeed|glassdoor|ziprecruiter|craigslist|zillow|realtor)\./i,/(^|\.)(mapquest|foursquare|tripadvisor|trustpilot|birdeye|expertise)\./i,
  /(directory|listings?|find-?a-|top\d+|best-?of)\./i,/(^|\.)(naukri|jobrapido|jobsora|shine|foundit|timesjobs|freelancer|upwork)\./i,
  /(^|\.)(indiamart|justdial|tradeindia|exportersindia|sulekha|urbanpro|yet5)\./i,/(^|\.)(olx|quikr|flipkart|snapdeal|myntra|shopclues|etsy|ebay|alibaba|aliexpress)\./i,
  /(^|\.)(wikipedia|reddit|quora|medium|substack|forbes|inc|entrepreneur)\./i,/(news|magazine|journal|gazette|tribune|herald)\.(com|org|net)$/i,
  /\.(edu|gov|mil)$/i,/(hospital|healthsystem|medicalcenter)\./i,/(^|\.)(crunchbase|techcrunch|wellfound|tracxn|pitchbook|zoominfo|owler)\./i,
  /(^|\.)(google|bing|yahoo|duckduckgo|amazon|apple|microsoft)\./i,/(wordpress|wix|squarespace|shopify|godaddy|weebly|webflow)\.com$/i];
const JUNK_NAME=[/^\s*(top|best|\d+)\s+\d*\s*(best\s+)?\w+.*\b(in|near|of)\b/i,/\b(directory|listings?|reviews? of|compare|find a)\b/i,/\b(compan(y|ies)|firms?|contractors?|businesses|providers?)\s+list\b/i,/\blist of\b/i];
const BANNED=["act now","buy now","click here","click below","limited time","limited offer","exclusive deal","special offer","risk-free","no obligation","100% free","make money","double your","guaranteed results","winner","congratulations","i hope this finds you well","hope this email finds you well","i hope this email finds you","picture this","what if i told you","in today's fast-paced world","game-changer","game changer","cutting-edge solution","revolutionize your","unlock your","supercharge your","as an ai","i'm an ai","i am an ai","as a language model","reaching out","just wanted to","worth a quick chat"];
const EMAIL_RE=/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
const GENERIC_LOCAL=/^(info|contact|hello|hi|office|sales|admin|support|enquiries|enquiry|mail|team|owner|reception|care)$/i;
const RANK={verified:4,given:3,risky:2,guess:1,invalid:0,'':0};
function normalizeDomain(s){s=String(s||'').trim().toLowerCase();if(!s)return '';s=s.replace(/^[a-z]+:\/\//,'').replace(/^www\./,'').split(/[\/?#]/)[0].replace(/:\d+$/,'');return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)?s:''}
function isJunk(domain,name){if(domain&&JUNK_DOMAIN.some(r=>r.test(domain)))return true;return !!(name&&JUNK_NAME.some(r=>r.test(name)))}
function nameFromDomain(d){return (d||'').split('.')[0].replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
function fold(t){return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function titleMatches(title,targets){
  const t=' '+fold(title).replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim()+' ';
  const aide=/ (assistant|assistante|secretary|deputy|aide) /.test(t);
  return (targets||[]).some(x=>{const w=fold(x).replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();if(aide&&!/assistant|secretary|deputy|aide/.test(w))return false;return w&&t.includes(' '+w+' ')});
}
function guessEmail(first,last,domain){const f=fold(first).replace(/[^a-z]/g,''),l=fold(last).replace(/[^a-z]/g,'');if(!domain||!f)return '';return (l?f+'.'+l:f)+'@'+domain}
function dncMatch(email,domain,list){const e=String(email||'').toLowerCase(),d=(domain||e.split('@')[1]||'').toLowerCase();
  return (list||[]).some(x=>{x=x.toLowerCase().trim();if(!x)return false;if(x.includes('@'))return e===x;return d===x||d.endsWith('.'+x)})}
function bestContact(l,cfg){const cs=(l.contacts||[]).filter(c=>c.email||c.first).map(c=>({c,s:(RANK[c.status||'']||0)+(titleMatches(c.title,cfg.titles)?10:0)+(c.first?2:0)-(c.general?1:0)}));cs.sort((a,b)=>b.s-a.s);return cs[0]?cs[0].c:null}
function scoreFit(l,cfg){
  if(dncMatch('',l.domain,cfg.dnc))return {score:0,reasons:['on the do-not-contact list']};
  let s=0;const r=[];const cat=fold(l.category);
  if(cat&&(cfg.industries||[]).some(i=>{i=fold(i);return i&&(cat.includes(i)||i.includes(cat))})){s+=20;r.push('sector: '+l.category)}
  const live=(l.contacts||[]).filter(c=>c.status!=='invalid'),named=live.filter(c=>c.first);
  const maker=named.find(c=>cfg.titles.length&&titleMatches(c.title,cfg.titles));
  if(maker){s+=30;r.push('decision maker: '+maker.title)}else if(named.length){s+=15;r.push('named contact, not a target title')}else if(live.length){s+=5;r.push('general inbox only')}
  const best=Math.max(0,...live.filter(c=>c.email).map(c=>({verified:25,given:12,risky:12,guess:5})[c.status]||0));
  if(best){s+=best;r.push({25:'verified email',12:'email given, not verified',5:'guessed email'}[best])}else if(l.phone){s+=5;r.push('phone only')}else r.push('no way to reach yet');
  const b=Math.max(0,Math.min(25,Number(l.buying)||0));if(b){s+=b;r.push('buying signal: '+(l.buyingReason||'found on their page'))}
  return {score:Math.min(100,s),reasons:r};
}
const OPT_OUT_RE=/\b(unsubscribe|opt[- ]?out|remove me|take me off|stop (emailing|sending|contacting|writing|mailing)|do not (email|contact|write)|don'?t (email|contact|write)|not interested|no,? thanks?|no thank you|leave me alone)\b/i;
const BARE_STOP=/^\s*(stop|unsubscribe|remove)\W*$/i;
const AUTO_RE=/(out of (the )?office|automatic reply|auto[- ]?reply|autoreply|away from (the )?office|on (annual |maternity |paternity )?leave|do not reply to this|this mailbox is not monitored)/i;
const LEGAL_RE=/\b(lawyer|attorney|legal action|sue you|solicitor|spam complaint|report you|harass(ment|ing)?)\b/i;
function triage(text){if(AUTO_RE.test(text))return 'auto';if(OPT_OUT_RE.test(text)||BARE_STOP.test(text))return LEGAL_RE.test(text)?'optout_legal':'optout';if(LEGAL_RE.test(text))return 'legal';return 'read'}
function emailsOnPage(t){t=String(t||'').replace(/\s*[\[(]\s*at\s*[\])]\s*/gi,'@').replace(/\s*[\[(]\s*dot\s*[\])]\s*/gi,'.');
  const out=new Set();(t.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g)||[]).forEach(e=>{e=e.toLowerCase().replace(/[.,;:]+$/,'');if(!/\.(png|jpe?g|gif|svg|webp|css|js)$/.test(e)&&!/(sentry|example|wixpress|domain)\./.test(e))out.add(e)});return [...out]}
function phonesOnPage(t){const m=String(t||'').match(/(\+?\d[\d\s().\-]{8,16}\d)/g)||[];return [...new Set(m.map(s=>s.trim()))].slice(0,3)}
function fixDashes(s){return String(s||'').replace(/\s[—–]\s/g,', ').replace(/!/g,'.')}
function footerText(cfg){return [cfg.optOut,cfg.address].filter(Boolean).join('\n')}
function finalMail(l,cfg){const d=l.draft;if(!d)return '';const first=(cfg.senderName||'').split(/\s+/)[0];return d.body.trim()+(first?'\n\n'+first:'')+(footerText(cfg)?'\n\n'+footerText(cfg):'')}
function preSend(l,cfg){
  const d=l.draft,out=[];if(!d)return out;const c=(l.contacts||[])[d.contact]||null,email=(c&&c.email)||'';const add=(k,t)=>out.push({k,t});
  if(!email)add('f','no email address for this contact');else if(!EMAIL_RE.test(email))add('f','address is not valid: '+email);
  if(c){if(c.status==='guess')add('f','address is a guess. Bharat Sales never sends to a guess: verify it or find the real one');
    else if(c.status==='invalid')add('f','address was marked invalid');else if(c.status==='risky')add('w','catch-all domain: some mail may bounce');
    else if(c.status==='given')add('w','address not verified (checking it first lowers bounces)');else if(c.status==='verified')add('o','address verified')}
  if(dncMatch(email,l.domain,cfg.dnc))add('f','on your do-not-contact list');
  if(l.status==='opted_out')add('f','this person opted out');
  const body=d.body||'',low=(body+' '+(d.subject||'')).toLowerCase();
  if(/\{\{\s*\w+\s*\}\}|\{\s*\w+\s*\}|\[\s*(first )?name\s*\]|\[company\]|\[\[/i.test(body+d.subject))add('f','unfilled merge tag');
  const hits=BANNED.filter(p=>low.includes(p));if(hits.length)add('f','banned phrase: '+hits.slice(0,3).join(', '));
  const words=body.trim().split(/\s+/).filter(Boolean).length;
  if(!body.trim())add('f','email is empty');else if(words>cfg.maxWords)add('f','too long: '+words+' words (limit '+cfg.maxWords+')');else add('o',words+' words');
  const links=(body.match(/https?:\/\/\S+/gi)||[]).length;if(links>1)add('f','more than one link');else if(links===1)add('w','contains a link');
  if(!d.subject||d.subject.length>90)add('f','subject missing or over 90 characters');
  if((body.match(/\?/g)||[]).length>1)add('w','more than one question');
  if(!cfg.optOut)add('w','no opt-out line set in Setup');if(!cfg.senderName)add('w','no sender name set in Setup');
  return out;
}
function parseLine(line,d){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];
  if(q){if(ch==='"'){if(line[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch}else if(ch==='"')q=true;else if(ch===d){out.push(cur);cur=''}else cur+=ch}out.push(cur);return out.map(s=>s.trim())}
const HEAD={name:['name','business','company','business name','company name'],website:['website','url','domain','site','web'],phone:['phone','mobile','tel','telephone'],city:['city','location','town','address','area'],category:['category','type','industry','sector'],email:['email','e-mail','mail'],contact:['contact','contact name','person','owner'],title:['title','role','designation','position'],notes:['notes','note','comments']};
function parsePaste(text){const lines=String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(!lines.length)return [];
  const delim=l=>l.includes('\t')?'\t':l.includes('|')?'|':',';let cols=['name','website','phone','city','category','email','contact','title','notes'],start=0;
  const map=parseLine(lines[0],delim(lines[0])).map(s=>s.toLowerCase()).map(h=>Object.keys(HEAD).find(k=>HEAD[k].includes(h))||'');
  if(map.filter(Boolean).length>=2){cols=map;start=1}
  return lines.slice(start).map(l=>{const parts=parseLine(l,delim(l)),r={};parts.forEach((v,i)=>{if(cols[i]&&v&&!r[cols[i]])r[cols[i]]=v});if(parts.length===1&&normalizeDomain(parts[0])){r.website=parts[0];delete r.name}return r})}
function uid(){return Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4)}
function leadFromRow(r){const domain=normalizeDomain(r.website),name=r.name||nameFromDomain(domain);
  const l={id:'lead_'+uid(),name,website:r.website||'',domain,phone:r.phone||'',city:r.city||'',category:r.category||'',notes:r.notes||'',status:'new',contacts:[],signals:[],buying:0,buyingReason:'',history:[],createdAt:new Date().toISOString()};
  if(r.email||r.contact){const parts=(r.contact||'').split(/\s+/).filter(Boolean),gen=r.email&&GENERIC_LOCAL.test(r.email.split('@')[0]);
    l.contacts.push({first:parts[0]||'',last:parts.slice(1).join(' '),title:r.title||'',email:r.email||'',status:r.email?'given':'',general:!!gen&&!parts.length})}
  return l}
function toCSV(rows){return rows.map(r=>r.map(v=>{v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(',')).join('\n')}

/* Scheduling: your weekly availability in your own time zone, turned into real, non-overlapping slots. */
function validTz(tz){try{new Intl.DateTimeFormat('en',{timeZone:tz});return true}catch(e){return false}}
function tzParts(date,tz){const o={};new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(date).forEach(x=>o[x.type]=x.value);return o}
function zonedToUtc(y,m,d,h,mi,tz){const W=Date.UTC(y,m-1,d,h,mi);let T=W;for(let i=0;i<2;i++){const p=tzParts(new Date(T),tz);const wall=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);T=W-(wall-T)}return new Date(T)}
function fmtSlot(iso,tz){return new Intl.DateTimeFormat(undefined,{timeZone:validTz(tz)?tz:'UTC',weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(iso))}
function hasAvail(cfg){return DAYS.some(d=>{const a=cfg.avail&&cfg.avail[d];return a&&a.on&&a.start&&a.end&&a.start<a.end})}
function nextSlots(cfg,count,taken,from){
  from=from||new Date();const tz=validTz(cfg.tz)?cfg.tz:'UTC',dur=+cfg.duration||30,buf=+cfg.buffer||0,earliest=from.getTime()+(+cfg.notice||0)*36e5,horizon=+cfg.horizon||14;
  const span=(dur+buf)*60000,tk=(taken||[]).map(t=>new Date(t).getTime()),t0=tzParts(from,tz),base=Date.UTC(+t0.year,+t0.month-1,+t0.day),perDay=[];
  for(let i=0;i<=horizon;i++){const day=new Date(base+i*864e5),a=cfg.avail&&cfg.avail[DAYS[day.getUTCDay()]];if(!a||!a.on||!a.start||!a.end)continue;
    const [sh,sm]=a.start.split(':').map(Number),[eh,em]=a.end.split(':').map(Number),c=[];
    for(let m=sh*60+sm;m+dur<=eh*60+em;m+=dur+buf){const s=zonedToUtc(day.getUTCFullYear(),day.getUTCMonth()+1,day.getUTCDate(),Math.floor(m/60),m%60,tz).getTime();
      if(s<earliest)continue;if(tk.some(t=>s<t+span&&t<s+span))continue;c.push(new Date(s).toISOString())}
    if(c.length)perDay.push(c)}
  const out=[];perDay.forEach(c=>{if(out.length<count)out.push(c[0])});
  for(let k=1;out.length<count&&k<20;k++)perDay.forEach(c=>{if(out.length<count&&c[k])out.push(c[k])});
  return out.sort();
}
function formatLine(cfg){return 'Format: '+(cfg.meetMode||'Call')+(cfg.meetDetail?' ('+cfg.meetDetail+')':'')}
function customToIso(v,tz){const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v||'');return m?zonedToUtc(+m[1],+m[2],+m[3],+m[4],+m[5],validTz(tz)?tz:'UTC').toISOString():''}
function icsFor(l,cfg){const z=iso=>new Date(iso).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),m=l.meeting;
  const esc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Bharat Sales//EN','BEGIN:VEVENT','UID:'+l.id+'@bharat-sales','DTSTAMP:'+z(new Date().toISOString()),'DTSTART:'+z(m.start),'DTEND:'+z(m.end),
    'SUMMARY:'+esc((m.mode||'Meeting')+' with '+l.name),'LOCATION:'+esc(m.detail||''),'DESCRIPTION:'+esc(cfg.website?'More about us: '+cfg.website:''),'END:VEVENT','END:VCALENDAR'].join('\r\n')}
/* Follow-ups: due N days after the last send, only while nobody has replied, opted out or booked. */
const DAYMS=864e5;
function gapFor(cfg,n){const g=(cfg.gaps&&cfg.gaps.length?cfg.gaps:[3]);return +g[Math.min(n-1,g.length-1)]||3}
function lastSent(l){const h=l.history||[];return h.length?h[h.length-1]:null}
function followupDue(l,cfg,now){const h=l.history||[];now=now||Date.now();if(l.status!=='sent'||!h.length||l.draft)return false;if(h.length>(+cfg.followUps||0))return false;
  return now-new Date(h[h.length-1].at).getTime()>=gapFor(cfg,h.length)*DAYMS}
function followupDueIn(l,cfg,now){const h=l.history||[];if(l.status!=='sent'||!h.length||h.length>(+cfg.followUps||0))return null;now=now||Date.now();
  return Math.max(0,Math.ceil((new Date(h[h.length-1].at).getTime()+gapFor(cfg,h.length)*DAYMS-now)/DAYMS))}
function heldSlots(leads,exceptId){const t=[];leads.forEach(l=>{if(l.id===exceptId)return;if(l.meeting&&l.meeting.start)t.push(l.meeting.start);else (l.offered||[]).forEach(x=>t.push(x))});return t}
function assembleReply(r,cfg,slots){
  let d=fixDashes(r.draft||'').trim();const wants=!!r.wants_meeting;
  const block=slots.length?slots.map(s=>'• '+fmtSlot(s,cfg.tz)).join('\n')+'\n'+formatLine(cfg):'';
  if(wants){if(!slots.length)d=d.replace(/\[\[SLOTS\]\]/g,'[add times here: no open times in your availability]');else if(d.includes('[[SLOTS]]'))d=d.replace('[[SLOTS]]',block);else d+='\n\n'+block}
  d=d.replace(/\[\[SLOTS\]\]/g,'');
  const web=(r.wants_info||r.cls==='question')&&cfg.website?'More about us: '+cfg.website:'';
  if(d.includes('[[WEBSITE]]'))d=d.replace('[[WEBSITE]]',web);else if(web)d+='\n\n'+web;
  return d.replace(/\[\[WEBSITE\]\]/g,'').replace(/\n{3,}/g,'\n\n').trim();
}
function confirmBase(l,cfg){const c=bestContact(l,cfg),first=c&&c.first?c.first:'';const me=(cfg.senderName||'').split(/\s+/)[0];
  return (first?'Hi '+first+',':'Hi,')+'\n\nConfirmed: '+l.meeting.label+'.\n'+formatLine(cfg)+'.'+(cfg.website?'\nMore about us: '+cfg.website:'')+'\n\nIf anything changes, just reply here and we will find another time.'+(me?'\n\n'+me:'')}

/* ═══════ State and storage (this browser only: no accounts, nothing is sent to us) ═══════ */
const KEY='sbw:v1',AIKEY='sbw:ai';
const PROVIDERS={
  anthropic:{label:'Anthropic (Claude)',model:'claude-sonnet-5-5',where:'console.anthropic.com, under API keys'},
  openai:{label:'OpenAI',model:'gpt-4o-mini',where:'platform.openai.com, under API keys'},
  gemini:{label:'Google Gemini',model:'gemini-2.0-flash',where:'aistudio.google.com, under Get API key'},
  openrouter:{label:'OpenRouter',model:'openai/gpt-4o-mini',where:'openrouter.ai, under Keys'}};
const S={cfg:defCfg(),leads:[],tab:'overview',sel:null,busy:{},paste:'',page:{},reply:'',replyLead:'',plan:null,findMsg:'',csvOut:'',
  osm:{cat:'dentist',custom:'',place:'',results:[],msg:''},ai:{provider:'anthropic',key:'',model:''},wipe:false};
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg,err){const t=$('#toast');t.textContent=msg;t.className=err?'err':'';t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,err?7000:2800)}
function persist(){try{localStorage.setItem(KEY,JSON.stringify({cfg:S.cfg,leads:S.leads}));return true}catch(e){toast('Your browser would not save the data (storage full or blocked). Export a backup from Settings.',true);return false}}
function persistAi(){try{localStorage.setItem(AIKEY,JSON.stringify(S.ai))}catch(e){}}
function loadAll(){
  try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(d){S.cfg=mergeCfg(d.cfg);S.leads=Array.isArray(d.leads)?d.leads:[]}}catch(e){}
  try{const a=JSON.parse(localStorage.getItem(AIKEY)||'null');if(a&&PROVIDERS[a.provider])S.ai={...S.ai,...a}}catch(e){}}
async function saveLead(l){const i=S.leads.findIndex(x=>x.id===l.id);if(i<0)S.leads.unshift(l);else S.leads[i]=l;persist()}
async function removeLead(id){S.leads=S.leads.filter(x=>x.id!==id);if(S.sel===id)S.sel=null;persist()}
async function saveCfg(){persist()}

/* ═══════ AI calls ═══════ */
/* ═══════ AI calls: straight from your browser to the provider you chose, with your own key ═══════ */
const modelFor=()=>(S.ai.model||'').trim()||PROVIDERS[S.ai.provider].model;
function parseJson(t){t=String(t||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
  try{return JSON.parse(t)}catch(e){const m=t.match(/\{[\s\S]*\}/);if(m){try{return JSON.parse(m[0])}catch(e2){}}}return null}
async function callLLM(prompt){
  const {provider,key}=S.ai,model=modelFor(),headers={'content-type':'application/json'};let url,body,pick;
  if(provider==='anthropic'){url='https://api.anthropic.com/v1/messages';headers['x-api-key']=key;headers['anthropic-version']='2023-06-01';headers['anthropic-dangerous-direct-browser-access']='true';
    body={model,max_tokens:1500,messages:[{role:'user',content:prompt}]};pick=j=>(j.content||[]).map(c=>c.text||'').join('')}
  else if(provider==='gemini'){url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';headers['x-goog-api-key']=key;
    body={contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:1500}};pick=j=>(((j.candidates||[])[0]||{}).content||{parts:[]}).parts.map(p=>p.text||'').join('')}
  else{url=provider==='openai'?'https://api.openai.com/v1/chat/completions':'https://openrouter.ai/api/v1/chat/completions';headers.authorization='Bearer '+key;
    body={model,messages:[{role:'user',content:prompt}]};if(provider==='openai')body.response_format={type:'json_object'};pick=j=>((j.choices||[])[0]||{message:{}}).message.content||''}
  let r;try{r=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)})}catch(e){throw {code:'network',message:'Could not reach '+PROVIDERS[provider].label+'. Check your connection.'}}
  let j=null;try{j=await r.json()}catch(e){}
  if(!r.ok){const m=j&&((j.error&&(j.error.message||j.error))||j.message);throw {code:r.status===401||r.status===403?'auth':r.status===429?'rate':'http',message:typeof m==='string'?m:('HTTP '+r.status)}}
  return pick(j||{});
}
async function ask(prompt){
  if(!S.ai.key){toast('Add your AI key in Settings first.',true);S.tab='settings';render();return null}
  try{const j=parseJson(await callLLM(prompt));if(!j){toast('The AI answered in a format that could not be read. Try again.',true);return null}return j}
  catch(e){toast({auth:'The AI provider rejected your key. Check it in Settings.',rate:'The AI provider says too many requests. Wait a minute and try again.'}[e.code]||e.message||'The AI call failed.',true);return null}
}
const cfgBrief=c=>`Seller: ${c.senderName||'(name not set)'} at ${c.company||'(company not set)'}.\nWhat is sold: ${c.product||'(not set)'}. ${c.description||''}\nBenefits: ${(c.benefits||[]).join('; ')||'(none given)'}\nOffer (the next step): ${c.offer||'(none given)'}`;

/* ═══════ Actions ═══════ */
async function withBusy(key,fn){if(S.busy[key])return;S.busy[key]=true;render();try{await fn()}finally{delete S.busy[key];render()}}
const sel=()=>S.leads.find(l=>l.id===S.sel);
const byId=id=>S.leads.find(x=>x.id===id);

async function actProfile(){const txt=$('#profile-src').value.trim();if(!txt){toast('Write a few sentences about your business first.',true);return}
  await withBusy('profile',async()=>{
    const r=await ask(`Read this description of a business and fill a setup form. Use only what the text says; leave a field empty ("" or []) when the text does not say. Do not invent.
Return only JSON: {"company":"","product":"short name of what is sold","description":"1-2 sentences","benefits":["max 4"],"offer":"the low-commitment next step offered, if stated","industries":["types of business that would buy it"],"titles":["job titles of the people who decide"],"hiringSignals":["roles whose hiring would signal need"],"geography":"","website":"only if a web address is in the text"}
TEXT:
${txt.slice(0,6000)}`);
    if(!r)return;const c=S.cfg;['company','product','description','offer','geography','website'].forEach(k=>{if(r[k])c[k]=String(r[k])});
    ['benefits','industries','titles','hiringSignals'].forEach(k=>{if(Array.isArray(r[k])&&r[k].length)c[k]=r[k].map(String)});
    await saveCfg();toast('Setup filled. Check each field and fix what is off.')})}
async function addRows(rows){
  let added=0,junk=0,dup=0,dnc=0;const seen=new Set(S.leads.map(l=>l.domain||(l.name+l.phone).toLowerCase())),fresh=[];
  for(const r of rows){const l=leadFromRow(r),key=l.domain||(l.name+l.phone).toLowerCase();
    if(isJunk(l.domain,l.name)){junk++;continue}if(dncMatch(l.contacts[0]?.email,l.domain,S.cfg.dnc)){dnc++;continue}if(seen.has(key)){dup++;continue}
    seen.add(key);l.fit=scoreFit(l,S.cfg);fresh.push(l);added++}
  for(const l of fresh)await saveLead(l);
  return `Added ${added}. Left out ${junk} directory or aggregator${junk===1?'':'s'}, ${dup} duplicate${dup===1?'':'s'}${dnc?`, ${dnc} on the do-not-contact list`:''}.`;
}
async function actAddPaste(){const rows=parsePaste(S.paste);if(!rows.length){toast('Nothing to add. Paste at least one line.',true);return}
  S.findMsg=await addRows(rows);if(!/Added 0\./.test(S.findMsg))S.paste='';render()}
function actExamples(){S.paste=`name, website, phone, city, category, email, contact, title
Harbor Dental Studio, harbordental.test, 555 0101, Portland, dentist, elena@harbordental.test, Elena Park, Owner
Highline Roofing, highline-roofing.test, 555 0102, Denver, roofer, info@highline-roofing.test
Northwind HVAC, northwindhvac.test, 555 0103, Phoenix, hvac, , Marcus Webb, Operations Manager
Top 10 Roofers in Denver, best-roofers-directory.test, , Denver, roofer
Yelp listing, biz.yelp.com/biz/harbor-dental, , Portland, dentist`;
  S.findMsg='Invented examples on .test domains. The last two should be dropped as directories.';render()}
async function actPlan(){const c=S.cfg;if(!(c.industries.length||c.product)){toast('Fill in Setup first (what you sell and who buys it).',true);return}
  await withBusy('plan',async()=>{const r=await ask(`Suggest up to 8 search phrases for finding BUSINESSES that match this customer profile, to type into Google Maps or Google. Each phrase names a business type and a place. Use only the profile; if no place is given, leave the place out.
Return only JSON: {"queries":[{"q":"phrase","why":"max 12 words"}]}
${cfgBrief(c)}
Business types that buy: ${c.industries.join(', ')||'(not set)'}. Place: ${c.geography||'(not set)'}.`);
    if(r&&Array.isArray(r.queries))S.plan=r.queries.slice(0,8)})}
async function actReadPage(){const l=sel();if(!l)return;const text=(S.page[l.id]||'').trim();if(text.length<40){toast('Paste the text of their homepage or About page first.',true);return}
  await withBusy('page',async()=>{
    for(const e of emailsOnPage(text)){if(!l.contacts.some(c=>c.email===e)){l.contacts.push({first:'',last:'',title:'',email:e,status:'given',general:GENERIC_LOCAL.test(e.split('@')[0]),source:'page'})}}
    if(!l.phone){const p=phonesOnPage(text)[0];if(p)l.phone=p}
    const r=await ask(`Read this page text from a business's own website. Report only what the text itself says.
1. people: owners or managers named with a title. "name" must appear in the text exactly. "evidence" is a short exact quote.
2. signals: concrete facts that suggest they need what is sold below (a gap, a hiring post, ads, no online booking). "evidence" is a short exact quote or a plain observation about absence you can justify from the text.
3. buying: 0 to 25, how strongly the text suggests they need it now. 0 when nothing does.
4. category: what kind of business this is, in 1-3 words.
Return only JSON: {"people":[{"name":"","title":"","evidence":""}],"signals":[{"signal":"","evidence":""}],"buying":0,"buyingReason":"max 12 words","category":""}
${cfgBrief(S.cfg)}
Roles that signal need: ${S.cfg.hiringSignals.join(', ')||'(none given)'}
PAGE TEXT:
${text.slice(0,12000)}`);
    if(r){const low=fold(text);
      (r.people||[]).filter(p=>p&&p.name&&low.includes(fold(p.name))).slice(0,2).forEach(p=>{const parts=String(p.name).trim().split(/\s+/);
        if(!l.contacts.some(c=>fold(c.first+' '+c.last)===fold(p.name)))l.contacts.push({first:parts[0],last:parts.slice(1).join(' '),title:p.title||'',email:'',status:'',source:'page'})});
      l.signals=(r.signals||[]).filter(s=>s&&s.signal).slice(0,6).map(s=>({signal:String(s.signal),evidence:String(s.evidence||'')}));
      l.buying=Math.max(0,Math.min(25,Number(r.buying)||0));l.buyingReason=String(r.buyingReason||'');if(!l.category&&r.category)l.category=String(r.category);
      toast('Page read. Names are kept only when they appear in the text.')}
    l.fit=scoreFit(l,S.cfg);await saveLead(l)})}
const WRITE_RULES=`Plain words a busy person types on a phone. Never invent a fact, number, result, client or claim. No links, no lists, no exclamation marks, no dash between words, one question only, no sign-off or name at the end. No "hope this finds you", "reaching out", "just wanted to". If asked whether you are an AI you would say yes; never pretend to be a person.`;
async function actWrite(id){const l=byId(id);if(!l)return;const c=S.cfg;l.fit=scoreFit(l,c);
  if(c.minScore&&l.fit.score<c.minScore){toast(`Score ${l.fit.score} is under your minimum of ${c.minScore}.`,true);return}
  const contact=bestContact(l,c);if(!contact){toast('Add a contact or an email address first.',true);return}
  if(!(c.product||c.description)){toast('Fill in what you sell in Setup first.',true);return}
  await withBusy('write'+id,async()=>{
    const facts=[`Business: ${l.name}`,l.category&&`Type: ${l.category}`,l.city&&`Place: ${l.city}`,l.website&&`Website: ${l.domain}`,...(l.signals||[]).map(s=>`Finding: ${s.signal}${s.evidence?' ('+s.evidence+')':''}`),l.notes&&`Seller's note: ${l.notes}`].filter(Boolean);
    const r=await ask(`Write a first cold email. Language: ${c.language}.
${cfgBrief(c)}
Recipient: ${contact.first?contact.first+' '+(contact.last||''):'a general company inbox'}${contact.title?', '+contact.title:''}.
FACTS (the only things you may state about them):
${facts.join('\n')}

RULES. 30 to 60 words. ${WRITE_RULES} Greeting by first name ("Hi Sam,") or "Hi there," for a general inbox.
Line 1: one specific FACT that points to a problem the seller solves, stated as fact. Line 2: what it costs them, one plain sentence. Then one yes-or-no question that offers the Offer as the fix.
Subject: 2 to 5 words, lowercase, not "quick question".
If the FACTS contain nothing that points to a problem the seller solves, do not write a generic email: return {"no_tip":true,"subject":"","body":""}.
Return only JSON: {"no_tip":false,"subject":"","body":""}`,'default');
    if(!r)return;
    if(r.no_tip||!String(r.body||'').trim()){l.status='no_tip';l.draft=null;toast(`Nothing true to build an email on for ${l.name}. Paste their page text so it can find something.`,true)}
    else{l.draft={kind:'first',subject:fixDashes(r.subject).trim(),body:fixDashes(r.body).trim(),contact:l.contacts.indexOf(contact),approved:false,at:new Date().toISOString()};l.status='drafted'}
    await saveLead(l)})}
async function actWriteAll(){const todo=S.leads.filter(l=>!l.draft&&['new','no_tip'].includes(l.status)&&bestContact(l,S.cfg));
  if(!todo.length){toast('No leads with a contact and no draft yet.',true);return}
  for(const l of todo.slice(0,10))await actWrite(l.id);toast(todo.length>10?'Wrote the first 10. Run again for the rest.':'Done writing.')}
async function actFollowup(id){const l=byId(id);if(!l)return;const h=l.history||[];if(!h.length)return;const c=S.cfg,n=h.length;
  const contact=(l.contacts||[])[h[n-1].contact]||bestContact(l,c);if(!contact){toast('This lead has no contact.',true);return}
  await withBusy('fu'+id,async()=>{
    const prior=h.map((m,i)=>`Email ${i+1} (sent ${new Date(m.at).toDateString()}):\n${m.body.split('\n\n').slice(0,-2).join('\n\n')||m.body}`).join('\n\n');
    const r=await ask(`Write follow-up number ${n} to a cold email that got no reply. Language: ${c.language}.
${cfgBrief(c)}
Recipient: ${contact.first||'a general company inbox'}.
WHAT WAS ALREADY SENT:
${prior.slice(0,3000)}

RULES. 15 to 40 words. A gentle nudge, not a repeat: do not copy earlier wording, and state no new facts, numbers or claims beyond what was already sent. ${WRITE_RULES}
${n>=(+c.followUps||1)?'This is the last one: make it easy to say no, for example by offering to stop here.':''}
Subject: 2 to 5 words, lowercase.
Return only JSON: {"subject":"","body":""}`,'default');
    if(!r||!String(r.body||'').trim())return;
    l.draft={kind:'followup',step:n,subject:fixDashes(r.subject).trim(),body:fixDashes(r.body).trim(),contact:l.contacts.indexOf(contact),approved:false,at:new Date().toISOString()};l.status='drafted';await saveLead(l);toast('Follow-up drafted. Review it in the Outbox.')})}
async function actFollowAll(){const due=S.leads.filter(l=>followupDue(l,S.cfg));for(const l of due.slice(0,10))await actFollowup(l.id)}
async function actReply(){const l=byId(S.replyLead),text=S.reply.trim();
  if(!l){toast('Pick which lead this reply is from.',true);return}if(!text){toast('Paste the reply first.',true);return}
  const t=triage(text);l.thread=l.thread||[];l.thread.push({dir:'in',text,at:new Date().toISOString()});
  if(t==='auto'){l.thread[l.thread.length-1].kind='auto-reply';await saveLead(l);S.reply='';toast('Auto-reply. Set aside, nothing drafted.');render();return}
  if(t==='optout'||t==='optout_legal'){l.status='opted_out';l.replyDraft=null;l.offered=[];l.thread[l.thread.length-1].kind=t==='optout_legal'?'opt-out + legal threat':'opt-out';
    await saveLead(l);S.reply='';toast(t==='optout_legal'?'Opt-out recorded. It also mentions legal action: handle this one yourself.':'Opt-out recorded. This person will not be written to again.');render();return}
  if(t==='legal'){l.replyDraft={cls:'legal',summary:'Mentions legal action or a complaint. Handle yourself, no draft.',draft:'',slots:[]};if(l.status!=='booked')l.status='replied';await saveLead(l);S.reply='';render();return}
  const c=S.cfg;
  await withBusy('reply',async()=>{
    const hist=(lastSent(l)?'Our last email:\n'+lastSent(l).body+'\n\n':'')+'Their reply:\n'+text;
    const r=await ask(`Read a reply to a cold email and draft an answer. Language: ${c.language}.
${cfgBrief(c)}
${hist.slice(0,5000)}

Decide:
- cls: one of interested, meeting, question, objection, not_now, other.
- wants_meeting: true if they want a call, meeting, demo or to pick a time.
- wants_info: true if they ask for more information, details or where to read more.
- their_time: the exact time or day they proposed, quoted, or "" if none.
Draft a short plain answer (under 70 words) that answers only what they asked and never invents facts, prices or promises not given above.
If wants_meeting: write one line saying you would be glad to talk and put the exact token [[SLOTS]] on its own line where the available times go. Do NOT write any times, dates or meeting links yourself. If they proposed their own time, say you will confirm it shortly.
If wants_info: put the exact token [[WEBSITE]] on its own line where a link to more information goes. Do NOT write any web address yourself.
No dash between words, no exclamation marks. If you cannot answer from the facts given, say what you would need in one line.
Return only JSON: {"cls":"","summary":"max 15 words","wants_meeting":false,"wants_info":false,"their_time":"","draft":""}`,'default');
    if(!r)return;
    const wants=!!r.wants_meeting,slots=wants&&hasAvail(c)?nextSlots(c,3,heldSlots(S.leads,l.id)):[];
    const draft=assembleReply(r,c,slots);
    l.replyDraft={cls:String(r.cls||'other'),summary:String(r.summary||''),draft,slots,wantsMeeting:wants,wantsInfo:!!r.wants_info,theirTime:String(r.their_time||'')};
    l.offered=slots;if(l.status!=='booked')l.status='replied';await saveLead(l);S.reply='';
    if(wants&&!hasAvail(c))toast('They want to meet, but no availability is set. Add your times in Setup.',true);
    else if(r.wants_info&&!c.website)toast('They asked for more information. Add your website in Setup so replies can share it.',true)})}
async function confirmText(l){let t=confirmBase(l,S.cfg);const lang=(S.cfg.language||'English').trim();
  if(lang&&!/^english/i.test(lang)){const r=await ask(`Translate this email into ${lang}. Keep every date, time, web address, name and number exactly as written. Return only JSON: {"text":""}\n\n${t}`);if(r&&r.text)t=String(r.text)}return t}
async function bookSlot(l,startISO){const c=S.cfg,dur=+c.duration||30,end=new Date(new Date(startISO).getTime()+dur*60000).toISOString(),clash=heldSlots(S.leads,l.id).some(t=>Math.abs(new Date(t)-new Date(startISO))<(dur+(+c.buffer||0))*60000);
  if(clash){toast('That time clashes with another meeting or a time you offered someone else.',true);return}
  l.meeting={start:startISO,end,label:fmtSlot(startISO,c.tz),mode:c.meetMode,detail:c.meetDetail,at:new Date().toISOString()};l.offered=[];l.status='booked';
  if(l.replyDraft)l.replyDraft.slots=[];
  await withBusy('book'+l.id,async()=>{l.confirm=await confirmText(l);await saveLead(l)});toast('Booked: '+l.meeting.label)}
async function exportCSV(which){const set=S.leads.filter(l=>which==='approved'?(l.draft&&l.draft.approved):true);
  if(!set.length){toast(which==='approved'?'Nothing approved yet.':'No leads yet.',true);return}
  const rows=[['name','website','phone','city','category','score','status','contact','title','email','email_status','subject','email_body','meeting']];
  for(const l of set){const c=bestContact(l,S.cfg)||{};rows.push([l.name,l.website,l.phone,l.city,l.category,scoreFit(l,S.cfg).score,l.status,((c.first||'')+' '+(c.last||'')).trim(),c.title||'',c.email||'',c.status||'',l.draft?l.draft.subject:'',l.draft?finalMail(l,S.cfg):'',l.meeting?l.meeting.label:''])}
  await save(toCSV(rows),which==='approved'?'bharat-sales-approved.csv':'bharat-sales-leads.csv')}
async function save(data,filename){
  const type=filename.endsWith('.ics')?'text/calendar':filename.endsWith('.json')?'application/json':'text/csv';
  const url=URL.createObjectURL(new Blob([(type==='text/csv'?'﻿':'')+data],{type:type+';charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('Saved '+filename)}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('Copied.')}catch(e){toast('Copy was blocked. Select the text and copy it yourself.',true)}}

/* ═══════ Discovery from OpenStreetMap, reading websites, mail links ═══════ */
const OSM_CATS={
  dentist:['Dentists',[['amenity','dentist']]],doctor:['Doctors and clinics',[['amenity','doctors'],['amenity','clinic']]],pharmacy:['Pharmacies',[['amenity','pharmacy']]],
  school:['Schools',[['amenity','school']]],college:['Colleges and universities',[['amenity','college'],['amenity','university']]],
  coaching:['Coaching and training centres',[['amenity','training'],['office','educational_institution'],['amenity','language_school']]],library:['Libraries',[['amenity','library']]],
  restaurant:['Restaurants',[['amenity','restaurant']]],cafe:['Cafes',[['amenity','cafe']]],hotel:['Hotels and guest houses',[['tourism','hotel'],['tourism','guest_house']]],
  gym:['Gyms',[['leisure','fitness_centre']]],salon:['Salons and barbers',[['shop','hairdresser'],['shop','beauty']]],
  lawyer:['Lawyers',[['office','lawyer']]],accountant:['Accountants',[['office','accountant']]],realestate:['Real estate agents',[['office','estate_agent']]],insurance:['Insurance agents',[['office','insurance']]],
  carrepair:['Car repair shops',[['shop','car_repair']]],roofer:['Roofers',[['craft','roofer']]],plumber:['Plumbers',[['craft','plumber']]],electrician:['Electricians',[['craft','electrician']]],
  hvac:['HVAC contractors',[['craft','hvac']]],builder:['Builders and contractors',[['craft','builder'],['office','construction_company']]],
  bakery:['Bakeries',[['shop','bakery']]],supermarket:['Shops and supermarkets',[['shop','supermarket'],['shop','convenience']]],bookshop:['Bookshops and stationers',[['shop','books'],['shop','stationery']]],
  bank:['Banks',[['amenity','bank']]],company:['Companies and offices',[['office','company']]]};
async function overpass(q){const eps=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];let last;
  for(const ep of eps){try{const r=await fetch(ep,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q)});if(r.ok)return await r.json();last=new Error('HTTP '+r.status)}catch(e){last=e}}throw last}
async function actOsm(){
  const o=S.osm,place=o.place.trim();if(!place){toast('Enter a city or area first.',true);return}
  let tags;if(o.cat==='custom'){const m=/^\s*([a-z_:]+)\s*=\s*([a-z0-9_:\-]+)\s*$/i.exec(o.custom);if(!m){toast('A custom tag looks like key=value, for example amenity=dentist.',true);return}tags=[[m[1],m[2]]]}else tags=OSM_CATS[o.cat][1];
  await withBusy('osm',async()=>{
    try{
      const g=await (await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(place))).json();
      if(!g.length){o.msg='Could not find "'+place+'". Try a city or district name.';o.results=[];return}
      const [s,n,w,e]=g[0].boundingbox.map(Number);
      if((n-s)>1.2||(e-w)>1.2){o.msg='That area is too large to search. Pick a city or district.';o.results=[];return}
      const q='[out:json][timeout:25];('+tags.map(([k,v])=>`nwr["${k}"="${v}"](${s},${w},${n},${e});`).join('')+');out center tags 400;';
      const j=await overpass(q),seen=new Set(),rows=[],label=o.cat==='custom'?o.custom.trim():OSM_CATS[o.cat][0],here=g[0].display_name.split(',')[0];
      for(const el of j.elements||[]){const t=el.tags||{};if(!t.name)continue;
        const website=t.website||t['contact:website']||'',email=(t.email||t['contact:email']||'').split(';')[0].trim(),phone=(t.phone||t['contact:phone']||'').split(';')[0].trim();
        const key=(t.name+'|'+(website||phone||el.id)).toLowerCase();if(seen.has(key))continue;seen.add(key);
        rows.push({name:t.name,website,email,phone,city:t['addr:city']||here,category:label,notes:[t['addr:housenumber'],t['addr:street'],t['addr:suburb']].filter(Boolean).join(' '),sel:!!(website||email)})}
      rows.sort((a,b)=>(!!(b.website||b.email))-(!!(a.website||a.email)));o.results=rows.slice(0,150);
      const withSite=o.results.filter(r=>r.website).length;
      o.msg=o.results.length?`Found ${o.results.length} named places in ${here}. ${withSite} list a website. Places without a website or email are left unticked.`:'Nothing found with that tag in that area. OpenStreetMap coverage varies by region.';
    }catch(e){o.msg='The map search failed ('+(e.message||'network')+'). Try again in a moment.';o.results=[]}
  });
}
async function actOsmAdd(){const rows=S.osm.results.filter(r=>r.sel).map(r=>({name:r.name,website:r.website,phone:r.phone,city:r.city,category:r.category,email:r.email,notes:r.notes}));
  if(!rows.length){toast('Tick at least one place.',true);return}S.osm.msg=await addRows(rows);S.osm.results=S.osm.results.filter(r=>!r.sel);render()}
async function fetchSite(l){
  if(!l.domain)return {error:'This lead has no website.'};const base='https://'+l.domain,parts=[];
  for(const p of ['','/contact','/about']){
    try{const r=await fetch('/api/fetch?url='+encodeURIComponent(base+p));let j=null;try{j=await r.json()}catch(e){}
      if(p===''&&!j)return {error:'Automatic fetching is only available on the deployed site. Paste the page text instead.'};
      if(r.ok&&j&&j.text)parts.push('--- '+base+p+' ---\n'+j.text+(j.emails&&j.emails.length?'\nEmails on page: '+j.emails.join(', '):''));
      else if(p==='')return {error:(j&&j.error)||'Could not fetch their website. Paste the page text instead.'}}
    catch(e){if(p==='')return {error:'Could not reach the fetch function. Paste the page text instead.'}}}
  return {text:parts.join('\n\n').slice(0,16000)};
}
async function actFetchSite(){const l=sel();if(!l)return;
  await withBusy('fetch',async()=>{const r=await fetchSite(l);if(r.error){toast(r.error,true);return}S.page[l.id]=r.text});
  if(S.page[l.id])await actReadPage()}
const gmailUrl=(to,su,body)=>'https://mail.google.com/mail/?view=cm&fs=1&to='+encodeURIComponent(to)+'&su='+encodeURIComponent(su)+'&body='+encodeURIComponent(body);
const mailtoUrl=(to,su,body)=>'mailto:'+encodeURIComponent(to).replace(/%40/g,'@')+'?subject='+encodeURIComponent(su)+'&body='+encodeURIComponent(body);
const mailBtns=(to,su,body)=>to&&EMAIL_RE.test(to)?`<a class="btn sm primary" href="${esc(gmailUrl(to,su,body))}" target="_blank" rel="noopener">Open in Gmail</a><a class="btn sm" href="${esc(mailtoUrl(to,su,body))}">Open in mail app</a>`:'';
async function actAiTest(){if(!S.ai.key){toast('Paste your API key first.',true);return}
  await withBusy('aitest',async()=>{try{const j=parseJson(await callLLM('Reply with only this JSON and nothing else: {"ok":true}'));toast(j&&j.ok?'Connected. The key works with '+modelFor()+'.':'The provider answered, but not as expected. Check the model name.',!(j&&j.ok))}
    catch(e){toast({auth:'The provider rejected the key.',rate:'Too many requests. Try again shortly.'}[e.code]||e.message||'Test failed.',true)}})}
function actImport(file){const rd=new FileReader();rd.onload=()=>{try{const d=JSON.parse(rd.result);if(!d||!Array.isArray(d.leads)||typeof d.cfg!=='object')throw 0;
  S.cfg=mergeCfg(d.cfg);S.leads=d.leads;S.sel=null;persist();toast('Imported '+S.leads.length+' leads.');render()}catch(e){toast('That file is not a Bharat Sales backup.',true)}};rd.readAsText(file)}

/* ═══════ Stats for the overview ═══════ */
const wk=iso=>iso&&Date.now()-new Date(iso).getTime()<7*DAYMS;
function stats(){const L=S.leads,H=l=>l.history||[];
  const f=(all,w)=>({n:L.filter(all).length,w:L.filter(w).length});
  return{found:f(()=>true,l=>wk(l.createdAt)),
    drafted:f(l=>l.draft||H(l).length,l=>(l.draft&&wk(l.draft.at))||H(l).some(h=>wk(h.at))),
    sent:f(l=>H(l).length,l=>H(l).some(h=>wk(h.at))),
    replied:f(l=>(l.thread||[]).some(m=>m.dir==='in'),l=>(l.thread||[]).some(m=>m.dir==='in'&&wk(m.at))),
    booked:f(l=>l.meeting,l=>l.meeting&&wk(l.meeting.at))}}

/* ═══════ Views ═══════ */
const ICON={overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  find:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',leads:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M16 4.7a3.5 3.5 0 010 6.6M18 14.8c2 .6 3.3 2.3 3.5 5.2"/>',
  outbox:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',replies:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 016 6v3"/>',
  meetings:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',setup:'<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',moon:'<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>'};
const ic=n=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
const STATUS={new:['New',''],drafted:['Draft ready','y'],approved:['Approved','good'],sent:['Sent','note'],replied:['Replied','note'],booked:['Meeting booked','good'],opted_out:['Opted out','bad'],skip:['Skipped',''],no_tip:['Nothing to write about','wait']};
const pill=s=>{const [t,k]=STATUS[s]||[s,''];return `<span class="pill ${k}">${esc(t)}</span>`};
const field=(label,id,val,extra='',hint='')=>`<label>${esc(label)}<input id="${id}" value="${esc(val)}" ${extra}>${hint?`<span class="hint">${esc(hint)}</span>`:''}</label>`;
const btn=(act,label,cls='',extra='',busyKey='')=>{const b=busyKey&&S.busy[busyKey];return `<button class="btn ${cls} ${b?'busy':''}" data-act="${act}" ${extra} ${b?'disabled':''}>${b?'Working…':esc(label)}</button>`};

function vOverview(){const st=stats(),L=S.leads,c=S.cfg;
  const dueFu=L.filter(l=>followupDue(l,c)),waiting=L.filter(l=>l.status==='drafted'&&l.draft),replyOpen=L.filter(l=>l.status==='replied'&&l.replyDraft&&l.replyDraft.draft);
  const up=L.filter(l=>l.meeting&&new Date(l.meeting.start)>new Date()).sort((a,b)=>a.meeting.start.localeCompare(b.meeting.start));
  const rate=st.sent.n?Math.round(st.replied.n/st.sent.n*100):0;
  const tile=(lab,val,pillTxt,sub)=>`<div class="tile"><div class="top"><span class="lab">${lab}</span>${pillTxt?`<span class="pill y">${esc(pillTxt)}</span>`:''}</div><div class="val">${val}</div><div class="sub">${sub}</div></div>`;
  const stages=[['Found',st.found],['Drafted',st.drafted],['Sent',st.sent],['Replied',st.replied],['Booked',st.booked]],max=Math.max(1,...stages.map(s=>s[1].n));
  const chart=`<div class="chart" role="img" aria-label="Pipeline by stage: ${stages.map(s=>s[0]+' '+s[1].n).join(', ')}"><span class="ax" style="top:-7px">${max}</span><span class="ax" style="top:calc(50% - 7px)">${Math.round(max/2*10)/10}</span><span class="ax" style="bottom:-7px">0</span>
    ${stages.map(s=>`<div class="grp"><div class="b k" style="height:${s[1].n/max*100}%" title="${s[0]}: ${s[1].n} in total"></div><div class="b y" style="height:${s[1].w/max*100}%" title="${s[0]}: ${s[1].w} in the last 7 days"></div></div>`).join('')}</div>
    <div class="xl">${stages.map(s=>`<span>${s[0]}</span>`).join('')}</div>`;
  const rows=[...dueFu.map(l=>['Follow-up due',l.name,`${(l.history||[]).length} sent, no reply`,'outbox',l.id,'Write follow-up']),
    ...waiting.map(l=>['Awaiting approval',l.name,l.draft.subject,'outbox',l.id,'Review']),
    ...replyOpen.map(l=>['Reply to send',l.name,l.replyDraft.summary,'replies',l.id,'Open']),
    ...up.slice(0,5).map(l=>['Meeting',l.name,l.meeting.label,'meetings',l.id,'Open'])];
  const checks=[[S.ai.key,'AI key connected','settings'],[c.product||c.description,'What you sell','setup'],[c.senderName,'Your name for sign-off','setup'],[hasAvail(c),'Available times for meetings','setup'],[c.website,'Website to share with prospects','setup'],[c.optOut,'Opt-out line','setup']];
  const start=!L.length?`<div class="card start"><h2>Start here</h2><p class="muted">Three steps and you have your first leads. Everything stays in this browser.</p>
    <div class="steps">${[['1','Connect your AI','Paste a key from Anthropic, OpenAI, Gemini or OpenRouter.','settings',!!S.ai.key],['2','Describe your business','What you sell, who buys it and when you are free for calls.','setup',!!(c.product||c.description)],['3','Find businesses','Search a place on the map, or paste a list.','find',false]]
      .map(s=>`<button class="stp" data-act="goto" data-tab="${s[3]}"><span class="num">${s[4]?'✓':s[0]}</span><span><b>${s[1]}</b><br><span class="muted">${s[2]}</span></span></button>`).join('')}</div></div>`:'';
  return `${start}<div class="tiles">${tile('Leads found',st.found.n,st.found.w?'+'+st.found.w+' this week':'',st.drafted.n+' with an email drafted')}
    ${tile('Reply rate',rate+'%',st.replied.w?'+'+st.replied.w+' this week':'',st.replied.n+' of '+st.sent.n+' sent')}
    ${tile('Meetings booked',st.booked.n,up[0]?'next: '+up[0].meeting.label.split(',')[0]:'',up.length+' upcoming')}
    ${tile('Follow-ups due',dueFu.length,'',waiting.length+' drafts awaiting approval')}</div>
  <div class="cols"><div class="card"><div class="row between"><h2>Pipeline</h2><div class="legend"><span><i style="background:var(--ink)"></i>All time</span><span><i style="background:var(--accent)"></i>Last 7 days</span></div></div>${chart}</div>
  <div class="card"><h2>Setup check</h2><div class="list">${checks.map(([ok,t,tab])=>`<button class="lead" data-act="goto" data-tab="${tab}"><span class="n">${esc(t)}</span><span>${ok?'<span class="pill good">Done</span>':'<span class="pill wait">Missing</span>'}</span></button>`).join('')}</div></div></div>
  <div class="card"><h2>Next up</h2>${rows.length?`<div class="scroll"><table><thead><tr><th>What</th><th>Lead</th><th>Detail</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><span class="pill ${r[0]==='Meeting'?'good':r[0]==='Follow-up due'?'y':''}">${r[0]}</span></td><td><b>${esc(r[1])}</b></td><td class="muted">${esc(r[2])}</td><td style="text-align:right"><button class="btn sm" data-act="goto" data-tab="${r[3]}" data-id="${r[4]}">${r[5]}</button></td></tr>`).join('')}</tbody></table></div>`
    :`<div class="empty">Nothing waiting yet.</div>`}</div>`;
}
function vSetup(){const c=S.cfg,tzs=(typeof Intl.supportedValuesOf==='function')?Intl.supportedValuesOf('timeZone'):[];
  return `<div class="card"><h2>Fill it in from a description</h2><p class="muted">Paste a few sentences about what you sell and who buys it. The AI fills the form from what the text says, and nothing else.</p>
  <textarea id="profile-src" placeholder="We make… Our customers are…"></textarea><div class="row">${btn('profile','Fill the form','primary','','profile')}</div></div>
  <div class="card"><h2>Your business</h2>
  <div class="grid2">${field('Your name (used to sign emails)','f-senderName',c.senderName)}${field('Company','f-company',c.company)}</div>
  <div class="grid2">${field('What you sell','f-product',c.product)}${field('The offer (the next step you ask for)','f-offer',c.offer,'','e.g. a free audit, a 15 minute call, a trial')}</div>
  ${field('Your website','f-website',c.website,'placeholder="https://"','Shared with prospects who ask for more information. Leave empty to share nothing.')}
  <label>Describe it in a sentence or two<textarea id="f-description">${esc(c.description)}</textarea></label>
  <label>Benefits, one per line<textarea id="f-benefits" data-list="lines">${esc(c.benefits.join('\n'))}</textarea></label></div>
  <div class="card"><h2>Your available times</h2><p class="muted">When someone replies wanting a call or meeting, the reply offers up to three real open times from this schedule, never times made up by the AI. Times you have already offered or booked are not offered again.</p>
  <div class="grid3">${field('Time zone','f-tz',c.tz,'list="tzlist"','Your own zone. Times are shown to prospects with it.')}
    <label>Meeting length<select id="f-duration">${[15,20,30,45,60].map(m=>`<option value="${m}" ${+c.duration===m?'selected':''}>${m} minutes</option>`).join('')}</select></label>
    ${field('Gap between meetings (minutes)','f-buffer',c.buffer,'type="number" min="0" max="120"')}</div>
  <datalist id="tzlist">${tzs.map(z=>`<option value="${esc(z)}">`).join('')}</datalist>
  <div class="days">${DAYS.slice(1).concat('sun').map(d=>{const a=c.avail[d];return `<label class="d" style="flex-direction:row"><input type="checkbox" data-av="${d}.on" ${a.on?'checked':''}> ${DAYN[d]}</label>
    <input type="time" data-av="${d}.start" value="${esc(a.start)}" aria-label="${DAYN[d]} from" ${a.on?'':'disabled'}><input type="time" data-av="${d}.end" value="${esc(a.end)}" aria-label="${DAYN[d]} until" ${a.on?'':'disabled'}>`}).join('')}</div>
  <div class="grid3">${field('Earliest notice (hours)','f-notice',c.notice,'type="number" min="0" max="240"','Nothing is offered sooner than this.')}${field('Look ahead (days)','f-horizon',c.horizon,'type="number" min="1" max="60"')}
    <label>Meeting type<select id="f-meetMode">${['Call','Video call','In person'].map(m=>`<option ${c.meetMode===m?'selected':''}>${m}</option>`).join('')}</select></label></div>
  ${field('Meeting details shared with the invite','f-meetDetail',c.meetDetail,'','Your phone number, video link or address. Leave empty to share none.')}
  ${hasAvail(c)?`<div class="note"><b>Next open times:</b> ${nextSlots(c,3,heldSlots(S.leads)).map(s=>esc(fmtSlot(s,c.tz))).join(' · ')||'none inside the look-ahead window'}</div>`:`<div class="note warn">No day is switched on yet, so replies cannot offer times.</div>`}</div>
  <div class="card"><h2>Who is a good prospect</h2>
  <div class="grid2">${field('Types of business that buy','f-industries',c.industries.join(', '),'data-list="commas"','Comma separated. Used for the sector score.')}${field('Job titles that decide','f-titles',c.titles.join(', '),'data-list="commas"','Comma separated')}</div>
  <div class="grid2">${field('Where','f-geography',c.geography,'','Used for the search suggestions')}${field('Roles that signal need when they hire','f-hiringSignals',c.hiringSignals.join(', '),'data-list="commas"')}</div></div>
  <div class="card"><h2>Sending rules and follow-ups</h2>
  <div class="grid2">${field('Language of the emails','f-language',c.language)}${field('Longest email, in words','f-maxWords',c.maxWords,'type="number" min="20" max="400"')}</div>
  <div class="grid2">${field('Follow-ups after no reply (0 to 3)','f-followUps',c.followUps,'type="number" min="0" max="3"')}${field('Days to wait before each one','f-gaps',c.gaps.join(', '),'data-list="nums"','Comma separated, e.g. 3, 5, 7. The last value repeats.')}</div>
  ${field('Opt-out line (added under every email)','f-optOut',c.optOut,'','Must say they can stop. No links.')}
  <label>Address or legal footer, if your local rules require one<textarea id="f-address" style="min-height:56px">${esc(c.address)}</textarea><span class="hint">Added under the opt-out line. Leave empty if you don't need one.</span></label>
  ${field('Only write for leads scoring at least','f-minScore',c.minScore,'type="number" min="0" max="100"','0 writes for everyone.')}
  <label>Do not contact: one address or domain per line<textarea id="f-dnc" data-list="lines">${esc(c.dnc.join('\n'))}</textarea><span class="hint">A domain covers its subdomains. Leads on this list are left out and never get a draft.</span></label></div>
  <details class="card"><summary>How sending and replies work</summary>
  <p class="muted">Nothing is sent from this site. When an email is approved, the Outbox opens it in Gmail or your mail app with everything filled in, and you press send yourself. Replies are pasted back in, so the platform can draft the answer and offer your meeting times. Email addresses are never verified here.</p></details>`}
function vFind(){const q=S.plan,o=S.osm;
  return `<div class="card"><h2>Search the map</h2>
  <p class="muted">Finds named businesses of one type in a city or district, from OpenStreetMap. Coverage varies by region, and many small businesses have no website listed there. Those still come through with a phone number when one is listed.</p>
  <div class="grid3"><label>Type of business<select id="osm-cat">${Object.entries(OSM_CATS).map(([k,v])=>`<option value="${k}" ${o.cat===k?'selected':''}>${esc(v[0])}</option>`).join('')}<option value="custom" ${o.cat==='custom'?'selected':''}>Other (map tag)…</option></select></label>
  ${field('City or district','osm-place',o.place,'placeholder="e.g. Pune"')}
  ${o.cat==='custom'?field('Map tag','osm-custom',o.custom,'placeholder="amenity=dentist"','key=value from wiki.openstreetmap.org/wiki/Map_features'):'<div></div>'}</div>
  <div class="row">${btn('osm','Search','primary','','osm')}<span class="muted">${esc(o.msg)}</span></div>
  ${o.results.length?`<div class="scroll"><table><thead><tr><th></th><th>Name</th><th>Website</th><th>Phone</th><th>Email</th></tr></thead><tbody>${o.results.map((r,i)=>`<tr><td><input type="checkbox" data-osm="${i}" ${r.sel?'checked':''} aria-label="Select ${esc(r.name)}"></td><td><b>${esc(r.name)}</b></td><td class="muted">${esc(r.website.replace(/^https?:\/\/(www\.)?/,'').slice(0,34))}</td><td class="mono">${esc(r.phone)}</td><td class="mono">${esc(r.email)}</td></tr>`).join('')}</tbody></table></div>
  <div class="row">${btn('osmadd','Add ticked to leads','primary')}<span class="hint">${o.results.filter(r=>r.sel).length} ticked</span></div>`:''}</div>
  <div class="card"><h2>Or paste a list</h2>
  <p class="muted">One business per line, from a directory export or your own sheet. A header row (name, website, phone, city, category, email, contact, title) is read automatically. Without one, the columns are in that order. A bare website works too.</p>
  <textarea id="paste" style="min-height:140px" placeholder="name, website, phone, city, category, email, contact, title">${esc(S.paste)}</textarea>
  <div class="row">${btn('addpaste','Add to leads','primary')}${btn('examples','Fill with invented examples')}<span class="muted" id="findmsg">${esc(S.findMsg)}</span></div>
  <p class="hint">Directories, job boards, social sites, news sites and list pages are dropped. Duplicates are merged by website.</p></div>
  <div class="card"><h2>Ideas for what to search</h2><p class="muted">The AI suggests search phrases from your Setup. Each opens in a new tab.</p>
  <div class="row">${btn('plan','Suggest searches','','','plan')}</div>
  ${q?`<div class="list">${q.map(x=>{const e=encodeURIComponent(x.q);return `<div class="lead" style="cursor:default"><span class="n">${esc(x.q)}</span><span class="row"><a href="https://www.google.com/maps/search/${e}" target="_blank" rel="noopener">Maps</a><a href="https://www.google.com/search?q=${e}" target="_blank" rel="noopener">Search</a></span><span class="s">${esc(x.why||'')}</span></div>`}).join('')}</div>`:''}</div>`}
function leadRow(l){const f=l.fit||scoreFit(l,S.cfg);return `<button class="lead" data-act="select" data-id="${l.id}" aria-current="${S.sel===l.id}"><span class="n">${esc(l.name)}</span><span class="score">${f.score}<small>fit</small></span><span class="s">${esc([l.domain,l.city,l.category].filter(Boolean).join(' · ')||'no details')}</span></button>`}
function vLeads(){const L=S.leads;
  if(!L.length)return `<div class="card empty"><h2>No leads yet</h2><p>Add businesses on the Find tab. They appear here with a fit score and what is known about them.</p></div>`;
  const l=sel();
  return `<div class="split"><div class="card"><div class="row between"><h2>${L.length} lead${L.length===1?'':'s'}</h2><div class="row">${btn('writeall','Write for all','sm','','writeall')}${btn('exportall','Export CSV','sm')}</div></div>
  <div class="list">${L.map(leadRow).join('')}</div>${S.csvOut?csvBox():''}</div>${l?detail(l):`<div class="card empty">Select a lead to see its contacts, score and email.</div>`}</div>`}
function csvBox(){return `<label>Text to copy<textarea readonly style="min-height:120px;font-family:var(--mono);font-size:12px">${esc(S.csvOut)}</textarea></label>`}
function detail(l){const f=scoreFit(l,S.cfg);l.fit=f;const due=followupDueIn(l,S.cfg);
  return `<div class="card"><div class="row between"><h2>${esc(l.name)}</h2><span>${pill(l.status)}</span></div>
  <div class="reasons">${f.reasons.map(r=>`<span class="pill">${esc(r)}</span>`).join('')}<span class="pill y mono">${f.score}/100</span></div>
  ${l.status==='sent'&&due!==null?`<div class="note">Sent ${(l.history||[]).length} email${(l.history||[]).length===1?'':'s'}. ${due===0?'A follow-up is due now.':'Next follow-up in '+due+' day'+(due===1?'':'s')+'.'}</div>`:''}
  <div class="grid2">${field('Name','l-name',l.name,'data-lead="name"')}${field('Website','l-website',l.website,'data-lead="website"')}${field('Phone','l-phone',l.phone,'data-lead="phone"')}${field('City','l-city',l.city,'data-lead="city"')}</div>
  ${field('Type of business','l-category',l.category,'data-lead="category"')}
  <label>Notes (facts you know, used by the writer)<textarea id="l-notes" data-lead="notes" style="min-height:60px">${esc(l.notes)}</textarea></label>
  <h3>Read their page</h3>
  <textarea id="page" placeholder="Or paste the text of their homepage or About page. Emails and phone numbers are lifted by rule; names and findings by the AI, and kept only if they appear in the text.">${esc(S.page[l.id]||'')}</textarea>
  <div class="row">${l.domain?btn('fetchsite','Fetch their website','primary','','fetch'):''}${btn('readpage','Read pasted text','','','page')}</div>
  ${l.signals&&l.signals.length?`<div class="list">${l.signals.map(s=>`<div class="note"><b>${esc(s.signal)}</b>${s.evidence?`<br><span class="faint">${esc(s.evidence)}</span>`:''}</div>`).join('')}</div>`:''}
  <h3>Contacts</h3>${contacts(l)}
  <div class="row end">${btn('write','Write email','primary','data-id="'+l.id+'"','write'+l.id)}${btn('skip',l.status==='skip'?'Unskip':'Skip','','data-id="'+l.id+'"')}${btn('remove','Remove','danger','data-id="'+l.id+'"')}</div>
  ${l.draft?`<h3>Draft</h3><p class="muted">Review and approve it in the Outbox.</p><div class="mail"><b>${esc(l.draft.subject)}</b>\n\n${esc(finalMail(l,S.cfg))}</div>`:''}
  ${(l.history||[]).length?`<details><summary>Sent emails (${l.history.length})</summary><div class="list" style="margin-top:8px">${l.history.map(m=>`<div class="mail"><span class="faint">${esc(m.kind==='followup'?'Follow-up':'First email')} · ${esc(new Date(m.at).toLocaleDateString())}</span>\n<b>${esc(m.subject)}</b>\n\n${esc(m.body)}</div>`).join('')}</div></details>`:''}</div>`}
function contacts(l){const rows=(l.contacts||[]).map((c,i)=>`<tr><td>${esc((c.first+' '+(c.last||'')).trim()||'(general inbox)')}</td><td>${esc(c.title||'')}</td><td class="mono">${esc(c.email||'')}</td><td>${c.status?`<span class="pill ${c.status==='verified'?'good':c.status==='invalid'?'bad':c.status==='guess'?'wait':''}">${esc(c.status)}</span>`:''}</td><td><button class="btn sm" data-act="delcontact" data-id="${l.id}" data-i="${i}" aria-label="Remove contact">×</button></td></tr>`).join('');
  return `${rows?`<div class="scroll"><table><tbody>${rows}</tbody></table></div>`:`<p class="muted">No contacts yet.</p>`}
  <div class="grid2"><label>First name<input id="c-first"></label><label>Last name<input id="c-last"></label><label>Title<input id="c-title"></label><label>Email<input id="c-email" type="email"></label></div>
  <div class="row"><label style="flex:1;min-width:160px">Email status<select id="c-status"><option value="given">given, not verified</option><option value="verified">verified</option><option value="risky">risky (catch-all)</option><option value="guess">guess</option><option value="invalid">invalid</option></select></label>${btn('guess','Guess from name')}${btn('addcontact','Add contact','primary')}</div>
  <p class="hint">Guesses use first.last@domain and are marked as guesses. They are never approved for sending.</p>`}
function vOutbox(){const L=S.leads.filter(l=>l.draft),due=S.leads.filter(l=>followupDue(l,S.cfg)),done=S.leads.filter(l=>!l.draft&&(l.history||[]).length);
  if(!L.length&&!done.length&&!due.length)return `<div class="card empty"><h2>Nothing waiting</h2><p>Write an email from a lead on the Leads tab. It lands here for your approval.</p></div>`;
  const card=l=>{const ch=preSend(l,S.cfg),bad=ch.some(x=>x.k==='f'),c=(l.contacts||[])[l.draft.contact]||{};
    return `<div class="card"><div class="row between"><h2>${esc(l.name)}</h2><span class="row"><span class="pill ${l.draft.kind==='followup'?'y':''}">${l.draft.kind==='followup'?'Follow-up '+l.draft.step:'First email'}</span>${pill(l.status)}</span></div>
    <p class="muted mono">To: ${esc(c.email||'(none)')} ${c.first?'· '+esc(c.first):''}</p>
    ${field('Subject','s-'+l.id,l.draft.subject,'data-draft="subject" data-id="'+l.id+'"')}
    <label>Body<textarea id="b-${l.id}" data-draft="body" data-id="${l.id}" style="min-height:130px">${esc(l.draft.body)}</textarea></label>
    <div class="mail faint"><span class="hint">Added under every email:</span>\n${esc(finalMail(l,S.cfg).slice(l.draft.body.trim().length).replace(/^\s+/,''))}</div>
    <div class="checks">${ch.map(x=>`<span class="${x.k}">${x.k==='f'?'✕':x.k==='w'?'!':'✓'} ${esc(x.t)}</span>`).join('')}</div>
    <div class="row end">${btn('copymail','Copy email','','data-id="'+l.id+'"')}${l.status==='approved'?mailBtns(c.email,l.draft.subject,finalMail(l,S.cfg))+btn('unapprove','Unapprove','','data-id="'+l.id+'"')+btn('markSent','Mark as sent','primary','data-id="'+l.id+'"'):btn('approve',bad?'Fix the failures first':'Approve','primary','data-id="'+l.id+'"'+(bad?' disabled':''))}${btn('discard','Discard','danger','data-id="'+l.id+'"')}</div></div>`};
  return `<div class="note">Nothing is sent from this site. Approve an email, open it in Gmail or your mail app, send it there, then mark it as sent. Follow-up timing starts when you mark it sent.</div>
  ${due.length?`<div class="card"><div class="row between"><h2>Follow-ups due (${due.length})</h2>${btn('followall','Write all due','sm','','fuall')}</div><div class="list">${due.map(l=>`<div class="lead" style="cursor:default"><span class="n">${esc(l.name)}</span><span>${btn('followup','Write follow-up '+(l.history.length),'sm primary','data-id="'+l.id+'"','fu'+l.id)}</span><span class="s">${l.history.length} sent, last on ${esc(new Date(lastSent(l).at).toLocaleDateString())}, no reply</span></div>`).join('')}</div></div>`:''}
  <div class="row">${btn('exportapproved','Export approved as CSV','sm')}</div>${S.csvOut?csvBox():''}
  ${L.map(card).join('')}${done.length?`<div class="card"><h3>Sent (${done.length})</h3><div class="list">${done.map(l=>`<div class="lead" style="cursor:default"><span class="n">${esc(l.name)}</span><span>${pill(l.status)}</span><span class="s">${l.history.length} email${l.history.length===1?'':'s'} · ${esc(lastSent(l).subject)}</span></div>`).join('')}</div></div>`:''}`}
function vReplies(){const cands=S.leads.filter(l=>(l.history||[]).length||l.thread||l.draft),t=S.leads.filter(l=>(l.thread&&l.thread.length)||l.replyDraft);
  return `<div class="card"><h2>Handle a reply</h2>
  <p class="muted">Paste a reply you received. Opt-outs and auto-replies are caught by rule before the AI reads anything. If they want a call or meeting, the answer offers real times from your availability. If they ask for more information, it shares your website.</p>
  <label>Which lead<select id="r-lead"><option value="">Choose…</option>${(cands.length?cands:S.leads).map(l=>`<option value="${l.id}" ${S.replyLead===l.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label>
  <textarea id="reply" placeholder="Paste their reply here">${esc(S.reply)}</textarea>
  <div class="row">${btn('reply','Read reply','primary','','reply')}</div></div>
  ${t.map(l=>{const rd=l.replyDraft;return `<div class="card"><div class="row between"><h2>${esc(l.name)}</h2>${pill(l.status)}</div>
    ${(l.thread||[]).map(m=>`<div class="mail"><span class="faint">${m.dir==='in'?'Their reply':'Ours'}${m.kind?' · '+esc(m.kind):''}</span>\n${esc(m.text)}</div>`).join('')}
    ${rd?`<p><span class="pill note">${esc(rd.cls)}</span> <span class="muted">${esc(rd.summary)}</span></p>
    ${rd.theirTime?`<div class="note warn">They suggested: “${esc(rd.theirTime)}”. Check it against your calendar, then book it below if it suits.</div>`:''}
    ${rd.wantsInfo&&!S.cfg.website?`<div class="note warn">They asked for more information. Add your website in Setup so replies can share it.</div>`:''}
    ${rd.draft?`<label>Draft answer<textarea id="rd-${l.id}" data-rd="${l.id}" style="min-height:130px">${esc(rd.draft)}</textarea></label>
    ${/\[add times/.test(rd.draft)?`<div class="note warn">No open times came out of your availability. Set it in Setup, then read the reply again.</div>`:''}
    <div class="row end">${mailBtns((bestContact(l,S.cfg)||{}).email,'Re: '+((lastSent(l)||{}).subject||''),rd.draft)}${btn('copyreply','Copy answer','','data-id="'+l.id+'"')}${btn('answered','Mark answered','primary','data-id="'+l.id+'"')}</div>`:''}
    ${(rd.slots||[]).length&&l.status!=='booked'?`<h3>Times offered in this answer</h3><div class="list">${rd.slots.map((s,i)=>`<div class="slot"><span>${esc(fmtSlot(s,S.cfg.tz))}</span>${btn('book','Confirm this time','sm primary','data-id="'+l.id+'" data-iso="'+s+'"','book'+l.id)}</div>`).join('')}</div><p class="hint">Offered times are held so nobody else is offered the same one. Confirm the one they pick.</p>`:''}
    ${rd.wantsMeeting&&l.status!=='booked'?`<div class="row"><label style="flex:1;min-width:200px">Book a different time (${esc(S.cfg.tz)})<input type="datetime-local" id="ct-${l.id}"></label>${btn('bookcustom','Book this time','sm','data-id="'+l.id+'"')}</div>`:''}`:''}
    ${l.status==='booked'&&l.meeting?`<div class="note"><b>Booked:</b> ${esc(l.meeting.label)}. See the Meetings tab for the confirmation.</div>`:''}</div>`}).join('')}`}
function vMeetings(){const c=S.cfg,all=S.leads.filter(l=>l.meeting).sort((a,b)=>a.meeting.start.localeCompare(b.meeting.start)),held=S.leads.filter(l=>l.status!=='booked'&&(l.offered||[]).length);
  const open=hasAvail(c)?nextSlots(c,6,heldSlots(S.leads)):[];
  return `<div class="card"><h2>Your next open times</h2>${hasAvail(c)?(open.length?`<div class="reasons">${open.map(s=>`<span class="pill y">${esc(fmtSlot(s,c.tz))}</span>`).join('')}</div>`:`<p class="muted">Nothing open in the next ${c.horizon} days.</p>`)
    :`<div class="note warn">No available times set. <button class="btn sm" data-act="goto" data-tab="setup">Open Setup</button></div>`}
    ${held.length?`<p class="hint">Held for people you offered them to: ${held.map(l=>esc(l.name)).join(', ')}.</p>`:''}</div>
  ${all.length?all.map(l=>`<div class="card"><div class="row between"><h2>${esc(l.name)}</h2><span class="pill ${new Date(l.meeting.start)>new Date()?'good':''}">${new Date(l.meeting.start)>new Date()?'Upcoming':'Past'}</span></div>
    <p><b>${esc(l.meeting.label)}</b> · ${esc(c.duration)} min · ${esc(l.meeting.mode||'')}${l.meeting.detail?' · '+esc(l.meeting.detail):''}</p>
    ${l.confirm?`<label>Confirmation to send<textarea id="cf-${l.id}" data-cf="${l.id}" style="min-height:130px">${esc(l.confirm)}</textarea></label>`:''}
    <div class="row end">${mailBtns((bestContact(l,c)||{}).email,'Meeting confirmed: '+l.meeting.label,l.confirm||'')}${btn('copyconfirm','Copy confirmation','sm','data-id="'+l.id+'"')}${btn('ics','Add to calendar (.ics)','sm','data-id="'+l.id+'"')}${btn('cancelmeet','Cancel meeting','sm danger','data-id="'+l.id+'"')}</div></div>`).join(''):`<div class="card empty"><h2>No meetings yet</h2><p>When a reply asks for a call, the answer offers your open times. Confirm the one they pick on the Replies tab and it appears here.</p></div>`}
  ${S.csvOut?`<div class="card">${csvBox()}</div>`:''}`}
function vSettings(){const a=S.ai,P=PROVIDERS;
  return `<div class="card"><h2>AI connection</h2>
  <p class="muted">The platform writes emails and reads replies with an AI model. Paste your own API key: it is stored only in this browser and sent only to the provider you pick. You pay that provider directly for what you use.</p>
  <div class="grid3"><label>Provider<select id="ai-provider">${Object.entries(P).map(([k,v])=>`<option value="${k}" ${a.provider===k?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label>
  ${field('Model','ai-model',a.model,'placeholder="'+esc(P[a.provider].model)+'"','Leave empty for the default. Change it if your key uses another model.')}
  <label>API key<input id="ai-key" type="password" autocomplete="off" spellcheck="false" value="${esc(a.key)}" placeholder="Paste your key"><span class="hint">Get one at ${esc(P[a.provider].where)}.</span></label></div>
  <div class="row">${btn('aitest','Test connection','primary','','aitest')}${btn('airemove','Remove key','danger')}</div></div>
  <div class="card"><h2>Your data</h2><p class="muted">Leads and setup live in this browser only. Clearing site data, or using another browser, starts empty. Export a backup now and then.</p>
  <div class="row">${btn('export','Export backup (.json)')}<label class="btn" style="cursor:pointer">Import backup<input type="file" id="import-file" accept="application/json,.json" hidden></label>
  ${S.wipe?`<span class="muted">Delete all leads and setup?</span>${btn('wipego','Yes, delete everything','danger')}${btn('wipeno','Cancel')}`:btn('wipe','Delete all data','danger')}</div></div>
  <div class="card"><h2>About</h2><p class="muted">Bharat Sales is open source under the GNU AGPL-3.0. <a href="${esc((window.SB_CONFIG||{}).SOURCE_URL||'#')}" target="_blank" rel="noopener">Source code</a> · <a href="/builder">Builder</a></p></div>`}
ICON.settings='<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>';
ICON.home='<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>';
const NAV=[['overview','Overview'],['setup','Setup'],['find','Find'],['leads','Leads'],['outbox','Outbox'],['replies','Replies'],['meetings','Meetings'],['settings','Settings']];
const TITLE={overview:'Overview',setup:'Setup',find:'Find businesses',leads:'Leads',outbox:'Outbox',replies:'Replies',meetings:'Meetings',settings:'Settings'};
function render(){const app=$('#app');if(!app)return;
  const N=S.leads.length,dueN=S.leads.filter(l=>followupDue(l,S.cfg)).length,outN=S.leads.filter(l=>l.draft).length+dueN,cnt={leads:N||'',outbox:outN||'',meetings:S.leads.filter(l=>l.meeting).length||''};
  const body={overview:vOverview,setup:vSetup,find:vFind,leads:vLeads,outbox:vOutbox,replies:vReplies,meetings:vMeetings,settings:vSettings}[S.tab]();
  const th=theme(),cf=window.SB_CONFIG||{};
  app.innerHTML=`<aside><a class="brand" href="/" aria-label="Bharat Sales home"><img class="mark" src="/assets/img/logo.svg" alt="" width="34" height="34">Bharat Sales</a>
    <nav class="side-nav" aria-label="Sections">${NAV.map(([k,t])=>`<button data-tab="${k}" ${S.tab===k?'aria-current="page"':''}>${ic(k)}${t}${cnt[k]?`<span class="count">${cnt[k]}</span>`:''}</button>`).join('')}</nav>
    <div class="side-foot"><a href="/">Home</a> · <a href="/builder">Builder</a> · <a href="${esc(cf.SOURCE_URL||'#')}" target="_blank" rel="noopener">Source</a><br>Saved in this browser</div></aside>
  <main><div class="bar"><h1>${TITLE[S.tab]}</h1><div class="seg" role="group" aria-label="Theme"><button data-theme-set="light" aria-pressed="${th==='light'}">${ic('sun')}Light</button><button data-theme-set="dark" aria-pressed="${th==='dark'}">${ic('moon')}Dark</button></div></div>${body}</main>`;
}

/* ═══════ Events ═══════ */
document.addEventListener('click',async e=>{
  const tb=e.target.closest('[data-tab]');if(tb&&!tb.dataset.act){S.tab=tb.dataset.tab;S.csvOut='';render();return}
  const b=e.target.closest('[data-act]');if(!b||b.disabled)return;
  const a=b.dataset.act,id=b.dataset.id,l=id&&byId(id);
  if(a==='goto'){S.tab=b.dataset.tab;if(id){S.sel=id;S.replyLead=id}S.csvOut='';render();return}
  if(a==='profile')return actProfile();if(a==='addpaste')return actAddPaste();if(a==='examples')return actExamples();if(a==='plan')return actPlan();
  if(a==='osm')return actOsm();if(a==='osmadd')return actOsmAdd();if(a==='fetchsite')return actFetchSite();if(a==='aitest')return actAiTest();
  if(a==='airemove'){S.ai.key='';persistAi();toast('Key removed from this browser.');render();return}
  if(a==='export')return save(JSON.stringify({app:'bharat-sales',version:1,exportedAt:new Date().toISOString(),cfg:S.cfg,leads:S.leads},null,2),'bharat-sales-backup.json');
  if(a==='wipe'){S.wipe=true;render();return}if(a==='wipeno'){S.wipe=false;render();return}
  if(a==='wipego'){S.cfg=defCfg();S.leads=[];S.sel=null;S.wipe=false;persist();toast('All data deleted.');render();return}
  if(a==='select'){S.sel=id;render();return}
  if(a==='readpage')return actReadPage();if(a==='write')return actWrite(id);if(a==='writeall')return withBusy('writeall',actWriteAll);
  if(a==='followup')return actFollowup(id);if(a==='followall')return withBusy('fuall',actFollowAll);
  if(a==='exportall')return exportCSV('all');if(a==='exportapproved')return exportCSV('approved');if(a==='reply')return actReply();
  if(a==='remove'&&l){await removeLead(id);render();return}
  if(a==='skip'&&l){l.status=l.status==='skip'?'new':'skip';await saveLead(l);render();return}
  if(a==='delcontact'&&l){l.contacts.splice(+b.dataset.i,1);l.fit=scoreFit(l,S.cfg);await saveLead(l);render();return}
  if(a==='guess'){const l2=sel(),g=guessEmail($('#c-first').value,$('#c-last').value,l2&&l2.domain);if(!g){toast('Needs a first name (letters a-z) and a website on the lead.',true);return}$('#c-email').value=g;$('#c-status').value='guess';return}
  if(a==='addcontact'){const l2=sel();if(!l2)return;const first=$('#c-first').value.trim(),email=$('#c-email').value.trim().toLowerCase();
    if(!first&&!email){toast('Add a first name or an email.',true);return}if(email&&!EMAIL_RE.test(email)){toast('That email address does not look valid.',true);return}
    l2.contacts.push({first,last:$('#c-last').value.trim(),title:$('#c-title').value.trim(),email,status:email?$('#c-status').value:'',general:!first&&GENERIC_LOCAL.test(email.split('@')[0])});
    l2.fit=scoreFit(l2,S.cfg);await saveLead(l2);render();return}
  if(a==='approve'&&l){if(preSend(l,S.cfg).some(x=>x.k==='f'))return;l.draft.approved=true;l.status='approved';await saveLead(l);render();return}
  if(a==='unapprove'&&l){l.draft.approved=false;l.status='drafted';await saveLead(l);render();return}
  if(a==='markSent'&&l){const txt=finalMail(l,S.cfg),now=new Date().toISOString();l.history=l.history||[];
    l.history.push({kind:l.draft.kind||'first',subject:l.draft.subject,body:txt,contact:l.draft.contact,at:now});l.thread=l.thread||[];l.thread.push({dir:'out',text:txt,at:now});l.draft=null;l.status='sent';await saveLead(l);render();return}
  if(a==='discard'&&l){l.draft=null;l.status=(l.history||[]).length?'sent':'new';await saveLead(l);render();return}
  if(a==='copymail'&&l)return copy(l.draft.subject+'\n\n'+finalMail(l,S.cfg));
  if(a==='copyreply'&&l)return copy(l.replyDraft.draft);
  if(a==='answered'&&l){l.thread.push({dir:'out',text:l.replyDraft.draft,at:new Date().toISOString(),kind:'answer'});l.replyDraft.draft='';await saveLead(l);render();return}
  if(a==='book'&&l){await bookSlot(l,b.dataset.iso);render();return}
  if(a==='bookcustom'&&l){const iso=customToIso($('#ct-'+id)?.value,S.cfg.tz);if(!iso){toast('Pick a date and time first.',true);return}
    if(new Date(iso)<new Date()){toast('That time is in the past.',true);return}await bookSlot(l,iso);render();return}
  if(a==='copyconfirm'&&l)return copy(l.confirm||'');
  if(a==='ics'&&l&&l.meeting)return save(icsFor(l,S.cfg),'meeting-'+(l.domain||l.id)+'.ics');
  if(a==='cancelmeet'&&l){l.meeting=null;l.confirm='';l.status='replied';await saveLead(l);toast('Meeting cancelled. The time is open again.');render();return}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='osm-place'){S.osm.place=e.target.value;actOsm()}});
document.addEventListener('input',e=>{const t=e.target;if(t.id==='paste')S.paste=t.value;else if(t.id==='page'&&S.sel)S.page[S.sel]=t.value;else if(t.id==='reply')S.reply=t.value});
document.addEventListener('change',async e=>{const t=e.target;
  if(t.id==='r-lead'){S.replyLead=t.value;return}
  if(t.id==='ai-provider'){S.ai.provider=t.value;S.ai.model='';persistAi();render();return}
  if(t.id==='ai-model'){S.ai.model=t.value.trim();persistAi();return}
  if(t.id==='ai-key'){S.ai.key=t.value.trim();persistAi();return}
  if(t.id==='import-file'){if(t.files[0])actImport(t.files[0]);t.value='';return}
  if(t.id==='osm-cat'){S.osm.cat=t.value;render();return}
  if(t.id==='osm-place'){S.osm.place=t.value;return}
  if(t.id==='osm-custom'){S.osm.custom=t.value;return}
  if(t.dataset.osm!==undefined){const r=S.osm.results[+t.dataset.osm];if(r){r.sel=t.checked;const h=t.closest('.card').querySelector('.hint');if(h)h.textContent=S.osm.results.filter(x=>x.sel).length+' ticked'}return}
  if(t.dataset.av){const [d,k]=t.dataset.av.split('.');S.cfg.avail[d][k]=k==='on'?t.checked:t.value;await saveCfg();if(k==='on')render();return}
  if(t.id&&t.id.startsWith('f-')){const k=t.id.slice(2);let v=t.value;
    if(t.dataset.list==='commas')v=v.split(',').map(s=>s.trim()).filter(Boolean);else if(t.dataset.list==='lines')v=v.split('\n').map(s=>s.trim()).filter(Boolean);
    else if(t.dataset.list==='nums')v=v.split(',').map(s=>Number(s.trim())).filter(n=>isFinite(n)&&n>0);
    else if(['maxWords','minScore','followUps','buffer','notice','horizon','duration'].includes(k))v=Math.max(0,Number(v)||0);
    if(k==='tz'&&!validTz(v)){toast('That time zone name is not recognised. Pick one from the list.',true);t.value=S.cfg.tz;return}
    if(k==='followUps')v=Math.min(3,v);S.cfg[k]=v;await saveCfg();if(['tz','duration','buffer','notice','horizon'].includes(k))render();return}
  if(t.dataset.lead){const l=sel();if(!l)return;l[t.dataset.lead]=t.value;if(t.dataset.lead==='website')l.domain=normalizeDomain(t.value);l.fit=scoreFit(l,S.cfg);await saveLead(l);return}
  if(t.dataset.draft){const l=byId(t.dataset.id);if(!l||!l.draft)return;l.draft[t.dataset.draft]=t.value;l.draft.approved=false;if(l.status==='approved')l.status='drafted';await saveLead(l);return}
  if(t.dataset.rd){const l=byId(t.dataset.rd);if(l&&l.replyDraft){l.replyDraft.draft=t.value;await saveLead(l)}return}
  if(t.dataset.cf){const l=byId(t.dataset.cf);if(l){l.confirm=t.value;await saveLead(l)}}
});
loadAll();
window.onThemeChange=()=>render();
S.tab='overview';
render();
