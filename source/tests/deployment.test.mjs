import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../tools/local-db.mjs';
import {hashPassword,digest} from '../src/security.js';
import {ensureDatabase} from '../src/schema.js';
import worker from '../src/worker.js';

async function call(db,path,{method='GET',body,cookie}={}){
 const request=new Request('https://archives.test'+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const result=await worker.fetch(request,{DB:db},{});return {status:result.status,data:await result.json(),headers:result.headers};
}
async function legacy(db){
 db.exec(`
 CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE sessions(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,session_token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id));
 CREATE TABLE organizations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,slug TEXT NOT NULL UNIQUE,description TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,owner_user_id INTEGER REFERENCES users(id));
 CREATE TABLE pages(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER NOT NULL REFERENCES organizations(id),title TEXT NOT NULL,slug TEXT NOT NULL,content TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(organization_id,slug));
 CREATE TABLE archive_records(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,category TEXT NOT NULL,content TEXT NOT NULL,author_user_id INTEGER REFERENCES users(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE unrelated_legacy_settings(value TEXT);
 INSERT INTO unrelated_legacy_settings VALUES('keep this');
 `);
 const password='Legacy-Owner-Password1!',hash=await hashPassword(password);
 db.prepare("INSERT INTO users(id,username,password_hash) VALUES(17,'kaelzvx',?)").bind(hash).run();
 db.prepare("INSERT INTO organizations(id,name,slug,owner_user_id) VALUES(3,'Original Society','original-society',17)").run();
 db.prepare("INSERT INTO pages(id,organization_id,title,slug,content,status) VALUES(42,3,'Original page','about','<h2>Original page</h2>','published')").run();
 db.prepare("INSERT INTO archive_records(id,title,category,content,author_user_id) VALUES(22,'Original record','Government','<p>Original archive content</p>',17)").run();
 db.prepare('INSERT INTO sessions(user_id,session_token_hash,expires_at) VALUES(?,?,?)').bind(17,await digest('legacy-session-token'),'2099-01-01T00:00:00Z').run();
 return {password,hash};
}

test('a blank D1 initializes from the first API request without a separate SQL command',async t=>{
 const db=openDatabase(':memory:',false);t.after(()=>db.close());
 const result=await call(db,'/api/health');assert.equal(result.status,200);assert.equal(result.data.version,'2.0.1');assert.equal(result.data.database,'ready');
 const registered=await call(db,'/api/register',{method:'POST',body:{username:'ReadyReader',password:'Reader-Password-123!'}});assert.equal(registered.status,201);assert.equal(registered.data.recovery_code.length,43);
 assert.equal(db.prepare('SELECT count(*) AS n FROM ra_schema_migrations').first().n,1);
});
test('first deployment automatically upgrades a legacy database and keeps existing login, IDs and content',async t=>{
 const db=openDatabase(':memory:',false);t.after(()=>db.close());const old=await legacy(db);
 const requests=await Promise.all([
  call(db,'/api/health'),call(db,'/api/login',{method:'POST',body:{username:'kaelzvx',password:old.password}}),call(db,'/api/documents?kind=record')
 ]);
 requests.forEach(r=>assert.equal(r.status,200));assert.equal(requests[2].data.documents[0].id,22);
 assert.equal(db.prepare('SELECT password_hash FROM users WHERE id=17').first().password_hash,old.hash);
 assert.equal(db.prepare('SELECT owner_user_id FROM organizations WHERE id=3').first().owner_user_id,17);
 assert.equal(db.prepare('SELECT value FROM unrelated_legacy_settings').first().value,'keep this');
 assert.equal((await call(db,'/api/me',{cookie:'redmont_session=legacy-session-token'})).data.user.id,17);
 assert.equal((await call(db,'/api/organization-page/original-society/about')).data.document.id,42);
 const anotherIsolate={...db,batch(){throw new Error('Applied migrations must not run again.');}};
 assert.equal((await call(anotherIsolate,'/api/health')).status,200);
});
test('two independent isolates can initialize the same database without duplicate upgrades',async t=>{
 const db=openDatabase(':memory:',false);t.after(()=>db.close());
 await Promise.all([ensureDatabase({...db}),ensureDatabase({...db})]);
 assert.equal(db.prepare('SELECT count(*) AS n FROM ra_schema_migrations').first().n,1);
 assert.equal((await call(db,'/api/health')).status,200);
});
test('a failed automatic upgrade is retried and never marked as completed early',async t=>{
 const db=openDatabase(':memory:',false);t.after(()=>db.close());let fail=true;
 const binding={...db,batch(statements){if(fail){fail=false;throw new Error('Temporary database interruption');}return db.batch(statements);}};
 await assert.rejects(()=>ensureDatabase(binding),/Temporary database interruption/);
 assert.equal(db.prepare('SELECT count(*) AS n FROM ra_schema_migrations').first().n,0);
 await ensureDatabase(binding);assert.equal(db.prepare('SELECT count(*) AS n FROM ra_schema_migrations').first().n,1);
});
test('a repository-root deployment never serves its editable source or build metadata',async()=>{
 for(const path of ['/source/src/security.js','/src/security.js','/tools/build.mjs','/tests/archives.test.mjs','/package.json','/build.mjs','/AGENTS.md']){
  const response=await worker.fetch(new Request('https://archives.test'+path),{ASSETS:{fetch(){throw new Error('Private project files must never reach static serving.');}}},{});
  assert.equal(response.status,404);
 }
});
