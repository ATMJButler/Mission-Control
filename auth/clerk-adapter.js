import {createClerkClient} from "@clerk/backend";

function absoluteRequest(req){
  const proto=String(req.headers["x-forwarded-proto"]||"https").split(",")[0].trim();
  const host=String(req.headers["x-forwarded-host"]||req.headers.host||"").split(",")[0].trim();
  if(!host)throw new Error("Request host unavailable");
  const url=new URL(req.url||"/",proto+"://"+host);
  const headers=new Headers();
  for(const [k,v] of Object.entries(req.headers||{})){
    if(Array.isArray(v))v.forEach(x=>headers.append(k,String(x)));
    else if(v!==undefined)headers.set(k,String(v));
  }
  return new Request(url,{method:req.method||"GET",headers});
}

export function installClerkIdentityAdapter(){
  const secretKey=process.env.CLERK_SECRET_KEY;
  const publishableKey=process.env.CLERK_PUBLISHABLE_KEY;
  if(!secretKey||!publishableKey)return false;
  const client=createClerkClient({secretKey,publishableKey});
  globalThis.__MC_IDENTITY_ADAPTER__={
    async verifyRequest(req){
      const parties=(process.env.MC_AUTHORIZED_PARTIES||"").split(",").map(x=>x.trim()).filter(Boolean);
      const request=absoluteRequest(req);
      const state=await client.authenticateRequest(request,{authorizedParties:parties.length?parties:undefined});
      if(!state.isAuthenticated)return null;
      const auth=state.toAuth();
      if(!auth.userId)return null;
      const user=await client.users.getUser(auth.userId);
      const primary=user.emailAddresses.find(x=>x.id===user.primaryEmailAddressId)||user.emailAddresses[0];
      return {provider:"clerk",subject:auth.userId,email:primary?.emailAddress||null,displayName:[user.firstName,user.lastName].filter(Boolean).join(" ")||user.username||null};
    }
  };
  return true;
}
