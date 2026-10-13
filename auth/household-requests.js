import '../household-request-model.js';
import {projectMemberMeals,projectMemberBudget} from './member-projection.js';
export const requestModel=globalThis.MCHouseholdRequests;
export function projectHouseholdRequests(body,role,actor,householdId){
 const d=body?.data;if(body?.ok!==true||body.householdId!==householdId||!d||!Number.isSafeInteger(d.version)||d.version<0||!Array.isArray(d.requests)||d.requests.length>500||!Array.isArray(d.events)||d.events.length>200||d.events.some(e=>!requestModel.validateEvent(e)))throw Error('HOUSEHOLD_REQUESTS_UNAVAILABLE');
 const child=role==='child',requests=d.requests.map(r=>{
  if(!r||typeof r.id!=='string'||!requestModel.validateRequest(r.request)||!['pending','applying','approved','declined','approved_review'].includes(r.status)||(child&&r.actor!==actor))throw Error('HOUSEHOLD_REQUESTS_UNAVAILABLE');
  return{id:r.id,request:structuredClone(r.request),status:r.status,createdAt:String(r.createdAt||''),response:String(r.response||''),...(child?{}:{requestedBy:String(r.requestedBy||'Household member')})};
 });
 const meals=d.meals?projectMemberMeals(d.meals,householdId):null,budget=d.budget?projectMemberBudget(d.budget):null;
 if((d.meals&&!meals)||(d.budget&&!budget))throw Error('HOUSEHOLD_REQUESTS_UNAVAILABLE');
 return{ok:true,data:{version:d.version,role,requests,events:d.events.map(e=>({...e})),meals,budget,...(role==='principal'?{budgetCategories:d.budgetCategories||[],budgetOptions:d.budgetOptions||[]}:{}),lastCommandId:String(d.lastCommandId||'')}};
}
export async function callHouseholdRequests(payload,role){
 const writing=!['dashboard','inbox'].includes(payload.operation),fail=()=>Object.assign(Error('Requests unavailable'),{statusCode:503,code:writing?'HOUSEHOLD_REQUESTS_OUTCOME_UNKNOWN':'HOUSEHOLD_REQUESTS_UNAVAILABLE'});
 if(!process.env.MC_SYNC_URL||!process.env.MC_SYNC_TOKEN)throw fail();
 let response,body;try{response=await fetch(process.env.MC_SYNC_URL,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...payload,resource:'household_requests',token:process.env.MC_SYNC_TOKEN})});body=await response.json();}catch{throw fail();}
 if(!response.ok)throw fail();
 if(body?.ok!==true){const codes={HOUSEHOLD_REQUESTS_DISABLED:503,HOUSEHOLD_REQUESTS_FORBIDDEN:403,HOUSEHOLD_REQUESTS_INVALID:400,HOUSEHOLD_REQUESTS_CONFLICT:409,HOUSEHOLD_REQUESTS_SCHEMA_INVALID:503,HOUSEHOLD_REQUESTS_REVIEW_REQUIRED:409};if(codes[body?.error])throw Object.assign(Error('Request rejected'),{code:body.error,statusCode:codes[body.error]});throw fail();}
 let result;try{result=projectHouseholdRequests(body,role,payload.actor,payload.householdId);}catch{throw fail();}
 if(writing&&(result.data.lastCommandId!==payload.commandId||result.data.version!==payload.expectedVersion+1))throw fail();return result;
}
