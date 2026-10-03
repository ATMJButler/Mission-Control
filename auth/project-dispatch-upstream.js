import crypto from "node:crypto";
export function projectDispatchEnabled(){return process.env.MC_PROJECT_V1_DISPATCH==="enabled"}
export async function enqueueProjectOperation({validated,householdId,userId}){
  if(!projectDispatchEnabled())throw Object.assign(new Error("Project-v1 dispatcher is not commissioned."),{statusCode:503,code:"PROJECT_V1_DISPATCH_DISABLED"});
  const upstream=process.env.MC_SYNC_URL,token=process.env.MC_SYNC_TOKEN;
  if(!upstream||!token)throw Object.assign(new Error("Private Project-v1 upstream unavailable."),{statusCode:503,code:"PROJECT_UPSTREAM_UNAVAILABLE"});
  const body={token,resource:"project_trusted_operation",operationId:"ui_"+crypto.randomUUID(),householdId,actor:userId,operation:validated.operation,projectId:validated.resourceId,expectedVersion:validated.expectedVersion};if(validated.patch)body.patch=validated.patch;
  let r;try{r=await fetch(upstream,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body),cache:"no-store"})}catch(_e){throw Object.assign(new Error("Project operation outcome unknown; reconcile by operationId and project readback before retry."),{statusCode:502,code:"PROJECT_OUTCOME_UNKNOWN",operationId:body.operationId})}
  const text=await r.text();let result;try{result=JSON.parse(text)}catch(_e){throw Object.assign(new Error("Project operation outcome unknown; non-JSON upstream response requires readback reconciliation."),{statusCode:502,code:"PROJECT_OUTCOME_UNKNOWN",operationId:body.operationId})}
  if(!r.ok)throw Object.assign(new Error("Project upstream HTTP "+r.status),{statusCode:502,code:"PROJECT_UPSTREAM_HTTP"});
  if(!result.ok){const raw=String(result.status||result.error||"PROJECT_OPERATION_DENIED"),prefix=raw.split(":")[0].trim(),status=prefix==="CONFLICT"?409:prefix==="INVALID"?400:prefix==="FORBIDDEN"?403:502;throw Object.assign(new Error(raw),{statusCode:status,code:prefix,operationId:body.operationId})}
  if(!result.project||String(result.project.id)!==String(validated.resourceId))throw Object.assign(new Error("Project upstream response identity mismatch"),{statusCode:502,code:"PROJECT_RESPONSE_INVALID",operationId:body.operationId});
  if(Number(result.previousVersion)!==Number(validated.expectedVersion)||Number(result.newVersion)!==Number(validated.expectedVersion)+1||Number(result.project.version)!==Number(result.newVersion))throw Object.assign(new Error("Project upstream response version mismatch"),{statusCode:502,code:"PROJECT_RESPONSE_INVALID",operationId:body.operationId});
  return {...result,operationId:body.operationId};
}
