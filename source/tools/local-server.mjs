import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {spawn} from 'node:child_process';
import {openDatabase} from './local-db.mjs';
import worker from '../src/worker.js';

const db=openDatabase(process.env.REDMONT_LOCAL_DB||'.local/redmont.sqlite');
const port=+(process.env.PORT||8788),assetRoot=resolve('dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json','.txt':'text/plain; charset=utf-8'};
const env={DB:db,GROQ_API_KEY:process.env.GROQ_API_KEY,GROQ_MODEL:process.env.GROQ_MODEL,ASSETS:{async fetch(request){
 const name=new URL(request.url).pathname;
 if(name.includes('..')||name.includes('\\')||name==='/_worker.js')return new Response('Not found',{status:404});
 const file=resolve(assetRoot,'.'+name);if(!file.startsWith(assetRoot+'/'))return new Response('Not found',{status:404});
 try{return new Response(await readFile(file),{headers:{'Content-Type':mime[extname(file)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}
}}};
const server=createServer(async(req,res)=>{
 try{
  const pieces=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1500000){res.writeHead(413);res.end('Document too large');return;}pieces.push(chunk);}
  const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(', '):value);
  // Never trust an incoming client IP override in local preview.
  headers.set('CF-Connecting-IP',req.socket.remoteAddress||'127.0.0.1');
  const request=new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(pieces)}:{})});
  const response=await worker.fetch(request,env,{});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(e.message);res.writeHead(500);res.end('Local preview failed. Check the server window.');}
});
server.listen(port,'127.0.0.1',()=>{
 console.log(`Redmont Archives local preview: http://127.0.0.1:${port}\nLocal data: ${process.env.REDMONT_LOCAL_DB||'.local/redmont.sqlite'}\nPress Ctrl+C to stop.`);
 if(process.argv.includes('--open')&&process.platform==='win32')spawn('cmd.exe',['/c','start','',`http://127.0.0.1:${port}`],{windowsHide:true,stdio:'ignore'}).on('error',()=>{});
});
process.on('SIGINT',()=>server.close(()=>{db.close();process.exit();}));
export {server,db};
