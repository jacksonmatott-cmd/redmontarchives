import {readdir,copyFile,mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const source=fileURLToPath(new URL('..',import.meta.url)),root=fileURLToPath(new URL('../..',import.meta.url));
await mkdir(root+'dist',{recursive:true});
const manifest=JSON.parse(await readFile(source+'dist/runtime-manifest.json','utf8'));
for(const {name,sha256} of manifest.files){
 if(!/^[a-zA-Z0-9_.-]+$/.test(name))throw new Error('Invalid runtime filename.');
 const bytes=await readFile(source+'dist/'+name);if(createHash('sha256').update(bytes).digest('hex')!==sha256)throw new Error('Runtime hash mismatch: '+name);
 await copyFile(source+'dist/'+name,root+name);await copyFile(source+'dist/'+name,root+'dist/'+name);
}
await copyFile(source+'dist/runtime-manifest.json',root+'runtime-manifest.json');await copyFile(source+'dist/runtime-manifest.json',root+'dist/runtime-manifest.json');
console.log('Verified and synchronized source, root and dist runtime files.');
