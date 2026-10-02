export function installUpstreamDirectoryAdapter(){
  const upstream=process.env.MC_SYNC_URL,token=process.env.MC_SYNC_TOKEN;
  if(!upstream||!token)return false;
  globalThis.__MC_DIRECTORY_ADAPTER__={
    async resolveAccessContext(identity,requestedHouseholdId){
      const payload={token,resource:"identity_directory",operation:"resolve",provider:identity.provider,subject:identity.subject,householdId:requestedHouseholdId};
      const r=await fetch(upstream,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload),cache:"no-store"});
      const body=await r.json();
      if(!r.ok||!body.ok){const e=new Error(body.reason||body.error||"Directory access denied");e.code=body.reason||"DIRECTORY_DENIED";e.statusCode=403;throw e}
      return {user:body.user,household:body.household,membership:body.membership};
    }
  };return true;
}
export async function bootstrapFirstPrincipal(identity){
  const upstream=process.env.MC_SYNC_URL,token=process.env.MC_SYNC_TOKEN;
  if(!upstream||!token)throw Object.assign(new Error("Private directory upstream unavailable"),{statusCode:503});
  const payload={token,resource:"identity_directory",operation:"bootstrap_first_principal",identity:{provider:identity.provider,subject:identity.subject,email:identity.email,displayName:identity.displayName}};
  const r=await fetch(upstream,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload),cache:"no-store"});
  const body=await r.json();if(!r.ok||!body.ok)throw Object.assign(new Error(body.error||"Bootstrap denied"),{statusCode:body.error==="BOOTSTRAP_CLOSED"?409:403});return body;
}
