import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {setupDefaults,validateSetupPreferences} from './member-setup.js';
function browser(transport){
 class Element{
  constructor(){this.children=[];this.textContent='';this.hidden=false;this.disabled=false;this.value='';}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(){this.children=[];this.textContent='';}
  focus(){}
  querySelectorAll(){return this.children.flatMap(node=>node.children||[]).filter(node=>node.type==='checkbox'&&node.checked);}
 }
 const elements=Object.fromEntries(['next','back','retry','heading','content','progress','message'].map(id=>[id,new Element()]));
 const events=new Map(),documentEvents=new Map(),intervals=[],calls=[];
 const clerk={isSignedIn:true,user:{id:'offline-user'},session:{id:'offline-session'},listeners:[],addListener(fn){this.listeners.push(fn);}};
 const context=vm.createContext({window:{Clerk:clerk,addEventListener:(name,fn)=>events.set(name,fn)},document:{hidden:false,getElementById:id=>elements[id],createElement:()=>new Element(),createTextNode:text=>({textContent:text}),addEventListener:(name,fn)=>documentEvents.set(name,fn)},setInterval:fn=>intervals.push(fn),setupDefaults,validateSetupPreferences,structuredClone,fetch:async(_url,options)=>{const body=JSON.parse(options.body);calls.push(body);return transport(body);}});
 const source=fs.readFileSync(new URL('../member-setup-ui.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');vm.runInContext(source,context);
 const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
 return{elements,events,documentEvents,intervals,clerk,calls,settle,authenticate:()=>events.get('mc-authenticated')()};
}
const response=profile=>new Response(JSON.stringify({ok:true,profile}));
const profile=(version=0,step=0)=>({version,preferences:{...setupDefaults(),step},status:version===0?'not_started':step===6?'preferences_saved':'in_progress'});
test('saved progress resumes and successful Continue persists the next step',async()=>{
 let saved=profile(2,1);const f=browser(body=>{if(body.operation==='save')saved={version:body.expectedVersion+1,preferences:body.preferences,status:'in_progress'};return response(saved);});f.authenticate();await f.settle();assert.equal(f.elements.heading.textContent,'Choose your calendars');f.elements.next.onclick();await f.settle();assert.equal(f.elements.heading.textContent,'Choose your email accounts');assert.equal(f.calls[1].expectedVersion,2);assert.equal(f.calls[1].preferences.step,2);
});
test('unknown save blocks resend and readback confirms the committed next step',async()=>{
 let saved=profile(),lose=true;const f=browser(body=>{if(body.operation==='save'){saved={version:1,preferences:body.preferences,status:'in_progress'};if(lose){lose=false;throw Error('offline response loss');}}return response(saved);});f.authenticate();await f.settle();f.elements.next.onclick();await f.settle();assert.equal(f.elements.next.hidden,true);assert.equal(f.elements.retry.hidden,false);assert.match(f.elements.message.textContent,/not resend/);f.elements.next.onclick();await f.settle();assert.equal(f.calls.filter(b=>b.operation==='save').length,1);f.elements.retry.onclick();await f.settle();assert.equal(f.elements.heading.textContent,'Choose your calendars');assert.match(f.elements.message.textContent,/previous save is confirmed/);
});
test('a stale conflict requires readback and cannot keep saving on old baseline',async()=>{
 const f=browser(body=>body.operation==='save'?new Response(JSON.stringify({ok:false,code:'MEMBER_SETUP_CONFLICT'}),{status:409}):response(profile()));f.authenticate();await f.settle();f.elements.next.onclick();await f.settle();assert.equal(f.elements.next.hidden,true);assert.match(f.elements.message.textContent,/changed elsewhere/);f.elements.next.onclick();await f.settle();assert.equal(f.calls.filter(b=>b.operation==='save').length,1);
});
test('late old-account and signed-out responses cannot render saved preferences',async()=>{
 const pending=[];const f=browser(()=>new Promise(resolve=>pending.push(resolve)));f.authenticate();await f.settle();f.clerk.user={id:'other'};f.clerk.session={id:'other-session'};f.clerk.listeners[0]();await f.settle();pending[1](response(profile(2,2)));await f.settle();assert.equal(f.elements.heading.textContent,'Choose your email accounts');pending[0](response(profile(6,6)));await f.settle();assert.equal(f.elements.heading.textContent,'Choose your email accounts');f.clerk.isSignedIn=false;f.events.get('mc-signed-out')();assert.equal(f.elements.content.children.length,0);assert.equal(f.elements.heading.textContent,'Sign in to continue.');
});
test('visible-session revalidation clears previously displayed setup after revocation',async()=>{
 let revoked=false;const f=browser(()=>revoked?new Response(JSON.stringify({ok:false,code:'MEMBER_SETUP_FORBIDDEN'}),{status:403}):response(profile(2,1)));f.authenticate();await f.settle();revoked=true;f.intervals[0]();await f.settle();assert.equal(f.elements.content.children.length,0);assert.equal(f.elements.next.hidden,true);assert.match(f.elements.heading.textContent,/access needs/);
});
