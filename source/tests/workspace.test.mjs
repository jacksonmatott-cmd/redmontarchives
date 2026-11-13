import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../tools/local-db.mjs';
import {ensureDatabase} from '../src/schema.js';
import {hashPassword,digest} from '../src/security.js';
import {saveDocument} from '../src/documents.js';
import worker from '../src/worker.js';

async function fixture(t){
 const db=openDatabase(':memory:',false);t.after(()=>db.close());await ensureDatabase(db);
 const hash=await hashPassword('Workspace-Password1!');
 for(const username of ['kaelzvx','owner','reader'])db.prepare('INSERT INTO users(username,password_hash) VALUES(?,?)').bind(username,hash).run();
 const users=Object.fromEntries(db.prepare('SELECT id,username FROM users').all().results.map(x=>[x.username,x]));
 db.prepare("INSERT INTO organizations(id,name,slug,owner_user_id) VALUES(2,'Numeric Society','123',?)").bind(users.owner.id).run();
 db.prepare("INSERT INTO organizations(id,name,slug,owner_user_id) VALUES(123,'Other Society','different',?)").bind(users.reader.id).run();
 const doc=await saveDocument(db,users.kaelzvx,'record',{title:'Council Meeting',category:'Government',status:'published',content:'<h2>Meeting overview</h2><p>North country archive evidence.</p>'});
 const page=await saveDocument(db,users.owner,'page',{organization_id:2,title:'About our society',slug:'about',status:'published',content:'<p>Numeric organization preserved.</p>'});
 async function call(path,options={}){
  const method=options.method||'GET',headers={'Content-Type':'application/json','CF-Connecting-IP':options.ip||'192.0.2.'+Math.floor(Math.random()*200)};
  if(options.user){const token='workspace-session-'+options.user.id;db.prepare('INSERT OR IGNORE INTO sessions(user_id,session_token_hash,expires_at) VALUES(?,?,?)').bind(options.user.id,await digest(token),'2099-01-01T00:00:00Z').run();headers.Cookie='redmont_session='+token;}
  const request=new Request('https://archives.test'+path,{method,headers,...(!['GET','HEAD'].includes(method)?{body:JSON.stringify(options.body||{})}:{})});
  const response=await worker.fetch(request,{DB:db,ASSETS:{fetch:async()=>new Response('<!doctype html>Archive')}},{}),text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return{status:response.status,data,headers:response.headers};
 }
 return{db,users,doc,page,call};
}
test('numeric slugs cannot be confused with an unrelated organization ID',async t=>{
 const f=await fixture(t);
 assert.equal((await f.call('/api/organizations/123')).data.organization.id,2);
 assert.equal((await f.call('/api/organizations/id/123')).data.organization.id,123);
 assert.equal((await f.call('/api/organization-page/123/about')).data.document.id,f.page.id);
 assert.equal((await f.call('/api/documents/page/'+f.page.id)).data.document.url,'/organizations/123/about');
 assert.equal((await f.call('/api/organizations/id/2/pages')).data.pages[0].id,f.page.id);
 assert.equal((await f.call('/api/organizations/id/2/members',{user:f.users.reader})).status,403);
});
test('details protect notes, validate tags, and supply summary excerpts',async t=>{
 const f=await fixture(t),path=`/api/documents/record/${f.doc.id}/details`;
 assert.equal((await f.call(path,{method:'PUT',user:f.users.reader,body:{notes:'attack'}})).status,403);
 assert.equal((await f.call(path,{method:'PUT',user:f.users.kaelzvx,body:{tags:['<script>']}})).status,400);
 const saved=await f.call(path,{method:'PUT',user:f.users.kaelzvx,body:{tags:['history','HISTORY','north'],summary:'Editorial abstract.',notes:'Private note.'}});assert.equal(saved.status,200);assert.deepEqual(saved.data.tags,['history','north']);
 assert.equal((await f.call(path)).data.notes,undefined);assert.equal((await f.call(path,{user:f.users.kaelzvx})).data.notes,'Private note.');
 assert.equal((await f.call('/api/documents?kind=record')).data.documents[0].excerpt,'Editorial abstract.');
 assert.equal((await f.call('/api/search?q=Council')).data.results[0].excerpt,'Editorial abstract.');
});
test('advanced search supports type, title, phrase, category, dates, tag, sorting and pagination',async t=>{
 const f=await fixture(t);
 await f.call(`/api/documents/record/${f.doc.id}/details`,{method:'PUT',user:f.users.kaelzvx,body:{tags:['regional']}});
 assert.equal((await f.call('/api/search?q=Meeting&title=1')).data.total,1);
 assert.equal((await f.call('/api/search?q=evidence&title=1')).data.total,0);
 assert.equal((await f.call('/api/search?q=country%20archive&exact=1')).data.total,1);
 assert.equal((await f.call('/api/search?q=archive%20country&exact=1')).data.total,0);
 assert.equal((await f.call('/api/search?q=Council&category=Events')).data.total,0);
 assert.equal((await f.call('/api/search?q=Numeric&kind=page')).data.total,1);
 assert.equal((await f.call('/api/search?q=Council&from=2099-01-01')).data.total,0);
 assert.equal((await f.call('/api/search?q=Council&to=2000-01-01')).data.total,0);
 assert.equal((await f.call('/api/search?tag=regional')).data.total,1);
 assert.equal((await f.call('/api/search?q=Council&limit=1&offset=1&sort=title')).data.results.length,0);
 assert.equal((await f.call('/api/search?q=missing&from=invalid')).status,400);
});
test('duplicates are private drafts with unique page URLs and retained citations',async t=>{
 const f=await fixture(t),path=`/api/documents/page/${f.page.id}/duplicate`;
 assert.equal((await f.call(path,{method:'POST',user:f.users.reader})).status,403);
 const a=await f.call(path,{method:'POST',user:f.users.owner}),b=await f.call(path,{method:'POST',user:f.users.owner});
 assert.equal(a.status,201);assert.equal(a.data.document.status,'draft');assert.notEqual(a.data.document.slug,b.data.document.slug);
 assert.equal((await f.call('/api/documents/page/'+a.data.document.id)).status,404);
});
test('related records and public feeds never expose drafts or archived organizations',async t=>{
 const f=await fixture(t);
 for(const [kind,id] of [['record',f.doc.id],['page',f.page.id]])await f.call(`/api/documents/${kind}/${id}/details`,{method:'PUT',user:kind==='record'?f.users.kaelzvx:f.users.owner,body:{tags:['linked']}});
 assert.equal((await f.call(`/api/documents/record/${f.doc.id}/related`)).data.documents.length,1);
 await saveDocument(f.db,f.users.kaelzvx,'record',{title:'Secret draft',category:'Government',content:'<p>Not public</p>',status:'draft'});
 const rss=await f.call('/feed.xml'),sitemap=await f.call('/sitemap.xml');assert.equal(rss.status,200);assert.match(rss.data,/Council Meeting/);assert.doesNotMatch(rss.data,/Secret draft/);assert.match(sitemap.data,/organizations\/123\/about/);
 assert.deepEqual((await f.call('/api/stats')).data,{records:1,pages:1,organizations:2});
 await f.call('/api/organizations/id/2',{method:'PUT',user:f.users.owner,body:{deleted:true}});
 assert.equal((await f.call(`/api/documents/record/${f.doc.id}/related`)).data.documents.length,0);assert.doesNotMatch((await f.call('/sitemap.xml')).data,/organizations\/123\/about/);
});
test('corrections are bounded, throttled and triaged only by the archive owner',async t=>{
 const f=await fixture(t),path=`/api/documents/record/${f.doc.id}/report`;
 assert.equal((await f.call(path,{method:'POST',body:{message:'A valid correction description'}})).status,401);
 assert.equal((await f.call(path,{method:'POST',user:f.users.reader,body:{message:'short'}})).status,400);
 const report=await f.call(path,{method:'POST',user:f.users.reader,body:{message:'The meeting date needs a correction.'}});assert.equal(report.status,201);
 assert.equal((await f.call('/api/corrections',{user:f.users.reader})).status,403);
 assert.equal((await f.call('/api/corrections',{user:f.users.kaelzvx})).data.reports.length,1);
 assert.equal((await f.call('/api/corrections',{method:'PUT',user:f.users.kaelzvx,body:{id:report.data.id,status:'resolved'}})).status,200);
 assert.equal((await f.call('/api/account/summary',{user:f.users.reader})).data.submitted_corrections,1);
});
test('session management identifies the current session and cannot revoke another account',async t=>{
 const f=await fixture(t);await f.call('/api/me',{user:f.users.reader});
 f.db.prepare('INSERT INTO sessions(user_id,session_token_hash,expires_at) VALUES(?,?,?)').bind(f.users.reader.id,await digest('other-device'),'2099-01-01').run();
 const other=f.db.prepare('SELECT id FROM sessions WHERE session_token_hash=?').bind(await digest('other-device')).first();
 assert.equal((await f.call('/api/account/sessions',{user:f.users.reader})).data.sessions.length,2);
 await f.call('/api/account/sessions',{method:'DELETE',user:f.users.owner,body:{id:other.id}});assert.ok(f.db.prepare('SELECT id FROM sessions WHERE id=?').bind(other.id).first());
 await f.call('/api/account/sessions',{method:'DELETE',user:f.users.reader,body:{others:true}});
 const sessions=(await f.call('/api/account/sessions',{user:f.users.reader})).data.sessions;assert.equal(sessions.length,1);assert.equal(sessions[0].current,1);assert.equal(sessions[0].session_token_hash,undefined);
});
test('HEAD, malformed paths, static methods, request IDs and finite pagination behave correctly',async t=>{
 const f=await fixture(t);
 const head=await f.call('/api/health',{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.data,'');assert.ok(head.headers.get('X-Request-ID'));
 assert.equal((await f.call('/%invalid')).status,400);assert.equal((await f.call('/',{method:'POST'})).status,405);
 assert.equal((await f.call('/.env')).status,404);assert.equal((await f.call('/%73ource/src/security.js')).status,404);
 assert.equal((await f.call('/api/documents?kind=record&limit=Infinity&offset=Infinity')).status,200);
});
