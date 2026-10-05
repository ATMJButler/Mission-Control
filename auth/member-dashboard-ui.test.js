import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const dashboard=(startView='budget')=>({profile:{preferences:{step:6,startView}},budget:{planned:500,spent:200,remaining:300,categories:[]},meals:null,family:[],sections:{budget:'available',meals:'missing',family:'available'}});
const response=value=>new Response(JSON.stringify({ok:true,dashboard:value}));
function browser(transport){
 const elements=Object.fromEntries(['panel','tabs','status','refresh'].map(id=>[id,{children:[],textContent:'',hidden:false,disabled:false,replaceChildren(){this.children=[];},querySelectorAll(){return buttons;}}]));
 const buttons=['schedule','budget','meals','family'].map(tab=>({dataset:{tab},setAttribute(k,v){this[k]=v;}}));
 const events=new Map(),documentEvents=new Map(),intervals=[],calls=[],renders=[],editorResets=[];
 const clerk={isSignedIn:true,user:{id:'u1'},session:{id:'s1'},listeners:[],addListener(fn){this.listeners.push(fn);}};
 const ctx=vm.createContext({window:{Clerk:clerk,addEventListener:(name,fn)=>events.set(name,fn)},document:{hidden:false,getElementById:id=>elements[id],addEventListener:(name,fn)=>documentEvents.set(name,fn)},createMemberMealsEditor(){return{reset(){editorResets.push(true);},actions(){},readback(){}};},renderMemberDashboard(root,data,tab){root.children=[data];renders.push({data,tab});},setInterval:fn=>intervals.push(fn),fetch:async(_url,options)=>{calls.push(JSON.parse(options.body));return transport();}});
 vm.runInContext(fs.readFileSync(new URL('../member-dashboard-ui.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''),ctx);
 const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};return{editorResets,elements,buttons,events,documentEvents,intervals,calls,renders,clerk,settle,authenticate:()=>events.get('mc-authenticated')()};
}
test('dashboard reads only projected endpoint, applies preference once and preserves selected tab on refresh',async()=>{
 const f=browser(()=>response(dashboard()));f.authenticate();await f.settle();assert.equal(f.renders[0].tab,'budget');f.buttons[2].onclick();assert.equal(f.renders.at(-1).tab,'meals');f.elements.refresh.onclick();await f.settle();assert.equal(f.renders.at(-1).tab,'meals');assert.ok(f.calls.every(body=>body.operation==='dashboard'&&Object.keys(body).length===1));
});
test('failed refresh removes stale household material and tabs',async()=>{
 let fail=false;const f=browser(()=>fail?new Response(JSON.stringify({ok:false,code:'MEMBER_DASHBOARD_FORBIDDEN'}),{status:403}):response(dashboard()));f.authenticate();await f.settle();assert.equal(f.elements.panel.children.length,1);fail=true;f.elements.refresh.onclick();await f.settle();assert.equal(f.elements.panel.children.length,0);assert.equal(f.elements.tabs.hidden,true);assert.match(f.elements.status.textContent,/could not be verified/);
});
test('old-account response cannot overwrite the new household workspace and signout clears it',async()=>{
 const pending=[];const f=browser(()=>new Promise(resolve=>pending.push(resolve)));f.authenticate();await f.settle();f.clerk.user={id:'u2'};f.clerk.session={id:'s2'};f.clerk.listeners[0]();await f.settle();pending[1](response(dashboard('meals')));await f.settle();pending[0](response(dashboard('budget')));await f.settle();assert.equal(f.renders.at(-1).tab,'meals');f.clerk.isSignedIn=false;f.events.get('mc-signed-out')();assert.equal(f.elements.panel.children.length,0);assert.equal(f.elements.tabs.hidden,true);
});
test('visible-session timer rechecks membership without writes',async()=>{
 let revoked=false;const f=browser(()=>revoked?new Response(JSON.stringify({ok:false}),{status:403}):response(dashboard()));f.authenticate();await f.settle();revoked=true;f.intervals[0]();await f.settle();assert.equal(f.elements.panel.children.length,0);assert.equal(f.calls.length,2);
});

for (const [status, code] of [[403,'MEMBERSHIP_INACTIVE_OR_MISSING'],[403,'MEMBER_SETUP_FORBIDDEN'],[403,'USER_NOT_PROVISIONED'],[401,'UNAUTHENTICATED'],[403,undefined]]) {
 test(`access denial ${status}/${code} clears the open editor on membership recheck`,async()=>{
  let denied=false;
  const f=browser(()=>denied?new Response(JSON.stringify({ok:false,code}),{status}):response(dashboard()));
  f.authenticate();await f.settle();const before=f.editorResets.length;
  denied=true;f.intervals[0]();await f.settle();
  assert.equal(f.editorResets.length,before+1);
  assert.equal(f.elements.panel.children.length,0);assert.equal(f.elements.tabs.hidden,true);
 });
}
test('transport uncertainty preserves local edits for explicit reconciliation',async()=>{
 let unavailable=false;const f=browser(()=>{if(unavailable)throw new Error('Network unavailable');return response(dashboard());});
 f.authenticate();await f.settle();const before=f.editorResets.length;
 unavailable=true;f.elements.refresh.onclick();await f.settle();
 assert.equal(f.editorResets.length,before);assert.equal(f.elements.panel.children.length,0);
});
