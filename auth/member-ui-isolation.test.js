import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('legacy Budget extension installs nothing into member or blank iframe on load and retries',()=>{
 for(const page of ['member','blank']){
  const loads=[],timers=[];let creations=0;
  const doc={body:{},readyState:'complete',getElementById:()=>null,createElement(){creations++;throw Error('Unexpected private UI installation');}};
  const frame={contentDocument:doc,contentWindow:{},addEventListener:(_event,fn)=>loads.push(fn)};
  const ctx=vm.createContext({document:{getElementById:()=>frame},window:{addEventListener(){}},setTimeout:fn=>timers.push(fn),setInterval:fn=>{timers.push(fn);return 1;},clearInterval(){}});
  vm.runInContext(read('budget-drilldown.js'),ctx);loads.forEach(fn=>fn());for(let i=0;i<4;i++)[...timers].forEach(fn=>fn());assert.equal(creations,0,page);
 }
});
test('legacy Budget extension still reaches installation on the principal budget page',()=>{
 const doc={body:{},readyState:'complete',getElementById:id=>id==='page-budget'?{}:null,createElement(){throw Error('Principal installation reached');}};
 const frame={contentDocument:doc,contentWindow:{},addEventListener(){}};
 const ctx=vm.createContext({document:{getElementById:()=>frame},window:{addEventListener(){}},setTimeout:fn=>fn(),setInterval:fn=>fn(),clearInterval(){}});
 assert.throws(()=>vm.runInContext(read('budget-drilldown.js'),ctx),/Principal installation reached/);
});
test('embedded signout belongs to the existing shell; standalone and unrelated frames retain their own',()=>{
 const ctx=vm.createContext({window:{addEventListener(){}}});vm.runInContext(read('auth-ui.js'),ctx);
 const check=()=>vm.runInContext('shellOwnsSignOut()',ctx);
 assert.equal(check(),false);
 ctx.window.frameElement={id:'core'};ctx.window.parent={document:{getElementById:()=>({})}};assert.equal(check(),true);
 ctx.window.frameElement={id:'other'};assert.equal(check(),false);
 ctx.window.frameElement={id:'core'};ctx.window.parent={document:{getElementById:()=>null}};assert.equal(check(),false);
 ctx.window.parent={get document(){throw Error('Cross origin');}};assert.equal(check(),false);
});
test('Clerk updates preserve the verification form until sign-in completes',async()=>{
 let listener,mounts=0,unmounts=0;
 const mount={innerHTML:''},state={},gate={style:{}},button={remove(){}};
 const elements={mcClerkMount:mount,mcAuthState:state,mcAuthGate:gate,mcSignOut:button};
 const clerk={isSignedIn:false,load:async()=>{},mountSignIn(){mounts++;mount.innerHTML='email-code-entry';},unmountSignIn(){unmounts++;},addListener(fn){listener=fn;}};
 const ctx=vm.createContext({window:{Clerk:clerk,addEventListener(){},dispatchEvent(){}},document:{getElementById:id=>elements[id]||null,createElement:()=>({setAttribute(){}}),head:{appendChild:s=>s.onload()}},fetch:async()=>({json:async()=>({ok:true,publishableKey:'pk_test_domain'})}),atob:()=> 'auth.example$',CustomEvent:class{},console});
 vm.runInContext(read('auth-ui.js'),ctx);await vm.runInContext('bootMissionControlAuth()',ctx);
 listener();listener();assert.equal(mounts,1);assert.equal(mount.innerHTML,'email-code-entry');
 clerk.isSignedIn=true;listener();assert.equal(unmounts,1);assert.equal(mount.innerHTML,'');
 clerk.isSignedIn=false;listener();assert.equal(mounts,2);
});
