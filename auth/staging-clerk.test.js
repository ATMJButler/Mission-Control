import test from 'node:test';
import assert from 'node:assert/strict';
import {checkStagingClerk} from '../scripts/check-staging-clerk.mjs';
const pk='pk_test_'+Buffer.from('synthetic-example.clerk.accounts.dev$').toString('base64');
function fixture({mismatch=false,status=200}={}) {
  const calls=[];
  const key={kid:'a',kty:'RSA',n:'public-modulus',e:'AQAB'};
  return {calls,request:async(url,options)=>{calls.push({url,options});return {ok:status===200,status,json:async()=>url.includes('/users/count')?{total_count:0,data:[]}:{keys:[url.includes('accounts.dev')&&mismatch?{...key,n:'different'}:key]}};}};
}
test('Clerk connection verifies matching keys with reads only and minimizes report',async()=>{
 const f=fixture();const report=await checkStagingClerk({secretKey:'sk_test_PRIVATE',publishableKey:pk,request:f.request});
 assert.equal(report.keysMatch,true);assert.equal(report.emptyInstance,true);assert.equal(report.writesRequested,0);assert.equal(f.calls.length,3);assert.ok(f.calls.every(c=>c.options.method==='GET'));
 assert.equal(f.calls[1].options.headers.Authorization,undefined);assert.ok(!JSON.stringify(report).includes('PRIVATE'));
});
test('Clerk connection refuses live keys and unsafe frontend URLs before requests',async()=>{
 for(const publishableKey of ['pk_live_example','pk_test_'+Buffer.from('evil.example$').toString('base64')]) {
  const f=fixture();await assert.rejects(checkStagingClerk({secretKey:'sk_test_PRIVATE',publishableKey,request:f.request}));assert.equal(f.calls.length,0);
 }
 const f=fixture();await assert.rejects(checkStagingClerk({secretKey:'sk_live_PRIVATE',publishableKey:pk,request:f.request}));assert.equal(f.calls.length,0);
});
test('Clerk connection rejects mismatched keys and sanitizes API errors',async()=>{
 const f=fixture({mismatch:true});await assert.rejects(checkStagingClerk({secretKey:'sk_test_PRIVATE',publishableKey:pk,request:f.request}),/same signing keys/);assert.equal(f.calls.length,2);
 await assert.rejects(checkStagingClerk({secretKey:'sk_test_PRIVATE',publishableKey:pk,request:fixture({status:401}).request}),/HTTP 401/);
});
