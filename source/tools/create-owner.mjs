import {hashPassword} from '../src/security.js';
import {createInterface} from 'node:readline/promises';
import {writeFile} from 'node:fs/promises';
// Creates an explicit one-time SQL file for a NEW database, never a default password.
const rl=createInterface({input:process.stdin,output:process.stdout});
console.log('Use only when the existing database does not already contain kaelzvx.');
const password=await rl.question('New archive-owner password (visible here): ');rl.close();
if(password.length<12||password.length>256)throw new Error('Use a password of at least 12 characters.');
const hash=await hashPassword(password);
await writeFile('owner-setup.sql',`-- Run once on a NEW database after the schema. Delete this file after use.\nINSERT INTO users(username,password_hash) VALUES('kaelzvx','${hash}');\nINSERT INTO ra_usernames(normalized,user_id) SELECT lower(username),id FROM users WHERE username='kaelzvx';\n`,{mode:0o600});
console.log('Created owner-setup.sql. Run it on your intended D1 database, then delete it. Existing accounts do not need this step.');
