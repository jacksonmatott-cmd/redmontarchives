import {migrations} from './schema.generated.js';

const pending=new WeakMap();
async function upgrade(db){
 await db.prepare('CREATE TABLE IF NOT EXISTS ra_schema_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
 const applied=new Map((await db.prepare('SELECT id,checksum FROM ra_schema_migrations').all()).results.map(row=>[row.id,row.checksum]));
 for(const migration of migrations){
  if(applied.has(migration.id)){
   if(applied.get(migration.id)!==migration.checksum)throw new Error('A previously applied migration was modified: '+migration.id);
   continue;
  }
  const batch=migration.statements.map(sql=>db.prepare(sql));
  batch.push(db.prepare('INSERT INTO ra_schema_migrations(id,checksum) VALUES(?,?)').bind(migration.id,migration.checksum));
  try{await db.batch(batch);}catch(error){
   // Another isolate may have completed the same upgrade while this one waited.
   const completed=await db.prepare('SELECT checksum FROM ra_schema_migrations WHERE id=?').bind(migration.id).first();
   if(completed?.checksum!==migration.checksum)throw error;
  }
 }
}
export function ensureDatabase(db){
 let ready=pending.get(db);
 if(!ready){ready=upgrade(db).catch(error=>{pending.delete(db);throw error;});pending.set(db,ready);}
 return ready;
}
