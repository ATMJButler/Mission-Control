import {installClerkIdentityAdapter} from "../../auth/clerk-adapter.js";
import {requireVerifiedIdentity} from "../../auth/session.js";
import {bootstrapFirstPrincipal} from "../../auth/upstream-directory.js";

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  installClerkIdentityAdapter();
  if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).json({ok:false,error:"Method not allowed"});}
  try{
    const identity=await requireVerifiedIdentity(req);
    const result=await bootstrapFirstPrincipal(identity);
    return res.status(201).json(result);
  }catch(e){
    const status=Number(e&&e.statusCode)||500;
    return res.status(status).json({ok:false,error:String(e&&e.message||e),code:e&&e.code||"BOOTSTRAP_ERROR"});
  }
}
