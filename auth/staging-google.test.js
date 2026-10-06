import test from 'node:test';
import assert from 'node:assert/strict';
import {checkStagingGoogle} from '../scripts/check-staging-google.mjs';

const id='18eft4EyxSy1lCtydd5dwuu20iMiJOBV0AAiHq4gu05Y';
function fixture({title='Mission Control - Staging Test Data',version=13,status=200}={}) {
  const calls=[];
  const meals={householdId:'butler-household',version,approved:{days:[{meal:'TEST Soup'},...Array(6).fill({meal:'TEST meal'})],groceryList:[{item:'TEST apples',qty:'6',done:true}]},draft:{sentinel:'KEEP DRAFT'},mealHistory:['KEEP HISTORY'],rules:{sentinel:'KEEP RULES'}};
  const values=[['key','householdId','schemaVersion','updatedAt','updatedBy','status','json','notes'],['staging-neighbor','staging-neighbor',1,'','','approved',JSON.stringify({householdId:'staging-neighbor',version:9}),'KEEP NEIGHBOR'],[],['butler-household','butler-household',1,'','PRIVATE ACTOR','approved',JSON.stringify(meals),'KEEP FIXTURE NOTES']];
  return {calls,request:async(url,options)=>{calls.push({url,options});return {ok:status===200,status,json:async()=>url.includes('/values/')?{values}:{spreadsheetId:id,properties:{title}}};}};
}
test('Google checkpoint reads only fixed staging workbook and reports no personal rows',async()=>{
  const f=fixture(),report=await checkStagingGoogle({token:'PRIVATE TOKEN',request:f.request});
  assert.equal(report.pass,true);assert.equal(report.writesRequested,0);assert.equal(f.calls.length,2);
  assert.ok(f.calls.every(c=>c.options.method==='GET'&&c.url.startsWith('https://sheets.googleapis.com/v4/spreadsheets/'+id)));
  assert.ok(!JSON.stringify(report).includes('PRIVATE'));
});
test('Google checkpoint stops on wrong workbook and sanitizes denied reads',async()=>{
  const wrong=fixture({title:'Production'});await assert.rejects(checkStagingGoogle({token:'x',request:wrong.request}),/identity does not match/);assert.equal(wrong.calls.length,1);
  await assert.rejects(checkStagingGoogle({token:'x',request:fixture({status:403}).request}),/HTTP 403/);
  const missing=fixture();await assert.rejects(checkStagingGoogle({request:missing.request}),/Missing/);assert.equal(missing.calls.length,0);
});
test('Google checkpoint reports fixture mismatch without declaring acceptance',async()=>{
  const report=await checkStagingGoogle({token:'x',request:fixture({version:14}).request});
  assert.equal(report.pass,false);assert.equal(report.checks.version13,false);assert.equal(report.julieReady,false);
});
