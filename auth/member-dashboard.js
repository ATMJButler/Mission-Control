import {projectMemberBudget,projectMemberMeals,projectMemberFamily} from './member-projection.js';
import {projectSetupResult} from './member-setup.js';
export function projectMemberDashboard(body,householdId,{mealsEditEnabled=false,personalConnectionsEnabled=false}={}){
  if(body?.ok!==true||body.householdId!==householdId||!body.sections||!['available','missing','unavailable'].includes(body.sections.budget)||!['available','missing','unavailable'].includes(body.sections.meals)||!['available','missing','unavailable'].includes(body.sections.family))throw new Error('MEMBER_DASHBOARD_UNAVAILABLE');
  const budget=body.sections.budget==='available'?projectMemberBudget(body.budgetSnapshot):null;
  const meals=body.sections.meals==='available'?projectMemberMeals(body.meals,householdId):null;
  const family=body.sections.family==='available'?projectMemberFamily(body.familyResources,householdId):[];
  if((body.sections.budget==='available'&&!budget)||(body.sections.meals==='available'&&!meals)||(body.sections.family==='available'&&(!Array.isArray(body.familyResources)||body.familyResources.length>500||family.length!==body.familyResources.length)))throw new Error('MEMBER_DASHBOARD_UNAVAILABLE');
  const profile=body.profile?projectSetupResult({ok:true,profile:body.profile}).profile:null;
  return {ok:true,dashboard:{budget,meals,family,profile,sections:{budget:body.sections.budget,meals:body.sections.meals,family:body.sections.family},
    capabilities:{mealsEdit:mealsEditEnabled&&body.memberMealsEditEnabled===true&&Number.isSafeInteger(meals?.version),personalSchedule:personalConnectionsEnabled&&body.personalConnectionsEnabled===true,calendarConnections:personalConnectionsEnabled&&body.personalConnectionsEnabled===true,emailConnections:false,familyCalendar:false}}};
}
export async function readMemberDashboard({actor,householdId}){
  const upstream=process.env.MC_SYNC_URL,token=process.env.MC_SYNC_TOKEN;
  const failure=()=>Object.assign(new Error('Dashboard unavailable'),{code:'MEMBER_DASHBOARD_UNAVAILABLE',statusCode:503});
  if(!upstream||!token)throw failure();
  let response,body;try{response=await fetch(upstream,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},cache:'no-store',signal:AbortSignal.timeout(15000),body:JSON.stringify({resource:'member_dashboard',operation:'read',actor,householdId,token})});body=await response.json();}catch{throw failure();}
  if(!response.ok)throw failure();
  if(body?.ok!==true){const codes={MEMBER_DASHBOARD_DISABLED:503,MEMBER_SETUP_FORBIDDEN:403};if(Object.hasOwn(codes,body?.error))throw Object.assign(new Error('Dashboard rejected'),{code:body.error==='MEMBER_SETUP_FORBIDDEN'?'MEMBER_DASHBOARD_FORBIDDEN':body.error,statusCode:codes[body.error]});throw failure();}
  try{return projectMemberDashboard(body,householdId,{mealsEditEnabled:process.env.MC_MEMBER_MEALS_EDIT==='enabled',personalConnectionsEnabled:process.env.MC_PERSONAL_CONNECTIONS==='enabled'});}catch{throw failure();}
}
