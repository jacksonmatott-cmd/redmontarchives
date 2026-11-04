import {openDatabase} from './local-db.mjs';
import {hashPassword} from '../src/security.js';
import {saveDocument} from '../src/documents.js';

// This command has no remote/database binding option. All sample data is local.
const db=openDatabase('.local/redmont.sqlite');
if(db.prepare('SELECT id FROM users LIMIT 1').first()){console.log('Local accounts already exist; demo seeding skipped.');db.close();process.exit();}
const password='RedmontDemo-2026!';
for(const username of ['kaelzvx','sample-editor']){
 const result=db.prepare('INSERT INTO users(username,password_hash) VALUES(?,?)').bind(username,await hashPassword(password)).run();
 db.prepare('INSERT INTO ra_usernames(normalized,user_id) VALUES(?,?)').bind(username.toLowerCase(),result.meta.last_row_id).run();
}
const admin=db.prepare("SELECT id,username FROM users WHERE username='kaelzvx'").first();
db.prepare("INSERT INTO organizations(name,slug,description,owner_user_id) VALUES('Sample Historical Society','sample-historical-society','Sample organization for local testing. Replace these fictional records with verified material.',?)").bind(admin.id).run();
const org=db.prepare("SELECT id FROM organizations WHERE slug='sample-historical-society'").first();
await saveDocument(db,admin,'record',{title:'Welcome to the Redmont Archives',category:'Government',status:'published',content:'<h2>A place for the public record</h2><p>This is a <strong>local demonstration record</strong>, not a claim about Redmont history.</p><p>Use this preview to test formatting, publishing, sources, permissions, and revision history before deploying.</p><blockquote>Preserve the record. Check the sources.</blockquote>'});
await saveDocument(db,admin,'record',{title:'How to document an event',category:'Events',status:'published',content:'<h2>Start with the evidence</h2><p>This sample guide demonstrates structured content.</p><table><tbody><tr><th>Field</th><th>What to record</th></tr><tr><td>Date</td><td>When the event occurred</td></tr><tr><td>Source</td><td>A primary document or statement</td></tr></tbody></table><ul data-checklist="true"><li><input type="checkbox" checked>Verify names and dates</li><li><input type="checkbox">Add source links</li></ul>'});
await saveDocument(db,admin,'record',{title:'Sample unpublished draft',category:'Other Records',status:'draft',content:'<p>This draft should be visible only to kaelzvx. It must not appear in public search or the assistant.</p>'});
await saveDocument(db,admin,'page',{organization_id:org.id,title:'About the sample society',slug:'about',status:'published',content:'<div data-editor-header="true"><p>Sample Historical Society</p></div><h2>Our sample collection</h2><p>Organization pages use the same rich text editor as main archive records.</p><div data-editor-footer="true"><p>Local demonstration · Replace with verified content</p></div>'});
console.log('Local demo created. Username: kaelzvx or sample-editor\nPassword (both): '+password+'\nThese accounts and records are never included in the production build.');db.close();
