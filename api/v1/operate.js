import {installClerkIdentityAdapter} from "../../auth/clerk-adapter.js";
import {requireVerifiedIdentity} from "../../auth/session.js";
import {resolveAccessContext} from "../../auth/directory.js";
import {authorize} from "../../auth/authorization.js";

export default async function handler(req,res){
  installClerkIdentityAdapter();
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).json({ok:false,error:"Method not allowed"});}
  try{
    const identity=await requireVerifiedIdentity(req);
    const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
    const householdId=String(body.householdId||"");
    const resource=String(body.resource||"");
    const operation=String(body.operation||"");
    if(!householdId||!resource||!operation)return res.status(400).json({ok:false,error:"householdId, resource and operation are required"});
    const ctx=await resolveAccessContext(identity,householdId);
    const auth=authorize({user:ctx.user,household:ctx.household,membership:ctx.membership,resource,operation});
    if(!auth.ok)return res.status(403).json({ok:false,error:"Forbidden",reason:auth.reason});
    // Intentionally no mutation dispatcher yet. Auth boundary must be commissioned first.
    return res.status(501).json({ok:false,error:"Authorized boundary reached; resource mutation dispatcher not commissioned.",authorization:auth});
  }catch(e){
    const status=Number(e&&e.statusCode)||500;
    return res.status(status).json({ok:false,error:String(e&&e.message||e),code:e&&e.code||"AUTH_ERROR"});
  }
}
