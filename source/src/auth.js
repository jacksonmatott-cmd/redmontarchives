import {json,fail,token,digest,hashPassword,verifyPassword,validatePassword,sessionFor,clearCookie,requireUser,isAdmin,rateLimit} from './security.js';

export async function authRoute(path,request,db,user,body){
 if(path==='/api/me'&&request.method==='GET'){
  const security=user?await db.prepare('SELECT recovery_hash FROM ra_user_security WHERE user_id=?').bind(user.id).first():null;
  return json({authenticated:Boolean(user),user:user?{...user,archive_admin:isAdmin(user),has_recovery_code:Boolean(security?.recovery_hash)}:null});
 }
 if(path==='/api/register'&&request.method==='POST'){
  await rateLimit(db,request,'register',8,3600);
  const username=typeof body.username==='string'?body.username.trim():'';
  if(!/^[A-Za-z0-9_-]{3,30}$/.test(username))fail(400,'Use 3–30 letters, numbers, underscores or hyphens for your username.');
  const password=validatePassword(body.password);
  if(username.toLowerCase()==='kaelzvx')fail(409,'This username is reserved for the archive owner.');
  if(await db.prepare('SELECT id FROM users WHERE username=? COLLATE NOCASE').bind(username).first())fail(409,'That username is already in use.');
  const hash=await hashPassword(password),code=token();
  const r=await db.batch([
   db.prepare('INSERT INTO users(username,password_hash) VALUES(?,?)').bind(username,hash),
   db.prepare('INSERT INTO ra_usernames(normalized,user_id) SELECT lower(username),id FROM users WHERE username=? AND password_hash=?').bind(username,hash),
   db.prepare('INSERT INTO ra_user_security(user_id,recovery_hash) SELECT id,? FROM users WHERE username=? AND password_hash=?').bind(await digest(code),username,hash)
  ]);
  const created={id:r[0].meta.last_row_id,username};
  return json({success:true,user:created,recovery_code:code},201,{'Set-Cookie':await sessionFor(created,db,request,hash)});
 }
 if(path==='/api/login'&&request.method==='POST'){
  await rateLimit(db,request,'login-ip',60,900);
  const username=String(body.username||'').trim().slice(0,100),password=String(body.password||'');
  await rateLimit(db,request,'login',10,900,username.toLowerCase());
  const found=await db.prepare('SELECT id,username,password_hash FROM users WHERE username=? COLLATE NOCASE ORDER BY (username=?) DESC,id ASC LIMIT 1').bind(username,username).first();
  if(password.length>256)fail(401,'Invalid username or password.');
  if(!found){await hashPassword(password);fail(401,'Invalid username or password.');}
  if(!await verifyPassword(password,found.password_hash))fail(401,'Invalid username or password.');
  const profile={id:found.id,username:found.username};
  return json({success:true,user:profile},200,{'Set-Cookie':await sessionFor(profile,db,request,found.password_hash)});
 }
 if(path==='/api/logout'&&request.method==='POST'){
  const raw=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('redmont_session='))?.slice(16);
  if(raw)await db.prepare('DELETE FROM sessions WHERE session_token_hash=?').bind(await digest(raw)).run();
  return json({success:true},200,{'Set-Cookie':clearCookie(request)});
 }
 if(path==='/api/recovery-code'&&request.method==='POST'){
  requireUser(user);await rateLimit(db,request,'recovery-rotate',5,900,String(user.id));
  const found=await db.prepare('SELECT password_hash FROM users WHERE id=?').bind(user.id).first();
  if(!await verifyPassword(String(body.password||''),found.password_hash))fail(403,'Your current password is incorrect.');
  const code=token();await db.prepare('INSERT INTO ra_user_security(user_id,recovery_hash) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET recovery_hash=excluded.recovery_hash,updated_at=CURRENT_TIMESTAMP').bind(user.id,await digest(code)).run();
  return json({success:true,recovery_code:code});
 }
 if(path==='/api/reset-password'&&request.method==='POST'){
  await rateLimit(db,request,'reset-ip',20,900);
  const username=String(body.username||'').trim().slice(0,100);
  await rateLimit(db,request,'reset',5,900,username.toLowerCase());
  const password=validatePassword(body.password),code=String(body.recovery_code||'').trim();
  const hash=await digest(code);
  const found=await db.prepare('SELECT u.id FROM users u JOIN ra_user_security r ON r.user_id=u.id WHERE u.username=? COLLATE NOCASE AND r.recovery_hash=?').bind(username,hash).first();
  if(!found)fail(400,'The username or recovery code is incorrect.');
  const passwordHash=await hashPassword(password),newCode=token(),newRecovery=await digest(newCode);
  const r=await db.batch([
   db.prepare('UPDATE users SET password_hash=? WHERE id=? AND EXISTS(SELECT 1 FROM ra_user_security WHERE user_id=? AND recovery_hash=?)').bind(passwordHash,found.id,found.id,hash),
   db.prepare('DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND password_hash=?)').bind(found.id,found.id,passwordHash),
   db.prepare('UPDATE ra_user_security SET recovery_hash=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND recovery_hash=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND password_hash=?)').bind(newRecovery,found.id,hash,found.id,passwordHash)
  ]);
  if(!r[0].meta.changes)fail(400,'This recovery code has already been used.');
  return json({success:true,recovery_code:newCode,message:'Password reset. All previous sessions have been signed out. Save your replacement recovery code.'},200,{'Set-Cookie':clearCookie(request)});
 }
 if(path==='/api/change-password'&&request.method==='POST'){
  requireUser(user);await rateLimit(db,request,'password-change',5,900,String(user.id));
  const found=await db.prepare('SELECT password_hash FROM users WHERE id=?').bind(user.id).first();
  if(!await verifyPassword(String(body.current_password||''),found.password_hash))fail(403,'Your current password is incorrect.');
  const hash=await hashPassword(validatePassword(body.password));
  const r=await db.batch([
   db.prepare('UPDATE users SET password_hash=? WHERE id=? AND password_hash=?').bind(hash,user.id,found.password_hash),
   db.prepare('DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND password_hash=?)').bind(user.id,user.id,hash)
  ]);
  if(!r[0].meta.changes)fail(409,'Your password changed in another session. Please log in again.');
  return json({success:true},200,{'Set-Cookie':await sessionFor(user,db,request,hash)});
 }
 return null;
}
