import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import plan from '../api/meals/plan.js';
const context=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../shared-dinner.js',import.meta.url),'utf8'),context);const {dateKey,forDate}=context.MCSharedDinner;
test('dinner uses the local date, including near UTC midnight and invalid preference fallback',()=>{
 const now=new Date('2026-10-13T00:30:00Z');assert.equal(dateKey(now,'America/Chicago'),'2026-10-12');assert.equal(dateKey(now,'invalid'),'2026-10-12');assert.equal(dateKey(now,'Asia/Tokyo'),'2026-10-13');
});
test('today uses its saved working plan rather than an old same-week dinner',()=>{
 const meals={approved:{days:[{date:'2026-10-12',meal:'Old',prep:'Old note'}]},draft:{days:[{date:'2026-10-12',meal:'New',prep:'Chop carrots'}]}};assert.equal(forDate(meals,'2026-10-12').meal,'New');assert.equal(forDate(meals,'2026-10-12').prep,'Chop carrots');meals.draft.days[0].meal='';assert.equal(forDate(meals,'2026-10-12').meal,'');
});
test('future-week plans cannot replace today; projected member and raw principal plans agree',()=>{
 const day={date:'2026-10-12',meal:'Soup',prep:'Start broth'};const raw={approved:{days:[day]},draft:{days:[{date:'2026-10-19',meal:'Future'}]}};assert.equal(forDate(raw,'2026-10-12').meal,forDate({...day,days:[day],draft:raw.draft},'2026-10-12').meal);assert.equal(forDate(raw,'2026-10-13'),null);assert.equal(forDate(null,'2026-10-12'),null);
});
test('hidden historical inventory does not remove ingredients from a new shopping list',async()=>{
 let result;const response={status(){return this;},json(value){result=value;return value;}};
 await plan({method:'POST',body:{weekStart:'2026-10-12',meals:{inventory:[{item:'frozen pizzas'},{item:'fresh fruit'}]}}},response);assert.equal(result.ok,true);for(const day of result.draft.days)for(const ingredient of day.recipe.ingredients)assert.ok(result.draft.groceryList.some(row=>row.item===ingredient),ingredient);assert.deepEqual(result.draft.inventory,[{item:'frozen pizzas'},{item:'fresh fruit'}]);
});
test('principal dinner refresh reads shared updates without overwriting local meal edits',async()=>{
 const html=fs.readFileSync(new URL('../app-v5.html',import.meta.url),'utf8');const source=html.slice(html.indexOf('let agendaMealsSnapshot;'),html.indexOf('function today(){'));
 const durable={version:3,draft:{days:[{date:'2026-10-12',meal:'Old shared'}]}};const local={meals:{days:[{meal:'Unsaved local dinner'}]}};
 const ctx=vm.createContext({window:{},storageKey:()=> 'user-a',mealsDurable:durable,state:local,AbortSignal,fetch:async()=>new Response(JSON.stringify({ok:true,meals:{version:4,draft:{days:[{date:'2026-10-12',meal:'Latest shared'}]}}}))});vm.runInContext(source,ctx);assert.equal(await ctx.refreshSharedDinner(),true);assert.equal(ctx.sharedMealSnapshot().version,4);assert.equal(local.meals.days[0].meal,'Unsaved local dinner');assert.equal(durable.version,3);
 let finish;ctx.fetch=()=>new Promise(resolve=>finish=resolve);const pending=ctx.refreshSharedDinner();ctx.window.mcPrivateSessionEnded=true;finish(new Response(JSON.stringify({ok:true,meals:{version:99}})));assert.equal(await pending,false);assert.equal(ctx.sharedMealSnapshot().version,4);
});
