import {api} from './api.js';

const aliases={
 '/index.html':'/','/login.html':'/login','/register.html':'/register','/signup.html':'/register','/signup':'/register',
 '/account.html':'/account','/organizations.html':'/organizations','/create-organization.html':'/create-organization','/create-page.html':'/create-page'
};
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
const front=/^\/(?:$|login$|register$|account$|reset-password$|forgot-password$|create-organization$|create-page$|edit$|search$|organizations(?:\/[^/]+(?:\/[^/]+)?)?$|records\/\d+$|archive\/[^/]+$)/;
export default {async fetch(request,env,ctx){
 const url=new URL(request.url),path=url.pathname.replace(/\/$/,'')||'/';let response;
 if(/^\/(?:source|src|tools|tests|migrations|docs|node_modules)(?:\/|$)/.test(path)||/^\/(?:package(?:-lock)?\.json|AGENTS\.md|CHECKSUMS\.txt|BUILD-INFO\.json|build\.mjs)$/.test(path))response=new Response('Page not found.',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 else if(path.startsWith('/api/'))response=await api(request,env);
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
 return response;
}};
