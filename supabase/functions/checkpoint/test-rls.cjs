const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const root=require('path').resolve(__dirname,'../../..');
// Reuse a test-only PGlite installation; no production dependency changes are needed.
const {PGlite}=require(require.resolve('@electric-sql/pglite',{paths:[process.env.PGLITE_TEST_MODULES || root]}));
const nacl=require(root+'/node_modules/tweetnacl'),u=require(root+'/node_modules/tweetnacl-util');
(async()=>{const db=new PGlite();
await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
create schema auth;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select current_setting('request.role',true)$$;
grant usage on schema auth,public to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`);
await db.exec(fs.readFileSync(__dirname+'/test-schema.sql','utf8'));
for(const f of ['0002_rls.sql','0003_vault.sql']){await db.exec(fs.readFileSync(root+'/supabase/migrations/'+f,'utf8'));console.log('YES: applies '+f)}
const A='00000000-0000-0000-0000-00000000000a',B='00000000-0000-0000-0000-00000000000b',O='00000000-0000-0000-0000-00000000000c',W='00000000-0000-0000-0000-00000000000d',P='00000000-0000-0000-0000-0000000000f1',M='00000000-0000-0000-0000-0000000000e1';
const kp=nacl.sign.keyPair(),pub=u.encodeBase64(kp.publicKey),box=u.encodeBase64(nacl.box.keyPair().publicKey);
await db.exec(`insert into auth.users values('${A}'),('${B}'),('${O}'),('${W}');insert into profiles(id,name,sign_public_key,box_public_key,women_only)values('${A}','Alice','${pub}','${box}',false),('${B}','Bob',null,null,false),('${O}','Outsider',null,null,false),('${W}','Women',null,null,true);
insert into projects(id,owner_id,title,short_pitch)values('${P}','${A}','synthetic','synthetic');
insert into team_members(project_id,user_id,ownership)values('${P}','${A}','owner'),('${P}','${B}','collaborator');
insert into messages(project_id,sender_id,ciphertext,nonce)values('${P}','${A}','cipher','nonce');
insert into matches(id,project_id,user_id)values('${M}','${P}','${B}');`);
async function as(uid,q,params=[]){await db.exec(`set role authenticated;select set_config('request.uid','${uid}',false);select set_config('request.role','authenticated',false);`);try{return await db.query(q,params)}finally{await db.exec(`reset role;select set_config('request.uid','',false)`);}}
async function denied(name,uid,q){let no=false;try{const r=await as(uid,q);no=(r.affectedRows??r.rows.length)===0}catch{no=true}assert(no,name);console.log('YES: denied '+name)}
await db.exec('grant update on profiles to authenticated');assert.equal((await as(O,`update profiles set reliability_score=100 where id='${O}' returning reliability_score`)).rows[0].reliability_score,100);console.log('BEFORE F1: NO, own score update ALLOWED');
await db.exec(fs.readFileSync(root+'/supabase/migrations/0002_rls.sql','utf8').match(/revoke update, insert on public.profiles[\s\S]*?-- A registered/)[0].replace('-- A registered',''));
await denied('F1 reliability UPDATE',O,`update profiles set reliability_score=99 where id='${O}' returning id`);
assert.equal((await as(O,`update profiles set bio='safe' where id='${O}' returning bio`)).rows[0].bio,'safe');console.log('YES: own bio update allowed');
const E='00000000-0000-0000-0000-00000000000e';await db.exec(`insert into auth.users values('${E}')`);await denied('score INSERT',E,`insert into profiles(id,name,reliability_score)values('${E}','Eve',100)returning id`);assert.equal((await as(E,`insert into profiles(id,name)values('${E}','Eve')returning reliability_score`)).rows[0].reliability_score,70);console.log('YES: allowed profile INSERT keeps server score default');
await denied('key rotation',A,`update profiles set sign_public_key='replacement' where id='${A}' returning id`);
assert.equal((await as(B,`select is_team_member('${P}') as yes`)).rows[0].yes,true);console.log('YES: member lookup without recursion');
assert.equal((await as(O,'select * from messages')).rows.length,0);console.log('YES: outsider messages return zero rows');
await denied('outsider message insert',O,`insert into messages(project_id,sender_id,ciphertext,nonce)values('${P}','${O}','x','n') returning id`);
await denied('direct self membership',O,`insert into team_members(project_id,user_id)values('${P}','${O}') returning user_id`);
await denied('outsider key recipient',A,`insert into team_keys(project_id,user_id,encrypted_team_key,nonce,sender_public_key)values('${P}','${O}','x','n','${box}') returning user_id`);
await as(A,`insert into team_keys(project_id,user_id,encrypted_team_key,nonce,sender_public_key)values('${P}','${B}','wrapped','n','${box}')`);assert.equal((await as(B,'select * from team_keys')).rows.length,1);assert.equal((await as(O,'select * from team_keys')).rows.length,0);console.log('YES: owner shares only to active member; outsider key reads return zero');
await denied('embeddings',O,'select * from idea_embeddings');await denied('post attempts',O,'select * from post_attempts');
const ts='2026-11-07T00:00:00.123Z',h=crypto.createHash('sha256').update(ts+'::synthetic idea').digest('hex'),content=P+'|'+A+'|'+h+'|'+ts,sig=u.encodeBase64(nacl.sign.detached(u.decodeUTF8(content),kp.secretKey));
const r=await as(A,'select * from append_vault_entry($1,$2,$3,$4)',[P,h,ts,sig]);assert.equal(r.rows.length,1);assert.equal(r.rows[0].entry_hash,crypto.createHash('sha256').update(content+'|'+'0'.repeat(64)).digest('hex'));assert(nacl.sign.detached.verify(u.decodeUTF8(content),u.decodeBase64(sig),kp.publicKey));console.log('YES: TEST 6 local append, JS/SQL exact hash/signature');
await db.exec(`begin;alter table vault_log drop constraint vault_log_project_id_fkey;alter table vault_log add foreign key(project_id)references projects(id)on delete cascade;`);assert.equal((await as(A,`delete from projects where id='${P}' returning id`)).rows.length,1);assert.equal((await db.query('select * from vault_log')).rows.length,0);console.log('BEFORE F3: NO, project deletion erased vault row');await db.exec('rollback');
await denied('F3 delete project with vault',A,`delete from projects where id='${P}' returning id`);assert.equal((await db.query('select * from vault_log')).rows.length,1);
await denied('direct vault update',O,'update vault_log set ts=now() returning seq');await denied('direct vault deletion',A,'delete from vault_log returning seq');await denied('outsider append',O,`select append_vault_entry('${P}','${h}','${ts}','${sig}')`);
await db.exec(`update vault_log set ts=ts+interval '1 second'`);const edited=(await db.query(`select to_char(ts at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')as ts,entry_hash from vault_log`)).rows[0];assert.notEqual(crypto.createHash('sha256').update(P+'|'+A+'|'+h+'|'+edited.ts+'|'+'0'.repeat(64)).digest('hex'),edited.entry_hash);console.log('YES: TEST 6 local dashboard-style timestamp edit detected');
// Stub the exact 0004 additions from the contract, not Shahd\'s pending implementation.
await db.exec(`alter table profiles add column username text unique,add column primary_role text,add column level text,add column occupation text,add column prompts jsonb default '[]';create table match_messages(id uuid primary key default gen_random_uuid(),match_id uuid references matches(id),sender_id uuid references profiles(id),body text not null,created_at timestamptz default now());`);
await db.exec(fs.readFileSync(root+'/supabase/migrations/0005_rls_additions.sql','utf8'));console.log('YES: applies 0005 against contract 0004 fixture');
await as(B,`insert into match_messages(match_id,sender_id,body)values('${M}','${B}','synthetic')`);assert.equal((await as(A,'select * from match_messages')).rows.length,1);await denied('outsider match read',O,'select * from match_messages');await denied('forged match sender',A,`insert into match_messages(match_id,sender_id,body)values('${M}','${B}','spoof')returning id`);
assert.equal((await as(O,`select * from profiles where id='${W}'`)).rows.length,0);assert.equal((await as(W,`select * from profiles where id='${W}'`)).rows.length,1);console.log('YES: F6 Women profile visibility, no recursion');
await db.exec(`update projects set women_only=true where id='${P}'`);assert.equal((await as(O,'select * from projects')).rows.length,0);assert.equal((await as(W,'select * from projects')).rows.length,1);console.log('YES: Women project visibility');
await as(O,`update profiles set username='outsider' where id='${O}'`);console.log('YES: extended editable profile grant');await db.close();
})().catch(e=>{console.error(e);process.exit(1)});
