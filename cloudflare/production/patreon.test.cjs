'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(__dirname+'/worker.js','utf8');
let response,networkCalls=0;
const fetchMock=async()=>{networkCalls++;if(response instanceof Error)throw response;return {ok:true,json:async()=>response};};
const api=new Function('crypto','fetch',source.replace('export default {','const worker = {')+'\nreturn {worker,patreonState,patreonMembership,membership,seal,unseal,patreonCallback,patreonBegin,account,csrf};')(webcrypto,fetchMock);
const env={BILLING_PROVIDER:'patreon',PATREON_CAMPAIGN_ID:'123',PATREON_TIER_IDS:'456',PATREON_CLIENT_ID:'client',PATREON_CLIENT_SECRET:'secret',PATREON_REDIRECT_URI:'https://app.example/api/patreon/callback',NITRADO_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};
const user={id:'alice',role:'user'};
const payload=()=>({data:{type:'user',id:'99',relationships:{memberships:{data:[{type:'member',id:'member'}]}}},included:[{type:'member',id:'member',attributes:{patron_status:'active_patron',last_charge_status:'Paid',currently_entitled_amount_cents:599},relationships:{campaign:{data:{id:'123'}},currently_entitled_tiers:{data:[{type:'tier',id:'456'}]}}}]});
function db(handler){return {prepare:sql=>({bind:(...args)=>({first:()=>handler(sql,args,'first'),run:()=>handler(sql,args,'run')})})};}
test('paid member in the configured campaign and tier is entitled',()=>assert.equal(api.patreonState(payload(),env).active,true));
test('other campaigns, unrelated included members and other tiers are rejected',()=>{
 for(const mutate of [p=>p.included[0].relationships.campaign.data.id='999',p=>p.data.relationships.memberships.data=[],p=>p.included[0].relationships.currently_entitled_tiers.data[0].id='999']){const p=payload();mutate(p);assert.equal(api.patreonState(p,env).active,false);}
});
test('free, declined, refunded, unknown and missing membership data cannot grant access',()=>{
 for(const mutation of [{patron_status:'declined_patron'},{patron_status:null},{last_charge_status:'Refunded'},{last_charge_status:'Declined'},{last_charge_status:null},{currently_entitled_amount_cents:0}]){const p=payload();Object.assign(p.included[0].attributes,mutation);assert.equal(api.patreonState(p,env).active,false);}
 assert.throws(()=>api.patreonState({data:{type:'user',id:'99'}},env));
 assert.throws(()=>api.patreonState(payload(),{...env,PATREON_TIER_IDS:''}));
});
test('cancelled paid member keeps access only while entitled tier remains',()=>{
 const p=payload();p.included[0].attributes.patron_status='former_patron';assert.equal(api.patreonState(p,env).active,true);
 p.included[0].relationships.currently_entitled_tiers.data=[];assert.equal(api.patreonState(p,env).active,false);
});
test('tokens cannot be decrypted for another user or Nitrado context',async()=>{
 const encrypted=await api.seal(env,'patreon:alice','token');
 assert.equal(await api.unseal(env,'patreon:alice',encrypted),'token');
 await assert.rejects(api.unseal(env,'patreon:bob',encrypted));await assert.rejects(api.unseal(env,'alice',encrypted));
});
test('fresh membership is cached, stale access fails closed on network failure',async()=>{
 const stamp=Math.floor(Date.now()/1000),row={patreon_user_id:'99',active:1,status:'active',checked_at:stamp,expires_at:stamp+3600,policy_key:'123:456',access_encrypted:await api.seal(env,'patreon:alice','token')};
 const e={...env,DB:db(()=>row)};networkCalls=0;
 assert.equal((await api.membership(e,user)).active,true);assert.equal(networkCalls,0);
 row.checked_at=stamp-301;response=new Error('offline');assert.equal((await api.membership(e,user)).active,false);
});
test('changed tier configuration invalidates cached entitlement immediately',async()=>{
 const stamp=Math.floor(Date.now()/1000),row={active:1,checked_at:stamp,expires_at:stamp+3600,policy_key:'123:OLD',access_encrypted:await api.seal(env,'patreon:alice','token')};
 response=new Error('offline');assert.equal((await api.membership({...env,DB:db(()=>row)},user)).active,false);
});
test('unlinked users are denied and admins retain access',async()=>{
 assert.equal((await api.membership({...env,DB:db(()=>null)},user)).active,false);
 assert.equal((await api.membership(env,{...user,role:'admin'})).active,true);
});
test('callback consumes session-bound state before exchanging any code',async()=>{
 networkCalls=0;
 const req=new Request('https://app.example/api/patreon/callback?state='+('x'.repeat(43))+'&code=abc',{headers:{Cookie:'__Host-buildit_session='+('s'.repeat(43))}});
 const e={...env,DB:db((sql,args)=>{if(sql.startsWith('SELECT u.id'))return user;assert.match(sql,/DELETE FROM patreon_oauth_states/);assert.equal(args[1],'alice');assert.equal(args.length,4);return {meta:{changes:0}};})};
 assert.equal((await api.patreonCallback(req,e,new URL(req.url))).status,403);assert.equal(networkCalls,0);
});
test('connecting requires a signed-in CSRF-protected POST form',async()=>{
 const req=new Request('https://app.example/api/patreon/connect',{method:'POST',headers:{Cookie:'__Host-buildit_session='+('s'.repeat(43)),'Content-Type':'application/x-www-form-urlencoded'},body:'csrf=wrong'});
 const r=await api.patreonBegin(req,{...env,DB:db(()=>user)});assert.equal(r.status,403);
});
test('account renders Patreon controls without a Gumroad key or product setting',async()=>{
 const req=new Request('https://app.example/account',{headers:{Cookie:'__Host-buildit_session='+('s'.repeat(43))}});
 const e={...env,DB:db(sql=>sql.startsWith('SELECT u.id')?{...user,username:'Sander'}:null)};
 const html=await (await api.account(req,e,new URL(req.url))).text();
 assert.match(html,/Connect Patreon/);assert.doesNotMatch(html,/Activate Gumroad Membership/);assert.match(html,/INACTIVE/);
});
test('every production gate uses provider-neutral membership',()=>{
 assert.equal((source.match(/await gumroadMembership\(/g)||[]).length,0);
 assert.match(source,/const sub=await membership\(env,user\)/);
});
test('OAuth callback verifies identity and stores encrypted credentials',async()=>{
 const req=new Request('https://app.example/api/patreon/callback?state='+('x'.repeat(43))+'&code=abc',{headers:{Cookie:'__Host-buildit_session='+('s'.repeat(43))}});
 const mixed={...payload(),access_token:'access-token',refresh_token:'refresh-token',expires_in:3600};response=mixed;
 let saved;
 const e={...env,DB:db((sql,args)=>{
   if(sql.startsWith('SELECT u.id'))return user;
   if(sql.startsWith('DELETE'))return {meta:{changes:1}};
   if(sql.startsWith('SELECT user_id'))return null;
   if(sql.startsWith('INSERT INTO patreon_connections')){saved=args;return {meta:{changes:1}};}
   throw Error('Unexpected SQL');
 })};
 const result=await api.patreonCallback(req,e,new URL(req.url));assert.equal(result.status,303);assert.equal(saved[0],'alice');assert.equal(saved[1],'99');assert.equal(saved[5],1);
 assert.equal(await api.unseal(env,'patreon:alice',saved[2]),'access-token');assert.equal(await api.unseal(env,'patreon:alice',saved[3]),'refresh-token');
});
test('same Patreon identity cannot activate a second Discord account',async()=>{
 const req=new Request('https://app.example/api/patreon/callback?state='+('x'.repeat(43))+'&code=abc',{headers:{Cookie:'__Host-buildit_session='+('s'.repeat(43))}});
 response={...payload(),access_token:'access-token',expires_in:3600};
 const e={...env,DB:db(sql=>{
   if(sql.startsWith('SELECT u.id'))return user;
   if(sql.startsWith('DELETE'))return {meta:{changes:1}};
   if(sql.startsWith('SELECT user_id'))return {user_id:'bob'};
   throw Error('Must not store another user identity');
 })};
 assert.equal((await api.patreonCallback(req,e,new URL(req.url))).status,409);
});
