export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  const upstream=process.env.MC_SYNC_URL,token=process.env.MC_SYNC_TOKEN;
  if(!upstream||!token)return res.status(503).json({ok:false,error:"Mission Control private sync is not configured."});
  try{
    if(req.method==="GET"){
      const sep=upstream.includes("?")?"&":"?";
      const r=await fetch(upstream+sep+"token="+encodeURIComponent(token)+"&resource=meals",{cache:"no-store"});
      return res.status(r.status).setHeader("Content-Type","application/json; charset=utf-8").send(await r.text());
    }
    if(req.method==="POST"){
      const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
      const payload={token,resource:"meals",operation:body.operation||"save_draft",actor:body.actor||"Mission Control App",meals:body.meals||{}};
      const r=await fetch(upstream,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload),cache:"no-store"});
      return res.status(r.status).setHeader("Content-Type","application/json; charset=utf-8").send(await r.text());
    }
    res.setHeader("Allow","GET, POST");return res.status(405).json({ok:false,error:"Method not allowed"});
  }catch(e){return res.status(502).json({ok:false,error:String(e&&e.message||e)})}
}