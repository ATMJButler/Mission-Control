async function callDirectory(payload){
  const upstream=process.env.MC_SYNC_URL,token=process.env.MC_SYNC_TOKEN;
  if(!upstream||!token)throw Object.assign(new Error("Private directory upstream unavailable"),{statusCode:503,code:"DIRECTORY_UPSTREAM_UNAVAILABLE"});
  const r=await fetch(upstream,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({...payload,token}),cache:"no-store",redirect:"follow"});
  const text=await r.text(),type=String(r.headers.get("content-type")||"");
  let body=null;try{body=JSON.parse(text)}catch(_e){
    let finalHost="unknown";try{finalHost=new URL(r.url).hostname}catch(_e){}
    let configuredHost="unknown";try{configuredHost=new URL(upstream).hostname}catch(_e){}
    console.error("MC_IDENTITY_UPSTREAM_NON_JSON",{status:r.status,contentType:type,configuredHost,finalHost,redirected:r.redirected});
    const e=new Error("Identity directory upstream returned non-JSON response");
    e.statusCode=502;e.code="DIRECTORY_UPSTREAM_NON_JSON";throw e;
  }
  if(!r.ok||!body.ok){const e=new Error(body.reason||body.error||"Directory access denied");e.code=body.reason||"DIRECTORY_DENIED";e.statusCode=body.error==="BOOTSTRAP_CLOSED"?409:403;throw e}
  return body;
}
export function installUpstreamDirectoryAdapter(){
  globalThis.__MC_DIRECTORY_ADAPTER__={
    async resolveAccessContext(identity,requestedHouseholdId){
      const body=await callDirectory({resource:"identity_directory",operation:"resolve",provider:identity.provider,subject:identity.subject,householdId:requestedHouseholdId});
      return {user:body.user,household:body.household,membership:body.membership};
    }
  };return true;
}
export async function bootstrapFirstPrincipal(identity){
  return callDirectory({resource:"identity_directory",operation:"bootstrap_first_principal",identity:{provider:identity.provider,subject:identity.subject,email:identity.email,displayName:identity.displayName}});
}
