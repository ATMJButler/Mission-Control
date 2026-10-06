import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateStagingClerk} from '../scripts/migrate-staging-clerk.mjs';
import {stagingProjectId} from '../scripts/check-staging-vercel.mjs';
const pk='pk_test_'+Buffer.from('synthetic-example.clerk.accounts.dev$').toString('base64'),sk='sk_test_NEW';
function fixture({editing=false,losePatch=false,wrongProject=false,sensitive=false,loseCreate=false,sensitiveGates=false}={}) {
 const calls=[];let aliasDeployment='dpl_previous';
 const envs=[['CLERK_SECRET_KEY','sk_test_OLD'],['CLERK_PUBLISHABLE_KEY','pk_test_OLD'],['MC_MEMBER_DASHBOARD','enabled'],['MC_MEMBER_MEALS_EDIT',editing?'enabled':'disabled']].map(([key,value],i)=>({id:'env_fixture'+i,key,value,target:['production'],type:'encrypted'}));
 if(sensitive)envs[0].type='sensitive';
 if(sensitiveGates)envs.filter(e=>e.key.startsWith('MC_')).forEach(e=>e.type='sensitive');
 const request=async(url,options)=>{
  calls.push({url,method:options.method,body:options.body});const u=new URL(url);let body;
  if(u.hostname==='api.clerk.com')body=u.pathname.endsWith('/count')?{total_count:1}:{keys:[{kid:'a',kty:'RSA',n:'public',e:'AQAB'}]};
  else if(u.hostname.endsWith('clerk.accounts.dev'))body={keys:[{kid:'a',kty:'RSA',n:'public',e:'AQAB'}]};
  else if(u.hostname==='mission-control-staging.vercel.app')body={ok:true,publishableKey:pk};
  else if(u.pathname==='/v4/aliases/mission-control-staging.vercel.app')body={projectId:stagingProjectId,deploymentId:aliasDeployment};
  else if(u.pathname==='/v9/projects/'+stagingProjectId)body={id:stagingProjectId,name:wrongProject?'production':'mission-control-staging',accountId:'team_synthetic'};
  else if(u.pathname==='/v10/projects/'+stagingProjectId+'/env'){
   if(options.method==='POST'){const created={...JSON.parse(options.body),id:'env_created'+envs.length};envs.push(created);if(loseCreate){loseCreate=false;throw new Error('Lost create response');}body=created;}
   else body={envs:structuredClone(envs)};
  }
  else if(u.pathname.includes('/env/')){
   const e=envs.find(e=>u.pathname.endsWith('/'+e.id));assert.ok(e);
   if(options.method==='DELETE'){envs.splice(envs.indexOf(e),1);body={};}
   else{if(options.method==='PATCH'){Object.assign(e,JSON.parse(options.body));if(losePatch){losePatch=false;throw new Error('Response lost');}}body=structuredClone(e);if(e.type==='sensitive')delete body.value;}
  }else if(u.pathname==='/v2/deployments/dpl_fixture/aliases'){
   assert.equal(JSON.parse(options.body).alias,'mission-control-staging.vercel.app');aliasDeployment='dpl_fixture';body={alias:'mission-control-staging.vercel.app'};
  }else if(u.pathname==='/v13/deployments')body={id:'dpl_fixture',readyState:'READY'};
  else throw new Error('Unexpected URL');
  return {ok:true,status:200,json:async()=>body};
 };
 return{calls,envs,run:()=>migrateStagingClerk({token:'PRIVATE',secretKey:sk,publishableKey:pk,sha:'a'.repeat(40),request,pause:async()=>{}})};
}
test('migration targets exact staging project, updates only two keys and verifies public alias',async()=>{
 const f=fixture(),report=await f.run();assert.equal(report.ready,true);assert.equal(report.mealsEditingEnabled,false);assert.ok(!JSON.stringify(report).includes(sk));
 const writes=f.calls.filter(c=>c.method!=='GET');assert.equal(writes.length,4);assert.ok(writes.slice(0,2).every(c=>c.url.includes(stagingProjectId+'/env/')));
 const deploy=JSON.parse(writes[2].body);assert.equal(deploy.project,stagingProjectId);assert.equal(deploy.gitSource.sha,'a'.repeat(40));assert.equal(f.envs[3].value,'disabled');
});
test('enabled editing or wrong project refuses migration before any write',async()=>{
 for(const options of [{editing:true},{wrongProject:true}]){const f=fixture(options);await assert.rejects(f.run());assert.ok(f.calls.every(c=>c.method==='GET'));}
});
test('uncertain key patch is restored and read back before stopping without deployment',async()=>{
 const f=fixture({losePatch:true});await assert.rejects(f.run(),/prior environment values restored/);assert.equal(f.envs[0].value,'sk_test_OLD');assert.equal(f.envs[1].value,'pk_test_OLD');assert.ok(!f.calls.some(c=>c.url.includes('/v13/deployments')));
});
test('sensitive keys and gates update directly with previous live deployment as recovery reference',async()=>{
 const f=fixture({sensitive:true,sensitiveGates:true});const report=await f.run();assert.equal(report.ready,true);assert.equal(report.previousDeploymentId,'dpl_previous');
 assert.equal(f.envs.length,4);assert.equal(f.envs.find(e=>e.key==='CLERK_SECRET_KEY').value,sk);assert.equal(f.envs.find(e=>e.key==='MC_MEMBER_MEALS_EDIT').value,'disabled');
 assert.ok(!f.calls.some(c=>c.method==='DELETE'));assert.ok(!f.calls.some(c=>c.body&&JSON.parse(c.body).key?.startsWith('MC_STAGING_PRIOR_')));
});
test('uncertain sensitive update does not deploy or claim the hidden environment value restored',async()=>{
 const f=fixture({sensitive:true,losePatch:true});await assert.rejects(f.run(),/prior live deployment retained/);assert.ok(!f.calls.some(c=>c.url.includes('/v13/deployments')));
});
