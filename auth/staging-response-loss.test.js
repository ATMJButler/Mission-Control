import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../staging/arm-response-loss.js',import.meta.url),'utf8');
function fixture({host='mission-control-staging.vercel.app',enabled=true,version=10,success=true}={}){
 const calls=[],logs=[];let expiry;
 const original=async(input,options)=>{const body=JSON.parse(options.body);calls.push(body);return new Response(JSON.stringify(body.operation==='dashboard'?{ok:true,dashboard:{meals:{version},capabilities:{mealsEdit:enabled}}}:success?{ok:true,previousVersion:10,newVersion:11}:{ok:false,code:'MEMBER_MEALS_CONFLICT'}),{status:body.operation==='dashboard'||success?200:409});};
 const target={location:{hostname:host,pathname:'/member.html',href:'https://'+host+'/member.html'},fetch:original};
 const ctx=vm.createContext({location:{hostname:host},document:{getElementById:()=>({contentWindow:target})},window:target,URL,AbortSignal,console:{log:v=>logs.push(v)},setTimeout:fn=>{expiry=fn;return 1;},clearTimeout(){}});
 return{target,original,calls,logs,arm:()=>vm.runInContext(source,ctx),expire:()=>expiry()};
}
const save={method:'POST',body:JSON.stringify({operation:'edit_groceries',expectedVersion:10,rows:[]})};
test('fault arming reads only; one successful response is discarded and fetch restored before readback',async()=>{
 const f=fixture();await f.arm();assert.equal(f.calls.length,1);assert.equal(f.calls[0].operation,'dashboard');
 await assert.rejects(f.target.fetch('/api/v1/member',save),/Simulated staging response loss/);assert.equal(f.target.fetch,f.original);assert.equal(f.target.__mcStagingLossCancel,undefined);
 await f.target.fetch('/api/v1/member',{method:'POST',body:'{"operation":"dashboard"}'});assert.equal(f.calls.filter(x=>x.operation==='edit_groceries').length,1);
});
test('fault refuses production, disabled gates and changed baseline; expiry restores without mutation',async()=>{
 for(const option of [{host:'mission-control-lime-tau.vercel.app'},{enabled:false},{version:11}]){const f=fixture(option);await assert.rejects(f.arm());assert.equal(f.target.fetch,f.original);assert.ok(f.calls.every(x=>x.operation==='dashboard'));}
 const f=fixture();await f.arm();f.expire();assert.equal(f.target.fetch,f.original);assert.equal(f.calls.length,1);
});
test('definitive conflict passes through and wrong expectedVersion is not sent',async()=>{
 const f=fixture({success:false});await f.arm();const r=await f.target.fetch('/api/v1/member',save);assert.equal(r.status,409);assert.equal(f.target.fetch,f.original);
 const stale=fixture();await stale.arm();await assert.rejects(stale.target.fetch('/api/v1/member',{...save,body:JSON.stringify({operation:'edit_groceries',expectedVersion:9})}),/baseline changed/);assert.equal(stale.calls.length,1);assert.equal(stale.target.fetch,stale.original);
});
