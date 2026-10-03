import crypto from "node:crypto";
import {validateProjectDispatch} from "../../auth/project-dispatch.js";
import {enqueueProjectOperation} from "../../auth/project-dispatch-upstream.js";
import {requireMissionControlOrigin} from "../../auth/origin.js";
import {installUpstreamDirectoryAdapter} from "../../auth/upstream-directory.js";
import {installClerkIdentityAdapter} from "../../auth/clerk-adapter.js";
import {requireVerifiedIdentity} from "../../auth/session.js";
import {resolveAccessContext} from "../../auth/directory.js";
import {authorize} from "../../auth/authorization.js";

export default async function handler(req,res){
  installClerkIdentityAdapter();
  installUpstreamDirectoryAdapter();
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).json({ok:false,error:"Method not allowed"});}
  try{
    requireMissionControlOrigin(req);
    const identity=await requireVerifiedIdentity(req);
    const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
    const householdId=String(body.householdId||"");
    const resource=String(body.resource||"");
    const operation=String(body.operation||"");
    if(!householdId||!resource||!operation)return res.status(400).json({ok:false,error:"householdId, resource and operation are required"});
    const ctx=await resolveAccessContext(identity,householdId);
    const auth=authorize({user:ctx.user,household:ctx.household,membership:ctx.membership,resource,operation});
    if(!auth.ok)return res.status(403).json({ok:false,error:"Forbidden",reason:auth.reason});
    if(resource!=="projects")return res.status(400).json({ok:false,error:"Dispatcher resource not supported"});
    if(ctx.membership.role!=="principal")return res.status(403).json({ok:false,error:"Principal-only dispatcher commissioning",reason:"PRINCIPAL_REQUIRED"});
    const validated=validateProjectDispatch({operation,resourceId:String(body.resourceId||""),expectedVersion:body.expectedVersion,patch:body.patch});
    if(!validated.ok)return res.status(validated.status).json({ok:false,error:validated.reason,fields:validated.fields});
    const requestedOperationId=body.operationId===undefined?"":String(body.operationId);
    if(requestedOperationId&&!/^ui_[0-9a-f-]{36}$/i.test(requestedOperationId))return res.status(400).json({ok:false,error:"operationId invalid"});
    const operationId=requestedOperationId||("ui_"+crypto.randomUUID());
    const result=await enqueueProjectOperation({validated,householdId:ctx.household.householdId,userId:ctx.user.userId,operationId});
    return res.status(202).json({ok:true,accepted:true,operationId,result});
  }catch(e){
    const status=Number(e&&e.statusCode)||500;
    return res.status(status).json({ok:false,error:String(e&&e.message||e),code:e&&e.code||"AUTH_ERROR",operationId:e&&e.operationId||undefined});
  }
}
