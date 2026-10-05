import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {validateMemberMealEdit} from './member-meals-edit.js';
function browser(transport){
 class Element{constructor(){this.children=[];this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.textContent='';}append(...nodes){this.children.push(...nodes);}replaceChildren(){this.children=[];}focus(){}querySelector(selector){const name=selector.match(/name=(\w+)/)[1];return this.find(name);}find(name){if(this.name===name)return this;for(const child of this.children){const found=child.find?.(name);if(found)return found;}return null;}}
 const ids=['mealEditor','mealEditRows','mealEditShared','mealEditMessage','mealEditTitle','mealEditReviewLabel','mealEditReviewed','mealEditAdd','mealEditSave','mealEditCancel'];const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));const calls=[],messages=[];let refreshes=0;
 const ctx=vm.createContext({document:{getElementById:id=>elements[id],createElement:()=>new Element()},window:{confirm:()=>true},validateMemberMealEdit,structuredClone,AbortSignal,fetch:async(_url,options)=>{const body=JSON.parse(options.body);calls.push(body);return transport(body);}});
 vm.runInContext(fs.readFileSync(new URL('../member-meals-editor.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function createMemberMealsEditor','globalThis.createMemberMealsEditor = function createMemberMealsEditor'),ctx);
 const editor=ctx.createMemberMealsEditor({refresh:async()=>{refreshes++;},status:message=>messages.push(message)}),root=new Element();const meals={version:7,days:[{date:'2026-10-05',meal:'Soup',prep:''}],groceryList:[{item:'Bread',qty:'1',done:false}]};editor.actions(root,{meals,capabilities:{mealsEdit:true}});root.children[1].onclick();return{editor,elements,calls,messages,meals,get refreshes(){return refreshes;}};
}
const result=(version,rows)=>({meals:{version,groceryList:rows},capabilities:{mealsEdit:true}});
test('lost response blocks automatic resend and confirms exact version/content through readback',async()=>{
 const f=browser(()=>{throw Error('response lost');});f.elements.mealEditRows.children[0].querySelector('[name=item]').value='Milk';await f.elements.mealEditSave.onclick();assert.equal(f.refreshes,1);assert.equal(f.elements.mealEditSave.disabled,true);await f.elements.mealEditSave.onclick();assert.equal(f.calls.length,1);f.editor.readback(result(8,f.calls[0].rows));assert.equal(f.elements.mealEditor.hidden,true);assert.match(f.messages[0],/confirmed/);
});
test('failed readback cannot unlock Save through the review control',async()=>{
 const f=browser(()=>new Response('bad body'));await f.elements.mealEditSave.onclick();f.elements.mealEditReviewed.checked=true;f.elements.mealEditReviewed.onchange();assert.equal(f.elements.mealEditSave.disabled,true);await f.elements.mealEditSave.onclick();assert.equal(f.calls.length,1);
});
test('conflict requires verified shared readback and explicit comparison before a new versioned save',async()=>{
 const f=browser(()=>new Response(JSON.stringify({ok:false,code:'MEMBER_MEALS_CONFLICT'}),{status:409}));await f.elements.mealEditSave.onclick();f.editor.readback(result(8,[{item:'New shared item',qty:'2',done:false}]));assert.equal(f.elements.mealEditSave.disabled,true);assert.equal(f.elements.mealEditReviewLabel.hidden,false);f.elements.mealEditReviewed.checked=true;f.elements.mealEditReviewed.onchange();assert.equal(f.elements.mealEditSave.disabled,false);await f.elements.mealEditSave.onclick();assert.equal(f.calls.length,2);assert.equal(f.calls[1].expectedVersion,8);
});
test('reset during an in-flight save clears editor and suppresses late result/readback',async()=>{
 let complete;const f=browser(()=>new Promise(resolve=>complete=resolve));const saving=f.elements.mealEditSave.onclick();f.editor.reset();complete(new Response(JSON.stringify({ok:true,previousVersion:7,newVersion:8})));await saving;assert.equal(f.elements.mealEditor.hidden,true);assert.equal(f.elements.mealEditRows.children.length,0);assert.equal(f.refreshes,0);assert.equal(f.messages.length,0);
});
