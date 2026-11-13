import {cleanContent,plainText,cleanSources,parseSources,CATEGORIES} from './content.js';
import {fail,isAdmin,requireUser,token} from './security.js';

export const tableFor=kind=>kind==='record'?'archive_records':kind==='page'?'pages':fail(400,'Invalid document type.');
export async function orgRole(db,user,org){
 if(!user)return null;if(+org.owner_user_id===+user.id)return 'owner';
 return (await db.prepare('SELECT role FROM ra_org_roles WHERE organization_id=? AND user_id=?').bind(org.id,user.id).first())?.role||null;
}
export async function organization(db,key,mode=typeof key==='number'?'id':'auto'){
 const select='SELECT o.*,COALESCE(s.deleted,0) AS deleted FROM organizations o LEFT JOIN ra_org_state s ON s.organization_id=o.id WHERE ';
 if(mode==='id')return db.prepare(select+'o.id=?').bind(key).first();
 const bySlug=await db.prepare(select+'o.slug=?').bind(String(key)).first();
 return bySlug||(mode==='auto'&&/^\d+$/.test(String(key))?await db.prepare(select+'o.id=?').bind(Number(key)).first():null);
}
export async function rawDocument(db,kind,id){
 const table=tableFor(kind);
 return db.prepare(`SELECT d.* ,${kind==='page'?'o.slug AS organization_slug,':''}COALESCE(s.version,1) AS version,COALESCE(s.status,${kind==='page'?'d.status':"'published'"}) AS state_status,COALESCE(s.sources,'[]') AS sources FROM ${table} d ${kind==='page'?'LEFT JOIN organizations o ON o.id=d.organization_id':''} LEFT JOIN ra_document_state s ON s.kind=? AND s.document_id=d.id WHERE d.id=?`).bind(kind,id).first();
}
export async function canEdit(db,user,kind,doc){
 if(kind==='record')return isAdmin(user);
 const org=await organization(db,doc.organization_id);return org&&!org.deleted&&['owner','editor'].includes(await orgRole(db,user,org));
}
export async function requireDocument(db,user,kind,id,edit=false){
 const doc=await rawDocument(db,kind,id);if(!doc)fail(404,'Record not found.');
 const editable=await canEdit(db,user,kind,doc);
 if(kind==='page'){
  const org=await organization(db,doc.organization_id);if(!org||org.deleted)fail(404,'Organization not found.');
 }
 if(edit){requireUser(user);if(!editable)fail(403,'You do not have permission to edit this record.');}
 else if(doc.state_status!=='published'&&!editable)fail(404,'Record not found.');
 return {...doc,can_edit:editable};
}
export function publicDocument(kind,doc){
 const {state_status,sources,password_hash,...rest}=doc;
 return {...rest,kind,status:state_status,content:cleanContent(doc.content),excerpt:doc.summary||plainText(doc.content).slice(0,240),sources:parseSources(sources),url:kind==='record'?`/records/${doc.id}`:`/organizations/${doc.organization_slug||doc.organization_id}/${doc.slug}`};
}
function validate(body,kind){
 const title=typeof body.title==='string'?body.title.trim():'';
 if(!title||title.length>200)fail(400,'Enter a title of up to 200 characters.');
 if(typeof body.content!=='string'||body.content.length>1000000)fail(400,'The content must be under 1,000,000 characters.');
 const content=cleanContent(body.content);
 if(!plainText(content)&&!/<img\b/.test(content))fail(400,'Enter some content before saving.');
 const status=body.status??'draft';if(!['draft','published','deleted'].includes(status))fail(400,'Invalid publishing status.');
 const slug=String(body.slug||'').trim().toLowerCase();
 if(kind==='page'&&(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>100))fail(400,'Use a page URL containing lowercase letters, numbers and hyphens.');
 const category=kind==='record'?CATEGORIES.find(x=>x.toLowerCase()===String(body.category).toLowerCase()):'';
 if(kind==='record'&&!category)fail(400,'Select an archive category.');
 return {title,content,status,slug,category,sources:JSON.stringify(cleanSources(body.sources))};
}
export async function saveDocument(db,user,kind,body,id=null){
 requireUser(user);const table=tableFor(kind);const v=validate(body,kind),nonce=token();let old;
 let orgId=kind==='page'?Number(body.organization_id??body.organizationId):null;
 if(id){old=await requireDocument(db,user,kind,id,true);orgId=old.organization_id||null;if(+body.version!==+old.version)fail(409,'This record changed in another tab. Reload it before saving. Your text is still in the editor.');}
 else if(kind==='record'){if(!isAdmin(user))fail(403,'Only kaelzvx can create archive records.');}
 else {const org=await organization(db,orgId);if(!org||org.deleted)fail(404,'Organization not found.');if(!['owner','editor'].includes(await orgRole(db,user,org)))fail(403,'An organization owner or editor account is required.');}
 if(kind==='page'){
  const duplicate=await db.prepare('SELECT id FROM pages WHERE organization_id=? AND slug=? AND id<>?').bind(orgId,v.slug,id||0).first();
  if(duplicate)fail(409,'That page URL is already used in this organization.');
 }
 const statements=[];
 if(old){
  // Freeze the untouched legacy document as revision 1 before its first update.
  await db.batch([
   db.prepare('INSERT OR IGNORE INTO ra_document_state(kind,document_id,version,status,sources) VALUES(?,?,?,?,?)').bind(kind,id,old.version,old.state_status,old.sources),
   db.prepare(`INSERT OR IGNORE INTO ra_revisions(kind,document_id,version,title,slug,content,status,category,sources,author_user_id) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(kind,id,old.version,old.title,old.slug||'',old.content,old.state_status,old.category||'',old.sources,old.author_user_id||null)
  ]);
  statements.push(db.prepare(`UPDATE ra_document_state SET version=version+1,status=?,sources=?,edit_token=?,updated_at=CURRENT_TIMESTAMP WHERE kind=? AND document_id=? AND version=?`).bind(v.status,v.sources,nonce,kind,id,old.version));
  const guard=`EXISTS(SELECT 1 FROM ra_document_state WHERE kind=? AND document_id=? AND edit_token=?)`;
  statements.push(kind==='page'?
   db.prepare(`UPDATE pages SET title=?,slug=?,content=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND ${guard}`).bind(v.title,v.slug,v.content,v.status==='deleted'?'draft':v.status,id,kind,id,nonce):
   db.prepare(`UPDATE archive_records SET title=?,category=?,content=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND ${guard}`).bind(v.title,v.category,v.content,id,kind,id,nonce));
 }else{
  statements.push(kind==='page'?
   db.prepare('INSERT INTO pages(organization_id,title,slug,content,status) VALUES(?,?,?,?,?)').bind(orgId,v.title,v.slug,v.content,v.status==='deleted'?'draft':v.status):
   db.prepare('INSERT INTO archive_records(title,category,content,author_user_id) VALUES(?,?,?,?)').bind(v.title,v.category,v.content,user.id));
  statements.push(db.prepare(`INSERT INTO ra_document_state(kind,document_id,version,status,sources,edit_token) VALUES(?,last_insert_rowid(),1,?,?,?)`).bind(kind,v.status,v.sources,nonce));
 }
 statements.push(db.prepare(`INSERT INTO ra_revisions(kind,document_id,version,title,slug,content,status,category,sources,author_user_id) SELECT kind,document_id,version,?,?,?,?,?,?,? FROM ra_document_state WHERE edit_token=?`).bind(v.title,v.slug,v.content,v.status,v.category,v.sources,user.id,nonce));
 statements.push(db.prepare(`INSERT INTO ra_audit(actor_user_id,organization_id,action,kind,document_id,details) SELECT ?,?,?,kind,document_id,? FROM ra_document_state WHERE edit_token=?`).bind(user.id,orgId,body.restore_revision?'restore_revision':v.status==='deleted'?'trash':old?'update':'create',JSON.stringify({title:v.title,status:v.status}),nonce));
 const result=await db.batch(statements);
 if(old&&!result[0].meta.changes)fail(409,'This record changed in another tab. Reload it before saving. Your text is still in the editor.');
 const savedId=old?id:result[0].meta.last_row_id;
 return publicDocument(kind,{...await rawDocument(db,kind,savedId),can_edit:true});
}
export async function documentList(db,user,filters={}){
 const kind=filters.kind||'record',table=tableFor(kind),where=[],values=[kind];
 let manage=false;
 if(kind==='page'){
  const org=await organization(db,filters.organization_id!==undefined?Number(filters.organization_id):filters.organization);
  if(!org||org.deleted)fail(404,'Organization not found.');
  where.push('d.organization_id=?');values.push(org.id);
  manage=filters.manage&&['owner','editor'].includes(await orgRole(db,user,org));
 }else manage=filters.manage&&isAdmin(user);
 const state=`COALESCE(s.status,${kind==='page'?'d.status':"'published'"})`;
 if(manage){if(filters.status){if(!['draft','published','deleted'].includes(filters.status))fail(400,'Invalid status.');where.push(state+'=?');values.push(filters.status);}}
 else where.push(state+"='published'");
 if(filters.category){if(kind!=='record')fail(400,'Collections apply to main archive records.');where.push('lower(d.category)=lower(?)');values.push(filters.category);}
 const q=String(filters.q||'').trim().slice(0,200);
 if(q){where.push("(d.title LIKE ? ESCAPE '\\' OR d.content LIKE ? ESCAPE '\\')");const like='%'+q.replace(/[\\%_]/g,'\\$&')+'%';values.push(like,like);}
 const bounded=(v,f,max)=>Number.isFinite(Number(v))?Math.floor(Math.max(0,Math.min(max,Number(v)))):f;
 const limit=bounded(filters.limit,30,100)||30,offset=bounded(filters.offset,0,100000);
 const from=`FROM ${table} d ${kind==='page'?'LEFT JOIN organizations o ON o.id=d.organization_id':''} LEFT JOIN ra_document_state s ON s.kind=? AND s.document_id=d.id LEFT JOIN ra_document_details md ON md.kind='${kind}' AND md.document_id=d.id`;
 const count=await db.prepare(`SELECT COUNT(*) AS total ${from} ${where.length?'WHERE '+where.join(' AND '):''}`).bind(...values).first();
 const list=await db.prepare(`SELECT d.*,${kind==='page'?'o.slug AS organization_slug,':''}md.summary,COALESCE(s.version,1) AS version,${state} AS state_status,COALESCE(s.sources,'[]') AS sources ${from} ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY d.updated_at DESC,d.id DESC LIMIT ? OFFSET ?`).bind(...values,limit,offset).all();
 return {documents:list.results.map(x=>publicDocument(kind,{...x,can_edit:Boolean(manage)})),total:count.total,limit,offset};
}
