export class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
export const fail=(status,message)=>{throw new HttpError(status,message);};
export function json(value,status=200,headers={}) {return Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});}
export const token=()=>{const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');};
export async function digest(value){return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
export async function hashPassword(password){
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},key,256);
 return ['pbkdf2','sha256','100000',btoa(String.fromCharCode(...salt)),btoa(String.fromCharCode(...new Uint8Array(bits)))].join('$');
}
export async function verifyPassword(password,hash){
 try{
  const [algorithm,sha,count,salt,expected]=String(hash).split('$');
  if(algorithm!=='pbkdf2'||sha!=='sha256'||!Number.isInteger(+count)||+count<1||+count>100000)return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(atob(salt),c=>c.charCodeAt(0)),iterations:+count,hash:'SHA-256'},key,256));
  const compare=Uint8Array.from(atob(expected),c=>c.charCodeAt(0));
  let diff=bits.length^compare.length;for(let i=0;i<bits.length;i++)diff|=bits[i]^(compare[i]||0);return diff===0;
 }catch{return false;}
}
export function validatePassword(password){if(typeof password!=='string'||password.length<8||password.length>256)fail(400,'Use a password between 8 and 256 characters.');return password;}
export async function readBody(request){
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))fail(415,'Send application/json.');
 if(+(request.headers.get('content-length')||0)>1500000)fail(413,'The document is too large.');
 const reader=request.body?.getReader();if(!reader)fail(400,'A JSON body is required.');
 const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1500000){await reader.cancel();fail(413,'The document is too large.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const x of chunks){bytes.set(x,offset);offset+=x.length;}
 try{const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'A JSON object is required.');return data;}catch(e){if(e instanceof HttpError)throw e;fail(400,'Invalid JSON.');}
}
export function checkOrigin(request){
 const origin=request.headers.get('origin');
 if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')fail(403,'Please submit this request from Redmont Archives.');
}
export async function currentUser(request,db){
 const raw=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('redmont_session='))?.slice(16);
 if(!raw||raw.length>200)return null;
 return db.prepare(`SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.session_token_hash=? AND julianday(s.expires_at)>julianday('now')`).bind(await digest(raw)).first();
}
export const requireUser=user=>user||fail(401,'Log in to continue.');
export const isAdmin=user=>user?.username==='kaelzvx';
export async function sessionFor(user,db,request,expectedPasswordHash){
 const raw=token();
 const result=expectedPasswordHash?
  await db.prepare('INSERT INTO sessions(user_id,session_token_hash,expires_at) SELECT id,?,? FROM users WHERE id=? AND password_hash=?').bind(await digest(raw),new Date(Date.now()+7*86400000).toISOString(),user.id,expectedPasswordHash).run():
  await db.prepare('INSERT INTO sessions(user_id,session_token_hash,expires_at) VALUES(?,?,?)').bind(user.id,await digest(raw),new Date(Date.now()+7*86400000).toISOString()).run();
 if(!result.meta.changes)fail(401,'Your password changed during sign-in. Please log in again.');
 return `redmont_session=${raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${new URL(request.url).protocol==='https:'?'; Secure':''}`;
}
export function clearCookie(request){return `redmont_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
export async function rateLimit(db,request,action,limit=10,windowSeconds=900,identity=''){
 const ip=request.headers.get('CF-Connecting-IP')||'local';
 const now=Math.floor(Date.now()/1000),window=Math.floor(now/windowSeconds);
 const key=await digest(`${action}:${ip}:${identity}:${window}`);
 const hit=await db.prepare('INSERT INTO ra_rate_limits(key,hits,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(key,(window+1)*windowSeconds).first();
 if(hit.hits>limit)fail(429,'Too many attempts. Please wait and try again.');
 await db.prepare('DELETE FROM ra_rate_limits WHERE expires_at<?').bind(now).run();
}
