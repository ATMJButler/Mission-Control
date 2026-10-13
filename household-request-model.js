/* Shared request validation, also embedded in Apps Script. */
// BEGIN HOUSEHOLD REQUEST MODEL
var MCHouseholdRequests=(()=>{
 const obj=v=>v&&typeof v==='object'&&!Array.isArray(v),keys=(v,allowed)=>obj(v)&&Object.keys(v).length===allowed.length&&Object.keys(v).every(k=>allowed.includes(k));
 const text=(v,max,blank=false)=>typeof v==='string'&&v.length<=max&&(blank||v.trim().length>0);
 const id=v=>text(v,100)&&/^[\w-]+$/.test(v);
 const date=v=>{try{return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;}catch{return false;}};
 function validateRequest(v){
  if(!obj(v)||!['grocery','meal','calendar'].includes(v.kind))return false;
  const fields=v.kind==='grocery'?['kind','item','quantity','plan','weekStart','note']:v.kind==='meal'?['kind','meal','prep','date','plan','weekStart','note']:['kind','title','date','time','note'];
  if(!keys(v,fields)||!text(v.note,500,true))return false;
  if(v.kind==='calendar')return text(v.title,200)&&date(v.date)&&text(v.time,100,true);
  if(!['approved','draft'].includes(v.plan)||!date(v.weekStart))return false;
  return v.kind==='grocery'?text(v.item,200)&&text(v.quantity,100):text(v.meal,200)&&text(v.prep,500,true)&&date(v.date);
 }
 function validateEvent(v){return keys(v,['id','title','date','time','note'])&&id(v.id)&&text(v.title,200)&&date(v.date)&&text(v.time,100,true)&&text(v.note,500,true);}
 function validate(body){
  if(!obj(body)||!['dashboard','submit','inbox','decide','settings','publish_event','remove_event'].includes(body.operation))return false;
  const allowed=['operation','householdId',...(['dashboard','inbox'].includes(body.operation)?[]:['expectedVersion','commandId']),...(body.operation==='submit'?['request']:body.operation==='decide'?['requestId','decision','response','expectedMealsVersion']:body.operation==='settings'?['budgetCategories']:body.operation==='publish_event'?['event']:body.operation==='remove_event'?['eventId']:[])];
  if(Object.keys(body).some(k=>!allowed.includes(k))||(body.householdId!==undefined&&!text(body.householdId,120)))return false;
  if(['dashboard','inbox'].includes(body.operation))return true;
  if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||body.expectedVersion>=Number.MAX_SAFE_INTEGER||!id(body.commandId)||body.commandId.length>96)return false;
  if(body.operation==='submit')return validateRequest(body.request);
  if(body.operation==='decide')return id(body.requestId)&&['approve','decline'].includes(body.decision)&&text(body.response,500,true)&&Number.isSafeInteger(body.expectedMealsVersion)&&body.expectedMealsVersion>=0;
  if(body.operation==='settings')return Array.isArray(body.budgetCategories)&&body.budgetCategories.length<=100&&body.budgetCategories.every(x=>text(x,100))&&new Set(body.budgetCategories).size===body.budgetCategories.length;
  if(body.operation==='publish_event')return validateEvent(body.event);
  return id(body.eventId);
 }
 return{validate,validateRequest,validateEvent};
})();
if(typeof globalThis!=='undefined')globalThis.MCHouseholdRequests=MCHouseholdRequests;
// END HOUSEHOLD REQUEST MODEL
