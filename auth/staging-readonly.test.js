import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../staging/check-readonly-member.js',import.meta.url),'utf8');
function run({host='mission-control-staging.vercel.app',editing=false,legacyAllowed=false}={}){
 const calls=[],output=[];
 const ctx=vm.createContext({location:{hostname:host},AbortSignal,console:{table(){},log:value=>output.push(value)},fetch:async(url,options)=>{
  const body=options.body?JSON.parse(options.body):null;calls.push({url,body,method:options.method});
  const value=url.endsWith('/workspace')?{status:200,body:{ok:true,workspace:{role:'secondary',principalWorkspace:false,memberDashboardReady:true}}}:url.endsWith('/member')?{status:200,body:{ok:true,dashboard:{meals:{version:10},capabilities:{mealsEdit:editing}}}}:url.endsWith('/diagnostics')?{status:403,body:{ok:false,code:'DIAGNOSTICS_FORBIDDEN'}}:legacyAllowed?{status:200,body:{ok:true,projects:['PRIVATE PAYLOAD']}}:{status:403,body:{ok:false,code:'LEGACY_PRINCIPAL_REQUIRED'}};
  return{status:value.status,json:async()=>value.body};
 }});return{promise:vm.runInContext(source,ctx),calls,output};
}
test('read-only checkpoint checks scoped read and both principal boundaries without mutation payloads',async()=>{
 const f=run(),r=await f.promise;assert.ok(r.results.every(row=>row.pass));assert.equal(r.mealsVersion,10);assert.equal(r.julieReady,false);assert.equal(f.calls.length,4);assert.ok(f.calls.every(row=>!row.body?.operation||row.body.operation==='dashboard'));
});
test('read-only checkpoint refuses production and enabled edit capability',async()=>{
 const production=run({host:'mission-control-lime-tau.vercel.app'});await assert.rejects(production.promise,/Staging only/);assert.equal(production.calls.length,0);
 const editing=run({editing:true});await assert.rejects(editing.promise,/Read-only Meals required/);assert.equal(editing.calls.length,2);
});
test('unexpected legacy success fails without printing private payload',async()=>{
 const f=run({legacyAllowed:true});await assert.rejects(f.promise,/boundary check failed/);assert.ok(!f.output.join('').includes('PRIVATE PAYLOAD'));
});
