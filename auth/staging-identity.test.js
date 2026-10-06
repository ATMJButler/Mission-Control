import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareStagingIdentity,testEmail} from '../scripts/prepare-staging-identity.mjs';
const pk='pk_test_'+Buffer.from('synthetic-example.clerk.accounts.dev$').toString('base64');
function fixture({version=13,unrelatedAccount=false,ambiguous=false,loseBatchResponse=false}={}){
 const calls=[];let account;
 const users=[['userId','status','displayName','identityProvider','providerSubject','email','createdAt','updatedAt','notes'],['owner','active','PRIVATE OWNER','clerk','user_owner','PRIVATE EMAIL','','','']];
 const members=[['membershipId','householdId','userId','role','status','createdAt','updatedAt','notes'],['owner-member','butler-household','owner','secondary','active','','','']];
 if(ambiguous)users.push(['staging-automation-member'],['staging-automation-member']);
 const meals={householdId:'butler-household',version,approved:{days:[{meal:'TEST Soup'},...Array(6).fill({meal:'TEST meal'})],groceryList:[{item:'TEST apples',qty:'6',done:true}]},draft:{sentinel:'KEEP DRAFT'},mealHistory:['KEEP HISTORY'],rules:{sentinel:'KEEP RULES'}};
 const mealRows=[['key','householdId','schemaVersion','updatedAt','updatedBy','status','json','notes'],['staging-neighbor','staging-neighbor',1,'','','approved',JSON.stringify({householdId:'staging-neighbor',version:9}),'KEEP NEIGHBOR'],[],['butler-household','butler-household',1,'','','approved',JSON.stringify(meals),'KEEP FIXTURE NOTES']];
 const request=async(url,options)=>{
  calls.push({url,method:options.method});let result;const path=decodeURIComponent(url);
  if(path.includes('/jwks')||path.includes('/.well-known/'))result={keys:[{kid:'a',kty:'RSA',n:'public',e:'AQAB'}]};
  else if(path.includes('/users/count'))result={total_count:account||unrelatedAccount?1:0};
  else if(path.includes('/users?'))result=account?[account]:[];
  else if(path==='https://api.clerk.com/v1/users'&&options.method==='POST'){
   const body=JSON.parse(options.body);assert.deepEqual(body.email_address,[testEmail]);account={id:'user_synthetic',private_metadata:body.private_metadata};result=account;
  }else if(path.includes('/values:batchUpdate')){
   for(const patch of JSON.parse(options.body).data){const target=patch.range.includes("'Users'")?users:members;const row=Number(patch.range.match(/!A(\d+)/)[1]);assert.equal(row,target.length+1);target.push(patch.values[0]);}
   if(loseBatchResponse){loseBatchResponse=false;throw new Error('Network lost after commit');}result={};
  }else if(path.includes('/values/'))result={values:path.includes("'Users'")?structuredClone(users):path.includes('Household Memberships')?structuredClone(members):mealRows};
  else result={spreadsheetId:'18eft4EyxSy1lCtydd5dwuu20iMiJOBV0AAiHq4gu05Y',properties:{title:'Mission Control - Staging Test Data'}};
  return {ok:true,status:200,json:async()=>result};
 };
 return{calls,users,members,run:()=>prepareStagingIdentity({googleToken:'PRIVATE GOOGLE',secretKey:'sk_test_PRIVATE',publishableKey:pk,request})};
}
test('provisioning creates one synthetic secondary, preserves prior users, and safely repeats',async()=>{
 const f=fixture(),before=structuredClone(f.users);const report=await f.run();assert.equal(report.syntheticMemberReady,true);assert.equal(report.directoryRowsAdded,2);assert.deepEqual(f.users.slice(0,before.length),before);assert.equal(f.members.at(-1)[3],'secondary');assert.ok(!JSON.stringify(report).includes('PRIVATE'));
 const second=await f.run();assert.equal(second.directoryRowsAdded,0);assert.equal(f.calls.filter(c=>c.method==='POST').length,2);
});
test('changed Meals, unrelated Clerk account and ambiguous directory all stop before writes',async()=>{
 for(const option of [{version:14},{unrelatedAccount:true},{ambiguous:true}]){const f=fixture(option);await assert.rejects(f.run());assert.ok(f.calls.every(c=>c.method==='GET'));}
});
test('lost directory write response is not resent; explicit later run discovers committed rows',async()=>{
 const f=fixture({loseBatchResponse:true});await assert.rejects(f.run(),/uncertain/);assert.equal(f.calls.filter(c=>c.url.includes('values:batchUpdate')).length,1);
 const report=await f.run();assert.equal(report.directoryRowsAdded,0);assert.equal(f.calls.filter(c=>c.url.includes('values:batchUpdate')).length,1);
});
