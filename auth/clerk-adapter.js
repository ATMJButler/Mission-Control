import {createClerkClient} from "@clerk/backend";

export function installClerkIdentityAdapter(){
  const secretKey=process.env.CLERK_SECRET_KEY;
  const publishableKey=process.env.CLERK_PUBLISHABLE_KEY;
  if(!secretKey||!publishableKey)return false;
  const client=createClerkClient({secretKey,publishableKey});
  globalThis.__MC_IDENTITY_ADAPTER__={
    async verifyRequest(req){
      const parties=(process.env.MC_AUTHORIZED_PARTIES||"").split(",").map(x=>x.trim()).filter(Boolean);
      const state=await client.authenticateRequest(req,{authorizedParties:parties.length?parties:undefined});
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
