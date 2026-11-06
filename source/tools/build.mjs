import {build} from 'esbuild';
import {cp,rm,mkdir,writeFile,readFile} from 'node:fs/promises';
import './generate-schema.mjs';
import {VERSION} from '../src/version.js';

await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
await writeFile('dist/DEPLOY-CLOUDFLARE.cmd',(await readFile('DEPLOY-CLOUDFLARE.cmd','utf8')).replace(/\r?\n/g,'\r\n'));
await cp('UPLOAD-README.txt','dist/UPLOAD-README.txt');
await writeFile('dist/index.html',(await readFile('public/index.html','utf8')).replaceAll('__VERSION__',VERSION));
await build({entryPoints:['src/worker.js'],outfile:'dist/_worker.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof',define:{'process.env.NODE_ENV':'"production"'}});
await build({entryPoints:['src/client.js'],outfile:'dist/app.js',bundle:true,format:'iife',platform:'browser',target:'es2022',minify:true,legalComments:'eof'});
await writeFile('dist/_routes.json',JSON.stringify({version:1,include:['/*'],exclude:[]},null,2)+'\n');
await writeFile('dist/robots.txt','User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /edit\nDisallow: /account\n');
console.log('Built dist: static assets and the complete Pages Worker.');
