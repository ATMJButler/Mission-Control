export const setupDefaults = () => ({step:0,startView:'schedule',timeZone:'America/Chicago',calendarProviders:[],emailProviders:[],sharingDefault:'private'});
export function validateSetupPreferences(value) {
  const keys=['step','startView','timeZone','calendarProviders','emailProviders','sharingDefault'];
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key))) return false;
  if(!Number.isInteger(value.step)||value.step<0||value.step>6||!['schedule','budget','meals','family'].includes(value.startView)||!['America/Chicago','America/New_York','America/Denver','America/Los_Angeles','America/Phoenix','Pacific/Honolulu','America/Anchorage','UTC'].includes(value.timeZone)||!['private','busy'].includes(value.sharingDefault))return false;
  return ['calendarProviders','emailProviders'].every(key=>Array.isArray(value[key])&&value[key].length<=2&&value[key].every(item=>['google','microsoft'].includes(item))&&new Set(value[key]).size===value[key].length);
}
export function projectSetupResult(body) {
  const profile=body?.profile;
  if(body?.ok!==true||!profile||!Number.isSafeInteger(profile.version)||profile.version<0||!validateSetupPreferences(profile.preferences)||profile.status!==(profile.version===0?'not_started':profile.preferences.step===6?'preferences_saved':'in_progress'))throw new Error('MEMBER_SETUP_UNAVAILABLE');
  return {ok:true,profile:{version:profile.version,preferences:structuredClone(profile.preferences),status:profile.status},
    capabilities:{calendarConnections:false,emailConnections:false,sharedDashboard:false}};
}
export async function callMemberSetup(payload) {
  const saving=payload.operation==='save';
  const fail=()=>Object.assign(new Error('Member setup unavailable'),{code:saving?'MEMBER_SETUP_OUTCOME_UNKNOWN':'MEMBER_SETUP_UNAVAILABLE',statusCode:503});
  const upstream=process.env.MC_SYNC_URL,token=process.env.MC_SYNC_TOKEN;
  if(!upstream||!token)throw Object.assign(new Error('Setup backend not configured'),{code:'MEMBER_SETUP_UNAVAILABLE',statusCode:503});
  let response,body;
  try {response=await fetch(upstream,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},cache:'no-store',body:JSON.stringify({...payload,resource:'member_setup',token})});body=await response.json();}catch{throw fail();}
  if(!response.ok)throw fail();
  if(body?.ok!==true){
    const codes={MEMBER_SETUP_DISABLED:503,MEMBER_SETUP_FORBIDDEN:403,MEMBER_SETUP_INVALID:400,MEMBER_SETUP_CONFLICT:409,MEMBER_SETUP_SCHEMA_INVALID:503};
    if(Object.hasOwn(codes,body?.error))throw Object.assign(new Error('Setup request rejected'),{code:body.error,statusCode:codes[body.error]});
    throw fail();
  }
  let projected;try{projected=projectSetupResult(body);}catch{throw fail();}
  if(saving&&(projected.profile.version!==payload.expectedVersion+1||JSON.stringify(projected.profile.preferences)!==JSON.stringify(payload.preferences)))throw fail();
  return projected;
}
