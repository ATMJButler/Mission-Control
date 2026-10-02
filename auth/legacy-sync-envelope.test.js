import {buildLegacyProjectEnvelope} from "./legacy-sync-envelope.js";
const base={token:"secret",userId:"verified-user",householdId:"butler-household"};
const good=buildLegacyProjectEnvelope({...base,incoming:{projects:[{id:"p1"}],source:"browser"}});
if(!good.ok||good.payload.resource!=="projects"||good.payload.operation!=="legacy_merge"||good.payload.actor!=="verified-user")throw new Error("valid envelope failed");
for(const field of ["resource","operation","actor","actorUserId","provider","subject","identity","householdId","token"]){
 const r=buildLegacyProjectEnvelope({...base,incoming:{projects:[],[field]:"attacker"}});
 if(r.ok)throw new Error("privileged field accepted: "+field);
}
console.log(JSON.stringify({ok:true,blockedPrivilegedFields:9}));
