import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';

export function openDatabase(filename=':memory:',migrate=true){
 if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});
 const sqlite=new DatabaseSync(filename);sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
 const db={
  sqlite,
  prepare(sql){return {
   sql,values:[],
   bind(...values){return {...this,values};},
   first(column){const row=sqlite.prepare(this.sql).get(...this.values)||null;return column?row?.[column]??null:row;},
   all(){return {success:true,results:sqlite.prepare(this.sql).all(...this.values)};},
   run(){const result=sqlite.prepare(this.sql).run(...this.values);return {success:true,results:[],meta:{last_row_id:Number(result.lastInsertRowid),changes:Number(result.changes)}};}
  };},
  batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}},
  exec(sql){sqlite.exec(sql);},close(){sqlite.close();}
 };
 if(migrate)sqlite.exec(readFileSync(new URL('../migrations/001-complete.sql',import.meta.url),'utf8'));
 return db;
}
