
const AREAS=["Supportworks","Construction","Above the Mark OS","Dropshipping","Personal / Home"];
const STATUSES=["Today","Active","Waiting / Blocked","Upcoming","Incubator / Someday","Completed"];
const PRIORITIES=["Critical","High","Normal","Low"];
const ATTENTION=["Needs John","Moving","Waiting","Parked","Complete"];
const KEY="johnMissionControl.v3";
const STALE_DAYS=10;

const seed=[
{id:"siro",name:"Siro Production Coaching",area:"Supportworks",status:"Today",priority:"Critical",attention:"Needs John",owner:"John",description:"Production-side Siro scorecard, prompting, testing and network rollout.",outcome:"A permanent, useful production coaching scorecard and prompting structure for the network.",doneDefinition:"Permanent scorecard approved; prompting structure documented; Supportworks and Siro teams have implementation guidance.",currentState:"Comparison set reviewed; permanent structure recommendations are being packaged.",nextAction:"Finalize permanent scorecard and prompting recommendations.",waitingOn:"",waitingSince:"",followupDate:"",deadline:"2026-08-20",milestone:"Recommendations ready",milestoneDate:"2026-08-17",progress:78,tags:["AI","Siro","Production"],notes:"High-leverage network project.",dependencyId:"",lastUpdate:"2026-08-14"},
{id:"ai",name:"Supportworks AI Ecosystem",area:"Supportworks",status:"Active",priority:"High",attention:"Needs John",owner:"John",description:"Remove low-value activity and create AI-supported workflows across roles.",outcome:"Demonstrate measurable time savings and create a scalable network AI adoption model.",doneDefinition:"Personal pilot measured; core use cases documented; leadership has an evidence-backed recommendation.",currentState:"Strategic direction and use cases are clear.",nextAction:"Define the measurable personal pilot and baseline.",waitingOn:"",waitingSince:"",followupDate:"",deadline:"",milestone:"Pilot scorecard defined",milestoneDate:"2026-08-21",progress:35,tags:["AI","Workflow"],notes:"",dependencyId:"",lastUpdate:"2026-08-13"},
{id:"chicago",name:"Chicago Trip Preparation",area:"Supportworks",status:"Upcoming",priority:"High",attention:"Parked",owner:"John",description:"Supportworks travel window Aug 23–27.",outcome:"Arrive prepared with zero preventable travel or dealer-prep surprises.",doneDefinition:"Travel confirmed; agenda understood; prep materials ready; dealer commitments clear.",currentState:"Trip is upcoming.",nextAction:"Begin active trip prep when the window reaches 2–3 days.",waitingOn:"",waitingSince:"",followupDate:"",deadline:"2026-08-22",milestone:"Depart Chicago",milestoneDate:"2026-08-23",progress:20,tags:["Travel"],notes:"",dependencyId:"",lastUpdate:"2026-08-12"},
{id:"deck",name:"Current Deck Project",area:"Construction",status:"Active",priority:"High",attention:"Needs John",owner:"John",description:"15x15 freestanding deck replacement.",outcome:"Complete a safe, code-conscious deck build.",doneDefinition:"Framing, decking, stairs and railing complete; cleanup complete; project accepted.",currentState:"Demo/build execution underway.",nextAction:"Complete the next framing milestone.",waitingOn:"",waitingSince:"",followupDate:"",deadline:"",milestone:"Framing underway",milestoneDate:"2026-08-15",progress:42,tags:["Deck"],notes:"",dependencyId:"",lastUpdate:"2026-08-14"},
{id:"field",name:"Field Supply / Equipment Projects",area:"Construction",status:"Waiting / Blocked",priority:"Normal",attention:"Waiting",owner:"John",description:"Drive heads, pumps, supplier quoting and equipment support.",outcome:"Close equipment/supplier requests with minimal administrative drag.",doneDefinition:"Open equipment requests resolved or delegated with owners and dates.",currentState:"Several supplier/process items are pending external responses.",nextAction:"Follow up only when supplier response or dealer demand requires movement.",waitingOn:"Suppliers / internal stakeholders",waitingSince:"2026-08-11",followupDate:"2026-08-17",deadline:"",milestone:"Supplier decisions closed",milestoneDate:"2026-08-21",progress:55,tags:["Equipment"],notes:"",dependencyId:"",lastUpdate:"2026-08-12"},
{id:"one",name:"One-on-One Planner",area:"Above the Mark OS",status:"Waiting / Blocked",priority:"High",attention:"Waiting",owner:"John",description:"A5 quarterly manager/direct-report one-on-one planner.",outcome:"A premium, sellable one-on-one operating planner.",doneDefinition:"Physical sample approved; POD configured; Etsy listing live; final files archived.",currentState:"Sample is in production / shipping workflow.",nextAction:"Review physical sample when it arrives.",waitingOn:"Prodigi sample delivery",waitingSince:"2026-08-13",followupDate:"2026-08-19",deadline:"",milestone:"Physical sample review",milestoneDate:"2026-08-18",progress:82,tags:["Prodigi","Planner"],notes:"",dependencyId:"",lastUpdate:"2026-08-13"},
{id:"compass",name:"Company Compass",area:"Above the Mark OS",status:"Active",priority:"Normal",attention:"Moving",owner:"John",description:"Purpose, Mission & Values workbook; standalone and bundle component.",outcome:"A sellable PMV workbook that can stand alone or live inside a broader owner package.",doneDefinition:"Final workbook approved; POD configured; standalone SKU live; bundle configuration live.",currentState:"Product concept and content architecture are established.",nextAction:"Define standalone + bundle offer structure.",waitingOn:"",waitingSince:"",followupDate:"",deadline:"",milestone:"Offer architecture defined",milestoneDate:"2026-08-20",progress:38,tags:["Workbook","PMV"],notes:"",dependencyId:"",lastUpdate:"2026-08-12"},
{id:"assets",name:"Product Asset Library",area:"Above the Mark OS",status:"Today",priority:"High",attention:"Needs John",owner:"John",description:"Reusable brand, mockup and marketing asset organization.",outcome:"One reliable asset source for Etsy, marketing, video and wholesale work.",doneDefinition:"Core logos, product images, mockups and reusable creative are centralized and findable.",currentState:"Structure exists but asset population is incomplete.",nextAction:"Populate and normalize the core asset library.",waitingOn:"",waitingSince:"",followupDate:"",deadline:"",milestone:"Core assets centralized",milestoneDate:"2026-08-16",progress:28,tags:["Assets"],notes:"",dependencyId:"",lastUpdate:"2026-08-14"},
{id:"video",name:"Marketing Video",area:"Above the Mark OS",status:"Waiting / Blocked",priority:"Normal",attention:"Waiting",owner:"John",description:"Premium short Above the Mark OS video.",outcome:"A concise brand video that explains chaos → clarity → action → follow-through.",doneDefinition:"Final video approved and exported in required formats.",currentState:"Creative direction is established.",nextAction:"Assemble final visuals after core assets are centralized.",waitingOn:"Product Asset Library",waitingSince:"2026-08-14",followupDate:"2026-08-17",deadline:"",milestone:"Visual package ready",milestoneDate:"2026-08-18",progress:45,tags:["Video"],notes:"",dependencyId:"assets",lastUpdate:"2026-08-14"},
{id:"llc",name:"LLC / Wholesale Setup",area:"Dropshipping",status:"Today",priority:"High",attention:"Needs John",owner:"John",description:"Business formation and supplier-readiness foundation.",outcome:"A legal/operational base that unlocks wholesale supplier work.",doneDefinition:"LLC registered; required business details available for supplier onboarding.",currentState:"LLC registration is the immediate unlock.",nextAction:"Complete the next LLC registration step.",waitingOn:"",waitingSince:"",followupDate:"",deadline:"",milestone:"LLC registered",milestoneDate:"2026-08-17",progress:55,tags:["LLC","Wholesale"],notes:"",dependencyId:"",lastUpdate:"2026-08-14"},
{id:"mobile",name:"Mobile Offices Store",area:"Dropshipping",status:"Waiting / Blocked",priority:"High",attention:"Waiting",owner:"John",description:"Dropship store for truck, van and field workspaces.",outcome:"A no-inventory discovery store for mobile office products.",doneDefinition:"Business ready; supplier set approved; first product collection live; fulfillment path proven.",currentState:"Concept and sourcing direction are established.",nextAction:"Resume wholesale build once LLC is ready.",waitingOn:"LLC / wholesale readiness",waitingSince:"2026-08-13",followupDate:"2026-08-18",deadline:"",milestone:"Wholesale-ready",milestoneDate:"2026-08-21",progress:26,tags:["Store"],notes:"",dependencyId:"llc",lastUpdate:"2026-08-13"},
{id:"suppliers",name:"Supplier Research",area:"Dropshipping",status:"Waiting / Blocked",priority:"Normal",attention:"Waiting",owner:"John",description:"Candidate products, brands, wholesale and fulfillment viability.",outcome:"A short list of suppliers that fit no-inventory fulfillment and target economics.",doneDefinition:"Priority suppliers approved with terms, fulfillment path and candidate SKUs documented.",currentState:"Initial supplier discovery exists.",nextAction:"Resume supplier qualification after business setup unlocks access.",waitingOn:"LLC / wholesale access",waitingSince:"2026-08-13",followupDate:"2026-08-20",deadline:"",milestone:"Shortlist approved",milestoneDate:"2026-08-24",progress:30,tags:["Suppliers"],notes:"",dependencyId:"llc",lastUpdate:"2026-08-11"},
{id:"pamela",name:"Pamela Test Vehicle",area:"Dropshipping",status:"Upcoming",priority:"Low",attention:"Parked",owner:"John",description:"Use the van as a practical testbed for mobile-office products.",outcome:"Validate selected products in a real mobile-office environment.",doneDefinition:"Test setup installed; products evaluated; keep/drop decisions documented.",currentState:"Concept captured.",nextAction:"Activate after first testable product set is selected.",waitingOn:"Product shortlist",waitingSince:"2026-08-13",followupDate:"",deadline:"",milestone:"Test configuration chosen",milestoneDate:"",progress:5,tags:["Van"],notes:"",dependencyId:"suppliers",lastUpdate:"2026-08-10"},
{id:"family",name:"Family Logistics",area:"Personal / Home",status:"Active",priority:"Normal",attention:"Moving",owner:"John",description:"Shared household logistics and important coordination.",outcome:"Important family logistics handled without carrying everything mentally.",doneDefinition:"Recurring lane; no unresolved dated items.",currentState:"Recurring lane.",nextAction:"Keep only dated or genuinely important items visible.",waitingOn:"",waitingSince:"",followupDate:"",deadline:"",milestone:"",milestoneDate:"",progress:50,tags:["Family"],notes:"",dependencyId:"",lastUpdate:"2026-08-14"},
{id:"home",name:"Home Projects",area:"Personal / Home",status:"Active",priority:"Low",attention:"Moving",owner:"John",description:"Non-construction home work needing visibility.",outcome:"Keep home projects moving without allowing them to become mental clutter.",doneDefinition:"Each active home project has one clear next action or is intentionally parked.",currentState:"Ongoing.",nextAction:"Keep one next physical action per active home project.",waitingOn:"",waitingSince:"",followupDate:"",deadline:"",milestone:"",milestoneDate:"",progress:25,tags:["Home"],notes:"",dependencyId:"",lastUpdate:"2026-08-11"}
];

const SYNC_KEY="missionControlV3Sync";
const storage={
  load(){try{const x=JSON.parse(localStorage.getItem(KEY));if(x&&Array.isArray(x.projects))return migrate(x)}catch(e){}
    return migrate({projects:seed,actions:[],inbox:[],activity:[{ts:"2026-08-14T19:30:00",type:"update",projectId:"assets",text:"Asset library surfaced as a current ATM OS constraint."},{ts:"2026-08-14T19:25:00",type:"update",projectId:"siro",text:"Siro remains a highest-leverage Supportworks project."}],completedActions:[]})},
  save(s){localStorage.setItem(KEY,JSON.stringify(s));queueProjectPush()}
};
let syncTimer=null,syncBusy=false;
function defaultDeviceLabel(){return /iPhone|Android|Mobile/i.test(navigator.userAgent)?"Mission Control — Mobile":"Mission Control — Desktop"}
function syncConfig(){
  try{
    const saved=JSON.parse(localStorage.getItem(SYNC_KEY))||{};
    if(location.hostname.endsWith(".vercel.app"))return {url:"/api/sync",token:"server-managed",deviceLabel:saved.deviceLabel||defaultDeviceLabel(),serverManaged:true};
    return saved
  }catch(e){
    if(location.hostname.endsWith(".vercel.app"))return {url:"/api/sync",token:"server-managed",deviceLabel:defaultDeviceLabel(),serverManaged:true};
    return {}
  }
}
function sourceLabel(){return syncConfig().deviceLabel||defaultDeviceLabel()}
function stampProject(p,source=sourceLabel()){p.lastUpdate=today();p.lastUpdatedAt=new Date().toISOString();p.lastUpdatedBy=source}
function setSyncStatus(title,detail){const a=document.getElementById("syncStatus"),b=document.getElementById("syncDetail");if(a)a.textContent=title;if(b)b.textContent=detail}
function queueProjectPush(){
  const c=syncConfig();if(!c.url||!c.token)return;
  clearTimeout(syncTimer);
  syncTimer=setTimeout(async()=>{
    if(syncBusy){queueProjectPush();return}
    await pushProjects(false);
  },700)
}
async function pushProjects(showToast=true){
  const c=syncConfig();
  if(!c.url||!c.token){
    setSyncStatus("Local only","This device is not connected to shared project data.");
    if(showToast)toast("Saved locally — connect this device to sync");
    return false
  }
  if(syncBusy){
    for(let i=0;i<20&&syncBusy;i++)await new Promise(r=>setTimeout(r,150));
    if(syncBusy){
      setSyncStatus("Sync delayed","Another sync is still running. Your change is saved locally and will retry.");
      queueProjectPush();
      if(showToast)toast("Saved locally — sync retry queued");
      return false
    }
  }
  syncBusy=true;
  setSyncStatus("Syncing…","Merging project updates with the shared Google Sheet.");
  try{
    const r=await fetch(c.url,{method:"POST",headers:{"Content-Type":"application/json;charset=utf-8"},body:JSON.stringify({...(c.serverManaged?{}:{token:c.token}),projects:state.projects,source:sourceLabel()})});
    const x=await r.json();
    if(!x.ok)throw new Error(x.error||"Sync failed");
    if(Array.isArray(x.projects)){
      state.projects=x.projects.map(p=>migrate({projects:[p]}).projects[0]);
      localStorage.setItem(KEY,JSON.stringify(state));
      renderAll()
    }
    setSyncStatus("Connected","Conflict-safe project sync active. Last push: "+new Date().toLocaleTimeString());
    if(showToast)toast("Saved & synced");
    return true
  }catch(e){
    setSyncStatus("Sync problem",e.message||"Could not reach shared source");
    queueProjectPush();
    if(showToast)toast("Saved locally — sync failed");
    return false
  }finally{
    syncBusy=false
  }
}
async function pullProjects(showToast=true){
  const c=syncConfig();if(!c.url||!c.token)return false;
  if(syncBusy){for(let i=0;i<30&&syncBusy;i++)await new Promise(r=>setTimeout(r,100));if(syncBusy)return false}
  syncBusy=true;setSyncStatus("Syncing…","Checking the shared Google Sheet for newer project updates.");
  try{
    const sep=c.url.includes("?")?"&":"?";const syncUrl=c.serverManaged?(c.url+"?t="+Date.now()):(c.url+sep+"token="+encodeURIComponent(c.token));const r=await fetch(syncUrl,{cache:"no-store",headers:{"Cache-Control":"no-cache"}});
    if(!r.ok)throw new Error("Private sync HTTP "+r.status);
    const x=await r.json();if(!x.ok||!Array.isArray(x.projects))throw new Error(x.error||"Sync failed");
    state.projects=x.projects.map(p=>migrate({projects:[p]}).projects[0]);
    localStorage.setItem(KEY,JSON.stringify(state));renderAll();
    setSyncStatus("Connected","Projects are shared. Last pull: "+new Date().toLocaleTimeString());
    if(showToast)toast("Shared projects refreshed");
    return true;
  }catch(e){setSyncStatus("Sync problem",e.message||"Could not reach shared source");if(showToast)toast("Sync failed");return false}
  finally{syncBusy=false}
}
async function syncNow(){await pullProjects(false);await pushProjects(false);toast("Mission Control synced")}
function initSyncUI(){
  const c=syncConfig(),u=document.getElementById("syncUrl"),t=document.getElementById("syncToken"),d=document.getElementById("deviceLabel");
  if(u)u.value=c.url||"";if(t)t.value=c.token||"";if(d)d.value=c.deviceLabel||defaultDeviceLabel();
  if(c.url&&c.token){setSyncStatus("Connected",c.serverManaged?"Protected Mission Control sync configured. Refreshing…":"Shared project source configured. Refreshing…");pullProjects(false)}
  else setSyncStatus("Local mode","Add the Apps Script URL and token to share projects across devices.");
}
function saveSyncConfig(){
  const url=document.getElementById("syncUrl").value.trim(),token=document.getElementById("syncToken").value.trim(),deviceLabel=document.getElementById("deviceLabel").value.trim()||defaultDeviceLabel();
  localStorage.setItem(SYNC_KEY,JSON.stringify({url,token,deviceLabel}));initSyncUI();toast("Connection saved")
}
function migrate(x){
  x.actions=x.actions||[];x.inbox=x.inbox||[];x.activity=x.activity||[];x.completedActions=x.completedActions||[];
  x.household=x.household||{id:"butler-household",name:"Butler Household",version:1};
  x.users=x.users||[
    {id:"john",name:"John",role:"principal",status:"active",modules:["agenda","today","projects","inbox","weekly","money","budget","settings"],scopes:["private:john","household:shared"],onboarding:"complete"},
    {id:"julie",name:"Julie",role:"secondary",status:"invited",modules:["agenda","today","budget","family","meals"],scopes:["private:julie","household:shared"],onboarding:"not_started"}
  ];
  x.modulePolicy=x.modulePolicy||{
    principal:["agenda","today","projects","inbox","weekly","money","budget","settings"],
    secondary:["agenda","today","budget","family","meals"],
    extended:["agenda","today","family"],
    readonly:["family"]
  };
  x.sharingPolicy=x.sharingPolicy||{
    shared:["budget","family_calendar","household_commitments"],
    privateByDefault:["projects","inbox","work_calendar","personal_tasks","connections"],
    householdFinanceConnectionOwner:"household",
    secondaryFinancialModules:["budget"]
  };
  x.projectPatterns=x.projectPatterns||[];
  x.meals=x.meals||{version:2,householdId:"butler-household",weekStart:"",status:"draft",days:[],groceryList:[],inventory:[],mealHistory:[{"id":"hist-1","name":"Blackstone chicken fajitas","status":"approved_history"},{"id":"hist-2","name":"Smash burgers","status":"approved_history"},{"id":"hist-3","name":"Chicken fried rice","status":"approved_history"},{"id":"hist-4","name":"Sausage, potatoes & green beans","status":"approved_history"},{"id":"hist-5","name":"Walking tacos","status":"approved_history"},{"id":"hist-6","name":"Chicken bacon ranch wraps","status":"approved_history"},{"id":"hist-7","name":"Spaghetti with meat sauce","status":"approved_history"},{"id":"hist-8","name":"BBQ pulled pork sandwiches","status":"approved_history"},{"id":"hist-9","name":"Breakfast for dinner","status":"approved_history"},{"id":"hist-10","name":"Chicken hibachi","status":"approved_history"},{"id":"hist-11","name":"Sloppy joes","status":"approved_history"},{"id":"hist-12","name":"Chicken nuggets, fries & produce","status":"approved_history"},{"id":"hist-13","name":"Salsa chicken tacos","status":"approved_history"},{"id":"hist-14","name":"Loaded baked potatoes","status":"approved_history"},{"id":"hist-15","name":"Turkey tacos","status":"approved_history"},{"id":"hist-16","name":"Garlic-herb chicken thighs","status":"approved_history"},{"id":"hist-17","name":"Pancakes, eggs & sausage","status":"approved_history"}],catalog:{source:"Butler Walmart Master Catalog.xlsx",itemCount:160,mealPlanEligibleCount:96,lastImported:"2026-10-01"},planningRules:["Dairy-free default","Cam dislikes rice — avoid rice-based dinners","Monday should be extra easy","Use leftovers deliberately","Check inventory before buying","No unnecessary midweek grocery run","Prefer Walmart; Aldi secondary","Use Blackstone-friendly meals when useful","Do not assume stale perishable inventory is still on hand"],settings:{showResponsibility:false,dairyFreeDefault:true,easyMonday:true,primaryStore:"Walmart",secondaryStore:"Aldi"},updatedAt:""};
  x.projects=x.projects.map(p=>({...p,
    scope:p.scope||"private:john",
    lifecycle:p.lifecycle||(p.deleted?"deleted":p.archived?"archived":p.status==="Completed"?"completed":"active"),
    reviewStatus:p.reviewStatus||"approved",
    projectType:p.projectType||"",
    archived:!!p.archived,deleted:!!p.deleted,archiveReason:p.archiveReason||"",
    milestones:Array.isArray(p.milestones)?p.milestones:(p.milestone?[{id:"m-"+p.id+"-1",title:p.milestone,targetDate:p.milestoneDate||"",status:(p.status==="Completed"?"done":"not_started"),order:1}]:[]),
    projectActions:Array.isArray(p.projectActions)?p.projectActions:(p.nextAction?[{id:"a-"+p.id+"-1",title:p.nextAction,status:"not_started",order:1,isNext:true}]:[]),
    dependencies:Array.isArray(p.dependencies)?p.dependencies:(p.dependencyId?[{type:"project",projectId:p.dependencyId,status:"open"}]:[]),
    reviewDraft:p.reviewDraft||null,
    reviewFeedback:p.reviewFeedback||[],
    attention:p.attention||(p.status==="Completed"?"Complete":p.waitingOn?"Waiting":p.status==="Incubator / Someday"?"Parked":"Needs John"),
    outcome:p.outcome||p.description||"",doneDefinition:p.doneDefinition||"",dependencyId:p.dependencyId||"",tags:p.tags||[]
  }));
  return x
}
let state=storage.load(),quickFilter="All",selectedProject=null;
function today(){return new Date().toISOString().slice(0,10)}function days(a,b){if(!a||!b)return null;return Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/86400000)}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
function color(a){return {"Supportworks":"var(--sw)","Construction":"var(--construction)","Above the Mark OS":"var(--atm)","Dropshipping":"var(--drop)","Personal / Home":"var(--home)"}[a]||"var(--accent)"}
function touchAge(p){return p.lastUpdate?Math.max(0,days(p.lastUpdate,today())):999}
function stale(p){return p.status!=="Completed"&&p.status!=="Incubator / Someday"&&touchAge(p)>STALE_DAYS}
function changeTime(p){return p.lastUpdatedAt||((p.lastUpdate||"1970-01-01")+"T12:00:00.000Z")}
function attentionReasons(p){
  const r=[];if(["Completed","Incubator / Someday"].includes(p.status)||p.attention==="Complete"||p.attention==="Parked")return r;
  if(p.attention==="Needs John")r.push("Needs your attention");
  if(p.deadline){const d=days(today(),p.deadline);if(d<0)r.push(`Deadline overdue ${Math.abs(d)}d`);else if(d<=3)r.push(d===0?"Deadline today":`Deadline in ${d}d`)}
  if(p.milestoneDate){const d=days(today(),p.milestoneDate);if(d<0)r.push(`Milestone overdue ${Math.abs(d)}d`);else if(d<=2)r.push(d===0?"Milestone today":`Milestone in ${d}d`)}
  if(p.followupDate&&days(today(),p.followupDate)<=0)r.push("Follow-up due");
  if(p.attention==="Waiting"&&p.waitingSince&&days(p.waitingSince,today())>=5)r.push(`Waiting ${days(p.waitingSince,today())}d`);
  if(stale(p))r.push(`Stale ${touchAge(p)}d`);
  return r
}
function switchPage(name){
  document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===name));
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
  const page=document.getElementById("page-"+name);if(page)page.classList.add("active")
}
function showProjectSet(type,value=""){
  search.value="";filterArea.value="";filterStatus.value="";filterAttention.value="";filterPriority.value="";quickFilter="All";
  if(type==="attention")filterAttention.value=value;
  if(type==="area"){filterArea.value=value}
  if(type==="stale")quickFilter="Stale";
  if(type==="today")quickFilter="Today Focus";
  renderChips();renderProjects();switchPage("projects")
}
function attentionClass(a){return {"Needs John":"needs","Moving":"moving","Waiting":"waiting","Parked":"parked","Complete":"done"}[a]||""}
function priorityScore(p){
  if(["Completed","Incubator / Someday"].includes(p.status)||p.attention==="Parked"||p.attention==="Complete")return-999;
  let s=0;if(p.attention==="Needs John")s+=100;if(p.status==="Today")s+=70;if(p.priority==="Critical")s+=60;if(p.priority==="High")s+=30;
  if(p.deadline){const d=days(today(),p.deadline);if(d<0)s+=60;else if(d<=3)s+=35;else if(d<=7)s+=15}
  if(p.milestoneDate){const m=days(today(),p.milestoneDate);if(m<0)s+=35;else if(m<=2)s+=22}if(p.followupDate&&days(today(),p.followupDate)<=0)s+=20;if(stale(p))s+=18;
  return s
}
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1700)}
function log(type,pid,text){state.activity.push({ts:new Date().toISOString(),type,projectId:pid,text})}
function currentAction(p){return state.actions.find(a=>a.projectId===p.id&&!a.done) || (p.nextAction?{id:"derived-"+p.id,projectId:p.id,text:p.nextAction,done:false,derived:true}:null)}
function ensureAction(p){
  if(!p.nextAction)return;
  const existing=state.actions.find(a=>a.projectId===p.id&&!a.done);
  if(existing){existing.text=p.nextAction;return}
  state.actions.push({id:"a"+Date.now()+Math.random().toString(16).slice(2),projectId:p.id,text:p.nextAction,createdAt:new Date().toISOString(),done:false})
}
function renderDate(){dateLine.textContent=new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"})+" • Executive operating system"}
function renderHome(){
  const active=state.projects.filter(p=>p.status!=="Completed");
  const needs=active.filter(p=>p.attention==="Needs John").length,moving=active.filter(p=>p.attention==="Moving").length,waiting=active.filter(p=>p.attention==="Waiting").length,staleCount=active.filter(stale).length;
  const changed=state.projects.filter(p=>Date.now()-new Date(changeTime(p)).getTime()<=24*3600*1000).length;
  heroGreeting.textContent=(new Date().getHours()<12?"Good morning.":new Date().getHours()<18?"Good afternoon.":"Good evening.");
  heroSentence.textContent=`${needs} thing${needs===1?"":"s"} need you. ${moving} are moving. ${waiting} are waiting. ${staleCount} are stale.`;
  heroGrid.innerHTML=[
    [needs,"Need John","You are the current constraint.","attention","Needs John"],
    [moving,"Moving","Progressing without intervention.","attention","Moving"],
    [waiting,"Waiting","Somebody or something else is the constraint.","attention","Waiting"],
    [staleCount,"Stale",`No update in more than ${STALE_DAYS} days.`,"stale",""],
    [changed,"Changed","Updated in the last 24 hours.","changes",""]
  ].map(x=>`<div class="hero-stat clickable" data-metric="${x[3]}" data-value="${esc(x[4])}"><div class="n">${x[0]}</div><div class="l">${x[1]}</div><div class="d">${x[2]}</div></div>`).join("");
  document.querySelectorAll("[data-metric]").forEach(el=>el.onclick=()=>el.dataset.metric==="changes"?switchPage("changes"):showProjectSet(el.dataset.metric,el.dataset.value));

  const tops=state.projects.slice().sort((a,b)=>priorityScore(b)-priorityScore(a)).filter(p=>priorityScore(p)>0).slice(0,3);
  priorityGrid.innerHTML=tops.map((p,i)=>`<div class="priority-card" data-open="${p.id}" style="border-top-color:${color(p.area)};cursor:pointer"><div class="rank">#${i+1} • ${esc(p.area)}</div><h4>${esc(p.name)}</h4><p><b>Next:</b> ${esc(p.nextAction||"Define next action.")}</p><div class="focus-reason">${esc(attentionReasons(p).slice(0,3).join(" • "))}</div></div>`).join("")||`<div class="item"><b>Nothing requires immediate attention.</b></div>`;
  document.querySelectorAll("[data-open]").forEach(el=>el.onclick=()=>openProject(el.dataset.open));

  const recent=state.projects.slice().sort((a,b)=>changeTime(b).localeCompare(changeTime(a))).slice(0,6);
  deltaGrid.innerHTML=recent.length?recent.map(p=>`<div class="delta-card clickable" data-change="${p.id}"><b>${esc(p.name)}</b><small>${esc(p.currentState||p.nextAction||"Project updated")} • ${new Date(changeTime(p)).toLocaleString()}</small><span class="change-source">${esc(p.lastUpdatedBy||"Previous data")}</span></div>`).join(""):`<div class="delta-card"><b>No meaningful changes.</b><small>Your project state is stable.</small></div>`;
  document.querySelectorAll("[data-change]").forEach(el=>el.onclick=()=>openProject(el.dataset.change));

  lanes.innerHTML=AREAS.map(a=>{const ps=active.filter(p=>p.area===a),n=ps.filter(p=>p.attention==="Needs John").length,m=ps.filter(p=>p.attention==="Moving").length,w=ps.filter(p=>p.attention==="Waiting").length;const next=ps.filter(p=>p.milestoneDate).sort((x,y)=>x.milestoneDate.localeCompare(y.milestoneDate))[0];return `<div class="lane" style="--area-color:${color(a)}"><h4>${esc(a)}</h4><div class="lane-stats"><div class="mini clickable" data-area="${esc(a)}" data-attn="Needs John"><b>${n}</b><span>need you</span></div><div class="mini clickable" data-area="${esc(a)}" data-attn="Moving"><b>${m}</b><span>moving</span></div><div class="mini clickable" data-area="${esc(a)}" data-attn="Waiting"><b>${w}</b><span>waiting</span></div></div><small>${next?"Next: "+esc(next.milestone||next.name)+" • "+next.milestoneDate:"No dated milestone"}</small></div>`}).join("");
  document.querySelectorAll("[data-area][data-attn]").forEach(el=>el.onclick=()=>{search.value="";filterArea.value=el.dataset.area;filterAttention.value=el.dataset.attn;filterStatus.value="";filterPriority.value="";quickFilter="All";renderChips();renderProjects();switchPage("projects")});

  const alerts=[];
  active.forEach(p=>{if(stale(p))alerts.push({p,text:`Stale — untouched ${touchAge(p)} days`});if(p.followupDate&&days(today(),p.followupDate)<0)alerts.push({p,text:`Follow-up overdue by ${Math.abs(days(today(),p.followupDate))} day(s)`});if(p.attention==="Waiting"&&p.waitingSince&&days(p.waitingSince,today())>=5)alerts.push({p,text:`Waiting ${days(p.waitingSince,today())} days on ${p.waitingOn||"dependency"}`});if(p.deadline&&days(today(),p.deadline)>=0&&days(today(),p.deadline)<=3)alerts.push({p,text:`Deadline in ${days(today(),p.deadline)} day(s)`})});
  radar.innerHTML=alerts.length?alerts.slice(0,10).map(a=>`<div class="item" data-radar="${a.p.id}" style="cursor:pointer"><b>${esc(a.p.name)}</b><span>${esc(a.text)}</span></div>`).join(""):`<div class="item"><b>Nothing important is falling through the cracks.</b><span>No stale, overdue, or aging dependency alerts.</span></div>`;
  document.querySelectorAll("[data-radar]").forEach(el=>el.onclick=()=>openProject(el.dataset.radar))
}
function populateFilters(){
  filterArea.innerHTML='<option value="">All areas</option>'+AREAS.map(x=>`<option>${x}</option>`).join("");
  filterStatus.innerHTML='<option value="">All statuses</option>'+STATUSES.map(x=>`<option>${x}</option>`).join("");
  filterAttention.innerHTML='<option value="">All attention states</option>'+ATTENTION.map(x=>`<option>${x}</option>`).join("");
  filterPriority.innerHTML='<option value="">All priorities</option>'+PRIORITIES.map(x=>`<option>${x}</option>`).join("");
  pArea.innerHTML=AREAS.map(x=>`<option>${x}</option>`).join("");pStatus.innerHTML=STATUSES.map(x=>`<option>${x}</option>`).join("");pPriority.innerHTML=PRIORITIES.map(x=>`<option>${x}</option>`).join("");pAttention.innerHTML=ATTENTION.map(x=>`<option>${x}</option>`).join("");uStatus.innerHTML=STATUSES.map(x=>`<option>${x}</option>`).join("");uAttention.innerHTML=ATTENTION.map(x=>`<option>${x}</option>`).join("");
}
function renderChips(){const ls=["All","Today Focus","Needs John","Moving","Waiting","Stale","Upcoming","Incubator"];projectChips.innerHTML=ls.map(x=>`<button class="chip ${quickFilter===x?"active":""}" data-q="${x}">${x}</button>`).join("");document.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>{quickFilter=b.dataset.q;renderChips();renderProjects()})}
function filteredProjects(){
  const q=search.value.trim().toLowerCase();return state.projects.filter(p=>!p.deleted&&!p.archived).filter(p=>{if(filterArea.value&&p.area!==filterArea.value)return false;if(filterStatus.value&&p.status!==filterStatus.value)return false;if(filterAttention.value&&p.attention!==filterAttention.value)return false;if(filterPriority.value&&p.priority!==filterPriority.value)return false;if(quickFilter==="Today Focus"&&attentionReasons(p).length===0)return false;if(quickFilter==="Needs John"&&p.attention!=="Needs John")return false;if(quickFilter==="Moving"&&p.attention!=="Moving")return false;if(quickFilter==="Waiting"&&p.attention!=="Waiting")return false;if(quickFilter==="Stale"&&!stale(p))return false;if(quickFilter==="Upcoming"&&p.status!=="Upcoming")return false;if(quickFilter==="Incubator"&&p.status!=="Incubator / Someday")return false;if(q){const dep=state.projects.find(x=>x.id===p.dependencyId);const hay=[p.name,p.area,p.status,p.attention,p.priority,p.description,p.outcome,p.doneDefinition,p.currentState,p.nextAction,p.owner,p.waitingOn,p.notes,(p.tags||[]).join(" "),dep?dep.name:""].join(" ").toLowerCase();if(!hay.includes(q))return false}return true})}
function reviewDrafts(){return state.projects.filter(p=>!p.deleted&&!p.archived&&(p.lifecycle==="draft"||p.reviewStatus==="pending"))}
function renderProjectReviews(){
  const section=document.getElementById("projectReviewSection"),box=document.getElementById("projectReviewQueue");if(!section||!box)return;
  const drafts=reviewDrafts();section.style.display=drafts.length?"block":"none";
  box.innerHTML=drafts.map(p=>{const d=p.reviewDraft||{};const ms=Array.isArray(d.milestones)?d.milestones:(p.milestones||[]).map(x=>x.title);return `<div class="priority-card" data-review-project="${p.id}" style="border-top-color:${color(p.area)};cursor:pointer"><div class="rank">DRAFT • ${esc(p.area)}</div><h4>${esc(p.name)}</h4><div class="desc">${esc(d.outcome||p.outcome||p.description||"Outcome needs review.")}</div><div class="hint" style="margin-top:8px">${ms.length} proposed milestone${ms.length===1?"":"s"} • Review before activation</div></div>`}).join("");
  document.querySelectorAll("[data-review-project]").forEach(el=>el.onclick=()=>openProjectReview(el.dataset.reviewProject));
}
function openProjectReview(id){
  const p=state.projects.find(x=>x.id===id);if(!p)return;const d=p.reviewDraft||{};
  prId.value=p.id;projectReviewTitle.textContent="Review: "+p.name;prOutcome.value=d.outcome||p.outcome||"";prDone.value=d.doneDefinition||p.doneDefinition||"";
  prMilestones.value=(Array.isArray(d.milestones)?d.milestones:(p.milestones||[]).map(x=>x.title)).join("\n");
  prDependencies.value=(Array.isArray(d.dependencies)?d.dependencies:[]).map(x=>typeof x==="string"?x:(x.label||x.name||"")).filter(Boolean).join("\n");
  prNext.value=d.nextAction||p.nextAction||"";prPriority.innerHTML=PRIORITIES.map(x=>`<option>${x}</option>`).join("");prPriority.value=d.priority||p.priority||"Normal";prDeadline.value=d.deadline||p.deadline||"";openModal("projectReviewModal")
}
async function approveProjectReview(){
  const p=state.projects.find(x=>x.id===prId.value);if(!p)return;const original=JSON.stringify(p.reviewDraft||{});
  const titles=prMilestones.value.split("\n").map(x=>x.trim()).filter(Boolean),deps=prDependencies.value.split("\n").map(x=>x.trim()).filter(Boolean);
  p.outcome=prOutcome.value.trim();p.doneDefinition=prDone.value.trim();p.nextAction=prNext.value.trim();p.priority=prPriority.value;p.deadline=prDeadline.value;
  p.milestones=titles.map((title,i)=>({id:"m-"+p.id+"-"+(i+1),title,status:"not_started",order:i+1,targetDate:""}));
  p.projectActions=p.nextAction?[{id:"a-"+p.id+"-1",title:p.nextAction,status:"not_started",order:1,isNext:true}]:[];
  p.dependencies=deps.map((label,i)=>({id:"d-"+p.id+"-"+(i+1),type:"external",label,status:"open"}));
  p.reviewFeedback=p.reviewFeedback||[];p.reviewFeedback.push({reviewedAt:new Date().toISOString(),originalDraft:original,approved:{outcome:p.outcome,doneDefinition:p.doneDefinition,milestones:titles,dependencies:deps,nextAction:p.nextAction,priority:p.priority,deadline:p.deadline}});
  p.lifecycle="active";p.reviewStatus="approved";p.status=p.status==="Completed"?"Active":(p.status||"Active");p.reviewDraft=null;stampProject(p,"Mission Control — Project Review");ensureAction(p);localStorage.setItem(KEY,JSON.stringify(state));closeModal("projectReviewModal");renderAll();setSyncStatus("Syncing…","Saving approved project build.");await pushProjects(true)
}
async function rejectProjectReview(){
  const p=state.projects.find(x=>x.id===prId.value);if(!p)return;p.lifecycle="deleted";p.deleted=true;p.deletedAt=new Date().toISOString();p.reviewStatus="rejected_not_project";p.reviewFeedback=p.reviewFeedback||[];p.reviewFeedback.push({reviewedAt:new Date().toISOString(),decision:"not_a_project"});stampProject(p,"Mission Control — Project Review");localStorage.setItem(KEY,JSON.stringify(state));closeModal("projectReviewModal");renderAll();await pushProjects(true)
}
function mergeProjectReview(){const p=state.projects.find(x=>x.id===prId.value);if(!p)return;const candidates=state.projects.filter(x=>x.id!==p.id&&!x.deleted&&!x.archived&&x.lifecycle!=="draft");const names=candidates.slice(0,12).map((x,i)=>(i+1)+". "+x.name).join("\n");const answer=prompt("Merge this draft into which existing project? Enter the number:\n\n"+names);const ix=Number(answer)-1;if(!Number.isInteger(ix)||!candidates[ix])return;const target=candidates[ix];target.notes=(target.notes?target.notes+"\n\n":"")+"Merged draft "+p.name+": "+(prOutcome.value.trim()||p.outcome||p.description||"");stampProject(target,"Mission Control — Project Review");p.deleted=true;p.lifecycle="deleted";p.reviewStatus="merged";p.mergedIntoProjectId=target.id;stampProject(p,"Mission Control — Project Review");localStorage.setItem(KEY,JSON.stringify(state));closeModal("projectReviewModal");renderAll();pushProjects(true)}
function renderProjects(){
  const ps=filteredProjects().sort((a,b)=>priorityScore(b)-priorityScore(a));projectCount.textContent=`${ps.length} shown`;
  projectBoard.innerHTML=ps.length?ps.map(p=>{const age=touchAge(p),ageClass=age>20?"bad":age>10?"warn":"";const dep=state.projects.find(x=>x.id===p.dependencyId);return `<article class="card" data-id="${p.id}"><div class="card-top"><div><h4>${esc(p.name)}</h4><div class="badges"><span class="badge">${esc(p.area)}</span><span class="badge ${attentionClass(p.attention)}">${esc(p.attention)}</span><span class="badge">${esc(p.status)}</span><span class="badge">${esc(p.priority)}</span>${stale(p)?`<span class="badge waiting">Stale ${touchAge(p)}d</span>`:""}</div></div><button class="btn ghost edit" data-id="${p.id}">Edit</button></div><div class="desc">${esc(p.description||"")}</div><div class="state"><b>Where we are:</b> ${esc(p.currentState||"—")}</div><div class="next"><b>Current next action</b>${esc(p.nextAction||"Define next action.")}</div><div class="meta"><div>Owner<b>${esc(p.owner||"—")}</b></div><div>Last touched<b class="age ${ageClass}">${age}d ago • ${esc(p.lastUpdatedBy||"Previous data")}</b></div><div>Waiting on<b>${esc(p.waitingOn||"Nothing")}</b></div><div>Dependency<b>${esc(dep?dep.name:"None")}</b></div></div><div class="progress"><div style="width:${Math.max(0,Math.min(100,Number(p.progress)||0))}%"></div></div></article>`}).join(""):`<div class="item"><b>No matching projects.</b></div>`;
  document.querySelectorAll(".edit").forEach(b=>b.onclick=e=>{e.stopPropagation();openProject(b.dataset.id)});document.querySelectorAll(".card").forEach(c=>c.onclick=e=>{if(!e.target.closest(".edit"))openProject(c.dataset.id)})
}
function renderActions(){
  const active=state.actions.filter(a=>!a.done);const derived=state.projects.filter(p=>p.status!=="Completed"&&p.nextAction&&!active.some(a=>a.projectId===p.id)).map(p=>({id:"derived-"+p.id,projectId:p.id,text:p.nextAction,derived:true}));
  const all=[...active,...derived];
  actionList.innerHTML=all.length?all.map(a=>{const p=state.projects.find(x=>x.id===a.projectId);return `<div class="action-row"><input type="checkbox" data-action="${a.id}" data-project="${a.projectId}"><div><b>${esc(a.text)}</b><small>${esc(p?p.name:"Project")} • ${esc(p?p.area:"")}</small></div><span class="badge ${p?attentionClass(p.attention):""}">${esc(p?p.attention:"")}</span></div>`}).join(""):`<div class="item"><b>No active actions.</b></div>`;
  document.querySelectorAll("[data-action]").forEach(cb=>cb.onchange=()=>completeAction(cb.dataset.action,cb.dataset.project))
}
function completeAction(aid,pid){
  const p=state.projects.find(x=>x.id===pid);let text=p?p.nextAction:"Action";
  if(aid.startsWith("derived-")){ensureAction(p);const a=state.actions.find(x=>x.projectId===pid&&!x.done);if(a){a.done=true;a.completedAt=new Date().toISOString();text=a.text;state.completedActions.push({...a})}}
  else{const a=state.actions.find(x=>x.id===aid);if(a){a.done=true;a.completedAt=new Date().toISOString();text=a.text;state.completedActions.push({...a})}}
  if(p)p.nextAction="";log("action_complete",pid,"Completed action: "+text);storage.save(state);renderAll();toast("Action completed")
}
function renderInbox(){
  inboxList.innerHTML=state.inbox.length?state.inbox.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(i=>`<div class="item"><b>${esc(i.text)}</b><span>${new Date(i.createdAt).toLocaleString()}</span><div class="review-actions"><button class="btn" data-promote="${i.id}">Promote to Project</button><button class="btn ghost" data-dismiss="${i.id}">Dismiss</button></div></div>`).join(""):`<div class="item"><b>Inbox is clear.</b><span>Nothing waiting to be organized.</span></div>`;
  document.querySelectorAll("[data-promote]").forEach(b=>b.onclick=()=>promoteInbox(b.dataset.promote));document.querySelectorAll("[data-dismiss]").forEach(b=>b.onclick=()=>{state.inbox=state.inbox.filter(x=>x.id!==b.dataset.dismiss);storage.save(state);renderInbox()})
}
function addCapture(text){if(!text.trim())return;state.inbox.push({id:"i"+Date.now(),text:text.trim(),createdAt:new Date().toISOString()});storage.save(state);renderInbox();toast("Captured to Inbox")}
function promoteInbox(id){const item=state.inbox.find(x=>x.id===id);if(!item)return;openProject("",item.text);state.inbox=state.inbox.filter(x=>x.id!==id);storage.save(state);renderInbox()}
function renderWeekly(){
  const ps=state.projects.filter(p=>p.status!=="Completed").sort((a,b)=>priorityScore(b)-priorityScore(a));
  reviewGrid.innerHTML=ps.map(p=>`<div class="review-card"><h4>${esc(p.name)}</h4><div class="badges"><span class="badge ${attentionClass(p.attention)}">${esc(p.attention)}</span><span class="badge">${touchAge(p)}d since update</span></div><p class="desc">${esc(p.outcome||p.description||"")}</p><div class="next"><b>Next</b>${esc(p.nextAction||"No next action defined.")}</div><div class="review-actions"><button class="btn" data-review="${p.id}" data-act="continue">Continue</button><button class="btn" data-review="${p.id}" data-act="needs">Needs Me</button><button class="btn" data-review="${p.id}" data-act="wait">Wait</button><button class="btn" data-review="${p.id}" data-act="park">Park</button><button class="btn" data-review="${p.id}" data-act="complete">Complete</button><button class="btn danger" data-review="${p.id}" data-act="kill">Kill</button></div></div>`).join("");
  document.querySelectorAll("[data-review]").forEach(b=>b.onclick=()=>applyReview(b.dataset.review,b.dataset.act))
}
function applyReview(id,act){const p=state.projects.find(x=>x.id===id);if(!p)return;if(act==="continue"){p.status="Active";p.attention="Moving"}if(act==="needs"){p.status="Today";p.attention="Needs John"}if(act==="wait"){p.status="Waiting / Blocked";p.attention="Waiting"}if(act==="park"){p.status="Incubator / Someday";p.attention="Parked"}if(act==="complete"){p.status="Completed";p.attention="Complete";p.progress=100}if(act==="kill"){p.status="Completed";p.attention="Complete";p.notes=(p.notes||"")+"\nKilled during weekly review."}stampProject(p);log("weekly_review",p.id,`Weekly review: ${act}`);storage.save(state);renderAll();toast("Weekly review updated")}
function renderWins(){
  const weekAgo=new Date(Date.now()-7*86400000).toISOString();const ca=state.completedActions.filter(a=>a.completedAt>=weekAgo);const cp=state.projects.filter(p=>p.status==="Completed"&&p.lastUpdate>=weekAgo.slice(0,10));const cleared=state.activity.filter(a=>a.ts>=weekAgo&&/waiting|block/i.test(a.text)&&/clear|resolved|done/i.test(a.text));const advanced=state.activity.filter(a=>a.ts>=weekAgo&&["update","weekly_review"].includes(a.type));
  winGrid.innerHTML=[[ca.length,"Actions completed"],[cp.length,"Projects completed"],[advanced.length,"Project advances"],[cleared.length,"Blockers cleared"]].map(x=>`<div class="win"><div class="n">${x[0]}</div><div class="l">${x[1]}</div></div>`).join("");
  recentActions.innerHTML=ca.length?ca.slice().sort((a,b)=>b.completedAt.localeCompare(a.completedAt)).map(a=>{const p=state.projects.find(x=>x.id===a.projectId);return `<div class="item"><b>${esc(a.text)}</b><span>${esc(p?p.name:"Project")} • ${new Date(a.completedAt).toLocaleString()}</span></div>`}).join(""):`<div class="item"><b>No completed actions this week.</b></div>`;
  recentProjects.innerHTML=cp.length?cp.map(p=>`<div class="item"><b>${esc(p.name)}</b><span>${esc(p.outcome||"")}</span></div>`).join(""):`<div class="item"><b>No projects completed this week.</b></div>`
}
function renderDependencies(){
  const deps=state.projects.filter(p=>p.dependencyId).map(p=>({down:p,up:state.projects.find(x=>x.id===p.dependencyId)})).filter(x=>x.up);
  dependencyList.innerHTML=deps.length?deps.map(x=>`<div class="dep-row"><div><b>${esc(x.down.name)}</b><small>${esc(x.down.attention)}</small></div><div class="arrow">depends on →</div><div><b>${esc(x.up.name)}</b><small>${esc(x.up.status)}</small></div></div>`).join(""):`<div class="item"><b>No dependencies defined.</b></div>`
}
function renderToday(){
  const ps=state.projects.filter(p=>attentionReasons(p).length).sort((a,b)=>priorityScore(b)-priorityScore(a));
  todayList.innerHTML=ps.length?ps.map((p,i)=>`<div class="focus-card" data-today="${p.id}"><div class="rank">#${i+1} • ${esc(p.area)} • ${esc(p.priority)}</div><h4 style="margin:5px 0">${esc(p.name)}</h4><div>${esc(p.nextAction||"Define next action.")}</div><div class="focus-reason">${esc(attentionReasons(p).join(" • "))}</div></div>`).join(""):`<div class="item"><b>Nothing requires attention today.</b></div>`;
  document.querySelectorAll("[data-today]").forEach(el=>el.onclick=()=>openProject(el.dataset.today))
}
function renderChanges(){
  const ps=state.projects.slice().sort((a,b)=>changeTime(b).localeCompare(changeTime(a)));
  changesList.innerHTML=ps.length?ps.map(p=>`<div class="item" data-changed-project="${p.id}" style="cursor:pointer"><b>${esc(p.name)}</b><span>${new Date(changeTime(p)).toLocaleString()} • ${esc(p.lastUpdatedBy||"Previous data")}</span><small>${esc(p.currentState||p.nextAction||"Project updated")}</small></div>`).join(""):`<div class="item"><b>No project changes yet.</b></div>`;
  document.querySelectorAll("[data-changed-project]").forEach(el=>el.onclick=()=>openProject(el.dataset.changedProject))
}
function mealDateKey(d){return d.toISOString().slice(0,10)}
function mealWeekStart(d=new Date()){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()),day=x.getDay();x.setDate(x.getDate()-((day+6)%7));return x}
function ensureMealWeek(){
  state.meals=state.meals||{};state.meals.mealHistory=state.meals.mealHistory||[{"id":"hist-1","name":"Blackstone chicken fajitas","status":"approved_history"},{"id":"hist-2","name":"Smash burgers","status":"approved_history"},{"id":"hist-3","name":"Chicken fried rice","status":"approved_history"},{"id":"hist-4","name":"Sausage, potatoes & green beans","status":"approved_history"},{"id":"hist-5","name":"Walking tacos","status":"approved_history"},{"id":"hist-6","name":"Chicken bacon ranch wraps","status":"approved_history"},{"id":"hist-7","name":"Spaghetti with meat sauce","status":"approved_history"},{"id":"hist-8","name":"BBQ pulled pork sandwiches","status":"approved_history"},{"id":"hist-9","name":"Breakfast for dinner","status":"approved_history"},{"id":"hist-10","name":"Chicken hibachi","status":"approved_history"},{"id":"hist-11","name":"Sloppy joes","status":"approved_history"},{"id":"hist-12","name":"Chicken nuggets, fries & produce","status":"approved_history"},{"id":"hist-13","name":"Salsa chicken tacos","status":"approved_history"},{"id":"hist-14","name":"Loaded baked potatoes","status":"approved_history"},{"id":"hist-15","name":"Turkey tacos","status":"approved_history"},{"id":"hist-16","name":"Garlic-herb chicken thighs","status":"approved_history"},{"id":"hist-17","name":"Pancakes, eggs & sausage","status":"approved_history"}];state.meals.catalog=state.meals.catalog||{source:"Butler Walmart Master Catalog.xlsx",itemCount:160,mealPlanEligibleCount:96,lastImported:"2026-10-01"};state.meals.planningRules=state.meals.planningRules||["Dairy-free default","Cam dislikes rice — avoid rice-based dinners","Monday should be extra easy","Use leftovers deliberately","Check inventory before buying","No unnecessary midweek grocery run","Prefer Walmart; Aldi secondary","Use Blackstone-friendly meals when useful","Do not assume stale perishable inventory is still on hand"];const start=mealWeekStart(),key=mealDateKey(start);
  if(!state.meals.weekStart){state.meals.weekStart=key}
  if(!Array.isArray(state.meals.days)||!state.meals.days.length){state.meals.days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return{date:mealDateKey(d),meal:"",prep:"",status:"draft",recipe:{servings:"",time:"",ingredients:[],instructions:"",notes:""}}})}
  state.meals.groceryList=state.meals.groceryList||[];state.meals.inventory=state.meals.inventory||[];
}
function renderMeals(){
  ensureMealWeek();const m=state.meals;m.days.forEach(x=>{x.recipe=x.recipe||{servings:"",time:"",ingredients:[],instructions:"",notes:""};x.recipe.ingredients=Array.isArray(x.recipe.ingredients)?x.recipe.ingredients:[]});const todayKey=today(),todayMeal=m.days.find(x=>x.date===todayKey),planned=m.days.filter(x=>x.meal).length,groceries=m.groceryList.filter(x=>!x.done).length;
  mealWeekLabel.textContent="Week of "+new Date(m.weekStart+"T12:00:00").toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"})+" • "+(m.status==="approved"?"Approved household plan":"Draft plan");
  mealHeroGrid.innerHTML=[[todayMeal&&todayMeal.meal?todayMeal.meal:"Not planned","Dinner tonight",todayMeal&&todayMeal.prep?todayMeal.prep:"No prep note"],[planned+"/7","Meals planned","Across the current week"],[groceries,"Groceries left","Unchecked shared-list items"],[m.settings&&m.settings.primaryStore||"Walmart","Primary store","Shopping list default"]].map(x=>`<div class="hero-stat"><div class="n" style="font-size:${String(x[0]).length>18?"18px":"28px"}">${esc(x[0])}</div><div class="l">${x[1]}</div><div class="d">${esc(x[2])}</div></div>`).join("");
  mealWeek.innerHTML=m.days.map((x,i)=>{const d=new Date(x.date+"T12:00:00"),label=d.toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});return `<div class="item" style="display:grid;grid-template-columns:120px minmax(0,1fr);gap:10px;align-items:center"><div><b>${label}</b>${x.date===todayKey?'<span style="display:block;color:var(--accent);font-size:10px">TODAY</span>':''}</div><div><input class="field meal-name" autocomplete="off" autocapitalize="sentences" data-meal-index="${i}" value="${esc(x.meal||"")}" placeholder="Dinner"><input class="field meal-prep" autocomplete="off" autocapitalize="sentences" data-prep-index="${i}" value="${esc(x.prep||"")}" placeholder="Optional prep note" style="margin-top:6px"><button class="btn meal-recipe-btn" data-recipe-index="${i}" type="button" style="margin-top:6px">${x.recipe&&x.recipe.ingredients&&x.recipe.ingredients.length?"View / Edit Recipe":"Add Recipe"}</button></div></div>`}).join("");
  groceryList.innerHTML=m.groceryList.length?m.groceryList.map((x,i)=>`<div class="item"><label style="display:flex;gap:9px;align-items:center"><input type="checkbox" data-grocery-index="${i}" ${x.done?"checked":""}><span style="${x.done?"text-decoration:line-through;opacity:.6":""}">${esc(x.item||"")}${x.qty?" • "+esc(x.qty):""}</span></label></div>`).join(""):'<div class="item"><b>No grocery items yet.</b><span>Approve a meal plan or add something manually.</span></div>';
  mealInventory.innerHTML=m.inventory.length?m.inventory.map((x,i)=>`<div class="item"><b>${esc(x.item||"")}</b><span>${esc(x.qty||"On hand")}</span><button class="btn ghost" data-inventory-remove="${i}" style="margin-top:6px">Remove</button></div>`).join(""):'<div class="item"><b>No tracked inventory yet.</b><span>Only add useful staples, leftovers, freezer items, or ingredients that affect the next plan.</span></div>';
  document.querySelectorAll(".meal-name").forEach(el=>el.oninput=()=>{m.days[Number(el.dataset.mealIndex)].meal=el.value;m.status="draft"});
  document.querySelectorAll(".meal-prep").forEach(el=>el.oninput=()=>{m.days[Number(el.dataset.prepIndex)].prep=el.value});
  document.querySelectorAll(".meal-recipe-btn").forEach(el=>el.onclick=()=>openMealRecipe(Number(el.dataset.recipeIndex)));
  document.querySelectorAll("[data-grocery-index]").forEach(el=>el.onchange=()=>{m.groceryList[Number(el.dataset.groceryIndex)].done=el.checked;saveMeals(false)});
  document.querySelectorAll("[data-inventory-remove]").forEach(el=>el.onclick=()=>{m.inventory.splice(Number(el.dataset.inventoryRemove),1);saveMeals(false);renderMeals()});
}
function openMealRecipe(i){const x=state.meals.days[i];if(!x)return;x.recipe=x.recipe||{servings:"",time:"",ingredients:[],instructions:"",notes:""};mealRecipeIndex.value=String(i);mealRecipeTitle.textContent=(x.meal||"Meal")+" Recipe";mealRecipeServings.value=x.recipe.servings||"";mealRecipeTime.value=x.recipe.time||"";mealRecipeIngredients.value=(x.recipe.ingredients||[]).join("\n");mealRecipeInstructions.value=x.recipe.instructions||"";mealRecipeNotes.value=x.recipe.notes||"";openModal("mealRecipeModal")}
function saveMealRecipe(){const i=Number(mealRecipeIndex.value),x=state.meals.days[i];if(!x)return;x.recipe={servings:mealRecipeServings.value.trim(),time:mealRecipeTime.value.trim(),ingredients:mealRecipeIngredients.value.split("\n").map(v=>v.trim()).filter(Boolean),instructions:mealRecipeInstructions.value.trim(),notes:mealRecipeNotes.value.trim()};state.meals.status="draft";saveMeals(false);closeModal("mealRecipeModal");renderMeals();toast("Recipe saved")}
function addRecipeIngredientsToGrocery(){const i=Number(mealRecipeIndex.value),x=state.meals.days[i];if(!x)return;const ingredients=mealRecipeIngredients.value.split("\n").map(v=>v.trim()).filter(Boolean),existing=new Set(state.meals.groceryList.map(g=>String(g.item||"").toLowerCase()));let added=0;ingredients.forEach(item=>{if(!existing.has(item.toLowerCase())){state.meals.groceryList.push({item,qty:"",done:false,sourceMeal:x.meal||"",addedAt:new Date().toISOString()});existing.add(item.toLowerCase());added++}});saveMeals(false);renderMeals();toast(added+" ingredient"+(added===1?"":"s")+" added to grocery list")}
async function loadMeals(){
  try{const r=await fetch("/api/meals?t="+Date.now(),{cache:"no-store"});const x=await r.json();if(x&&x.ok&&x.meals){state.meals=x.meals.draft||x.meals.approved||x.meals;state.meals._durable=x.meals;localStorage.setItem(KEY,JSON.stringify(state));renderMeals();return true}}catch(e){}return false
}
function durableMealsPayload(){
  ensureMealWeek();const existing=(state.meals&&state.meals._durable)||{};const draft={weekStart:state.meals.weekStart||"",days:state.meals.days||[],groceryList:state.meals.groceryList||[],inventory:state.meals.inventory||[],settings:state.meals.settings||{},updatedAt:new Date().toISOString()};
  return {...existing,schemaVersion:1,householdId:"butler-household",draft,recipes:existing.recipes||[],groceryList:draft.groceryList,inventory:draft.inventory,rules:{...(existing.rules||{}),...(draft.settings||{})},mealHistory:existing.mealHistory||[],catalog:existing.catalog||{driveFileId:"1dl5niCGaXh4jPwPD9drZcYKoa9u2b6fH",name:"Butler Walmart Master Catalog.xlsx",itemCount:160,mealPlanEligibleCount:96}}
}
async function saveMeals(show=true){
  ensureMealWeek();state.meals.updatedAt=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(state));const btn=document.getElementById("saveMealsBtn"),status=document.getElementById("mealSaveStatus");if(btn){btn.disabled=true;btn.textContent="Saving…"}if(status){status.textContent="Saving draft to Butler Household…";status.style.color="var(--muted)"}
  try{const r=await fetch("/api/meals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({operation:"save_draft",actor:"Mission Control App",meals:durableMealsPayload()})});const x=await r.json();if(!r.ok||!x.ok)throw new Error(x.error||("Save failed ("+r.status+")"));state.meals._durable=x.meals;const when=new Date().toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});if(status){status.textContent="Draft saved ✓ "+when;status.style.color="var(--good)"}if(btn)btn.textContent="Saved ✓";if(show)toast("Meal-plan draft saved to Butler Household");setTimeout(()=>{if(btn)btn.textContent="Save Draft"},1800);return true}catch(e){if(status){status.textContent="Not saved to shared Meals — "+String(e.message||e);status.style.color="var(--bad)"}if(btn)btn.textContent="Save Draft";if(show)toast("Shared Meals save failed");return false}finally{if(btn)btn.disabled=false}
}
async function approveMeals(){
  const ok=await saveMeals(false);if(!ok){toast("Cannot approve until the shared draft saves");return}
  try{const r=await fetch("/api/meals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({operation:"approve",actor:"Mission Control App",meals:durableMealsPayload()})});const x=await r.json();if(!x.ok)throw new Error(x.error||"Approval failed");state.meals._durable=x.meals;state.meals.status="approved";localStorage.setItem(KEY,JSON.stringify(state));renderMeals();toast("Week approved for Butler Household")}catch(e){toast("Week was not approved — "+String(e.message||e))}
}
function planNextWeek(){
  ensureMealWeek();const current=state.meals.days.map(x=>x.meal).filter(Boolean),start=mealWeekStart(new Date(Date.now()+7*86400000));state.meals.weekStart=mealDateKey(start);state.meals.days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return{date:mealDateKey(d),meal:i===0?"Easy Monday — choose a simple family meal":"",prep:"",status:"draft"}});state.meals.status="draft";state.meals.updatedAt=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(state));renderMeals();toast("Next week draft created — review before approval")}
function addGrocery(){const item=prompt("Add grocery item");if(!item)return;state.meals.groceryList.push({item:item.trim(),qty:"",done:false,addedAt:new Date().toISOString()});saveMeals(false);renderMeals()}
function addInventory(){const item=prompt("What do you already have?");if(!item)return;const qty=prompt("Quantity or note (optional)")||"On hand";state.meals.inventory.push({item:item.trim(),qty:qty.trim(),updatedAt:new Date().toISOString()});saveMeals(false);renderMeals()}
function renderAll(){renderDate();renderHome();renderToday();renderChanges();renderChips();renderProjects();renderProjectReviews();renderActions();renderInbox();renderWeekly();renderWins();renderDependencies();renderMeals()}
function openModal(id){document.getElementById(id).classList.add("show")}function closeModal(id){document.getElementById(id).classList.remove("show")}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
function openProject(id="",prefill=""){
  selectedProject=id||null;const p=state.projects.find(x=>x.id===id);projectModalTitle.textContent=p?"Edit Project":"New Project";deleteProject.classList.toggle("hidden",!p);
  const depOptions='<option value="">No dependency</option>'+state.projects.filter(x=>x.id!==id&&x.status!=="Completed").map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("");pDependency.innerHTML=depOptions;
  pId.value=p?p.id:"";pName.value=p?p.name:"";pArea.value=p?p.area:AREAS[0];pStatus.value=p?p.status:"Active";pPriority.value=p?p.priority:"Normal";pAttention.value=p?p.attention:"Needs John";pOwner.value=p?p.owner:"John";pDesc.value=p?p.description:prefill;pOutcome.value=p?p.outcome:"";pDoneDef.value=p?p.doneDefinition:"";pCurrent.value=p?p.currentState:"";pNext.value=p?p.nextAction:"";pWaiting.value=p?p.waitingOn:"";pWaitingSince.value=p?p.waitingSince:"";pFollow.value=p?p.followupDate:"";pDeadline.value=p?p.deadline:"";pMilestone.value=p?p.milestone:"";pMilestoneDate.value=p?p.milestoneDate:"";pProgress.value=p?p.progress:0;pDependency.value=p?p.dependencyId:"";pTags.value=p?(p.tags||[]).join(", "):"";pNotes.value=p?p.notes:"";openModal("projectModal")
}
async function saveProjectData(){
  let p=state.projects.find(x=>x.id===pId.value),isNew=!p;if(!p){p={id:"p"+Date.now()};state.projects.push(p)}
  Object.assign(p,{name:pName.value.trim()||"Untitled Project",area:pArea.value,status:pStatus.value,priority:pPriority.value,attention:pAttention.value,owner:pOwner.value.trim()||"John",description:pDesc.value.trim(),outcome:pOutcome.value.trim(),doneDefinition:pDoneDef.value.trim(),currentState:pCurrent.value.trim(),nextAction:pNext.value.trim(),waitingOn:pWaiting.value.trim(),waitingSince:pWaitingSince.value,followupDate:pFollow.value,deadline:pDeadline.value,milestone:pMilestone.value.trim(),milestoneDate:pMilestoneDate.value,progress:Number(pProgress.value)||0,dependencyId:pDependency.value,tags:pTags.value.split(",").map(x=>x.trim()).filter(Boolean),notes:pNotes.value.trim()});stampProject(p);
  ensureAction(p);log(isNew?"project_create":"project_edit",p.id,isNew?"Project created.":"Project edited.");
  localStorage.setItem(KEY,JSON.stringify(state));
  closeModal("projectModal");
  renderAll();
  setSyncStatus("Syncing…","Project saved locally. Sending this change to shared data now.");
  await pushProjects(true)
}
async function deleteProjectData(){const id=pId.value;if(!id)return;const p=state.projects.find(x=>x.id===id);if(!p)return;if(confirm("Remove this project from active Mission Control? It will be retained for recovery/history.")){p.deleted=true;p.deletedAt=new Date().toISOString();p.deletedBy=sourceLabel();p.status="Completed";p.attention="Complete";stampProject(p);state.actions=state.actions.filter(a=>a.projectId!==id);state.projects.forEach(x=>{if(x.dependencyId===id)x.dependencyId=""});localStorage.setItem(KEY,JSON.stringify(state));closeModal("projectModal");renderAll();setSyncStatus("Syncing…","Saving durable project removal.");const ok=await pushProjects(false);toast(ok?"Project removed":"Project removed locally; sync will retry")}}
function openUpdate(id=""){uProject.innerHTML=state.projects.filter(p=>p.status!=="Completed").sort((a,b)=>a.name.localeCompare(b.name)).map(p=>`<option value="${p.id}">${esc(p.name)} — ${esc(p.area)}</option>`).join("");if(id)uProject.value=id;loadUpdate();openModal("updateModal")}
function loadUpdate(){const p=state.projects.find(x=>x.id===uProject.value);if(!p)return;uText.value="";uStatus.value=p.status;uAttention.value=p.attention;uCurrent.value=p.currentState||"";uNext.value=p.nextAction||"";uWaiting.value=p.waitingOn||"";uFollow.value=p.followupDate||"";uProgress.value=p.progress||0}
function interpret(){
  const txt=uText.value.trim(),l=txt.toLowerCase();if(!txt)return;uCurrent.value=txt;
  if(/\b(waiting|awaiting|shipped|delivery|approval|response)\b/.test(l)){uAttention.value="Waiting";uStatus.value="Waiting / Blocked";if(!uWaiting.value)uWaiting.value=l.includes("prodigi")?"Prodigi":l.includes("recruiter")?"Recruiter":"External dependency"}
  if(/\b(done|finished|completed)\b/.test(l)&&!/\b(demo|framing).*complete/.test(l)){uStatus.value="Completed";uAttention.value="Complete";uProgress.value=100}
  if(/\b(tomorrow|next)\b/.test(l)){const m=txt.match(/(?:tomorrow|next)\s+([^.!?]+)/i);if(m)uNext.value=m[0]}
  if(/\bnothing needed from me\b/.test(l)){uAttention.value="Waiting";uNext.value="No action until the dependency clears."}
}
async function saveUpdateData(){
  const p=state.projects.find(x=>x.id===uProject.value);if(!p)return;const priorWait=p.waitingOn;
  p.status=uStatus.value;p.attention=uAttention.value;p.currentState=uCurrent.value.trim();p.nextAction=uNext.value.trim();p.waitingOn=uWaiting.value.trim();p.followupDate=uFollow.value;p.progress=Number(uProgress.value)||0;stampProject(p);if(p.waitingOn&&!priorWait&&!p.waitingSince)p.waitingSince=today();if(!p.waitingOn)p.waitingSince="";ensureAction(p);log("update",p.id,uText.value.trim()||"Project updated.");
  localStorage.setItem(KEY,JSON.stringify(state));
  closeModal("updateModal");
  renderAll();
  setSyncStatus("Syncing…","Project update saved locally. Sending this change to shared data now.");
  await pushProjects(true)
}
function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="mission-control-v5-data.json";a.click();URL.revokeObjectURL(a.href)}
function importData(file){const r=new FileReader();r.onload=()=>{try{const x=migrate(JSON.parse(r.result));if(!Array.isArray(x.projects))throw 0;state=x;storage.save(state);renderAll();toast("Data imported")}catch(e){alert("Invalid Mission Control export.")}};r.readAsText(file)}

document.querySelectorAll(".nav button").forEach(b=>b.onclick=()=>switchPage(b.dataset.page));
newProjectBtn.onclick=()=>openProject();quickUpdateBtn.onclick=()=>openUpdate();captureBtn.onclick=()=>openModal("captureModal");
(()=>{const by=id=>document.getElementById(id);const bind=(id,fn)=>{const el=by(id);if(el)el.addEventListener("click",fn)};bind("mealRecipeSave",saveMealRecipe);bind("mealIngredientsToGrocery",addRecipeIngredientsToGrocery);bind("addGroceryBtn",addGrocery);bind("addInventoryBtn",addInventory)})();
saveProject.onclick=saveProjectData;deleteProject.onclick=deleteProjectData;prApprove.onclick=approveProjectReview;prReject.onclick=rejectProjectReview;prMerge.onclick=mergeProjectReview;uProject.onchange=loadUpdate;interpretUpdate.onclick=interpret;saveUpdate.onclick=saveUpdateData;
saveCapture.onclick=()=>{addCapture(captureText.value);captureText.value=""};captureModalSave.onclick=()=>{addCapture(captureModalText.value);captureModalText.value="";closeModal("captureModal")};
[search,filterArea,filterStatus,filterAttention,filterPriority].forEach(el=>el.addEventListener(el===search?"input":"change",renderProjects));resetFilters.onclick=()=>{search.value="";filterArea.value="";filterStatus.value="";filterAttention.value="";filterPriority.value="";quickFilter="All";renderChips();renderProjects()};
exportBtn.onclick=exportData;importFile.onchange=e=>e.target.files[0]&&importData(e.target.files[0]);
saveSyncBtn.onclick=saveSyncConfig;syncNowBtn.onclick=syncNow;initSyncUI();setInterval(()=>{if(syncConfig().url&&syncConfig().token&&!document.hidden)pullProjects(false)},60000);document.querySelectorAll(".modal-backdrop").forEach(m=>m.onclick=e=>{if(e.target===m)closeModal(m.id)});
populateFilters();renderAll();loadMeals();
