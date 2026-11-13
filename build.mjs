import {mkdir,copyFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
const manifest=JSON.parse(await readFile('runtime-manifest.json','utf8'));
await mkdir('dist',{recursive:true});
for(const {name,sha256} of manifest.files){
 if(!/^[a-zA-Z0-9_.-]+$/.test(name))throw new Error('Unsafe runtime filename.');
 const bytes=await readFile(name);if(createHash('sha256').update(bytes).digest('hex')!==sha256)throw new Error('Runtime file is out of date: '+name);
 await copyFile(name,'dist/'+name);
}
await copyFile('runtime-manifest.json','dist/runtime-manifest.json');
console.log('Verified prebuilt Redmont Archives '+manifest.version+' is ready in dist/.');
