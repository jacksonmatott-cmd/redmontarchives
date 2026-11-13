import {readFile,readdir,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {VERSION} from '../src/version.js';

const root=fileURLToPath(new URL('..',import.meta.url)),output=resolve(root,'..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function tree(directory){let files=[];for(const item of await readdir(directory,{withFileTypes:true})){const path=join(directory,item.name);if(item.isDirectory())files.push(...await tree(path));else if(item.isFile())files.push(path);}return files.sort();}
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let n=0xffffffff;for(const byte of bytes)n=crcTable[(n^byte)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
async function zip(path,entries){
 let offset=0;const bodies=[],central=[];
 for(const entry of entries){
  const name=Buffer.from(entry.name,'utf8'),bytes=entry.bytes??await readFile(entry.path),compressed=deflateRawSync(bytes,{level:9}),crc=crc32(bytes);
  if(entry.name.startsWith('/')||entry.name.split('/').includes('..'))throw new Error('Unsafe archive path.');
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);local.writeUInt16LE(0x5d63,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(name.length,26);
  const head=Buffer.alloc(46);head.writeUInt32LE(0x02014b50,0);head.writeUInt16LE(20,4);head.writeUInt16LE(20,6);head.writeUInt16LE(0x800,8);head.writeUInt16LE(8,10);head.writeUInt16LE(0x5d63,14);head.writeUInt32LE(crc,16);head.writeUInt32LE(compressed.length,20);head.writeUInt32LE(bytes.length,24);head.writeUInt16LE(name.length,28);head.writeUInt32LE(offset,42);
  bodies.push(local,name,compressed);central.push(head,name);offset+=local.length+name.length+compressed.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 await writeFile(path,Buffer.concat([...bodies,directory,end]));
 return {file:path,files:entries.length,size_bytes:(await stat(path)).size};
}
const deployed=(await tree(join(root,'dist'))).map(path=>({path,name:relative(join(root,'dist'),path).replaceAll('\\','/')}));
for(const name of ['index.html','_worker.js','app.js','styles.css','_routes.json','DEPLOY-CLOUDFLARE.cmd'])if(!deployed.some(x=>x.name===name))throw new Error('Missing deployment file: '+name);
if(deployed.some(x=>x.name.startsWith('dist/')||x.name.startsWith('src/')))throw new Error('The upload archive must contain only prebuilt root files.');
const upload=await zip(join(output,'Redmont-Archives-Cloudflare-Upload.zip'),deployed);
let files=[];
for(const directory of ['src','public','dist','tools','migrations','tests','docs'])files.push(...await tree(join(root,directory)));
for(const file of ['PRIORITIES-100.json','PRIORITIES-100.md','AGENTS.md','package.json','package-lock.json','.gitignore','README.md','START-HERE.txt','UPLOAD-README.txt','START-WINDOWS.cmd','DEPLOY-WINDOWS.cmd','DEPLOY-CLOUDFLARE.cmd','THIRD-PARTY-NOTICES.txt'])files.push(join(root,file));
const checks=[];for(const path of files.sort())checks.push(hash(await readFile(path))+'  '+relative(root,path).replaceAll('\\','/'));
const meta={version:VERSION,primary_artifact:'Redmont-Archives-Cloudflare-Upload.zip',automatic_database_upgrade:true,local_build_required_for_user:false,live_deployment_performed:false};
const sourceEntries=files.map(path=>({path,name:'Redmont-Archives-Source/'+relative(root,path).replaceAll('\\','/')}));
sourceEntries.push({name:'Redmont-Archives-Source/CHECKSUMS.txt',bytes:Buffer.from(checks.join('\n')+'\n')},{name:'Redmont-Archives-Source/BUILD-INFO.json',bytes:Buffer.from(JSON.stringify(meta,null,2)+'\n')});
const source=await zip(join(output,'Redmont-Archives-2.0-Complete.zip'),sourceEntries);
console.log(JSON.stringify({version:VERSION,upload,source},null,2));
