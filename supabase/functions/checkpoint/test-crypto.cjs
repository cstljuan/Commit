const fs=require('fs'), vm=require('vm'), path=require('path'), assert=require('assert/strict');
const root=require('path').resolve(__dirname,'../../..');
const ts=require(root+'/node_modules/typescript');
const nacl=require(root+'/node_modules/tweetnacl');
const util=require(root+'/node_modules/tweetnacl-util');
const storage=new Map();
const modules={};
const secure={getItemAsync:async k=>storage.get(k)??null,setItemAsync:async(k,v)=>{storage.set(k,v)},WHEN_UNLOCKED_THIS_DEVICE_ONLY:'device'};
function load(name){if(modules[name])return modules[name];const m={exports:{}};modules[name]=m.exports;
const js=ts.transpileModule(fs.readFileSync(root+'/lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
function req(n){if(n==='react-native-get-random-values')return {};if(n==='expo-secure-store')return secure;if(n==='expo-crypto')return {CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async(_,s)=>require('crypto').createHash('sha256').update(s).digest('hex')};if(n.startsWith('./'))return load(n.slice(2));return require(require.resolve(n,{paths:[root]}));}
vm.runInThisContext('(function(require,module,exports){'+js+'\n})',{filename:name+'.js'})(req,m,m.exports);return m.exports;}
(async()=>{const c=load('crypto'),v=load('vault');
const pubs=await Promise.all([c.generateKeys(),c.generateKeys()]);assert.deepEqual(pubs[0],pubs[1]);const before=storage.get('commit_keys_v1');await c.generateKeys();assert.equal(before,storage.get('commit_keys_v1'));assert.equal(await c.hasKeys(),true);
const key=c.newTeamKey(),enc=c.encryptForTeam('synthetic idea 🐙',key);assert.equal(c.decryptForTeam(enc.ciphertext,enc.nonce,key),'synthetic idea 🐙');assert.throws(()=>c.decryptForTeam(enc.ciphertext,enc.nonce,c.newTeamKey()));
const wrapped=await c.wrapTeamKeyFor(pubs[0].boxPublicKey,key);assert.equal(await c.unwrapTeamKey(wrapped.encrypted_team_key,wrapped.nonce,pubs[0].boxPublicKey),key);
const s=await c.signContent('test');assert(c.verifyContent('test',s,pubs[0].signPublicKey));assert(!c.verifyContent('edited',s,pubs[0].signPublicKey));assert(!c.verifyContent('test','bad','bad'));
const author='author',project='project',tsISO='2026-11-07T00:00:00.123Z';const hash=await v.hashIdea(tsISO,'idea');const content=v.vaultContent(project,author,hash,tsISO);const row={seq:1,project_id:project,author_id:author,idea_hash:hash,ts:tsISO,author_sig:await c.signContent(content),prev_hash:'0'.repeat(64),entry_hash:await v.sha256(content+'|'+'0'.repeat(64))};
const cp={last_seq:1,last_entry_hash:row.entry_hash,server_sig:await c.signContent('1|'+row.entry_hash)},keys={[author]:pubs[0].signPublicKey};assert((await v.verifyVaultSnapshot([row],keys,cp,pubs[0].signPublicKey)).every(r=>r.ok));
assert.equal((await v.verifyVaultSnapshot([{...row,ts:'2026-11-07T00:00:01.123Z'}],keys,cp,pubs[0].signPublicKey))[0].reason,'entry edited');
assert.equal((await v.verifyVaultSnapshot([],keys,cp,pubs[0].signPublicKey))[0].reason,'checkpoint invalid');
assert.equal((await v.verifyVaultSnapshot([row],keys,null))[1].reason,'checkpoint unavailable');
assert.equal((await v.verifyVaultSnapshot([row],keys,{...cp,last_entry_hash:'0'.repeat(64)},pubs[0].signPublicKey))[1].reason,'checkpoint invalid');
let profile={box_public_key:pubs[0].boxPublicKey,sign_public_key:pubs[0].signPublicKey};let updates=0;
v.configureCyberClient({auth:{getUser:async()=>({data:{user:{id:'alice'}},error:null})},from(){let patch;const q={select(){if(patch)return Promise.resolve({data:[{id:'alice'}],error:null});return q},eq(){return q},is(){return q},single:async()=>({data:profile,error:null}),update(value){patch=value;updates++;profile=value;return q}};return q}});
assert.equal(await v.getDeviceKeyState(),'ready');await v.registerDeviceKeys();assert.equal(updates,0);
const preserved=storage.get('commit_keys_v1');storage.clear();assert.equal(await v.getDeviceKeyState(),'other-device');await assert.rejects(v.registerDeviceKeys());assert.equal(storage.size,0);assert.equal(updates,0);
storage.set('commit_keys_v1',preserved);profile={box_public_key:null,sign_public_key:null};assert.equal(await v.getDeviceKeyState(),'register');await v.registerDeviceKeys();assert.equal(updates,1);assert.equal(await v.getDeviceKeyState(),'ready');assert.equal(storage.get('commit_keys_v1'),preserved);
profile={box_public_key:'different',sign_public_key:'different'};assert.equal(await v.getDeviceKeyState(),'other-device');await assert.rejects(v.registerDeviceKeys());assert.equal(updates,1);
profile={box_public_key:pubs[0].boxPublicKey,sign_public_key:pubs[0].signPublicKey};
const team=load('teamKeys');const bobBox=nacl.box.keyPair();const wrappedRows=[];let actingUser='alice';let committed=true;let publicIdea=false;
const people={alice:profile,bob:{box_public_key:util.encodeBase64(bobBox.publicKey),sign_public_key:'bob-sign'}};
v.configureCyberClient({auth:{getUser:async()=>({data:{user:{id:actingUser}},error:null})},from(table){
 const filters={};let payload;const q={select(){return q},eq(k,val){filters[k]=val;return q},insert(value){payload=value;return q},
 result(){if(payload){if(wrappedRows.some(x=>x.project_id===payload.project_id&&x.user_id===payload.user_id))return {data:null,error:{code:'23505'}};wrappedRows.push(payload);return {data:null,error:null}};
 if(table==='profiles')return {data:people[filters.id],error:null};
 if(table==='projects')return {data:{owner_id:'alice',visibility:publicIdea?'public':'private',idea_public:'public synthetic idea',idea_cipher:enc.ciphertext,idea_nonce:enc.nonce},error:null};
 if(table==='team_members')return {data:committed?[{user_id:'bob'}]:[],error:null};
 if(table==='team_keys')return {data:wrappedRows.find(x=>x.project_id===filters.project_id&&x.user_id===filters.user_id)??null,error:null};
 throw Error('Unexpected table '+table)},single:async()=>q.result(),maybeSingle:async()=>q.result(),then(resolve,reject){return Promise.resolve(q.result()).then(resolve,reject)}};return q;
}});
await team.storeOwnTeamKey('project',key);assert.equal(wrappedRows.length,1);await assert.rejects(team.storeOwnTeamKey('project',key));
assert.equal(await team.readIdea('project'),'synthetic idea 🐙');await team.shareTeamKey('project','bob');assert.equal(wrappedRows.length,2);
const bobWrapped=wrappedRows.find(x=>x.user_id==='bob');assert.equal(util.encodeBase64(nacl.box.open(util.decodeBase64(bobWrapped.encrypted_team_key),util.decodeBase64(bobWrapped.nonce),util.decodeBase64(pubs[0].boxPublicKey),bobBox.secretKey)),key);
await team.shareTeamKey('project','bob');assert.equal(wrappedRows.length,2);committed=false;await assert.rejects(team.shareTeamKey('project','bob'));actingUser='bob';await assert.rejects(team.shareTeamKey('project','alice'));publicIdea=true;assert.equal(await team.readIdea('project'),'public synthetic idea');
console.log('YES: team-key owner storage, member wrapping, private/public reads, preserved retry, pre-Commit refusal, non-owner refusal. Backend adapter mocked.');
console.log('YES: onboarding existing-key reuse; missing-device-key refusal; registration retry preserves keys; mismatched account refusal.');
console.log('YES: key generation concurrent/idempotent; encryption roundtrip/wrong-key denial; box wrapping; signatures/tamper denial; vault valid row; timestamp edit; checkpoint tail deletion; missing checkpoint; wrong checkpoint anchor.');
})().catch(e=>{console.error(e);process.exitCode=1});
