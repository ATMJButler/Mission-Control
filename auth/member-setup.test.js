import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createAppsScriptHarness} from './helpers/apps-script-harness.js';
import {setupDefaults,validateSetupPreferences,callMemberSetup} from './member-setup.js';
import {validateMemberMealEdit,editMemberMeals} from './member-meals-edit.js';
import {authorize} from './authorization.js';
import {requireMissionControlOrigin} from './origin.js';
const headers=['userId','householdId','schemaVersion','version','preferencesJson','status','updatedAt','updatedBy'];
function harness(role='secondary'){
 const h=createAppsScriptHarness();h.properties.set('MEMBER_SETUP','enabled');
 h.sheet('Users',[['userId','status','displayName','identityProvider','providerSubject','email','createdAt','updatedAt','notes'],['u1','active','Offline Member','offline','private-subject','private-email','','',''],['u2','active','','offline','other','','','','']]);
 h.sheet('Households',[['householdId','status','name','createdAt','updatedAt','notes'],['home','active','Offline household','','','']]);
 h.sheet('Household Memberships',[['membershipId','householdId','userId','role','status','createdAt','updatedAt','notes'],['m1','home','u1',role,'active','','',''],['m2','home','u2','principal','active','','','']]);
 return h;
}
const payload=extra=>({token:'offline-service-token',resource:'member_setup',operation:'read',actor:'u1',householdId:'home',...extra});
const save=(h,version,preferences={...setupDefaults(),step:1})=>h.post(payload({operation:'save',expectedVersion:version,preferences}));
const writes=h=>h.events.filter(e=>['write','insert','append'].includes(e.type));
test('read never initializes a missing setup table or writes to directory',()=>{const h=harness();assert.deepEqual(h.post(payload()).profile,{version:0,preferences:setupDefaults(),status:'not_started'});assert.equal(writes(h).length,0);assert.equal(h.held,false);});
test('independent gate, token, role and household checks reject without mutation',()=>{
 for(const role of ['secondary','extended']){const h=harness(role);if(role==='secondary')h.properties.delete('MEMBER_SETUP');assert.equal(h.post(payload()).ok,false);assert.equal(writes(h).length,0);}
 const h=harness();for(const change of [{token:'wrong'},{householdId:'foreign'},{actor:'unknown'}])assert.equal(h.post(payload(change)).ok,false);assert.equal(writes(h).length,0);
});
test('revoked and duplicate directory bindings fail closed',()=>{
 for(const table of ['Users','Households','Household Memberships']){const h=harness();const rows=h.rows(table);rows.push([...rows[1]]);h.sheet(table,rows);assert.equal(save(h,0).error,'MEMBER_SETUP_FORBIDDEN');assert.equal(writes(h).length,0);}
 const h=harness();const rows=h.rows('Household Memberships');rows[1][4]='revoked';h.sheet('Household Memberships',rows);assert.equal(save(h,0).error,'MEMBER_SETUP_FORBIDDEN');assert.equal(writes(h).length,0);
});
test('schema parity rejects authority and fake connected fields in both layers',()=>{
 const h=harness();for(const prefs of [{...setupDefaults(),role:'principal'},{...setupDefaults(),calendarProviders:['google','google']},{...setupDefaults(),connected:true},{...setupDefaults(),sharingDefault:'details'},{...setupDefaults(),step:7}]){assert.equal(validateSetupPreferences(prefs),false);assert.equal(save(h,0,prefs).error,'MEMBER_SETUP_INVALID');}assert.equal(writes(h).length,0);
});
test('first save persists own profile only and stale CAS cannot overwrite it',()=>{
 const h=harness();const before=[h.rows('Users'),h.rows('Household Memberships')];assert.equal(save(h,0).profile.version,1);assert.equal(save(h,0).error,'MEMBER_SETUP_CONFLICT');assert.equal(h.post(payload()).profile.version,1);assert.deepEqual([h.rows('Users'),h.rows('Household Memberships')],before);assert.ok(h.events.filter(e=>e.type==='write').every(e=>e.held));
});
test('interior blank row preserves physical target and neighboring member',()=>{
 const h=harness();const prefs=setupDefaults();h.sheet('Member Setup',[headers,['u2','home',1,1,JSON.stringify(prefs),'in_progress','','u2'],[],['u1','home',1,2,JSON.stringify(prefs),'in_progress','','u1']]);const before=h.rows('Member Setup');assert.equal(save(h,2).profile.version,3);const after=h.rows('Member Setup');assert.deepEqual(after[1],before[1]);assert.deepEqual(after[2],[]);assert.equal(after[3][3],3);assert.equal(h.events.find(e=>e.type==='written'&&e.sheet==='Member Setup').row,4);
});
test('duplicate profiles or corrupt schemas are never repaired by read/save',()=>{
 const h=harness();save(h,0);const rows=h.rows('Member Setup');rows.push([...rows[1]]);h.sheet('Member Setup',rows);const count=writes(h).length;assert.equal(h.post(payload()).error,'MEMBER_SETUP_SCHEMA_INVALID');assert.equal(save(h,1).error,'MEMBER_SETUP_SCHEMA_INVALID');assert.equal(writes(h).length,count);
});
test('postwrite and flush loss stay UNKNOWN, are reconciled by readback, release lock',()=>{
 for(const failure of ['written','flush']){const h=harness();save(h,0);h.setFault(e=>{if(e.type===failure)throw Error('private fault');});assert.equal(save(h,1).error,'MEMBER_SETUP_OUTCOME_UNKNOWN');assert.equal(h.held,false);h.setFault(()=>{});assert.equal(h.post(payload()).profile.version,2);}
});
test('final preference save is not OAuth or dashboard readiness',()=>{const h=harness();const result=save(h,0,{...setupDefaults(),step:6,calendarProviders:['google'],emailProviders:['microsoft']});assert.equal(result.profile.status,'preferences_saved');assert.equal(result.profile.preferences.calendarProviders[0],'google');});

function route(t,{role='secondary',signedIn=true,gate=true,transport}={}){
 const h=harness(role),calls=[],previous={};for(const [name,value] of Object.entries({MC_AUTHORIZED_PARTIES:'https://offline.invalid',MC_SYNC_URL:'https://offline.invalid/exec',MC_SYNC_TOKEN:'offline-service-token'})){previous[name]=process.env[name];process.env[name]=value;}
 const previousFetch=globalThis.fetch;globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);if(transport)return transport(h,body);return new Response(JSON.stringify(h.post(body)));};
 t.after(()=>{globalThis.fetch=previousFetch;for(const [name,value]of Object.entries(previous)){if(value===undefined)delete process.env[name];else process.env[name]=value;}});
 const ctx=vm.createContext({process:{env:{MC_DEFAULT_HOUSEHOLD_ID:'home',MC_MEMBER_SETUP:gate?'enabled':''}},Set,Number,validateMemberMealEdit,editMemberMeals,requireMissionControlOrigin,authorize,validateSetupPreferences,callMemberSetup,installClerkIdentityAdapter(){},installUpstreamDirectoryAdapter(){},requireVerifiedIdentity:async()=>{if(!signedIn)throw Object.assign(new Error('private'),{statusCode:401,code:'UNAUTHENTICATED'});return{provider:'offline',subject:'private'};},resolveAccessContext:async(_identity,householdId)=>({user:{userId:'u1',status:'active'},household:{householdId,status:householdId==='home'?'active':'inactive'},membership:{userId:'u1',householdId,role,status:'active'}})});
 const source=fs.readFileSync(new URL('../api/v1/member.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default async function handler','globalThis.handler=async function handler');vm.runInContext(source,ctx);
 return{h,calls,async request(body={operation:'read'},origin='https://offline.invalid'){let status=200,result;const headers={};await ctx.handler({method:'POST',body,headers:{origin,'sec-fetch-site':'same-origin'}},{setHeader(k,v){headers[k]=v;return this},status(v){status=v;return this},json(v){result=v;return this}});return{status,result,headers};}};
}
test('real adapter/backend route derives authority and returns only own preferences',async t=>{const f=route(t);const r=await f.request({operation:'save',expectedVersion:0,preferences:{...setupDefaults(),step:1}});assert.equal(r.status,200);assert.equal(f.calls[0].actor,'u1');assert.equal(f.calls[0].householdId,'home');assert.equal(r.headers['Cache-Control'],'no-store');assert.deepEqual(r.result.capabilities,{calendarConnections:false,emailConnections:false,sharedDashboard:false});assert.ok(!JSON.stringify(r.result).includes('private-subject'));assert.ok(!JSON.stringify(r.result).includes('private-email'));assert.ok(!JSON.stringify(r.result).includes('offline-service-token')); });
test('anonymous, extended, gate-off, bad-origin and authority smuggling never reach setup upstream',async t=>{
 for(const options of [{signedIn:false},{role:'extended'},{gate:false}]){const f=route(t,options);assert.ok((await f.request()).status>=400);assert.equal(f.calls.length,0);}
 const f=route(t);for(const body of [{operation:'read',actor:'u2'},{operation:'read',householdId:'foreign'},{operation:'read',role:'principal'}])assert.ok((await f.request(body)).status>=400);assert.equal((await f.request({operation:'read'},'https://evil.invalid')).status,403);assert.equal(f.calls.length,0);
});
test('backend independently denies revoked member after Vercel context was resolved',async t=>{const f=route(t);const rows=f.h.rows('Household Memberships');rows[1][4]='revoked';f.h.sheet('Household Memberships',rows);assert.equal((await f.request({operation:'save',expectedVersion:0,preferences:setupDefaults()})).status,403);assert.equal(writes(f.h).length,0);});
test('lost committed save response is UNKNOWN and readback resolves it without retry',async t=>{let lost=true;const f=route(t,{transport:(h,body)=>{const result=h.post(body);if(lost&&body.operation==='save'){lost=false;throw Error('private transport body');}return new Response(JSON.stringify(result));}});const r=await f.request({operation:'save',expectedVersion:0,preferences:{...setupDefaults(),step:1}});assert.equal(r.result.code,'MEMBER_SETUP_OUTCOME_UNKNOWN');assert.equal((await f.request()).result.profile.version,1);assert.equal(f.calls.filter(b=>b.operation==='save').length,1);});
test('malformed and mismatched save success responses cannot claim a confirmed save',async t=>{
 for(const response of [()=>new Response('not JSON'),()=>new Response(JSON.stringify({ok:true,profile:{version:5,preferences:setupDefaults(),status:'in_progress'}}))]){const f=route(t,{transport:response});const r=await f.request({operation:'save',expectedVersion:0,preferences:setupDefaults()});assert.equal(r.result.code,'MEMBER_SETUP_OUTCOME_UNKNOWN');}
});
test('backend setup gate independently rejects with Vercel gate enabled',async t=>{const f=route(t);f.h.properties.delete('MEMBER_SETUP');const r=await f.request({operation:'save',expectedVersion:0,preferences:setupDefaults()});assert.equal(r.status,503);assert.equal(r.result.code,'MEMBER_SETUP_DISABLED');assert.equal(writes(f.h).length,0);});
