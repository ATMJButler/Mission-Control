import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePersonalConnection,validatePersonalRequest} from './personal-connections.js';
const context={actor:'member',householdId:'home',sessionId:'session'};
function fixture(t){
 const env={MC_PERSONAL_CONNECTIONS:'enabled',MC_PERSONAL_ENCRYPTION_KEY:'ab'.repeat(32),MC_PERSONAL_CALLBACK_ORIGIN:'https://offline.invalid',MC_AUTHORIZED_PARTIES:'https://offline.invalid',MC_GOOGLE_CLIENT_ID:'client',MC_GOOGLE_CLIENT_SECRET:'secret',MC_MICROSOFT_CLIENT_ID:'client',MC_MICROSOFT_CLIENT_SECRET:'secret'};
 const old=Object.fromEntries(Object.keys(env).map(n=>[n,process.env[n]]));Object.assign(process.env,env);t.after(()=>{for(const [n,v]of Object.entries(old)){if(v===undefined)delete process.env[n];else process.env[n]=v;}});
 const records=new Map(),calls=[];let revoked=false,lostConsume=false,exchanges=0,changedDuringRead=false;
 const store=async body=>{
  calls.push(body);assert.equal(body.actor,'member');assert.equal(body.householdId,'home');assert.equal(body.purpose,'calendar');
  if(revoked)throw Object.assign(Error('Denied'),{code:'PERSONAL_CONNECTIONS_FORBIDDEN',statusCode:403});
  const current=records.get(body.provider)||{version:0,ciphertext:'',nonce:'',expiresAt:0};
  if(body.operation==='consume'){if(!current.nonce||current.nonce!==body.nonce)throw Object.assign(Error('Used'),{code:'PERSONAL_CONNECTIONS_CONSENT_EXPIRED'});const next={...current,nonce:'',expiresAt:0,version:current.version+1};records.set(body.provider,next);if(lostConsume)throw Object.assign(Error('Lost'),{code:'PERSONAL_CONNECTIONS_OUTCOME_UNKNOWN'});return next;}
  if(body.operation==='save'){if(body.expectedVersion!==current.version)throw Object.assign(Error('Stale'),{code:'PERSONAL_CONNECTIONS_CONFLICT'});const next={version:current.version+1,ciphertext:body.ciphertext,nonce:body.nonce,expiresAt:body.expiresAt};records.set(body.provider,next);return next;}
  return structuredClone(current);
 };
 const deps={store,exchange:async()=>{exchanges++;return{accessToken:'SECRET_ACCESS',refreshToken:'SECRET_REFRESH',expiresAt:Date.now()+3600000};},account:async()=>({accountId:'private-account',label:'test@example.com'}),calendars:async()=>[{id:'chosen',label:'Home'},{id:'other',label:'Other'}],events:async()=>{if(changedDuringRead){const record=records.get('google');records.set('google',{...record,version:record.version+1,ciphertext:''});}return[{id:'one',title:'Pickup',start:'2026-10-06T15:00:00Z',end:'2026-10-06T16:00:00Z',allDay:false,calendarId:'chosen',calendarLabel:'Home'}];}};
 const run=(body,ctx=context)=>handlePersonalConnection(body,ctx,deps);
 const begin=async provider=>new URL((await run({operation:'connect_calendar',provider})).authorizationUrl).searchParams.get('state');
 const connect=async(provider='google')=>run({operation:'complete_connection',code:'code',state:await begin(provider)});
 return{records,calls,run,begin,connect,deps,get exchanges(){return exchanges;},revoke(){revoked=true;},loseConsume(){lostConsume=true;},changeOnRead(){changedDuringRead=true;}};
}
test('complete Google and Microsoft flows persist ciphertext and expose only connection metadata',async t=>{
 const f=fixture(t);for(const provider of ['google','microsoft']){const result=await f.connect(provider);assert.equal(result.connection.connected,true);assert.equal(result.connection.version,3);assert.equal(result.connection.calendars.length,0);assert.ok(!JSON.stringify(result).includes('SECRET'));assert.ok(!f.records.get(provider).ciphertext.includes('SECRET'));}
 const result=await f.run({operation:'connections'});assert.equal(result.connections.length,2);assert.ok(!JSON.stringify(result).includes('private-account'));
});
test('callback replay and changed session never exchange a code a second time',async t=>{
 const f=fixture(t),state=await f.begin('google');await assert.rejects(f.run({operation:'complete_connection',code:'code',state},{...context,sessionId:'other'}),e=>e.code==='PERSONAL_CONNECTIONS_CONSENT_EXPIRED');assert.equal(f.exchanges,0);
 await f.run({operation:'complete_connection',code:'code',state});await assert.rejects(f.run({operation:'complete_connection',code:'code',state}),e=>e.code==='PERSONAL_CONNECTIONS_CONSENT_EXPIRED');assert.equal(f.exchanges,1);
});
test('revoked access and uncertain nonce commit stop before provider token exchange',async t=>{
 for(const failure of ['revoke','loseConsume']){const f=fixture(t),state=await f.begin('google');f[failure]();await assert.rejects(f.run({operation:'complete_connection',code:'code',state}));assert.equal(f.exchanges,0);}
});
test('calendar selection accepts only provider-listed IDs and private schedule contains only selected events',async t=>{
 const f=fixture(t);await f.connect();await assert.rejects(f.run({operation:'select_calendars',provider:'google',expectedVersion:3,calendarIds:['foreign']}),e=>e.code==='PERSONAL_CONNECTIONS_INVALID');
 const result=await f.run({operation:'select_calendars',provider:'google',expectedVersion:3,calendarIds:['chosen']});assert.deepEqual(result.connection.calendars,[{id:'chosen',label:'Home'}]);
 const schedule=await f.run({operation:'personal_schedule'});assert.equal(schedule.schedule.length,1);assert.ok(!JSON.stringify(schedule).includes('SECRET'));assert.equal(schedule.emailSuggestionsAvailable,false);
});
test('disconnect clears encrypted tokens and selection; stale disconnect cannot erase a new connection',async t=>{
 const f=fixture(t);await f.connect();await assert.rejects(f.run({operation:'disconnect_calendar',provider:'google',expectedVersion:0}),e=>e.code==='PERSONAL_CONNECTIONS_CONFLICT');
 const result=await f.run({operation:'disconnect_calendar',provider:'google',expectedVersion:3});assert.equal(result.connection.connected,false);assert.equal(f.records.get('google').ciphertext,'');assert.deepEqual((await f.run({operation:'personal_schedule'})).schedule,[]);
});
test('disconnect during provider fetch prevents returning the stale private schedule',async t=>{
 const f=fixture(t);await f.connect();await f.run({operation:'select_calendars',provider:'google',expectedVersion:3,calendarIds:['chosen']});f.changeOnRead();await assert.rejects(f.run({operation:'personal_schedule'}),e=>e.code==='PERSONAL_CONNECTIONS_CONFLICT');
});
test('public requests reject authority, token, email consent and calendar label injection',()=>{
 for(const body of [{operation:'connections',actor:'other'},{operation:'connect_calendar',provider:'google',purpose:'email'},{operation:'select_calendars',provider:'google',expectedVersion:1,calendarIds:['chosen'],label:'fake'},{operation:'connect_calendar',provider:'icloud'},{operation:'complete_connection',code:'x',state:'x',accessToken:'secret'}])assert.equal(validatePersonalRequest(body),false);
});

test('consolidated public route checks origin and role, derives ownership and retains verified session binding',async t=>{
 const [{default:fs},{default:vm},{authorize},{requireMissionControlOrigin}]=await Promise.all([import('node:fs'),import('node:vm'),import('./authorization.js'),import('./origin.js')]);
 const f=fixture(t);let signedIn=true,role='secondary';
 const ctx=vm.createContext({process:{env:{MC_DEFAULT_HOUSEHOLD_ID:'home'}},Set,Number,validatePersonalRequest,handlePersonalConnection:(body,authority)=>f.run(body,authority),requireMissionControlOrigin,authorize,installClerkIdentityAdapter(){},installUpstreamDirectoryAdapter(){},requireVerifiedIdentity:async()=>{if(!signedIn)throw Object.assign(Error('private'),{statusCode:401,code:'UNAUTHENTICATED'});return{provider:'clerk',subject:'verified-subject',sessionId:'session'};},resolveAccessContext:async(identity,householdId)=>{assert.equal(identity.subject,'verified-subject');return{user:{userId:'member',status:'active'},household:{householdId,status:householdId==='home'?'active':'inactive'},membership:{userId:'member',householdId,role,status:'active'}};}});
 vm.runInContext(fs.readFileSync(new URL('../api/v1/member.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default async function handler','globalThis.handler=async function handler'),ctx);
 const request=async(body,origin='https://offline.invalid')=>{let status=200,result;await ctx.handler({method:'POST',body,headers:{origin,'sec-fetch-site':'same-origin'}},{setHeader(){},status(value){status=value;return this;},json(value){result=value;}});return{status,result};};
 assert.equal((await request({operation:'connections',actor:'other'})).status,400);assert.equal((await request({operation:'connections'},'https://evil.invalid')).status,403);role='extended';assert.equal((await request({operation:'connections'})).status,403);signedIn=false;assert.equal((await request({operation:'connections'})).status,401);assert.equal(f.calls.length,0);
 signedIn=true;role='secondary';const consent=await request({operation:'connect_calendar',provider:'google'});assert.equal(consent.status,200);
 const state=new URL(consent.result.authorizationUrl).searchParams.get('state');const completed=await request({operation:'complete_connection',code:'code',state});assert.equal(completed.status,200);assert.ok(!JSON.stringify(completed.result).includes('SECRET'));
 f.revoke();assert.equal((await request({operation:'connections'})).status,403);assert.equal((await request({operation:'connections',householdId:'foreign'})).status,403);
});

test('selection keeps its checked snapshot across concurrent selection and reconnect',async t=>{
 for(const reconnect of [false,true]){
  const f=fixture(t);await f.connect();const underlying=f.deps.store;let armed=true;
  f.deps.store=async body=>{const result=await underlying(body);if(armed&&!body.operation&&body.provider==='google'){armed=false;const current=f.records.get('google');const {openPersonalSecret,sealPersonalSecret}=await import('./personal-oauth.js');const aad=JSON.stringify(['personal-connection-v1','member','home','google','calendar']);const data=openPersonalSecret(current.ciphertext,process.env.MC_PERSONAL_ENCRYPTION_KEY,aad);data.calendars=[{id:'other',label:'Other'}];if(reconnect)data.accountId='new-account';f.records.set('google',{...current,version:current.version+1,ciphertext:sealPersonalSecret(data,process.env.MC_PERSONAL_ENCRYPTION_KEY,aad)});}return result;};
  await assert.rejects(f.run({operation:'select_calendars',provider:'google',expectedVersion:3,calendarIds:['chosen']}),e=>e.code==='PERSONAL_CONNECTIONS_CONFLICT');assert.equal(f.records.get('google').version,4);
 }
});
test('durable claim serializes rotating-token refresh before any external exchange',async t=>{
 const f=fixture(t);await f.connect();const {openPersonalSecret,sealPersonalSecret}=await import('./personal-oauth.js');const aad=JSON.stringify(['personal-connection-v1','member','home','google','calendar']);const rec=f.records.get('google'),data=openPersonalSecret(rec.ciphertext,process.env.MC_PERSONAL_ENCRYPTION_KEY,aad);data.expiresAt=1;f.records.set('google',{...rec,ciphertext:sealPersonalSecret(data,process.env.MC_PERSONAL_ENCRYPTION_KEY,aad)});
 let release,entered;const started=new Promise(r=>{entered=r;});const wait=new Promise(r=>{release=r;});let refreshes=0;
 f.deps.exchange=async()=>{refreshes++;entered();await wait;return{accessToken:'rotated-access',refreshToken:'rotated-refresh',expiresAt:Date.now()+3600000};};
 const first=f.run({operation:'list_calendars',provider:'google'});await started;await assert.rejects(f.run({operation:'list_calendars',provider:'google'}),e=>e.code==='PERSONAL_RECONNECT_REQUIRED');assert.equal(refreshes,1);release();await first;
 const saved=openPersonalSecret(f.records.get('google').ciphertext,process.env.MC_PERSONAL_ENCRYPTION_KEY,aad);assert.equal(saved.refreshToken,'rotated-refresh');assert.equal(saved.refreshPending,false);
});
test('unknown claim commit stops refresh and key loss still permits owner disconnect',async t=>{
 const f=fixture(t);await f.connect();const {openPersonalSecret,sealPersonalSecret}=await import('./personal-oauth.js');const aad=JSON.stringify(['personal-connection-v1','member','home','google','calendar']);const rec=f.records.get('google'),data=openPersonalSecret(rec.ciphertext,process.env.MC_PERSONAL_ENCRYPTION_KEY,aad);data.expiresAt=1;f.records.set('google',{...rec,ciphertext:sealPersonalSecret(data,process.env.MC_PERSONAL_ENCRYPTION_KEY,aad)});
 const underlying=f.deps.store;f.deps.store=async body=>{const value=await underlying(body);if(body.operation==='save')throw Object.assign(Error('lost claim'),{code:'PERSONAL_CONNECTIONS_OUTCOME_UNKNOWN'});return value;};const before=f.exchanges;await assert.rejects(f.run({operation:'list_calendars',provider:'google'}),e=>e.code==='PERSONAL_CONNECTIONS_OUTCOME_UNKNOWN');assert.equal(f.exchanges,before);f.deps.store=underlying;
 delete process.env.MC_PERSONAL_ENCRYPTION_KEY;delete process.env.MC_PERSONAL_CALLBACK_ORIGIN;const status=await f.run({operation:'connections'});assert.equal(status.connections[0].requiresReconnect,true);await f.run({operation:'disconnect_calendar',provider:'google',expectedVersion:f.records.get('google').version});assert.equal(f.records.get('google').ciphertext,'');
});

test('selection may advance only through its own claimed refresh and failed exchange is not repeated',async t=>{
 for(const failed of [false,true]){
  const f=fixture(t);await f.connect();const {openPersonalSecret,sealPersonalSecret}=await import('./personal-oauth.js');const aad=JSON.stringify(['personal-connection-v1','member','home','google','calendar']);const rec=f.records.get('google'),data=openPersonalSecret(rec.ciphertext,process.env.MC_PERSONAL_ENCRYPTION_KEY,aad);data.expiresAt=1;f.records.set('google',{...rec,ciphertext:sealPersonalSecret(data,process.env.MC_PERSONAL_ENCRYPTION_KEY,aad)});
  if(failed){let refreshes=0;f.deps.exchange=async()=>{refreshes++;throw Error('lost exchange');};await assert.rejects(f.run({operation:'list_calendars',provider:'google'}));await assert.rejects(f.run({operation:'list_calendars',provider:'google'}),e=>e.code==='PERSONAL_RECONNECT_REQUIRED');assert.equal(refreshes,1);}
  else{const result=await f.run({operation:'select_calendars',provider:'google',expectedVersion:3,calendarIds:['chosen']});assert.equal(result.connection.version,6);assert.deepEqual(result.connection.calendars,[{id:'chosen',label:'Home'}]);}
 }
});
test('selected calendar reads overlap and retain final connection validation',async t=>{
 const f=fixture(t);await f.connect();await f.run({operation:'select_calendars',provider:'google',expectedVersion:3,calendarIds:['chosen','other']});
 const started=[],releases=[];f.deps.events=({calendar})=>{started.push(calendar.id);return new Promise(resolve=>releases.push(resolve));};
 const reading=f.run({operation:'personal_schedule'});for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(started,['chosen','other']);releases.forEach(resolve=>resolve([]));assert.deepEqual((await reading).schedule,[]);
});
