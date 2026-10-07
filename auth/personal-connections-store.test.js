import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppsScriptHarness} from './helpers/apps-script-harness.js';
import {callPersonalStore} from './personal-connections-store.js';
const nonce='a'.repeat(43);
const payload=extra=>({token:'offline-service-token',resource:'personal_connections',actor:'u1',householdId:'home',provider:'google',purpose:'calendar',operation:'read',...extra});
function harness(){
 const h=createAppsScriptHarness();h.properties.set('PERSONAL_CONNECTIONS','enabled');
 h.sheet('Users',[['userId','status','displayName','identityProvider','providerSubject','email','createdAt','updatedAt','notes'],['u1','active','','offline','subject','','','','']]);
 h.sheet('Households',[['householdId','status','name','createdAt','updatedAt','notes'],['home','active','','','','']]);
 h.sheet('Household Memberships',[['membershipId','householdId','userId','role','status','createdAt','updatedAt','notes'],['m1','home','u1','secondary','active','','','']]);return h;
}
const save=(h,extra={})=>h.post(payload({operation:'save',expectedVersion:0,ciphertext:'encrypted',nonce,expiresAt:Date.now()+500000,...extra}));
const writes=h=>h.events.filter(e=>['write','insert'].includes(e.type));
test('connection reads are self-scoped and never initialize storage',()=>{const h=harness();assert.deepEqual(h.post(payload()).record,{version:0,ciphertext:'',nonce:'',expiresAt:0});assert.equal(writes(h).length,0);});
test('nonce consumption commits once under lock; replay and stale saves cannot exchange again',()=>{
 const h=harness();assert.equal(save(h).record.version,1);
 const consumed=h.post(payload({operation:'consume',nonce}));assert.equal(consumed.record.version,2);assert.equal(consumed.record.nonce,'');
 assert.equal(h.post(payload({operation:'consume',nonce})).error,'PERSONAL_CONNECTIONS_CONSENT_EXPIRED');assert.equal(save(h).error,'PERSONAL_CONNECTIONS_CONFLICT');
 assert.ok(h.events.filter(e=>e.type==='write').every(e=>e.held));assert.equal(h.held,false);
});
test('independent gate, active authority and payload allowlist reject before writes',()=>{
 for(const modify of [h=>h.properties.delete('PERSONAL_CONNECTIONS'),h=>{const rows=h.rows('Household Memberships');rows[1][4]='revoked';h.sheet('Household Memberships',rows);},h=>{const rows=h.rows('Users');rows.push([...rows[1]]);h.sheet('Users',rows);}]){const h=harness();modify(h);assert.equal(save(h).ok,false);assert.equal(writes(h).length,0);}
 const h=harness();for(const extra of [{actor:'other'},{householdId:'other'},{provider:'icloud'},{accessToken:'plaintext'},{nonce:''},{expiresAt:Date.now()-1},{ciphertext:'has spaces'}])assert.equal(save(h,extra).ok,false);assert.equal(writes(h).length,0);
});
test('interior blank row, neighboring owner and duplicate own record preserve physical ownership',()=>{
 const h=harness();save(h);const initial=h.rows('Personal Connections');h.sheet('Personal Connections',[initial[0],['other','home','google','calendar',1,1,'neighbor','',0,''],[],initial[1]]);
 const before=h.rows('Personal Connections');assert.equal(save(h,{expectedVersion:1,nonce:'',expiresAt:0}).record.version,2);
 const after=h.rows('Personal Connections');assert.deepEqual(after.slice(1,3),before.slice(1,3));assert.equal(after[3][5],2);
 after.push([...after[3]]);h.sheet('Personal Connections',after);assert.equal(h.post(payload()).error,'PERSONAL_CONNECTIONS_SCHEMA_INVALID');
});
test('flush loss after nonce consumption is unknown; readback never makes it reusable',()=>{
 const h=harness();save(h);h.setFault(e=>{if(e.type==='flush')throw Error('fault');});assert.equal(h.post(payload({operation:'consume',nonce})).error,'PERSONAL_CONNECTIONS_OUTCOME_UNKNOWN');assert.equal(h.held,false);
 h.setFault(()=>{});assert.equal(h.post(payload()).record.nonce,'');assert.equal(h.post(payload({operation:'consume',nonce})).ok,false);
});
test('adapter sanitizes unknown transport loss without retrying an uncertain mutation',async t=>{
 const previous={MC_SYNC_URL:process.env.MC_SYNC_URL,MC_SYNC_TOKEN:process.env.MC_SYNC_TOKEN};process.env.MC_SYNC_URL='https://offline.invalid';process.env.MC_SYNC_TOKEN='secret';t.after(()=>{for(const [k,v]of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
 let calls=0;await assert.rejects(callPersonalStore({actor:'u1',householdId:'home',provider:'google',purpose:'calendar',operation:'consume',nonce},{request:async()=>{calls++;throw Error('secret');}}),e=>e.code==='PERSONAL_CONNECTIONS_OUTCOME_UNKNOWN'&&!e.message.includes('secret'));assert.equal(calls,1);
});
