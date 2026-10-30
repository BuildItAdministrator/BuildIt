// Node.js >=20. Run: node --test cloudflare/production/security.test.cjs
// No Stripe or Nitrado credentials, accounts, network calls, or server edits.
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'worker.js'),'utf8');
const factory=new Function('TextEncoder','TextDecoder','URL',
  source.replace('export default {','const __workerExport = {') +
  '\nreturn {stripeConfig,billView,stage4GuardWrite,gameRoots};');
const api=factory(TextEncoder,TextDecoder,URL);

const live={
  STRIPE_SECRET_KEY:'sk_live_dummy',
  STRIPE_PRICE_ID:'price_dummy',
  STRIPE_WEBHOOK_SECRET:'whsec_dummy'
};

test('production only accepts Stripe live secret keys',()=>{
  assert.doesNotThrow(()=>api.stripeConfig(live));
  assert.throws(()=>api.stripeConfig({...live,STRIPE_SECRET_KEY:'sk_test_dummy'}),/LIVE/);
});
test('production requires a live webhook signing secret',()=>{
  assert.doesNotThrow(()=>api.stripeConfig(live,true));
  assert.throws(()=>api.stripeConfig({...live,STRIPE_WEBHOOK_SECRET:''},true),/webhook/);
});
test('no paid access without a paid subscription',()=>{
  assert.equal(api.billView(null,{role:'user'}).active,false);
  assert.equal(api.billView({status:'none',period_end:4102444800},{role:'user'}).active,false);
  assert.equal(api.billView({status:'past_due',period_end:4102444800},{role:'user'}).active,false);
});
test('expired subscriptions have no access',()=>{
  assert.equal(api.billView({status:'active',period_end:1},{role:'user'}).active,false);
  assert.equal(api.billView({status:'active',period_end:4102444800},{role:'user'}).active,true);
});
function request(origin,site){
  return {url:'https://app.builditplus.net/api/files/write',
    headers:{get:key=>key==='Origin'?origin:key==='Sec-Fetch-Site'?site:null}};
}
test('uploads require same-origin browser context',()=>{
  assert.doesNotThrow(()=>api.stage4GuardWrite(request('https://app.builditplus.net','same-origin')));
  assert.throws(()=>api.stage4GuardWrite(request('https://attacker.invalid','cross-site')),/Cross-site/);
  assert.throws(()=>api.stage4GuardWrite(request(null,null)),/Cross-site/);
  assert.throws(()=>api.stage4GuardWrite(request('https://app.builditplus.net','cross-site')),/Cross-site/);
});
test('live-only Stripe webhook events and per-user Nitrado access checks remain present',()=>{
  assert.match(source,/event\.livemode!==true/);
  assert.match(source,/async function selectedContext\(/);
  assert.match(source,/const gate=await requirePremium\(req,env\)/);
  assert.match(source,/services\.some\(s=>s\.id===selected\)/);
  assert.match(source,/query!==selected/);
});
