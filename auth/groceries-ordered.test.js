import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../app-v5.html',import.meta.url),'utf8');const source=html.slice(html.indexOf('let groceriesOrdering='),html.indexOf('function addSnack(){'));
function principal({marker=true,lost=false,cancel=false}={}){
 const calls=[],messages=[],reviews=[];const before={version:2,draft:{weekStart:'2026-10-12',days:[{meal:'Shared dinner'}],groceryList:[{item:'Milk',qty:'1',done:true}],snacksList:[{item:'Crackers',qty:'2',done:true}]}};
 const state={meals:structuredClone(before.draft)};state.meals.days[0].meal='Unsaved dinner';const after=structuredClone(before);after.version=3;after.draft.groceryList=[];after.draft.snacksList[0].done=false;if(marker)after.draft.groceriesOrderedVersion=3;
 const ctx=vm.createContext({window:{},state,mealsDurable:before,storageKey:()=> 'principal',AbortSignal,confirm:()=>!cancel,document:{getElementById:()=>({disabled:false})},toast:m=>messages.push(m),showMealReviewAction:e=>reviews.push(e.message),persistPrivateState(){},renderMeals(){},fetch:async(url,options)=>{calls.push({url,options});if(url==='/api/v1/member'){if(lost)throw Error('lost response');return new Response(JSON.stringify({ok:true,previousVersion:2,newVersion:3}));}return new Response(JSON.stringify({ok:true,meals:after}));}});vm.runInContext(source,ctx);return{ctx,state,calls,messages,reviews};
}
test('principal reset confirms both lists, including lost acknowledgements, without replacing local dinner edits',async()=>{
 for(const lost of [false,true]){const f=principal({lost});assert.equal(await f.ctx.groceriesOrdered(),true);assert.equal(f.calls.filter(c=>c.url==='/api/v1/member').length,1);const request=JSON.parse(f.calls[0].options.body);assert.equal(request.operation,'order_draft_groceries');assert.equal(request.expectedVersion,2);assert.deepEqual(request.rows,[]);assert.equal(f.state.meals.groceryList.length,0);assert.equal(f.state.meals.snacksList[0].item,'Crackers');assert.equal(f.state.meals.snacksList[0].qty,'2');assert.equal(f.state.meals.snacksList[0].done,false);assert.equal(f.state.meals.days[0].meal,'Unsaved dinner');assert.equal(f.ctx.mealsDurable.version,3);assert.equal(f.reviews.length,0);}
});
test('a different writer advancing the version cannot confirm a reset without its marker',async()=>{
 const f=principal({marker:false});assert.equal(await f.ctx.groceriesOrdered(),false);assert.equal(f.state.meals.groceryList.length,1);assert.equal(f.state.meals.snacksList[0].done,true);assert.equal(f.ctx.mealsDurable.version,2);assert.equal(f.reviews.length,1);
});
test('cancelled reset makes no requests or local changes',async()=>{
 const f=principal({cancel:true});assert.equal(await f.ctx.groceriesOrdered(),false);assert.equal(f.calls.length,0);assert.equal(f.state.meals.groceryList.length,1);
});
