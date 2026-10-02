// Identity directory interface. Initial backing store will be Mission Control Shared Data.
// Route code depends on this interface rather than spreadsheet implementation details.
export async function resolveAccessContext(identity, requestedHouseholdId){
  const adapter=globalThis.__MC_DIRECTORY_ADAPTER__;
  if(!adapter||typeof adapter.resolveAccessContext!=="function"){
    const e=new Error("Mission Control identity directory is not configured.");
    e.code="DIRECTORY_NOT_CONFIGURED"; e.statusCode=503; throw e;
  }
  return adapter.resolveAccessContext(identity, requestedHouseholdId);
}
