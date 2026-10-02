// Provider-neutral session boundary.
// A provider adapter MUST return a verified immutable provider subject.
// Never accept userId, role, household authority, or providerSubject from request body/query.
export async function requireVerifiedIdentity(req){
  const adapter=globalThis.__MC_IDENTITY_ADAPTER__;
  if(!adapter||typeof adapter.verifyRequest!=="function"){
    const e=new Error("Mission Control identity provider is not configured.");
    e.code="AUTH_NOT_CONFIGURED"; e.statusCode=503; throw e;
  }
  const identity=await adapter.verifyRequest(req);
  if(!identity||!identity.provider||!identity.subject){
    const e=new Error("Authentication required."); e.code="UNAUTHENTICATED"; e.statusCode=401; throw e;
  }
  return {provider:String(identity.provider),subject:String(identity.subject),email:identity.email?String(identity.email):null,displayName:identity.displayName?String(identity.displayName):null};
}
