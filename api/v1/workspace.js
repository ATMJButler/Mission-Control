import {requireMissionControlOrigin} from "../../auth/origin.js";
import {installClerkIdentityAdapter} from "../../auth/clerk-adapter.js";
import {requireVerifiedIdentity} from "../../auth/session.js";
import {installUpstreamDirectoryAdapter} from "../../auth/upstream-directory.js";
import {resolveAccessContext} from "../../auth/directory.js";
import {authorize} from "../../auth/authorization.js";

// Origin-checked read uses POST so an old GET-caching service worker cannot
// replay another account's workspace routing decision. This grants no writes.
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  res.setHeader("Vary","Cookie, Authorization, Origin");
  if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).json({ok:false,code:"METHOD_NOT_ALLOWED"});}
  try{
    requireMissionControlOrigin(req);
    installClerkIdentityAdapter();installUpstreamDirectoryAdapter();
    const identity=await requireVerifiedIdentity(req);
    let body;try{body=typeof req.body==="string"?JSON.parse(req.body):req.body}catch{body=null}
    if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(k=>k!=="householdId")||
      (body.householdId!==undefined&&(typeof body.householdId!=="string"||!body.householdId.trim()||body.householdId.length>120)))
      return res.status(400).json({ok:false,code:"INVALID_WORKSPACE_REQUEST"});
    const householdId=body.householdId||process.env.MC_DEFAULT_HOUSEHOLD_ID||"butler-household";
    const ctx=await resolveAccessContext(identity,householdId);
    const auth=authorize({...ctx,resource:"identity",operation:"read_self"});
    if(!auth.ok)return res.status(403).json({ok:false,code:"WORKSPACE_FORBIDDEN"});
    return res.status(200).json({ok:true,workspace:{role:auth.role,principalWorkspace:auth.role==="principal",memberSetupReady:false}});
  }catch(error){
    const allowed=new Set(["UNAUTHENTICATED","USER_NOT_PROVISIONED","IDENTITY_BINDING_NOT_UNIQUE","HOUSEHOLD_INACTIVE_OR_MISSING","MEMBERSHIP_INACTIVE_OR_MISSING","MEMBERSHIP_NOT_UNIQUE","ORIGIN_FORBIDDEN","CROSS_SITE_FORBIDDEN"]);
    return res.status([401,403,409,502,503].includes(error?.statusCode)?error.statusCode:503).json({ok:false,code:allowed.has(error?.code)?error.code:"WORKSPACE_UNAVAILABLE"});
  }
}
