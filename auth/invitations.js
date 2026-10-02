import crypto from "node:crypto";
import {installClerkIdentityAdapter} from "./clerk-adapter.js";
import {requireVerifiedIdentity} from "./session.js";
import {installUpstreamDirectoryAdapter} from "./upstream-directory.js";
import {resolveAccessContext} from "./directory.js";
import {authorize} from "./authorization.js";

async function upstreamCall(payload){
  const upstream=process.env.MC_SYNC_URL,token=process.env.MC_SYNC_TOKEN;
  if(!upstream||!token)throw Object.assign(new Error("Private upstream unavailable"),{statusCode:503});
  const r=await fetch(upstream,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({...payload,token}),cache:"no-store"});
  const text=await r.text();let body;try{body=JSON.parse(text)}catch(_e){throw Object.assign(new Error("Invitation upstream returned non-JSON"),{statusCode:502})}
  if(!body.ok)throw Object.assign(new Error(body.error||body.reason||"Invitation denied"),{statusCode:403,code:body.error||body.reason});
  return body;
}
export async function createInvitation(req,{householdId,role}){
  installClerkIdentityAdapter();installUpstreamDirectoryAdapter();
  const identity=await requireVerifiedIdentity(req),ctx=await resolveAccessContext(identity,householdId);
  const auth=authorize({user:ctx.user,household:ctx.household,membership:ctx.membership,resource:"identity",operation:"manage_memberships"});
  if(!auth.ok)throw Object.assign(new Error(auth.reason),{statusCode:403,code:auth.reason});
  if(!["secondary","extended"].includes(role))throw Object.assign(new Error("ROLE_NOT_INVITABLE"),{statusCode:400});
  const raw=crypto.randomBytes(32).toString("base64url"),tokenHash=crypto.createHash("sha256").update(raw).digest("hex"),expiresAt=new Date(Date.now()+24*60*60*1000).toISOString();
  const result=await upstreamCall({resource:"household_invitation",operation:"create",actorUserId:ctx.user.userId,householdId,role,tokenHash,expiresAt});
  return {...result,inviteToken:raw};
}
export async function claimInvitation(req,rawToken){
  installClerkIdentityAdapter();const identity=await requireVerifiedIdentity(req);
  return upstreamCall({resource:"household_invitation",operation:"claim",identity,token:rawToken});
}
