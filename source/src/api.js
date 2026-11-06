import {json,fail,requireUser,isAdmin,readBody,checkOrigin,currentUser,rateLimit,HttpError} from './security.js';
import {authRoute} from './auth.js';
import {organization,orgRole,requireDocument,publicDocument,saveDocument,documentList,rawDocument} from './documents.js';
import {search,ask} from './search.js';
import {CATEGORIES,cleanContent,parseSources} from './content.js';
import {ensureDatabase} from './schema.js';
import {VERSION} from './version.js';

const positive=value=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<1)fail(400,'Invalid record ID.');return n;};
async function ownerOnly(db,user,org){requireUser(user);if(!org)fail(404,'Organization not found.');if(await orgRole(db,user,org)!=='owner')fail(403,'Only the organization owner can do this.');}
async function orgList(db,user,mine=false){
 const results=await db.prepare(`SELECT o.*,COALESCE(s.deleted,0) AS deleted FROM organizations o LEFT JOIN ra_org_state s ON s.organization_id=o.id ${mine?'WHERE (o.owner_user_id=? OR EXISTS(SELECT 1 FROM ra_org_roles r WHERE r.organization_id=o.id AND r.user_id=?))':'WHERE COALESCE(s.deleted,0)=0'} ORDER BY o.name LIMIT 500`).bind(...(mine?[user.id,user.id]:[])).all();
 return Promise.all(results.results.map(async org=>({...org,role:await orgRole(db,user,org)})));
}
export async function api(request,env){
 try{
  if(!env.DB)fail(503,'The archive database is not connected. Bind your D1 database as DB in Cloudflare Pages settings.');
  const db=env.DB,url=new URL(request.url),path=url.pathname.replace(/\/$/,''),method=request.method;
  let body={};
  if(['POST','PUT','PATCH','DELETE'].includes(method)){checkOrigin(request);body=await readBody(request);}
  else if(!['GET','HEAD'].includes(method))fail(405,'Method not allowed.');
  await ensureDatabase(db);
  const user=await currentUser(request,db);
  const auth=await authRoute(path,request,db,user,body);if(auth)return auth;
  if(path==='/api/health'&&method==='GET'){
   await db.prepare('SELECT 1 FROM ra_document_state LIMIT 1').all();return json({ok:true,version:VERSION,database:'ready'});
  }
  if(path==='/api/categories'&&method==='GET')return json({categories:CATEGORIES});
  if(path==='/api/ai-access'&&method==='GET')return json({allowed:true,authenticated:Boolean(user),mode:env.GROQ_API_KEY?'ai':'archive-excerpts'});
  if(path==='/api/organizations'&&method==='GET'){
   const mine=url.searchParams.get('mine')==='1';if(mine)requireUser(user);
   return json({success:true,organizations:await orgList(db,user,mine)});
  }
  if((path==='/api/organizations'||path==='/api/create-organization')&&method==='POST'){
   requireUser(user);await rateLimit(db,request,'create-org',15,3600,String(user.id));
   const name=String(body.name||'').trim(),description=String(body.description||'').trim(),slug=String(body.slug||name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')).trim().toLowerCase();
   if(!name||name.length>100||description.length>2000||!(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))||slug.length<2||slug.length>100)fail(400,'Enter a name, description and a valid organization URL.');
   if(/^\d+$/.test(slug))fail(400,'The organization URL must include at least one letter.');
   if(await organization(db,slug))fail(409,'That organization URL is already in use.');
   await db.batch([
    db.prepare('INSERT INTO organizations(name,slug,description,owner_user_id) VALUES(?,?,?,?)').bind(name,slug,description,user.id),
    db.prepare("INSERT INTO organization_members(organization_id,user_id,status) SELECT id,?,'active' FROM organizations WHERE slug=?").bind(user.id,slug),
    db.prepare("INSERT INTO ra_audit(actor_user_id,organization_id,action,details) SELECT ?,id,'create_organization',? FROM organizations WHERE slug=?").bind(user.id,JSON.stringify({name}),slug)
   ]);
   return json({success:true,organization:await organization(db,slug)},201);
  }
  let match=path.match(/^\/api\/organizations\/([^/]+)(?:\/(pages|members|audit))?$/);
  if(match){
   const org=await organization(db,decodeURIComponent(match[1]));if(!org)fail(404,'Organization not found.');
   const role=await orgRole(db,user,org),sub=match[2];
   if(org.deleted&&role!=='owner')fail(404,'Organization not found.');
   if(!sub&&method==='GET')return json({organization:{...org,role},can_edit:!org.deleted&&['owner','editor'].includes(role)});
   if(!sub&&(method==='PUT'||method==='DELETE')){
    await ownerOnly(db,user,org);
    if(method==='DELETE'||Object.hasOwn(body,'deleted')){
     const deleted=method==='DELETE'||Boolean(body.deleted)?1:0;
     await db.batch([
      db.prepare('INSERT INTO ra_org_state(organization_id,deleted) VALUES(?,?) ON CONFLICT(organization_id) DO UPDATE SET deleted=excluded.deleted').bind(org.id,deleted),
      db.prepare('INSERT INTO ra_audit(actor_user_id,organization_id,action) VALUES(?,?,?)').bind(user.id,org.id,deleted?'archive_organization':'restore_organization')
     ]);
    }else{
     const name=String(body.name||'').trim(),description=String(body.description||'').trim();
     if(!name||name.length>100||description.length>2000)fail(400,'Enter a name of up to 100 characters and a description of up to 2,000.');
     await db.batch([
      db.prepare('UPDATE organizations SET name=?,description=? WHERE id=?').bind(name,description,org.id),
      db.prepare("INSERT INTO ra_audit(actor_user_id,organization_id,action,details) VALUES(?,?,'update_organization',?)").bind(user.id,org.id,JSON.stringify({name}))
     ]);
    }
    return json({success:true,organization:await organization(db,org.id)});
   }
   if(sub==='pages'&&method==='GET'){
    if(org.deleted)fail(404,'Organization is archived. Restore it first.');
    const result=await documentList(db,user,{...Object.fromEntries(url.searchParams),kind:'page',organization_id:org.id,manage:url.searchParams.get('manage')==='1'});
    return json({...result,pages:result.documents,organization:org});
   }
   if(sub==='pages'&&method==='POST')return json({success:true,page:await saveDocument(db,user,'page',{...body,organization_id:org.id})},201);
   if(sub==='members'){
    await ownerOnly(db,user,org);
    if(method==='GET')return json({members:(await db.prepare('SELECT u.id,u.username,r.role FROM ra_org_roles r JOIN users u ON u.id=r.user_id WHERE r.organization_id=? ORDER BY u.username').bind(org.id).all()).results,owner_user_id:org.owner_user_id});
    if(['POST','DELETE'].includes(method)){
     const member=await db.prepare('SELECT id,username FROM users WHERE username=? COLLATE NOCASE').bind(String(body.username||'').trim()).first();
     if(!member)fail(404,'No account has that username.');
     if(+member.id===+org.owner_user_id)fail(400,'The owner role is permanent and cannot be removed.');
     if(method==='POST'&&!['editor','viewer'].includes(body.role))fail(400,'Choose editor or viewer.');
     await db.batch([
      method==='POST'?db.prepare('INSERT INTO ra_org_roles(organization_id,user_id,role) VALUES(?,?,?) ON CONFLICT(organization_id,user_id) DO UPDATE SET role=excluded.role').bind(org.id,member.id,body.role):db.prepare('DELETE FROM ra_org_roles WHERE organization_id=? AND user_id=?').bind(org.id,member.id),
      db.prepare('INSERT INTO ra_audit(actor_user_id,organization_id,action,details) VALUES(?,?,?,?)').bind(user.id,org.id,method==='POST'?'set_role':'remove_role',JSON.stringify({username:member.username,role:body.role||null}))
     ]);
     return json({success:true});
    }
   }
   if(sub==='audit'&&method==='GET'){
    await ownerOnly(db,user,org);return json({events:(await db.prepare('SELECT a.*,u.username FROM ra_audit a LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.organization_id=? ORDER BY a.id DESC LIMIT 100').bind(org.id).all()).results});
   }
  }
  if(path==='/api/organization-owner'&&method==='GET'){
   const org=await organization(db,url.searchParams.get('organization')||'');return json({authenticated:Boolean(user),owner:Boolean(org&&await orgRole(db,user,org)==='owner')});
  }
  if(path==='/api/documents'&&method==='GET')return json(await documentList(db,user,{...Object.fromEntries(url.searchParams),manage:url.searchParams.get('manage')==='1'}));
  if(path==='/api/documents'&&method==='POST')return json({success:true,document:await saveDocument(db,user,body.kind||'record',body)},201);
  if(['/api/create-page','/api/organization-page-create','/api/archive-post'].includes(path)&&method==='POST'){
   const kind=path==='/api/archive-post'?'record':'page';
   const doc=await saveDocument(db,user,kind,{...body,status:body.status||(kind==='record'?'published':'draft')});return json({success:true,document:doc,page:doc,record_id:doc.id},201);
  }
  match=path.match(/^\/api\/documents\/(record|page)\/(\d+)(?:\/(revisions|restore))?$/);
  if(match){
   const [,kind,idText,action]=match,id=positive(idText);
   if(!action&&method==='GET')return json({document:publicDocument(kind,await requireDocument(db,user,kind,id))});
   if(!action&&method==='PUT')return json({success:true,document:await saveDocument(db,user,kind,body,id)});
   if(!action&&method==='DELETE'){
    const old=await requireDocument(db,user,kind,id,true);return json({success:true,document:await saveDocument(db,user,kind,{...old,status:'deleted',sources:parseSources(old.sources),version:body.version},id)});
   }
   if(action==='revisions'&&method==='GET'){
    const doc=await requireDocument(db,user,kind,id,true);
    const rows=(await db.prepare('SELECT r.*,u.username FROM ra_revisions r LEFT JOIN users u ON u.id=r.author_user_id WHERE r.kind=? AND r.document_id=? ORDER BY r.version DESC LIMIT 100').bind(kind,id).all()).results;
    return json({revisions:rows.map(r=>({...r,content:cleanContent(r.content),sources:parseSources(r.sources)})),version:doc.version});
   }
   if(action==='restore'&&method==='POST'){
    await requireDocument(db,user,kind,id,true);
    const revision=await db.prepare('SELECT * FROM ra_revisions WHERE kind=? AND document_id=? AND id=?').bind(kind,id,positive(body.revision_id)).first();
    if(!revision)fail(404,'Revision not found.');
    return json({success:true,document:await saveDocument(db,user,kind,{...revision,sources:parseSources(revision.sources),version:body.version,restore_revision:revision.id},id)});
   }
  }
  match=path.match(/^\/api\/organization-page\/([^/]+)\/([^/]+)$/);
  if(match&&method==='GET'){
   const org=await organization(db,decodeURIComponent(match[1]));if(!org||org.deleted)fail(404,'Organization not found.');
   const row=await db.prepare('SELECT id FROM pages WHERE organization_id=? AND slug=?').bind(org.id,decodeURIComponent(match[2])).first();if(!row)fail(404,'Page not found.');
   return json({document:publicDocument('page',{...await requireDocument(db,user,'page',row.id),organization_slug:org.slug}),organization:org});
  }
  if((path==='/api/search'||path==='/api/organization-search')&&method==='GET'){
   let org=null;if(url.searchParams.get('organization')){org=await organization(db,url.searchParams.get('organization'));if(!org||org.deleted)fail(404,'Organization not found.');}
   return json({query:url.searchParams.get('q')||'',organization:org,results:await search(db,url.searchParams.get('q'),org)});
  }
  if((path==='/api/ask'||path==='/api/organization-ai')&&method==='POST'){
   let org=null;const key=body.organization||body.organizationSlug;
   if(key){org=await organization(db,key);if(!org||org.deleted)fail(404,'Organization not found.');}
   if(path==='/api/organization-ai'&&!org)fail(400,'Select an organization.');
   return await ask(request,env,body,org);
  }
  if(path==='/api/organization-manage'&&method==='POST'){
   const org=await organization(db,body.organizationId);await ownerOnly(db,user,org);
   if(body.action==='delete_page'){
    const old=await requireDocument(db,user,'page',positive(body.pageId),true);if(+old.organization_id!==+org.id)fail(404,'Page not found in this organization.');
    return json({success:true,document:await saveDocument(db,user,'page',{...old,status:'deleted',sources:parseSources(old.sources),version:body.version},old.id)});
   }
   fail(400,'Use organization settings to archive an organization.');
  }
  if(path==='/api/account/export'&&method==='GET'){
   requireUser(user);const organizations=await orgList(db,user,true),documents=[];
   if(isAdmin(user)){const rows=(await db.prepare('SELECT id FROM archive_records').all()).results;for(const row of rows)documents.push(publicDocument('record',await rawDocument(db,'record',row.id)));}
   for(const org of organizations){if(org.role!=='owner')continue;const rows=(await db.prepare('SELECT id FROM pages WHERE organization_id=?').bind(org.id).all()).results;for(const row of rows)documents.push(publicDocument('page',await rawDocument(db,'page',row.id)));}
   const revisions=(await db.prepare(`SELECT r.* FROM ra_revisions r WHERE (r.kind='record' AND ?=1) OR (r.kind='page' AND EXISTS(SELECT 1 FROM pages p JOIN organizations o ON o.id=p.organization_id WHERE p.id=r.document_id AND o.owner_user_id=?)) ORDER BY r.id`).bind(isAdmin(user)?1:0,user.id).all()).results;
   return json({exported_at:new Date().toISOString(),user,organizations,documents,revisions},200,{'Content-Disposition':'attachment; filename="redmont-archives-export.json"'});
  }
  if(path==='/api/audit'&&method==='GET'){
   requireUser(user);if(!isAdmin(user))fail(403,'Archive owner access required.');
   return json({events:(await db.prepare("SELECT a.*,u.username FROM ra_audit a LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.kind='record' ORDER BY a.id DESC LIMIT 100").all()).results});
  }
  fail(404,'API route not found.');
 }catch(error){
  if(error instanceof HttpError)return json({error:error.message},error.status,error.status===429?{'Retry-After':'900'}:{});
  const text=String(error.message||'');
  if(/UNIQUE constraint failed/i.test(text))return json({error:'That username or page URL is already in use.'},409);
  if(/no such (table|column)/i.test(text))return json({error:'The automatic database upgrade could not finish. Reload once; if it persists, check that the existing database is attached as DB.'},503);
  console.error('Archive request failed:',text.replace(/\b[a-zA-Z0-9_-]{32,}\b/g,'[redacted]'));
  return json({error:'The request could not be completed. Please try again.'},500);
 }
}
