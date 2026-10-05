import {assessMemberReadiness} from '../scripts/member-readiness.mjs';
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import vm from "node:vm";
import {test} from "node:test";
import {createAppsScriptHarness, projectHeaders, projectRow} from "./helpers/apps-script-harness.js";
import {stageAppsScript} from "../scripts/stage-apps-script.mjs";
import {authorize} from "./authorization.js";
import {requireMissionControlOrigin} from "./origin.js";
import {readUpstreamDiagnostics, deploymentDiagnostics, sanitizeDiagnostics} from "./diagnostics.js";

const sha = "a".repeat(40);
const canonical = fs.readFileSync(new URL("../google_apps_script_Code.gs", import.meta.url), "utf8");
const userHeaders = ["userId","status","displayName","identityProvider","providerSubject","email","createdAt","updatedAt","notes"];
const householdHeaders = ["householdId","status","name","createdAt","updatedAt","notes"];
const membershipHeaders = ["membershipId","householdId","userId","role","status","createdAt","updatedAt","notes"];
const request = {token:"offline-service-token", resource:"system_diagnostics", operation:"read", actor:"u1", householdId:"butler-household"};
function setup({role = "principal", status = "active", source = stageAppsScript(canonical, sha)} = {}) {
  const h = createAppsScriptHarness({source});
  h.sheet("Users", [userHeaders, ["u1","active","private-name","clerk","private-subject","private-email","","","private-notes"],
    ["u2","active","foreign-name","clerk","foreign-subject","foreign-email","","",""]]);
  h.sheet("Households", [householdHeaders, ["butler-household","active","private-household","","",""], ["foreign","active","foreign-name","","",""]]);
  h.sheet("Household Memberships", [membershipHeaders, ["m1","butler-household","u1",role,status,"","",""], ["m2","foreign","u2","principal","active","","",""]]);
  h.sheet("Project Resources", [projectHeaders, projectRow({id:"commission-project-gateway-001", lifecycle:"archived", raw:{archived:true,completed:false,deleted:false}}),
    projectRow({id:"foreign-secret", householdId:"foreign"})]);
  const headers = canonical.match(/const HEADERS = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map(x=>x.slice(1,-1));
  h.sheet("Projects", [headers, ["legacy-1","private-project-name"]]);
  return h;
}
function report(h) { const r = h.post(request); assert.equal(r.ok,true); return r.diagnostics; }
function assertNoWrites(h) { assert.deepEqual(h.events.filter(e => ["write","written","append","insert","flush"].includes(e.type)), []); assert.equal(h.held,false); }

test("release staging stamps exact SHA and canonical digest without editing canonical source", () => {
  const staged = stageAppsScript(canonical, sha);
  assert.ok(staged.includes(`const MC_SOURCE_SHA = '${sha}';`));
  assert.ok(staged.includes(crypto.createHash("sha256").update(canonical).digest("hex")));
  assert.ok(canonical.includes("const MC_SOURCE_SHA = 'unversioned';"));
  assert.throws(()=>stageAppsScript(canonical,"short"));
  assert.throws(()=>stageAppsScript(staged,sha));
  assert.throws(()=>stageAppsScript(canonical+"\nconst MC_SOURCE_SHA = 'unversioned';",sha));
});
test("diagnostics executes canonical backend, is tenant scoped, and never initializes missing tabs", () => {
  const h=setup(), r=report(h);
  assert.equal(r.source.gitSha,sha); assert.equal(r.source.immutableVersion,null);
  assert.equal(r.sheets.projectResources.recordCount,1); assert.equal(r.identity.activeUsers,1);
  assert.equal(r.fixture.version,7); assert.equal(r.fixture.lifecycleCoherent,true);
  assert.equal(r.sheets.projectOperationAudit.present,false); assert.deepEqual(h.rows("Project Operation Audit"),[]);
  assert.equal(r.identity.invitationCount,null);
  for(const value of ["private-subject","private-email","private-notes","private-project-name","foreign-secret","offline-service-token"]) assert.ok(!JSON.stringify(r).includes(value));
  assertNoWrites(h);
});
test("both feature gates are observed independently; neither is enabled by diagnostics", () => {
  const h=setup(); h.properties.set("PROJECT_V1_TRUSTED_DISPATCH","disabled");
  assert.equal(report(h).gates.projectV1TrustedDispatch,false);
  assert.equal(deploymentDiagnostics({MC_PROJECT_V1_DISPATCH:"enabled"}).projectV1Dispatch,true);
  assert.equal(deploymentDiagnostics({MC_PROJECT_V1_DISPATCH:"true"}).projectV1Dispatch,false);
  assert.equal(h.properties.get("PROJECT_V1_TRUSTED_DISPATCH"),"disabled"); assertNoWrites(h);
});
test("service token, role, revocation, foreign household and authority extras fail closed", () => {
  for(const body of [{...request,token:"wrong"},{...request,householdId:"foreign"},{...request,actor:"u2"},
    {...request,operation:"write"},{...request,patch:{}},{...request,actorUserId:"u2"}]) {
    const h=setup(); assert.equal(h.post(body).ok,false); assertNoWrites(h);
  }
  for(const opts of [{role:"secondary"},{role:"extended"},{status:"revoked"}]) {
    const h=setup(opts); assert.equal(h.post(request).ok,false); assertNoWrites(h);
  }
});
test("missing or invalid schemas remain untouched and are reported unverified", () => {
  const h=setup(); h.sheet("Project Resources", [["bad header"],["x","butler-household"]]);
  const before=h.rows("Project Resources"),r=report(h);
  assert.equal(r.sheets.projectResources.headersValid,false); assert.equal(r.sheets.projectResources.recordCount,null);
  assert.deepEqual(h.rows("Project Resources"),before); assertNoWrites(h);
  h.sheet("Users", [["bad header"]]); assert.equal(h.post(request).ok,false); assertNoWrites(h);
});
test("duplicate fixture IDs including foreign collisions do not return an arbitrary fixture", () => {
  const h=setup(); h.sheet("Project Resources", [projectHeaders,projectRow({id:"commission-project-gateway-001"}),
    projectRow({id:"commission-project-gateway-001",householdId:"foreign"})]);
  const r=report(h); assert.equal(r.fixture.unique,false); assert.equal(r.fixture.version,null);
  assert.equal(r.sheets.projectResources.duplicateIdCount,1); assertNoWrites(h);
});
test("a second household principal gets its own records and no Butler legacy summary", () => {
  const h=setup(); const r=h.post({...request,actor:"u2",householdId:"foreign"}).diagnostics;
  assert.equal(r.identity.activeUsers,1); assert.equal(r.sheets.projectResources.recordCount,1);
  assert.equal(r.sheets.legacyProjects.applicable,false); assert.equal(r.sheets.legacyProjects.fingerprint,null);
  assert.equal(r.fixture.present,false); assertNoWrites(h);
});
test("legacy fingerprints detect content changes without returning project contents", () => {
  const h=setup(), first=report(h);
  const rows=h.rows("Projects"); rows[1][1]="changed-private-name"; h.sheet("Projects",rows);
  const second=report(h);
  assert.notEqual(first.sheets.legacyProjects.fingerprint,second.sheets.legacyProjects.fingerprint);
  assert.equal(second.sheets.legacyProjects.recordCount,1); assertNoWrites(h);
});
test("malformed lifecycle flags and JSON do not claim fixture coherence", () => {
  const h=setup();
  h.sheet("Project Resources",[projectHeaders,projectRow({id:"commission-project-gateway-001",raw:{completed:"false",archived:false,deleted:false}})]);
  assert.equal(report(h).fixture.lifecycleCoherent,false);
  const rows=h.rows("Project Resources");rows[1][14]="malformed JSON";h.sheet("Project Resources",rows);
  assert.equal(report(h).fixture.lifecycleCoherent,null);assertNoWrites(h);
});
test("fixture audit is bounded and excludes result text, actor and notes", () => {
  const h=setup();
  const headers=["operationId","timestamp","householdId","actorUserId","operation","projectId","expectedVersion","previousVersion","newVersion","status","result","notes"];
  h.sheet("Project Operation Audit",[headers,...Array.from({length:12},(_,i)=>["ui_"+"a".repeat(36),"","butler-household","secret-actor","update_project","commission-project-gateway-001",i+1,i+1,i+2,"SUCCESS","secret-result","secret-notes"])]);
  const r=report(h); assert.equal(r.recentFixtureOperations.length,10); assert.equal(r.sheets.projectOperationAudit.recordCount,12);
  assert.ok(!JSON.stringify(r).includes("secret-")); assertNoWrites(h);
});

function routeSetup(t,{role="principal", authenticated=true, upstream}={}) {
  const keys=["MC_AUTHORIZED_PARTIES","MC_SYNC_URL","MC_SYNC_TOKEN","VERCEL_GIT_COMMIT_SHA","VERCEL_ENV"];
  const prior=Object.fromEntries(keys.map(k=>[k,process.env[k]])), originalFetch=globalThis.fetch;
  Object.assign(process.env,{MC_AUTHORIZED_PARTIES:"https://offline.invalid",MC_SYNC_URL:"https://offline.invalid/exec",MC_SYNC_TOKEN:"offline-service-token",VERCEL_GIT_COMMIT_SHA:sha,VERCEL_ENV:"production"});
  t.after(()=>{ for(const k of keys) if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k];globalThis.fetch=originalFetch; });
  const h=setup({role}),calls=[];
  globalThis.fetch=async (_url,opts)=>{const body=JSON.parse(opts.body);calls.push(body);return upstream ? upstream(body,h) : new Response(JSON.stringify(h.post(body)));};
  const source=fs.readFileSync(new URL("../api/v1/diagnostics.js",import.meta.url),"utf8").replace(/^import .*;\n/gm,"").replace("export default async function handler","globalThis.handler = async function handler");
  const context=vm.createContext({Set,requireMissionControlOrigin,installClerkIdentityAdapter(){},installUpstreamDirectoryAdapter(){},
    requireVerifiedIdentity:async()=>{if(!authenticated)throw Object.assign(new Error("private-identity"),{statusCode:401,code:"UNAUTHENTICATED"});return {provider:"offline",subject:"offline-subject"};},
    resolveAccessContext:async(_identity,householdId)=>({user:{userId:"u1",status:"active"},household:{householdId:"butler-household",status:householdId==="butler-household"?"active":"inactive"},membership:{userId:"u1",householdId:"butler-household",role,status:"active"}}),
    authorize,readUpstreamDiagnostics,deploymentDiagnostics});
  vm.runInContext(source,context);
  async function post(body={householdId:"butler-household"},{method="POST",origin="https://offline.invalid"}={}) {
    let status=200,data;const headers={};
    await context.handler({method,body,headers:{origin,"sec-fetch-site":"same-origin"}},{setHeader(k,v){headers[k]=v;},status(s){status=s;return this;},json(d){data=d;return this;}});
    return {status,data,headers};
  }
  return {h,post,calls};
}
test("principal route runs real adapter/backend, uses server authority and reports matched source", async t=>{
  const {h,post,calls}=routeSetup(t),r=await post();
  assert.equal(r.status,200); assert.equal(r.headers["Cache-Control"],"no-store");
  assert.equal(r.data.verification.sourceMatch,true); assert.equal(r.data.verification.commissioningComplete,false);
  assert.equal(calls[0].actor,"u1"); assertNoWrites(h);
});
test("anonymous and secondary access fails before diagnostics upstream", async t=>{
  for(const opts of [{authenticated:false},{role:"secondary"},{role:"extended"}]) {
    await t.test(JSON.stringify(opts),async t=>{const f=routeSetup(t,opts),r=await f.post();assert.ok([401,403].includes(r.status));assert.equal(f.calls.length,0);assertNoWrites(f.h);});
  }
});
test("origin, method, wrong household, malformed JSON and authority smuggling are denied", async t=>{
  const f=routeSetup(t);
  for(const [body,opts] of [[{householdId:"butler-household"},{origin:"https://evil.invalid"}],
    [{householdId:"butler-household"},{method:"GET"}], [{householdId:"foreign"},{}], ["broken",{}],
    [[],{}],[{householdId:"butler-household",actor:"u2"},{}],[{householdId:"butler-household",operation:"write"},{}]]) {
    assert.ok((await f.post(body,opts)).status>=400);
  }
  assert.equal(f.calls.length,0);assertNoWrites(f.h);
});
test("old, malformed, failed and secret-bearing upstream errors return safe failures", async t=>{
  for(const upstream of [()=>new Response('null'),()=>new Response('not JSON'),()=>new Response('{"ok":true}'),
    ()=>new Response('{"ok":false,"error":"private-sync-secret"}'),()=>new Response('private-error',{status:500}),()=>{throw new Error("private-network-secret");},
    ()=>({ok:true,text:async()=>{throw new Error("private-body-secret");}})]) {
    await t.test("unusable backend",async t=>{const f=routeSetup(t,{upstream}),r=await f.post();assert.equal(r.status,502);assert.ok(!JSON.stringify(r.data).includes("private-"));});
  }
});
test("source mismatch is reported rather than silently accepted",async t=>{
  const f=routeSetup(t,{upstream:(body,h)=>{const response=h.post(body);response.diagnostics.source.gitSha="b".repeat(40);return new Response(JSON.stringify(response));}});
  const r=await f.post();assert.equal(r.status,200);assert.equal(r.data.verification.sourceMatch,false);
  assert.equal(r.data.verification.immutableVersionVerified,false);assert.equal(r.data.verification.commissioningComplete,false);
});
test("backend rechecks membership after Vercel resolution", async t=>{
  const f=routeSetup(t,{upstream:(_body,h)=>{h.sheet("Household Memberships",[membershipHeaders,["m1","butler-household","u1","principal","revoked","","",""]]);return new Response(JSON.stringify(h.post(request)));}});
  assert.equal((await f.post()).status,403);assertNoWrites(f.h);
});
test("response projection strips unknown fields and local build identity remains unverified",()=>{
  const r=report(setup()); r.secret="private";r.source.secret="private";r.fixture.secret="private";
  assert.ok(!JSON.stringify(sanitizeDiagnostics(r)).includes("private"));
  assert.equal(report(setup({source:canonical})).source.gitSha,"unversioned");
  assert.equal(deploymentDiagnostics({CLERK_PUBLISHABLE_KEY:"pk_test_private",CLERK_SECRET_KEY:"sk_live_private"}).clerkSecretKeyMode,"production");
  assert.ok(!JSON.stringify(deploymentDiagnostics({CLERK_SECRET_KEY:"sk_live_private"})).includes("private"));
});
test('member gates are observed independently; older backends remain unverified',()=>{
 const h=setup();h.properties.set('MEMBER_SETUP','enabled');h.properties.set('MEMBER_DASHBOARD','disabled');const raw=report(h),safe=sanitizeDiagnostics(raw);assert.equal(safe.gates.memberSetup,true);assert.equal(safe.gates.memberDashboard,false);delete raw.gates.memberSetup;delete raw.gates.memberDashboard;const old=sanitizeDiagnostics(raw);assert.equal(old.gates.memberSetup,null);assert.equal(old.gates.memberDashboard,null);assert.equal(deploymentDiagnostics({MC_MEMBER_SETUP:'enabled'}).memberSetup,true);assert.equal(deploymentDiagnostics({MC_MEMBER_DASHBOARD:'true'}).memberDashboard,false);assertNoWrites(h);
});

function readinessExport(){
 const backend=report(setup());backend.checkedAt='2026-10-05T00:00:00.000Z';
 return {ok:true,evidenceClass:'authenticated-read-only-runtime-snapshot',backend,
  vercel:{gitSha:'b'.repeat(40),environment:'production',memberSetup:true,memberDashboard:true,memberMealsEdit:true,clerkPublishableKeyMode:'production',clerkSecretKeyMode:'production'}};
}
const readinessOptions={readSource:()=>canonical,now:Date.parse('2026-10-05T00:01:00Z')};
const readinessState=(result,check)=>result.checks.find(row=>row.check===check).state;
test('readiness compares canonical content across different commit SHAs without claiming runtime acceptance',()=>{
 const result=assessMemberReadiness(readinessExport(),readinessOptions);
 assert.equal(result.sameCommit,false);assert.equal(readinessState(result,'Apps Script content agrees with Vercel source'),'PASS');
 assert.equal(result.julieReady,false);assert.equal(result.memberCommissioningComplete,false);assert.equal(result.immutableVersionVerified,false);
});
test('readiness detects forged digest and changed backend source',()=>{
 const input=readinessExport();input.backend.source.canonicalSha256='f'.repeat(64);
 assert.equal(readinessState(assessMemberReadiness(input,readinessOptions),'Backend source digest'),'FAIL');
 const changed=assessMemberReadiness(readinessExport(),{...readinessOptions,readSource:ref=>ref===sha?canonical:canonical+'changed'});
 assert.equal(readinessState(changed,'Apps Script content agrees with Vercel source'),'FAIL');
});
test('readiness refuses stale and future snapshots as current evidence',()=>{
 for(const now of ['2026-10-05T00:16:00Z','2026-10-04T23:58:00Z'])assert.equal(readinessState(assessMemberReadiness(readinessExport(),{...readinessOptions,now:Date.parse(now)}),'Snapshot freshness'),'PENDING');
});
test('readiness requires each literal true gate on both services',()=>{
 for(const gate of ['memberSetup','memberDashboard','memberMealsEdit'])for(const layer of ['vercel','backend']){
  const input=readinessExport();for(const name of ['memberSetup','memberDashboard','memberMealsEdit'])input.backend.gates[name]=true;
  if(layer==='vercel')input.vercel[gate]='enabled';else input.backend.gates[gate]=false;
  assert.equal(readinessState(assessMemberReadiness(input,readinessOptions),`Both ${gate} gates enabled`),'PENDING');
 }
});
test('readiness never forwards extra sensitive export fields and fails malformed exports',()=>{
 const input=readinessExport();input.token='private-secret';input.backend.secret='private-secret';
 assert.ok(!JSON.stringify(assessMemberReadiness(input,readinessOptions)).includes('private-secret'));
 for(const value of [null,{}, {...input,evidenceClass:'mock'}, {...input,vercel:{gitSha:'invalid'}}])assert.throws(()=>assessMemberReadiness(value,readinessOptions));
});
test('readiness keeps preview and development Clerk credentials pending',()=>{
 const input=readinessExport();input.vercel.environment='preview';input.vercel.clerkSecretKeyMode='development';
 const result=assessMemberReadiness(input,readinessOptions);
 assert.equal(readinessState(result,'Production Vercel artifact'),'PENDING');assert.equal(readinessState(result,'Production Clerk credentials'),'PENDING');
});
