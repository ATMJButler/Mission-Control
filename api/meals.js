import {installClerkIdentityAdapter} from "../auth/clerk-adapter.js";
import {requireVerifiedIdentity} from "../auth/session.js";
import {installUpstreamDirectoryAdapter} from "../auth/upstream-directory.js";
import {resolveAccessContext} from "../auth/directory.js";
import {authorize} from "../auth/authorization.js";
import {requireMissionControlOrigin} from "../auth/origin.js";
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  const upstream=process.env.MC_SYNC_URL,token=process.env.MC_SYNC_TOKEN;
  if(!upstream||!token)return res.status(503).json({ok:false,error:"Mission Control private sync is not configured."});
  try{
    if(req.method==="GET"){
      installClerkIdentityAdapter();installUpstreamDirectoryAdapter();
      const identity=await requireVerifiedIdentity(req),ctx=await resolveAccessContext(identity,"butler-household");
      const auth=authorize({user:ctx.user,household:ctx.household,membership:ctx.membership,resource:"meals",operation:"read"});
      if(!auth.ok)return res.status(403).json({ok:false,error:"Forbidden",reason:auth.reason});
      const sep=upstream.includes("?")?"&":"?";
      const r=await fetch(upstream+sep+"token="+encodeURIComponent(token)+"&resource=meals",{cache:"no-store"});
      return res.status(r.status).setHeader("Content-Type","application/json; charset=utf-8").send(await r.text());
    }
    if(req.method==="POST"){
      requireMissionControlOrigin(req);installClerkIdentityAdapter();installUpstreamDirectoryAdapter();
      const identity=await requireVerifiedIdentity(req),ctx=await resolveAccessContext(identity,"butler-household");
      const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
      const operation=String(body.operation||"save_draft");
      if(!["save_draft","approve"].includes(operation))return res.status(400).json({ok:false,error:"Unsupported meal operation"});
      const auth=authorize({user:ctx.user,household:ctx.household,membership:ctx.membership,resource:"meals",operation});
      if(!auth.ok)return res.status(403).json({ok:false,error:"Forbidden",reason:auth.reason});
      const payload={token,resource:"meals",operation,actor:ctx.user.userId,householdId:ctx.household.householdId,meals:body.meals||{}};
      const r=await fetch(upstream,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload),cache:"no-store"});
      return res.status(r.status).setHeader("Content-Type","application/json; charset=utf-8").send(await r.text());
    }
    res.setHeader("Allow","GET, POST");return res.status(405).json({ok:false,error:"Method not allowed"});
  }catch(e){const status=Number(e&&e.statusCode)||502;return res.status(status).json({ok:false,error:String(e&&e.message||e),code:e&&e.code||"UPSTREAM_ERROR"})}
}