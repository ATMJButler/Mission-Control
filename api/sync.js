import {buildLegacyProjectEnvelope} from "../auth/legacy-sync-envelope.js";
import {requireMissionControlOrigin} from "../auth/origin.js";
import {installClerkIdentityAdapter} from "../auth/clerk-adapter.js";
import {requireVerifiedIdentity} from "../auth/session.js";
import {installUpstreamDirectoryAdapter} from "../auth/upstream-directory.js";
import {resolveAccessContext} from "../auth/directory.js";
import {authorize} from "../auth/authorization.js";
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma","no-cache");
  res.setHeader("Expires","0");
  res.setHeader("Surrogate-Control","no-store");
  const upstream=process.env.MC_SYNC_URL;
  const token=process.env.MC_SYNC_TOKEN;
  if(!upstream||!token)return res.status(503).json({ok:false,error:"Mission Control private sync is not configured."});
  try{
    if(req.method==="GET"){
      installClerkIdentityAdapter();installUpstreamDirectoryAdapter();
      const identity=await requireVerifiedIdentity(req);
      const ctx=await resolveAccessContext(identity,"butler-household");
      const auth=authorize({user:ctx.user,household:ctx.household,membership:ctx.membership,resource:"projects",operation:"read"});
      if(!auth.ok)return res.status(403).json({ok:false,error:"Forbidden",reason:auth.reason});
      const sep=upstream.includes("?")?"&":"?";
      const r=await fetch(upstream+sep+"token="+encodeURIComponent(token),{cache:"no-store"});
      const body=await r.text();
      res.status(r.status).setHeader("Content-Type","application/json; charset=utf-8").send(body);
      return;
    }
    if(req.method==="POST"){
      requireMissionControlOrigin(req);
      installClerkIdentityAdapter();installUpstreamDirectoryAdapter();
      const identity=await requireVerifiedIdentity(req);
      const ctx=await resolveAccessContext(identity,"butler-household");
      const auth=authorize({user:ctx.user,household:ctx.household,membership:ctx.membership,resource:"projects",operation:"update_project"});
      if(!auth.ok)return res.status(403).json({ok:false,error:"Forbidden",reason:auth.reason});
      const incoming=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
      const built=buildLegacyProjectEnvelope({incoming,token,userId:ctx.user.userId,householdId:ctx.household.householdId});
      if(!built.ok)return res.status(built.status).json({ok:false,error:built.error,fields:built.fields});
      const payload=built.payload;
      const r=await fetch(upstream,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload),cache:"no-store"});
      const body=await r.text();
      res.status(r.status).setHeader("Content-Type","application/json; charset=utf-8").send(body);
      return;
    }
    res.setHeader("Allow","GET, POST");res.status(405).json({ok:false,error:"Method not allowed"});
  }catch(e){const status=Number(e&&e.statusCode)||502;res.status(status).json({ok:false,error:String(e&&e.message||e),code:e&&e.code||"UPSTREAM_ERROR"})}
}