/**
 * Build It!++ — PRODUCTION: Discord + Stripe Live + personal Nitrado OAuth.
 * Production build: ONLY deploy to buildit-app. Never to buildit-auth-test or buildit-nitrado-logs.
 * D1 binding: DB
 * Discord: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI
 * Stripe: STRIPE_SECRET_KEY (sk_live_), STRIPE_PRICE_ID (live), STRIPE_WEBHOOK_SECRET (live)
 * Nitrado: NITRADO_CLIENT_ID, NITRADO_CLIENT_SECRET,
 *          NITRADO_REDIRECT_URI, NITRADO_ENCRYPTION_KEY (32 bytes, base64)
 * D1 tables: users, sessions, oauth_states, subscriptions, stripe_events,
 *            nitrado_oauth_states, nitrado_connections.
 * Stage 3 is for connection and server selection only. File edits are NOT enabled.
 */
const SESSION='__Host-buildit_session', OAUTH='__Host-buildit_oauth';
const SESSION_TTL=7*86400, OAUTH_TTL=600;
const DISCORD='https://discord.com/api/v10';
const STRIPE='https://api.stripe.com/v1';
const NITRADO_OAUTH='https://oauth.nitrado.net/oauth/v2';
const NITRADO_API='https://api.nitrado.net';
const enc=new TextEncoder(), dec=new TextDecoder();
const now=()=>Math.floor(Date.now()/1000);
function b64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
function unb64(value){const s=value.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));}
function random(){const b=new Uint8Array(32);crypto.getRandomValues(b);return b64(b);}
async function sha(s){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))));}
function cookieRead(req,name){for(const p of (req.headers.get('Cookie')||'').split(';')){const i=p.indexOf('=');if(i>=0&&p.slice(0,i).trim()===name)return p.slice(i+1).trim();}return '';}
const setCookie=(n,v,age)=>`${n}=${v}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
const headers=(extra={})=>({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',...extra});
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:headers({'Content-Type':'application/json; charset=utf-8'})});}
function redirect(location,cookies=[],status=303){const h=new Headers(headers({Location:location}));for(const c of cookies)h.append('Set-Cookie',c);return new Response(null,{status,headers:h});}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function config(req,env){
  if(!env.DB||!env.DISCORD_CLIENT_ID||!env.DISCORD_CLIENT_SECRET||!env.DISCORD_REDIRECT_URI)throw Error('Missing Discord or DB configuration');
  const uri=new URL(String(env.DISCORD_REDIRECT_URI)),origin=new URL(req.url).origin;
  if(uri.protocol!=='https:'||uri.origin!==origin||uri.pathname!=='/api/auth/callback'||uri.search||uri.hash)throw Error('Discord redirect URI is incorrect');
  return uri.toString();
}
function nitradoConfig(req,env){
  if(!env.NITRADO_CLIENT_ID||!env.NITRADO_CLIENT_SECRET||!env.NITRADO_REDIRECT_URI||!env.NITRADO_ENCRYPTION_KEY)throw Error('Missing Nitrado OAuth or encryption settings');
  const uri=new URL(String(env.NITRADO_REDIRECT_URI)),origin=new URL(req.url).origin;
  if(uri.protocol!=='https:'||uri.origin!==origin||uri.pathname!=='/api/nitrado/callback'||uri.search||uri.hash)throw Error('Nitrado redirect URI is incorrect');
  return uri.toString();
}
function stripeConfig(env,webhook=false){
  if(!String(env.STRIPE_SECRET_KEY||'').startsWith('sk_live_') ||
     !String(env.STRIPE_PRICE_ID||'').startsWith('price_'))
    throw Error('Production Stripe requires LIVE API key and LIVE Price ID');
  if(webhook && !String(env.STRIPE_WEBHOOK_SECRET||'').startsWith('whsec_'))
    throw Error('Missing production Stripe webhook secret');
}
async function currentUser(req,env){
  const token=cookieRead(req,SESSION);if(!/^[\w-]{43}$/.test(token))return null;
  return env.DB.prepare(`SELECT u.id,u.discord_id,u.username,u.role,s.id AS session_id FROM sessions s
    JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`).bind(await sha(token),now()).first();
}
async function csrf(req){const t=cookieRead(req,SESSION);return /^[\w-]{43}$/.test(t)?sha('buildit-stage2-csrf:'+t):'';}
async function requireForm(req,env){
  const user=await currentUser(req,env);if(!user)return {error:reply({error:'Log eerst in met Discord'},401)};
  if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers.get('Content-Type')||''))return {error:reply({error:'Ongeldig formulier'},400)};
  if(Number(req.headers.get('Content-Length')||0)>4000)return {error:reply({error:'Formulier te groot'},413)};
  const form=await req.formData(),token=await csrf(req);
  if(!token||form.get('csrf')!==token)return {error:reply({error:'Formulier verlopen. Vernieuw /account'},403)};
  return {user,form};
}
async function discordBegin(req,env){
  const cb=config(req,env),state=random(),guard=random(),verifier=random();
  await env.DB.prepare('DELETE FROM oauth_states WHERE expires_at<=?').bind(now()).run();
  await env.DB.prepare('INSERT INTO oauth_states(state_hash,guard_hash,code_verifier,expires_at) VALUES(?,?,?,?)')
    .bind(await sha(state),await sha(guard),verifier,now()+OAUTH_TTL).run();
  const u=new URL('https://discord.com/oauth2/authorize');
  for(const [k,v] of Object.entries({response_type:'code',client_id:env.DISCORD_CLIENT_ID,redirect_uri:cb,scope:'identify',state,code_challenge:await sha(verifier),code_challenge_method:'S256'}))u.searchParams.set(k,v);
  return redirect(u.toString(),[setCookie(OAUTH,guard,OAUTH_TTL)],302);
}
async function discordCallback(req,env,url){
  const cb=config(req,env),code=url.searchParams.get('code')||'',state=url.searchParams.get('state')||'',guard=cookieRead(req,OAUTH);
  if(url.searchParams.has('error')||!code||code.length>2048||!/^[\w-]{43}$/.test(state)||!/^[\w-]{43}$/.test(guard))return reply({error:'Discord-inloggen geannuleerd of ongeldig'},400);
  const stateHash=await sha(state);
  const row=await env.DB.prepare('SELECT guard_hash,code_verifier FROM oauth_states WHERE state_hash=? AND expires_at>?').bind(stateHash,now()).first();
  if(!row||row.guard_hash!==await sha(guard))return reply({error:'Discord-aanmelding verlopen'},403);
  const consumed=await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash=? AND guard_hash=?').bind(stateHash,await sha(guard)).run();
  if(consumed.meta.changes!==1)return reply({error:'Discord-aanmelding al gebruikt'},403);
  const form=new URLSearchParams({client_id:String(env.DISCORD_CLIENT_ID),client_secret:String(env.DISCORD_CLIENT_SECRET),grant_type:'authorization_code',code,redirect_uri:cb,code_verifier:row.code_verifier});
  const r=await fetch(DISCORD+'/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});
  if(!r.ok)return reply({error:'Discord-autorisatie mislukt'},502);
  const token=await r.json();if(!token.access_token||String(token.token_type).toLowerCase()!=='bearer')return reply({error:'Discord-token ongeldig'},502);
  const p=await fetch(DISCORD+'/users/@me',{headers:{Authorization:'Bearer '+token.access_token}});
  if(!p.ok)return reply({error:'Discord-profiel niet beschikbaar'},502);
  const profile=await p.json(),id=String(profile.id||'');if(!/^\d{15,22}$/.test(id))return reply({error:'Discord-ID ongeldig'},502);
  const stamp=now(),username=String(profile.global_name||profile.username||'Discord user').slice(0,100);
  await env.DB.prepare(`INSERT INTO users(id,discord_id,username,role,created_at,updated_at) VALUES(?,?,?,'user',?,?)
    ON CONFLICT(discord_id) DO UPDATE SET username=excluded.username,updated_at=excluded.updated_at`)
    .bind(crypto.randomUUID(),id,username,stamp,stamp).run();
  const u=await env.DB.prepare('SELECT id FROM users WHERE discord_id=?').bind(id).first();
  if(!u)return reply({error:'Account kon niet worden opgeslagen'},500);
  const session=random();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(stamp).run();
  await env.DB.prepare('INSERT INTO sessions(id,user_id,token_hash,created_at,expires_at) VALUES(?,?,?,?,?)')
    .bind(crypto.randomUUID(),u.id,await sha(session),stamp,stamp+SESSION_TTL).run();
  return redirect('/account',[setCookie(OAUTH,'',0),setCookie(SESSION,session,SESSION_TTL)]);
}
async function logout(req,env){const r=await requireForm(req,env);if(r.error)return r.error;
  await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(r.user.session_id).run();
  return redirect('/account',[setCookie(SESSION,'',0)]);
}
async function stripeApi(env,path,opt={}){
  stripeConfig(env);const h={Authorization:'Bearer '+env.STRIPE_SECRET_KEY,Accept:'application/json'};
  if(opt.form)h['Content-Type']='application/x-www-form-urlencoded';
  const r=await fetch(STRIPE+path,{method:opt.form?'POST':'GET',headers:h,body:opt.form?opt.form.toString():undefined});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw Error('Stripe API '+r.status+': '+String(data?.error?.message||'unknown').slice(0,150));
  return data;
}
const objId=x=>typeof x==='string'?x:(typeof x?.id==='string'?x.id:'');
const billRow=(env,id)=>env.DB.prepare('SELECT * FROM subscriptions WHERE user_id=?').bind(id).first();
function billView(row,user){const status=row?.status||'none',end=Number(row?.period_end||0);
  return {status,active:user?.role==='admin'||(status==='active'&&end>now()),periodEnd:end||null,cancelAtPeriodEnd:!!row?.cancel_at_period_end,admin:user?.role==='admin'};
}
function premium(sub,price){return !!(sub?.id&&Array.isArray(sub.items?.data)&&sub.items.data.some(x=>objId(x.price)===price));}
function periodEnd(sub,price){const item=(sub.items?.data||[]).find(x=>objId(x.price)===price);return Number(item?.current_period_end||sub.current_period_end||0);}
async function ensureCustomer(env,user){
  let row=await billRow(env,user.id);if(row?.stripe_customer_id)return row.stripe_customer_id;
  const result=await stripeApi(env,'/customers',{form:new URLSearchParams({name:user.username,'metadata[buildit_user_id]':user.id})});
  if(!/^cus_/.test(result.id||''))throw Error('Stripe customer could not be created');
  await env.DB.prepare(`INSERT INTO subscriptions(user_id,stripe_customer_id,status,period_end,cancel_at_period_end,updated_at)
    VALUES(?,?,'none',0,0,?) ON CONFLICT(user_id) DO NOTHING`).bind(user.id,result.id,now()).run();
  row=await billRow(env,user.id);return row.stripe_customer_id;
}
async function customerSubs(env,customer){const x=await stripeApi(env,'/subscriptions?'+new URLSearchParams({customer,status:'all',limit:'100'}));return (x.data||[]).filter(s=>premium(s,env.STRIPE_PRICE_ID));}
async function checkout(req,env){
  const r=await requireForm(req,env);if(r.error)return r.error;stripeConfig(env);if(r.user.role==='admin')return redirect('/account');
  // Fail closed if the selected Stripe LIVE price does not match the public offer.
  const price=await stripeApi(env,'/prices/'+encodeURIComponent(String(env.STRIPE_PRICE_ID)));
  if(price.active!==true||price.currency!=='eur'||Number(price.unit_amount)!==499||
     price.recurring?.interval!=='month'||Number(price.recurring?.interval_count)!==1)
    throw Error('Live Stripe Price must be active EUR 4.99/month. Checkout disabled.');
  const customer=await ensureCustomer(env,r.user),subs=await customerSubs(env,customer);
  if(subs.some(s=>!['canceled','incomplete_expired'].includes(s.status)))return redirect('/account?message=existing');
  const origin=new URL(req.url).origin;
  const form=new URLSearchParams({mode:'subscription',customer,client_reference_id:r.user.id,'line_items[0][price]':env.STRIPE_PRICE_ID,
    'line_items[0][quantity]':'1','subscription_data[metadata][buildit_user_id]':r.user.id,
    'metadata[buildit_user_id]':r.user.id,success_url:origin+'/account?checkout=success',cancel_url:origin+'/account?checkout=cancel'});
  const session=await stripeApi(env,'/checkout/sessions',{form});
  if(!/^https:\/\/checkout\.stripe\.com\//.test(session.url||''))throw Error('Invalid Stripe checkout URL');
  return redirect(session.url);
}
async function portal(req,env){
  const r=await requireForm(req,env);if(r.error)return r.error;
  const row=await billRow(env,r.user.id);if(!row?.stripe_customer_id)return redirect('/account');
  const result=await stripeApi(env,'/billing_portal/sessions',{form:new URLSearchParams({customer:row.stripe_customer_id,return_url:new URL(req.url).origin+'/account'})});
  if(!/^https:\/\/billing\.stripe\.com\//.test(result.url||''))throw Error('Invalid Stripe portal URL');
  return redirect(result.url);
}
function hexBytes(h){return /^[0-9a-f]{64}$/i.test(h)?Uint8Array.from(h.match(/../g),x=>parseInt(x,16)):null;}
async function verifyStripe(req,env){
  stripeConfig(env,true);const raw=await req.text();if(raw.length>1000000)throw Error('Webhook too large');
  const parts=(req.headers.get('Stripe-Signature')||'').split(',').map(s=>s.trim());
  const t=parts.find(s=>s.startsWith('t='))?.slice(2),sig=parts.filter(s=>s.startsWith('v1=')).map(s=>s.slice(3));
  if(!t||!Number.isSafeInteger(Number(t))||Math.abs(now()-Number(t))>300||!sig.length)throw Error('Missing or stale signature');
  const key=await crypto.subtle.importKey('raw',enc.encode(env.STRIPE_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  let valid=false;for(const s of sig){const b=hexBytes(s);if(b&&await crypto.subtle.verify('HMAC',key,b,enc.encode(t+'.'+raw))){valid=true;break;}}
  if(!valid)throw Error('Invalid Stripe signature');
  const event=JSON.parse(raw);if(!/^evt_/.test(event?.id||'')||event.livemode!==true)throw Error('Not a live-mode Stripe event');return event;
}
async function syncSubscription(env,sub,hint=''){
  if(!premium(sub,env.STRIPE_PRICE_ID))return;
  const customer=objId(sub.customer),row=await env.DB.prepare('SELECT * FROM subscriptions WHERE stripe_customer_id=?').bind(customer).first();
  if(!row||(hint&&row.user_id!==hint))return;
  if(row.stripe_subscription_id&&row.stripe_subscription_id!==sub.id&&row.status==='active'&&Number(row.period_end)>now())return;
  await env.DB.prepare(`UPDATE subscriptions SET stripe_subscription_id=?,status=?,period_end=?,cancel_at_period_end=?,updated_at=? WHERE user_id=? AND stripe_customer_id=?`)
    .bind(sub.id,String(sub.status||'unknown'),Math.max(0,periodEnd(sub,env.STRIPE_PRICE_ID)),sub.cancel_at_period_end?1:0,now(),row.user_id,customer).run();
}
async function stripeWebhook(req,env){
  let event;try{event=await verifyStripe(req,env);}catch(e){console.error('Stripe signature rejected');return reply({error:'Invalid Stripe webhook signature'},400);}
  const old=await env.DB.prepare('SELECT id FROM stripe_events WHERE id=?').bind(event.id).first();if(old)return reply({received:true,duplicate:true});
  const obj=event.data?.object||{},type=event.type||'';
  if(type==='checkout.session.completed'&&obj.mode==='subscription'&&obj.subscription){
    const sub=await stripeApi(env,'/subscriptions/'+encodeURIComponent(objId(obj.subscription)));
    await syncSubscription(env,sub,String(obj.client_reference_id||''));
  }else if(type.startsWith('customer.subscription.')&&obj.id){
    const sub=await stripeApi(env,'/subscriptions/'+encodeURIComponent(obj.id));await syncSubscription(env,sub,String(sub.metadata?.buildit_user_id||''));
  }else if(['invoice.paid','invoice.payment_failed'].includes(type)&&obj.customer){
    const subs=await customerSubs(env,objId(obj.customer));for(const sub of subs)await syncSubscription(env,sub,String(sub.metadata?.buildit_user_id||''));
  }
  await env.DB.prepare('INSERT OR IGNORE INTO stripe_events(id,event_type,created_at) VALUES(?,?,?)').bind(event.id,type,now()).run();
  return reply({received:true});
}

// Nitrado OAuth, encrypted token storage and strict per-Discord-account separation.
async function cryptoKey(env){
  const raw=unb64(String(env.NITRADO_ENCRYPTION_KEY||''));
  if(raw.length!==32)throw Error('NITRADO_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
}
async function seal(env,userId,plain){
  if(!plain)return null;
  const iv=new Uint8Array(12);crypto.getRandomValues(iv);
  const key=await cryptoKey(env);
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('nitrado:'+userId)},key,enc.encode(plain));
  return 'v1.'+b64(iv)+'.'+b64(new Uint8Array(cipher));
}
async function unseal(env,userId,packed){
  if(!packed)return null;
  const parts=packed.split('.');if(parts.length!==3||parts[0]!=='v1')throw Error('Encrypted token format unknown');
  const key=await cryptoKey(env);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(parts[1]),additionalData:enc.encode('nitrado:'+userId)},key,unb64(parts[2]));
  return dec.decode(plain);
}
async function nitradoToken(env,form){
  const params=new URLSearchParams({client_id:String(env.NITRADO_CLIENT_ID),client_secret:String(env.NITRADO_CLIENT_SECRET),...form});
  const r=await fetch(NITRADO_OAUTH+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:params});
  const result=await r.json().catch(()=>({}));
  if(!r.ok||typeof result.access_token!=='string'||!result.access_token)throw Error('Nitrado token exchange failed (HTTP '+r.status+')');
  if(result.token_type&&String(result.token_type).toLowerCase()!=='bearer')throw Error('Unexpected Nitrado token type');
  return result;
}
async function nitradoServicesByToken(token){
  const r=await fetch(NITRADO_API+'/services',{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
  if(!r.ok)throw Error('Nitrado /services returned HTTP '+r.status);
  const body=await r.json();const entries=body?.data?.services;
  if(!Array.isArray(entries))throw Error('Nitrado returned unexpected services format');
  return entries.map(s=>({
    id:String(s.id||''),name:String(s.name||s.type_human||s.game_human||('Nitrado service '+s.id)).slice(0,140),
    type:String(s.type||''),status:String(s.status||''),game:String(s.game_human||s.game||'').slice(0,100)
  })).filter(s=>/^\d{1,20}$/.test(s.id)).slice(0,200);
}
const connectionRow=(env,user)=>env.DB.prepare('SELECT * FROM nitrado_connections WHERE user_id=?').bind(user.id).first();
async function connectionToken(env,user){
  let row=await connectionRow(env,user);
  if(!row)throw Error('Nitrado not connected');
  if(Number(row.expires_at)>now()+60)return unseal(env,user.id,row.access_encrypted);
  if(!row.refresh_encrypted)throw Error('Nitrado access expired. Reconnect Nitrado.');
  const refresh=await unseal(env,user.id,row.refresh_encrypted);
  const next=await nitradoToken(env,{grant_type:'refresh_token',refresh_token:refresh});
  const access=await seal(env,user.id,next.access_token);
  const newRefresh=await seal(env,user.id,next.refresh_token||refresh);
  const until=now()+Math.max(60,Number(next.expires_in||3600));
  // Optimistic update: concurrent refreshes cannot overwrite a newer token.
  const saved=await env.DB.prepare(`UPDATE nitrado_connections SET access_encrypted=?,refresh_encrypted=?,expires_at=?,updated_at=?
    WHERE user_id=? AND access_encrypted=?`).bind(access,newRefresh,until,now(),user.id,row.access_encrypted).run();
  if(saved.meta.changes===1)return next.access_token;
  row=await connectionRow(env,user);if(!row)throw Error('Nitrado connection removed');
  return unseal(env,user.id,row.access_encrypted);
}
async function linkedServices(env,user){
  const access=await connectionToken(env,user);
  try{return await nitradoServicesByToken(access);}
  catch(error){
    if(!String(error.message).includes('HTTP 401'))throw error;
    // If the token was revoked early, force a refresh by updating expiry.
    await env.DB.prepare('UPDATE nitrado_connections SET expires_at=0 WHERE user_id=?').bind(user.id).run();
    return nitradoServicesByToken(await connectionToken(env,user));
  }
}

// Gumroad Membership Premium: a verified recurring sale is bound to one Discord user.
// Production only. Never accept a browser-declared paid status or a receipt screenshot.
const GUMROAD_VERIFY='https://api.gumroad.com/v2/licenses/verify';
const GUMROAD_TTL=300;
const GUMROAD_MAX_ATTEMPTS=8;
function gumroadProduct(env){
  const id=String(env.GUMROAD_PRODUCT_ID||'').trim();
  if(!/^[A-Za-z0-9_=-]{8,160}$/.test(id))throw Error('GUMROAD_PRODUCT_ID is not configured');
  return id;
}
function gumroadPurchaseState(p,at=now()){
  if(!p||typeof p!=='object'||p.refunded===true||p.disputed===true||p.chargebacked===true)
    return {active:false,status:'revoked',endsAt:null};
  if(typeof p.subscription_id!=='string'||!p.subscription_id.trim()||
     typeof p.recurrence!=='string'||!p.recurrence.trim()||
     p.is_multiseat_license===true||Number(p.quantity||1)!==1||
     !Number.isFinite(Number(p.price))||Number(p.price)<=0)
    return {active:false,status:'not_paid_membership',endsAt:null};
  const ends=[];
  for(const field of ['subscription_ended_at','subscription_cancelled_at','subscription_failed_at']){
    if(p[field]===null||p[field]===undefined||p[field]==='')continue;
    if(typeof p[field]!=='string')return {active:false,status:'invalid_end_date',endsAt:null};
    const seconds=Math.floor(Date.parse(p[field])/1000);
    if(!Number.isFinite(seconds)||seconds<=0)return {active:false,status:'invalid_end_date',endsAt:null};
    ends.push(seconds);
  }
  const endsAt=ends.length?Math.min(...ends):null;
  return {active:endsAt===null||endsAt>at,
    status:endsAt===null?'active':(endsAt>at?'ending':'ended'),endsAt};
}
async function gumroadVerify(env,key){
  const productId=gumroadProduct(env);
  const form=new URLSearchParams({product_id:productId,license_key:key,increment_uses_count:'false'});
  let response;
  try{
    response=await fetch(GUMROAD_VERIFY,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
      body:form.toString(),redirect:'error',signal:AbortSignal.timeout(10000)});
  }catch(e){throw Object.assign(Error('Gumroad verification temporarily unavailable'),{httpStatus:503});}
  if(response.status===404)return {active:false,status:'invalid_license'};
  if(!response.ok)throw Object.assign(Error('Gumroad verification unavailable (HTTP '+response.status+')'),{httpStatus:503});
  const json=await response.json().catch(()=>null);
  const p=json?.purchase;
  if(json?.success!==true||!p||p.product_id!==productId)
    return {active:false,status:'invalid_license'};
  const saleId=String(p.sale_id||p.id||''),subscriptionId=String(p.subscription_id||'');
  if(!saleId||saleId.length>160||!subscriptionId||subscriptionId.length>160)
    return {active:false,status:'invalid_license'};
  return {...gumroadPurchaseState(p),saleId,subscriptionId,productId};
}
async function gumroadEncrypt(env,userId,keyText){
  const iv=new Uint8Array(12);crypto.getRandomValues(iv);
  const cryptoSecret=await cryptoKey(env);
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('gumroad:'+userId)},
    cryptoSecret,enc.encode(keyText));
  return 'g1.'+b64(iv)+'.'+b64(new Uint8Array(cipher));
}
async function gumroadDecrypt(env,userId,ciphertext){
  const parts=String(ciphertext||'').split('.');
  if(parts.length!==3||parts[0]!=='g1')throw Error('Gumroad license format invalid');
  const cryptoSecret=await cryptoKey(env);
  const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(parts[1]),
      additionalData:enc.encode('gumroad:'+userId)},cryptoSecret,unb64(parts[2]));
  return dec.decode(data);
}
function gumroadInactive(status='not_active',admin=false){
  return {status,active:false,periodEnd:null,cancelAtPeriodEnd:false,admin};
}
async function gumroadMembership(env,user){
  if(!user)return gumroadInactive();
  if(user.role==='admin')return {status:'admin',active:true,periodEnd:null,cancelAtPeriodEnd:false,admin:true};
  const productId=gumroadProduct(env);
  const rows=await env.DB.prepare('SELECT * FROM gumroad_memberships WHERE user_id=? AND product_id=? ORDER BY checked_at DESC LIMIT 5')
    .bind(user.id,productId).all();
  let fallback=gumroadInactive();
  for(const row of (rows.results||[])){
    if(row.checked_at>now()-GUMROAD_TTL){
      if(row.active===1&&(!row.ends_at||Number(row.ends_at)>now()))
        return {status:row.status,active:true,periodEnd:row.ends_at||null,cancelAtPeriodEnd:row.status==='ending',admin:false};
      fallback=gumroadInactive(row.status);
      continue;
    }
    let checked;
    try{checked=await gumroadVerify(env,await gumroadDecrypt(env,user.id,row.encrypted_license));}
    catch(error){console.error('Gumroad entitlement check failed',error.message);return gumroadInactive('verification_unavailable');}
    const matches=checked.saleId===row.sale_id&&checked.productId===row.product_id&&checked.subscriptionId===row.subscription_id;
    const valid=matches&&checked.active===true,stamp=now();
    const status=matches?checked.status:'license_changed',endsAt=matches?checked.endsAt:null;
    await env.DB.prepare('UPDATE gumroad_memberships SET active=?,ends_at=?,status=?,checked_at=? WHERE sale_id=? AND user_id=?')
      .bind(valid?1:0,endsAt,status,stamp,row.sale_id,user.id).run();
    if(valid)return {status,active:true,periodEnd:endsAt||null,cancelAtPeriodEnd:status==='ending',admin:false};
    fallback=gumroadInactive(status);
  }
  return fallback;
}
async function gumroadRedeem(req,env){
  const r=await requireForm(req,env);if(r.error)return r.error;
  if(r.user.role==='admin')return redirect('/account');
  const key=String(r.form.get('license_key')||'').trim();
  if(key.length<12||key.length>180||!/^[A-Za-z0-9_-]+$/.test(key))
    return redirect('/account?license=invalid');
  const stamp=now(),cutoff=stamp-1800;
  const attempt=await env.DB.prepare(
    'INSERT INTO gumroad_redeem_attempts(user_id,window_start,attempts) VALUES(?,?,1) '+
    'ON CONFLICT(user_id) DO UPDATE SET attempts=CASE WHEN window_start<=? THEN 1 ELSE attempts+1 END, '+
    'window_start=CASE WHEN window_start<=? THEN ? ELSE window_start END RETURNING attempts')
    .bind(r.user.id,stamp,cutoff,cutoff,stamp).first();
  if(Number(attempt?.attempts||0)>GUMROAD_MAX_ATTEMPTS)
    return reply({error:'Too many activation attempts. Try again in 30 minutes.'},429);
  const verified=await gumroadVerify(env,key);
  if(!verified.active)return redirect('/account?license=invalid');
  const hash=await sha('buildit-gumroad-license:'+key);
  const existing=await env.DB.prepare('SELECT user_id FROM gumroad_memberships WHERE sale_id=? OR key_hash=? LIMIT 1')
    .bind(verified.saleId,hash).first();
  if(existing&&existing.user_id!==r.user.id)return redirect('/account?license=already_used');
  const encrypted=await gumroadEncrypt(env,r.user.id,key);
  try{
    await env.DB.prepare(
      'INSERT INTO gumroad_memberships(sale_id,user_id,product_id,subscription_id,key_hash,encrypted_license,active,ends_at,checked_at,status,created_at) '+
      'VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(sale_id) DO UPDATE SET '+
      'active=excluded.active,ends_at=excluded.ends_at,checked_at=excluded.checked_at,status=excluded.status, key_hash=excluded.key_hash, '+
      'encrypted_license=excluded.encrypted_license WHERE user_id=excluded.user_id')
      .bind(verified.saleId,r.user.id,verified.productId,verified.subscriptionId,hash,encrypted,
        1,verified.endsAt,stamp,verified.status,stamp).run();
  }catch(e){
    if(/UNIQUE|constraint/i.test(String(e.message)))return redirect('/account?license=already_used');
    throw e;
  }
  return redirect('/account?license=activated');
}

async function requirePremium(req,env){
  const user=await currentUser(req,env);if(!user)return {error:reply({error:'Discord login required'},401)};
  const sub=await gumroadMembership(env,user);
  if(!sub.active)return {error:reply({error:'An active Gumroad Build It!++ Premium Membership is required'},403)};
  return {user,sub};
}
async function nitradoBegin(req,env){
  const p=await requirePremium(req,env);if(p.error)return p.error;
  const callback=nitradoConfig(req,env);
  const state=random(),fingerprint=await sha(cookieRead(req,SESSION));
  await env.DB.prepare('DELETE FROM nitrado_oauth_states WHERE expires_at<=?').bind(now()).run();
  await env.DB.prepare('DELETE FROM nitrado_oauth_states WHERE user_id=?').bind(p.user.id).run();
  await env.DB.prepare('INSERT INTO nitrado_oauth_states(state_hash,user_id,session_hash,expires_at) VALUES(?,?,?,?)')
    .bind(await sha(state),p.user.id,fingerprint,now()+600).run();
  const u=new URL(NITRADO_OAUTH+'/auth');
  for(const [k,v] of Object.entries({client_id:String(env.NITRADO_CLIENT_ID),redirect_uri:callback,response_type:'code',scope:'service',state}))u.searchParams.set(k,v);
  return redirect(u.toString(),[],302);
}
async function nitradoCallback(req,env,url){
  const p=await requirePremium(req,env);if(p.error)return p.error;
  const callback=nitradoConfig(req,env);
  if(url.searchParams.has('error'))return redirect('/account?nitrado=cancel');
  const state=url.searchParams.get('state')||'',code=url.searchParams.get('code')||'';
  if(!/^[\w-]{43}$/.test(state)||!code||code.length>2048)return reply({error:'Nitrado authorization was incomplete'},400);
  const hashState=await sha(state),fingerprint=await sha(cookieRead(req,SESSION));
  const consumed=await env.DB.prepare(`DELETE FROM nitrado_oauth_states WHERE state_hash=? AND user_id=?
    AND session_hash=? AND expires_at>?`).bind(hashState,p.user.id,fingerprint,now()).run();
  if(consumed.meta.changes!==1)return reply({error:'Nitrado login expired or belongs to a different session'},403);
  const token=await nitradoToken(env,{grant_type:'authorization_code',code,redirect_uri:callback});
  const services=await nitradoServicesByToken(token.access_token); // Verify service scope before persisting secrets.
  const access=await seal(env,p.user.id,token.access_token),refresh=await seal(env,p.user.id,token.refresh_token||'');
  const expiry=now()+Math.max(60,Number(token.expires_in||3600));
  await env.DB.prepare(`INSERT INTO nitrado_connections(user_id,access_encrypted,refresh_encrypted,expires_at,selected_service_id,updated_at)
    VALUES(?,?,?,?,NULL,?) ON CONFLICT(user_id) DO UPDATE SET access_encrypted=excluded.access_encrypted,
    refresh_encrypted=excluded.refresh_encrypted,expires_at=excluded.expires_at,selected_service_id=NULL,updated_at=excluded.updated_at`)
    .bind(p.user.id,access,refresh,expiry,now()).run();
  return redirect('/account?nitrado=connected&count='+services.length);
}
async function nitradoList(req,env){
  const p=await requirePremium(req,env);if(p.error)return p.error;
  const row=await connectionRow(env,p.user);if(!row)return reply({connected:false,servers:[]});
  const services=await linkedServices(env,p.user);
  return reply({connected:true,selectedServerId:row.selected_service_id||null,servers:services});
}
async function nitradoSelect(req,env){
  const r=await requireForm(req,env);if(r.error)return r.error;
  if(!(await gumroadMembership(env,r.user)).active)return reply({error:'Active Gumroad Premium Membership required'},403);
  const id=String(r.form.get('service_id')||'');
  if(!/^\d{1,20}$/.test(id))return reply({error:'Invalid server ID'},400);
  const services=await linkedServices(env,r.user);
  if(!services.some(s=>s.id===id))return reply({error:'This service is not authorized for your Nitrado account'},403);
  await env.DB.prepare('UPDATE nitrado_connections SET selected_service_id=?,updated_at=? WHERE user_id=?').bind(id,now(),r.user.id).run();
  return redirect('/account?nitrado=selected');
}
async function nitradoDisconnect(req,env){
  const r=await requireForm(req,env);if(r.error)return r.error;
  await env.DB.prepare('DELETE FROM nitrado_connections WHERE user_id=?').bind(r.user.id).run();
  await env.DB.prepare('DELETE FROM nitrado_oauth_states WHERE user_id=?').bind(r.user.id).run();
  return redirect('/account?nitrado=disconnected');
}
async function account(req,env,url){
  const user=await currentUser(req,env),token=user?await csrf(req):'';
  const billing=await gumroadMembership(env,user),conn=user?await connectionRow(env,user):null;
  const form=(action,label,extra='')=>`<form method="POST" action="${action}"><input type="hidden" name="csrf" value="${esc(token)}">${extra}<button>${esc(label)}</button></form>`;
  let serverHtml='';
  if(user&&billing.active&&conn){
    try{
      const services=await linkedServices(env,user);
      serverHtml=services.length?services.map(s=>`<div class="server"><strong>${esc(s.name)}</strong><small>ID: ${esc(s.id)} · ${esc(s.game||s.type||'Nitrado')} · ${esc(s.status)}</small>${s.id===conn.selected_service_id?'<p class="green">Selected server</p>':form('/api/nitrado/select','Select server',`<input type="hidden" name="service_id" value="${esc(s.id)}">`)}</div>`).join(''):'<p>No accessible services were returned by Nitrado.</p>';
    }catch(e){serverHtml='<p class="note">Could not load Nitrado servers. Check connection or reconnect.</p>';console.error('Nitrado list:',e.message);}
  }
  const gumroadUrl=String(env.GUMROAD_BUY_URL||'').trim();
  const buyHref=/^https:\/\/(?:[A-Za-z0-9-]+\.)?gumroad\.com\/l\/[A-Za-z0-9_-]+(?:\?[^#]*)?$/.test(gumroadUrl)?gumroadUrl:'';
  const gumroadOffer='<h2>Build It!++ Premium — €5.99/month</h2><p>Recurring Gumroad Membership for access to Build It!++ tools. Your own Nitrado server is not included.</p>'+
    (buyHref?'<p><a class="button" href="'+esc(buyHref)+'" target="_blank" rel="noopener noreferrer">Buy membership on Gumroad</a></p>':'<p class="note">Gumroad purchase link is being configured.</p>')+
    '<p>Already purchased? Enter the license key from your Gumroad receipt.</p>'+
    form('/api/gumroad/redeem','Activate Gumroad Membership','<label>Gumroad license key <input name="license_key" type="text" autocomplete="off" spellcheck="false" required minlength="12" maxlength="180" placeholder="License key from receipt"></label>')+
    '<p class="note">Cancel or change recurring payments using Subscription settings on your Gumroad receipt or in your Gumroad Library. Access continues until the membership end date.</p>';
  const licenseStatus=url.searchParams.get('license');
  const licenseNotice=licenseStatus==='activated'?'Gumroad Membership successfully activated.':licenseStatus==='invalid'?'License invalid, expired or revoked.':licenseStatus==='already_used'?'License is already linked to another Discord account.':'';
  const notice=banner==='connected'?'Nitrado account connected and permission verified.':banner==='selected'?'Server selected.':banner==='disconnected'?'Nitrado connection removed from Build It!++.':banner==='cancel'?'Nitrado authorization cancelled.':'';
  const content=!user?'<p>Sign in to connect your own DayZ server.</p><a class="button" href="/api/auth/discord">Continue with Discord</a>':`
    <p>Signed in as <strong>${esc(user.username)}</strong></p>
    <p>Gumroad Membership: <strong>${esc(billing.status)}</strong> · Premium: <strong>${billing.active?'ACTIVE':'INACTIVE'}</strong></p>
    ${billing.periodEnd?`<p class="note">Paid until: ${esc(new Date(billing.periodEnd*1000).toLocaleDateString('nl-NL'))}</p>`:''}
    ${notice?`<p class="notice">${esc(notice)}</p>`:''}
    ${licenseNotice?`<p class="notice">${esc(licenseNotice)}</p>`:''}
    ${!billing.admin?gumroadOffer:''}
    ${billing.active?`<h2>Connect your Nitrado server</h2>${conn?`<p class="green">Nitrado connected</p>${serverHtml}${form('/api/nitrado/disconnect','Disconnect Nitrado')}`:'<p>Authorize Build It!++ to see the Nitrado services available to your account.</p><a class="button" href="/api/nitrado/connect">Connect Nitrado</a>'}`:'<p class="note">Activate Premium before connecting Nitrado.</p>'}
    <hr>
    ${user&&conn?'<p class="note">Your tokens are encrypted in D1. The existing production Nitrado Worker is unaffected.</p>':''}
    <p class="note">Membership payments, cancellations and payment method changes are managed in your Gumroad account.</p>
    ${form('/api/auth/logout','Sign out')}
    <p class="note">Recurring billing is handled by Gumroad. Premium grants access to Build It!++ tools, not a Nitrado server.</p>`;
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Build It!++ — Account</title><style>
    :root{color-scheme:dark}*{box-sizing:border-box}body{font:16px system-ui,sans-serif;background:#101c23;color:#edf6fa;display:grid;place-items:center;min-height:100vh;margin:0;padding:25px}
    main{background:#19303a;border:1px solid #395663;border-radius:18px;width:min(96vw,590px);padding:32px}h1{margin:0}h2{margin-top:26px}p{line-height:1.5}.note,small{font-size:13px;color:#b0c9d4}.green{color:#8edbb3}
    form{display:inline-block;margin:8px 8px 8px 0}.button,button{display:inline-block;background:#5865f2;color:white;border:0;border-radius:8px;padding:12px 17px;font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
    .notice,.server{border:1px solid #47616a;background:#213940;border-radius:10px;padding:13px;margin-top:12px}.server small{display:block;margin:6px 0}hr{border:0;border-top:1px solid #47616a;margin:23px 0}
    </style></head><body><main><h1>Build It!++</h1><p class="note">Build It!++ — Account & Billing</p>${content}</main></body></html>`;
  return new Response(html,{headers:headers({'Content-Type':'text/html; charset=utf-8',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"})});
}

/**
 * Build It!++ Nitrado Worker — targeted update to the existing Worker.
 * Secrets: NITRADO_TOKEN, NITRADO_SERVICE_ID, MAP_SYNC_KEY, MAP_WRITE_KEY
 * Optional: ALLOWED_ORIGIN, MAX_LOG_FILES, LOG_TAIL_BYTES
 * Existing status, logviewer, filemanager and lootdrop routes are retained.
 * No automatic Nitrado backups; file writes require confirmation + SHA-256.
 * Compatible with website verification: verified=true + backupSkipped=true.
 */

// Uses NITRADO_API declared above.
function isAllowedOrigin(origin, env) {
  const origins = new Set([
    "https://builditplus.net",
    "https://www.builditplus.net",
    "https://buildit-plus-web.pages.dev",
    "https://builditadministrator.github.io",
    ...String(env.ALLOWED_ORIGIN || "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean)
  ]);
  return origins.has(origin);
}
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization,Content-Type,X-Write-Key",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
  if (isAllowedOrigin(origin, env)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
function jsonResponse(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(request, env)
    }
  });
}
function authorized(request, env) {
  const expected = String(env.MAP_SYNC_KEY || "");
  const auth = request.headers.get("Authorization") || "";
  return expected && auth === `Bearer ${expected}`;
}
async function nitradoJson(env, path) {
  const response = await fetch(`${NITRADO_API}${path}`, {
    headers: {
      "Authorization": `Bearer ${env.NITRADO_TOKEN}`,
      "Accept": "application/json"
    }
  });
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 1000) };
  }
  if (!response.ok) {
    const message =
      data?.message ||
      data?.status?.message ||
      data?.error ||
      `Nitrado returned HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}
function gameServerFromPayload(payload) {
  return payload?.data?.gameserver ||
    payload?.data?.game_server ||
    null;
}
function flattenLogFiles(value, out = []) {
  if (typeof value === "string") {
    out.push({
      path: value,
      name: value.split("/").pop() || value
    });
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      flattenLogFiles(item, out);
    }
    return out;
  }
  if (value && typeof value === "object") {
    const candidate =
      value.path ||
      value.file ||
      value.filename ||
      value.name ||
      value.full_path;
    if (
      typeof candidate === "string" &&
      /\.(adm)$/i.test(candidate)
    ) {
      out.push({
        path: candidate,
        name:
          value.name ||
          value.filename ||
          candidate.split("/").pop() ||
          candidate,
        size: Number(value.size) || null,
        modified:
          value.modified ||
          value.mtime ||
          value.date ||
          null
      });
      return out;
    }
    for (const nested of Object.values(value)) {
      flattenLogFiles(nested, out);
    }
  }
  return out;
}
function uniqueLogs(logs) {
  const seen = new Set();
  const result = [];
  for (const item of logs) {
    const key = String(item.path || "").toLowerCase();
    if (
      !key ||
      seen.has(key) ||
      !/\.adm$/i.test(key)
    ) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}
function candidateRemotePaths(rawPath, username) {
  const raw = String(rawPath || "")
    .replace(/\\/g, "/")
    .trim();
  const clean = raw.replace(/^\/+/, "");
  const basename = clean.split("/").pop();
  const paths = [];
  if (raw.startsWith("/")) {
    paths.push(raw);
  }
  if (clean.startsWith("games/")) {
    paths.push("/" + clean);
  }
  if (username) {
    const root = `/games/${username}/noftp`;
    paths.push(`${root}/${clean}`);
    if (basename) {
      paths.push(`${root}/logs/${basename}`);
      paths.push(`${root}/dayzstandalone/logs/${basename}`);
      paths.push(`${root}/${basename}`);
    }
  }
  return [
    ...new Set(
      paths.map(p => p.replace(/\/+/g, "/"))
    )
  ];
}
async function getGameServer(env) {
  const serviceId =
    String(env.NITRADO_SERVICE_ID || "").trim();
  if (!serviceId) {
    throw new Error(
      "NITRADO_SERVICE_ID is not configured."
    );
  }
  if (!env.NITRADO_TOKEN) {
    throw new Error(
      "NITRADO_TOKEN is not configured."
    );
  }
  const payload = await nitradoJson(
    env,
    `/services/${encodeURIComponent(serviceId)}/gameservers`
  );
  const gameserver = gameServerFromPayload(payload);
  if (!gameserver) {
    throw new Error(
      "Nitrado gameserver information was not present in the API response."
    );
  }
  return {
    serviceId,
    gameserver,
    payload
  };
}
function extractAdmLogs(gameserver) {
  const direct = flattenLogFiles(
    gameserver?.game_specific?.log_files || []
  );
  const fallback = direct.length
    ? []
    : flattenLogFiles(
        gameserver?.game_specific || {}
      );
  return uniqueLogs([
    ...direct,
    ...fallback
  ]);
}
async function requestDownloadUrl(env, serviceId, filePath) {
  const endpoint =
    `/services/${encodeURIComponent(serviceId)}` +
    `/gameservers/file_server/download` +
    `?file=${encodeURIComponent(filePath)}`;
  const payload = await nitradoJson(env, endpoint);
  const url =
    payload?.data?.token?.url ||
    payload?.data?.url ||
    payload?.data?.download?.url ||
    null;
  if (!url) {
    throw new Error(
      `No download URL returned for ${filePath}`
    );
  }
  return url;
}
async function downloadLogTail(url, tailBytes) {
  const headers = {};
  if (tailBytes > 0) {
    headers["Range"] = `bytes=-${tailBytes}`;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `Download URL returned HTTP ${response.status}`
    );
  }
  const buffer = await response.arrayBuffer();
  let bytes = new Uint8Array(buffer);
  let truncated = false;
  if (
    tailBytes > 0 &&
    bytes.byteLength > tailBytes
  ) {
    bytes = bytes.slice(
      bytes.byteLength - tailBytes
    );
    truncated = true;
  } else if (response.status === 206) {
    truncated = true;
  }
  const text = new TextDecoder(
    "utf-8",
    { fatal: false }
  ).decode(bytes);
  return {
    text,
    size: bytes.byteLength,
    truncated
  };
}
async function fetchOneLog(
  env,
  serviceId,
  username,
  entry,
  tailBytes
) {
  const attempts = candidateRemotePaths(
    entry.path,
    username
  );
  const errors = [];
  for (const remotePath of attempts) {
    try {
      const signedUrl = await requestDownloadUrl(
        env,
        serviceId,
        remotePath
      );
      const downloaded = await downloadLogTail(
        signedUrl,
        tailBytes
      );
      return {
        name:
          entry.name ||
          remotePath.split("/").pop(),
        sourcePath: remotePath,
        size: downloaded.size,
        truncated: downloaded.truncated,
        text: downloaded.text
      };
    } catch (error) {
      errors.push(
        `${remotePath}: ${error.message}`
      );
    }
  }
  throw new Error(
    `Could not download ${
      entry.name || entry.path
    }. Tried: ${errors.join(" | ")}`
  );
}
async function statusPayload(env) {
  const { serviceId, gameserver } =
    await getGameServer(env);
  const logs = extractAdmLogs(gameserver);
  return {
    ok: true,
    serviceId,
    serverName:
      gameserver?.settings?.config?.hostname ||
      gameserver?.game_human ||
      gameserver?.game ||
      null,
    game:
      gameserver?.game_human ||
      gameserver?.game ||
      null,
    username:
      gameserver?.username || null,
    admLogCount: logs.length,
    logFiles: logs.map(x => x.name).slice(0, 25)
  };
}
async function logsPayload(env) {
  const { serviceId, gameserver } =
    await getGameServer(env);
  const username = gameserver?.username || "";
  let logs = extractAdmLogs(gameserver);
  if (!logs.length) {
    throw new Error(
      "No .ADM files were reported by Nitrado. Enable DayZ admin logs, restart the server, and verify that .ADM files exist in Nitrado Log Files."
    );
  }
  logs = logs.sort(
    (a, b) =>
      String(b.path).localeCompare(String(a.path))
  );
  const maxFiles = Math.max(
    1,
    Math.min(10, Number(env.MAX_LOG_FILES || 3))
  );
  const tailBytes = Math.max(
    250000,
    Math.min(
      10000000,
      Number(env.LOG_TAIL_BYTES || 2500000)
    )
  );
  logs = logs.slice(0, maxFiles);
  const files = [];
  const failures = [];
  for (const entry of logs) {
    try {
      files.push(
        await fetchOneLog(
          env,
          serviceId,
          username,
          entry,
          tailBytes
        )
      );
    } catch (error) {
      failures.push(error.message);
    }
  }
  if (!files.length) {
    throw new Error(
      `Nitrado reported ${logs.length} ADM log file(s), but none could be downloaded. ${failures.join(" ")}`
    );
  }
  return {
    ok: true,
    fetchedAt: new Date().toISOString(),
    serviceId,
    serverName:
      gameserver?.settings?.config?.hostname ||
      gameserver?.game_human ||
      gameserver?.game ||
      null,
    files,
    warning: failures.length
      ? `${failures.length} log file(s) could not be downloaded.`
      : ""
  };
}
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_CUSTOM_FILE_BYTES = 20 * 1024 * 1024;
const FILE_SUFFIXES = /\.(?:xml|json|txt)$/i;
function fail(message, status = 400) {
  const error = new Error(message);
  error.httpStatus = status;
  throw error;
}
function writeAuthorized(request, env) {
  const expected = String(env.MAP_WRITE_KEY || "");
  return expected.length >= 8 &&
    request.headers.get("X-Write-Key") === expected;
}
function gameRoots(username) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(username || "")) {
    fail("Unexpected Nitrado server username", 502);
  }
  return [
    `/games/${username}/noftp`,
    `/games/${username}/ftproot`
  ];
}
function checkedPath(path, username, file = false) {
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.length > 512 ||
    /[\\\x00-\x1f?#]/.test(path) ||
    path.includes("//") ||
    path.split("/").some(
      segment => segment === "." || segment === ".."
    )
  ) {
    fail(
      "Invalid server path. Browse folders instead of entering arbitrary paths."
    );
  }
  const roots = gameRoots(username);
  if (!roots.some(
    root =>
      path === root ||
      path.startsWith(root + "/")
  )) {
    fail(
      "Path outside permitted Nitrado file area.",
      403
    );
  }
  if (
    file &&
    (!FILE_SUFFIXES.test(path) || roots.includes(path))
  ) {
    fail(
      "Only XML, JSON and TXT files can be read or edited."
    );
  }
  return path;
}
function servicePath(serviceId, tail) {
  return `/services/${encodeURIComponent(serviceId)}/gameservers/file_server/${tail}`;
}
async function nitradoAction(env, method, endpoint, fields) {
  const response = await fetch(
    NITRADO_API + endpoint,
    {
      method,
      headers: {
        Authorization: `Bearer ${env.NITRADO_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams(fields)
    }
  );
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    result = {};
  }
  if (!response.ok) {
    fail(
      `Nitrado ${method} returned HTTP ${response.status}: ` +
      String(
        result.message ||
        result.status?.message ||
        result.error ||
        ""
      ).slice(0, 250),
      502
    );
  }
  return result.data || result;
}
function signedLocation(token) {
  if (!token || typeof token.url !== "string") {
    fail("Nitrado did not return a signed file URL.", 502);
  }
  let url;
  try { url = new URL(token.url); }
  catch { fail("Invalid signed file URL from Nitrado.", 502); }
  const hostname = url.hostname.toLowerCase();
  const trustedHosts = ["nitrado.net", "nitrado.de", "nitrado.io", "nitrado.host"];
  if (url.protocol !== "https:" || url.username || url.password ||
      !trustedHosts.some(domain => hostname === domain || hostname.endsWith("." + domain))) {
    fail("The Nitrado signed file host is not allowed.", 502);
  }
  return url;
}

async function fetchSignedFile(env, serviceId, path) {
  const meta = await nitradoJson(
    env,
    servicePath(serviceId, "download") +
    `?file=${encodeURIComponent(path)}`
  );
  const token = meta?.data?.token || meta?.token || {};
  const url = signedLocation(token);
  if (token.token) {
    url.searchParams.set("token", token.token);
  }
  const response = await fetch(
    url.toString(),
    { redirect: "manual" }
  );
  if (
    response.status >= 300 &&
    response.status < 400
  ) {
    fail(
      "Nitrado download redirected. For security, the Worker does not follow file redirects automatically (HTTP " +
      response.status + ").",
      502
    );
  }
  if (!response.ok) {
    fail(
      `Nitrado file download returned HTTP ${response.status}.`,
      502
    );
  }
  const advertised = Number(
    response.headers.get("content-length") || "0"
  );
  if (advertised > MAX_FILE_BYTES) {
    fail(
      "This file exceeds the 4 MB editor limit.",
      413
    );
  }
  const data = await response.arrayBuffer();
  if (data.byteLength > MAX_FILE_BYTES) {
    fail(
      "This file exceeds the 4 MB editor limit.",
      413
    );
  }
  return new TextDecoder(
    "utf-8",
    { fatal: false }
  ).decode(data);
}
async function streamCustomJson(
  request,
  env,
  serviceId,
  username,
  rawPath
) {
  const path = checkedPath(rawPath, username, true);
  if (
    !/\/(?:dayzps_missions|mpmissions)\/dayzOffline.chernarusplus\/custom\/[^?#]+\.json$/i
      .test(path)
  ) {
    fail(
      "Large-file streaming is restricted to Chernarus custom JSON files.",
      403
    );
  }
  if (
    /(?:load[\s_-]*out|spawn[\s_-]*gear)/i.test(path)
  ) {
    fail(
      "Loadout and spawn gear files are excluded.",
      403
    );
  }
  const meta = await nitradoJson(
    env,
    servicePath(serviceId, "download") +
    "?file=" + encodeURIComponent(path)
  );
  const token = meta?.data?.token || meta?.token || {};
  const signed = signedLocation(token);
  if (token.token) {
    signed.searchParams.set("token", token.token);
  }
  const upstream = await fetch(
    signed.toString(),
    { redirect: "manual" }
  );
  if (
    upstream.status >= 300 &&
    upstream.status < 400
  ) {
    fail(
      "Nitrado file download redirected; refusing unverified destination.",
      502
    );
  }
  if (!upstream.ok || !upstream.body) {
    fail(
      "Nitrado custom download returned HTTP " +
      upstream.status + ".",
      502
    );
  }
  const claimed = Number(
    upstream.headers.get("content-length") || "0"
  );
  if (claimed > MAX_CUSTOM_FILE_BYTES) {
    try {
      await upstream.body.cancel();
    } catch (_) {}
    fail(
      "Custom JSON exceeds the 20 MB map limit.",
      413
    );
  }
  let received = 0;
  const bounded = upstream.body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > MAX_CUSTOM_FILE_BYTES) {
          throw new Error(
            "Custom JSON exceeds the 20 MB map limit."
          );
        }
        controller.enqueue(chunk);
      }
    })
  );
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...corsHeaders(request, env)
  };
  return new Response(bounded, {
    status: 200,
    headers
  });
}
async function fileDigest(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes
  );
  return [...new Uint8Array(digest)]
    .map(n => n.toString(16).padStart(2, "0"))
    .join("");
}
async function uploadSigned(
  env,
  serviceId,
  fullPath,
  content
) {
  const n = fullPath.lastIndexOf("/");
  const directory = fullPath.slice(0, n);
  const filename = fullPath.slice(n + 1);
  const meta = await nitradoAction(
    env,
    "POST",
    servicePath(serviceId, "upload"),
    {
      path: directory,
      file: filename
    }
  );
  const token = meta.token || {};
  if (!token.token) {
    fail(
      "Nitrado returned an upload URL without its token.",
      502
    );
  }
  const url = signedLocation(token);
  const response = await fetch(
    url.toString(),
    {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/binary",
        token: token.token
      },
      body: new TextEncoder().encode(content)
    }
  );
  if (
    response.status >= 300 &&
    response.status < 400
  ) {
    fail(
      "Nitrado upload redirected; upload not confirmed (HTTP " +
      response.status + ").",
      502
    );
  }
  if (!response.ok) {
    fail(
      `Nitrado upload returned HTTP ${response.status}.`,
      502
    );
  }
}
async function listFiles(env, serviceId, directory) {
  const payload = await nitradoJson(
    env,
    servicePath(serviceId, "list") +
    `?dir=${encodeURIComponent(directory)}`
  );
  const raw =
    payload?.data?.entries ||
    payload?.entries;
  if (!Array.isArray(raw)) {
    fail(
      "Nitrado did not return a file listing.",
      502
    );
  }
  return raw
    .map(file => ({
      name: String(
        file.name ||
        String(file.path || "").split("/").pop() ||
        ""
      ),
      path: String(
        file.path ||
        `${directory}/${file.name || ""}`
      ),
      type: String(file.type || "file"),
      size: Number(file.size) || 0
    }))
    .filter(item =>
      item.name &&
      (
        item.type === "dir" ||
        item.type === "directory" ||
        item.type === "folder" ||
        FILE_SUFFIXES.test(item.name)
      ) &&
      item.path.startsWith(directory + "/")
    )
    .slice(0, 500);
}
// Structural XML validation without a dependency or XML reserialization.
// It checks tags, quotation marks, nesting, root and references. It is not
// a DayZ schema/classname validation. Original formatting is preserved.
function validateXmlStructure(xml) {
  if (typeof xml !== "string" || !xml.trim()) fail("XML file is empty.");
  let pos = 0, roots = 0, rootClosed = false;
  const stack = [];
  const references = text => {
    const withoutRefs = text.replace(/&(?:amp|lt|gt|apos|quot|#[0-9]+|#x[0-9a-fA-F]+);/g, "");
    if (withoutRefs.includes("&")) fail("Invalid or unescaped XML entity.");
  };
  while (pos < xml.length) {
    const at = xml.indexOf("<", pos);
    const textPart = xml.slice(pos, at < 0 ? xml.length : at);
    references(textPart);
    if (!stack.length && textPart.trim()) fail("Text outside the XML root element.");
    if (at < 0) break;
    if (xml.startsWith("<!--", at)) {
      const end = xml.indexOf("-->", at + 4);
      if (end < 0) fail("Unclosed XML comment.");
      pos = end + 3; continue;
    }
    if (xml.startsWith("<![CDATA[", at)) {
      if (!stack.length) fail("CDATA outside the XML root.");
      const end = xml.indexOf("]]>", at + 9);
      if (end < 0) fail("Unclosed XML CDATA section.");
      pos = end + 3; continue;
    }
    if (xml.startsWith("<?", at)) {
      const end = xml.indexOf("?>", at + 2);
      if (end < 0) fail("Unclosed XML processing instruction.");
      pos = end + 2; continue;
    }
    if (xml.startsWith("<!", at)) fail("Unsupported XML directive or DOCTYPE.");
    let end = at + 1, quote = "";
    for (; end < xml.length; end++) {
      const c = xml[end];
      if (quote) { if (c === quote) quote = ""; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === ">") break;
    }
    if (end >= xml.length || quote) fail("Unclosed XML tag.");
    const raw = xml.slice(at + 1, end).trim();
    const closing = raw.startsWith("/");
    const match = raw.match(/^\/?([A-Za-z_][\w.:-]*)(?=\s|\/|$)/);
    if (!match) fail("Invalid XML tag near character " + at + ".");
    const name = match[1];
    const selfClose = /\/\s*$/.test(raw);
    if (closing) {
      if (selfClose || raw !== "/" + name || stack.pop() !== name)
        fail("Mismatched closing XML tag: " + name + ".");
      if (!stack.length) rootClosed = true;
    } else {
      if (!stack.length) {
        if (rootClosed) fail("XML contains multiple root elements.");
        roots++;
      }
      let attrs = raw.slice(name.length).trim();
      if (selfClose) attrs = attrs.replace(/\/\s*$/, "").trim();
      const used = new Set();
      while (attrs) {
        const a = attrs.match(/^([A-Za-z_][\w.:-]*)\s*=\s*("[^"]*"|'[^']*')/);
        if (!a) fail("Invalid XML attribute on <" + name + ">.");
        if (used.has(a[1])) fail("Duplicate XML attribute " + a[1] + ".");
        used.add(a[1]);
        references(a[2].slice(1, -1));
        if (a[2].slice(1, -1).includes("<")) fail("Invalid < in XML attribute.");
        attrs = attrs.slice(a[0].length).trim();
      }
      if (!selfClose) stack.push(name);
      else if (!stack.length) rootClosed = true;
    }
    pos = end + 1;
  }
  if (roots !== 1 || stack.length) fail("XML must contain one properly closed root element.");
}

function validateFileContent(path, content) {
  if (typeof content !== "string") fail("File content must be text.");
  const bytes = new TextEncoder().encode(content).byteLength;
  if (!bytes || bytes > MAX_FILE_BYTES) fail("Text file must be 1 byte to 4 MB.", 413);
  if (/\.json$/i.test(path)) {
    try { JSON.parse(content); }
    catch (error) { fail("Invalid JSON: " + error.message); }
  } else if (/\.xml$/i.test(path)) {
    validateXmlStructure(content);
  }
  return bytes;
}

function expectSnapshot(data) {
  if (typeof data?.expectedSha256 !== "string" ||
      !/^[a-f0-9]{64}$/i.test(data.expectedSha256))
    fail("Read the server file first; expectedSha256 is required.");
  return data.expectedSha256.toLowerCase();
}

// Single complete overwrite, with optimistic concurrency and read-back verification.
// No Nitrado copies or backup files are created.
async function saveVerified(env, serviceId, path, content, expectedSha256) {
  const current = await fetchSignedFile(env, serviceId, path);
  if ((await fileDigest(current)) !== expectedSha256)
    fail("Server file changed since it was opened. Reload before overwriting.", 409);
  const bytes = validateFileContent(path, content);
  if (current === content)
    return { ok: true, path, bytes, verified: true, unchanged: true,
      sha256: expectedSha256, backupCreated: false, backupSkipped: true };
  await uploadSigned(env, serviceId, path, content);
  const result = await fetchSignedFile(env, serviceId, path);
  if (result !== content)
    fail("Upload could not be verified. Check Nitrado and restore your own backup if needed.", 502);
  return { ok: true, path, bytes, verified: true, replaced: true,
    sha256: await fileDigest(result), backupCreated: false, backupSkipped: true };
}

async function replaceExistingFile(env, serviceId, username, data) {
  if (data?.confirm !== true) fail("Explicit overwrite confirmation required.");
  const path = checkedPath(data?.path, username, true);
  const expected = expectSnapshot(data);
  validateFileContent(path, data?.content);
  return saveVerified(env, serviceId, path, data.content, expected);
}

// Standard DayZ cars, trucks, boats and the 1.30 motorbikes.
// For other/custom modded vehicles, send their exact classnames via vehicleTypes.
const KNOWN_VEHICLE_CLASS = /^(?:CivilianSedan|Sedan_02|Hatchback_02|OffroadHatchback|Offroad_02|Truck_01(?:_[A-Za-z0-9]+)?|Boat_0[1-9]|Motorbike_0[1-9])(?:_|$)/i;

function vehicleTypesFromXml(xml) {
  const out = [];
  for (const type of xml.matchAll(/<type\b([^>]*)>([\s\S]*?)<\/type\s*>/gi)) {
    const name = type[1].match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1];
    if (name && /<attachments\b/i.test(type[2])) {
      out.push({ name, knownVehicle: KNOWN_VEHICLE_CLASS.test(name),
        attachmentGroups: (type[2].match(/<attachments\b/gi) || []).length });
    }
  }
  return out;
}

// Only changes existing attachment probability fields, not cargo, damage or
// classnames. A group with multiple alternatives still picks only a compatible
// attachment, so this is NOT a guarantee that every candidate appears.
function buildFullAttachments(xml, data) {
  const wanted = new Set(
    (Array.isArray(data?.vehicleTypes) ? data.vehicleTypes : [])
      .filter(x => typeof x === "string" && /^[A-Za-z0-9_]{1,100}$/.test(x))
      .map(x => x.toLowerCase())
  );
  const all = data?.allVehicles === true;
  if (!all && !wanted.size) fail("Select vehicleTypes or allVehicles=true.");
  const changed = [], available = new Set();
  const content = xml.replace(/<type\b([^>]*)>([\s\S]*?)<\/type\s*>/gi,
    (whole, attributes, inner) => {
      const name = attributes.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!name) return whole;
      available.add(name.toLowerCase());
      if (!(wanted.has(name.toLowerCase()) ||
            (all && KNOWN_VEHICLE_CLASS.test(name) &&
              !(data.excludeBoats === true && /^Boat_/i.test(name))))) return whole;
      let groups = 0, items = 0;
      const edited = inner.replace(/<attachments\b([^>]*?)>([\s\S]*?)<\/attachments\s*>/gi,
        (block, groupAttrs, groupBody) => {
          if (!/<item\b/i.test(groupBody)) return block;
          let n = 0;
          const changedBody = groupBody.replace(/<item\b([^>]*?)\/\s*>/gi, (item, itemAttrs) => {
            if (!/\bname\s*=\s*["'][^"']+["']/i.test(itemAttrs)) return item;
            n++;
            return /\bchance\s*=\s*["'][^"']*["']/i.test(item)
              ? item.replace(/(\bchance\s*=\s*)["'][^"']*["']/i, '$1"1.00"')
              : item.replace(/\/\s*>$/, ' chance="1.00" />');
          });
          if (!n) return block;
          groups++;
          items += n;
          const attrs = /\bchance\s*=\s*["'][^"']*["']/i.test(groupAttrs)
            ? groupAttrs.replace(/(\bchance\s*=\s*)["'][^"']*["']/i, '$1"1.00"')
            : groupAttrs + ' chance="1.00"';
          return `<attachments${attrs}>${changedBody}</attachments>`;
        });
      if (groups) changed.push({ name, attachmentGroups: groups, items });
      return `<type${attributes}>${edited}</type>`;
    });
  if (!changed.length) fail("No matching vehicle attachment groups were found.", 422);
  validateXmlStructure(content);
  return { content, changed,
    notFound: [...wanted].filter(name => !available.has(name)) };
}

async function completeVehicleAttachments(env, serviceId, username, data) {
  if (data?.confirm !== true) fail("Confirm the vehicle changes first.");
  const path = checkedPath(data?.path, username, true);
  if (path.split('/').pop().toLowerCase() !== 'cfgspawnabletypes.xml')
    fail("Select cfgspawnabletypes.xml for vehicle attachments.");
  const expected = expectSnapshot(data);
  const original = await fetchSignedFile(env, serviceId, path);
  if (await fileDigest(original) !== expected)
    fail("Server file changed since it was opened. Reload first.", 409);
  validateXmlStructure(original);
  const result = buildFullAttachments(original, data);
  const saved = await saveVerified(env, serviceId, path, result.content, expected);
  return { ...saved, vehicles: result.changed, notFound: result.notFound };
}

// Replace ALL previously configured fresh spawn groups, while retaining the
// existing fresh spawn parameters and hop/travel sections. Alternative:
// provide data.content for an entirely new cfgplayerspawnpoints.xml.
function rebuildSpawnPoints(original, data) {
  if (!Array.isArray(data?.positions) || data.positions.length < 1 || data.positions.length > 2000)
    fail("Enter between 1 and 2000 new spawn positions.");
  const groupName = data.groupName || "BuildItSpawns";
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(groupName)) fail("Invalid spawn group name.");
  const pos = data.positions.map((item, index) => {
    const x = Number(item?.x), z = Number(item?.z ?? item?.y);
    if (!Number.isFinite(x) || !Number.isFinite(z) || x < 0 || z < 0 || x > 65535 || z > 65535 ||
        item?.x === '' || item?.z === '')
      fail("Invalid x/z coordinate for spawn position " + (index + 1) + ".");
    return `      <pos x="${x}" z="${z}" />`;
  }).join('\n');
  const fresh = /<fresh\b([^>]*)>([\s\S]*?)<\/fresh\s*>/i;
  const match = original.match(fresh);
  if (!match) fail("No <fresh> spawn configuration found.");
  const groups = /<generator_posbubbles\b([^>]*)>[\s\S]*?<\/generator_posbubbles\s*>/i;
  if (!groups.test(match[2]))
    fail("No <generator_posbubbles> section found; supply the full replacement XML instead.");
  const nextFresh = match[2].replace(groups,
    `<generator_posbubbles>\n    <group name="${groupName}">\n${pos}\n    </group>\n  </generator_posbubbles>`);
  const output = original.replace(fresh, `<fresh${match[1]}>${nextFresh}</fresh>`);
  validateXmlStructure(output);
  return output;
}

async function replaceAllSpawnPoints(env, serviceId, username, data) {
  if (data?.confirm !== true) fail("Confirm replacement of ALL old spawn points.");
  const path = checkedPath(data?.path, username, true);
  if (path.split('/').pop().toLowerCase() !== 'cfgplayerspawnpoints.xml')
    fail("Select cfgplayerspawnpoints.xml for player spawn locations.");
  const expected = expectSnapshot(data);
  if (typeof data.content === 'string') {
    validateFileContent(path, data.content);
    if (!/<playerspawnpoints\b/i.test(data.content) || !/<fresh\b/i.test(data.content))
      fail("Full replacement XML must contain <playerspawnpoints> and <fresh>.");
    return saveVerified(env, serviceId, path, data.content, expected);
  }
  const current = await fetchSignedFile(env, serviceId, path);
  if ((await fileDigest(current)) !== expected)
    fail("Server file changed since it was opened. Reload first.", 409);
  validateXmlStructure(current);
  const content = rebuildSpawnPoints(current, data);
  return { ...(await saveVerified(env, serviceId, path, content, expected)),
    spawnPositions: data.positions.length, oldSpawnGroupsReplaced: true };
}

async function createLootSpawnerFile(
  env,
  serviceId,
  username,
  data
) {
  if (
    data?.confirm !== true ||
    data?.expectedAbsent !== true
  ) {
    fail(
      "Explicit create confirmation and expectedAbsent=true are required."
    );
  }
  const path = checkedPath(
    data?.path,
    username,
    true
  );
  const suffix =
    "/dayzOffline.chernarusplus/custom/builditlootdrop.json";
  const validPaths = gameRoots(username).flatMap(root => [
    root + "/dayzps_missions" + suffix,
    root + "/mpmissions" + suffix
  ]);
  if (!validPaths.includes(path)) {
    fail(
      "Creating files is restricted to the BuildIt loot JSON in a Chernarus custom folder.",
      403
    );
  }
  const content = data?.content;
  if (typeof content !== "string") {
    fail("Loot JSON must be a string.");
  }
  const bytes =
    new TextEncoder().encode(content).byteLength;
  if (bytes < 1 || bytes > MAX_FILE_BYTES) {
    fail(
      "Loot JSON must be 1 byte to 4 MB.",
      413
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (_) {
    fail("Invalid loot JSON.");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    !Array.isArray(parsed.Objects) ||
    parsed.Objects.length < 1 ||
    parsed.Objects.length > 200
  ) {
    fail(
      "Loot JSON must have an Objects array containing 1-200 entries."
    );
  }
  for (const o of parsed.Objects) {
    if (
      !o ||
      typeof o !== "object" ||
      Array.isArray(o) ||
      !/^[A-Za-z0-9_]{1,100}$/.test(o.name || "") ||
      !Array.isArray(o.pos) ||
      o.pos.length !== 3 ||
      !o.pos.every(
        n => typeof n === "number" && Number.isFinite(n)
      ) ||
      !Array.isArray(o.ypr) ||
      o.ypr.length !== 3 ||
      !o.ypr.every(
        n => typeof n === "number" && Number.isFinite(n)
      ) ||
      typeof o.scale !== "number" ||
      o.scale <= 0 ||
      !Number.isFinite(o.scale) ||
      o.enableCEPersistency !== false
    ) {
      fail(
        "Loot JSON has an invalid object entry or persistent object."
      );
    }
  }
  const folder = path.slice(
    0,
    path.lastIndexOf("/")
  );
  const mission = folder.slice(
    0,
    folder.lastIndexOf("/")
  );
  const basename = "builditlootdrop.json";
  const missionEntries = await listFiles(
    env,
    serviceId,
    mission
  );
  if (missionEntries.length >= 500) {
    fail(
      "Mission listing is truncated; refusing an unsafe create.",
      409
    );
  }
  const custom = missionEntries.find(
    item => item.name.toLowerCase() === "custom"
  );
  if (
    custom &&
    !["dir", "directory", "folder"].includes(custom.type)
  ) {
    fail(
      "Mission custom path exists but is not a folder.",
      409
    );
  }
  if (!custom) {
    await nitradoAction(
      env,
      "POST",
      servicePath(serviceId, "mkdir"),
      {
        path: mission,
        name: "custom"
      }
    );
  }
  const checkFolder = await listFiles(
    env,
    serviceId,
    mission
  );
  if (
    checkFolder.length >= 500 ||
    !checkFolder.some(e =>
      e.name.toLowerCase() === "custom" &&
      ["dir", "directory", "folder"].includes(e.type)
    )
  ) {
    fail(
      "Could not verify the custom folder. No loot file was written.",
      409
    );
  }
  const ensureMissing = async () => {
    const existing = await listFiles(
      env,
      serviceId,
      folder
    );
    if (existing.length >= 500) {
      fail(
        "Custom directory listing is truncated. Creation blocked.",
        409
      );
    }
    if (
      existing.some(
        f => f.name.toLowerCase() === basename.toLowerCase()
      )
    ) {
      fail(
        "Loot JSON already exists. Use review-and-update instead.",
        409
      );
    }
  };
  await ensureMissing();
  await ensureMissing();
  await uploadSigned(
    env,
    serviceId,
    path,
    content
  );
  const actual = await fetchSignedFile(
    env,
    serviceId,
    path
  );
  if (actual !== content) {
    fail(
      "The created loot JSON could not be verified. Inspect Nitrado before retrying.",
      502
    );
  }
  return {
    ok: true,
    path,
    bytes,
    verified: true,
    created: true,
    sha256: await fileDigest(actual)
  };
}

 
// Stage 4: per-user authenticated API. Original file editing / logs helpers
// are retained unchanged and supplied only a request-scoped, user-specific token.
// Production website assets are bundled with this isolated Worker (ASSETS binding).
const STAGE4_STATIC=/^\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\.(?:js|css|json|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|webmanifest)$/;
const STAGE4_BRIDGE="/* Build It!++ production bridge. Same-origin, session cookie only.\n * This file is served exclusively through the authenticated /app test view.\n * Never store real credentials, secret keys, or OAuth tokens in the browser.\n */\n(() => {\n  'use strict';\n  const boot = window.BUILD_IT_STAGE4_BOOT;\n  if (!boot || !/^\\d{1,20}$/.test(String(boot.serviceId || ''))) return;\n  if (typeof nitradoRequest !== 'function') return;\n  const selected = String(boot.serviceId);\n\n  // Replace the shared request function. Existing tools keep their current\n  // data formats and write verification. The backend verifies every request.\n  nitradoRequest = async function(path, {method='GET', body=null} = {}) {\n    if (typeof path !== 'string' || !/^\\/api\\//.test(path)) throw Error('Invalid API route');\n    const target = new URL(path, location.origin);\n    if (target.origin !== location.origin) throw Error('Cross-origin API request blocked');\n    if (target.searchParams.has('server') && target.searchParams.get('server') !== selected)\n      throw Error('Selected server mismatch');\n    target.searchParams.set('server', selected);\n    const opts = { method, credentials: 'same-origin', cache: 'no-store', headers: {Accept:'application/json'} };\n    if (body !== null) {\n      opts.headers['Content-Type'] = 'application/json';\n      opts.body = typeof body === 'string' ? body : JSON.stringify(body);\n    }\n    const response = await fetch(target.toString(), opts);\n    const data = await response.json().catch(() => ({}));\n    if (!response.ok) throw Error(data.error || `Build It!++ API: HTTP ${response.status}`);\n    return data;\n  };\n\n  // These are inert UI compatibility values. They are NOT authentication keys.\n  // Authentication is supplied by the HttpOnly Discord session cookie only.\n  const urlField = document.getElementById('nitradoWorkerUrl');\n  const accessField = document.getElementById('nitradoAccessKey');\n  const writeField = document.getElementById('nitradoWriteKey');\n  if (urlField) urlField.value = location.origin;\n  if (accessField) accessField.value = 'oauth-session-managed';\n  if (writeField) writeField.value = 'oauth-session-managed';\n  try {\n    nitradoWorkerMode = 'multi';\n    window.BUILD_IT_NITRADO_WORKER_MODE = 'multi';\n    window.BUILD_IT_NITRADO_EXPECTED_USERNAME = String(boot.username || '');\n    if (typeof populateNitradoServers === 'function') {\n      populateNitradoServers([{id:selected,name:String(boot.serverName || ('Server '+selected))}]);\n    }\n  } catch (error) {\n    console.warn('Stage4 compatibility setup:',error.message);\n  }\n\n  // Do not offer the obsolete manual Worker/secret-key setup to customers.\n  const style=document.createElement('style');\n  style.textContent = `\n   #nitradoWorkerUrl, #nitradoAccessKey, #nitradoWriteKey,\n   label[for=\"nitradoWorkerUrl\"], label[for=\"nitradoAccessKey\"], label[for=\"nitradoWriteKey\"],\n   #nitradoKeyReveal, #nitradoKeyCopy, #nitradoKeyRecoveryStatus,\n   #biServerProfileManage, #biServerProfileDock, #nitradoWriteKeyLength, #nitradoWriteKey + .fm-note, #toolHubPanel .st-settings, #logConnectionDetails, #logServerFiles > .log-compact-help {display:none !important}\n   #biStage4TopBar{position:fixed;left:50%;transform:translateX(-50%);top:6px;z-index:99999;\n     background:#162932;color:#ecf7ff;border:1px solid #466673;border-radius:10px;\n     padding:7px 14px;font:13px system-ui;box-shadow:0 4px 22px #0006}\n   #biStage4TopBar a{color:#9ac8ff}\n  `;\n  document.head.appendChild(style);\n  const bar=document.createElement('div');\n  bar.id='biStage4TopBar';\n  bar.textContent='Build It!++ • '+String(boot.serverName || 'Nitrado server')+'  ·  ';\n  const back=document.createElement('a');\n  back.href='/account'; back.textContent='Account / server wijzigen';\n  bar.appendChild(back);\n  document.body.appendChild(bar);\n\n  window.BUILD_IT_STAGE4_READY = true;\n  // Populate status and secure username without manual setup.\n  Promise.resolve().then(async () => {\n    try {\n      const server = await nitradoRequest('/api/status',{withServer:true});\n      window.BUILD_IT_NITRADO_EXPECTED_USERNAME = String(server.username || '');\n      if (typeof setNitradoStatus === 'function')\n        setNitradoStatus('Connected: '+(server.serverName||boot.serverName||selected),'ok');\n      window.dispatchEvent(new Event('buildit:stage4-connected'));\n    } catch (error) {\n      if (typeof setNitradoStatus === 'function') setNitradoStatus(error.message,'err');\n    }\n  });\n})();\n";
function stage4Error(error, req){
  const status=Number(error.httpStatus||error.status||502);
  const safeStatus=[400,401,403,404,405,409,413,422,429,502,503].includes(status)?status:502;
  const detail=String(error.message||'Nitrado request failed').slice(0,200);
  console.error('Stage 4 API',req.method,new URL(req.url).pathname,safeStatus,detail);
  return reply({error:detail},safeStatus);
}
async function selectedContext(req,env,{requireSelected=true}={}){
  const gate=await requirePremium(req,env);
  if(gate.error)return {error:gate.error};
  const user=gate.user;
  const connection=await connectionRow(env,user);
  if(!connection)return {error:reply({error:'Connect Nitrado first'},403)};
  const selected=String(connection.selected_service_id||'');
  if(requireSelected&&!/^\d{1,20}$/.test(selected))return {error:reply({error:'Select a Nitrado server from /account first'},403)};
  const userToken=await connectionToken(env,user);
  const services=await nitradoServicesByToken(userToken);
  if(requireSelected&&!services.some(s=>s.id===selected))return {error:reply({error:'Selected server is not authorized by this Nitrado account'},403)};
  const query=new URL(req.url).searchParams.get('server');
  if(query!==null && query!==selected)return {error:reply({error:'Server ID is not the selected, authorized server'},403)};
  return {user,selected,services,privateEnv:{...env,NITRADO_TOKEN:userToken,NITRADO_SERVICE_ID:selected}};
}
function stage4GuardWrite(req){
  const origin=req.headers.get('Origin');
  const site=req.headers.get('Sec-Fetch-Site');
  const workerOrigin=new URL(req.url).origin;
  // JavaScript fetch() from the same origin always sends matching Origin for
  // state-changing POSTs. Do not accept the absence of this header for writes.
  if(origin!==workerOrigin || (site&&site!=='same-origin'))
    throw Object.assign(Error('Cross-site write blocked'),{httpStatus:403});
}
async function stage4NitradoApi(req,env,url){
  const p=url.pathname, method=req.method;
  if(method!=='GET'&&method!=='POST')return reply({error:'Method not allowed'},405);
  if(method==='POST')stage4GuardWrite(req);
  const context=await selectedContext(req,env);
  if(context.error)return context.error;
  const {privateEnv,selected,services}=context;
  if(p==='/api/servers'&&method==='GET'){
    // Only the explicitly selected service is available to the tools.
    return reply({ok:true,servers:services.filter(s=>s.id===selected).map(s=>({id:s.id,name:s.name}))});
  }
  if(p==='/api/status'&&method==='GET')return reply(await statusPayload(privateEnv));
  if(p==='/api/logs'&&method==='GET')return reply(await logsPayload(privateEnv));
  if(!p.startsWith('/api/files/')&&!p.startsWith('/api/vehicles/')&&p!=='/api/spawns/replace')
    return reply({error:'Unknown server endpoint'},404);
  const {serviceId,gameserver}=await getGameServer(privateEnv);
  const username=gameserver.username;
  if(p==='/api/files/list'&&method==='GET'){
    const dir=checkedPath(url.searchParams.get('dir')||gameRoots(username)[0],username);
    return reply({ok:true,dir,root:gameRoots(username)[0],entries:await listFiles(privateEnv,serviceId,dir)});
  }
  if(p==='/api/files/read'&&method==='GET'){
    const path=checkedPath(url.searchParams.get('file'),username,true);
    const content=await fetchSignedFile(privateEnv,serviceId,path);
    return reply({ok:true,path,content,sha256:await fileDigest(content)});
  }
  if(p==='/api/files/custom-content'&&method==='GET'){
    return streamCustomJson(req,privateEnv,serviceId,username,url.searchParams.get('file'));
  }
  if(p==='/api/vehicles/list'&&method==='GET'){
    const path=checkedPath(url.searchParams.get('file'),username,true);
    if(path.split('/').pop().toLowerCase()!=='cfgspawnabletypes.xml')fail('Select cfgspawnabletypes.xml');
    const content=await fetchSignedFile(privateEnv,serviceId,path);
    validateXmlStructure(content);
    return reply({ok:true,path,sha256:await fileDigest(content),vehicles:vehicleTypesFromXml(content)});
  }
  if(method!=='POST'||!['/api/files/write','/api/files/create','/api/vehicles/complete','/api/spawns/replace'].includes(p))
    return reply({error:'Method not allowed'},405);
  const text=await req.text();
  if(text.length>MAX_FILE_BYTES*2)fail('Request too large',413);
  let data;
  try{data=JSON.parse(text)}catch{fail('Invalid JSON');}
  if(p==='/api/files/write')return reply(await replaceExistingFile(privateEnv,serviceId,username,data));
  if(p==='/api/files/create')return reply(await createLootSpawnerFile(privateEnv,serviceId,username,data));
  if(p==='/api/vehicles/complete')return reply(await completeVehicleAttachments(privateEnv,serviceId,username,data));
  if(p==='/api/spawns/replace')return reply(await replaceAllSpawnPoints(privateEnv,serviceId,username,data));
  return reply({error:'Method not allowed'},405);
}
function stage4ProfileHtml(service,username,origin){
  const profileId='stage4-'+service.id;
  const stub={id:profileId,name:service.name||('Nitrado '+service.id),
    workerUrl:origin,accessKey:'oauth-session-managed',
    serverId:service.id,serviceId:service.id,serverName:service.name,
    workerMode:'multi',autoSync:true};
  const settings={workerUrl:origin,accessKey:'oauth-session-managed',serverId:service.id,autoSync:true};
  const boot={serviceId:service.id,serverName:service.name,username};
  // Escaping HTML script termination is critical: names are Nitrado-controlled data.
  const safe=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  return {profileId,profiles:safe({activeId:profileId,profiles:[stub]}),settings:safe(settings),boot:safe(boot)};
}
async function stage4App(req,env){
  const c=await selectedContext(req,env);
  if(c.error)return redirect('/account');
  const status=await statusPayload(c.privateEnv);
  const service=c.services.find(s=>s.id===c.selected);
  const origin=new URL(req.url).origin;
  const profile=stage4ProfileHtml({id:c.selected,name:status.serverName||service.name},status.username,origin);
  if(!env.ASSETS)throw Object.assign(Error('Website assets binding not configured'),{httpStatus:502});
  const upstream=await env.ASSETS.fetch(new URL('/index.html',req.url));
  if(!upstream.ok)throw Object.assign(Error('Bundled Build It!++ index.html unavailable (HTTP '+upstream.status+')'),{httpStatus:502});
  let html=await upstream.text();
  if(!html.includes('</head>')||!html.includes('</body>')||!html.includes('nitradoRequest'))
    throw Object.assign(Error('Website template changed; staging integration needs review'),{httpStatus:502});
  const pre=`<script>\n(function(){\n`+
    `sessionStorage.setItem('buildit_access_ok_v1','1');\n`+
    `localStorage.setItem('buildit_nitrado_sync_v1',${JSON.stringify(profile.settings)});\n`+
    `localStorage.setItem('buildit_nitrado_profiles_v1',${JSON.stringify(profile.profiles)});\n`+
    `window.BUILD_IT_STAGE4_BOOT=${profile.boot};\n`+
    `})();\n</script>`;
  // Preboot before all of the existing site scripts, including the password gate.
  html=html.replace('</head>',pre+'</head>');
  html=html.replace('</body>','<script src="./stage4-bridge.js"></script></body>');
  // The stage4 pages are always fetched fresh and never install the production PWA.
  html=html.replace("navigator.serviceWorker.register('./service-worker.js',{scope:'./'})","Promise.resolve()");
  // This page is gated by Discord and Stripe Live on the production Worker.
  return new Response(html,{headers:headers({'Content-Type':'text/html; charset=utf-8',
    'Content-Security-Policy':"frame-ancestors 'none'",'X-Robots-Tag':'noindex, nofollow'})});
}
async function stage4Static(req,env,url){
  const p=url.pathname;
  if(p==='/stage4-bridge.js')return new Response(STAGE4_BRIDGE,{headers:headers({'Content-Type':'application/javascript; charset=utf-8'})});
  if(!STAGE4_STATIC.test(p)||/^\/(?:cloudflare|\.github|tests?|node_modules)\//i.test(p))return reply({error:'Not found'},404);
  const u=await currentUser(req,env);
  if(!u||!(await gumroadMembership(env,u)).active)return reply({error:'Gumroad Membership required'},403);
  // No redirects or untrusted origin can be requested. No client cookies are sent upstream.
  if(!env.ASSETS)return reply({error:'Website assets binding not configured'},502);
  const response=await env.ASSETS.fetch(new URL(p,req.url));
  if(!response.ok)return reply({error:'Bundled website resource unavailable: '+p},502);
  const ct=response.headers.get('Content-Type')||'application/octet-stream';
  return new Response(response.body,{headers:headers({'Content-Type':ct,'X-Robots-Tag':'noindex'})});
}
export default {
  async fetch(req,env){
    const url=new URL(req.url),p=url.pathname;
    // Payment checks and license activation are secured through Gumroad.
    try{
      config(req,env);
      if(p==='/api/auth/discord')return req.method==='GET'?await discordBegin(req,env):reply({error:'Method not allowed'},405);
      if(p==='/api/auth/callback')return req.method==='GET'?await discordCallback(req,env,url):reply({error:'Method not allowed'},405);
      if(p==='/api/auth/logout')return req.method==='POST'?await logout(req,env):reply({error:'Method not allowed'},405);
      if(p==='/api/gumroad/redeem')return req.method==='POST'?await gumroadRedeem(req,env):reply({error:'Method not allowed'},405);
      if(p==='/api/nitrado/connect')return req.method==='GET'?await nitradoBegin(req,env):reply({error:'Method not allowed'},405);
      if(p==='/api/nitrado/callback')return req.method==='GET'?await nitradoCallback(req,env,url):reply({error:'Method not allowed'},405);
      if(p==='/api/nitrado/servers')return req.method==='GET'?await nitradoList(req,env):reply({error:'Method not allowed'},405);
      if(p==='/api/nitrado/select')return req.method==='POST'?await nitradoSelect(req,env):reply({error:'Method not allowed'},405);
      if(p==='/api/nitrado/disconnect')return req.method==='POST'?await nitradoDisconnect(req,env):reply({error:'Method not allowed'},405);
      if(p==='/api/me'){
        if(req.method!=='GET')return reply({error:'Method not allowed'},405);
        const user=await currentUser(req,env);if(!user)return reply({authenticated:false},401);
        const subscription=await gumroadMembership(env,user),connection=await connectionRow(env,user);
        return reply({authenticated:true,user:{id:user.id,username:user.username,role:user.role},subscription,
          nitrado:{connected:!!connection,selectedServiceId:subscription.active?connection?.selected_service_id:null},
          toolsEnabled:subscription.active&&!!connection?.selected_service_id});
      }
      if(p==='/account'){
        if(req.method!=='GET')return reply({error:'Method not allowed'},405);
        const response=await account(req,env,url);
        const user=await currentUser(req,env);
        if(!user)return response;
        const subscription=await gumroadMembership(env,user),connection=await connectionRow(env,user);
        if(!subscription.active||!connection?.selected_service_id)return response;
        let html=await response.text();
        const launch='<p><a class="button" href="/app">Open Build It!++ Server Tools</a></p>';
        html=html.replace('</main>',launch+'</main>');
        html=html.replace('Your connected server is available to your Build It!++ tools.',
          'Your connected Nitrado server is ready for Build It!++ tools.');
        return new Response(html,{status:response.status,headers:response.headers});
      }
      if(p==='/')return redirect('/account',[],302);
      if(p==='/app'&&req.method==='GET')return await stage4App(req,env);
      if(p==='/stage4-bridge.js'&&req.method==='GET')return await stage4Static(req,env,url);
      if(p.startsWith('/api/'))return await stage4NitradoApi(req,env,url);
      if(req.method==='GET')return await stage4Static(req,env,url);
      return reply({error:'Not found'},404);
    }catch(e){return stage4Error(e,req);}
  }
};
