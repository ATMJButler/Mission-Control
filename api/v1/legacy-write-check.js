import {installClerkIdentityAdapter} from "../../auth/clerk-adapter.js";
import {requireVerifiedIdentity} from "../../auth/session.js";
import {installUpstreamDirectoryAdapter} from "../../auth/upstream-directory.js";
import {resolveAccessContext} from "../../auth/directory.js";
import {authorize} from "../../auth/authorization.js";

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).json({ok:false,error:"Method not allowed"});}
  try{
    installClerkIdentityAdapter();installUpstreamDirectoryAdapter();
    const identity=await requireVerifiedIdentity(req);
    const ctx=await resolveAccessContext(identity,"butler-household");
    const auth=authorize({user:ctx.user,household:ctx.household,membership:ctx.membership,resource:"projects",operation:"update_project"});
    if(!auth.ok)return res.status(403).json({ok:false,error:"Forbidden",reason:auth.reason});
    if(ctx.membership.role!=="principal")return res.status(403).json({ok:false,error:"Legacy workspace is principal-only",code:"LEGACY_PRINCIPAL_REQUIRED"});
    return res.status(200).json({ok:true,authorized:true,validationOnly:true,householdId:ctx.household.householdId,role:ctx.membership.role});
  }catch(e){return res.status(Number(e&&e.statusCode)||500).json({ok:false,error:String(e&&e.message||e),code:e&&e.code||"AUTH_ERROR"})}
}
