import {json,fail,requireUser,isAdmin,digest,rateLimit} from './security.js';
import {requireDocument,saveDocument,organization} from './documents.js';
import {parseSources,plainText} from './content.js';

export async function publicIndex(db){
 const records=(await db.prepare("SELECT d.id,d.title,d.category,d.content,d.updated_at,md.tags,'record' AS kind FROM archive_records d LEFT JOIN ra_document_state s ON s.kind='record' AND s.document_id=d.id LEFT JOIN ra_document_details md ON md.kind='record' AND md.document_id=d.id WHERE COALESCE(s.status,'published')='published' ORDER BY d.updated_at DESC,d.id DESC LIMIT 500").all()).results;
 const pages=(await db.prepare("SELECT p.id,p.title,p.content,p.updated_at,md.tags,p.slug,o.slug AS organization_slug,'page' AS kind FROM pages p JOIN organizations o ON o.id=p.organization_id LEFT JOIN ra_document_state s ON s.kind='page' AND s.document_id=p.id LEFT JOIN ra_org_state os ON os.organization_id=o.id LEFT JOIN ra_document_details md ON md.kind='page' AND md.document_id=p.id WHERE COALESCE(s.status,p.status)='published' AND COALESCE(os.deleted,0)=0 ORDER BY p.updated_at DESC,p.id DESC LIMIT 500").all()).results;
 return [...records,...pages].map(d=>({...d,url:d.kind==='record'?`/records/${d.id}`:`/organizations/${encodeURIComponent(d.organization_slug)}/${encodeURIComponent(d.slug)}`,excerpt:plainText(d.content).slice(0,350)})).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
}
export async function extendedRoute(path,request,db,user,body,url){
 const method=request.method;
 if(path==='/api/stats'&&method==='GET'){
  const record=await db.prepare("SELECT COUNT(*) AS n FROM archive_records d LEFT JOIN ra_document_state s ON s.kind='record' AND s.document_id=d.id WHERE COALESCE(s.status,'published')='published'").first();
  const page=await db.prepare("SELECT COUNT(*) AS n FROM pages d JOIN organizations o ON o.id=d.organization_id LEFT JOIN ra_document_state s ON s.kind='page' AND s.document_id=d.id LEFT JOIN ra_org_state os ON os.organization_id=o.id WHERE COALESCE(s.status,d.status)='published' AND COALESCE(os.deleted,0)=0").first();
  const org=await db.prepare('SELECT COUNT(*) AS n FROM organizations o LEFT JOIN ra_org_state s ON s.organization_id=o.id WHERE COALESCE(s.deleted,0)=0').first();
  return json({records:record.n,pages:page.n,organizations:org.n});
 }
 if(path==='/api/account/summary'&&method==='GET'){
  requireUser(user);const orgs=await db.prepare('SELECT COUNT(*) AS n FROM organizations WHERE owner_user_id=?').bind(user.id).first();
  const sessions=await db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id=? AND julianday(expires_at)>julianday('now')").bind(user.id).first();
  const reports=await db.prepare('SELECT COUNT(*) AS n FROM ra_corrections WHERE reporter_user_id=?').bind(user.id).first();
  return json({owned_organizations:orgs.n,active_sessions:sessions.n,submitted_corrections:reports.n});
 }
 if(path==='/api/account/sessions'){
  requireUser(user);
  const raw=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('redmont_session='))?.slice(16),hash=await digest(raw||'');
  await db.prepare("DELETE FROM sessions WHERE user_id=? AND julianday(expires_at)<=julianday('now')").bind(user.id).run();
  if(method==='GET')return json({sessions:(await db.prepare('SELECT id,created_at,expires_at,session_token_hash=? AS current FROM sessions WHERE user_id=? ORDER BY id DESC').bind(hash,user.id).all()).results});
  if(method==='DELETE'){
   if(body.others===true)await db.prepare('DELETE FROM sessions WHERE user_id=? AND session_token_hash<>?').bind(user.id,hash).run();
   else {if(!Number.isSafeInteger(body.id)||body.id<1)fail(400,'Invalid session ID.');await db.prepare('DELETE FROM sessions WHERE id=? AND user_id=?').bind(body.id,user.id).run();}
   return json({success:true});
  }
 }
 let m=path.match(/^\/api\/documents\/(record|page)\/(\d+)\/(details|duplicate|report|related)$/);
 if(m){
  const [,kind,idText,action]=m,id=Number(idText);if(!Number.isSafeInteger(id)||id<1)fail(400,'Invalid record ID.');
  const doc=await requireDocument(db,user,kind,id,action==='duplicate'||(action==='details'&&method==='PUT'));
  if(action==='details'){
   if(method==='GET'){
    const info=await db.prepare('SELECT tags,summary,notes,updated_at FROM ra_document_details WHERE kind=? AND document_id=?').bind(kind,id).first();
    return json({tags:JSON.parse(info?.tags||'[]'),summary:info?.summary||'',...(doc.can_edit?{notes:info?.notes||''}:{}),updated_at:info?.updated_at||null});
   }
   if(method==='PUT'){
    const tags=[...new Set((Array.isArray(body.tags)?body.tags:[]).map(t=>String(t).trim().toLowerCase()).filter(Boolean))];
    if(tags.length>12||tags.some(t=>t.length>40||!/^[\p{L}\p{N} _-]+$/u.test(t)))fail(400,'Use up to 12 tags, 40 characters each, containing letters, numbers, spaces or hyphens.');
    const summary=String(body.summary||'').trim(),notes=String(body.notes||'').trim();if(summary.length>500||notes.length>5000)fail(400,'Summary must be under 500 characters and editorial notes under 5,000.');
    await db.batch([
     db.prepare('INSERT INTO ra_document_details(kind,document_id,tags,summary,notes) VALUES(?,?,?,?,?) ON CONFLICT(kind,document_id) DO UPDATE SET tags=excluded.tags,summary=excluded.summary,notes=excluded.notes,updated_at=CURRENT_TIMESTAMP').bind(kind,id,JSON.stringify(tags),summary,notes),
     db.prepare("INSERT INTO ra_audit(actor_user_id,organization_id,action,kind,document_id) VALUES(?,?,'update_details',?,?)").bind(user.id,doc.organization_id||null,kind,id)
    ]);return json({success:true,tags,summary});
   }
  }
  if(action==='duplicate'&&method==='POST'){
   await rateLimit(db,request,'duplicate',20,3600,String(user.id));
   let slug=doc.slug;
   if(kind==='page'){let n=1;do{slug=doc.slug.slice(0,80)+'-copy'+(n===1?'':'-'+n);n++;}while(await db.prepare('SELECT id FROM pages WHERE organization_id=? AND slug=?').bind(doc.organization_id,slug).first());}
   return json({document:await saveDocument(db,user,kind,{...doc,title:(doc.title+' (copy)').slice(0,200),slug,status:'draft',sources:parseSources(doc.sources)})},201);
  }
  if(action==='report'&&method==='POST'){
   requireUser(user);if(doc.state_status!=='published')fail(400,'Corrections apply to published records.');
   await rateLimit(db,request,'correction',5,3600,String(user.id));
   const message=String(body.message||'').trim();if(message.length<10||message.length>2000)fail(400,'Describe the correction in 10–2,000 characters.');
   const r=await db.prepare('INSERT INTO ra_corrections(kind,document_id,reporter_user_id,message) VALUES(?,?,?,?)').bind(kind,id,user.id,message).run();return json({success:true,id:r.meta.last_row_id},201);
  }
  if(action==='related'&&method==='GET'){
   const meta=await db.prepare('SELECT tags FROM ra_document_details WHERE kind=? AND document_id=?').bind(kind,id).first(),tags=JSON.parse(meta?.tags||'[]');
   if(!tags.length)return json({documents:[]});
   const candidates=await publicIndex(db),documents=[];
   for(const d of candidates){if(d.kind===kind&&d.id===id)continue;if(JSON.parse(d.tags||'[]').some(t=>tags.includes(t)))documents.push({id:d.id,kind:d.kind,title:d.title,url:d.url});if(documents.length===6)break;}
   return json({documents});
  }
 }
 if(path==='/api/corrections'){
  requireUser(user);if(!isAdmin(user))fail(403,'Archive owner access required.');
  if(method==='GET')return json({reports:(await db.prepare('SELECT c.*,u.username FROM ra_corrections c JOIN users u ON u.id=c.reporter_user_id ORDER BY c.id DESC LIMIT 100').all()).results});
  if(method==='PUT'){
   if(!Number.isSafeInteger(body.id)||body.id<1||!['open','resolved'].includes(body.status))fail(400,'Choose a valid report and status.');
   const r=await db.prepare('UPDATE ra_corrections SET status=? WHERE id=?').bind(body.status,body.id).run();if(!r.meta.changes)fail(404,'Correction not found.');return json({success:true});
  }
 }
 return null;
}
