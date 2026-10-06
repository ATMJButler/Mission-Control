import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {validateMemberMealEdit} from './member-meals-edit.js';
const source=fs.readFileSync(new URL('../staging/check-member-rejections.js',import.meta.url),'utf8');
function run({host='mission-control-staging.vercel.app',changed=false,badStatus=false}={}){
 const calls=[];let writes=0;
 const ctx=vm.createContext({location:{hostname:host},AbortSignal,console:{table(){},log(){}},fetch:async(_url,options)=>{
  const body=JSON.parse(options.body);calls.push(body);
  if(body.operation==='dashboard')return{status:200,json:async()=>({ok:true,dashboard:{meals:{version:changed&&writes?11:10,groceryList:[{item:'TEST apples',qty:'5',done:true}]}}})};
  writes++;return{status:badStatus?503:400,json:async()=>({ok:false,code:badStatus?'MEMBER_MEALS_OUTCOME_UNKNOWN':'MEMBER_SETUP_INVALID'})};
 }});
 return{promise:vm.runInContext(source,ctx),calls};
}
test('batch sends only invalid requests, reads after each, and never exposes service credentials',async()=>{
 const f=run();const result=await f.promise;assert.equal(result.length,6);assert.equal(f.calls.filter(x=>x.operation==='dashboard').length,7);
 for(const body of f.calls.filter(x=>x.operation!=='dashboard'))assert.ok(Object.hasOwn(body,'actor')||!validateMemberMealEdit(body.operation,body.rows));
 assert.ok(result.every(x=>x.status===400&&x.unchanged===true));assert.ok(f.calls.every(x=>!Object.hasOwn(x,'token')));
});
test('batch refuses production before any request',async()=>{const f=run({host:'mission-control-lime-tau.vercel.app'});await assert.rejects(f.promise,/Staging only/);assert.equal(f.calls.length,0);});
test('batch stops after one attempt on uncertain response or changed readback',async()=>{
 for(const option of [{changed:true},{badStatus:true}]){const f=run(option);await assert.rejects(f.promise,/Unexpected outcome/);assert.equal(f.calls.filter(x=>x.operation!=='dashboard').length,1);assert.equal(f.calls.filter(x=>x.operation==='dashboard').length,2);}
});
