// Directory adapter contract for Identity/Auth v1.
// Production implementation must resolve ONLY by verified provider + immutable subject.
// Email/displayName are never authorization keys.
export function installDirectoryAdapter(adapter){
  if(!adapter||typeof adapter.resolveAccessContext!=="function")throw new Error("Invalid directory adapter");
  globalThis.__MC_DIRECTORY_ADAPTER__=adapter;
}
export function validateDirectoryRows({identity,users,households,memberships,requestedHouseholdId}){
  const matches=users.filter(u=>u.status==="active"&&u.identityProvider===identity.provider&&u.providerSubject===identity.subject);
  if(matches.length!==1)return {ok:false,reason:matches.length?"IDENTITY_BINDING_NOT_UNIQUE":"USER_NOT_PROVISIONED"};
  const user=matches[0];
  const household=households.find(h=>h.householdId===requestedHouseholdId&&h.status==="active");
  if(!household)return {ok:false,reason:"HOUSEHOLD_INACTIVE_OR_MISSING"};
  const ms=memberships.filter(m=>m.userId===user.userId&&m.householdId===household.householdId&&m.status==="active");
  if(ms.length!==1)return {ok:false,reason:ms.length?"MEMBERSHIP_NOT_UNIQUE":"MEMBERSHIP_INACTIVE_OR_MISSING"};
  return {ok:true,user,household,membership:ms[0]};
}
