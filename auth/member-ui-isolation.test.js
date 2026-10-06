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
