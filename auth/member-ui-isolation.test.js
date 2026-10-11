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
test('custom app domain uses protected sync in fresh and malformed browser storage',()=>{
 const source=read('app-v5.html');const fn=source.slice(source.indexOf('function syncConfig(){'),source.indexOf('function sourceLabel(){'));
 for(const hostname of ['app.abovethemarkos.com','mission-control-lime-tau.vercel.app']){
  for(const saved of [null,'{broken',JSON.stringify({url:'https://old.invalid',token:'obsolete',deviceLabel:'Phone'})]){
   const ctx=vm.createContext({location:{hostname},localStorage:{getItem:()=>saved},SYNC_KEY:'sync',defaultDeviceLabel:()=> 'Desktop'});
   const cfg=vm.runInContext(fn+';syncConfig()',ctx);
   assert.equal(cfg.url,'/api/sync');assert.equal(cfg.token,'server-managed');assert.equal(cfg.serverManaged,true);
  }
 }
 const ctx=vm.createContext({location:{hostname:'localhost'},localStorage:{getItem:()=>JSON.stringify({url:'http://local.invalid',token:'local'})},SYNC_KEY:'sync',defaultDeviceLabel:()=> 'Desktop'});
 assert.equal(vm.runInContext(fn+';syncConfig()',ctx).url,'http://local.invalid');
});

test('production alias offers the canonical sign-in page before loading Clerk',async()=>{
 let scripts=0;const mount={replaceChildren(link){this.link=link;}},state={};
 const ctx=vm.createContext({window:{location:{hostname:'mission-control-lime-tau.vercel.app',pathname:'/diagnostics.html'},addEventListener(){}},document:{getElementById:id=>id==='mcClerkMount'?mount:state,createElement:()=>({}),head:{appendChild(){scripts++;}}},fetch:async()=>({json:async()=>({ok:true,publishableKey:'pk_live_fixture',signInOrigin:'https://app.abovethemarkos.com'})}),console});
 vm.runInContext(read('auth-ui.js'),ctx);await vm.runInContext('bootMissionControlAuth()',ctx);
 assert.equal(scripts,0);assert.equal(mount.link.href,'https://app.abovethemarkos.com/diagnostics.html');assert.match(state.textContent,/main Mission Control website/);
});
test('canonical login hint is production-only and requires an authorized custom origin',()=>{
 for(const [environment,key,origins,expected]of [['production','pk_live_fixture','https://app.abovethemarkos.com',true],['preview','pk_live_fixture','https://app.abovethemarkos.com',false],['production','pk_test_fixture','https://app.abovethemarkos.com',false],['production','pk_live_fixture','https://other.invalid',false]]){
  const context=vm.createContext({process:{env:{VERCEL_ENV:environment,CLERK_PUBLISHABLE_KEY:key,MC_AUTHORIZED_PARTIES:origins}}});
  vm.runInContext(read('api/v1/auth-config.js').replace('export default function handler','globalThis.handler=function handler'),context);
  let body;const response={setHeader(){return this;},status(){return this;},json(value){body=value;return this;}};context.handler({method:'GET'},response);assert.equal(Boolean(body.signInOrigin),expected);
 }
});

test('session changes clear private persisted data while preserving the active account and unrelated storage',async()=>{
 const data=new Map([['missionControl.v4.user_a','private A'],['missionControl.v4.user_b','private B'],['johnMissionControl.v3','legacy private'],['missionControlV3Sync','legacy config'],['other-app','keep']]);
 const localStorage={get length(){return data.size;},key:i=>[...data.keys()][i],removeItem:key=>data.delete(key)};
 let listener;const frame={src:'app-v5.html'},mount={innerHTML:''};
 const elements={core:frame,mcClerkMount:mount,mcAuthState:{},mcAuthGate:{style:{}},mcSignOut:{remove(){}}};
 const clerk={isSignedIn:true,user:{id:'user_a'},load:async()=>{},unmountSignIn(){},mountSignIn(){},addListener(fn){listener=fn;}};
 const ctx=vm.createContext({localStorage,window:{Clerk:clerk,addEventListener(){},dispatchEvent(){}},document:{getElementById:id=>elements[id]||null,createElement:()=>({setAttribute(){}}),head:{appendChild:s=>s.onload()}},fetch:async()=>({json:async()=>({ok:true,publishableKey:'pk_test_domain'})}),atob:()=> 'auth.example$',CustomEvent:class{},console});
 vm.runInContext(read('auth-ui.js'),ctx);await vm.runInContext('bootMissionControlAuth()',ctx);
 assert.equal(data.get('missionControl.v4.user_a'),'private A');assert.equal(data.has('missionControl.v4.user_b'),false);assert.equal(data.has('johnMissionControl.v3'),false);assert.equal(data.get('other-app'),'keep');
 data.set('missionControl.v4.user_b','new B');frame.src='app-v5.html';clerk.user={id:'user_b'};listener();
 assert.equal(frame.src,'about:blank');assert.equal(data.has('missionControl.v4.user_a'),false);assert.equal(data.get('missionControl.v4.user_b'),'new B');
 clerk.isSignedIn=false;clerk.user=null;listener();assert.equal(data.has('missionControl.v4.user_b'),false);assert.equal(data.get('other-app'),'keep');
});
test('signed-out bootstrap clears all app private namespaces and only app-owned browser caches',async()=>{
 const data=new Map([['missionControl.v4.user_a','A'],['missionControl.v4.user_b','B'],['other-app','keep']]);const deleted=[];
 const caches={keys:async()=>['mission-control-v4','other-cache'],delete:async name=>deleted.push(name)};
 const ctx=vm.createContext({localStorage:{get length(){return data.size;},key:i=>[...data.keys()][i],removeItem:key=>data.delete(key)},caches,window:{caches,addEventListener(){}}});
 vm.runInContext(read('auth-ui.js'),ctx);await vm.runInContext('clearMissionControlPrivateCache()',ctx);
 assert.deepEqual([...data.keys()],['other-app']);assert.deepEqual(deleted,['mission-control-v4']);
});
test('late principal responses cannot repopulate storage after session invalidation or switch',()=>{
 const source=read('app-v5.html');const start=source.indexOf('let privateStorageOwner=');const end=source.indexOf('const STALE_DAYS=',start);const writes=[];
 const ctx=vm.createContext({window:{},storageKey:()=> 'missionControl.v4.user_a',localStorage:{setItem:(...args)=>writes.push(args)},state:{projects:['synthetic']},LEGACY_KEY:'legacy'});
 vm.runInContext(source.slice(start,end),ctx);vm.runInContext('persistPrivateState()',ctx);assert.equal(writes.length,1);
 ctx.window.mcPrivateSessionEnded=true;vm.runInContext('persistPrivateState()',ctx);assert.equal(writes.length,1);
 ctx.window.mcPrivateSessionEnded=false;ctx.storageKey=()=> 'missionControl.v4.user_b';vm.runInContext('persistPrivateState()',ctx);assert.equal(writes.length,1);
});
