import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>fs.readFileSync(new URL('../.github/workflows/'+name,import.meta.url),'utf8');
test('auth and browser CI runs for every PR and main push, including UI/workflow-only changes',()=>{const source=read('test-auth.yml');assert.ok(!/^\s+paths(?:-ignore)?:/m.test(source));assert.match(source,/pull_request:/);assert.match(source,/branches: \[main\]/);assert.match(source,/node scripts\/check-personal-browser.mjs/);});
test('staging Apps Script release cannot use the shared production credential or target',()=>{const source=read('stage-test-apps-script.yml');assert.match(source,/secrets\.STAGING_CLASPRC_JSON/);assert.doesNotMatch(source,/secrets\.CLASPRC_JSON\b/);assert.match(source,/environment: staging-apps-script/);assert.match(source,/1dxTX6HWorvrR76H6idiNH2Q4BNsRo-U2YjtADfSjoXsPwd3OrfZLzDcV/);assert.doesNotMatch(source,/1T4QgvmfHL1lo6UMZLxKAmcWaK90SPAqLAv-2MdvdAUOPgmxSU2fwJQCH/);assert.match(source,/refs\/heads\/main/);});


test('staging releases require verified owner approval and main-only environment before credential use',async()=>{
 const {checkStagingReleasePolicy}=await import('../scripts/check-staging-release-policy.mjs');
 const environment={name:'staging-apps-script',protection_rules:[{type:'required_reviewers',reviewers:[{type:'User',reviewer:{id:315165841}}]}],deployment_branch_policy:{protected_branches:false,custom_branch_policies:true}};
 const policy={branch_policies:[{name:'main',type:'branch'}]};
 const request=(env,branches)=>async url=>new Response(JSON.stringify(url.endsWith('deployment-branch-policies')?branches:env));
 assert.deepEqual(await checkStagingReleasePolicy({token:'test',request:request(environment,policy)}),{ownerReviewRequired:true,mainOnly:true,writesRequested:0});
 for(const env of [{...environment,protection_rules:[]},{...environment,deployment_branch_policy:null}])await assert.rejects(checkStagingReleasePolicy({token:'test',request:request(env,policy)}));
 await assert.rejects(checkStagingReleasePolicy({token:'test',request:request(environment,{branch_policies:[{name:'*',type:'branch'}]})}));
 const source=read('stage-test-apps-script.yml');assert.ok(source.indexOf('node scripts/check-staging-release-policy.mjs')<source.indexOf('secrets.STAGING_CLASPRC_JSON'));
});
