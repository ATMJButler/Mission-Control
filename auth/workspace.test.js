import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {test} from "node:test";
import {authorize} from "./authorization.js";
import {requireMissionControlOrigin} from "./origin.js";
import {buildLegacyProjectEnvelope} from "./legacy-sync-envelope.js";

function route(t,path,{role="principal",signedIn=true,setupEnabled=false}={}){
  const previous=process.env.MC_AUTHORIZED_PARTIES;process.env.MC_AUTHORIZED_PARTIES="https://offline.invalid";
  t.after(()=>{if(previous===undefined)delete process.env.MC_AUTHORIZED_PARTIES;else process.env.MC_AUTHORIZED_PARTIES=previous;});
  const calls=[];let status="active";
  const context=vm.createContext({Set,process:{env:{MC_SYNC_URL:"https://offline.invalid/exec",MC_SYNC_TOKEN:"offline-secret",MC_DEFAULT_HOUSEHOLD_ID:"h1",MC_MEMBER_SETUP:setupEnabled?"enabled":""}},
    installClerkIdentityAdapter(){},installUpstreamDirectoryAdapter(){},requireMissionControlOrigin,authorize,buildLegacyProjectEnvelope,
    requireVerifiedIdentity:async()=>{if(!signedIn)throw Object.assign(new Error("private"),{statusCode:401,code:"UNAUTHENTICATED"});return{provider:"offline",subject:"never-output"};},
    resolveAccessContext:async(_identity,householdId)=>({user:{userId:"u1",status:"active",providerSubject:"never-output",email:"never-output"},
      household:{householdId,status:householdId==="h1"||householdId==="butler-household"?"active":"inactive"},membership:{userId:"u1",householdId,role,status}}),
    fetch:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({ok:true,projects:[{id:"private-principal-record",financeData:"private-account-content"}]}));}});
  const source=fs.readFileSync(new URL(path,import.meta.url),"utf8").replace(/^import .*;\n/gm,"").replace("export default async function handler","globalThis.handler = async function handler");
  vm.runInContext(source,context);
  async function request(method="POST",body={},{origin="https://offline.invalid"}={}){
    let status=200,result;const headers={};
    const response={setHeader(k,v){headers[k]=v;return this},status(v){status=v;return this},json(v){result=v;return this},send(v){result=JSON.parse(v);return this}};
    await context.handler({method,body,headers:{origin,"sec-fetch-site":"same-origin"}},response);
    return{status,result,headers};
  }
  return{calls,request,setStatus:value=>{status=value}};
}
test("legacy GET/POST denies secondary and extended before forwarding private records",async t=>{
  for(const role of ["secondary","extended"]){await t.test(role,async t=>{const f=route(t,"../api/sync.js",{role});
    for(const method of ["GET","POST"]){const r=await f.request(method,{projects:[]});assert.equal(r.status,403);assert.equal(f.calls.length,0);assert.ok(!JSON.stringify(r.result).includes("private-account-content"));}
  });}
});
test("principal legacy read and explicit server-derived write remain compatible",async t=>{
  const f=route(t,"../api/sync.js");assert.equal((await f.request("GET")).status,200);
  assert.equal((await f.request("POST",{projects:[{id:"fixture"}],source:"offline"})).status,200);
  const body=JSON.parse(f.calls[1].options.body);assert.equal(body.actor,"u1");assert.equal(body.operation,"legacy_merge");assert.equal(body.householdId,"butler-household");
  assert.equal((await f.request("POST",{projects:[],actor:"other"})).status,400);
});
test("legacy write-check cannot authorize secondary writes",async t=>{
  const f=route(t,"../api/v1/legacy-write-check.js",{role:"secondary"});assert.equal((await f.request()).status,403);assert.equal(f.calls.length,0);
});
test("workspace reports verified role only and never returns directory/private data",async t=>{
  for(const role of ["principal","secondary","extended"]){await t.test(role,async t=>{const f=route(t,"../api/v1/workspace.js",{role}),r=await f.request();
    assert.equal(r.status,200);assert.equal(r.headers["Cache-Control"],"no-store");assert.equal(r.result.workspace.principalWorkspace,role==="principal");
    assert.equal(r.result.workspace.memberSetupReady,false);assert.ok(!JSON.stringify(r.result).includes("never-output"));assert.equal(f.calls.length,0);
  });}
});
test("workspace denies anonymous, revoked, wrong-household and authority-smuggling requests",async t=>{
  const anonymous=route(t,"../api/v1/workspace.js",{signedIn:false});assert.equal((await anonymous.request()).status,401);
  const f=route(t,"../api/v1/workspace.js");
  for(const body of [{role:"principal"},{actor:"other"},{householdId:"wrong"},[],"not JSON"]){assert.ok((await f.request("POST",body)).status>=400);}
  assert.equal((await f.request("GET")).status,405);assert.equal((await f.request("POST",{},{origin:"https://evil.invalid"})).status,403);
  f.setStatus("revoked");assert.equal((await f.request()).status,403);
});

function browser({role="principal",upstream}={}){
  const events=new Map(),documentEvents=new Map(),calls=[],listeners=[];
  const names=["core","mcWorkspaceGate","mcWorkspaceStatus","mcWorkspaceRetry","mcWorkspaceJoin","mcJuliePreview","mcOnboard"];
  const elements=Object.fromEntries(names.map(name=>[name,{src:"about:blank",dataset:{src:"./app-v5.html"},style:{},hidden:true,disabled:false,textContent:"",classList:{remove(){}},setAttribute(){},getAttribute(key){return this[key]},addEventListener(type,fn){this[type]=fn}}]));
  const clerk={isSignedIn:true,user:{id:"offline-user"},session:{id:"offline-session"},addListener:fn=>listeners.push(fn)};
  const window={Clerk:clerk,addEventListener:(name,fn)=>events.set(name,fn)};
  const caches={keys:async()=>["old-api-cache"],delete:async name=>{calls.push({cacheDelete:name});return true}};window.caches=caches;
  const context=vm.createContext({window,caches,Date,JSON,document:{hidden:false,getElementById:id=>elements[id],addEventListener:(name,fn)=>documentEvents.set(name,fn)},
    setInterval(){},fetch:async(url,opts)=>{calls.push({url,opts});return upstream?upstream():new Response(JSON.stringify({ok:true,workspace:{role,principalWorkspace:role==="principal",memberSetupReady:false}}));}});
  vm.runInContext(fs.readFileSync(new URL("../workspace-ui.js",import.meta.url),"utf8"),context);
  events.get("DOMContentLoaded")();
  const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
  return{elements,calls,clerk,listeners,events,settle,authenticate:()=>events.get("mc-authenticated")()};
}
test("principal browser clears old caches then loads exactly one verified workspace",async()=>{
  const f=browser();f.authenticate();await f.settle();assert.equal(f.calls[0].cacheDelete,"old-api-cache");
  assert.equal(f.calls[1].url,"/api/v1/workspace");assert.equal(f.calls[1].opts.method,"POST");assert.equal(f.elements.core.src,"./app-v5.html");
  f.authenticate();await f.settle();assert.equal(f.calls.length,2);
});
test("secondary browser stays outside legacy iframe and does not promise completed setup",async()=>{
  const f=browser({role:"secondary"});f.authenticate();await f.settle();assert.equal(f.elements.core.src,"about:blank");
  assert.match(f.elements.mcWorkspaceStatus.textContent,/still being prepared/);assert.equal(f.elements.mcJuliePreview.hidden,true);
});
test("late principal response after sign-out or account switch cannot open private workspace",async()=>{
  let complete;const f=browser({upstream:()=>new Promise(resolve=>{complete=resolve})});f.authenticate();await f.settle();
  f.clerk.isSignedIn=false;f.clerk.session=null;f.events.get("mc-signed-out")();complete(new Response(JSON.stringify({ok:true,workspace:{role:"principal",principalWorkspace:true}})));await f.settle();
  assert.equal(f.elements.core.src,"about:blank");assert.equal(f.elements.mcJuliePreview.hidden,true);
});
test("unprovisioned and failed directory responses offer recovery without loading legacy UI",async()=>{
  for(const [status,code] of [[403,"USER_NOT_PROVISIONED"],[503,"WORKSPACE_UNAVAILABLE"]]){
    const f=browser({upstream:async()=>new Response(JSON.stringify({ok:false,code}),{status})});f.authenticate();await f.settle();
    assert.equal(f.elements.core.src,"about:blank");assert.equal(f.elements.mcWorkspaceRetry.hidden,false);assert.equal(f.elements.mcWorkspaceJoin.hidden,code!=="USER_NOT_PROVISIONED");
  }
});
test("revalidation closes an already-open workspace after membership revocation",async()=>{
  let revoked=false;const f=browser({upstream:async()=>new Response(JSON.stringify(revoked?{ok:false,code:"WORKSPACE_FORBIDDEN"}:{ok:true,workspace:{role:"principal",principalWorkspace:true}}),{status:revoked?403:200})});
  f.authenticate();await f.settle();assert.equal(f.elements.core.src,"./app-v5.html");revoked=true;
  f.elements.mcWorkspaceRetry.click();await f.settle();assert.equal(f.elements.core.src,"about:blank");
});
test("account switch ignores an earlier principal response while accepting new member role",async()=>{
  const pending=[];const f=browser({upstream:()=>new Promise(resolve=>pending.push(resolve))});f.authenticate();await f.settle();
  f.clerk.user={id:"different-offline-user"};f.clerk.session={id:"different-offline-session"};f.listeners[0]();await f.settle();
  pending[1](new Response(JSON.stringify({ok:true,workspace:{role:"secondary",principalWorkspace:false}})));await f.settle();
  pending[0](new Response(JSON.stringify({ok:true,workspace:{role:"principal",principalWorkspace:true}})));await f.settle();
  assert.equal(f.elements.core.src,"about:blank");assert.match(f.elements.mcWorkspaceStatus.textContent,/still being prepared/);
});
test("service worker bypasses authenticated APIs and cross-origin requests",()=>{
  const handlers={},cacheCalls=[];
  const context=vm.createContext({URL,self:{location:{origin:"https://offline.invalid"},addEventListener:(type,fn)=>handlers[type]=fn},caches:{match:()=>{cacheCalls.push("match")}},fetch(){throw new Error("unexpected fetch")}});
  vm.runInContext(fs.readFileSync(new URL("../sw.js",import.meta.url),"utf8"),context);
  for(const url of ["https://offline.invalid/api/sync","https://offline.invalid/api/v1/workspace","https://other.invalid/private"]){let intercepted=false;handlers.fetch({request:{method:"GET",url},respondWith(){intercepted=true}});assert.equal(intercepted,false);}
  assert.deepEqual(cacheCalls,[]);
});

test("setup gate routes only secondary members while principal and extended decisions stay unchanged",async t=>{
  for(const role of ["principal","secondary","extended"]){const f=route(t,"../api/v1/workspace.js",{role,setupEnabled:true});const r=await f.request();assert.equal(r.result.workspace.memberSetupReady,role==="secondary");assert.equal(r.result.workspace.principalWorkspace,role==="principal");}
});
test("gated secondary browser opens isolated setup instead of legacy principal records",async()=>{
 const f=browser({upstream:async()=>new Response(JSON.stringify({ok:true,workspace:{role:"secondary",principalWorkspace:false,memberSetupReady:true}}))});f.authenticate();await f.settle();assert.equal(f.elements.core.src,"/member-setup.html");assert.equal(f.elements.mcJuliePreview.hidden,true);assert.equal(f.elements.mcWorkspaceGate.style.display,"none");
});
