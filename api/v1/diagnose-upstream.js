import {installClerkIdentityAdapter} from "../../auth/clerk-adapter.js";
import {requireVerifiedIdentity} from "../../auth/session.js";
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");installClerkIdentityAdapter();
  if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).json({ok:false,error:"Method not allowed"});}
  try{
    await requireVerifiedIdentity(req);
    const upstream=process.env.MC_SYNC_URL,token=process.env.MC_SYNC_TOKEN;
    if(!upstream||!token)return res.status(503).json({ok:false,error:"Private upstream unavailable"});
    const r=await fetch(upstream,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({token,resource:"identity_directory",operation:"resolve",provider:"diagnostic",subject:"diagnostic",householdId:"diagnostic"}),cache:"no-store",redirect:"follow"});
    const text=await r.text(),type=String(r.headers.get("content-type")||"");let finalHost="unknown",configuredHost="unknown";
    try{finalHost=new URL(r.url).hostname}catch(_e){}try{configuredHost=new URL(upstream).hostname}catch(_e){}
    let json=false,bodyOk=null,error=null;try{const b=JSON.parse(text);json=true;bodyOk=b.ok;error=b.error||b.reason||null}catch(_e){}
    return res.status(200).json({ok:true,upstreamStatus:r.status,contentType:type,configuredHost,finalHost,redirected:r.redirected,json,bodyOk,error});
  }catch(e){return res.status(Number(e&&e.statusCode)||500).json({ok:false,error:String(e&&e.message||e),code:e&&e.code||"DIAGNOSTIC_ERROR"})}
}