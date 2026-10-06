import test from 'node:test';
import assert from 'node:assert/strict';
import {checkStagingVercel,stagingProjectId} from '../scripts/check-staging-vercel.mjs';
const project={id:stagingProjectId,name:'mission-control-staging',accountId:'team_synthetic'};
function mock(replies) {
 const calls=[];return {calls,request:async(url,options)=>{calls.push({url,options});const next=replies.shift();if(!next)throw new Error('Unexpected request');return {status:next.status,ok:next.status===200,json:async()=>next.body};}};
}
test('Vercel preflight reads only allowlisted project and emits no credential or payload',async()=>{
 const f=mock([{status:200,body:{...project,PRIVATE:'hidden'}}]);const report=await checkStagingVercel({token:'PRIVATE TOKEN',request:f.request});
 assert.equal(report.projectId,stagingProjectId);assert.equal(report.writesRequested,0);assert.ok(!JSON.stringify(report).includes('PRIVATE'));assert.equal(f.calls.length,1);assert.equal(f.calls[0].options.method,'GET');
});
test('Vercel preflight discovers team scope without reading other projects',async()=>{
 const f=mock([{status:404},{status:200,body:{teams:[{id:'team_synthetic'}]}},{status:200,body:project}]);
 const report=await checkStagingVercel({token:'x',request:f.request});assert.equal(report.teamId,'team_synthetic');
 assert.ok(f.calls.every(c=>c.options.method==='GET'));assert.ok(f.calls.filter(c=>c.url.includes('/projects/')).every(c=>c.url.includes(stagingProjectId)));
});
test('Vercel preflight rejects missing token, wrong project and denied access',async()=>{
 const empty=mock([]);await assert.rejects(checkStagingVercel({request:empty.request}),/missing/);assert.equal(empty.calls.length,0);
 await assert.rejects(checkStagingVercel({token:'x',request:mock([{status:200,body:{...project,name:'production'}}]).request}),/allowlist/);
 await assert.rejects(checkStagingVercel({token:'x',request:mock([{status:401}]).request}),/HTTP 401/);
});
