// Run: node --test cloudflare/production/security.test.cjs
// Pure regression fixtures; does not call Gumroad, Discord, Stripe or Nitrado.
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'worker.js'),'utf8');
let gumroadResponse=null, gumroadStatus=200, capturedRequest=null;
async function mockFetch(url,options){
  if(String(url)!=='https://api.gumroad.com/v2/licenses/verify')
    throw new Error('Unexpected network request in regression test');
  capturedRequest={url,options};
  return {ok:gumroadStatus>=200&&gumroadStatus<300,status:gumroadStatus,
    json:async()=>gumroadResponse};
}
const factory=new Function('TextEncoder','TextDecoder','URL','fetch','crypto',
  source.replace('export default {','const __workerExport = {') +
  '\nreturn {gumroadPurchaseState,gumroadProduct,gumroadVerify,gumroadMembership,stage4GuardWrite};');
const api=factory(TextEncoder,TextDecoder,URL,mockFetch,webcrypto);
const now=()=>Math.floor(Date.now()/1000);
const env={GUMROAD_PRODUCT_ID:'productID_mock123'};
const purchase=()=>({
  product_id:env.GUMROAD_PRODUCT_ID,sale_id:'sale_test_01',subscription_id:'sub_test_01',
  price:599,quantity:1,recurrence:'monthly',is_multiseat_license:false,
  refunded:false,disputed:false,chargebacked:false,
  subscription_cancelled_at:null,subscription_ended_at:null,subscription_failed_at:null
});
test('a paid active membership grants access',()=>{
  assert.equal(api.gumroadPurchaseState(purchase()).active,true);
});
test('cancelled membership retains access before its actual end date',()=>{
  const p={...purchase(),subscription_cancelled_at:new Date((now()+86400)*1000).toISOString()};
  const state=api.gumroadPurchaseState(p);
  assert.equal(state.active,true);
  assert.equal(state.status,'ending');
});
test('cancelled membership loses access after its end date',()=>{
  const p={...purchase(),subscription_cancelled_at:new Date((now()-86400)*1000).toISOString()};
  assert.equal(api.gumroadPurchaseState(p).active,false);
});
test('refunded, disputed and chargebacked memberships are blocked',()=>{
  for(const key of ['refunded','disputed','chargebacked'])
    assert.equal(api.gumroadPurchaseState({...purchase(),[key]:true}).active,false,key);
});
test('failed, ended, expired, unknown dates, free or nonmembership purchases are blocked',()=>{
  const ended=new Date((now()-10)*1000).toISOString();
  for(const field of ['subscription_failed_at','subscription_ended_at'])
    assert.equal(api.gumroadPurchaseState({...purchase(),[field]:ended}).active,false);
  assert.equal(api.gumroadPurchaseState({...purchase(),subscription_cancelled_at:'unknown'}).active,false);
  assert.equal(api.gumroadPurchaseState({...purchase(),price:0}).active,false);
  assert.equal(api.gumroadPurchaseState({...purchase(),subscription_id:null}).active,false);
  assert.equal(api.gumroadPurchaseState({...purchase(),is_multiseat_license:true}).active,false);
});
test('verify uses Gumroad official product ID and does not increment license usage',async()=>{
  gumroadStatus=200;gumroadResponse={success:true,purchase:purchase()};
  const checked=await api.gumroadVerify(env,'ABCD-1234-MOCK-LICENSE');
  assert.equal(checked.active,true);
  const form=new URLSearchParams(capturedRequest.options.body);
  assert.equal(form.get('product_id'),env.GUMROAD_PRODUCT_ID);
  assert.equal(form.get('increment_uses_count'),'false');
  assert.equal(form.get('license_key'),'ABCD-1234-MOCK-LICENSE');
});
test('wrong product, failed API responses and refunded sales do not enable Premium',async()=>{
  gumroadStatus=200;
  gumroadResponse={success:true,purchase:{...purchase(),product_id:'not_our_product'}};
  assert.equal((await api.gumroadVerify(env,'A-VALID-KEY')).active,false);
  gumroadResponse={success:true,purchase:{...purchase(),refunded:true}};
  assert.equal((await api.gumroadVerify(env,'A-VALID-KEY')).active,false);
  gumroadStatus=404;
  assert.equal((await api.gumroadVerify(env,'A-VALID-KEY')).active,false);
});
test('missing or mismatched product ID is rejected',()=>{
  assert.throws(()=>api.gumroadProduct({}),/GUMROAD_PRODUCT_ID/);
  assert.throws(()=>api.gumroadProduct({GUMROAD_PRODUCT_ID:'bad id'}),/GUMROAD_PRODUCT_ID/);
});
test('no linked membership cannot grant Premium tools',async()=>{
  const fakeDb={prepare:()=>({bind:()=>({all:async()=>({results:[]})})})};
  const status=await api.gumroadMembership({...env,DB:fakeDb},{id:'discord_user_a',role:'user'});
  assert.equal(status.active,false);
});
test('expired cached membership cannot grant access',async()=>{
  const fakeDb={prepare:()=>({bind:()=>({all:async()=>({results:[
    {user_id:'discord_user_a',active:1,checked_at:now(),ends_at:now()-10,status:'ending'}
  ]})})})};
  const status=await api.gumroadMembership({...env,DB:fakeDb},{id:'discord_user_a',role:'user'});
  assert.equal(status.active,false);
});
test('server write requires same-origin browser context',()=>{
  const req=(origin,site)=>({url:'https://app.builditplus.net/api/files/write',
    headers:{get:k=>k==='Origin'?origin:k==='Sec-Fetch-Site'?site:null}});
  assert.doesNotThrow(()=>api.stage4GuardWrite(req('https://app.builditplus.net','same-origin')));
  assert.throws(()=>api.stage4GuardWrite(req('https://evil.invalid','cross-site')),/Cross-site/);
  assert.throws(()=>api.stage4GuardWrite(req(null,null)),/Cross-site/);
});
test('all production tool accesses enforce user selection and Gumroad status',()=>{
  assert.match(source,/const sub=await gumroadMembership\(env,user\)/);
  assert.match(source,/async function selectedContext\(/);
  assert.match(source,/services\.some\(s=>s\.id===selected\)/);
  assert.match(source,/query!==selected/);
  assert.doesNotMatch(source,/if\(p==='\/api\/billing\/checkout'\)/);
  assert.doesNotMatch(source,/if\(p==='\/api\/stripe\/webhook'\)/);
  assert.match(source,/if\(p==='\/api\/gumroad\/redeem'\)/);
});
