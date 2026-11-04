import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openDatabase} from '../tools/local-db.mjs';
import worker from '../src/worker.js';
import {hashPassword,digest,sessionFor} from '../src/security.js';
import {cleanContent,plainText} from '../src/content.js';
import {saveDocument,rawDocument} from '../src/documents.js';

async function fixture(){
 const db=openDatabase();
 const password='Strong-Archive-Password1!';
 for(const username of ['kaelzvx','owner','editor','viewer','outsider']){
  const result=db.prepare('INSERT INTO users(username,password_hash) VALUES(?,?)').bind(username,await hashPassword(password)).run();
  db.prepare('INSERT INTO ra_usernames(normalized,user_id) VALUES(?,?)').bind(username,result.meta.last_row_id).run();
 }
 const users=Object.fromEntries(db.prepare('SELECT id,username FROM users').all().results.map(u=>[u.username,u]));
 db.prepare("INSERT INTO organizations(name,slug,description,owner_user_id) VALUES('Test Society','test-society','Verified test fixture',?)").bind(users.owner.id).run();
 const org=db.prepare('SELECT * FROM organizations').first();
 db.prepare("INSERT INTO ra_org_roles(organization_id,user_id,role) VALUES(?,?,'editor')").bind(org.id,users.editor.id).run();
 db.prepare("INSERT INTO ra_org_roles(organization_id,user_id,role) VALUES(?,?,'viewer')").bind(org.id,users.viewer.id).run();
 const env={DB:db,ASSETS:{fetch:async()=>new Response(readFileSync(new URL('../public/index.html',import.meta.url)),{headers:{'Content-Type':'text/html'}})}};
 let ipCounter=1;
 async function call(path,{method='GET',body,user,cookie,origin,ip,headers={}}={}){
  if(user){const raw='test-token-'+user.id;db.prepare('INSERT OR IGNORE INTO sessions(user_id,session_token_hash,expires_at) VALUES(?,?,?)').bind(user.id,await digest(raw),'2099-01-01T00:00:00Z').run();cookie='redmont_session='+raw;}
  const request=new Request('https://archives.test'+path,{method,headers:{'Content-Type':'application/json','CF-Connecting-IP':ip||'192.0.2.'+ipCounter++,...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const response=await worker.fetch(request,env,{});let data;const text=await response.text();try{data=JSON.parse(text);}catch{data=text;}
  return {status:response.status,data,headers:response.headers};
 }
 return {db,env,users,org,password,call};
}
const record=(extra={})=>({kind:'record',title:'Council minutes',category:'Government',content:'<h2>Minutes</h2><p>A <strong>verified</strong> record.</p>',status:'published',...extra});
const page=(org,extra={})=>({kind:'page',organization_id:org.id,title:'About society',slug:'about',content:'<h2>Our society</h2><p>Public history.</p>',status:'published',...extra});

test('rich HTML remains formatted while executable HTML and unsafe CSS/URLs are removed',()=>{
 const raw='<h2 style="color:#ac802b;text-align:center;position:fixed;background:url(javascript:alert(1))">History</h2><script>alert(1)</script><img src="https://example.com/photo.png" onerror="alert(1)" alt="Record"><a href="javascript:alert(1)">bad link</a><table><tr><th>Year</th></tr><tr><td>2026</td></tr></table><ul data-checklist="true"><li><input type="checkbox" checked>Verified</li></ul><div data-editor-footer="true"><p>Footer</p></div>';
 const clean=cleanContent(raw);assert.match(clean,/<h2 style="color:#ac802b;text-align:center">/);assert.match(clean,/<table>/);assert.match(clean,/data-checklist="true"/);assert.match(clean,/disabled/);assert.match(clean,/checked/);assert.match(clean,/data-editor-footer/);
 assert.doesNotMatch(clean,/script|onerror|javascript|position|background:/i);assert.match(clean,/<img src="https:/);
});
test('legacy plain text, code fences and singly escaped editor HTML are readable',()=>{
 assert.equal(cleanContent('First line\nSecond line\n\nThird paragraph'),'<p>First line<br>Second line</p><p>Third paragraph</p>');
 assert.equal(cleanContent('```html\n<h2>Title</h2>\n```'),'<h2>Title</h2>');
 assert.equal(cleanContent('&lt;p&gt;Hello &lt;strong&gt;archive&lt;/strong&gt;&lt;/p&gt;'),'<p>Hello <strong>archive</strong></p>');
 assert.equal(plainText('<h2>Title</h2><p>Hello &amp; world</p>'),'Title Hello & world');
});
test('both legacy page-creation aliases enforce organization ownership or an editor role',async t=>{
 const f=await fixture();t.after(()=>f.db.close());
 for(const endpoint of ['/api/create-page','/api/organization-page-create']){
  assert.equal((await f.call(endpoint,{method:'POST',body:page(f.org)})).status,401);
  for(const name of ['outsider','viewer','kaelzvx'])assert.equal((await f.call(endpoint,{method:'POST',body:page(f.org),user:f.users[name]})).status,403);
 }
 const allowed=await f.call('/api/create-page',{method:'POST',body:page(f.org),user:f.users.editor});assert.equal(allowed.status,201);assert.match(allowed.data.page.content,/<h2>/);
 assert.equal((await f.call('/api/archive-post',{method:'POST',body:record(),user:f.users.owner})).status,403);
});
test('editing, publishing, revisions, restore, trash and optimistic concurrency protect real content',async t=>{
 const f=await fixture();t.after(()=>f.db.close());const admin=f.users.kaelzvx;
 const first=await f.call('/api/documents',{method:'POST',body:record({status:'draft'}),user:admin});assert.equal(first.status,201);const id=first.data.document.id;
 assert.equal((await f.call('/api/documents/record/'+id)).status,404);
 const edit=await f.call('/api/documents/record/'+id,{method:'PUT',body:record({title:'Updated minutes',content:'<h2>Updated</h2><p style="font-size:24px;color:#ff0000">New <u>evidence</u>.</p>',version:1}),user:admin});assert.equal(edit.status,200);assert.equal(edit.data.document.version,2);
 const visible=await f.call('/api/documents/record/'+id);assert.equal(visible.data.document.title,'Updated minutes');assert.match(visible.data.document.content,/<h2>Updated<\/h2>/);assert.match(visible.data.document.content,/font-size:24px/);
 assert.equal((await f.call('/api/documents/record/'+id,{method:'PUT',body:record({title:'Stale edit',version:1}),user:admin})).status,409);
 assert.equal((await f.call('/api/documents/record/'+id)).data.document.title,'Updated minutes');
 const history=await f.call(`/api/documents/record/${id}/revisions`,{user:admin});assert.deepEqual(history.data.revisions.map(x=>x.version),[2,1]);
 assert.equal((await f.call(`/api/documents/record/${id}/revisions`)).status,401);
 const restore=await f.call(`/api/documents/record/${id}/restore`,{method:'POST',body:{revision_id:history.data.revisions[1].id,version:2},user:admin});assert.equal(restore.status,200);assert.equal(restore.data.document.version,3);assert.equal(restore.data.document.status,'draft');
 assert.equal((await f.call('/api/documents/record/'+id)).status,404);
 const deleted=await f.call('/api/documents/record/'+id,{method:'DELETE',body:{version:3},user:admin});assert.equal(deleted.status,200);assert.equal(deleted.data.document.status,'deleted');
 assert.equal((await f.call('/api/documents?kind=record')).data.total,0);
 assert.equal((await f.call('/api/documents?kind=record&manage=1&status=deleted',{user:admin})).data.total,1);
});
test('simultaneous edits have one winner and do not overwrite the winning document',async t=>{
 const f=await fixture();t.after(()=>f.db.close());const admin=f.users.kaelzvx;
 const created=await saveDocument(f.db,admin,'record',record());
 const results=await Promise.allSettled(['Winner A','Winner B'].map(title=>saveDocument(f.db,admin,'record',record({title,version:1}),created.id)));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.status===409).length,1);
 const winner=results.find(x=>x.status==='fulfilled').value;assert.equal((await rawDocument(f.db,'record',created.id)).title,winner.title);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM ra_revisions').first().count,2);
});
test('drafts and archived organizations never leak through public APIs, search, or assistant',async t=>{
 const f=await fixture();t.after(()=>f.db.close());
 await saveDocument(f.db,f.users.owner,'page',page(f.org,{title:'Zebratoken published history',content:'<p>Zebratoken public facts.</p>'}));
 await saveDocument(f.db,f.users.owner,'page',page(f.org,{title:'Secrettoken private draft',slug:'secret',status:'draft',content:'<p>Secrettoken must stay private.</p>'}));
 assert.equal((await f.call('/api/search?q=Secrettoken')).data.results.length,0);
 assert.equal((await f.call('/api/ask',{method:'POST',body:{question:'Secrettoken private'}})).data.sources.length,0);
 const publicAsk=await f.call('/api/ask',{method:'POST',body:{question:'Zebratoken history'}});assert.equal(publicAsk.status,200);assert.equal(publicAsk.data.mode,'archive-excerpts');assert.equal(publicAsk.data.sources.length,1);
 assert.equal((await f.call(`/api/organizations/${f.org.id}/pages?manage=1`,{user:f.users.outsider})).data.pages.length,1);
 assert.equal((await f.call(`/api/organizations/${f.org.id}/pages?manage=1`,{user:f.users.editor})).data.pages.length,2);
 await f.call(`/api/organizations/${f.org.id}`,{method:'PUT',body:{deleted:true},user:f.users.owner});
 assert.equal((await f.call('/api/search?q=Zebratoken')).data.results.length,0);
 assert.equal((await f.call('/api/organizations')).data.organizations.length,0);
 assert.equal((await f.call('/api/organization-page/test-society/about')).status,404);
 assert.equal((await f.call('/api/organization-ai',{method:'POST',body:{organization:'test-society',question:'Zebratoken'}})).status,404);
 await f.call(`/api/organizations/${f.org.id}`,{method:'PUT',body:{deleted:false},user:f.users.owner});assert.equal((await f.call('/api/search?q=Zebratoken')).data.results.length,1);
});
test('registration, login, one-time password reset and session revocation work with legacy password hashes',async t=>{
 const f=await fixture();t.after(()=>f.db.close());
 const registered=await f.call('/api/register',{method:'POST',body:{username:'NewReader',password:f.password}});assert.equal(registered.status,201);assert.equal(registered.data.recovery_code.length,43);assert.match(registered.headers.get('set-cookie'),/HttpOnly/);assert.match(registered.headers.get('set-cookie'),/Secure/);
 assert.equal((await f.call('/api/register',{method:'POST',body:{username:'newreader',password:f.password}})).status,409);
 assert.equal((await f.call('/api/register',{method:'POST',body:{username:'KAELZVX',password:f.password}})).status,409);
 const login=await f.call('/api/login',{method:'POST',body:{username:'newreader',password:f.password}});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await f.call('/api/me',{cookie})).data.authenticated,true);
 const reset=await f.call('/api/reset-password',{method:'POST',body:{username:'NewReader',recovery_code:registered.data.recovery_code,password:'Changed-Password1!'}});assert.equal(reset.status,200);assert.notEqual(reset.data.recovery_code,registered.data.recovery_code);
 assert.equal((await f.call('/api/me',{cookie})).data.authenticated,false);
 assert.equal((await f.call('/api/reset-password',{method:'POST',body:{username:'NewReader',recovery_code:registered.data.recovery_code,password:'Changed-Password2!'}})).status,400);
 assert.equal((await f.call('/api/login',{method:'POST',body:{username:'NewReader',password:f.password}})).status,401);
 assert.equal((await f.call('/api/login',{method:'POST',body:{username:'NewReader',password:'Changed-Password1!'}})).status,200);
 assert.equal((await f.call('/api/login',{method:'POST',body:{username:'owner',password:f.password}})).status,200);
 const legacyCode=await f.call('/api/recovery-code',{method:'POST',body:{password:f.password},user:f.users.owner});assert.equal(legacyCode.status,200);
 assert.equal((await f.call('/api/reset-password',{method:'POST',body:{username:'owner',recovery_code:legacyCode.data.recovery_code,password:'Legacy-New-Password1!'}})).status,200);
});
test('owners control team roles and audit; editors cannot grant themselves owner access',async t=>{
 const f=await fixture();t.after(()=>f.db.close());const endpoint=`/api/organizations/${f.org.id}/members`;
 assert.equal((await f.call(endpoint,{method:'POST',body:{username:'editor',role:'editor'},user:f.users.editor})).status,403);
 assert.equal((await f.call(endpoint,{method:'POST',body:{username:'outsider',role:'owner'},user:f.users.owner})).status,400);
 assert.equal((await f.call(endpoint,{method:'POST',body:{username:'outsider',role:'editor'},user:f.users.owner})).status,200);
 assert.equal((await f.call('/api/create-page',{method:'POST',body:page(f.org),user:f.users.outsider})).status,201);
 assert.equal((await f.call(endpoint,{method:'DELETE',body:{username:'outsider'},user:f.users.owner})).status,200);
 assert.equal((await f.call(`/api/organizations/${f.org.id}/audit`,{user:f.users.owner})).status,200);
 assert.equal((await f.call(`/api/organizations/${f.org.id}/audit`,{user:f.users.editor})).status,403);
});
test('cross-site writes, malformed input and abusive login attempts are rejected',async t=>{
 const f=await fixture();t.after(()=>f.db.close());
 assert.equal((await f.call('/api/documents',{method:'POST',body:record(),user:f.users.kaelzvx,origin:'https://evil.test'})).status,403);
 const raw=await worker.fetch(new Request('https://archives.test/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'}),f.env,{});assert.equal(raw.status,400);
 assert.equal((await f.call('/api/login',{method:'POST',body:{},headers:{'Content-Type':'text/plain'}})).status,415);
 assert.equal((await f.call('/api/documents',{method:'POST',body:record({status:'pretend'}),user:f.users.kaelzvx})).status,400);
 let last;for(let n=0;n<11;n++)last=await f.call('/api/login',{method:'POST',body:{username:'owner',password:'wrong'},ip:'198.51.100.10'});assert.equal(last.status,429);assert.ok(last.headers.has('retry-after'));
});
test('legacy database upgrade is repeatable and retains accounts, ownership, records, IDs and extra tables',async t=>{
 const db=openDatabase(':memory:',false);t.after(()=>db.close());
 db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL);CREATE TABLE organizations(id INTEGER PRIMARY KEY,name TEXT,slug TEXT UNIQUE,description TEXT,owner_user_id INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE archive_records(id INTEGER PRIMARY KEY,title TEXT,category TEXT,content TEXT,author_user_id INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE extra_legacy_table(note TEXT);INSERT INTO users VALUES(17,'existing','legacy-hash');INSERT INTO organizations(id,name,slug,owner_user_id) VALUES(3,'Existing Org','existing-org',17);INSERT INTO archive_records(id,title,category,content,author_user_id) VALUES(22,'Old record','Government','Original content',17);INSERT INTO extra_legacy_table VALUES('keep me');`);
 const sql=readFileSync(new URL('../migrations/001-complete.sql',import.meta.url),'utf8');db.exec(sql);db.exec(sql);
 assert.equal(db.prepare('SELECT password_hash FROM users WHERE id=17').first().password_hash,'legacy-hash');assert.equal(db.prepare('SELECT owner_user_id FROM organizations WHERE id=3').first().owner_user_id,17);assert.equal(db.prepare('SELECT content FROM archive_records WHERE id=22').first().content,'Original content');assert.equal(db.prepare('SELECT note FROM extra_legacy_table').first().note,'keep me');
});
test('canonical account routes redirect and no Markdown fence is served above the HTML',async t=>{
 const f=await fixture();t.after(()=>f.db.close());for(const path of ['/signup.html','/register.html','/signup']){const r=await f.call(path);assert.equal(r.status,301);assert.equal(r.headers.get('location'),'/register');}
 const home=await f.call('/');assert.equal(home.status,200);assert.ok(home.data.startsWith('<!doctype html>'));assert.doesNotMatch(home.data,/```/);assert.match(home.data,/href="\/register"/);assert.ok(home.headers.has('content-security-policy'));
 for(const path of ['/api/db-test','/api/org-test','/api/page-test'])assert.equal((await f.call(path)).status,404);
});
test('account export includes owned content and revisions without authentication secrets',async t=>{
 const f=await fixture();t.after(()=>f.db.close());await saveDocument(f.db,f.users.owner,'page',page(f.org));const result=await f.call('/api/account/export',{user:f.users.owner});assert.equal(result.status,200);assert.equal(result.data.documents.length,1);assert.equal(result.data.revisions.length,1);assert.doesNotMatch(JSON.stringify(result.data),/password_hash|session_token|recovery_hash/);assert.equal((await f.call('/api/account/export')).status,401);
});
test('the first edit to a legacy record preserves its original content as a revision',async t=>{
 const f=await fixture();t.after(()=>f.db.close());
 const result=f.db.prepare('INSERT INTO archive_records(title,category,content,author_user_id) VALUES(?,?,?,?)').bind('Legacy original','Government','Original text\nSecond line',f.users.kaelzvx.id).run();
 const doc=await saveDocument(f.db,f.users.kaelzvx,'record',record({version:1}),result.meta.last_row_id);
 assert.equal(doc.version,2);const original=f.db.prepare("SELECT content FROM ra_revisions WHERE kind='record' AND document_id=? AND version=1").bind(doc.id).first();assert.equal(original.content,'Original text\nSecond line');
});
test('assistant receives only published passages and falls back when model citations are invalid',async t=>{
 const f=await fixture();t.after(()=>f.db.close());
 await saveDocument(f.db,f.users.kaelzvx,'record',record({title:'Cobalt published record',content:'<p>Cobalt public evidence.</p>'}));
 await saveDocument(f.db,f.users.kaelzvx,'record',record({title:'Cobalt confidential draft',content:'<p>TOPSECRET draft evidence.</p>',status:'draft'}));
 f.env.GROQ_API_KEY='test-only-key';const originalFetch=globalThis.fetch;t.after(()=>globalThis.fetch=originalFetch);
 let valid=false;
 globalThis.fetch=async(endpoint,options)=>{
  assert.equal(endpoint,'https://api.groq.com/openai/v1/chat/completions');assert.doesNotMatch(options.body,/TOPSECRET|confidential/);
  const answer=valid?{answer:'Cobalt is documented in the published evidence [1].',citations:[1]}:{answer:'Unsupported citation [99].',citations:[99]};
  return Response.json({choices:[{message:{content:JSON.stringify(answer)}}]});
 };
 const fallback=await f.call('/api/ask',{method:'POST',body:{question:'Cobalt public record'}});assert.equal(fallback.data.mode,'archive-excerpts');assert.equal(fallback.data.sources.length,1);
 valid=true;const supported=await f.call('/api/ask',{method:'POST',body:{question:'Cobalt public record'}});assert.equal(supported.data.mode,'ai');assert.equal(supported.data.sources[0].number,1);assert.match(supported.data.sources[0].url,/^\/records\/\d+$/);
});
test('expired sessions and password changes during sign-in cannot create authorized sessions',async t=>{
 const f=await fixture();t.after(()=>f.db.close());const admin=f.users.kaelzvx;
 f.db.prepare('INSERT INTO sessions(user_id,session_token_hash,expires_at) VALUES(?,?,?)').bind(admin.id,await digest('expired-session'),'2000-01-01T00:00:00Z').run();
 assert.equal((await f.call('/api/archive-post',{method:'POST',body:record(),cookie:'redmont_session=expired-session'})).status,401);
 const hash=f.db.prepare('SELECT password_hash FROM users WHERE id=?').bind(admin.id).first().password_hash;
 f.db.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await hashPassword('Changed-in-another-tab!'),admin.id).run();
 await assert.rejects(()=>sessionFor(admin,f.db,new Request('https://archives.test'),hash),e=>e.status===401);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM sessions').first().n,1);
});
