'use strict';
// Fetches one public web page for the dashboard. Guarded against requests to private networks (SSRF).
const dns=require('dns').promises,net=require('net'),http=require('http'),https=require('https');
const {htmlToText}=require('./_page');
const MAX_BYTES=1500000,TIMEOUT=8000,MAX_REDIRECTS=3;

function isPrivateIp(ip){
  if(net.isIPv4(ip)){const [a,b]=ip.split('.').map(Number);
    return a===0||a===10||a===127||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===192&&b===0)||(a===198&&(b===18||b===19))||a>=224}
  if(net.isIPv6(ip)){const l=ip.toLowerCase();
    if(l==='::'||l==='::1')return true;
    const m=l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);if(m)return isPrivateIp(m[1]);
    const m2=l.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);if(m2){const x=parseInt(m2[1],16),y=parseInt(m2[2],16);return isPrivateIp([x>>8,x&255,y>>8,y&255].join('.'))}
    return /^(fc|fd|fe[89ab])/.test(l)||l.startsWith('ff')||l.startsWith('64:ff9b')||l.startsWith('2001:db8')}
  return true}

async function resolveSafe(host,allowPrivate){
  if(net.isIP(host)){if(!allowPrivate&&isPrivateIp(host))throw new Error('blocked');return {address:host,family:net.isIPv6(host)?6:4}}
  if(!allowPrivate&&(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.internal')||host.endsWith('.local')))throw new Error('blocked');
  const all=await dns.lookup(host,{all:true});if(!all.length)throw new Error('dns');
  if(!allowPrivate&&all.some(a=>isPrivateIp(a.address)))throw new Error('blocked');
  return all[0]}

function once(u,allowPrivate){
  return new Promise(async(resolve,reject)=>{
    let addr;try{addr=await resolveSafe(u.hostname.replace(/^\[|\]$/g,''),allowPrivate)}catch(e){return reject(e)}
    const lib=u.protocol==='https:'?https:http;
    const req=lib.request({host:addr.address,port:u.port||(u.protocol==='https:'?443:80),path:u.pathname+u.search,method:'GET',servername:net.isIP(u.hostname)?undefined:u.hostname,
      headers:{host:u.host,'user-agent':'Mozilla/5.0 (compatible; BharatSales/1.0)',accept:'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5','accept-encoding':'identity'},timeout:TIMEOUT},res=>{
      if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();return resolve({redirect:new URL(res.headers.location,u).toString()})}
      const type=String(res.headers['content-type']||'');
      if(!/text\/html|text\/plain|application\/xhtml/i.test(type)){res.destroy();return reject(new Error('type'))}
      const chunks=[];let n=0;
      res.on('data',c=>{n+=c.length;if(n>MAX_BYTES){res.destroy();resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')});return}chunks.push(c)});
      res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));
      res.on('error',reject)});
    req.on('timeout',()=>req.destroy(new Error('timeout')));req.on('error',reject);req.end()})}

async function getPage(raw,allowPrivate){
  let u;try{u=new URL(raw)}catch(e){throw new Error('url')}
  if(!/^https?:$/.test(u.protocol)||u.username||u.password)throw new Error('url');
  for(let i=0;i<=MAX_REDIRECTS;i++){
    const r=await once(u,allowPrivate);
    if(r.redirect){u=new URL(r.redirect);if(!/^https?:$/.test(u.protocol))throw new Error('url');continue}
    return {...r,url:u.toString()}}
  throw new Error('redirects')}

const MSG={url:'That is not a valid web address.',blocked:'That address is not allowed.',type:'That address is not a web page.',timeout:'The website took too long to answer.',dns:'That website could not be found.',redirects:'The website redirected too many times.'};

async function handler(req,res,opts){
  const allowPrivate=!!(opts&&opts.allowPrivate);
  res.setHeader('cache-control','no-store');res.setHeader('content-type','application/json; charset=utf-8');
  const send=(c,o)=>{res.statusCode=c;res.end(JSON.stringify(o))};
  const origin=req.headers.origin||'',host=req.headers.host||'';
  if(origin){try{if(new URL(origin).host!==host)return send(403,{error:'Not allowed from another site.'})}catch(e){return send(403,{error:'Bad origin.'})}}
  const q=new URL(req.url,'http://x').searchParams.get('url');
  if(!q)return send(400,{error:MSG.url});
  try{
    const r=await getPage(q,allowPrivate);
    if(r.status>=400)return send(502,{error:'The website answered with an error ('+r.status+').'});
    const out=htmlToText(r.body);
    return send(200,{url:r.url,text:out.text.slice(0,12000),emails:out.emails,phones:out.phones});
  }catch(e){return send(e.message in MSG?(e.message==='blocked'||e.message==='url'?400:502):502,{error:MSG[e.message]||'Could not fetch that website.'})}
}
module.exports=(req,res)=>handler(req,res);
module.exports.handler=handler;module.exports.isPrivateIp=isPrivateIp;module.exports.getPage=getPage;
