import test from 'node:test';
import assert from 'node:assert/strict';
import {carryRecurringSnacks} from '../api/meals/plan.js';
import {projectMemberMeals} from './member-projection.js';
test('recurring snacks copy names and quantities without mutating meals or old checkmarks',()=>{
 const source={approved:{weekStart:'2026-10-05',days:[],groceryList:[{item:'Dinner ingredient'}],snacksList:[{item:'Crackers',qty:'2 boxes',done:true,private:'not projected'}]}};
 const before=structuredClone(source),next=carryRecurringSnacks(source,'2026-10-12');assert.deepEqual(next,[{item:'Crackers',qty:'2 boxes',done:false}]);assert.deepEqual(source,before);
 const projected=projectMemberMeals({...source,householdId:'home',version:7},'home');assert.deepEqual(projected.snacksList,[{item:'Crackers',qty:'2 boxes',done:true}]);
});
test('latest draft wins; same week retains checkmarks; explicit empty list remains empty',()=>{
 const meals={approved:{weekStart:'2026-10-05',snacksList:[{item:'Old',qty:'1',done:true}]},draft:{weekStart:'2026-10-12',snacksList:[{item:'New',qty:'3',done:true}]}};
 assert.deepEqual(carryRecurringSnacks(meals,'2026-10-19'),[{item:'New',qty:'3',done:false}]);assert.equal(carryRecurringSnacks(meals,'2026-10-12')[0].done,true);meals.draft.snacksList=[];assert.deepEqual(carryRecurringSnacks(meals,'2026-10-19'),[]);assert.deepEqual(carryRecurringSnacks({},'2026-10-19'),[]);
});
