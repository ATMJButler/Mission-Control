import test from 'node:test';
import assert from 'node:assert/strict';
import {projectMemberBudget, projectMemberMeals, projectMemberFamily} from './member-projection.js';

test('budget exposes aggregates only; private finance and transaction details cannot escape', () => {
  const snapshot = {asOf:'2026-10-04', accounts:[{balance:12345}], debt:{secret:'PRIVATE'}, currentMonthTransactions:[{description:'PRIVATE'}], budget:{categories:[{name:'Groceries',planned:500,notes:'PRIVATE'}], regularIncome:10000}, budgetReconciliation:{categories:[{name:'Groceries',spent:200,source:'PRIVATE'}]}};
  assert.deepEqual(projectMemberBudget(snapshot), {asOf:'2026-10-04',categories:[{name:'Groceries',planned:500,spent:200,remaining:300}],planned:500,spent:200,remaining:300});
});
test('missing spend stays unknown and zero remains a real value', () => {
  const snapshot={budget:{categories:[{name:'Food',planned:0}]}};
  assert.equal(projectMemberBudget(snapshot).spent,null);
  snapshot.budgetReconciliation={categories:[{name:'Food',spent:0}]};
  assert.equal(projectMemberBudget(snapshot).spent,0);
});
test('ambiguous and invalid budget rows fail closed', () => {
  for(const categories of [[{name:'Food',planned:'500'}],[{name:'Food',planned:-1}],[{name:'Food',planned:1},{name:'Food',planned:2}],[null]]) assert.equal(projectMemberBudget({budget:{categories}}),null);
  assert.equal(projectMemberBudget({budget:{categories:[{name:'Food',planned:1}]},budgetReconciliation:{categories:[{name:'Food',spent:1},{name:'Food',spent:2}]}}),null);
});
test('meals require exact household and strip private plan metadata', () => {
  const meals={householdId:'home',draft:{private:'PRIVATE'},mealHistory:['PRIVATE'],approved:{weekStart:'2026-10-05',days:[{date:'2026-10-05',meal:'Soup',prep:'Heat',calendarConstraint:{private:'PRIVATE'}}],groceryList:[{item:'Bread',qty:'1',done:false,sourceMeal:'PRIVATE'}]}};
  assert.equal(projectMemberMeals(meals,'other'),null);
  assert.deepEqual(projectMemberMeals(meals,'home'),{weekStart:'2026-10-05',days:[{date:'2026-10-05',meal:'Soup',prep:'Heat'}],groceryList:[{item:'Bread',qty:'1',done:false}]});
  assert.equal(projectMemberMeals({...meals,approved:null},'home'),null);
});
test('family sharing is explicit, household scoped and excludes private or inactive items', () => {
  const rows=[{id:'shared',householdId:'home',scope:'household:shared',lifecycle:'active',name:'Family dinner',resourceJson:'PRIVATE'}, {id:'private',householdId:'home',scope:'private:john',lifecycle:'active',name:'Family'}, {id:'foreign',householdId:'other',scope:'household:shared',lifecycle:'active'}, {id:'deleted',householdId:'home',scope:'household:shared',lifecycle:'deleted'}];
  assert.deepEqual(projectMemberFamily(rows,'home'),[{id:'shared',name:'Family dinner',lifecycle:'active'}]);
  assert.deepEqual(projectMemberFamily([...rows,{...rows[0],scope:'private:john'}],'home'),[]);
});

test('upcoming draft projects only shared planning fields and allows the current or a later valid week',()=>{const approved={weekStart:'2026-10-05',days:[],groceryList:[]};const draft={weekStart:'2026-10-12',days:[{date:'2026-10-12',meal:'Pasta',prep:'Boil',recipe:{secret:true}}],groceryList:[],settings:{secret:true}};const raw={householdId:'home',version:7,approved,draft};assert.deepEqual(projectMemberMeals(raw,'home').draft,{weekStart:'2026-10-12',days:[{date:'2026-10-12',meal:'Pasta',prep:'Boil'}],groceryList:[]});for(const weekStart of ['2026-09-28','2026-02-30','2026-99-12'])assert.equal(projectMemberMeals({...raw,draft:{...draft,weekStart}},'home').draft,undefined);});
test('same-week working plan stays visible without a separate approval transition',()=>{
 const raw={householdId:'home',version:8,approved:{weekStart:'2026-10-12',days:[{date:'2026-10-12',meal:'Old',prep:''}],groceryList:[]},draft:{weekStart:'2026-10-12',days:[{date:'2026-10-12',meal:'Shared change',prep:''}],groceryList:[]}};assert.equal(projectMemberMeals(raw,'home').draft.days[0].meal,'Shared change');
});
