// Identity/Auth directory deployment checkpoint 2026-10-02
/**
 * Mission Control V5 — conflict-safe Google Sheets shared project source
 * Authentication secrets are stored only in Apps Script Script Properties; never in source.
 */
const SHEET_NAME = 'Projects';
const MC_BUILD_ID = '2026-10-02-auth-hardening-v3';
// Replaced only in staged release source; unstamped local/editor copies are unverified.
const MC_SOURCE_SHA = 'unversioned';
const MC_CANONICAL_SHA256 = 'unversioned';
const HEADERS = [
'id','name','area','status','priority','attention','owner','description','outcome',
'doneDefinition','currentState','nextAction','waitingOn','waitingSince','followupDate',
'deadline','milestone','milestoneDate','progress','tags','notes','dependencyId','lastUpdate',
'lastUpdatedAt','lastUpdatedBy','financeData','agendaData'
];

function setupSheet(){const ss=SpreadsheetApp.getActive();let sh=ss.getSheetByName(SHEET_NAME);if(!sh)sh=ss.insertSheet(SHEET_NAME);ensureHeaders_(sh);sh.setFrozenRows(1);sh.autoResizeColumns(1,HEADERS.length)}

function doGet(e){try{authorize_(e&&e.parameter&&e.parameter.token);const resource=String((e&&e.parameter&&e.parameter.resource)||"projects");if(resource==="meals")return json_({ok:true,meals:readMeals_()});return json_({ok:true,projects:readProjects_()})}catch(err){return json_({ok:false,error:String(err.message||err)})}}

function rejectUnknownFields_(body,allowed){const unknown=Object.keys(body||{}).filter(k=>!allowed.includes(k));if(unknown.length)throw new Error("UNSUPPORTED_FIELDS:"+unknown.join(","))}
function doPost(e){try{
  const body=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');
  authorize_(body.token);
  if(body.resource==="member_meals_edit")return json_(editMemberMeals_(body));
  if(body.resource==="member_dashboard")return json_(readMemberDashboard_(body));
  if(body.resource==="member_setup")return json_(memberSetup_(body));
  if(body.resource==="system_diagnostics"){
    rejectUnknownFields_(body,["token","resource","operation","householdId","actor"]);
    if(body.operation!=="read")throw new Error("DIAGNOSTICS_READ_ONLY");
    return json_(readSystemDiagnostics_(body));
  }
  if(body.resource==="household_invitation"){if(body.operation==="create"){rejectUnknownFields_(body,["token","resource","operation","actorUserId","householdId","role","tokenHash","expiresAt"]);return json_(createHouseholdInvitation_(String(body.actorUserId||""),String(body.householdId||""),String(body.role||""),String(body.tokenHash||""),String(body.expiresAt||"")))}if(body.operation==="claim"){rejectUnknownFields_(body,["token","resource","operation","identity","inviteToken"]);return json_(claimHouseholdInvitation_(body.identity||{},String(body.inviteToken||"")))}if(body.operation==="revoke"){rejectUnknownFields_(body,["token","resource","operation","actorUserId","invitationId"]);return json_(revokeHouseholdInvitation_(String(body.actorUserId||""),String(body.invitationId||"")))}throw new Error("Unsupported household invitation operation")}
  if(body.resource==="project_trusted_operation"){if(PropertiesService.getScriptProperties().getProperty("PROJECT_V1_TRUSTED_DISPATCH")!=="enabled")throw new Error("PROJECT_V1_TRUSTED_DISPATCH_DISABLED");rejectUnknownFields_(body,["token","resource","operationId","householdId","actor","operation","projectId","expectedVersion","patch"]);if(!body.operationId)throw new Error("operationId required");if(body.householdId!=="butler-household")throw new Error("Household not permitted");if(!body.actor)throw new Error("Actor required");const lock=LockService.getScriptLock();lock.waitLock(30000);try{const prior=projectOperationAuditRecord_(body.operationId);if(prior){if(!projectOperationFingerprintMatches_(prior,body))throw new Error("CONFLICT: operationId reused with different request");const status=String(prior.row[9]),saved=JSON.parse(String(prior.row[10]||"{}"));if(status==="SUCCESS")return json_(Object.assign({},saved,{replayed:true}));if(status==="FAILED")throw new Error(String(saved.error||status));throw new Error("UNKNOWN: prior Project operation outcome requires reconciliation")}const before=findProjectResource_(body.projectId),pv=before?Number(before.version||1):0;let result;try{result=trustedProjectOperation_(body);SpreadsheetApp.flush()}catch(err){const msg=String(err.message||err),definitive=/^(INVALID|CONFLICT|FORBIDDEN):/.test(msg);if(definitive){try{appendProjectOperationAudit_(body,"FAILED",{error:msg},pv,"","Trusted principal Project operation rejected before commit");SpreadsheetApp.flush()}catch(auditErr){console.error("Project failure audit write failed",auditErr)}throw err}throw new Error("UNKNOWN: Project mutation outcome uncertain; reconcile operationId and Project readback before retry. Cause="+msg)}try{appendProjectOperationAudit_(body,"SUCCESS",result,pv,result.newVersion,"Trusted principal Project operation committed");SpreadsheetApp.flush()}catch(auditErr){throw new Error("UNKNOWN: Project mutation committed but success audit persistence failed; reconcile operationId and Project readback before retry. Cause="+String(auditErr.message||auditErr))}return json_(result)}finally{try{SpreadsheetApp.flush()}catch(flushErr){console.error("Trusted Project cleanup flush failed",flushErr)}finally{lock.releaseLock()}}}
  if(body.resource==="projects"){if(body.operation!=="legacy_merge")throw new Error("Unsupported project operation");if(body.householdId!=="butler-household")throw new Error("Household not permitted");if(!Array.isArray(body.projects))throw new Error("projects array required");const merged=mergeProjects_(readProjects_(),body.projects);writeProjects_(merged);return json_({ok:true,count:merged.length,projects:merged,updatedAt:new Date().toISOString()})}
  if(body.resource==="identity_directory"){if(body.operation==="resolve"){rejectUnknownFields_(body,["token","resource","operation","provider","subject","householdId"]);const result=resolveIdentityDirectory_(String(body.provider||""),String(body.subject||""),String(body.householdId||""));if(!result.ok)result.auditOk=authAudit_("DIRECTORY_DENIED","",String(body.householdId||""),"","identity","resolve",result.reason||"DENIED","No sensitive identity attributes logged");return json_(result)}if(body.operation==="bootstrap_first_principal"){rejectUnknownFields_(body,["token","resource","operation","identity"]);try{const result=bootstrapFirstPrincipal_(body.identity||{});result.auditOk=authAudit_("BOOTSTRAP_SUCCESS",result.userId,result.householdId,result.role,"identity","bootstrap","SUCCESS","First principal bootstrap");return json_(result)}catch(err){const auditOk=authAudit_("BOOTSTRAP_DENIED","","","","identity","bootstrap","DENIED",String(err.message||err));if(!auditOk)throw new Error(String(err.message||err)+"|AUDIT_WRITE_FAILED");throw err}}throw new Error("Unsupported identity directory operation")}
  if(body.resource==="meals"){const meals=writeMealsWithLock_(body.meals,body.operation||"save_draft",body.actor||"Mission Control",body.expectedVersion);return json_({ok:true,meals:meals,updatedAt:new Date().toISOString()})}
  throw new Error("Explicit resource required");
}catch(err){return json_({ok:false,error:String(err.message||err)})}}

function onEdit(e){try{
  if(!e||!e.range)return;const sh=e.range.getSheet();if(sh.getName()!==SHEET_NAME||e.range.getRow()<2)return;
  ensureHeaders_(sh);const map=headerMap_(sh),now=new Date();
  for(let r=e.range.getRow();r<=e.range.getLastRow();r++){
    if(map.lastUpdate)sh.getRange(r,map.lastUpdate).setValue(Utilities.formatDate(now,Session.getScriptTimeZone(),'yyyy-MM-dd'));
    if(map.lastUpdatedAt)sh.getRange(r,map.lastUpdatedAt).setValue(now.toISOString());
    if(map.lastUpdatedBy)sh.getRange(r,map.lastUpdatedBy).setValue('Google Sheet');
  }
}catch(err){console.error(err)}}

function authorize_(token){const expected=PropertiesService.getScriptProperties().getProperty("SYNC_TOKEN");if(!expected)throw new Error("Set SYNC_TOKEN Script Property first.");const supplied=String(token||"");if(supplied.length!==expected.length)throw new Error("Unauthorized");let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^supplied.charCodeAt(i);if(diff!==0)throw new Error("Unauthorized")}

function readProjects_(){return readProjectsFromSheet_(getSheet_())}
function readProjectsFromSheet_(sh){ensureHeaders_(sh);const range=sh.getDataRange(),values=range.getValues(),display=range.getDisplayValues();if(values.length<2)return[];
  const headers=values[0].map(String),dateOnly=new Set(["waitingSince","followupDate","deadline","milestoneDate","lastUpdate"]),out=[];
  for(let sheetRowIx=1;sheetRowIx<values.length;sheetRowIx++){const row=values[sheetRowIx];if(!row.some(v=>v!==''))continue;const p={};headers.forEach((h,i)=>{let v=row[i];
    if(dateOnly.has(h)&&v instanceof Date){const shown=String(display[sheetRowIx][i]||"").trim(),m=shown.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);v=m?(m[3]+"-"+m[1].padStart(2,"0")+"-"+m[2].padStart(2,"0")):Utilities.formatDate(v,SpreadsheetApp.getActive().getSpreadsheetTimeZone(),"yyyy-MM-dd")}
    else if(v instanceof Date)v=h==='lastUpdatedAt'?v.toISOString():Utilities.formatDate(v,SpreadsheetApp.getActive().getSpreadsheetTimeZone(),'yyyy-MM-dd');
    if(h==='progress')v=Number(v||0);if(h==='tags')v=String(v||'').split(',').map(s=>s.trim()).filter(Boolean);
    p[h]=(v===null||v===undefined)?'':v});
    if(!p.lastUpdatedAt)p.lastUpdatedAt=(p.lastUpdate||'1970-01-01')+'T12:00:00.000Z';
    if(!p.lastUpdatedBy)p.lastUpdatedBy='Previous data';out.push(p)}
  return out}

function validateProjectInteriorBlankDateRegression_(){const ss=SpreadsheetApp.getActive(),name="__ProjectDateRegression";let sh=ss.getSheetByName(name);if(sh)ss.deleteSheet(sh);sh=ss.insertSheet(name);try{sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);const a=new Array(HEADERS.length).fill(""),b=new Array(HEADERS.length).fill("");a[0]="date-reg-a";a[1]="Date Regression A";a[15]=new Date(2026,9,8);b[0]="date-reg-b";b[1]="Date Regression B";b[15]=new Date(2026,9,9);sh.getRange(2,1,1,HEADERS.length).setValues([a]);sh.getRange(4,1,1,HEADERS.length).setValues([b]);sh.getRange("P2").setNumberFormat("M/d/yyyy");sh.getRange("P4").setNumberFormat("M/d/yyyy");const read=readProjectsFromSheet_(sh),pa=read.find(x=>x.id==="date-reg-a"),pb=read.find(x=>x.id==="date-reg-b"),ok=read.length===2&&pa&&pb&&pa.deadline==="2026-10-08"&&pb.deadline==="2026-10-09";return{ok,count:read.length,a:pa?pa.deadline:null,b:pb?pb.deadline:null,blankRowIgnored:read.length===2}}finally{ss.deleteSheet(sh)}}
function mergeProjects_(serverProjects,incomingProjects){const server=new Map(serverProjects.map(p=>[String(p.id),p])),incoming=new Map(incomingProjects.map(p=>[String(p.id),p])),ids=new Set([...server.keys(),...incoming.keys()]),merged=[];
  ids.forEach(id=>{const s=server.get(id),i=incoming.get(id);if(!s){merged.push(normalizeProject_(i));return}if(!i){merged.push(normalizeProject_(s));return}
    const st=Date.parse(s.lastUpdatedAt||((s.lastUpdate||'1970-01-01')+'T12:00:00.000Z'))||0;
    const it=Date.parse(i.lastUpdatedAt||((i.lastUpdate||'1970-01-01')+'T12:00:00.000Z'))||0;
    merged.push(normalizeProject_(it>=st?i:s))});return merged}

function normalizeProject_(p){const out=Object.assign({},p||{});if(!out.lastUpdate)out.lastUpdate=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');if(!out.lastUpdatedAt)out.lastUpdatedAt=new Date().toISOString();if(!out.lastUpdatedBy)out.lastUpdatedBy='Unknown source';return out}

function writeProjects_(projects){const sh=getSheet_();ensureHeaders_(sh);const rows=projects.map(p=>HEADERS.map(h=>{const v=p[h];if(h==='tags')return Array.isArray(v)?v.join(', '):(v||'');return(v===null||v===undefined)?'':v}));
  const currentRows=Math.max(sh.getLastRow()-1,0);if(currentRows)sh.getRange(2,1,currentRows,HEADERS.length).clearContent();if(rows.length)sh.getRange(2,1,rows.length,HEADERS.length).setValues(rows);sh.setFrozenRows(1)}

function mealsSheet_(){const ss=SpreadsheetApp.getActive();let sh=ss.getSheetByName("Meals");if(!sh){sh=ss.insertSheet("Meals");sh.getRange(1,1,1,8).setValues([["key","householdId","schemaVersion","updatedAt","updatedBy","status","json","notes"]])}return sh}
function readMeals_(){const sh=mealsSheet_();if(sh.getLastRow()<2)return null;const raw=sh.getRange(2,7).getValue();if(!raw)return null;const o=typeof raw==="object"?raw:JSON.parse(String(raw));if(!o.version)o.version=1;return o}
// Human requests acquire the same ScriptLock already held by the Dot processor.
// Keep writeMeals_ lock-free internally so the queue does not acquire it twice.
function writeMealsWithLock_(incoming,operation,actor,expectedVersion){
  const lock=LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    try{
      const meals=writeMeals_(incoming,operation,actor,expectedVersion);
      SpreadsheetApp.flush();
      return meals;
    }catch(err){
      const message=String(err.message||err);
      if(/^CONFLICT:/.test(message)||["meals object required","No draft meal plan to approve","Unsupported meals operation"].includes(message))throw err;
      throw new Error("UNKNOWN: Meals write persistence could not be confirmed; check shared Meals before retry. Cause="+message);
    }
  }finally{
    try{SpreadsheetApp.flush()}catch(flushErr){console.error("Meals cleanup flush failed",flushErr)}finally{lock.releaseLock()}
  }
}
function writeMeals_(incoming,operation,actor,expectedVersion){if(!incoming||typeof incoming!=="object")throw new Error("meals object required");const sh=mealsSheet_(),current=readMeals_()||{version:0};const cv=Number(current.version||1);if(expectedVersion!==undefined&&expectedVersion!==null&&Number(expectedVersion)!==cv)throw new Error("CONFLICT: expected Meals version "+expectedVersion+" but current version is "+cv);let next=Object.assign({},current,incoming);next.schemaVersion=Number(next.schemaVersion||1);next.householdId=next.householdId||"butler-household";next.version=cv+1;next.updatedAt=new Date().toISOString();next.updatedBy=actor||"Mission Control";
  if(operation==="save_draft"){next.status="draft";next.approved=current.approved||null}
  else if(operation==="approve"){if(!next.draft)throw new Error("No draft meal plan to approve");next.approved=JSON.parse(JSON.stringify(next.draft));next.approved.approvedAt=next.updatedAt;next.approved.approvedBy=next.updatedBy;next.status="approved";next.mealHistory=Array.isArray(next.mealHistory)?next.mealHistory:[];next.mealHistory.push({weekStart:next.approved.weekStart||"",approvedAt:next.updatedAt,approvedBy:next.updatedBy,meals:(next.approved.days||[]).map(x=>x.meal).filter(Boolean)})}
  else if(operation==="update_shared"){next.status=current.status||next.status||"draft"}
  else throw new Error("Unsupported meals operation");
  const row=[next.householdId,next.householdId,next.schemaVersion,next.updatedAt,next.updatedBy,next.status,JSON.stringify(next),"Mission Control Meals durable source of truth"];
  sh.getRange(2,1,1,8).setValues([row]);return next}
function projectResourcesSheet_(){const ss=SpreadsheetApp.getActive();let sh=ss.getSheetByName("Project Resources");if(!sh){sh=ss.insertSheet("Project Resources");sh.getRange(1,1,1,16).setValues([["id","householdId","schemaVersion","version","lifecycle","operatingState","name","area","scope","createdAt","createdBy","updatedAt","updatedBy","legacyProjectId","resourceJson","notes"]]);sh.setFrozenRows(1)}return sh}
function projectLifecycleFromLegacy_(p){if(p&&p.deleted)return"deleted";if(p&&p.archived)return"archived";if(p&&p.lifecycle)return String(p.lifecycle);const s=String((p&&p.status)||"").toLowerCase();if(s==="completed")return"completed";if(s==="canceled"||s==="cancelled")return"archived";return"active"}
function normalizeProjectResource_(p,existing){const now=new Date().toISOString(),e=existing||{},issues=[];const validTs=v=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(String(v||""));if(p.lastUpdatedAt&&!validTs(p.lastUpdatedAt))issues.push("invalid_legacy_lastUpdatedAt");if(/^\d{4}-\d{2}-\d{2}T/.test(String(p.lastUpdatedBy||"")))issues.push("timestamp_in_legacy_actor_field");const importedAt=(e&&Number(e.version||1)>1&&e.createdAt)?e.createdAt:now,notes=["Parallel Project v1 resource; legacy Projects row remains production during migration.","Creation history unavailable in legacy source; createdAt/createdBy describe Project v1 import, not original project creation."].concat(issues.map(x=>"Legacy quality flag: "+x)).join(" ");return{id:String(p.id),householdId:e.householdId||"butler-household",schemaVersion:Number(e.schemaVersion||1),version:Number(e.version||1),lifecycle:projectLifecycleFromLegacy_(p),operatingState:String(p.status||""),name:String(p.name||"Untitled Project"),area:String(p.area||""),scope:e.scope||"private:john",createdAt:importedAt,createdBy:(e&&Number(e.version||1)>1&&e.createdBy)?e.createdBy:"Mission Control — Project v1 import",updatedAt:validTs(p.lastUpdatedAt)?p.lastUpdatedAt:importedAt,updatedBy:(p.lastUpdatedBy&&!/^\d{4}-\d{2}-\d{2}T/.test(String(p.lastUpdatedBy)))?p.lastUpdatedBy:"Legacy metadata unavailable",legacyProjectId:String(p.id),resourceJson:JSON.stringify(Object.assign({},p,{_migration:{importedAt,qualityFlags:issues,legacyLastUpdatedAt:p.lastUpdatedAt||"",legacyLastUpdatedBy:p.lastUpdatedBy||""}})),notes:e.notes||notes}}
function readProjectResourceRecords_(){const sh=projectResourcesSheet_();if(sh.getLastRow()<2)return[];const rows=sh.getRange(2,1,sh.getLastRow()-1,16).getValues(),out=[];for(let i=0;i<rows.length;i++){const r=rows[i];if(!r[0])continue;out.push({sheetRow:i+2,resource:{id:String(r[0]),householdId:String(r[1]),schemaVersion:Number(r[2]||1),version:Number(r[3]||1),lifecycle:String(r[4]),operatingState:String(r[5]),name:String(r[6]),area:String(r[7]),scope:String(r[8]),createdAt:String(r[9]),createdBy:String(r[10]),updatedAt:String(r[11]),updatedBy:String(r[12]),legacyProjectId:String(r[13]),resourceJson:String(r[14]),notes:String(r[15])}})}return out}
function readProjectResources_(){return readProjectResourceRecords_().map(x=>x.resource)}
function validateProjectDateMigration_(){const sh=getSheet_();ensureHeaders_(sh);const range=sh.getDataRange(),values=range.getValues(),display=range.getDisplayValues(),headers=values[0].map(String),fields=["waitingSince","followupDate","deadline","milestoneDate","lastUpdate"],mismatches=[],checked=[];for(let r=1;r<values.length;r++){if(!values[r].some(v=>v!==""))continue;const id=String(values[r][headers.indexOf("id")]||"");fields.forEach(h=>{const i=headers.indexOf(h);if(i<0||values[r][i]==="")return;const shown=String(display[r][i]||"").trim(),m=shown.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/),expected=m?(m[3]+"-"+m[1].padStart(2,"0")+"-"+m[2].padStart(2,"0")):shown;const p=readProjects_().find(x=>String(x.id)===id),actual=p?String(p[h]||""):"";checked.push({id,field:h,expected,actual});if(expected!==actual)mismatches.push({id,field:h,expected,actual})})}return{ok:mismatches.length===0,checkedCount:checked.length,mismatchCount:mismatches.length,mismatches}}
function bootstrapProjectResources(){const lock=LockService.getScriptLock();lock.waitLock(30000);try{const result=bootstrapProjectResourcesLocked_();SpreadsheetApp.flush();return result}finally{try{SpreadsheetApp.flush()}catch(flushErr){console.error("Project Resource cleanup flush failed",flushErr)}finally{lock.releaseLock()}}}
function bootstrapProjectResourcesLocked_(){const legacy=readProjects_(),legacySeen=new Set(),legacyDup=[];legacy.forEach(p=>{const id=String(p.id);if(legacySeen.has(id))legacyDup.push(id);legacySeen.add(id)});if(legacyDup.length)throw new Error("INVALID: duplicate legacy Project ids: "+[...new Set(legacyDup)].join(","));const existingList=readProjectResources_(),resourceSeen=new Set(),resourceDup=[];existingList.forEach(x=>{if(resourceSeen.has(x.id))resourceDup.push(x.id);resourceSeen.add(x.id)});if(resourceDup.length)throw new Error("INVALID: duplicate Project Resource ids: "+[...new Set(resourceDup)].join(","));const existing=new Map(existingList.map(x=>[x.id,x])),legacyIds=new Set(legacy.map(p=>String(p.id))),merged=[];legacy.forEach(p=>{const e=existing.get(String(p.id));if(e&&!e.legacyProjectId)throw new Error("CONFLICT: Project-v1-only id collides with legacy Project id "+p.id);if(e&&Number(e.version||1)>1){merged.push(e);return}merged.push(normalizeProjectResource_(p,e))});existingList.forEach(e=>{if(!legacyIds.has(String(e.id)))merged.push(e)});const rows=merged.map(r=>[r.id,r.householdId,r.schemaVersion,r.version,r.lifecycle,r.operatingState,r.name,r.area,r.scope,r.createdAt,r.createdBy,r.updatedAt,r.updatedBy,r.legacyProjectId,r.resourceJson,r.notes]);const sh=projectResourcesSheet_(),oldCount=Math.max(sh.getLastRow()-1,0);if(rows.length)sh.getRange(2,1,rows.length,16).setValues(rows);if(oldCount>rows.length)sh.getRange(rows.length+2,1,oldCount-rows.length,16).clearContent();return{ok:true,count:rows.length,legacyCount:legacy.length,preservedV1Only:merged.filter(x=>!legacyIds.has(String(x.id))).length}}
function findProjectResourceRecord_(id){const matches=readProjectResourceRecords_().filter(x=>x.resource.id===String(id));if(matches.length>1)throw new Error("INVALID: duplicate Project Resource id "+id);return matches[0]||null}
function findProjectResource_(id){const rec=findProjectResourceRecord_(id);return rec?rec.resource:null}
function writeProjectResource_(resource,expectedVersion,actor,requiredHouseholdId){const sh=projectResourcesSheet_(),rec=findProjectResourceRecord_(resource.id),current=rec?rec.resource:null,cv=current?Number(current.version||1):0;if(!Number.isInteger(Number(expectedVersion))||Number(expectedVersion)<0||String(expectedVersion).trim()==="")throw new Error("INVALID: expectedVersion is required and must be a nonnegative integer");if(Number(expectedVersion)!==cv)throw new Error("CONFLICT: expected Project version "+expectedVersion+" but current version is "+cv);if(current&&requiredHouseholdId&&current.householdId!==requiredHouseholdId)throw new Error("FORBIDDEN: Project household mismatch");if(!current&&requiredHouseholdId&&resource.householdId&&resource.householdId!==requiredHouseholdId)throw new Error("FORBIDDEN: Project household mismatch");const now=new Date().toISOString(),next=Object.assign({},current||{},resource);next.householdId=next.householdId||requiredHouseholdId||"butler-household";if(requiredHouseholdId&&next.householdId!==requiredHouseholdId)throw new Error("FORBIDDEN: Project household mismatch");next.schemaVersion=Number(next.schemaVersion||1);next.version=cv+1;next.lifecycle=next.lifecycle||"draft";next.scope=next.scope||"private:john";next.createdAt=(current&&current.createdAt)||next.createdAt||now;next.createdBy=(current&&current.createdBy)||next.createdBy||actor||"Mission Control";next.updatedAt=now;next.updatedBy=actor||"Mission Control";const legacy=next.resourceJson?JSON.parse(String(next.resourceJson)):{};legacy.id=next.id;legacy.name=next.name||legacy.name||"Untitled Project";legacy.area=next.area||legacy.area||"";legacy.status=next.operatingState||legacy.status||"Active";next.resourceJson=JSON.stringify(legacy);const row=[next.id,next.householdId,next.schemaVersion,next.version,next.lifecycle,next.operatingState||"",next.name||"",next.area||"",next.scope,next.createdAt,next.createdBy,next.updatedAt,next.updatedBy,next.legacyProjectId||"",next.resourceJson,next.notes||""];if(rec)sh.getRange(rec.sheetRow,1,1,16).setValues([row]);else sh.getRange(sh.getLastRow()+1,1,1,16).setValues([row]);return next}
function updateProjectDraft_(id,patch,expectedVersion,actor){const current=findProjectResource_(id);if(!current)throw new Error("INVALID: Project resource not found");if(current.lifecycle!=="draft")throw new Error("FORBIDDEN: Only draft Project resources may be updated through this operation");if(!patch||typeof patch!=="object"||Array.isArray(patch))throw new Error("INVALID: patch must be an object");const raw=JSON.parse(String(current.resourceJson||"{}")),allowed=["name","area","operatingState","description","outcome","doneDefinition","currentState","nextAction","waitingOn","deadline","priority","scope"],keys=Object.keys(patch),unknown=keys.filter(k=>!allowed.includes(k));if(unknown.length)throw new Error("INVALID: unknown patch fields: "+unknown.join(","));if(!keys.length)throw new Error("INVALID: patch must include at least one allowed field");keys.forEach(k=>{if(typeof patch[k]!=="string")throw new Error("INVALID: patch field "+k+" must be a string");if(k==="name"&&!patch[k].trim())throw new Error("INVALID: name cannot be blank");if(k==="name")current.name=patch[k];else if(k==="area")current.area=patch[k];else if(k==="operatingState")current.operatingState=patch[k];else if(k==="scope")current.scope=patch[k];raw[k]=patch[k]});current.resourceJson=JSON.stringify(raw);return writeProjectResource_(current,expectedVersion,actor,"butler-household")}
function transitionProjectLifecycle_(id,targetLifecycle,expectedVersion,actor,requiredHouseholdId){const current=findProjectResource_(id);if(!current)throw new Error("INVALID: Project resource not found");const allowed={draft:["active","deleted"],active:["completed","archived","deleted"],completed:["archived","active"],archived:["active","deleted"],deleted:["archived"]},from=current.lifecycle||"active";if(!(allowed[from]||[]).includes(targetLifecycle))throw new Error("INVALID: lifecycle transition "+from+" → "+targetLifecycle+" not allowed");current.lifecycle=targetLifecycle;current.notes="Project v1 lifecycle="+targetLifecycle+"; legacy Projects remains production until controlled cutover.";const raw=JSON.parse(String(current.resourceJson||"{}"));raw.lifecycle=targetLifecycle;if(targetLifecycle==="active"){if(from==="draft")raw.reviewStatus="approved";raw.completed=false;raw.archived=false;raw.deleted=false;delete raw.deletedAt}else if(targetLifecycle==="archived"){raw.completed=false;raw.archived=true;raw.deleted=false;delete raw.deletedAt}else if(targetLifecycle==="deleted"){raw.completed=false;raw.deleted=true;raw.archived=false;raw.deletedAt=new Date().toISOString()}else if(targetLifecycle==="completed"){raw.completed=true;raw.archived=false;raw.deleted=false;delete raw.deletedAt}current.resourceJson=JSON.stringify(raw);return writeProjectResource_(current,expectedVersion,actor,requiredHouseholdId)}
// Project gateway build 2026.10.02.1 — identity directory private upstream
function validateProjectOperation_(householdId,actor,op,resource,payload){if(householdId!=="butler-household")return{ok:false,status:"FORBIDDEN",message:"Household not permitted"};if(resource!=="projects")return{ok:false,status:"FORBIDDEN",message:"Resource not permitted"};if(actor!=="dot")return{ok:false,status:"FORBIDDEN",message:"Actor not permitted"};if(op==="validate_project_gateway")return{ok:true,readOnly:true};if(op==="create_project_draft"){if(!payload||!payload.project||!payload.project.id||!payload.project.name)return{ok:false,status:"INVALID",message:"project.id and project.name required"};if(findProjectResource_(payload.project.id))return{ok:false,status:"CONFLICT",message:"Project id already exists"};return{ok:true,createDraft:true}}if(op==="update_project_draft"){if(!payload||!payload.projectId||!payload.patch)return{ok:false,status:"INVALID",message:"projectId and patch required"};return{ok:true,updateDraft:true}}return{ok:false,status:"FORBIDDEN",message:"Project operation not permitted for agent queue"}}
function isProjectCalendarDate_(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const parts=v.split("-").map(Number),y=parts[0],m=parts[1],d=parts[2],dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d}
function updateTrustedProject_(id,patch,expectedVersion,actor,requiredHouseholdId){const current=findProjectResource_(id);if(!current)throw new Error("INVALID: Project resource not found");if(current.lifecycle==="deleted")throw new Error("FORBIDDEN: Cannot update a deleted project before restore");if(!patch||typeof patch!=="object"||Array.isArray(patch)||!Object.keys(patch).length)throw new Error("INVALID: non-empty patch required");const raw=JSON.parse(String(current.resourceJson||"{}")),stringFields=["name","area","operatingState","scope","priority","attention","owner","description","outcome","doneDefinition","currentState","nextAction","waitingOn","milestone","notes","dependencyId"],dateFields=["waitingSince","followupDate","deadline","milestoneDate"],allowed=[...stringFields,...dateFields,"progress","tags"],unknown=Object.keys(patch).filter(k=>!allowed.includes(k));if(unknown.length)throw new Error("INVALID: unsupported patch fields "+unknown.join(","));Object.keys(patch).forEach(k=>{const v=patch[k];if(stringFields.includes(k)){if(typeof v!=="string")throw new Error("INVALID: patch field "+k+" must be a string");if(k==="name"&&!v.trim())throw new Error("INVALID: name cannot be blank")}else if(dateFields.includes(k)){if(typeof v!=="string"||(v&&!isProjectCalendarDate_(v)))throw new Error("INVALID: patch date "+k+" must be a real YYYY-MM-DD calendar date or blank")}else if(k==="progress"){if(!Number.isInteger(v)||v<0||v>100)throw new Error("INVALID: progress must be an integer 0-100")}else if(k==="tags"){if(!Array.isArray(v)||v.some(x=>typeof x!=="string"||!x.trim()))throw new Error("INVALID: tags must be nonblank strings")}});allowed.forEach(k=>{if(Object.prototype.hasOwnProperty.call(patch,k)){raw[k]=patch[k];if(k==="name")current.name=String(patch[k]||"Untitled Project");if(k==="area")current.area=String(patch[k]||"");if(k==="operatingState")current.operatingState=String(patch[k]||"");if(k==="scope")current.scope=String(patch[k]||"private:john")}});current.resourceJson=JSON.stringify(raw);return writeProjectResource_(current,expectedVersion,actor,requiredHouseholdId)}
function projectOperationAuditSheet_(){const ss=SpreadsheetApp.getActive();let sh=ss.getSheetByName("Project Operation Audit");if(!sh){sh=ss.insertSheet("Project Operation Audit");sh.getRange(1,1,1,12).setValues([["operationId","timestamp","householdId","actorUserId","operation","projectId","expectedVersion","previousVersion","newVersion","status","result","notes"]]);sh.setFrozenRows(1)}return sh}
function projectOperationAuditRecord_(operationId){const sh=projectOperationAuditSheet_();if(sh.getLastRow()<2)return null;const rows=sh.getRange(2,1,sh.getLastRow()-1,12).getValues();const matches=[];for(let i=0;i<rows.length;i++)if(String(rows[i][0])===String(operationId))matches.push({sheetRow:i+2,row:rows[i]});if(matches.length>1)throw new Error("INVALID: duplicate Project operationId "+operationId);return matches[0]||null}
function projectOperationFingerprint_(body){const s=JSON.stringify({householdId:String(body.householdId||""),actor:String(body.actor||""),operation:String(body.operation||""),projectId:String(body.projectId||""),expectedVersion:Number(body.expectedVersion),patch:body.patch||null}),bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8);return bytes.map(b=>(b+256)%256).map(b=>b.toString(16).padStart(2,"0")).join("")}
function appendProjectOperationAudit_(body,status,result,previousVersion,newVersion,notes){projectOperationAuditSheet_().appendRow([String(body.operationId),new Date().toISOString(),String(body.householdId||""),String(body.actor||""),String(body.operation||""),String(body.projectId||""),body.expectedVersion,previousVersion??"",newVersion??"",status,JSON.stringify(result||{}),"fingerprint="+projectOperationFingerprint_(body)+"; "+(notes||"")])}
function projectOperationFingerprintMatches_(rec,body){const note=String(rec.row[11]||""),m=note.match(/fingerprint=([0-9a-f]{64})/);return !!m&&m[1]===projectOperationFingerprint_(body)}
function trustedProjectOperation_(body){const op=String(body.operation||""),id=String(body.projectId||""),expected=body.expectedVersion,actor=String(body.actor||"mission-control-ui");if(!id)throw new Error("INVALID: projectId required");const before=findProjectResource_(id);if(!before)throw new Error("INVALID: Project resource not found");if(op==="update_project"){const next=updateTrustedProject_(id,body.patch||{},expected,actor,String(body.householdId||""));return{ok:true,project:next,previousVersion:Number(before.version||1),newVersion:Number(next.version||1)}}const allowed=["activate_project","archive_project","restore_project","soft_delete_project","complete_project"];if(!allowed.includes(op))throw new Error("INVALID: Unsupported trusted project operation");let target;if(op==="activate_project")target="active";else if(op==="archive_project")target="archived";else if(op==="complete_project")target="completed";else if(op==="soft_delete_project")target="deleted";else target=before.lifecycle==="deleted"?"archived":"active";const next=transitionProjectLifecycle_(id,target,expected,actor,String(body.householdId||""));return{ok:true,project:next,previousVersion:Number(before.version||1),newVersion:Number(next.version||1)}}
// Diagnostics deliberately avoids helpers that create sheets, repair headers,
// initialize resources or append audit records. No Google write API is used here.
function diagnosticsTable_(name, headers) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) return {present: false, headersValid: false, rows: []};
  const actual = sh.getRange(1, 1, 1, headers.length).getValues()[0].map(String);
  const headersValid = actual.join("|") === headers.join("|");
  const rows = headersValid && sh.getLastRow() > 1
    ? sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues().filter(r => r[0]) : [];
  return {present: true, headersValid, rows};
}
function diagnosticsFingerprint_(rows) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(rows), Utilities.Charset.UTF_8);
  return bytes.map(b => ((b + 256) % 256).toString(16).padStart(2, "0")).join("");
}
function diagnosticsSummary_(table, rows) {
  return {present: table.present, headersValid: table.headersValid,
    recordCount: table.headersValid ? rows.length : null,
    fingerprint: table.headersValid ? diagnosticsFingerprint_(rows) : null};
}
function readSystemDiagnostics_(body) {
  if (typeof body.actor !== "string" || !body.actor || typeof body.householdId !== "string" || !body.householdId)
    throw new Error("DIAGNOSTICS_PRINCIPAL_REQUIRED");
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const users = diagnosticsTable_("Users", ["userId","status","displayName","identityProvider","providerSubject","email","createdAt","updatedAt","notes"]);
    const households = diagnosticsTable_("Households", ["householdId","status","name","createdAt","updatedAt","notes"]);
    const members = diagnosticsTable_("Household Memberships", ["membershipId","householdId","userId","role","status","createdAt","updatedAt","notes"]);
    if (![users, households, members].every(t => t.headersValid)) throw new Error("DIAGNOSTICS_DIRECTORY_INVALID");
    const u = users.rows.filter(r => String(r[0]) === body.actor && r[1] === "active");
    const h = households.rows.filter(r => String(r[0]) === body.householdId && r[1] === "active");
    const m = members.rows.filter(r => String(r[1]) === body.householdId && String(r[2]) === body.actor && r[4] === "active");
    if (u.length !== 1 || h.length !== 1 || m.length !== 1 || m[0][3] !== "principal")
      throw new Error("DIAGNOSTICS_PRINCIPAL_REQUIRED");

    const resourceHeaders = ["id","householdId","schemaVersion","version","lifecycle","operatingState","name","area","scope","createdAt","createdBy","updatedAt","updatedBy","legacyProjectId","resourceJson","notes"];
    const resources = diagnosticsTable_("Project Resources", resourceHeaders);
    const resourceRows = resources.rows.filter(r => String(r[1]) === body.householdId);
    const ids = new Set(resourceRows.map(r => String(r[0]))), globalIdCounts = new Map();
    resources.rows.forEach(r => globalIdCounts.set(String(r[0]), (globalIdCounts.get(String(r[0])) || 0) + 1));
    // Check global collisions of this household's IDs without returning foreign IDs/content.
    const duplicateIdCount = [...ids].filter(id => globalIdCounts.get(id) > 1).length;
    const projectResources = Object.assign(diagnosticsSummary_(resources, resourceRows), {
      v1OnlyCount: resources.headersValid ? resourceRows.filter(r => !r[13]).length : null,
      duplicateIdCount: resources.headersValid ? duplicateIdCount : null
    });
    // Legacy Projects has no household column and is currently bound to Butler only.
    // Do not present another household's legacy rows as a tenant-scoped resource.
    const legacyApplicable = body.householdId === "butler-household";
    const projects = legacyApplicable ? diagnosticsTable_("Projects", HEADERS) : {present:false,headersValid:false,rows:[]};
    const legacyProjects = Object.assign(diagnosticsSummary_(projects, projects.rows), {applicable: legacyApplicable});
    const audit = diagnosticsTable_("Project Operation Audit", ["operationId","timestamp","householdId","actorUserId","operation","projectId","expectedVersion","previousVersion","newVersion","status","result","notes"]);
    const auditRows = audit.rows.filter(r => String(r[2]) === body.householdId);
    // Audit notes/results/actors are deliberately excluded even from fingerprints.
    const safeAuditRows = auditRows.map(r => [r[0],r[1],r[4],r[5],r[6],r[7],r[8],r[9]]);
    const projectOperationAudit = diagnosticsSummary_(audit, safeAuditRows);
    const fixtureId = "commission-project-gateway-001";
    const fixtureRows = resourceRows.filter(r => String(r[0]) === fixtureId);
    const globallyUnique = resources.rows.filter(r => String(r[0]) === fixtureId).length === 1;
    let fixture = {present: fixtureRows.length > 0, unique: fixtureRows.length === 1 && globallyUnique,
      version: null, lifecycle: null, legacyLinked: null, flags: null, lifecycleCoherent: null};
    if (fixture.unique) {
      const r = fixtureRows[0];
      fixture.version = Number.isSafeInteger(Number(r[3])) && Number(r[3]) > 0 ? Number(r[3]) : null;
      fixture.lifecycle = ["draft","active","completed","archived","deleted"].includes(String(r[4])) ? String(r[4]) : null;
      fixture.legacyLinked = !!r[13];
      try {
        const raw = JSON.parse(String(r[14] || "{}"));
        fixture.flags = {completed: raw.completed === true, archived: raw.archived === true,
          deleted: raw.deleted === true, deletedAtPresent: !!raw.deletedAt,
          reviewStatus: ["pending","approved","rejected"].includes(raw.reviewStatus) ? raw.reviewStatus : null};
        fixture.lifecycleCoherent = ["completed","archived","deleted"].every(k => raw[k] === undefined || typeof raw[k] === "boolean") && raw.lifecycle === fixture.lifecycle &&
          fixture.flags.completed === (fixture.lifecycle === "completed") &&
          fixture.flags.archived === (fixture.lifecycle === "archived") &&
          fixture.flags.deleted === (fixture.lifecycle === "deleted") &&
          fixture.flags.deletedAtPresent === (fixture.lifecycle === "deleted");
      } catch (_e) { /* malformed fixture is reported as unverified */ }
    }
    const recentFixtureOperations = auditRows.filter(r => String(r[5]) === fixtureId).slice(-10).map(r => ({
      operationId: /^ui_[0-9a-f-]{36}$/i.test(String(r[0])) ? String(r[0]) : null,
      status: ["PENDING","SUCCESS","FAILED","UNKNOWN"].includes(String(r[9])) ? String(r[9]) : null,
      expectedVersion: Number.isSafeInteger(Number(r[6])) && String(r[6]) !== "" ? Number(r[6]) : null,
      previousVersion: Number.isSafeInteger(Number(r[7])) && String(r[7]) !== "" ? Number(r[7]) : null,
      newVersion: Number.isSafeInteger(Number(r[8])) && String(r[8]) !== "" ? Number(r[8]) : null
    }));
    const householdMembers = members.rows.filter(r => String(r[1]) === body.householdId);
    const householdUserIds = new Set(householdMembers.map(r => String(r[2])));
    const invitations = diagnosticsTable_("Household Invitations", invitationHeaders_());
    const authAudit = diagnosticsTable_("Auth Audit", ["eventId","timestamp","eventType","userId","householdId","role","resource","operation","result","notes"]);
    return {ok: true, diagnostics: {
      schemaVersion: 1, readOnly: true, checkedAt: new Date().toISOString(),
      source: {gitSha: MC_SOURCE_SHA, canonicalSha256: MC_CANONICAL_SHA256, legacyBuildId: MC_BUILD_ID, immutableVersion: null},
      gates: {projectV1TrustedDispatch: PropertiesService.getScriptProperties().getProperty("PROJECT_V1_TRUSTED_DISPATCH") === "enabled",
        memberSetup: PropertiesService.getScriptProperties().getProperty("MEMBER_SETUP") === "enabled",
        memberDashboard: PropertiesService.getScriptProperties().getProperty("MEMBER_DASHBOARD") === "enabled",
        memberMealsEdit: PropertiesService.getScriptProperties().getProperty("MEMBER_MEALS_EDIT") === "enabled"},
      snapshot: {coordination: "shared-script-lock", legacyWritesSerialized: false},
      sheets: {legacyProjects, projectResources, projectOperationAudit}, fixture, recentFixtureOperations,
      identity: {activeUsers: users.rows.filter(r => householdUserIds.has(String(r[0])) && r[1] === "active").length,
        activeMemberships: householdMembers.filter(r => r[4] === "active").length,
        invitationsPresent: invitations.present, invitationsHeadersValid: invitations.headersValid,
        invitationCount: invitations.headersValid ? invitations.rows.filter(r => String(r[1]) === body.householdId).length : null,
        authAuditPresent: authAudit.present, authAuditHeadersValid: authAudit.headersValid,
        authAuditCount: authAudit.headersValid ? authAudit.rows.filter(r => String(r[4]) === body.householdId).length : null}
    }};
  } finally { lock.releaseLock(); }
}
function identitySheet_(name,headers){const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(name);if(!sh)throw new Error("Identity directory sheet missing: "+name);const first=sh.getRange(1,1,1,headers.length).getValues()[0].map(String);if(first.join("|")!==headers.join("|"))throw new Error("Identity directory headers invalid: "+name);return sh}
function identityRows_(name,headers){const sh=identitySheet_(name,headers);if(sh.getLastRow()<2)return[];return sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues().filter(r=>r[0]).map(r=>Object.fromEntries(headers.map((h,i)=>[h,String(r[i]??"")])))}
function resolveIdentityDirectory_(provider,subject,householdId){const uh=["userId","status","displayName","identityProvider","providerSubject","email","createdAt","updatedAt","notes"],hh=["householdId","status","name","createdAt","updatedAt","notes"],mh=["membershipId","householdId","userId","role","status","createdAt","updatedAt","notes"],users=identityRows_("Users",uh).filter(x=>x.status==="active"&&x.identityProvider===provider&&x.providerSubject===subject);if(users.length!==1)return{ok:false,reason:users.length?"IDENTITY_BINDING_NOT_UNIQUE":"USER_NOT_PROVISIONED"};const user=users[0],households=identityRows_("Households",hh).filter(x=>x.status==="active"&&x.householdId===householdId);if(households.length!==1)return{ok:false,reason:"HOUSEHOLD_INACTIVE_OR_MISSING"};const household=households[0],memberships=identityRows_("Household Memberships",mh).filter(x=>x.status==="active"&&x.householdId===householdId&&x.userId===user.userId);if(memberships.length!==1)return{ok:false,reason:memberships.length?"MEMBERSHIP_NOT_UNIQUE":"MEMBERSHIP_INACTIVE_OR_MISSING"};return{ok:true,user,household,membership:memberships[0]}}
function bootstrapFirstPrincipal_(identity){const lock=LockService.getScriptLock();lock.waitLock(30000);try{const props=PropertiesService.getScriptProperties();if(props.getProperty("IDENTITY_BOOTSTRAPPED")==="true")throw new Error("BOOTSTRAP_RETIRED");const uh=["userId","status","displayName","identityProvider","providerSubject","email","createdAt","updatedAt","notes"],hh=["householdId","status","name","createdAt","updatedAt","notes"],mh=["membershipId","householdId","userId","role","status","createdAt","updatedAt","notes"],users=identityRows_("Users",uh),members=identityRows_("Household Memberships",mh);if(users.length||members.length){props.setProperty("IDENTITY_BOOTSTRAPPED","true");throw new Error("BOOTSTRAP_RETIRED")}const now=new Date().toISOString(),userId="usr_"+Utilities.getUuid(),membershipId="mem_"+Utilities.getUuid(),us=identitySheet_("Users",uh),hs=identitySheet_("Households",hh),ms=identitySheet_("Household Memberships",mh);us.appendRow([userId,"active",identity.displayName||"",identity.provider,identity.subject,identity.email||"",now,now,"First principal provisioned from verified identity"]);const households=identityRows_("Households",hh);if(!households.find(x=>x.householdId==="butler-household"))hs.appendRow(["butler-household","active","Butler Household",now,now,"Initial Mission Control household"]);ms.appendRow([membershipId,"butler-household",userId,"principal","active",now,now,"Initial principal membership"]);props.setProperty("IDENTITY_BOOTSTRAPPED","true");return{ok:true,userId,householdId:"butler-household",role:"principal"}}finally{lock.releaseLock()}}
function authAudit_(eventType,userId,householdId,role,resource,operation,result,notes){try{const headers=["eventId","timestamp","eventType","userId","householdId","role","resource","operation","result","notes"],sh=identitySheet_("Auth Audit",headers);sh.appendRow(["auth_"+Utilities.getUuid(),new Date().toISOString(),eventType||"",userId||"",householdId||"",role||"",resource||"",operation||"",result||"",notes||""]);return true}catch(err){console.error("Auth audit write failed",err);return false}}
function invitationHeaders_(){return ["invitationId","householdId","role","status","tokenHash","createdByUserId","createdAt","expiresAt","claimedByUserId","claimedAt","revokedAt","notes"]}
function invitationRecords_(){const headers=invitationHeaders_(),sh=identitySheet_("Household Invitations",headers);if(sh.getLastRow()<2)return[];const values=sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues(),out=[];for(let i=0;i<values.length;i++){const r=values[i];if(!r[0])continue;out.push({sheetRow:i+2,data:Object.fromEntries(headers.map((h,j)=>[h,String(r[j]??"")]))})}return out}
function hashInviteToken_(token){const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(token),Utilities.Charset.UTF_8);return bytes.map(b=>(b+256)%256).map(b=>b.toString(16).padStart(2,"0")).join("")}

function createHouseholdInvitation_(actorUserId,householdId,role,tokenHash,expiresAt){const lock=LockService.getScriptLock();lock.waitLock(30000);try{if(!actorUserId||!householdId||!tokenHash)throw new Error("INVALID_INVITATION_REQUEST");if(!["secondary","extended"].includes(role))throw new Error("ROLE_NOT_INVITABLE");const uh=["userId","status","displayName","identityProvider","providerSubject","email","createdAt","updatedAt","notes"],hh=["householdId","status","name","createdAt","updatedAt","notes"],mh=["membershipId","householdId","userId","role","status","createdAt","updatedAt","notes"],users=identityRows_("Users",uh),households=identityRows_("Households",hh),members=identityRows_("Household Memberships",mh),actor=users.find(x=>x.userId===actorUserId&&x.status==="active"),household=households.find(x=>x.householdId===householdId&&x.status==="active"),membership=members.find(x=>x.userId===actorUserId&&x.householdId===householdId&&x.status==="active"&&x.role==="principal");if(!actor||!household||!membership)throw new Error("PRINCIPAL_REQUIRED");if(invitationRecords_().some(x=>x.data.tokenHash===tokenHash))throw new Error("INVITATION_TOKEN_COLLISION");const now=new Date().toISOString(),id="inv_"+Utilities.getUuid(),sh=identitySheet_("Household Invitations",invitationHeaders_());sh.appendRow([id,householdId,role,"pending",tokenHash,actorUserId,now,expiresAt||"","","","","Single-use household invitation"]);const auditOk=authAudit_("INVITATION_CREATED",actorUserId,householdId,"principal","identity","create_invitation","SUCCESS","Role "+role);return{ok:true,invitationId:id,householdId,role,status:"pending",expiresAt:expiresAt||"",auditOk}}finally{lock.releaseLock()}}
function claimHouseholdInvitation_(identity,inviteToken){const lock=LockService.getScriptLock();lock.waitLock(30000);try{const hash=hashInviteToken_(inviteToken),rec=invitationRecords_().find(x=>x.data.tokenHash===hash);if(!rec)throw new Error("INVITATION_NOT_FOUND");const inv=rec.data,now=new Date(),iso=now.toISOString();if(inv.expiresAt&&new Date(inv.expiresAt).getTime()<now.getTime())throw new Error("INVITATION_EXPIRED");const uh=["userId","status","displayName","identityProvider","providerSubject","email","createdAt","updatedAt","notes"],mh=["membershipId","householdId","userId","role","status","createdAt","updatedAt","notes"],users=identityRows_("Users",uh),members=identityRows_("Household Memberships",mh);let user=users.find(x=>x.identityProvider===identity.provider&&x.providerSubject===identity.subject);if(user&&user.status!=="active")throw new Error("USER_DISABLED");if(inv.status==="claimed"){if(user&&inv.claimedByUserId===user.userId&&members.some(x=>x.userId===user.userId&&x.householdId===inv.householdId&&x.status==="active")){const auditOk=authAudit_("INVITATION_RECOVERED",user.userId,inv.householdId,inv.role,"identity","claim_invitation","SUCCESS","Idempotent claimed retry "+inv.invitationId);return{ok:true,householdId:inv.householdId,role:inv.role,status:"claimed",recovered:true,auditOk}}throw new Error("INVITATION_NOT_PENDING")}if(inv.status==="claiming"&&(!user||inv.claimedByUserId!==user.userId))throw new Error("INVITATION_CLAIM_IN_PROGRESS");if(!["pending","claiming"].includes(inv.status))throw new Error("INVITATION_NOT_PENDING");if(!user){const userId="usr_"+Utilities.getUuid();identitySheet_("Users",uh).appendRow([userId,"active",identity.displayName||"",identity.provider,identity.subject,identity.email||"",iso,iso,"Provisioned from claimed household invitation"]);user={userId}}const sh=identitySheet_("Household Invitations",invitationHeaders_());if(inv.status==="pending"){const preserved=[inv.tokenHash,inv.createdByUserId,inv.createdAt,inv.expiresAt];sh.getRange(rec.sheetRow,4,1,6).setValues([["claiming",...preserved,user.userId]]);SpreadsheetApp.flush()}let membership=members.find(x=>x.userId===user.userId&&x.householdId===inv.householdId&&x.status==="active");if(!membership){const membershipId="mem_"+Utilities.getUuid();identitySheet_("Household Memberships",mh).appendRow([membershipId,inv.householdId,user.userId,inv.role,"active",iso,iso,"Created from invitation "+inv.invitationId]);SpreadsheetApp.flush()}sh.getRange(rec.sheetRow,4).setValue("claimed");sh.getRange(rec.sheetRow,10).setValue(iso);sh.getRange(rec.sheetRow,12).setValue("Claim completed");const auditOk=authAudit_("INVITATION_CLAIMED",user.userId,inv.householdId,inv.role,"identity","claim_invitation","SUCCESS","Invitation "+inv.invitationId);return{ok:true,householdId:inv.householdId,role:inv.role,status:"claimed",auditOk}}catch(err){const auditOk=authAudit_("INVITATION_CLAIM_DENIED","", "", "", "identity","claim_invitation","DENIED",String(err.message||err));if(!auditOk)throw new Error(String(err.message||err)+"|AUDIT_WRITE_FAILED");throw err}finally{lock.releaseLock()}}
function revokeHouseholdInvitation_(actorUserId,invitationId){const lock=LockService.getScriptLock();lock.waitLock(30000);try{const rec=invitationRecords_().find(x=>x.data.invitationId===invitationId);if(!rec)throw new Error("INVITATION_NOT_FOUND");const inv=rec.data;if(inv.status!=="pending")throw new Error("INVITATION_NOT_PENDING");const mh=["membershipId","householdId","userId","role","status","createdAt","updatedAt","notes"],principal=identityRows_("Household Memberships",mh).find(x=>x.userId===actorUserId&&x.householdId===inv.householdId&&x.role==="principal"&&x.status==="active");if(!principal)throw new Error("PRINCIPAL_REQUIRED");const now=new Date().toISOString(),sh=identitySheet_("Household Invitations",invitationHeaders_());sh.getRange(rec.sheetRow,4).setValue("revoked");sh.getRange(rec.sheetRow,11).setValue(now);sh.getRange(rec.sheetRow,12).setValue("Revoked by household principal");const auditOk=authAudit_("INVITATION_REVOKED",actorUserId,inv.householdId,"principal","identity","revoke_invitation","SUCCESS","Invitation "+invitationId);return{ok:true,invitationId,householdId:inv.householdId,status:"revoked",auditOk}}finally{lock.releaseLock()}}
function operationsSheet_(){const ss=SpreadsheetApp.getActive();let sh=ss.getSheetByName("Agent Operations");if(!sh){sh=ss.insertSheet("Agent Operations");sh.getRange(1,1,1,14).setValues([["operationId","householdId","actorId","operation","resourceId","expectedVersion","payload","status","result","createdAt","processedAt","previousVersion","newVersion","notes"]])}return sh}
function installAgentOperationsTrigger(){const ss=SpreadsheetApp.getActive();ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==="processAgentOperations").forEach(t=>ScriptApp.deleteTrigger(t));ScriptApp.newTrigger("processAgentOperations").timeBased().everyMinutes(1).create();return "Agent Operations processor installed: every minute"}
function removeAgentOperationsTrigger(){ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==="processAgentOperations").forEach(t=>ScriptApp.deleteTrigger(t));return "Agent Operations processor removed"}
function validateAgentOperation_(householdId,actor,op,resource,payload){if(householdId!=="butler-household")return{ok:false,status:"FORBIDDEN",message:"Household not permitted"};if(actor!=="dot")return{ok:false,status:"FORBIDDEN",message:"Actor not permitted"};if(resource!=="meals")return{ok:false,status:"FORBIDDEN",message:"Resource not permitted"};if(op==="validate_meal_gateway")return{ok:true,readOnly:true};if(op!=="save_meal_draft")return{ok:false,status:"FORBIDDEN",message:"Operation not permitted"};if(!payload||!payload.draft||!payload.draft.weekStart||!Array.isArray(payload.draft.days))return{ok:false,status:"INVALID",message:"draft.weekStart and draft.days required"};return{ok:true,readOnly:false}}
function processAgentOperations(){const lock=LockService.getScriptLock();lock.waitLock(30000);try{const sh=operationsSheet_(),last=sh.getLastRow();if(last<2)return;for(let r=2;r<=last;r++){const row=sh.getRange(r,1,1,14).getValues()[0],status=String(row[7]||"").toUpperCase();if(status&&status!=="PENDING")continue;const opId=String(row[0]||"").trim(),householdId=String(row[1]||"").trim(),actor=String(row[2]||"").trim(),op=String(row[3]||"").trim(),resource=String(row[4]||"").trim(),expected=row[5],created=row[9]||new Date().toISOString();if(!opId||!actor||!op){sh.getRange(r,8,1,7).setValues([["INVALID","Missing operationId, actorId or operation",created,new Date().toISOString(),"","",""]]);continue}
      if(resource==="projects"){try{const payload=typeof row[6]==="object"?row[6]:JSON.parse(String(row[6]||"{}")),auth=validateProjectOperation_(householdId,actor,op,resource,payload);if(!auth.ok){sh.getRange(r,8,1,7).setValues([[auth.status,auth.message,created,new Date().toISOString(),"","",""]]);continue}if(auth.readOnly){sh.getRange(r,8,1,7).setValues([["SUCCESS",JSON.stringify({ok:true,validationOnly:true,resource:"projects",resourceCount:readProjectResources_().length}),created,new Date().toISOString(),"","","Project gateway validation only — no resource write"]]);continue}if(auth.refreshResources){const result=bootstrapProjectResourcesLocked_();sh.getRange(r,8,1,7).setValues([["SUCCESS",JSON.stringify({ok:true,resource:"projects",refreshed:result.count}),created,new Date().toISOString(),"","","Project Resources refreshed from legacy production; legacy Projects unchanged"]]);continue}if(auth.lifecycle){const before=findProjectResource_(payload.projectId),pv=before?Number(before.version||1):0,target=op==="activate_project"?"active":op==="archive_project"?"archived":op==="restore_project"?(before&&before.lifecycle==="deleted"?"archived":"active"):op==="complete_project"?"completed":"deleted",res=transitionProjectLifecycle_(payload.projectId,target,expected,actor,"butler-household");sh.getRange(r,8,1,7).setValues([["SUCCESS",JSON.stringify({ok:true,resource:"projects",projectId:res.id,version:res.version,lifecycle:res.lifecycle}),created,new Date().toISOString(),pv,res.version,"Project lifecycle transition committed in parallel Project Resources only"]]);continue}if(auth.updateDraft){if(expected===undefined||expected===null||String(expected).trim()===""||!Number.isFinite(Number(expected)))throw new Error("INVALID: expectedVersion is required and must be numeric");const before=findProjectResource_(payload.projectId),pv=before?Number(before.version||1):0,res=updateProjectDraft_(payload.projectId,payload.patch,expected,"dot");sh.getRange(r,8,1,7).setValues([["SUCCESS",JSON.stringify({ok:true,resource:"projects",projectId:res.id,version:res.version,lifecycle:res.lifecycle}),created,new Date().toISOString(),pv,res.version,"Project draft updated in parallel Project Resources only"]]);continue}if(auth.createDraft){const p=payload.project,res=writeProjectResource_({id:String(p.id),householdId:"butler-household",schemaVersion:1,lifecycle:"draft",operatingState:p.operatingState||"Upcoming",name:String(p.name),area:String(p.area||""),scope:String(p.scope||"private:john"),createdBy:"dot",legacyProjectId:"",resourceJson:JSON.stringify(Object.assign({},p,{id:String(p.id),lifecycle:"draft",reviewStatus:"pending"})),notes:"Dot-proposed Project v1 draft; not activated and not written to legacy Projects."},0,"dot");sh.getRange(r,8,1,7).setValues([["SUCCESS",JSON.stringify({ok:true,resource:"projects",projectId:res.id,version:res.version,lifecycle:res.lifecycle}),created,new Date().toISOString(),0,res.version,"Project draft created in parallel Project Resources only"]]);continue}}catch(err){const msg=String(err.message||err),st=msg.indexOf("CONFLICT:")===0?"CONFLICT":msg.indexOf("INVALID:")===0?"INVALID":msg.indexOf("FORBIDDEN:")===0?"FORBIDDEN":"FAILED";let auditVersion="";try{const pp=typeof row[6]==="object"?row[6]:JSON.parse(String(row[6]||"{}")),pid=pp.projectId||(pp.project&&pp.project.id),cur=pid?findProjectResource_(pid):null;auditVersion=cur?Number(cur.version||1):""}catch(_e){}sh.getRange(r,8,1,7).setValues([[st,msg,created,new Date().toISOString(),auditVersion,"",""]]);continue}}
      const before=readMeals_()||{version:0},pv=Number(before.version||1);try{const payload=typeof row[6]==="object"?row[6]:JSON.parse(String(row[6]||"{}")),auth=validateAgentOperation_(householdId,actor,op,resource,payload);if(!auth.ok){sh.getRange(r,8,1,7).setValues([[auth.status,auth.message,created,new Date().toISOString(),pv,"",""]]);continue}if(auth.readOnly){sh.getRange(r,8,1,7).setValues([["SUCCESS",JSON.stringify({ok:true,validationOnly:true,resource:"meals",version:pv}),created,new Date().toISOString(),pv,pv,"Gateway validation only — no resource write"]]);continue}const next=writeMeals_({draft:payload.draft},"save_draft","dot",expected);sh.getRange(r,8,1,7).setValues([["SUCCESS",JSON.stringify({ok:true,resource:"meals",version:next.version,updatedAt:next.updatedAt}),created,new Date().toISOString(),pv,next.version,""]])}catch(err){const msg=String(err.message||err),st=msg.indexOf("CONFLICT:")===0?"CONFLICT":msg.indexOf("INVALID:")===0?"INVALID":"FAILED";sh.getRange(r,8,1,7).setValues([[st,msg,created,new Date().toISOString(),pv,"",""]])} 
    }SpreadsheetApp.flush()}finally{try{SpreadsheetApp.flush()}catch(flushErr){console.error("Agent Operations cleanup flush failed",flushErr)}finally{lock.releaseLock()}}}

function ensureHeaders_(sh){const current=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0].map(String);HEADERS.forEach((h,idx)=>{if(current[idx]!==h)sh.getRange(1,idx+1).setValue(h)})}
function headerMap_(sh){const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String),map={};headers.forEach((h,i)=>map[h]=i+1);return map}
function getSheet_(){const sh=SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);if(!sh)throw new Error('Projects sheet missing.');return sh}
function json_(obj){if(obj&&typeof obj==="object"&&!Array.isArray(obj))obj.buildId=MC_BUILD_ID;return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}

// Member preferences never grant household or provider authority.
const MEMBER_SETUP_HEADERS = ['userId','householdId','schemaVersion','version','preferencesJson','status','updatedAt','updatedBy'];
function defaultMemberSetup_(){return{step:0,startView:'schedule',timeZone:'America/Chicago',calendarProviders:[],emailProviders:[],sharingDefault:'private'}}
function validateMemberSetup_(value){
  const keys=['step','startView','timeZone','calendarProviders','emailProviders','sharingDefault'];
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key)))return false;
  if(!Number.isInteger(value.step)||value.step<0||value.step>6||!['schedule','budget','meals','family'].includes(value.startView)||!['America/Chicago','America/New_York','America/Denver','America/Los_Angeles','America/Phoenix','Pacific/Honolulu','America/Anchorage','UTC'].includes(value.timeZone)||!['private','busy'].includes(value.sharingDefault))return false;
  return ['calendarProviders','emailProviders'].every(key=>Array.isArray(value[key])&&value[key].length<=2&&value[key].every(item=>['google','microsoft'].includes(item))&&new Set(value[key]).size===value[key].length);
}
function memberSetupAuthority_(body){
  if(typeof body.actor!=='string'||!body.actor||typeof body.householdId!=='string'||!body.householdId)throw new Error('MEMBER_SETUP_FORBIDDEN');
  const users=diagnosticsTable_('Users',['userId','status','displayName','identityProvider','providerSubject','email','createdAt','updatedAt','notes']);
  const households=diagnosticsTable_('Households',['householdId','status','name','createdAt','updatedAt','notes']);
  const members=diagnosticsTable_('Household Memberships',['membershipId','householdId','userId','role','status','createdAt','updatedAt','notes']);
  if(![users,households,members].every(table=>table.headersValid))throw new Error('MEMBER_SETUP_FORBIDDEN');
  // Duplicate directory keys fail closed even if one duplicate is inactive.
  const u=users.rows.filter(row=>String(row[0])===body.actor),h=households.rows.filter(row=>String(row[0])===body.householdId),m=members.rows.filter(row=>String(row[1])===body.householdId&&String(row[2])===body.actor);
  if(u.length!==1||h.length!==1||m.length!==1||u[0][1]!=='active'||h[0][1]!=='active'||m[0][4]!=='active'||!['principal','secondary'].includes(m[0][3]))throw new Error('MEMBER_SETUP_FORBIDDEN');
}
function memberSetupRecord_(body){
  const sheet=SpreadsheetApp.getActive().getSheetByName('Member Setup');
  if(!sheet)return{sheet:null,record:null};
  const actual=sheet.getRange(1,1,1,MEMBER_SETUP_HEADERS.length).getValues()[0].map(String);
  if(actual.join('|')!==MEMBER_SETUP_HEADERS.join('|'))throw new Error('MEMBER_SETUP_SCHEMA_INVALID');
  const rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,MEMBER_SETUP_HEADERS.length).getValues():[];
  const found=[];
  rows.forEach((row,index)=>{if(String(row[0])===body.actor&&String(row[1])===body.householdId)found.push({sheetRow:index+2,row:row})});
  if(found.length>1)throw new Error('MEMBER_SETUP_SCHEMA_INVALID');
  if(!found.length)return{sheet:sheet,record:null};
  const rec=found[0];let preferences;
  try{preferences=JSON.parse(String(rec.row[4]))}catch(_e){throw new Error('MEMBER_SETUP_SCHEMA_INVALID')}
  const version=Number(rec.row[3]);
  if(Number(rec.row[2])!==1||!Number.isSafeInteger(version)||version<1||!validateMemberSetup_(preferences))throw new Error('MEMBER_SETUP_SCHEMA_INVALID');
  const status=preferences.step===6?'preferences_saved':'in_progress';
  if(rec.row[5]!==status)throw new Error('MEMBER_SETUP_SCHEMA_INVALID');
  rec.profile={version:version,preferences:preferences,status:status};return{sheet:sheet,record:rec};
}
function memberSetup_(body){
  if(PropertiesService.getScriptProperties().getProperty('MEMBER_SETUP')!=='enabled')throw new Error('MEMBER_SETUP_DISABLED');
  const saving=body.operation==='save';
  rejectUnknownFields_(body,saving?['token','resource','operation','householdId','actor','expectedVersion','preferences']:['token','resource','operation','householdId','actor']);
  if(!['read','save'].includes(body.operation)||(saving&&(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||body.expectedVersion>=Number.MAX_SAFE_INTEGER||!validateMemberSetup_(body.preferences))))throw new Error('MEMBER_SETUP_INVALID');
  const lock=LockService.getScriptLock();lock.waitLock(30000);let writing=false;
  try{
    memberSetupAuthority_(body);
    const state=memberSetupRecord_(body);
    const profile=state.record?state.record.profile:{version:0,preferences:defaultMemberSetup_(),status:'not_started'};
    if(!saving)return{ok:true,profile:profile};
    if(profile.version!==body.expectedVersion)throw new Error('MEMBER_SETUP_CONFLICT');
    const next={version:profile.version+1,preferences:body.preferences,status:body.preferences.step===6?'preferences_saved':'in_progress'};
    // After this point any Google error is an uncertain write, not a failure.
    writing=true;
    let sheet=state.sheet;
    if(!sheet){sheet=SpreadsheetApp.getActive().insertSheet('Member Setup');sheet.getRange(1,1,1,MEMBER_SETUP_HEADERS.length).setValues([MEMBER_SETUP_HEADERS])}
    const sheetRow=state.record?state.record.sheetRow:Math.max(sheet.getLastRow()+1,2);
    sheet.getRange(sheetRow,1,1,MEMBER_SETUP_HEADERS.length).setValues([[body.actor,body.householdId,1,next.version,JSON.stringify(next.preferences),next.status,new Date().toISOString(),body.actor]]);
    SpreadsheetApp.flush();return{ok:true,profile:next};
  }catch(error){if(writing)throw new Error('MEMBER_SETUP_OUTCOME_UNKNOWN');throw error}
  finally{try{if(writing)SpreadsheetApp.flush()}catch(_e){console.error('Member setup cleanup flush failed')}finally{lock.releaseLock()}}
}

// Read-only member dashboard: never invoke header-repair/initializing legacy readers.
function memberText_(value){return typeof value==='string'?value.slice(0,500):''}
function memberObject_(value){return value&&typeof value==='object'&&!Array.isArray(value)}
function memberCellJson_(cell){const value=typeof cell==='string'?JSON.parse(cell):cell;if(!memberObject_(value))throw new Error('Invalid snapshot');return value}
function memberBudgetRead_(householdId){
  if(householdId!=='butler-household')return{state:'missing',value:null};
  const table=diagnosticsTable_('Projects',HEADERS);
  if(!table.present)return{state:'missing',value:null};
  if(!table.headersValid)return{state:'unavailable',value:null};
  const sheet=SpreadsheetApp.getActive().getSheetByName('Projects'),width=sheet.getLastColumn();
  const columns=sheet.getRange(1,1,1,width).getValues()[0].map(String);
  const snapshots=(sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,width).getValues():[]).filter(row=>row[25]!==''&&row[25]!==null&&row[25]!==undefined);
  if(!snapshots.length)return{state:'missing',value:null};
  if(snapshots.length!==1)return{state:'unavailable',value:null};
  try{
    const raw=memberCellJson_(snapshots[0][25]);
    const budgetColumns=columns.map((name,index)=>name==='budgetData'?index:-1).filter(index=>index>=0);
    if(budgetColumns.length>1)throw new Error('Ambiguous budget data');
    if(budgetColumns.length===1&&snapshots[0][budgetColumns[0]]){const budgetData=memberCellJson_(snapshots[0][budgetColumns[0]]);if(budgetData.reconciliation)raw.budgetReconciliation=budgetData.reconciliation}
    if(!memberObject_(raw.budget)||!Array.isArray(raw.budget.categories)||raw.budget.categories.length>100)throw new Error('Invalid budget');
    const names=new Set(),categories=raw.budget.categories.map(row=>{
      if(!memberObject_(row))throw new Error('Invalid category');
      const name=memberText_(row.name||row.b).trim(),planned=row.planned!==undefined?row.planned:row.limit!==undefined?row.limit:row.t;
      if(!name||names.has(name)||typeof planned!=='number'||!Number.isFinite(planned)||planned<0)throw new Error('Invalid category');
      names.add(name);return{name:name,planned:planned};
    });
    const rec=raw.budgetReconciliation&&raw.budgetReconciliation.categories;
    const reconciliation=[];
    if(Array.isArray(rec))for(const category of categories){const matches=rec.filter(row=>memberObject_(row)&&row.name===category.name);if(matches.length>1)throw new Error('Duplicate reconciliation');if(matches.length===1){const spent=matches[0].spent;if(typeof spent!=='number'||!Number.isFinite(spent)||spent<0)throw new Error('Invalid spend');reconciliation.push({name:category.name,spent:spent})}}
    return{state:'available',value:{asOf:memberText_(raw.asOf),budget:{categories:categories},budgetReconciliation:{categories:reconciliation}}};
  }catch(_e){return{state:'unavailable',value:null}}
}
function memberMealsRead_(householdId){
  const table=diagnosticsTable_('Meals',['key','householdId','schemaVersion','updatedAt','updatedBy','status','json','notes']);
  if(!table.present)return{state:'missing',value:null};
  if(!table.headersValid)return{state:'unavailable',value:null};
  const rows=table.rows.filter(row=>String(row[1])===householdId);
  if(!rows.length)return{state:'missing',value:null};
  if(rows.length!==1)return{state:'unavailable',value:null};
  try{
    const raw=memberCellJson_(rows[0][6]),plan=raw.approved;
    if(raw.householdId!==householdId)throw new Error('Foreign meals');
    if(!plan)return{state:'missing',value:null};
    if(!memberObject_(plan)||!Array.isArray(plan.days)||plan.days.length>7||plan.days.some(day=>!memberObject_(day)))throw new Error('Invalid meal plan');
    const grocery=Array.isArray(plan.groceryList)?plan.groceryList:[];
    if(grocery.length>200||grocery.some(item=>!memberObject_(item)))throw new Error('Invalid groceries');
    return{state:'available',value:{householdId:householdId,version:Number.isSafeInteger(raw.version)&&raw.version>0?raw.version:null,approved:{weekStart:memberText_(plan.weekStart),days:plan.days.map(day=>({date:memberText_(day.date),meal:memberText_(day.meal),prep:memberText_(day.prep)})),groceryList:grocery.map(item=>({item:memberText_(item.item),qty:memberText_(item.qty),done:item.done===true}))}}};
  }catch(_e){return{state:'unavailable',value:null}}
}
function memberFamilyRead_(householdId){
  const table=diagnosticsTable_('Project Resources',['id','householdId','schemaVersion','version','lifecycle','operatingState','name','area','scope','createdAt','createdBy','updatedAt','updatedBy','legacyProjectId','resourceJson','notes']);
  if(!table.present)return{state:'missing',value:[]};
  if(!table.headersValid)return{state:'unavailable',value:[]};
  const rows=table.rows.filter(row=>String(row[1])===householdId),counts=new Map();
  table.rows.forEach(row=>counts.set(String(row[0]),(counts.get(String(row[0]))||0)+1));
  if(rows.some(row=>counts.get(String(row[0]))!==1))return{state:'unavailable',value:[]};
  const shared=rows.filter(row=>row[8]==='household:shared'&&row[4]==='active');
  if(shared.length>500)return{state:'unavailable',value:[]};
  return{state:'available',value:shared.map(row=>({id:String(row[0]),name:memberText_(row[6]),householdId:householdId,lifecycle:'active',scope:'household:shared'}))};
}
function readMemberDashboard_(body){
  if(PropertiesService.getScriptProperties().getProperty('MEMBER_DASHBOARD')!=='enabled')throw new Error('MEMBER_DASHBOARD_DISABLED');
  rejectUnknownFields_(body,['token','resource','operation','householdId','actor']);
  if(body.operation!=='read')throw new Error('MEMBER_DASHBOARD_READ_ONLY');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    memberSetupAuthority_(body);
    const budget=memberBudgetRead_(body.householdId),meals=memberMealsRead_(body.householdId),family=memberFamilyRead_(body.householdId);
    const setup=memberSetupRecord_(body);
    return{ok:true,memberMealsEditEnabled:PropertiesService.getScriptProperties().getProperty('MEMBER_MEALS_EDIT')==='enabled',householdId:body.householdId,budgetSnapshot:budget.value,meals:meals.value,familyResources:family.value,profile:setup.record?setup.record.profile:null,sections:{budget:budget.state,meals:meals.state,family:family.state}};
  }finally{lock.releaseLock()}
}

function validMemberMealEdit_(operation,rows){
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const text=(value,max,blank)=>typeof value==='string'&&value.length<=max&&(blank||value.trim().length>0);
  if(!Array.isArray(rows))return false;
  if(operation==='edit_meals')return rows.length>0&&rows.length<=7&&new Set(rows.map(row=>row&&row.date)).size===rows.length&&rows.every(row=>object(row)&&Object.keys(row).length===3&&Object.keys(row).every(key=>['date','meal','prep'].includes(key))&&text(row.date,10,false)&&isProjectCalendarDate_(row.date)&&text(row.meal,200,false)&&text(row.prep,500,true));
  if(operation==='edit_groceries')return rows.length<=200&&rows.every(row=>object(row)&&Object.keys(row).length===3&&Object.keys(row).every(key=>['item','qty','done'].includes(key))&&text(row.item,200,false)&&text(row.qty,100,true)&&typeof row.done==='boolean');
  return false;
}
function editMemberMeals_(body){
  if(PropertiesService.getScriptProperties().getProperty('MEMBER_MEALS_EDIT')!=='enabled'||PropertiesService.getScriptProperties().getProperty('MEMBER_DASHBOARD')!=='enabled')throw new Error('MEMBER_MEALS_DISABLED');
  rejectUnknownFields_(body,['token','resource','operation','actor','householdId','expectedVersion','rows']);
  if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1||body.expectedVersion>=Number.MAX_SAFE_INTEGER||!validMemberMealEdit_(body.operation,body.rows))throw new Error('MEMBER_MEALS_INVALID');
  const lock=LockService.getScriptLock();lock.waitLock(30000);let writing=false;
  try{
    memberSetupAuthority_(body);
    const sheet=SpreadsheetApp.getActive().getSheetByName('Meals'),headers=['key','householdId','schemaVersion','updatedAt','updatedBy','status','json','notes'];
    if(!sheet||sheet.getRange(1,1,1,8).getValues()[0].map(String).join('|')!==headers.join('|'))throw new Error('MEMBER_MEALS_UNAVAILABLE');
    const rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues():[],matches=[];
    rows.forEach((row,index)=>{if(String(row[1])===body.householdId)matches.push({row:row,sheetRow:index+2})});
    if(matches.length!==1)throw new Error('MEMBER_MEALS_UNAVAILABLE');
    const rec=matches[0];if(!rec.row[0]||rows.filter(row=>String(row[0])===String(rec.row[0])).length!==1)throw new Error('MEMBER_MEALS_UNAVAILABLE');
    let current;try{current=memberCellJson_(rec.row[6])}catch(_e){throw new Error('MEMBER_MEALS_UNAVAILABLE')}
    if(current.householdId!==body.householdId)throw new Error('MEMBER_MEALS_FORBIDDEN');
    if(!Number.isSafeInteger(current.version)||current.version<1||!memberObject_(current.approved)||!Array.isArray(current.approved.days))throw new Error('MEMBER_MEALS_UNAVAILABLE');
    if(current.version!==body.expectedVersion)throw new Error('MEMBER_MEALS_CONFLICT');
    const next=JSON.parse(JSON.stringify(current));
    if(body.operation==='edit_meals'){
      // Edit existing approved dates only; adding weeks/approving drafts is separate.
      const dates=current.approved.days.map(day=>day&&day.date);
      if(new Set(dates).size!==dates.length||body.rows.length!==dates.length||body.rows.some(row=>!dates.includes(row.date)))throw new Error('MEMBER_MEALS_INVALID');
      next.approved.days=body.rows.map(row=>{const prior=current.approved.days.find(day=>day.date===row.date),day=JSON.parse(JSON.stringify(prior));day.date=row.date;day.meal=row.meal;day.prep=row.prep;if(prior.meal!==row.meal)delete day.recipe;return day});
    }else next.approved.groceryList=body.rows.map(row=>{const matches=Array.isArray(current.approved.groceryList)?current.approved.groceryList.filter(item=>item&&item.item===row.item):[];const item=matches.length===1?JSON.parse(JSON.stringify(matches[0])):{};item.item=row.item;item.qty=row.qty;item.done=row.done;return item});
    next.version=current.version+1;next.updatedAt=new Date().toISOString();next.updatedBy=body.actor;
    next.approved.updatedAt=next.updatedAt;next.approved.updatedBy=body.actor;
    const cells=rec.row.slice();cells[3]=next.updatedAt;cells[4]=body.actor;cells[6]=JSON.stringify(next);
    writing=true;sheet.getRange(rec.sheetRow,1,1,8).setValues([cells]);SpreadsheetApp.flush();
    return{ok:true,previousVersion:current.version,newVersion:next.version};
  }catch(error){if(writing)throw new Error('MEMBER_MEALS_OUTCOME_UNKNOWN');throw error}
  finally{try{if(writing)SpreadsheetApp.flush()}catch(_e){console.error('Member Meals cleanup flush failed')}finally{lock.releaseLock()}}
}
