import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createAppsScriptHarness} from './helpers/apps-script-harness.js';
const source=fs.readFileSync(new URL('../staging/StagingSetup.gs',import.meta.url),'utf8');
function setup({script='1dxTX6HWorvrR76H6idiNH2Q4BNsRo-U2YjtADfSjoXsPwd3OrfZLzDcV',sheet='18eft4EyxSy1lCtydd5dwuu20iMiJOBV0AAiHq4gu05Y',populated=false,initialized=false}={}){
 const h=createAppsScriptHarness(), properties=new Map(initialized?[['STAGING_INITIALIZED','true']]:[]),created=[],sheets=[];let held=false;
 const props={getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)};
 const ss={getId:()=>sheet,getSheetByName:n=>sheets.find(sh=>sh.name===n),getSheets:()=>populated?[{getLastRow:()=>1}]:sheets,insertSheet(name){created.push(name);const rows=[];const sh={name,rows,getLastRow:()=>rows.length,setFrozenRows(){},getRange(row,col,height,width){return{setValues(values){assert.equal(values.length,height);for(let y=0;y<height;y++){assert.equal(values[y].length,width);rows[row+y-1]=values[y];}}};}};sheets.push(sh);return sh;}};
 const ctx=vm.createContext({ScriptApp:{getScriptId:()=>script},SpreadsheetApp:{getActive:()=>ss,flush(){}},LockService:{getScriptLock:()=>({waitLock(){assert.equal(held,false);held=true;},releaseLock(){held=false;}})},PropertiesService:{getScriptProperties:()=>props},Utilities:{getUuid:()=> 'synthetic-test-uuid'},HEADERS:['id','name'],invitationHeaders_:()=>h.call('invitationHeaders_')});
 vm.runInContext(source,ctx);return{run:()=>ctx.initializeStagingTestData(),created,properties,sheets,h,get held(){return held;}};
}
test('staging setup refuses wrong project, wrong sheet, populated data and repeated initialization',()=>{
 for(const options of [{script:'production'},{sheet:'production'},{populated:true},{initialized:true}]){const f=setup(options);assert.throws(f.run,/STAGING_/);assert.equal(f.created.length,0);assert.equal(f.properties.size,options.initialized?1:0);assert.equal(f.held,false);}
});
test('staging setup seeds synthetic physical rows, gates off, and no real identity',()=>{
 const f=setup();assert.match(f.run(),/No identity provisioned/);assert.equal(f.held,false);
 assert.equal(f.sheets.find(s=>s.name==='Users').rows.length,1);assert.equal(f.sheets.find(s=>s.name==='Household Memberships').rows.length,1);
 for(const gate of ['MEMBER_SETUP','MEMBER_DASHBOARD','MEMBER_MEALS_EDIT','PROJECT_V1_TRUSTED_DISPATCH'])assert.equal(f.properties.get(gate),'disabled');
 assert.ok(f.properties.get('SYNC_TOKEN'));assert.throws(f.run,/STAGING_ALREADY_INITIALIZED/);
 const meals=f.sheets.find(s=>s.name==='Meals').rows;assert.equal(meals[2].every(v=>v===''),true);assert.equal(JSON.parse(meals[3][6]).version,7);
});
test('generated Meals fixture executes against canonical backend and preserves neighbor/sentinels',()=>{
 const f=setup();f.run();for(const s of f.sheets)f.h.sheet(s.name,JSON.parse(JSON.stringify(s.rows)));
 f.h.properties.set('MEMBER_MEALS_EDIT','enabled');f.h.properties.set('MEMBER_DASHBOARD','enabled');
 const users=f.h.rows('Users');users.push(['offline-user','active','TEST','offline','TEST','','','','']);f.h.sheet('Users',users);
 const members=f.h.rows('Household Memberships');members.push(['offline-membership','butler-household','offline-user','secondary','active','','','']);f.h.sheet('Household Memberships',members);
 const before=f.h.rows('Meals');const result=f.h.post({token:'offline-service-token',resource:'member_meals_edit',operation:'edit_groceries',householdId:'butler-household',actor:'offline-user',expectedVersion:7,rows:[{item:'TEST apples',qty:'3',done:true}]});
 assert.equal(result.ok,true);assert.equal(result.newVersion,8);const after=f.h.rows('Meals');assert.deepEqual(after[1],before[1]);assert.deepEqual(after[2],before[2]);const raw=JSON.parse(after[3][6]);assert.equal(raw.draft.sentinel,'KEEP DRAFT');assert.equal(raw.rules.sentinel,'KEEP RULES');assert.equal(after[3][7],'KEEP FIXTURE NOTES');
});
test('staging workflow is manual and overrides target; production workflow excludes helper',()=>{
 const staging=fs.readFileSync(new URL('../.github/workflows/stage-test-apps-script.yml',import.meta.url),'utf8');
 const production=fs.readFileSync(new URL('../.github/workflows/deploy-apps-script.yml',import.meta.url),'utf8');
 assert.match(staging,/workflow_dispatch/);assert.doesNotMatch(staging,/\n  push:/);assert.match(staging,/1dxTX6HWorvrR76H6idiNH2Q4BNsRo-U2YjtADfSjoXsPwd3OrfZLzDcV/);assert.doesNotMatch(staging,/clasp (deploy|update-deployment)/);assert.doesNotMatch(production,/StagingSetup/);
});
