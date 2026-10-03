export function projectDispatchEnabled(){return process.env.MC_PROJECT_V1_DISPATCH==="enabled"}
export async function enqueueProjectOperation({validated,householdId,userId}){
  if(!projectDispatchEnabled())throw Object.assign(new Error("Project-v1 dispatcher is not commissioned."),{statusCode:503,code:"PROJECT_V1_DISPATCH_DISABLED"});
  const upstream=process.env.MC_SYNC_URL,token=process.env.MC_SYNC_TOKEN;
  if(!upstream||!token)throw Object.assign(new Error("Private Project-v1 upstream unavailable."),{statusCode:503,code:"PROJECT_UPSTREAM_UNAVAILABLE"});
  const body={token,resource:"project_operation",householdId,actorId:userId,operation:validated.operation,resourceId:validated.resourceId,expectedVersion:validated.expectedVersion,payload:validated.patch?{patch:validated.patch}:{}};
  const r=await fetch(upstream,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body),cache:"no-store"});
  const text=await r.text();let result;try{result=JSON.parse(text)}catch(_e){throw Object.assign(new Error("Project-v1 upstream returned non-JSON"),{statusCode:502,code:"PROJECT_UPSTREAM_NON_JSON"})}
  if(!result.ok){const code=result.status||result.error||"PROJECT_OPERATION_DENIED";const status=code==="CONFLICT"?409:code==="INVALID"?400:code==="FORBIDDEN"?403:502;throw Object.assign(new Error(code),{statusCode:status,code})}
  return result;
}
