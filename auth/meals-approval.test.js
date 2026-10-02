import {authorize} from "./authorization.js";
const principal={user:{userId:"u1",status:"active"},household:{householdId:"h1",status:"active"},membership:{userId:"u1",householdId:"h1",role:"principal",status:"active"}};
const secondary={...principal,membership:{...principal.membership,role:"secondary"}};
for(const ctx of [principal,secondary]){
  const r=authorize({...ctx,resource:"meals",operation:"approve"});
  if(!r.ok)throw new Error("approve should be allowed for "+ctx.membership.role);
}
const legacy=authorize({...principal,resource:"meals",operation:"approve_week"});
if(legacy.ok)throw new Error("legacy approve_week alias should not be authorized");
console.log(JSON.stringify({ok:true,operation:"approve"}));
