import {api} from './api.js';
import {ensureDatabase} from './schema.js';
import {publicIndex} from './extended-api.js';
import {escapeHTML} from './content.js';

const aliases={
 '/index.html':'/','/login.html':'/login','/register.html':'/register','/signup.html':'/register','/signup':'/register',
 '/account.html':'/account','/organizations.html':'/organizations','/create-organization.html':'/create-organization','/create-page.html':'/create-page'
};
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
const front=/^\/(?:$|library$|settings$|help$|status$|login$|register$|account$|reset-password$|forgot-password$|create-organization$|create-page$|edit$|search$|organizations(?:\/[^/]+(?:\/[^/]+)?)?$|records\/\d+$|archive\/[^/]+$)/;
export default {async fetch(request,env,ctx){
 const requestId=crypto.randomUUID(),url=new URL(request.url),path=url.pathname.replace(/\/$/,'')||'/';let response,decoded;
 try{decoded=decodeURIComponent(path);}catch{return new Response('Invalid URL encoding.',{status:400,headers:{'X-Request-ID':requestId}});}
 if(/^\/(?:source|src|tools|tests|migrations|docs|node_modules)(?:\/|$)/.test(decoded)||decoded.split('/').some(x=>x.startsWith('.'))||/^\/(?:package(?:-lock)?\.json|AGENTS\.md|CHECKSUMS\.txt|BUILD-INFO\.json|build\.mjs)$/.test(decoded))response=new Response('Page not found.',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 else if(!path.startsWith('/api/')&&!['GET','HEAD'].includes(request.method))response=new Response('Method not allowed.',{status:405,headers:{Allow:'GET, HEAD'}});
 else if(path.startsWith('/api/'))response=await api(request.method==='HEAD'?new Request(request,{method:'GET'}):request,env);
 else if(['/feed.xml','/sitemap.xml'].includes(path)){
  try{if(!env.DB)throw new Error('Database unavailable');await ensureDatabase(env.DB);const docs=await publicIndex(env.DB),origin=url.origin;
   const xml=path==='/sitemap.xml'?'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['/','/organizations','/archive/all',...docs.map(d=>d.url)].map(p=>'<url><loc>'+escapeHTML(origin+p)+'</loc></url>').join('')+'</urlset>':'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Redmont Archives</title><link>'+escapeHTML(origin)+'</link><description>Latest published archive records</description>'+docs.slice(0,50).map(d=>'<item><title>'+escapeHTML(d.title)+'</title><link>'+escapeHTML(origin+d.url)+'</link><guid>'+escapeHTML(origin+d.url)+'</guid><description>'+escapeHTML(d.excerpt)+'</description></item>').join('')+'</channel></rss>';
   response=new Response(xml,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'no-cache'}});
  }catch{response=new Response('Archive feed temporarily unavailable.',{status:503});}
 }
 else if(aliases[path])response=new Response(null,{status:301,headers:{Location:aliases[path]+url.search+url.hash}});
 else if(front.test(path)){
  const assetURL=new URL('/index.html',url);
  response=await env.ASSETS.fetch(new Request(assetURL,{method:'GET'}));
  response=new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:response.headers});
  response.headers.set('Cache-Control','no-cache, must-revalidate');
 }else{
  response=await env.ASSETS.fetch(request);
  if(!/\.(?:js|css|svg|ico|png|jpg|webp|txt|json)$/.test(path))response=new Response('Page not found.',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 }
 response=new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:response.headers});
 response.headers.set('Content-Security-Policy',CSP);
 response.headers.set('X-Content-Type-Options','nosniff');
 response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 response.headers.set('X-Frame-Options','DENY');
 response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 response.headers.set('X-Request-ID',requestId);
 return response;
}};
