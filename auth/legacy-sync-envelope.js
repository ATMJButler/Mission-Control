export function buildLegacyProjectEnvelope({incoming,token,userId,householdId}){
  const allowedKeys=new Set(["projects","source"]);
  const unknown=Object.keys(incoming||{}).filter(k=>!allowedKeys.has(k));
  if(unknown.length)return {ok:false,status:400,error:"Unsupported legacy sync fields",fields:unknown};
  if(!Array.isArray(incoming?.projects))return {ok:false,status:400,error:"projects array required"};
  return {ok:true,payload:{token,resource:"projects",operation:"legacy_merge",projects:incoming.projects,source:String(incoming.source||""),actor:userId,householdId}};
}
