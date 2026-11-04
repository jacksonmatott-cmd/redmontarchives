import {mkdir,copyFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
const files=['index.html','_worker.js','app.js','styles.css','_routes.json','404.html','logo.svg','favicon.svg','favicon.ico','robots.txt','DEPLOY-CLOUDFLARE.cmd','UPLOAD-README.txt'];
await mkdir('dist',{recursive:true});
for(const file of files){await readFile(file);await copyFile(file,'dist/'+file);}
console.log('Finished Redmont Archives files are ready in dist/.');
